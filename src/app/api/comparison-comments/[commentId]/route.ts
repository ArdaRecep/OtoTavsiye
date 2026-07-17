import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import {
  comparisonRpcErrorResponse,
  normalizeComparisonComment,
  type ComparisonCommentRpcRow,
} from "@/lib/comparisons/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ commentId: string }>;
};

type UpdateCommentPayload = {
  body?: unknown;
  content?: unknown;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { commentId } = await context.params;
    const body = (await request.json()) as UpdateCommentPayload;
    const content = typeof body.body === "string" ? body.body : typeof body.content === "string" ? body.content : "";

    if (!commentId || !content.trim()) {
      return Response.json({ error: "commentId ve yorum gerekli." }, { status: 400 });
    }

    await assertCanPostComment(user.id, content);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_vehicle_comparison_comment", {
      p_comment_id: commentId,
      p_body: content,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorum güncellenemedi." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    return Response.json({ comment: normalizeComparisonComment(row as ComparisonCommentRpcRow) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;

    return Response.json({ error: "Yorum güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { commentId } = await context.params;

    if (!commentId) {
      return Response.json({ error: "commentId gerekli." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: comment, error: commentError } = await admin
      .from("vehicle_comparison_comments")
      .select("id, comparison_id, parent_id, user_id, deleted_at")
      .eq("id", commentId)
      .maybeSingle<{
        id: string;
        comparison_id: string;
        parent_id: string | null;
        user_id: string;
        deleted_at: string | null;
      }>();

    if (commentError) {
      const rpcResponse = comparisonRpcErrorResponse(commentError.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    if (!comment) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    if (comment.user_id !== user.id && !user.profile?.is_admin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const { count: replyCount, error: replyError } = await admin
      .from("vehicle_comparison_comments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", commentId);

    if (replyError) {
      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    if ((replyCount ?? 0) > 0) {
      const deletedAt = comment.deleted_at ?? new Date().toISOString();
      const [{ error: interactionError }, { error: updateError }] = await Promise.all([
        admin.from("vehicle_comparison_comment_interactions").delete().eq("comment_id", commentId),
        admin
          .from("vehicle_comparison_comments")
          .update({ body: "[silindi]", deleted_at: deletedAt })
          .eq("id", commentId),
      ]);

      if (interactionError || updateError) {
        return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: "soft",
        comment: {
          id: comment.id,
          comparisonId: comment.comparison_id,
          deletedAt,
        },
      });
    }

    const { error: deleteError } = await admin.from("vehicle_comparison_comments").delete().eq("id", commentId);

    if (deleteError) {
      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    await pruneEmptyDeletedComparisonAncestors(admin, comment.parent_id);

    return Response.json({
      ok: true,
      mode: "hard",
      comment: {
        id: comment.id,
        comparisonId: comment.comparison_id,
        deletedAt: comment.deleted_at,
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Yorum silinemedi." }, { status: 400 });
  }
}

async function pruneEmptyDeletedComparisonAncestors(admin: SupabaseAdminClient, parentId: string | null) {
  let nextParentId = parentId;

  while (nextParentId) {
    const { data: parent } = await admin
      .from("vehicle_comparison_comments")
      .select("id, parent_id, deleted_at")
      .eq("id", nextParentId)
      .maybeSingle<{ id: string; parent_id: string | null; deleted_at: string | null }>();

    if (!parent || !parent.deleted_at) return;

    const { count } = await admin
      .from("vehicle_comparison_comments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", parent.id);

    if ((count ?? 0) > 0) return;

    await admin.from("vehicle_comparison_comments").delete().eq("id", parent.id);
    nextParentId = parent.parent_id;
  }
}
