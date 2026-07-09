import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireUser } from "@/lib/auth/require-user";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import {
  comparisonRpcErrorResponse,
  normalizeComparisonComment,
  type ComparisonCommentRpcRow,
} from "@/lib/comparisons/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ comparisonId: string }>;
};

type CreateCommentPayload = {
  body?: unknown;
  content?: unknown;
  parentId?: unknown;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { comparisonId } = await context.params;
    const limit = Math.min(Math.max(normalizePositiveInt(request.nextUrl.searchParams.get("limit"), 100), 1), 300);
    const offset = normalizePositiveInt(request.nextUrl.searchParams.get("offset"), 0);

    if (!comparisonId) {
      return Response.json({ error: "comparisonId gerekli." }, { status: 400 });
    }

    const currentUser = await getCurrentUser();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vehicle_comparison_comments")
      .select("id, comparison_id, parent_id, root_id, user_id, body, depth, created_at, updated_at, deleted_at")
      .eq("comparison_id", comparisonId)
      .order("root_id", { ascending: true })
      .order("depth", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
    }

    const rows = (data ?? []) as ComparisonCommentTableRow[];
    const comments = await hydrateComparisonComments(rows, currentUser?.id ?? null);

    return Response.json({ comments, total: comments.length, limit, offset });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { comparisonId } = await context.params;
    const body = (await request.json()) as CreateCommentPayload;
    const content = typeof body.body === "string" ? body.body : typeof body.content === "string" ? body.content : "";
    const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;

    if (!comparisonId || !content.trim()) {
      return Response.json({ error: "comparisonId ve yorum gerekli." }, { status: 400 });
    }

    await assertCanPostComment(user.id, content);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_vehicle_comparison_comment", {
      p_comparison_id: comparisonId,
      p_body: content,
      p_parent_id: parentId,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorum eklenemedi." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return Response.json({ error: "Yorum eklenemedi." }, { status: 500 });
    }

    return Response.json({ comment: normalizeComparisonComment(row as ComparisonCommentRpcRow) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;

    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}

function normalizePositiveInt(value: string | null, fallback: number) {
  if (value === null) return fallback;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return Math.floor(parsed);
}

type ComparisonCommentTableRow = {
  id: string;
  comparison_id: string;
  parent_id: string | null;
  root_id: string;
  user_id: string;
  body: string;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CommentInteractionRow = {
  comment_id: string;
  user_id: string;
  type: "like" | "dislike";
};

type CommentProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

async function hydrateComparisonComments(rows: ComparisonCommentTableRow[], currentUserId: string | null) {
  if (rows.length === 0) return [];

  const commentIds = rows.map((row) => row.id);
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const supabase = createSupabaseAdminClient();

  const [{ data: profilesData }, { data: interactionsData }, { data: repliesData }] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", userIds),
    supabase
      .from("vehicle_comparison_comment_interactions")
      .select("comment_id, user_id, type")
      .in("comment_id", commentIds),
    supabase
      .from("vehicle_comparison_comments")
      .select("parent_id")
      .in("parent_id", commentIds)
      .is("deleted_at", null),
  ]);

  const profiles = new Map(
    ((profilesData ?? []) as CommentProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const counts = new Map<string, { like: number; dislike: number; currentUserReaction: "like" | "dislike" | null }>();
  const replyCounts = new Map<string, number>();

  for (const interaction of (interactionsData ?? []) as CommentInteractionRow[]) {
    const entry = counts.get(interaction.comment_id) ?? { like: 0, dislike: 0, currentUserReaction: null };
    entry[interaction.type] += 1;

    if (currentUserId && interaction.user_id === currentUserId) {
      entry.currentUserReaction = interaction.type;
    }

    counts.set(interaction.comment_id, entry);
  }

  for (const reply of (repliesData ?? []) as Array<{ parent_id: string | null }>) {
    if (!reply.parent_id) continue;
    replyCounts.set(reply.parent_id, (replyCounts.get(reply.parent_id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    const interactionCount = counts.get(row.id);

    return normalizeComparisonComment({
      id: row.id,
      comparison_id: row.comparison_id,
      parent_id: row.parent_id,
      root_id: row.root_id,
      user_id: row.user_id,
      body: row.deleted_at ? "[silindi]" : row.body,
      depth: row.depth,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      author_username: profile?.username ?? "Kullanıcı",
      author_avatar_url: profile?.avatar_url ?? null,
      like_count: interactionCount?.like ?? 0,
      dislike_count: interactionCount?.dislike ?? 0,
      current_user_reaction: interactionCount?.currentUserReaction ?? null,
      reply_count: replyCounts.get(row.id) ?? 0,
      author_car_rating: null,
    });
  });
}
