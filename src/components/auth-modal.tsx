"use client";

import { FormEvent, useState } from "react";
import { Loader2, Lock, LogIn, UserPlus, X } from "lucide-react";
import { storeUserInfo, type UserInfo } from "@/lib/user-identity";

type AuthMode = "login" | "register";

export function AuthModal({
  isOpen,
  title = "Devam etmek için hızlıca giriş yap",
  description = "Yorumun kaybolmayacak. Giriş yaptıktan sonra kaldığın yerden devam edeceğiz.",
  onClose,
  onAuthenticated,
}: {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onAuthenticated: (user: UserInfo) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim() || (mode === "register" && !username.trim())) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: email.trim(),
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "İşlem tamamlanamadı.");
      }

      const user: UserInfo = {
        id: data.user.id,
        username: data.user.username,
        avatarUrl: data.user.avatar_url ?? null,
        email: data.user.email ?? null,
      };

      storeUserInfo(user);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-neutral-300 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#014636] text-white">
              {mode === "register" ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-neutral-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-md bg-neutral-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`h-9 rounded px-3 transition ${
              mode === "register" ? "bg-white text-[#014636] shadow-sm" : "text-neutral-500"
            }`}
          >
            Kayıt ol
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`h-9 rounded px-3 transition ${
              mode === "login" ? "bg-white text-[#014636] shadow-sm" : "text-neutral-500"
            }`}
          >
            Giriş yap
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "register" ? (
            <Input
              label="Kullanıcı adı"
              value={username}
              onChange={setUsername}
              placeholder="Arda"
              autoComplete="username"
            />
          ) : null}
          <Input
            label="E-posta"
            value={email}
            onChange={setEmail}
            placeholder="ornek@email.com"
            type="email"
            autoComplete="email"
          />
          <Input
            label="Şifre"
            value={password}
            onChange={setPassword}
            placeholder="En az 6 karakter"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password.trim() || (mode === "register" && !username.trim())}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {mode === "register" ? "Hızlı kayıt ol ve gönder" : "Giriş yap ve gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        className="mt-1 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
