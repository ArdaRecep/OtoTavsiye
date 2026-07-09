"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import type { BlogPostRow } from "@/app/api/blog/route";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { BlogEditorModal } from "./blog-editor-modal";


const COMMENTS_PER_PAGE = 8;

type AdminComment = {
  id: string;
  vehicle_id: string;
  content: string;
  created_at: string;
  users?: {
    username: string;
  } | null;
  vehicle?: {
    make?: string;
    model?: string;
  } | null;
};

type AdminUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  chatBannedUntil: string | null;
  accessBanned: boolean;
};

export function AdminPage() {
  const { userId, isAdmin, isLoading: isAdminLoading } = useAdminStatus();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [commentSearch, setCommentSearch] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [banDaysByUser, setBanDaysByUser] = useState<Record<string, number>>({});
  const [editingPost, setEditingPost] = useState<BlogPostRow | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const fetchAdminData = useCallback(async () => {
    if (!userId || !isAdmin) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    const [postsResponse, commentsResponse, usersResponse] = await Promise.all([
      fetch("/api/blog?includeDrafts=true"),
      fetch("/api/admin/comments"),
      fetch("/api/admin/users"),
    ]);
    const [postsData, commentsData, usersData] = await Promise.all([
      postsResponse.json(),
      commentsResponse.json(),
      usersResponse.json(),
    ]);

    if (postsResponse.ok) {
      setPosts(postsData.posts ?? []);
    }
    if (commentsResponse.ok) {
      setComments(commentsData.comments ?? []);
    }
    if (usersResponse.ok) {
      setUsers(usersData.users ?? []);
    }
    setIsDataLoading(false);
  }, [isAdmin, userId]);

  useEffect(() => {
    if (isAdminLoading) return;
    queueMicrotask(() => {
      void fetchAdminData();
    });
  }, [fetchAdminData, isAdminLoading]);

  useEffect(() => {
    queueMicrotask(() => setCommentPage(1));
  }, [commentSearch]);

  const filteredComments = useMemo(() => {
    const query = commentSearch.trim().toLocaleLowerCase("tr-TR");

    if (!query) return comments;

    return comments.filter((comment) => {
      const haystack = [
        comment.content,
        comment.users?.username,
        comment.vehicle?.make,
        comment.vehicle?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [commentSearch, comments]);

  const totalCommentPages = Math.max(1, Math.ceil(filteredComments.length / COMMENTS_PER_PAGE));
  const visibleComments = filteredComments.slice(
    (commentPage - 1) * COMMENTS_PER_PAGE,
    commentPage * COMMENTS_PER_PAGE,
  );
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase("tr-TR");

    if (!query) return users;

    return users.filter((user) => user.username.toLocaleLowerCase("tr-TR").includes(query));
  }, [userSearch, users]);

  async function deletePost(slug: string) {
    if (!userId) return;

    const response = await fetch(`/api/blog/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      setPosts((current) => current.filter((post) => post.slug !== slug));
      setMessage("Blog silindi.");
    }
  }

  async function togglePostStatus(post: BlogPostRow) {
    if (!userId) return;

    const nextStatus = post.status === "published" ? "draft" : "published";
    const response = await fetch(`/api/blog/${encodeURIComponent(post.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();

    if (response.ok) {
      setPosts((current) => current.map((item) => (item.id === post.id ? data.post : item)));
    }
  }

  async function deleteComment(commentId: string) {
    if (!userId) return;

    const response = await fetch("/api/admin/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });

    if (response.ok) {
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setMessage("Yorum silindi.");
    }
  }

  async function banUser(targetUserId: string, banType: "chat" | "access") {
    if (!userId) return;

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId,
        banType,
        days: banType === "chat" ? (banDaysByUser[targetUserId] ?? 1) : undefined,
      }),
    });

    if (response.ok) {
      setMessage(banType === "chat" ? "Sohbet banı uygulandı." : "Erişim banı uygulandı.");
      await fetchAdminData();
      return;
    }

    const data = await response.json().catch(() => null);
    setMessage(data?.error ?? "Ban uygulanamadı.");
  }

  async function clearBan(targetUserId: string, banType: "chat" | "access") {
    if (!userId) return;

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, banType }),
    });

    if (response.ok) {
      setMessage("Ban kaldırıldı.");
      await fetchAdminData();
      return;
    }

    const data = await response.json().catch(() => null);
    setMessage(data?.error ?? "Ban kaldırılamadı.");
  }

  function handleSavedPost(post: BlogPostRow) {
    setPosts((current) => {
      const exists = current.some((item) => item.id === post.id);
      return exists ? current.map((item) => (item.id === post.id ? post : item)) : [post, ...current];
    });
    setMessage("Blog kaydedildi.");
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5">
        <header className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#014636]">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.14em]">Admin</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0a1110]">Yönetim paneli</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                Blog içeriklerini ve yorum moderasyonunu tek yerden yönet.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsCreatingPost(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white transition hover:bg-[#003a2d]"
              >
                <Plus className="h-4 w-4" />
                Yeni blog
              </button>
            ) : null}
          </div>
        </header>

        {isAdminLoading || isDataLoading ? (
          <div className="flex min-h-72 items-center justify-center rounded-md border border-neutral-300 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
          </div>
        ) : !userId ? (
          <LockedPanel title="Admin paneli için giriş yapmalısın." />
        ) : !isAdmin ? (
          <LockedPanel title="Bu hesabın admin yetkisi yok." />
        ) : (
          <>
            {message ? (
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#014636]">
                {message}
              </div>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Blog" value={posts.length} icon={<BookOpen className="h-5 w-5" />} />
              <StatCard label="Yorum" value={comments.length} icon={<MessageCircle className="h-5 w-5" />} />
              <StatCard
                label="Kullanıcı"
                value={users.length}
                icon={<UserRound className="h-5 w-5" />}
              />
            </section>

            <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Bloglar</h2>
                  <p className="mt-1 text-sm text-neutral-500">Yayınla, taslağa al, düzenle veya sil.</p>
                </div>
              </div>
              <div className="mt-4 divide-y divide-neutral-100">
                {posts.length ? (
                  posts.map((post) => (
                    <div key={post.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-neutral-950">{post.title}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {post.status === "published" ? "Yayında" : "Taslak"} · {post.slug}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                          <Eye className="h-4 w-4" />
                          Gör
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditingPost(post)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePostStatus(post)}
                          className="h-9 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                          {post.status === "published" ? "Taslağa al" : "Yayınla"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePost(post.slug)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Sil
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-neutral-500">Henüz blog yok.</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-[#014636]" />
                    <h2 className="text-lg font-semibold">Kullanıcı banları</h2>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Süreli sohbet banı veya cihaz/IP tabanlı erişim banı uygula.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Kullanıcı ara"
                    className="h-10 w-full rounded-md border border-neutral-300 pl-9 pr-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mt-4 divide-y divide-neutral-100">
                {filteredUsers.length ? (
                  filteredUsers.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-950">
                          <span>{item.username}</span>
                          {item.isAdmin ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-[#014636]">Admin</span>
                          ) : null}
                          {item.chatBannedUntil ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              Sohbet banlı
                            </span>
                          ) : null}
                          {item.accessBanned ? (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                              Erişim banlı
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Kayıt: {formatDate(item.createdAt)}
                          {item.chatBannedUntil ? ` · Sohbet banı bitiş: ${formatDate(item.chatBannedUntil)}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={banDaysByUser[item.id] ?? 1}
                          onChange={(event) =>
                            setBanDaysByUser((current) => ({
                              ...current,
                              [item.id]: Number(event.target.value),
                            }))
                          }
                          className="h-9 w-20 rounded-md border border-neutral-300 px-2 text-sm outline-none focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                          aria-label={`${item.username} sohbet ban günü`}
                        />
                        <button
                          type="button"
                          disabled={item.isAdmin}
                          onClick={() => banUser(item.id, "chat")}
                          className="h-9 rounded-md border border-amber-200 px-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Sohbet banla
                        </button>
                        {item.chatBannedUntil ? (
                          <button
                            type="button"
                            onClick={() => clearBan(item.id, "chat")}
                            className="h-9 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            Sohbet banını kaldır
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={item.isAdmin}
                          onClick={() => banUser(item.id, "access")}
                          className="h-9 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Erişim banı
                        </button>
                        {item.accessBanned ? (
                          <button
                            type="button"
                            onClick={() => clearBan(item.id, "access")}
                            className="h-9 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            Erişim banını kaldır
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-neutral-500">Kullanıcı bulunamadı.</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-[#014636]" />
                    <h2 className="text-lg font-semibold">Yorumlar</h2>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {filteredComments.length} yorum gösteriliyor.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={commentSearch}
                    onChange={(event) => setCommentSearch(event.target.value)}
                    placeholder="Yorum, kullanıcı veya araç ara"
                    className="h-10 w-full rounded-md border border-neutral-300 pl-9 pr-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mt-4 divide-y divide-neutral-100">
                {visibleComments.length ? (
                  visibleComments.map((comment) => (
                    <div key={comment.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-950">
                          {comment.users?.username ?? "Kullanıcı"} ·{" "}
                          <Link href={`/cars/${comment.vehicle_id}`} className="text-[#014636] hover:underline">
                            {comment.vehicle?.make ?? "Araç"} {comment.vehicle?.model ?? ""}
                          </Link>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">{comment.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteComment(comment.id)}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Sil
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-neutral-500">Yorum bulunamadı.</p>
                )}
              </div>

              {filteredComments.length > COMMENTS_PER_PAGE ? (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setCommentPage((page) => Math.max(1, page - 1))}
                    disabled={commentPage === 1}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Önceki
                  </button>
                  <span className="text-sm font-semibold text-neutral-500">
                    {commentPage} / {totalCommentPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCommentPage((page) => Math.min(totalCommentPages, page + 1))}
                    disabled={commentPage === totalCommentPages}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}

        <BlogEditorModal
          isOpen={isCreatingPost || Boolean(editingPost)}
          userId={userId}
          post={editingPost}
          onClose={() => {
            setIsCreatingPost(false);
            setEditingPost(null);
          }}
          onSaved={handleSavedPost}
        />
      </main>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-500">{label}</span>
        <span className="text-[#014636]">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-950">{value}</div>
    </div>
  );
}

function LockedPanel({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
      <ShieldCheck className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <Link
        href="/giris"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
      >
        Giriş yap
      </Link>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
