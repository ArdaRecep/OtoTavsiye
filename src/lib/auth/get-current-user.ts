import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "./types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, username, avatar_url, is_admin, created_at, updated_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  return {
    id: authData.user.id,
    email: authData.user.email ?? null,
    profile: profile ?? null,
  };
}
