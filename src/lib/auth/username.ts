import { createHash } from "node:crypto";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.ğüşöçıİĞÜŞÖÇ]{3,24}$/u;
const SYNTHETIC_EMAIL_DOMAIN = "users.hangiarac.app";

export function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateUsername(username: string) {
  if (!username) return "Kullanıcı adı gerekli.";
  if (username.length < 3) return "Kullanıcı adı en az 3 karakter olmalı.";
  if (username.length > 24) return "Kullanıcı adı en fazla 24 karakter olabilir.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Kullanıcı adı harf, rakam, nokta veya alt çizgi içerebilir.";
  }

  return null;
}

export function createSyntheticEmail(username: string) {
  const slug = username
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32) || "user";
  const hash = createHash("sha256").update(username.toLocaleLowerCase("tr-TR")).digest("hex").slice(0, 12);

  return `${slug}.${hash}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string | null | undefined) {
  return Boolean(email?.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`));
}
