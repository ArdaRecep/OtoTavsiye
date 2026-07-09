import {
  buildBrowseResponse,
  normalizeRecommendationRequest,
  type VehicleProfileRow,
} from "@/lib/recommendations";
import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const vehicleProfileSelect =
  "id, make, model, trim_level, segment, power_hp, min_year, max_year, min_km, max_km, market_min_price, market_max_price, avg_annual_cost_try, condition_summary, image_url, tags, why_listed, pros, cons";

export async function GET() {
  try {
    const user = await requireUser();

    const supabase = await createSupabaseServerClient();
    const { data: favorites, error: favoriteError } = await supabase
      .from("vehicle_favorites")
      .select("vehicle_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (favoriteError) {
      return Response.json(
        { error: "Favoriler alınamadı." },
        { status: 500 },
      );
    }

    const ids = (favorites ?? []).map((item) => item.vehicle_id as string).filter(Boolean);
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
        { error: "Favori araçlar alınamadı." },
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
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Favoriler alınamadı." }, { status: 500 });
  }
}
