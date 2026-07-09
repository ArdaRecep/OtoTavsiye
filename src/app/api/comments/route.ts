import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { NextRequest } from "next/server";

type CommentRpcRow = {
  id: string;
  vehicle_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  author_username: string;
  author_avatar_url: string | null;
  like_count: number;
  dislike_count: number;
  current_user_reaction: "like" | "dislike" | null;
  reply_count: number;
  author_car_rating: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const vehicleId = request.nextUrl.searchParams.get("vehicleId");

    if (!vehicleId) {
      return Response.json({ error: "vehicleId gerekli." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_vehicle_comments", {
      p_vehicle_id: vehicleId,
    });

    if (error) {
      return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
    }

    const comments = ((data ?? []) as CommentRpcRow[]).map(normalizeCommentRow);

    return Response.json({ comments, total: comments.length });
  } catch {
    return Response.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleId, content, parentId } = body as {
      vehicleId?: string;
      content?: string;
      parentId?: string | null;
    };

    if (!vehicleId || !content?.trim()) {
      return Response.json({ error: "vehicleId ve content gerekli." }, { status: 400 });
    }

    const user = await requireUser();
    await assertCanPostComment(user.id, content);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_vehicle_comment", {
      p_vehicle_id: vehicleId,
      p_content: content,
      p_parent_id: parentId ?? null,
    });

    if (error) {
      return Response.json({ error: "Yorum eklenemedi." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    return Response.json({ comment: row ? normalizeCommentRow(row as CommentRpcRow) : null }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;

    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}

function normalizeCommentRow(row: CommentRpcRow) {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    parent_id: row.parent_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    user: {
      username: row.author_username,
      avatar_url: row.author_avatar_url,
    },
    likeCount: Number(row.like_count ?? 0),
    dislikeCount: Number(row.dislike_count ?? 0),
    userInteraction: row.current_user_reaction,
    replyCount: Number(row.reply_count ?? 0),
    authorCarRating: row.author_car_rating === null ? null : Number(row.author_car_rating),
  };
}
