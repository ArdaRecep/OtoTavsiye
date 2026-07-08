import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  vehicle_id: string | null;
  comment_id: string | null;
  type: "reply" | "vehicle_comment";
  is_read: boolean;
  created_at: string;
  actor: {
    username: string;
    avatar_url: string | null;
  } | null;
  vehicle: {
    make: string;
    model: string;
  } | null;
};

/**
 * GET /api/notifications?userId=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "userId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    
    // Notifications joined with actor (users) and vehicle (vehicle_market_profiles)
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id, user_id, actor_id, vehicle_id, comment_id, type, is_read, created_at,
        actor:users!actor_id(username, avatar_url),
        vehicle:vehicle_market_profiles(make, model)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return Response.json(
        { error: "Bildirimler alınamadı.", details: error.message },
        { status: 500 },
      );
    }

    return Response.json({ notifications: data as unknown as NotificationRow[] });
  } catch (error) {
    return Response.json({ error: "Geçersiz istek.", details: String(error) }, { status: 400 });
  }
}

/**
 * PATCH /api/notifications
 * body: { userId: string, markAllAsRead?: boolean, notificationIds?: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, markAllAsRead, notificationIds } = body;

    if (!userId) {
      return Response.json({ error: "userId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    if (markAllAsRead) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
    } else if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .in("id", notificationIds);

      if (error) throw error;
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Bildirimler güncellenemedi.", details: String(error) }, { status: 500 });
  }
}
