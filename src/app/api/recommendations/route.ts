import {
  buildAracOnerArgs,
  buildBrowseResponse,
  buildRecommendationResponse,
  hasRecommendationFilters,
  normalizeRecommendationRequest,
  normalizePage,
  normalizePageSize,
  type AracOnerRow,
  type RawRecommendationRequest,
  type VehicleProfileRow,
} from "@/lib/recommendations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const vehicleProfileSelect =
  "id, make, model, trim_level, segment, power_hp, min_year, max_year, min_km, max_km, market_min_price, market_max_price, avg_annual_cost_try, condition_summary, image_url, tags, why_listed, pros, cons";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RawRecommendationRequest;
    const page = normalizePage(payload.page);
    const pageSize = normalizePageSize(payload.pageSize);
    const from = page * pageSize;
    const to = from + pageSize;
    const searchQuery = normalizeSearchTerm(payload.searchQuery);
    const supabase = createSupabaseAdminClient();

    if (searchQuery && searchQuery.length >= 2) {
      const searchTerms = searchQuery.split(" ").filter(Boolean).slice(0, 5);
      let query = supabase
        .from("vehicle_market_profiles")
        .select(vehicleProfileSelect, { count: "exact" });

      for (const term of searchTerms) {
        const searchPattern = escapeIlike(term);
        query = query.or(
          [
            `make.ilike.%${searchPattern}%`,
            `model.ilike.%${searchPattern}%`,
            `trim_level.ilike.%${searchPattern}%`,
            `segment.ilike.%${searchPattern}%`,
            `fuel_type.ilike.%${searchPattern}%`,
          ].join(","),
        );
      }

      const { data, error, count } = await query
        .order("make", { ascending: true })
        .order("model", { ascending: true })
        .range(from, to);

      if (error) {
        return Response.json(
          {
            error: "Arama sonuçları alınamadı.",
          },
          { status: 500 },
        );
      }

      const rows = (data ?? []) as VehicleProfileRow[];
      return Response.json(
        buildBrowseResponse(rows.slice(0, pageSize), normalizeRecommendationRequest({
          minBudget: 0,
          maxBudget: Number.MAX_SAFE_INTEGER,
        }), {
          hasMore: rows.length > pageSize,
          mode: "search",
          page,
          pageSize,
          searchQuery,
          totalMatches: count ?? 0,
        }),
      );
    }

    const appliedFilters = normalizeRecommendationRequest(payload);
    const shouldRecommend = hasRecommendationFilters(appliedFilters);

    if (!shouldRecommend) {
      const { data, error, count } = await supabase
        .from("vehicle_market_profiles")
        .select(vehicleProfileSelect, { count: "exact" })
        .lte("market_min_price", appliedFilters.maxPrice)
        .gte("market_max_price", appliedFilters.minPrice)
        .order("market_min_price", { ascending: true })
        .range(from, to);

      if (error) {
        return Response.json(
          {
            error: "Araç listesi alınamadı.",
          },
          { status: 500 },
        );
      }

      const rows = (data ?? []) as VehicleProfileRow[];
      return Response.json(
        buildBrowseResponse(rows.slice(0, pageSize), appliedFilters, {
          hasMore: rows.length > pageSize,
          mode: "browse",
          page,
          pageSize,
          totalMatches: count ?? 0,
        }),
      );
    }

    const rpcArgs = buildAracOnerArgs(appliedFilters);
    const { data, error } = await supabase.rpc("arac_oner", rpcArgs).limit(10);

    if (error) {
      return Response.json(
        {
          error: "Araç önerileri alınamadı.",
        },
        { status: 500 },
      );
    }

    return Response.json(
      buildRecommendationResponse((data ?? []) as AracOnerRow[], appliedFilters, {
        mode: "recommended",
        page: 0,
        pageSize: 10,
        hasMore: false,
      }),
    );
  } catch {
    return Response.json(
      {
        error: "Geçersiz istek.",
      },
      { status: 400 },
    );
  }
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function normalizeSearchTerm(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
