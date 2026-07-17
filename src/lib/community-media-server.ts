import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const COMMUNITY_IMAGE_BUCKET = "community-images";

export function getCommunityImageUrls(paths: string[] | null | undefined) {
  if (!paths?.length) return [];
  const admin = createSupabaseAdminClient();

  return paths.map((path) => admin.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
}
