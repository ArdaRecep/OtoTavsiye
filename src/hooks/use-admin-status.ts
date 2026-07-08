"use client";

import { useEffect, useState } from "react";
import { getStoredUserId } from "@/lib/user-identity";

export function useAdminStatus() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      async function checkAdmin() {
        const storedUserId = getStoredUserId();
        setUserId(storedUserId);

        if (!storedUserId) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch(`/api/admin/status?userId=${encodeURIComponent(storedUserId)}`);
          const data = await response.json();
          setIsAdmin(Boolean(data.isAdmin));
        } catch {
          setIsAdmin(false);
        } finally {
          setIsLoading(false);
        }
      }

      void checkAdmin();
    });
  }, []);

  return { userId, isAdmin, isLoading };
}
