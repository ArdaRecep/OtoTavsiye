export const MAX_COMMUNITY_IMAGES = 3;
export const MAX_COMMUNITY_IMAGE_SIZE = 2 * 1024 * 1024;
export const COMMUNITY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CommunityImageAttachment = {
  path: string;
  url: string;
};

export function normalizeCommunityImagePaths(value: unknown, userId?: string) {
  if (!Array.isArray(value)) return [];

  const paths = Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
  if (paths.length > MAX_COMMUNITY_IMAGES) throw new Error(`En fazla ${MAX_COMMUNITY_IMAGES} görsel ekleyebilirsin.`);

  for (const path of paths) {
    if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(path)) {
      throw new Error("Geçersiz topluluk görseli.");
    }
    if (userId && !path.startsWith(`${userId}/`)) {
      throw new Error("Bu görsel kullanıcıya ait değil.");
    }
  }

  return paths;
}
