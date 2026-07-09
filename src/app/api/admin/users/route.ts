import { getAdminState } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
};

type BanPayload = {
  userId?: string;
  banType?: "chat" | "access";
  days?: number;
  reason?: string;
};

export async function GET() {
  try {
    const adminState = await getAdminState();

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const [{ data: usersData, error: usersError }, { data: bansData }] = await Promise.all([
      admin
        .from("users")
        .select("id, username, is_admin, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("user_bans")
        .select("id, user_id, ban_type, expires_at, revoked_at")
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
          chatBannedUntil: chatBan?.expires_at ?? null,
          accessBanned: Boolean(accessBan),
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

    if (!userId || !["chat", "access"].includes(String(banType))) {
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
    const expiresAt = banType === "chat" ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

    const { error: insertError } = await admin.from("user_bans").insert({
      user_id: userId,
      ban_type: banType,
      reason,
      expires_at: expiresAt,
      created_by: adminState.user.id,
    });

    if (insertError) {
      return Response.json({ error: "Ban uygulanamadı." }, { status: 500 });
    }

    if (banType === "access") {
      await banKnownIdentities(admin, userId, adminState.user.id, reason);
    }

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

    if (!userId || !["chat", "access"].includes(String(banType))) {
      return Response.json({ error: "userId ve banType gerekli." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    await admin
      .from("user_bans")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("ban_type", banType)
      .is("revoked_at", null);

    if (banType === "access") {
      await admin
        .from("auth_identity_bans")
        .update({ revoked_at: new Date().toISOString() })
        .eq("source_user_id", userId)
        .is("revoked_at", null);
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Ban kaldırılamadı." }, { status: 400 });
  }
}

async function banKnownIdentities(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  adminUserId: string,
  reason: string | null,
) {
  const { data } = await admin
    .from("user_auth_identities")
    .select("identity_type, identity_hash")
    .eq("user_id", userId);

  const rows = (data ?? []).map((identity) => ({
    identity_type: identity.identity_type,
    identity_hash: identity.identity_hash,
    source_user_id: userId,
    reason,
    created_by: adminUserId,
  }));

  if (!rows.length) return;

  await admin.from("auth_identity_bans").insert(rows);
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
