import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import { comparisonRpcErrorResponse } from "@/lib/comparisons/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ComparisonCommentReactionRow = {
  comment_id: string;
  like_count: number;
  dislike_count: number;
  current_user_reaction: "like" | "dislike" | null;
};

export async function POST(request: Request) {
  try {
    const { commentId, action } = (await request.json()) as {
      commentId?: unknown;
      action?: unknown;
    };

    if (typeof commentId !== "string" || !commentId || !["like", "dislike"].includes(String(action))) {
      return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    await requireUser();
    const admin = createSupabaseAdminClient();
    const { data: comment } = await admin
      .from("vehicle_comparison_comments")
      .select("deleted_at")
      .eq("id", commentId)
      .maybeSingle<{ deleted_at: string | null }>();

    if (!comment || comment.deleted_at) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("toggle_vehicle_comparison_comment_reaction", {
      p_comment_id: commentId,
      p_type: action,
    });

    if (error) {
      if (isMissingComparisonCommentInteractionsMigrationError(error.message)) {
        return Response.json(
          { error: "Karşılaştırma yorum etkileşim migrationı Supabase'de çalıştırılmalı." },
          { status: 503 },
        );
      }

      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "İşlem gerçekleştirilemedi." }, { status: 500 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as ComparisonCommentReactionRow | null;

    return Response.json({
      commentId: row?.comment_id ?? commentId,
      likeCount: Number(row?.like_count ?? 0),
      dislikeCount: Number(row?.dislike_count ?? 0),
      userInteraction: row?.current_user_reaction ?? null,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "İşlem gerçekleştirilemedi." }, { status: 500 });
  }
}

function isMissingComparisonCommentInteractionsMigrationError(message?: string) {
  if (!message) return false;

  return (
    message.includes("toggle_vehicle_comparison_comment_reaction") ||
    message.includes("Could not find the function") ||
    (message.includes("function") && message.includes("does not exist"))
  );
}
