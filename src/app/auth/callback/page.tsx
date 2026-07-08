"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { storeUserInfo } from "@/lib/user-identity";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeOAuth() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");

      if (!accessToken) {
        setError("Google oturumu alınamadı. Lütfen tekrar deneyin.");
        return;
      }

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "oauth",
          accessToken,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Google ile giriş tamamlanamadı.");
        return;
      }

      storeUserInfo({
        id: data.user.id,
        username: data.user.username,
        avatarUrl: data.user.avatar_url ?? null,
        email: data.user.email ?? null,
      });

      router.replace("/");
    }

    void completeOAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-neutral-950">Giriş tamamlanamadı</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{error}</p>
            <Link
              href="/giris"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
            >
              Girişe dön
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#014636]" />
            <h1 className="mt-4 text-lg font-semibold text-neutral-950">Google oturumu tamamlanıyor</h1>
            <p className="mt-2 text-sm text-neutral-600">Birazdan ana sayfaya yönlendirileceksin.</p>
          </>
        )}
      </div>
    </main>
  );
}
