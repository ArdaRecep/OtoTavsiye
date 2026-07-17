"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CarFront, Images, Loader2, MessageCircle, Plus, Search, ThumbsDown, ThumbsUp, UsersRound, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useCurrentUser, type ClientUser } from "@/lib/auth/client-user";
import { communityCategories, type CommunityCategory, type CommunityThread } from "@/lib/community";
import type { CommunityImageAttachment } from "@/lib/community-media";
import { AuthModal } from "./auth-modal";
import { CommunityImageUploader } from "./community-image-uploader";
import { SponsorSlot } from "./sponsor-slot";

type ThreadDraft = { title: string; body: string; category: CommunityCategory; images: CommunityImageAttachment[] };
const emptyDraft: ThreadDraft = { title: "", body: "", category: "vehicle_advice", images: [] };

export function CommunityPage() {
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<CommunityCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<ThreadDraft>(emptyDraft);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<Set<string>>(new Set());
  const [authIntent, setAuthIntent] = useState<"submit" | "upload" | null>(null);
  const debouncedSearch = useDebounce(search, 350);
  const { userId, mutate } = useCurrentUser();

  const fetchThreads = useCallback(async (nextPage = 0, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "20" });
      if (category !== "all") params.set("category", category);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      params.set("sort", sort);
      const response = await fetch(`/api/community?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Konular alınamadı.");
      setThreads((current) => append ? [...current, ...(data.threads ?? [])] : (data.threads ?? []));
      setTotal(Number(data.total ?? 0));
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Konular alınamadı.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [category, debouncedSearch, sort]);

  useEffect(() => {
    queueMicrotask(() => void fetchThreads(0, false));
  }, [fetchThreads]);

  async function createThread(authJustCompleted = false) {
    if (!userId && !authJustCompleted) {
      setPendingSubmit(true);
      setIsAuthOpen(true);
      return;
    }

    setIsSubmitting(true);
    setComposerError(null);
    try {
      const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, imagePaths: draft.images.map((image) => image.path) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Konu açılamadı.");
      setDraft(emptyDraft);
      setIsComposerOpen(false);
      window.location.href = `/topluluk/${data.id}`;
    } catch (submitError) {
      setComposerError(submitError instanceof Error ? submitError.message : "Konu açılamadı.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeComposer() {
    const imagePaths = draft.images.map((image) => image.path);
    setDraft(emptyDraft);
    setComposerError(null);
    setIsComposerOpen(false);
    if (imagePaths.length) {
      void fetch("/api/community/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: imagePaths }),
      }).catch(() => undefined);
    }
  }

  async function handleAuthSuccess(authenticatedUser: ClientUser) {
    setIsAuthOpen(false);
    await mutate({ user: authenticatedUser }, { revalidate: false });
    if (pendingSubmit && authIntent === "submit") {
      setPendingSubmit(false);
      setAuthIntent(null);
      await createThread(true);
    } else {
      setAuthIntent(null);
    }
  }

  async function toggleThreadReaction(threadId: string, action: "like" | "dislike") {
    if (!userId) {
      setIsAuthOpen(true);
      return;
    }
    if (pendingReactionIds.has(threadId)) return;
    setPendingReactionIds((current) => new Set(current).add(threadId));
    try {
      const response = await fetch("/api/community-thread-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Etkileşim kaydedilemedi.");
      setThreads((current) => current.map((thread) => thread.id === threadId ? {
        ...thread,
        likeCount: Number(data.likeCount ?? 0),
        dislikeCount: Number(data.dislikeCount ?? 0),
        userInteraction: data.userInteraction === "like" || data.userInteraction === "dislike" ? data.userInteraction : null,
      } : thread));
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Etkileşim kaydedilemedi.");
    } finally {
      setPendingReactionIds((current) => {
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5">
      <header className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#014636]"><UsersRound className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.14em]">Topluluk</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Kararını yalnız verme</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Bütçeni anlat, araç sahiplerinden deneyim al; teknik soruları ve alternatifleri tek konu altında tartış.</p>
          </div>
          <button type="button" onClick={() => { setComposerError(null); setIsComposerOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#014636] px-5 text-sm font-semibold text-white hover:bg-[#003a2d]"><Plus className="h-4 w-4" /> Konu aç</button>
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-md border border-neutral-300 bg-white p-3 shadow-sm">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Konu, araç veya kullanıcı ara" className="h-11 w-full rounded-md border border-neutral-300 pl-10 pr-3 text-sm outline-none focus:border-[#014636] focus:ring-2 focus:ring-emerald-100" /></div>
            <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <CategoryButton active={category === "all"} onClick={() => setCategory("all")}>Tümü</CategoryButton>
                {communityCategories.map((item) => <CategoryButton key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</CategoryButton>)}
              </div>
              <div className="inline-flex rounded-md border border-neutral-300 bg-white p-1">
                <SortButton active={sort === "newest"} onClick={() => setSort("newest")}>Yeni</SortButton>
                <SortButton active={sort === "popular"} onClick={() => setSort("popular")}>Popüler</SortButton>
              </div>
            </div>
          </div>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {isLoading ? <div className="flex min-h-64 items-center justify-center rounded-md border border-neutral-300 bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#014636]" /></div> : threads.length ? (
            <div className="overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
              {threads.map((thread) => <ThreadRow key={thread.id} thread={thread} isPending={pendingReactionIds.has(thread.id)} onToggleReaction={toggleThreadReaction} />)}
            </div>
          ) : <div className="rounded-md border border-dashed border-neutral-300 bg-white p-10 text-center"><MessageCircle className="mx-auto h-10 w-10 text-neutral-300" /><h2 className="mt-3 font-semibold">Henüz konu yok</h2><p className="mt-1 text-sm text-neutral-500">İlk soruyu sen sorabilirsin.</p></div>}

          {hasMore ? <button type="button" onClick={() => void fetchThreads(page + 1, true)} disabled={isLoadingMore} className="mx-auto flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-[#014636] hover:bg-emerald-50 disabled:opacity-50">{isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Daha fazla konu</button> : null}
        </section>

        <aside className="space-y-4">
          <SponsorSlot compact />
          <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">İyi bir tavsiye konusu</h2>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-600"><li>Bütçe ve ödeme sınırını yaz.</li><li>Şehir içi, uzun yol ve yıllık kilometreyi belirt.</li><li>Otomatik, yakıt ve kasa zorunluluklarını ayır.</li><li>En fazla 3 net fotoğraf ekle.</li></ul>
          </div>
          <div className="rounded-md border border-neutral-300 bg-[#073d31] p-4 text-white shadow-sm"><div className="text-2xl font-semibold">{total}</div><div className="mt-1 text-xs text-emerald-100/75">topluluk konusu</div></div>
        </aside>
      </div>

      <ThreadComposer
        isOpen={isComposerOpen}
        draft={draft}
        isSubmitting={isSubmitting}
        error={composerError}
        canUpload={Boolean(userId)}
        onAuthRequired={() => { setAuthIntent("upload"); setIsAuthOpen(true); }}
        onChange={setDraft}
        onClose={closeComposer}
        onSubmit={() => { setAuthIntent("submit"); void createThread(); }}
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => { setIsAuthOpen(false); setPendingSubmit(false); setAuthIntent(null); }} onAuthenticated={handleAuthSuccess} />
    </main>
  );
}

function ThreadRow({ thread, isPending, onToggleReaction }: { thread: CommunityThread; isPending: boolean; onToggleReaction: (threadId: string, action: "like" | "dislike") => void }) {
  const category = communityCategories.find((item) => item.id === thread.category);
  return (
    <div className="grid gap-3 border-b border-neutral-100 p-4 last:border-b-0 hover:bg-emerald-50/35 sm:grid-cols-[220px_minmax(0,1fr)]">
      <Link href={`/topluluk/${thread.id}`} className="group contents">
        {thread.imageUrls[0] ? (
          <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            <img src={thread.imageUrls[0]} alt="" width={520} height={320} loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
            {thread.imageUrls.length > 1 ? <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-black/65 px-2 py-1 text-[10px] font-bold text-white"><Images className="h-3 w-3" /> {thread.imageUrls.length}</span> : null}
          </div>
        ) : (
          <div className="hidden aspect-[16/10] items-center justify-center rounded-md bg-emerald-50 text-[#014636] sm:flex"><MessageCircle className="h-7 w-7" /></div>
        )}
      </Link>
      <div className="min-w-0 self-center">
        <Link href={`/topluluk/${thread.id}`} className="group block">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">{category?.label}</span>{thread.status === "closed" ? <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Kapalı</span> : null}{thread.vehicle ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#014636]"><CarFront className="h-3 w-3" /> {thread.vehicle.make} {thread.vehicle.model}</span> : null}</div>
          <h2 className="mt-1.5 line-clamp-2 text-base font-semibold text-neutral-950 group-hover:text-[#014636]">{thread.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-600">{thread.body}</p>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500"><span>{thread.authorUsername}</span><span>{formatRelative(thread.createdAt)}</span><span>{thread.commentCount} yanıt</span><span>{thread.participantCount} katılımcı</span>{thread.imageUrls.length ? <span>{thread.imageUrls.length} fotoğraf</span> : null}</div>
        <ThreadReactionButtons thread={thread} isPending={isPending} onToggle={onToggleReaction} />
      </div>
    </div>
  );
}

function ThreadReactionButtons({ thread, isPending, onToggle }: { thread: CommunityThread; isPending: boolean; onToggle: (threadId: string, action: "like" | "dislike") => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" onClick={() => onToggle(thread.id, "like")} disabled={isPending} aria-pressed={thread.userInteraction === "like"} className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${thread.userInteraction === "like" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-white text-neutral-600 hover:text-emerald-700"}`}>
        <ThumbsUp className={`h-3.5 w-3.5 ${thread.userInteraction === "like" ? "fill-current" : ""}`} />
        {thread.likeCount}
      </button>
      <button type="button" onClick={() => onToggle(thread.id, "dislike")} disabled={isPending} aria-pressed={thread.userInteraction === "dislike"} className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${thread.userInteraction === "dislike" ? "border-red-200 bg-red-50 text-red-600" : "border-neutral-200 bg-white text-neutral-600 hover:text-red-600"}`}>
        <ThumbsDown className={`h-3.5 w-3.5 ${thread.userInteraction === "dislike" ? "fill-current" : ""}`} />
        {thread.dislikeCount}
      </button>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" /> : null}
    </div>
  );
}

function ThreadComposer({ isOpen, draft, isSubmitting, error, canUpload, onAuthRequired, onChange, onClose, onSubmit }: { isOpen: boolean; draft: ThreadDraft; isSubmitting: boolean; error: string | null; canUpload: boolean; onAuthRequired: () => void; onChange: (draft: ThreadDraft) => void; onClose: () => void; onSubmit: () => void }) {
  if (!isOpen) return null;
  function submit(event: FormEvent) { event.preventDefault(); void onSubmit(); }
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <div><h2 className="text-lg font-semibold">Yeni konu</h2><p className="mt-1 text-xs text-neutral-500">Tek aktif konu açabilir, en fazla 3 fotoğraf ekleyebilirsin.</p></div>
          <button type="button" onClick={onClose} aria-label="Yeni konu penceresini kapat" className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block text-xs font-semibold text-neutral-600">Kategori<select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value as CommunityCategory })} className="editor-input mt-1.5">{communityCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="block text-xs font-semibold text-neutral-600">Başlık<input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} minLength={5} maxLength={120} required placeholder="Örn. 1,5 milyon bütçeyle uzun yol için ne almalıyım?" className="editor-input mt-1.5" /></label>
          <label className="block text-xs font-semibold text-neutral-600">Detay<textarea value={draft.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} minLength={10} maxLength={3000} rows={7} required placeholder="Bütçeni, kullanımını, zorunluluklarını ve baktığın araçları yaz..." className="editor-input mt-1.5 resize-y" /></label>
          <CommunityImageUploader value={draft.images} onChange={(images) => onChange({ ...draft, images })} disabled={isSubmitting} canUpload={canUpload} onAuthRequired={onAuthRequired} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-4"><button type="button" onClick={onClose} className="h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold">Vazgeç</button><button type="submit" disabled={isSubmitting} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Konuyu aç</button></footer>
      </form>
    </div>
  );
}

function CategoryButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition ${active ? "bg-[#014636] text-white" : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"}`}>{children}</button>;
}

function SortButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className={`h-8 rounded px-3 text-xs font-semibold transition ${active ? "bg-[#014636] text-white" : "text-neutral-600 hover:bg-neutral-50"}`}>{children}</button>;
}

function formatRelative(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} saat önce`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)} gün önce`;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}
