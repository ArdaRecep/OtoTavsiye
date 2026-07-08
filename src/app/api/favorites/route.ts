import {
  buildBrowseResponse,
  normalizeRecommendationRequest,
  type VehicleProfileRow,
} from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

const vehicleProfileSelect =
  "id, make, model, trim_level, segment, power_hp, min_year, max_year, min_km, max_km, market_min_price, market_max_price, avg_annual_cost_try, condition_summary, image_url, tags, why_listed, pros, cons";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Giriş gerekli." }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { data: interactions, error: interactionError } = await supabase
      .from("user_vehicle_interactions")
      .select("vehicle_id, created_at")
      .eq("user_id", userId)
      .eq("is_favorite", true)
      .order("created_at", { ascending: false });

    if (interactionError) {
      return Response.json(
        { error: "Favoriler alınamadı.", details: interactionError.message },
        { status: 500 },
      );
    }

    const ids = (interactions ?? []).map((item) => item.vehicle_id as string).filter(Boolean);
    const appliedFilters = normalizeRecommendationRequest({
      minBudget: 0,
      maxBudget: Number.MAX_SAFE_INTEGER,
    });

    if (!ids.length) {
      return Response.json(
        buildBrowseResponse([], appliedFilters, {
          hasMore: false,
          mode: "browse",
          page: 0,
          pageSize: 0,
        }),
      );
    }

    const { data, error } = await supabase
      .from("vehicle_market_profiles")
      .select(vehicleProfileSelect)
      .in("id", ids);

    if (error) {
      return Response.json(
        { error: "Favori araçlar alınamadı.", details: error.message },
        { status: 500 },
      );
    }

    const rowsById = new Map(((data ?? []) as VehicleProfileRow[]).map((row) => [row.id, row]));
    const rows = ids
      .map((id) => rowsById.get(id))
      .filter((row): row is VehicleProfileRow => Boolean(row));

    return Response.json(
      buildBrowseResponse(rows, appliedFilters, {
        hasMore: false,
        mode: "browse",
        page: 0,
        pageSize: rows.length,
      }),
    );
  } catch {
    return Response.json({ error: "Favoriler alınamadı." }, { status: 500 });
  }
}
