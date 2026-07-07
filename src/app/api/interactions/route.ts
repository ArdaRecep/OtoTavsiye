import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

/**
 * GET /api/interactions?vehicleId=...&userId=...
 * Araç için toplam like/fav sayılarını ve mevcut kullanıcının durumunu döndürür.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const vehicleId = searchParams.get("vehicleId");
    const userId = searchParams.get("userId");

    if (!vehicleId) {
      return Response.json({ error: "vehicleId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Toplam like sayısı
    const { count: likeCount, error: likeCountError } = await supabase
      .from("user_vehicle_interactions")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("is_liked", true);

    if (likeCountError) {
      return Response.json(
        { error: "Like sayısı alınamadı.", details: likeCountError.message },
        { status: 500 },
      );
    }

    // Toplam favori sayısı
    const { count: favCount, error: favCountError } = await supabase
      .from("user_vehicle_interactions")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("is_favorite", true);

    if (favCountError) {
      return Response.json(
        { error: "Favori sayısı alınamadı.", details: favCountError.message },
        { status: 500 },
      );
    }

    let isLiked = false;
    let isFavorite = false;

    // Mevcut kullanıcının durumunu kontrol et
    if (userId) {
      const { data: interaction } = await supabase
        .from("user_vehicle_interactions")
        .select("is_liked, is_favorite")
        .eq("vehicle_id", vehicleId)
        .eq("user_id", userId)
        .maybeSingle();

      if (interaction) {
        isLiked = interaction.is_liked ?? false;
        isFavorite = interaction.is_favorite ?? false;
      }
    }

    return Response.json({
      likeCount: likeCount ?? 0,
      favCount: favCount ?? 0,
      isLiked,
      isFavorite,
    });
  } catch {
    return Response.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

/**
 * POST /api/interactions
 * Like veya Favorite toggle işlemi.
 * Body: { vehicleId, userId, action: "like" | "favorite" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleId, userId, action } = body as {
      vehicleId?: string;
      userId?: string;
      action?: "like" | "favorite";
    };

    if (!vehicleId || !userId || !action) {
      return Response.json(
        { error: "vehicleId, userId ve action gerekli." },
        { status: 400 },
      );
    }

    if (action !== "like" && action !== "favorite") {
      return Response.json(
        { error: "action 'like' veya 'favorite' olmalı." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServerClient();
    const column = action === "like" ? "is_liked" : "is_favorite";

    // Mevcut etkileşimi kontrol et
    const { data: existing } = await supabase
      .from("user_vehicle_interactions")
      .select("id, is_liked, is_favorite")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const currentValue = existing[column] as boolean;
      const newValue = !currentValue;

      // Eğer ikisi de false olacaksa satırı sil
      const otherColumn = column === "is_liked" ? "is_favorite" : "is_liked";
      const otherValue = existing[otherColumn] as boolean;

      if (!newValue && !otherValue) {
        await supabase
          .from("user_vehicle_interactions")
          .delete()
          .eq("id", existing.id);
      } else {
        await supabase
          .from("user_vehicle_interactions")
          .update({ [column]: newValue })
          .eq("id", existing.id);
      }

      // Güncel sayıları getir
      const { count: likeCount } = await supabase
        .from("user_vehicle_interactions")
        .select("*", { count: "exact", head: true })
        .eq("vehicle_id", vehicleId)
        .eq("is_liked", true);

      const { count: favCount } = await supabase
        .from("user_vehicle_interactions")
        .select("*", { count: "exact", head: true })
        .eq("vehicle_id", vehicleId)
        .eq("is_favorite", true);

      return Response.json({
        action: newValue ? action : `un${action}`,
        isLiked: column === "is_liked" ? newValue : (existing.is_liked ?? false),
        isFavorite: column === "is_favorite" ? newValue : (existing.is_favorite ?? false),
        likeCount: likeCount ?? 0,
        favCount: favCount ?? 0,
      });
    }

    // Yeni etkileşim oluştur
    await supabase
      .from("user_vehicle_interactions")
      .insert({
        vehicle_id: vehicleId,
        user_id: userId,
        [column]: true,
      });

    const { count: likeCount } = await supabase
      .from("user_vehicle_interactions")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("is_liked", true);

    const { count: favCount } = await supabase
      .from("user_vehicle_interactions")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId)
      .eq("is_favorite", true);

    return Response.json({
      action,
      isLiked: column === "is_liked",
      isFavorite: column === "is_favorite",
      likeCount: likeCount ?? 0,
      favCount: favCount ?? 0,
    });
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}
