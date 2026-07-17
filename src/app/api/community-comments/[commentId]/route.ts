import { getAdminState } from "@/lib/admin";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { requireUser } from "@/lib/auth/require-user";
import { COMMUNITY_IMAGE_BUCKET } from "@/lib/community-media-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type Context = { params: Promise<{ commentId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { commentId } = await context.params;
    const body = (await request.json()) as { content?: unknown };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (content.length < 1 || content.length > 1000) {
      return Response.json({ error: "Yorum 1-1000 karakter olmalı." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: comment } = await admin
      .from("community_comments")
      .select("user_id, deleted_at")
      .eq("id", commentId)
      .maybeSingle<{ user_id: string; deleted_at: string | null }>();
    if (!comment || comment.deleted_at) return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    if (comment.user_id !== user.id && !user.profile?.is_admin) return Response.json({ error: "Yetkin yok." }, { status: 403 });

    await assertCanPostComment(user.id, content);
    const { error } = await admin
      .from("community_comments")
      .update({ content })
      .eq("id", commentId);
    if (error) return Response.json({ error: "Yorum güncellenemedi." }, { status: 500 });

    return Response.json({ ok: true, content });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;
    return Response.json({ error: "Yorum güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const { commentId } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: comment } = await admin
    .from("community_comments")
    .select("parent_id, image_paths")
    .eq("id", commentId)
    .maybeSingle<{ parent_id: string | null; image_paths: string[] | null }>();

  if (!comment) return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });

  const { count: replyCount, error: replyError } = await admin
    .from("community_comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", commentId);

  if (replyError) return Response.json({ error: "Yorum silinemedi." }, { status: 500 });

  if (comment?.image_paths?.length) {
    await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(comment.image_paths);
  }

  if ((replyCount ?? 0) > 0) {
    const [{ error: interactionError }, { error: updateError }] = await Promise.all([
      admin.from("community_comment_interactions").delete().eq("comment_id", commentId),
      admin
        .from("community_comments")
        .update({ deleted_at: new Date().toISOString(), image_paths: [] })
        .eq("id", commentId),
    ]);

    if (interactionError || updateError) return Response.json({ error: "Yorum silinemedi." }, { status: 500 });

    return Response.json({ ok: true, mode: "soft" });
  }

  const { error } = await admin.from("community_comments").delete().eq("id", commentId);
  if (error) return Response.json({ error: "Yorum silinemedi." }, { status: 500 });

  await pruneEmptyDeletedCommunityAncestors(admin, comment.parent_id);

  return Response.json({ ok: true, mode: "hard" });
}

async function pruneEmptyDeletedCommunityAncestors(admin: SupabaseAdminClient, parentId: string | null) {
  let nextParentId = parentId;

  while (nextParentId) {
    const { data: parent } = await admin
      .from("community_comments")
      .select("id, parent_id, deleted_at")
      .eq("id", nextParentId)
      .maybeSingle<{ id: string; parent_id: string | null; deleted_at: string | null }>();

    if (!parent || !parent.deleted_at) return;

    const { count } = await admin
      .from("community_comments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", parent.id);

    if ((count ?? 0) > 0) return;

    await admin.from("community_comments").delete().eq("id", parent.id);
    nextParentId = parent.parent_id;
  }
}
