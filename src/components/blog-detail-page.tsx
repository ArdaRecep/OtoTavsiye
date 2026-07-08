"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import type { BlogPostRow } from "@/app/api/blog/route";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { BlogEditorModal } from "./blog-editor-modal";


export function BlogDetailPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPostRow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, isAdmin, isLoading: isAdminLoading } = useAdminStatus();

  const fetchPost = useCallback(async () => {
    try {
      const query = isAdmin && userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const response = await fetch(`/api/blog/${encodeURIComponent(slug)}${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Blog alınamadı.");
      }

      setPost(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blog alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, slug, userId]);

  useEffect(() => {
    if (isAdminLoading) return;
    queueMicrotask(() => {
      void fetchPost();
    });
  }, [fetchPost, isAdminLoading]);

  async function deletePost() {
    if (!userId || !post) return;

    const response = await fetch(`/api/blog/${encodeURIComponent(post.slug)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      router.push("/blog");
    }
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5">
        <Link href="/blog" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#014636]">
          <ArrowLeft className="h-4 w-4" />
          Bloga dön
        </Link>

        {isLoading || isAdminLoading ? (
          <div className="flex min-h-72 items-center justify-center rounded-md border border-neutral-300 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
          </div>
        ) : error || !post ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            {error ?? "Blog bulunamadı."}
          </div>
        ) : (
          <article className="overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm">
            {post.cover_image_url ? (
              <div
                className="aspect-[16/7] bg-neutral-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${post.cover_image_url})` }}
              />
            ) : null}
            <div className="p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-neutral-500">
                    {formatDate(post.created_at)} {isAdmin && post.status === "draft" ? "· Taslak" : ""}
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{post.title}</h1>
                </div>
                {isAdmin ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={deletePost}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-base leading-7 text-neutral-600">{post.excerpt}</p>
              <div className="mt-7 whitespace-pre-line text-[15px] leading-8 text-neutral-800">{post.content}</div>
            </div>
          </article>
        )}
        <BlogEditorModal
          isOpen={isEditorOpen}
          userId={userId}
          post={post}
          onClose={() => setIsEditorOpen(false)}
          onSaved={(nextPost) => setPost(nextPost)}
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
