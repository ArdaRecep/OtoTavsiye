"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CarFront, Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";
import { storeUserInfo } from "@/lib/user-identity";

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Giriş başarısız.");
        return;
      }

      storeUserInfo({
        id: data.user.id,
        username: data.user.username,
        avatarUrl: data.user.avatar_url ?? null,
      });

      router.push("/");
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#014636] shadow-lg">
            <CarFront className="h-9 w-9 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#0a1110]">Tekrar hoş geldiniz</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Hesabınıza giriş yaparak devam edin
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border-2 border-[#014636] bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* E-posta */}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                E-posta
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  required
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                Şifre
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-12 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-neutral-600"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Hata */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#014636] font-semibold text-white shadow-sm transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              Giriş Yap
            </button>
          </form>

          {/* Alt link */}
          <div className="mt-6 text-center text-sm text-neutral-500">
            Hesabınız yok mu?{" "}
            <Link
              href="/kayit"
              className="font-semibold text-[#014636] transition hover:text-[#003a2d]"
            >
              Kayıt Ol
            </Link>
          </div>
        </div>

        {/* Misafir giriş */}
        <div className="mt-5 text-center">
          <Link
            href="/"
            className="text-sm text-neutral-400 transition hover:text-neutral-600"
          >
            Misafir olarak devam et →
          </Link>
        </div>
      </div>
    </main>
  );
}
