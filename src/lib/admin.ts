import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AdminUser = {
  id: string;
  email: string | null;
  username: string | null;
};

export async function getAdminState(userId: string | null | undefined) {
  if (!userId) {
    return { isAdmin: false, user: null as AdminUser | null };
  }

  const supabase = createSupabaseServerClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, username")
    .eq("id", userId)
    .maybeSingle<AdminUser>();

  if (error || !user) {
    return { isAdmin: false, user: null as AdminUser | null };
  }

  const isEnvAdmin =
    csvIncludes(process.env.ADMIN_USER_IDS, user.id) ||
    csvIncludes(process.env.ADMIN_EMAILS, user.email ?? "");

  if (isEnvAdmin) {
    return { isAdmin: true, user };
  }

  const { data: adminFlag } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle<{ is_admin: boolean }>();

  return {
    isAdmin: Boolean(adminFlag?.is_admin),
    user,
  };
}

function csvIncludes(value: string | undefined, item: string) {
  if (!value || !item) return false;

  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(item.toLowerCase());
}
