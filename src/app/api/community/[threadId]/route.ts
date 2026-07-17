import { getAdminState } from "@/lib/admin";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { requireUser } from "@/lib/auth/require-user";
import { communityMigrationError, normalizeCommunityThread, type CommunityThreadRpcRow } from "@/lib/community";
import { normalizeCommunityImagePaths } from "@/lib/community-media";
import { COMMUNITY_IMAGE_BUCKET, getCommunityImageUrls } from "@/lib/community-media-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ threadId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { threadId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_community_thread", { p_thread_id: threadId });
    if (error) {
      return Response.json({ error: communityMigrationError(error.message) ? "Topluluk kurulumu henüz tamamlanmadı." : "Konu alınamadı." }, { status: communityMigrationError(error.message) ? 503 : 500 });
    }
    const row = ((data ?? []) as CommunityThreadRpcRow[])[0];
    if (!row) return Response.json({ error: "Konu bulunamadı." }, { status: 404 });
    const { data: socialRows } = await supabase.rpc("get_community_thread_social_state", { p_thread_ids: [threadId] });
    const social = (Array.isArray(socialRows) ? socialRows[0] : null) as { like_count?: number; dislike_count?: number; current_user_reaction?: string | null } | null;
    return Response.json({
      thread: normalizeCommunityThread({
        ...row,
        like_count: social?.like_count ?? 0,
        dislike_count: social?.dislike_count ?? 0,
        current_user_reaction: social?.current_user_reaction ?? null,
      }, getCommunityImageUrls(row.image_paths)),
    });
  } catch {
    return Response.json({ error: "Konu alınamadı." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { threadId } = await context.params;
    const body = (await request.json()) as { status?: unknown; title?: unknown; body?: unknown; category?: unknown; imagePaths?: unknown };

    const admin = createSupabaseAdminClient();
    const { data: thread } = await admin
      .from("community_threads")
      .select("id, title, body, category, vehicle_id, status, created_at, updated_at, user_id, image_paths")
      .eq("id", threadId)
      .maybeSingle<{
        id: string;
        title: string;
        body: string;
        category: string;
        vehicle_id: string | null;
        status: "open" | "closed";
        created_at: string;
        updated_at: string;
        user_id: string;
        image_paths: string[] | null;
      }>();
    if (!thread) return Response.json({ error: "Konu bulunamadı." }, { status: 404 });

    const isAdmin = Boolean(user.profile?.is_admin);
    const isOwner = thread.user_id === user.id;
    const isStatusPatch = body.status === "open" || body.status === "closed";
    const isEditPatch = body.title !== undefined || body.body !== undefined || body.category !== undefined || body.imagePaths !== undefined;

    if (isEditPatch) {
      if (!isOwner) return Response.json({ error: "Yetkin yok." }, { status: 403 });

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const content = typeof body.body === "string" ? body.body.trim() : "";
      const category = typeof body.category === "string" ? body.category : "";
      const imagePaths = normalizeCommunityImagePaths(body.imagePaths, user.id);

      if (title.length < 5 || title.length > 120 || content.length < 10 || content.length > 3000 || !["vehicle_advice", "ownership", "technical", "general"].includes(category)) {
        return Response.json({ error: "Başlık 5-120, açıklama 10-3000 karakter olmalı." }, { status: 400 });
      }

      await assertCanPostComment(user.id, `${title} ${content}`);
      const previousPaths = thread.image_paths ?? [];
      const removedPaths = previousPaths.filter((path) => !imagePaths.includes(path));
      const { error } = await admin
        .from("community_threads")
        .update({ title, body: content, category, image_paths: imagePaths, updated_at: new Date().toISOString() })
        .eq("id", threadId)
        .eq("user_id", user.id);
      if (error) return Response.json({ error: "Konu güncellenemedi." }, { status: 500 });
      if (removedPaths.length) await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(removedPaths);

      return Response.json({
        ok: true,
        thread: {
          ...thread,
          title,
          body: content,
          category,
          image_paths: imagePaths,
          updated_at: new Date().toISOString(),
        },
      });
    }

    if (!isStatusPatch) return Response.json({ error: "Geçersiz durum." }, { status: 400 });
    if (!isAdmin && (!isOwner || body.status === "open")) return Response.json({ error: "Yetkin yok." }, { status: 403 });
    const nextStatus = body.status as "open" | "closed";

    const update: { status: "open" | "closed"; updated_at: string; image_paths?: string[] } = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "closed") {
      const imagePaths = thread?.image_paths ?? [];
      if (imagePaths.length) {
        const { error: storageError } = await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(imagePaths);
        if (storageError) return Response.json({ error: "Konu görselleri kaldırılamadı." }, { status: 500 });
      }
      update.image_paths = [];
    }

    const { error } = await admin.from("community_threads").update(update).eq("id", threadId);
    if (error) return Response.json({ error: "Konu güncellenemedi." }, { status: 500 });
    return Response.json({ ok: true, status: nextStatus });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;
    return Response.json({ error: "Konu güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const { threadId } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: thread } = await admin
    .from("community_threads")
    .select("image_paths")
    .eq("id", threadId)
    .maybeSingle<{ image_paths: string[] | null }>();
  const imagePaths = thread?.image_paths ?? [];
  if (imagePaths.length) {
    const { error: storageError } = await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(imagePaths);
    if (storageError) return Response.json({ error: "Konu görselleri kaldırılamadı." }, { status: 500 });
  }
  const { error } = await admin.from("community_threads").delete().eq("id", threadId);
  if (error) return Response.json({ error: "Konu silinemedi." }, { status: 500 });
  return Response.json({ ok: true });
}
