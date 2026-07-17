"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { BlogPostRow } from "@/app/api/blog/route";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { BlogEditorModal } from "./blog-editor-modal";


export function BlogPage() {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPostRow | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, isAdmin, isLoading: isAdminLoading } = useAdminStatus();

  const fetchPosts = useCallback(async () => {
    try {
      const query = isAdmin ? "?includeDrafts=true" : "";
      const response = await fetch(`/api/blog${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Bloglar alınamadı.");
      }

      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bloglar alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdminLoading) return;
    queueMicrotask(() => {
      void fetchPosts();
    });
  }, [fetchPosts, isAdminLoading]);

  async function deletePost(post: BlogPostRow) {
    if (!userId) return;

    const response = await fetch(`/api/blog/${encodeURIComponent(post.slug)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      setPosts((current) => current.filter((item) => item.id !== post.id));
    }
  }

  function handleSavedPost(nextPost: BlogPostRow) {
    setPosts((current) => {
      const exists = current.some((item) => item.id === nextPost.id);
      return exists ? current.map((item) => (item.id === nextPost.id ? nextPost : item)) : [nextPost, ...current];
    });
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-5">
        <header className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#014636]">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.14em]">Blog</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0a1110]">Araç rehberi</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                Araç seçerken işine yarayacak kısa rehberler, bakım ipuçları ve karar notları.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsCreatingPost(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white transition hover:bg-[#003a2d]"
              >
                <Plus className="h-4 w-4" />
                Blog ekle
              </button>
            ) : null}
          </div>
        </header>

        {isLoading || isAdminLoading ? (
          <div className="flex min-h-72 items-center justify-center rounded-md border border-neutral-300 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>
        ) : posts.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
                {post.cover_image_url ? (
                  <div
                    className="aspect-[16/8] bg-neutral-100 bg-cover bg-center"
                    style={{ backgroundImage: `url(${post.cover_image_url})` }}
                  />
                ) : null}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-neutral-500">
                      {formatDate(post.created_at)} {isAdmin && post.status === "draft" ? "· Taslak" : ""}
                    </div>
                    {isAdmin ? (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPost(post)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 transition hover:bg-neutral-50 hover:text-[#014636]"
                          aria-label={`${post.title} düzenle`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePost(post)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-red-100 text-red-500 transition hover:bg-red-50"
                          aria-label={`${post.title} sil`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-neutral-950">{post.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">{post.excerpt}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#014636]"
                  >
                    Oku
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-neutral-300" />
            <h2 className="mt-4 text-lg font-semibold">Henüz blog yok</h2>
            <p className="mt-2 text-sm text-neutral-600">İlk yazılar eklendiğinde burada görünecek.</p>
          </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
