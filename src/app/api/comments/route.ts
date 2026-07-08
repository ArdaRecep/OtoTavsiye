import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type CommentRow = {
  id: string;
  vehicle_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
  likeCount: number;
  dislikeCount: number;
  userInteraction: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const vehicleId = searchParams.get("vehicleId");
    const currentUserId = searchParams.get("userId");

    if (!vehicleId) {
      return Response.json({ error: "vehicleId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vehicle_comments")
      .select("id, vehicle_id, parent_id, user_id, content, created_at, users:user_id(username, avatar_url), comment_interactions(user_id, type)")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: true });

    if (error) {
      return Response.json(
        { error: "Yorumlar alınamadı.", details: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const interactions = (row.comment_interactions as any[]) || [];
      const likeCount = interactions.filter(i => i.type === "like").length;
      const dislikeCount = interactions.filter(i => i.type === "dislike").length;
      const userInteraction = currentUserId 
        ? interactions.find(i => i.user_id === currentUserId)?.type || null 
        : null;

      return {
        id: row.id as string,
        vehicle_id: row.vehicle_id as string,
        parent_id: row.parent_id as string | null,
        user_id: row.user_id as string,
        content: row.content as string,
        created_at: row.created_at as string,
        user: row.users as { username: string; avatar_url: string | null },
        likeCount,
        dislikeCount,
        userInteraction,
      };
    }) as CommentRow[];

    // Build thread structure: root comments with their replies
    const rootComments = rows.filter((row) => !row.parent_id);
    const replyMap = new Map<string, CommentRow[]>();

    for (const row of rows) {
      if (row.parent_id) {
        const replies = replyMap.get(row.parent_id) ?? [];
        replies.push(row);
        replyMap.set(row.parent_id, replies);
      }
    }

    const threads = rootComments.map((root) => ({
      ...root,
      replies: replyMap.get(root.id) ?? [],
    }));

    return Response.json({ comments: threads, total: rows.length });
  } catch {
    return Response.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicleId, userId, content, parentId } = body as {
      vehicleId?: string;
      userId?: string;
      content?: string;
      parentId?: string | null;
    };

    if (!vehicleId || !userId || !content?.trim()) {
      return Response.json(
        { error: "vehicleId, userId ve content gerekli." },
        { status: 400 },
      );
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 1000) {
      return Response.json(
        { error: "Yorum en fazla 1000 karakter olabilir." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServerClient();

    // Kullanıcının var olduğunu kontrol et
    const { data: userExists } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!userExists) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    // If parentId is provided, verify it exists and belongs to the same vehicle
    if (parentId) {
      const { data: parentComment } = await supabase
        .from("vehicle_comments")
        .select("id, vehicle_id")
        .eq("id", parentId)
        .maybeSingle();

      if (!parentComment || parentComment.vehicle_id !== vehicleId) {
        return Response.json(
          { error: "Yanıt verilecek yorum bulunamadı." },
          { status: 404 },
        );
      }
    }

    const { data, error } = await supabase
      .from("vehicle_comments")
      .insert({
        vehicle_id: vehicleId,
        parent_id: parentId ?? null,
        user_id: userId,
        content: trimmedContent,
      })
      .select("id, vehicle_id, parent_id, user_id, content, created_at, users:user_id(username, avatar_url)")
      .single();

    if (error) {
      return Response.json(
        { error: "Yorum eklenemedi.", details: error.message },
        { status: 500 },
      );
    }

    return Response.json({ comment: data }, { status: 201 });
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}
