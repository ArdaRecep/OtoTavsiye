"use client";

const USER_ID_KEY = "oto_tavsiye_user_id";
const USERNAME_KEY = "oto_tavsiye_username";
const AVATAR_KEY = "oto_tavsiye_avatar";

export type UserInfo = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

/** localStorage'dan mevcut user_id'yi döndürür, yoksa null */
export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

/** Kayıtlı kullanıcı adını döndürür */
export function getStoredUserName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USERNAME_KEY) ?? "";
}

/** Kayıtlı avatar URL'sini döndürür */
export function getStoredAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AVATAR_KEY);
}

/** Kullanıcı bilgilerini localStorage'a kaydeder */
export function storeUserInfo(user: UserInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_ID_KEY, user.id);
  localStorage.setItem(USERNAME_KEY, user.username);
  if (user.avatarUrl) {
    localStorage.setItem(AVATAR_KEY, user.avatarUrl);
  }
}

/** Kullanıcı adını günceller (hem localStorage hem API) */
export function updateStoredUserName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERNAME_KEY, name.trim());
}

/**
 * Mevcut kullanıcıyı döndürür.
 * Eğer localStorage'da user yoksa, API üzerinden yeni misafir kullanıcı oluşturur.
 */
export async function ensureUser(username?: string): Promise<UserInfo> {
  const storedId = getStoredUserId();
  const storedName = getStoredUserName();

  // Zaten kayıtlı kullanıcı varsa döndür
  if (storedId && storedName) {
    return {
      id: storedId,
      username: storedName,
      avatarUrl: getStoredAvatarUrl(),
    };
  }

  // Yoksa yeni kullanıcı oluştur
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username || `Misafir_${Math.random().toString(36).slice(2, 7)}`,
    }),
  });

  if (!response.ok) {
    throw new Error("Kullanıcı oluşturulamadı.");
  }

  const data = await response.json();
  const user: UserInfo = {
    id: data.user.id,
    username: data.user.username,
    avatarUrl: data.user.avatar_url ?? null,
  };

  storeUserInfo(user);
  return user;
}
