import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { requireUser } from "@/lib/auth/require-user";
import { communityMigrationError } from "@/lib/community";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ threadId: string }> };

type CommentRow = {
  id: string; thread_id: string; parent_id: string | null; user_id: string; content: string; created_at: string;
  author_username: string; author_avatar_url: string | null; like_count: number; dislike_count: number;
  current_user_reaction: "like" | "dislike" | null; reply_count: number;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { threadId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_community_comments", { p_thread_id: threadId });
    if (error) return Response.json({ error: communityMigrationError(error.message) ? "Topluluk kurulumu henüz tamamlanmadı." : "Yorumlar alınamadı." }, { status: communityMigrationError(error.message) ? 503 : 500 });
    const comments = ((data ?? []) as CommentRow[]).map(normalizeComment);
    return Response.json({ comments, total: comments.length });
  } catch {
    return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { threadId } = await context.params;
    const body = (await request.json()) as { content?: unknown; parentId?: unknown };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
    if (!content || content.length > 1000) {
      return Response.json({ error: "Yorum 1-1000 karakter olmalı." }, { status: 400 });
    }
    await assertCanPostComment(user.id, content);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_community_comment", { p_thread_id: threadId, p_content: content, p_parent_id: parentId });
    if (error) {
      const message = communityCommentError(error.message);
      const status = communityMigrationError(error.message) ? 503 : error.message.includes("RATE_LIMIT") ? 429 : 400;
      return Response.json({ error: message }, { status });
    }
    const row = (Array.isArray(data) ? data[0] : data) as CommentRow | null;
    return Response.json({ comment: row ? normalizeComment(row) : null }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;
    return Response.json({ error: "Yorum eklenemedi." }, { status: 400 });
  }
}

function normalizeComment(row: CommentRow) {
  return {
    id: row.id, vehicle_id: row.thread_id, parent_id: row.parent_id, user_id: row.user_id,
    content: row.content, created_at: row.created_at,
    user: { username: row.author_username, avatar_url: row.author_avatar_url },
    likeCount: Number(row.like_count ?? 0), dislikeCount: Number(row.dislike_count ?? 0),
    userInteraction: row.current_user_reaction, replyCount: Number(row.reply_count ?? 0), authorCarRating: null,
    imageUrls: [],
  };
}

function communityCommentError(message: string) {
  if (communityMigrationError(message)) return "Topluluk kurulumu henüz tamamlanmadı.";
  if (message.includes("THREAD_CLOSED")) return "Bu konu yanıtlara kapalı.";
  if (message.includes("RATE_LIMIT")) return "Yeni yorum göndermeden önce birkaç saniye bekle.";
  if (message.includes("CHAT_BANNED")) return "Toplulukta yazma yetkin geçici olarak kısıtlanmış.";
  if (message.includes("FORBIDDEN_WORD")) return "Yorum yasaklı bir kelime içeriyor.";
  return "Yorum eklenemedi.";
}
