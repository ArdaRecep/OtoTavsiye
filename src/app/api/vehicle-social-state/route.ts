import { createSupabaseServerClient } from "@/lib/supabase-server";

type VehicleSocialRpcRow = {
  vehicle_id: string;
  average_rating: number | null;
  rating_count: number;
  user_rating: number | null;
  favorite_count: number;
  is_favorited: boolean;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleIds } = body as {
      vehicleIds?: string[];
    };

    if (!Array.isArray(vehicleIds)) {
      return Response.json({ error: "vehicleIds gerekli." }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(vehicleIds.filter(Boolean)));

    if (!uniqueIds.length) {
      return Response.json({ vehicles: [] });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_vehicle_social_state", {
      p_vehicle_ids: uniqueIds,
    });

    if (error) {
      return Response.json({ error: "Araç sosyal bilgileri alınamadı." }, { status: 500 });
    }

    return Response.json({ vehicles: ((data ?? []) as VehicleSocialRpcRow[]).map(normalizeVehicleSocialRow) });
  } catch {
    return Response.json({ error: "Araç sosyal bilgileri alınamadı." }, { status: 500 });
  }
}

function normalizeVehicleSocialRow(row: VehicleSocialRpcRow) {
  return {
    vehicleId: row.vehicle_id,
    averageRating: Number(row.average_rating ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    userRating: row.user_rating === null ? null : Number(row.user_rating),
    favoriteCount: Number(row.favorite_count ?? 0),
    isFavorited: Boolean(row.is_favorited),
  };
}
