"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CarFront, Check, Eye, EyeOff, Loader2, Lock, Mail, Shield, Star, User, UserPlus } from "lucide-react";

export default function KayitPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!username.trim() || !email.trim() || !password.trim()) return;

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          username: username.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Kayıt başarısız.");
        return;
      }

      if (data.requiresEmailConfirmation) {
        setError("Kayıt oluşturuldu. Devam etmek için e-posta adresini doğrulamalısın.");
        return;
      }

      router.refresh();
      router.push("/");
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  }

  const passwordsMatch = password === passwordConfirm;
  const passwordLongEnough = password.length >= 6;

  return (
    <main className="flex min-h-screen bg-[#f4f6f3]">
      {/* Sol Panel — Marka */}
      <div className="relative hidden w-[42%] min-w-[380px] overflow-hidden bg-[#00140f] lg:flex lg:flex-col lg:justify-between">
        {/* Orman yolu arka planı */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/forest-road.png)" }}
        />
        {/* Okunabilirlik için koyu degrade */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00140f]/85 via-[#00140f]/40 to-[#00140f]/85" />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-10 xl:px-14">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <CarFront className="h-8 w-8 text-white" />
          </div>

          <h2 className="mt-8 text-3xl font-bold leading-tight text-white xl:text-4xl">
            Araç dünyasına<br />adım atın
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-100/80">
            Hesabınız ile araçları beğenin, favorileyin, yorumlarınızı paylaşın ve size özel önerilere ulaşın.
          </p>

          <div className="mt-10 space-y-4">
            <FeatureBadge icon={<Star className="h-4 w-4" />} text="Araçları beğen ve favorile" />
            <FeatureBadge icon={<Check className="h-4 w-4" />} text="Kişiselleştirilmiş öneriler al" />
            <FeatureBadge icon={<Shield className="h-4 w-4" />} text="Güvenli ve hızlı kayıt" />
          </div>
        </div>

        <div className="relative z-10 px-10 pb-8 xl:px-14">
          <p className="text-xs text-emerald-200/40">© 2025 Araç Karar Motoru</p>
        </div>
      </div>

      {/* Sağ Panel — Form */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
        {/* Dekoratif zemin */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#eef4f0] via-[#e9f1ec] to-[#d9e6df]" />
        <div className="pointer-events-none absolute -right-24 -top-16 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-[#014636]/10 blur-3xl" />

        <div className="relative z-10 w-full max-w-[440px]">
          {/* Mobil logo */}
          <div className="mb-7 flex flex-col items-center lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#014636]">
              <CarFront className="h-8 w-8 text-white" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-[#0a1110]">Hesap oluşturun</h1>
          </div>

          {/* Desktop başlık */}
          <div className="mb-8 hidden lg:block">
            <h1 className="text-2xl font-bold text-[#0a1110]">Hesap oluşturun</h1>
            <p className="mt-1.5 text-sm text-neutral-500">Hızlıca kayıt olun ve araç dünyasını keşfedin</p>
          </div>

          {/* Form Card */}
          <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_-20px_rgba(1,70,54,0.35)] backdrop-blur-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Kullanıcı Adı */}
              <div>
                <label htmlFor="register-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Kullanıcı Adı
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="register-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Adınız veya takma adınız"
                    required
                    maxLength={50}
                    autoComplete="username"
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {/* E-posta */}
              <div>
                <label htmlFor="register-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    required
                    autoComplete="email"
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {/* Şifre */}
              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-11 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:bg-white focus:ring-2 focus:ring-emerald-100"
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
                {password.length > 0 && (
                  <p className={`mt-1 text-xs ${passwordLongEnough ? "text-emerald-600" : "text-amber-600"}`}>
                    {passwordLongEnough ? "✓ Yeterli uzunluk" : `${6 - password.length} karakter daha`}
                  </p>
                )}
              </div>

              {/* Şifre Tekrar */}
              <div>
                <label htmlFor="register-password-confirm" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Şifre Tekrar
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="register-password-confirm"
                    type={showPassword ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Şifrenizi tekrar girin"
                    required
                    autoComplete="new-password"
                    className={`h-11 w-full rounded-lg border bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-2 ${
                      passwordConfirm.length > 0 && !passwordsMatch
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-neutral-200 focus:border-[#014636] focus:ring-emerald-100"
                    }`}
                  />
                </div>
                {passwordConfirm.length > 0 && (
                  <p className={`mt-1 text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                    {passwordsMatch ? "✓ Şifreler eşleşiyor" : "✗ Şifreler eşleşmiyor"}
                  </p>
                )}
              </div>

              {/* Hata */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Kayıt Butonu */}
              <button
                type="submit"
                disabled={isLoading || !username.trim() || !email.trim() || !passwordLongEnough || !passwordsMatch}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#014636] text-sm font-semibold text-white shadow-md shadow-emerald-900/10 transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Kayıt Ol
              </button>
            </form>

            {/* Misafir giriş */}
            <Link
              href="/"
              className="mt-5 flex h-11 w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Misafir olarak devam et
            </Link>
          </div>

          {/* Alt link */}
          <p className="mt-5 text-center text-sm text-neutral-500">
            Zaten hesabınız var mı?{" "}
            <Link href="/giris" className="font-semibold text-[#014636] hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function FeatureBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
        {icon}
      </div>
      <span className="text-sm font-medium text-emerald-50/90">{text}</span>
    </div>
  );
}
