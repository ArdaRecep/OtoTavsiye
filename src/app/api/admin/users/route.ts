import { getAdminState } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

type UserRow = {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
};

type BanRow = {
  id: string;
  user_id: string;
  ban_type: "chat" | "access";
  expires_at: string | null;
  revoked_at: string | null;
  reason: string | null;
  created_at: string;
};

type BanPayload = {
  userId?: string;
  banType?: "chat" | "access";
  days?: number;
  duration?: "temporary" | "permanent";
  reason?: string;
};

export async function GET(request: NextRequest) {
  try {
    const adminState = await getAdminState();

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const requestedUserId = request.nextUrl.searchParams.get("userId")?.trim();
    let usersQuery = admin
      .from("users")
      .select("id, username, is_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (requestedUserId) usersQuery = usersQuery.eq("id", requestedUserId);

    const [{ data: usersData, error: usersError }, { data: bansData }] = await Promise.all([
      usersQuery,
      admin
        .from("user_bans")
        .select("id, user_id, ban_type, expires_at, revoked_at, reason, created_at")
        .is("revoked_at", null),
    ]);

    if (usersError) {
      return Response.json({ error: "Kullanıcılar alınamadı." }, { status: 500 });
    }

    const bansByUser = new Map<string, BanRow[]>();
    for (const ban of (bansData ?? []) as BanRow[]) {
      if (!isActiveBan(ban)) continue;
      bansByUser.set(ban.user_id, [...(bansByUser.get(ban.user_id) ?? []), ban]);
    }

    return Response.json({
      users: ((usersData ?? []) as UserRow[]).map((user) => {
        const bans = bansByUser.get(user.id) ?? [];
        const chatBan = bans.find((ban) => ban.ban_type === "chat");
        const accessBan = bans.find((ban) => ban.ban_type === "access");

        return {
          id: user.id,
          username: user.username,
          isAdmin: Boolean(user.is_admin),
          createdAt: user.created_at,
          chatBanned: Boolean(chatBan),
          chatBannedUntil: chatBan?.expires_at ?? null,
          accessBanned: Boolean(accessBan),
          accessBannedUntil: accessBan?.expires_at ?? null,
          bans: {
            chat: chatBan ? serializeBan(chatBan) : null,
            access: accessBan ? serializeBan(accessBan) : null,
          },
        };
      }),
    });
  } catch {
    return Response.json({ error: "Kullanıcılar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminState = await getAdminState();

    if (!adminState.isAdmin || !adminState.user) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const body = (await request.json()) as BanPayload;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const banType = body.banType;
    const duration = body.duration === "permanent" ? "permanent" : "temporary";

    if (!userId || (banType !== "chat" && banType !== "access")) {
      return Response.json({ error: "userId ve banType gerekli." }, { status: 400 });
    }

    if (userId === adminState.user.id) {
      return Response.json({ error: "Kendi hesabını banlayamazsın." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: targetUser } = await admin
      .from("users")
      .select("id, username, is_admin")
      .eq("id", userId)
      .maybeSingle<{ id: string; username: string; is_admin: boolean }>();

    if (!targetUser) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (targetUser.is_admin) {
      return Response.json({ error: "Admin kullanıcı banlanamaz." }, { status: 400 });
    }

    const days = clampDays(body.days);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

    const { error: banError } = await admin.rpc("admin_apply_user_ban", {
      p_admin_user_id: adminState.user.id,
      p_user_id: userId,
      p_ban_type: banType,
      p_duration_days: duration === "temporary" ? days : null,
      p_reason: reason,
    });
    if (banError) return Response.json({ error: adminBanError(banError.message) }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Ban uygulanamadı." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminState = await getAdminState();

    if (!adminState.isAdmin || !adminState.user) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const body = (await request.json()) as BanPayload;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const banType = body.banType;

    if (!userId || (banType !== "chat" && banType !== "access")) {
      return Response.json({ error: "userId ve banType gerekli." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error: revokeError } = await admin.rpc("admin_revoke_user_ban", {
      p_admin_user_id: adminState.user.id,
      p_user_id: userId,
      p_ban_type: banType,
    });
    if (revokeError) return Response.json({ error: "Ban kaldırılamadı." }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Ban kaldırılamadı." }, { status: 400 });
  }
}

function serializeBan(ban: BanRow) {
  return {
    id: ban.id,
    type: ban.ban_type,
    expiresAt: ban.expires_at,
    permanent: !ban.expires_at,
    reason: ban.reason,
    createdAt: ban.created_at,
  };
}

function clampDays(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) return 1;

  return Math.min(365, Math.max(1, Math.floor(parsed)));
}

function isActiveBan(ban: BanRow) {
  if (ban.revoked_at) return false;
  if (!ban.expires_at) return true;

  return new Date(ban.expires_at).getTime() > Date.now();
}

function adminBanError(message: string) {
  if (message.includes("CANNOT_BAN_SELF")) return "Kendi hesabını banlayamazsın.";
  if (message.includes("CANNOT_BAN_ADMIN")) return "Admin kullanıcı banlanamaz.";
  if (message.includes("USER_NOT_FOUND")) return "Kullanıcı bulunamadı.";
  return "Ban uygulanamadı. Moderasyon migration'ını kontrol et.";
}
