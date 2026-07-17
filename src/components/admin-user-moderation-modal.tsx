"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ban, Clock3, Loader2, MessageCircleOff, ShieldAlert, ShieldCheck, X } from "lucide-react";

export type AdminModerationTarget = {
  id: string;
  username: string;
  isAdmin?: boolean;
};

type BanInfo = {
  id: string;
  type: "chat" | "access";
  expiresAt: string | null;
  permanent: boolean;
  reason: string | null;
  createdAt: string;
};

type UserState = AdminModerationTarget & {
  chatBanned: boolean;
  accessBanned: boolean;
  bans: { chat: BanInfo | null; access: BanInfo | null };
};

const durationPresets = [1, 3, 7, 30];

export function AdminUserModerationModal({
  target,
  onClose,
  onUpdated,
}: {
  target: AdminModerationTarget | null;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
}) {
  const [userState, setUserState] = useState<UserState | null>(null);
  const [banType, setBanType] = useState<"chat" | "access">("chat");
  const [duration, setDuration] = useState<"temporary" | "permanent">("temporary");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!target) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(target.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Kullanıcı bilgisi alınamadı.");
      setUserState(data.users?.[0] ?? { ...target, chatBanned: false, accessBanned: false, bans: { chat: null, access: null } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Kullanıcı bilgisi alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      setError(null);
      setNotice(null);
      setReason("");
      void fetchState();
    });
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fetchState, target]);

  if (!target) return null;

  async function applyBan() {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target?.id, banType, duration, days, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ban uygulanamadı.");
      setNotice(banType === "chat" ? "Sohbet banı uygulandı." : "Erişim banı uygulandı.");
      await fetchState();
      await onUpdated?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ban uygulanamadı.");
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeBan(type: "chat" | "access") {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target?.id, banType: type }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Ban kaldırılamadı.");
      setNotice("Ban kaldırıldı.");
      await fetchState();
      await onUpdated?.();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Ban kaldırılamadı.");
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${target.username} moderasyon işlemleri`}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></span>
            <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-neutral-950">{target.username}</h2><p className="mt-0.5 text-xs text-neutral-500">Kullanıcı moderasyonu</p></div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Moderasyon penceresini kapat"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-5 p-5">
          {isLoading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#014636]" /></div> : (
            <>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">Aktif kısıtlamalar</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <ActiveBanCard type="chat" ban={userState?.bans.chat ?? null} disabled={isSaving} onRevoke={() => void revokeBan("chat")} />
                  <ActiveBanCard type="access" ban={userState?.bans.access ?? null} disabled={isSaving} onRevoke={() => void revokeBan("access")} />
                </div>
              </section>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Yeni kısıtlama</h3>
                <div className="mt-3 grid grid-cols-2 rounded-md bg-white p-1 shadow-sm ring-1 ring-neutral-200">
                  <ModeButton active={banType === "chat"} onClick={() => setBanType("chat")} icon={<MessageCircleOff className="h-4 w-4" />} label="Sohbet banı" />
                  <ModeButton active={banType === "access"} onClick={() => setBanType("access")} icon={<Ban className="h-4 w-4" />} label="Erişim banı" />
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500">{banType === "chat" ? "Yorum, yanıt ve topluluk konusu oluşturamaz; araç arama ve favoriler açık kalır." : "Hesabın işlem yapması ve bilinen cihaz/IP kimlikleriyle yeniden giriş engellenir."}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDuration("temporary")} className={`h-10 rounded-md border text-sm font-semibold ${duration === "temporary" ? "border-[#014636] bg-emerald-50 text-[#014636]" : "border-neutral-300 bg-white text-neutral-600"}`}>Süreli</button>
                  <button type="button" onClick={() => setDuration("permanent")} className={`h-10 rounded-md border text-sm font-semibold ${duration === "permanent" ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-600"}`}>Süresiz</button>
                </div>

                {duration === "temporary" ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">{durationPresets.map((preset) => <button key={preset} type="button" onClick={() => setDays(preset)} className={`h-8 rounded-md px-3 text-xs font-semibold ${days === preset ? "bg-[#014636] text-white" : "border border-neutral-300 bg-white text-neutral-600"}`}>{preset} gün</button>)}</div>
                    <label className="mt-3 block text-xs font-semibold text-neutral-600">Özel süre<input type="number" min={1} max={365} value={days} onChange={(event) => setDays(Math.min(365, Math.max(1, Number(event.target.value) || 1)))} className="editor-input mt-1.5" /></label>
                  </div>
                ) : <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">Bu kısıtlama bir admin kaldırana kadar devam eder.</div>}

                <label className="mt-4 block text-xs font-semibold text-neutral-600">Sebep <span className="font-normal text-neutral-400">(opsiyonel)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="İhlali veya admin notunu yaz..." className="editor-input mt-1.5 resize-y" /></label>
              </section>
            </>
          )}

          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {notice ? <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#014636]">{notice}</div> : null}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-600">Kapat</button>
          <button type="button" onClick={() => void applyBan()} disabled={isLoading || isSaving || Boolean(userState?.isAdmin)} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${banType === "access" ? "bg-red-600 hover:bg-red-700" : "bg-[#014636] hover:bg-[#003a2d]"}`}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Kısıtlamayı uygula</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ActiveBanCard({ type, ban, disabled, onRevoke }: { type: "chat" | "access"; ban: BanInfo | null; disabled: boolean; onRevoke: () => void }) {
  const label = type === "chat" ? "Sohbet" : "Erişim";
  return <div className={`rounded-md border p-3 ${ban ? (type === "access" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50") : "border-neutral-200 bg-neutral-50"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{label}</span><span className={`h-2 w-2 rounded-full ${ban ? "bg-red-500" : "bg-emerald-500"}`} /></div><p className="mt-1 text-xs text-neutral-600">{ban ? (ban.permanent ? "Süresiz aktif" : `${formatDate(ban.expiresAt)} tarihine kadar`) : "Aktif kısıtlama yok"}</p>{ban?.reason ? <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{ban.reason}</p> : null}{ban ? <button type="button" onClick={onRevoke} disabled={disabled} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 text-xs font-semibold text-neutral-700"><Clock3 className="h-3.5 w-3.5" /> Banı kaldır</button> : null}</div>;
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-10 items-center justify-center gap-2 rounded text-sm font-semibold transition ${active ? "bg-[#014636] text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>{icon}{label}</button>;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
