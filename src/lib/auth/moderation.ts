import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEVICE_COOKIE = "ha_device_id";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type BanRow = {
  id: string;
  ban_type: "chat" | "access";
  expires_at: string | null;
  revoked_at: string | null;
};

type ForbiddenWordRow = {
  word: string;
  active: boolean;
};

export type ClientIdentity = {
  deviceId: string;
  isNewDevice: boolean;
  ipHash: string | null;
  deviceHash: string;
};

export class ChatBannedError extends Error {
  until: string | null;

  constructor(until: string | null) {
    super("CHAT_BANNED");
    this.until = until;
  }
}

export class AccessBannedError extends Error {
  constructor() {
    super("ACCESS_BANNED");
  }
}

export class ForbiddenWordError extends Error {
  word: string;

  constructor(word: string) {
    super("FORBIDDEN_WORD");
    this.word = word;
  }
}

export function getClientIdentity(request: NextRequest): ClientIdentity {
  const existingDeviceId = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existingDeviceId && isSafeDeviceId(existingDeviceId) ? existingDeviceId : randomUUID();
  const ip = getRequestIp(request);

  return {
    deviceId,
    isNewDevice: deviceId !== existingDeviceId,
    ipHash: ip ? hashIdentity(`ip:${ip}`) : null,
    deviceHash: hashIdentity(`device:${deviceId}`),
  };
}

export function appendDeviceCookie(response: Response, identity: ClientIdentity) {
  if (!identity.isNewDevice) return response;

  response.headers.append(
    "Set-Cookie",
    `${DEVICE_COOKIE}=${identity.deviceId}; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
  );

  return response;
}

export async function assertIdentityIsAllowed(identity: ClientIdentity) {
  const admin = createSupabaseAdminClient();
  const identityHashes = [identity.deviceHash, identity.ipHash].filter((item): item is string => Boolean(item));

  if (!identityHashes.length) return;

  const { data, error } = await admin
    .from("auth_identity_bans")
    .select("id, expires_at, revoked_at")
    .in("identity_hash", identityHashes)
    .is("revoked_at", null);

  if (error) return;

  const now = Date.now();
  const activeBan = (data ?? []).some((ban) => !ban.expires_at || new Date(ban.expires_at).getTime() > now);

  if (activeBan) throw new AccessBannedError();
}

export async function recordUserIdentity(userId: string, identity: ClientIdentity) {
  const admin = createSupabaseAdminClient();
  const rows = [
    { user_id: userId, identity_type: "device", identity_hash: identity.deviceHash },
    identity.ipHash ? { user_id: userId, identity_type: "ip", identity_hash: identity.ipHash } : null,
  ].filter((row): row is { user_id: string; identity_type: string; identity_hash: string } => Boolean(row));

  if (!rows.length) return;

  await admin
    .from("user_auth_identities")
    .upsert(
      rows.map((row) => ({ ...row, last_seen_at: new Date().toISOString() })),
      { onConflict: "user_id,identity_type,identity_hash" },
    );
}

export async function assertUserCanLogin(userId: string) {
  if (await hasActiveUserBan(userId, "access")) {
    throw new AccessBannedError();
  }
}

export async function assertCanPostComment(userId: string, content: string) {
  if (await hasActiveUserBan(userId, "access")) {
    throw new AccessBannedError();
  }

  const chatBan = await getActiveUserBan(userId, "chat");

  if (chatBan) {
    throw new ChatBannedError(chatBan.expires_at);
  }

  const forbiddenWord = await findForbiddenWord(content);

  if (forbiddenWord) {
    throw new ForbiddenWordError(forbiddenWord);
  }
}

export function moderationErrorResponse(error: unknown) {
  if (error instanceof AccessBannedError) {
    return Response.json({ error: "Bu cihaz veya hesap erişim banı nedeniyle işlem yapamaz." }, { status: 403 });
  }

  if (error instanceof ChatBannedError) {
    return Response.json(
      {
        error: error.until
          ? `Sohbet banın ${formatBanUntil(error.until)} tarihine kadar aktif.`
          : "Sohbet banın aktif.",
      },
      { status: 403 },
    );
  }

  if (error instanceof ForbiddenWordError) {
    return Response.json({ error: "Yorum yasaklı kelime içeriyor." }, { status: 400 });
  }

  return null;
}

async function hasActiveUserBan(userId: string, banType: "chat" | "access") {
  return Boolean(await getActiveUserBan(userId, banType));
}

async function getActiveUserBan(userId: string, banType: "chat" | "access") {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_bans")
    .select("id, ban_type, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("ban_type", banType)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return null;

  const now = Date.now();

  return ((data ?? []) as BanRow[]).find((ban) => !ban.expires_at || new Date(ban.expires_at).getTime() > now) ?? null;
}

async function findForbiddenWord(content: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("forbidden_words")
    .select("word, active")
    .eq("active", true);

  if (error) return null;

  for (const row of (data ?? []) as ForbiddenWordRow[]) {
    if (containsForbiddenWord(content, row.word)) {
      return row.word;
    }
  }

  return null;
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || null;
}

function hashIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isSafeDeviceId(value: string) {
  return /^[a-f0-9-]{16,64}$/i.test(value);
}

function foldModerationText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function containsForbiddenWord(content: string, forbiddenWord: string) {
  const foldedContent = foldModerationText(content);
  const foldedWord = foldModerationText(forbiddenWord).replace(/[^a-z0-9]+/g, "");
  if (!foldedWord) return false;

  const obfuscationTolerantWord = foldedWord
    .split("")
    .map(escapeRegex)
    .join("[^a-z0-9]*");
  const pattern = new RegExp(`(^|[^a-z0-9])${obfuscationTolerantWord}($|[^a-z0-9])`, "i");
  return pattern.test(foldedContent);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatBanUntil(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
