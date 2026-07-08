import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { commentId, userId, action } = await request.json();

    if (!commentId || !userId || !action || !["like", "dislike"].includes(action)) {
      return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Mevcut etkileşimi kontrol et
    const { data: existing, error: existingError } = await supabase
      .from("comment_interactions")
      .select("id, type")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error("Existing error:", existingError);
      throw existingError;
    }

    if (existing) {
      if (existing.type === action) {
        // Zaten aynı etkileşim varsa kaldır (toggle kapama)
        await supabase.from("comment_interactions").delete().eq("id", existing.id);
      } else {
        // Farklı etkileşim varsa güncelle
        await supabase
          .from("comment_interactions")
          .update({ type: action })
          .eq("id", existing.id);
      }
    } else {
      // Yoksa yeni oluştur
      const { error: insertError } = await supabase.from("comment_interactions").insert({
        comment_id: commentId,
        user_id: userId,
        type: action,
      });
      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
    }

    // Güncel sayıları getir
    const { count: likeCount } = await supabase
      .from("comment_interactions")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", commentId)
      .eq("type", "like");

    const { count: dislikeCount } = await supabase
      .from("comment_interactions")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", commentId)
      .eq("type", "dislike");

    // Kullanıcının güncel durumunu getir
    const { data: currentInteraction } = await supabase
      .from("comment_interactions")
      .select("type")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();

    return Response.json({
      likeCount: likeCount ?? 0,
      dislikeCount: dislikeCount ?? 0,
      userInteraction: currentInteraction?.type ?? null,
    });
  } catch (error) {
    console.error("Comment interaction error:", error);
    return Response.json(
      { error: "İşlem gerçekleştirilemedi." },
      { status: 500 }
    );
  }
}
