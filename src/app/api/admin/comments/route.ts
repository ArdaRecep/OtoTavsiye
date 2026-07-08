import { getAdminState } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type CommentAdminRow = {
  id: string;
  vehicle_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  users?: {
    username: string;
    email: string | null;
  } | {
    username: string;
    email: string | null;
  }[] | null;
};

type VehicleRow = {
  id: string;
  make: string;
  model: string;
};

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const adminState = await getAdminState(userId);

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vehicle_comments")
      .select("id, vehicle_id, parent_id, user_id, content, created_at, users:user_id(username, email)")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      return Response.json({ error: "Yorumlar alınamadı.", details: error.message }, { status: 500 });
    }

    const comments = (data ?? []) as unknown as CommentAdminRow[];
    const vehicleIds = Array.from(new Set(comments.map((comment) => comment.vehicle_id)));
    const { data: vehicles } = vehicleIds.length
      ? await supabase.from("vehicle_market_profiles").select("id, make, model").in("id", vehicleIds)
      : { data: [] };
    const vehicleRows = (vehicles ?? []) as VehicleRow[];
    const vehiclesById = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));

    return Response.json({
      comments: comments.map((comment) => ({
        ...comment,
        users: Array.isArray(comment.users) ? (comment.users[0] ?? null) : (comment.users ?? null),
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
    const { userId, commentId } = body as {
      userId?: string;
      commentId?: string;
    };
    const adminState = await getAdminState(userId);

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    if (!commentId) {
      return Response.json({ error: "commentId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    await supabase.from("vehicle_comments").delete().eq("parent_id", commentId);
    const { error } = await supabase.from("vehicle_comments").delete().eq("id", commentId);

    if (error) {
      return Response.json({ error: "Yorum silinemedi.", details: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Yorum silinemedi." }, { status: 400 });
  }
}
