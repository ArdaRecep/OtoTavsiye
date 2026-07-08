import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type CommentReactionRow = {
  comment_id: string;
  like_count: number;
  dislike_count: number;
  current_user_reaction: "like" | "dislike" | null;
};

export async function POST(request: NextRequest) {
  try {
    const { commentId, userId, action } = await request.json();

    if (!commentId || !userId || !action || !["like", "dislike"].includes(action)) {
      return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient({ userId });
    const { data, error } = await supabase.rpc("toggle_comment_reaction", {
      p_comment_id: commentId,
      p_type: action,
    });

    if (error) {
      return Response.json({ error: "İşlem gerçekleştirilemedi.", details: error.message }, { status: 500 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as CommentReactionRow | null;

    return Response.json({
      commentId: row?.comment_id ?? commentId,
      likeCount: Number(row?.like_count ?? 0),
      dislikeCount: Number(row?.dislike_count ?? 0),
      userInteraction: row?.current_user_reaction ?? null,
    });
  } catch {
    return Response.json({ error: "İşlem gerçekleştirilemedi." }, { status: 500 });
  }
}
