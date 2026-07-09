"use client";

import { useCurrentUser } from "@/lib/auth/client-user";

export function useAdminStatus() {
  const { user, userId, isAdmin, isLoading } = useCurrentUser();

  return {
    userId,
    user,
    isAdmin,
    isLoading,
  };
}
