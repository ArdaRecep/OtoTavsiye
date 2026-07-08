import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type RatingStateRow = {
  vehicle_id: string;
  average_rating: number | null;
  rating_count: number;
  user_rating: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const vehicleId = request.nextUrl.searchParams.get("vehicleId");
    const userId = request.nextUrl.searchParams.get("userId");

    if (!vehicleId) {
      return Response.json({ error: "vehicleId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient({ userId });
    const { data, error } = await supabase.rpc("get_vehicle_rating_state", {
      p_vehicle_id: vehicleId,
    });

    if (error) {
      return Response.json({ error: "Puan bilgisi alınamadı.", details: error.message }, { status: 500 });
    }

    return Response.json(normalizeRatingRow((Array.isArray(data) ? data[0] : data) as RatingStateRow | null, vehicleId));
  } catch {
    return Response.json({ error: "Puan bilgisi alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleId, userId, rating } = body as {
      vehicleId?: string;
      userId?: string;
      rating?: number;
    };

    if (!vehicleId || !userId || typeof rating !== "number") {
      return Response.json({ error: "vehicleId, userId ve rating gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient({ userId });
    const { data, error } = await supabase.rpc("rate_vehicle", {
      p_vehicle_id: vehicleId,
      p_rating: rating,
    });

    if (error) {
      return Response.json({ error: "Puan kaydedilemedi.", details: error.message }, { status: 500 });
    }

    return Response.json(normalizeRatingRow((Array.isArray(data) ? data[0] : data) as RatingStateRow | null, vehicleId));
  } catch {
    return Response.json({ error: "Puan kaydedilemedi." }, { status: 400 });
  }
}

function normalizeRatingRow(row: RatingStateRow | null, vehicleId: string) {
  return {
    vehicleId: row?.vehicle_id ?? vehicleId,
    averageRating: Number(row?.average_rating ?? 0),
    ratingCount: Number(row?.rating_count ?? 0),
    userRating: row?.user_rating === null || row?.user_rating === undefined ? null : Number(row.user_rating),
  };
}
