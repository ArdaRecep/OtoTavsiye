"use client";

import useSWR from "swr";

export type ClientUser = {
  id: string;
  email: string | null;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

async function fetchCurrentUser() {
  const response = await fetch("/api/auth", { credentials: "include" });

  if (!response.ok) return { user: null as ClientUser | null };

  return (await response.json()) as { user: ClientUser | null };
}

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR("/api/auth", fetchCurrentUser);

  return {
    user: data?.user ?? null,
    userId: data?.user?.id ?? null,
    isAdmin: Boolean(data?.user?.isAdmin),
    isLoading,
    error,
    mutate,
  };
}
