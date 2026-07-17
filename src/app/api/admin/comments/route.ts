import { getAdminState } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CommentAdminRow = {
  id: string;
  vehicle_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  users?: {
    username: string;
  } | {
    username: string;
  }[] | null;
};

type VehicleRow = {
  id: string;
  make: string;
  model: string;
};

export async function GET() {
  try {
    const adminState = await getAdminState();

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    // Admin yetkisi yukarida cookie tabanli oturumdan dogrulandi. Yonetim
    // sorgulari RLS nedeniyle bos donmesin diye bundan sonra servis rolu kullanilir.
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vehicle_comments")
      .select("id, vehicle_id, parent_id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
    }

    const comments = (data ?? []) as unknown as CommentAdminRow[];
    const vehicleIds = Array.from(new Set(comments.map((comment) => comment.vehicle_id)));
    const userIds = Array.from(new Set(comments.map((comment) => comment.user_id)));
    const [{ data: vehicles }, { data: users }] = await Promise.all([
      vehicleIds.length
        ? supabase.from("vehicle_market_profiles").select("id, make, model").in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase.from("users").select("id, username").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);
    const vehicleRows = (vehicles ?? []) as VehicleRow[];
    const vehiclesById = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));
    const usersById = new Map(
      ((users ?? []) as Array<{ id: string; username: string }>).map((user) => [user.id, user]),
    );

    return Response.json({
      comments: comments.map((comment) => ({
        ...comment,
        users: usersById.get(comment.user_id) ?? null,
        vehicle: vehiclesById.get(comment.vehicle_id) ?? null,
      })),
    });
  } catch {
    return Response.json({ error: "Yorumlar alınamadı." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { commentId } = body as {
      commentId?: string;
    };
    const adminState = await getAdminState();

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    if (!commentId) {
      return Response.json({ error: "commentId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: comment, error: commentError } = await supabase
      .from("vehicle_comments")
      .select("id, parent_id, content")
      .eq("id", commentId)
      .maybeSingle<{ id: string; parent_id: string | null; content: string }>();

    if (commentError) {
      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    if (!comment) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    const { count: replyCount, error: replyError } = await supabase
      .from("vehicle_comments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", commentId);

    if (replyError) {
      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    if ((replyCount ?? 0) > 0) {
      const [{ error: interactionError }, { error: updateError }] = await Promise.all([
        supabase.from("comment_interactions").delete().eq("comment_id", commentId),
        supabase.from("vehicle_comments").update({ content: "[silindi]" }).eq("id", commentId),
      ]);

      if (interactionError || updateError) {
        return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
      }

      return Response.json({ ok: true, mode: "soft" });
    }

    const { error } = await supabase.from("vehicle_comments").delete().eq("id", commentId);

    if (error) {
      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    await pruneEmptyDeletedVehicleAncestors(supabase, comment.parent_id);

    return Response.json({ ok: true, mode: "hard" });
  } catch {
    return Response.json({ error: "Yorum silinemedi." }, { status: 400 });
  }
}

async function pruneEmptyDeletedVehicleAncestors(supabase: SupabaseAdminClient, parentId: string | null) {
  let nextParentId = parentId;

  while (nextParentId) {
    const { data: parent } = await supabase
      .from("vehicle_comments")
      .select("id, parent_id, content")
      .eq("id", nextParentId)
      .maybeSingle<{ id: string; parent_id: string | null; content: string }>();

    if (!parent || parent.content.trim() !== "[silindi]") return;

    const { count } = await supabase
      .from("vehicle_comments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", parent.id);

    if ((count ?? 0) > 0) return;

    await supabase.from("vehicle_comments").delete().eq("id", parent.id);
    nextParentId = parent.parent_id;
  }
}
