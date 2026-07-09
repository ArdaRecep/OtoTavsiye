import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { NextRequest } from "next/server";

type FavoriteStateRow = {
  vehicle_id: string;
  is_favorited: boolean;
  favorite_count: number;
};

export async function GET(request: NextRequest) {
  try {
    const vehicleId = request.nextUrl.searchParams.get("vehicleId");

    if (!vehicleId) {
      return Response.json({ error: "vehicleId gerekli." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_vehicle_favorite_state", {
      p_vehicle_id: vehicleId,
    });

    if (error) {
      return Response.json({ error: "Favori bilgisi alınamadı." }, { status: 500 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as FavoriteStateRow | null;

    return Response.json({
      vehicleId: row?.vehicle_id ?? vehicleId,
      isFavorite: Boolean(row?.is_favorited),
      isFavorited: Boolean(row?.is_favorited),
      favCount: Number(row?.favorite_count ?? 0),
      favoriteCount: Number(row?.favorite_count ?? 0),
    });
  } catch {
    return Response.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleId, action } = body as {
      vehicleId?: string;
      action?: "like" | "favorite";
    };

    if (!vehicleId || !action) {
      return Response.json({ error: "vehicleId ve action gerekli." }, { status: 400 });
    }

    if (action !== "favorite") {
      return Response.json({ error: "Araç beğeni sistemi yıldız puanlamaya taşındı." }, { status: 410 });
    }

    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("toggle_vehicle_favorite", {
      p_vehicle_id: vehicleId,
    });

    if (error) {
      return Response.json({ error: "Favori güncellenemedi." }, { status: 500 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as FavoriteStateRow | null;

    return Response.json({
      vehicleId: row?.vehicle_id ?? vehicleId,
      isFavorite: Boolean(row?.is_favorited),
      isFavorited: Boolean(row?.is_favorited),
      favCount: Number(row?.favorite_count ?? 0),
      favoriteCount: Number(row?.favorite_count ?? 0),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}
