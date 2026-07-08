"use client";

const USER_ID_KEY = "oto_tavsiye_user_id";
const USERNAME_KEY = "oto_tavsiye_username";
const AVATAR_KEY = "oto_tavsiye_avatar";
const EMAIL_KEY = "oto_tavsiye_email";

export type UserInfo = {
  id: string;
  username: string;
  avatarUrl: string | null;
  email?: string | null;
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

export function getStoredUser(): UserInfo | null {
  const id = getStoredUserId();
  const username = getStoredUserName();

  if (!id || !username) return null;

  return {
    id,
    username,
    avatarUrl: getStoredAvatarUrl(),
    email: typeof window === "undefined" ? null : localStorage.getItem(EMAIL_KEY),
  };
}

/** Auth durumu değiştiğinde diğer bileşenleri bilgilendiren custom event adı */
export const AUTH_CHANGE_EVENT = "oto-tavsiye-auth-change";

/** Kullanıcı bilgilerini localStorage'a kaydeder */
export function storeUserInfo(user: UserInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_ID_KEY, user.id);
  localStorage.setItem(USERNAME_KEY, user.username);
  if (user.avatarUrl) {
    localStorage.setItem(AVATAR_KEY, user.avatarUrl);
  } else {
    localStorage.removeItem(AVATAR_KEY);
  }
  if (user.email) {
    localStorage.setItem(EMAIL_KEY, user.email);
  } else {
    localStorage.removeItem(EMAIL_KEY);
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearStoredUserInfo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(AVATAR_KEY);
  localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/** Kullanıcı adını günceller (hem localStorage hem API) */
export function updateStoredUserName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERNAME_KEY, name.trim());
}

/**
 * Mevcut giriş yapmış kullanıcıyı döndürür.
 * Kullanıcı yoksa yeni hesap oluşturmaz.
 */
export async function ensureUser(): Promise<UserInfo> {
  const storedUser = getStoredUser();

  if (storedUser) {
    return storedUser;
  }

  throw new Error("Devam etmek için giriş yapmalısınız.");
}
