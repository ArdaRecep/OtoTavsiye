"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CarFront, Copy, Loader2, Lock, MessageCircle, Pencil, ThumbsDown, ThumbsUp, Trash2, Unlock, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { useCurrentUser, type ClientUser } from "@/lib/auth/client-user";
import { communityCategories, type CommunityThread } from "@/lib/community";
import type { CommunityCategory } from "@/lib/community";
import type { CommunityImageAttachment } from "@/lib/community-media";
import { AdminUserModerationModal, type AdminModerationTarget } from "./admin-user-moderation-modal";
import { AuthModal } from "./auth-modal";
import { CommunityCommentSection } from "./comment-section";
import { CommunityImageGallery } from "./community-image-gallery";
import { CommunityImageUploader } from "./community-image-uploader";
import { SponsorSlot } from "./sponsor-slot";

export function CommunityThreadPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [thread, setThread] = useState<CommunityThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<AdminModerationTarget | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isReactionPending, setIsReactionPending] = useState(false);
  const { isAdmin } = useAdminStatus();
  const { userId, mutate } = useCurrentUser();

  const fetchThread = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/community/${threadId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Konu alınamadı.");
      setThread(data.thread);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Konu alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => { queueMicrotask(() => void fetchThread()); }, [fetchThread]);

  async function toggleStatus() {
    if (!thread) return;
    setIsMutating(true);
    const nextStatus = thread.status === "open" ? "closed" : "open";
    const response = await fetch(`/api/community/${thread.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    if (response.ok) setThread({ ...thread, status: nextStatus, imageUrls: nextStatus === "closed" ? [] : thread.imageUrls });
    else setNotice("Konu durumu güncellenemedi.");
    setIsMutating(false);
  }

  async function deleteThread() {
    if (!thread || !window.confirm("Bu konuyu ve tüm yanıtlarını kalıcı olarak silmek istiyor musun?")) return;
    setIsMutating(true);
    const response = await fetch(`/api/community/${thread.id}`, { method: "DELETE" });
    if (response.ok) router.push("/topluluk");
    else { setNotice("Konu silinemedi."); setIsMutating(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setNotice("Konu bağlantısı kopyalandı.");
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function handleAuthSuccess(authenticatedUser: ClientUser) {
    setIsAuthOpen(false);
    await mutate({ user: authenticatedUser }, { revalidate: false });
  }

  async function toggleThreadReaction(action: "like" | "dislike") {
    if (!thread) return;
    if (!userId) {
      setIsAuthOpen(true);
      return;
    }
    if (isReactionPending) return;
    setIsReactionPending(true);
    try {
      const response = await fetch("/api/community-thread-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Etkileşim kaydedilemedi.");
      setThread({
        ...thread,
        likeCount: Number(data.likeCount ?? 0),
        dislikeCount: Number(data.dislikeCount ?? 0),
        userInteraction: data.userInteraction === "like" || data.userInteraction === "dislike" ? data.userInteraction : null,
      });
    } catch (reactionError) {
      setNotice(reactionError instanceof Error ? reactionError.message : "Etkileşim kaydedilemedi.");
    } finally {
      setIsReactionPending(false);
    }
  }

  if (isLoading) return <main className="mx-auto flex min-h-80 w-full max-w-5xl items-center justify-center px-3 py-6"><Loader2 className="h-6 w-6 animate-spin text-[#014636]" /></main>;
  if (error || !thread) return <main className="mx-auto w-full max-w-5xl px-3 py-6"><div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? "Konu bulunamadı."}</div></main>;

  const category = communityCategories.find((item) => item.id === thread.category);
  const canCloseThread = thread.status === "open" && (isAdmin || userId === thread.userId);
  const canOpenThread = thread.status === "closed" && isAdmin;
  const canEditThread = thread.status === "open" && userId === thread.userId;
  const canShowThreadActions = canCloseThread || canOpenThread || isAdmin || canEditThread;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5">
      <Link href="/topluluk" className="inline-flex items-center gap-2 text-sm font-semibold text-[#014636]"><ArrowLeft className="h-4 w-4" /> Topluluğa dön</Link>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <article className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-[#014636]">{category?.label}</span>{thread.status === "closed" ? <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700"><Lock className="h-3 w-3" /> Yanıtlara kapalı</span> : null}</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{thread.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">{isAdmin ? <button type="button" onClick={() => setModerationTarget({ id: thread.userId, username: thread.authorUsername })} className="font-semibold text-neutral-700 hover:text-[#014636] hover:underline">{thread.authorUsername}</button> : <span className="font-semibold text-neutral-700">{thread.authorUsername}</span>}<span>{formatDate(thread.createdAt)}</span><span>{thread.commentCount} yanıt</span><span>{thread.participantCount} katılımcı</span></div>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => void toggleThreadReaction("like")} disabled={isReactionPending} aria-pressed={thread.userInteraction === "like"} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${thread.userInteraction === "like" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-white text-neutral-600 hover:text-emerald-700"}`}><ThumbsUp className={`h-4 w-4 ${thread.userInteraction === "like" ? "fill-current" : ""}`} /> {thread.likeCount}</button>
              <button type="button" onClick={() => void toggleThreadReaction("dislike")} disabled={isReactionPending} aria-pressed={thread.userInteraction === "dislike"} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${thread.userInteraction === "dislike" ? "border-red-200 bg-red-50 text-red-600" : "border-neutral-200 bg-white text-neutral-600 hover:text-red-600"}`}><ThumbsDown className={`h-4 w-4 ${thread.userInteraction === "dislike" ? "fill-current" : ""}`} /> {thread.dislikeCount}</button>
              {isReactionPending ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : null}
            </div>
            <p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-neutral-700">{thread.body}</p>
            <CommunityImageGallery images={thread.imageUrls} variant="carousel" />
            {thread.vehicle ? <Link href={`/cars/${thread.vehicleId}`} className="mt-5 inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#014636]"><CarFront className="h-4 w-4" /> {thread.vehicle.make} {thread.vehicle.model}</Link> : null}
          </article>
          {notice ? <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#014636]">{notice}</div> : null}
          <CommunityCommentSection threadId={thread.id} isClosed={thread.status === "closed"} />
        </div>

        <aside className="space-y-4">
          <SponsorSlot compact />
          <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-[#014636]" /> Konu özeti</div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Stat value={thread.commentCount} label="Yanıt" icon={<MessageCircle className="h-4 w-4" />} /><Stat value={thread.participantCount} label="Katılımcı" icon={<UsersRound className="h-4 w-4" />} /></div>
            <button type="button" onClick={copyLink} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"><Copy className="h-4 w-4" /> Bağlantıyı kopyala</button>
          </div>
          {canShowThreadActions ? <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold">{isAdmin ? "Admin işlemleri" : "Konu işlemleri"}</h2><div className="mt-3 space-y-2">{canEditThread ? <button type="button" disabled={isMutating} onClick={() => setIsEditOpen(true)} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"><Pencil className="h-4 w-4" /> Konuyu düzenle</button> : null}{canCloseThread || canOpenThread ? <button type="button" disabled={isMutating} onClick={toggleStatus} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">{thread.status === "open" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />} {thread.status === "open" ? "Konuyu kapat" : "Konuyu aç"}</button> : null}{isAdmin ? <button type="button" disabled={isMutating} onClick={deleteThread} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Konuyu sil</button> : null}</div></div> : null}
        </aside>
      </div>
      {isEditOpen ? <ThreadEditModal thread={thread} onClose={() => setIsEditOpen(false)} onSaved={(nextThread) => { setThread(nextThread); setIsEditOpen(false); setNotice("Konu güncellendi."); }} /> : null}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onAuthenticated={handleAuthSuccess} />
      <AdminUserModerationModal target={moderationTarget} onClose={() => setModerationTarget(null)} />
    </main>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon: ReactNode }) {
  return <div className="rounded-md bg-neutral-50 p-3"><div className="flex items-center justify-between text-[#014636]">{icon}<span className="text-lg font-semibold">{value}</span></div><div className="mt-1 text-[10px] font-semibold text-neutral-500">{label}</div></div>;
}

function ThreadEditModal({ thread, onClose, onSaved }: { thread: CommunityThread; onClose: () => void; onSaved: (thread: CommunityThread) => void }) {
  const initialImages = useMemo<CommunityImageAttachment[]>(
    () => thread.imagePaths.map((path, index) => ({ path, url: thread.imageUrls[index] ?? "" })).filter((image) => Boolean(image.url)),
    [thread.imagePaths, thread.imageUrls],
  );
  const originalPaths = useMemo(() => new Set(initialImages.map((image) => image.path)), [initialImages]);
  const [draft, setDraft] = useState({
    title: thread.title,
    body: thread.body,
    category: thread.category,
    images: initialImages,
  });
  const [uploadedPaths, setUploadedPaths] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleImagesChange(images: CommunityImageAttachment[]) {
    setDraft((current) => ({ ...current, images }));
    const nextUploaded = images.filter((image) => !originalPaths.has(image.path)).map((image) => image.path);
    if (nextUploaded.length) {
      setUploadedPaths((current) => new Set([...current, ...nextUploaded]));
    }
  }

  function cleanupUnsavedImages(savedPaths: string[] = []) {
    const paths = Array.from(uploadedPaths).filter((path) => !savedPaths.includes(path));
    if (!paths.length) return;
    void fetch("/api/community/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    }).catch(() => undefined);
  }

  function close() {
    cleanupUnsavedImages();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const imagePaths = draft.images.map((image) => image.path);
    setIsSaving(true);
    setError(null);

    const unusedUploadedPaths = Array.from(uploadedPaths).filter((path) => !imagePaths.includes(path));
    if (unusedUploadedPaths.length) {
      await fetch("/api/community/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: unusedUploadedPaths }),
      }).catch(() => undefined);
    }

    try {
      const response = await fetch(`/api/community/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          body: draft.body,
          category: draft.category,
          imagePaths,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Konu güncellenemedi.");
      setUploadedPaths(new Set());
      onSaved({
        ...thread,
        title: draft.title.trim(),
        body: draft.body.trim(),
        category: draft.category,
        updatedAt: new Date().toISOString(),
        imagePaths,
        imageUrls: draft.images.map((image) => image.url),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Konu güncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <div><h2 className="text-lg font-semibold">Konuyu düzenle</h2><p className="mt-1 text-xs text-neutral-500">İlk fotoğraf kapak olarak görünür.</p></div>
          <button type="button" onClick={close} disabled={isSaving} aria-label="Düzenleme penceresini kapat" className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block text-xs font-semibold text-neutral-600">Kategori<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as CommunityCategory }))} className="editor-input mt-1.5">{communityCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="block text-xs font-semibold text-neutral-600">Başlık<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} minLength={5} maxLength={120} required className="editor-input mt-1.5" /></label>
          <label className="block text-xs font-semibold text-neutral-600">Detay<textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} minLength={10} maxLength={3000} rows={7} required className="editor-input mt-1.5 resize-y" /></label>
          <CommunityImageUploader value={draft.images} onChange={handleImagesChange} disabled={isSaving} threadId={thread.id} deleteOnRemove={false} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-4"><button type="button" onClick={close} disabled={isSaving} className="h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold disabled:opacity-50">Vazgeç</button><button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Kaydet</button></footer>
      </form>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
