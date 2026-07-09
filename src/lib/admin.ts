import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { AppUserProfile } from "@/lib/auth/types";

export type AdminUser = Pick<AppUserProfile, "id" | "email" | "username">;

export async function getAdminState() {
  const currentUser = await getCurrentUser();

  if (!currentUser?.profile?.is_admin) {
    return { isAdmin: false, user: null as AdminUser | null };
  }

  return {
    isAdmin: true,
    user: {
      id: currentUser.profile.id,
      email: currentUser.profile.email,
      username: currentUser.profile.username,
    },
  };
}
