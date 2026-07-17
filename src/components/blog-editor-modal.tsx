"use client";

import { FormEvent, useEffect, useState } from "react";
import { ImageIcon, Loader2, Save, X } from "lucide-react";
import type { BlogPostRow } from "@/app/api/blog/route";

type BlogFormState = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: "draft" | "published";
};

export function BlogEditorModal({
  isOpen,
  userId,
  post,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  userId: string | null;
  post?: BlogPostRow | null;
  onClose: () => void;
  onSaved: (post: BlogPostRow) => void;
}) {
  const [form, setForm] = useState<BlogFormState>(createInitialForm(post));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverPreview = form.coverImageUrl.trim();

  useEffect(() => {
    if (!isOpen) return;

    queueMicrotask(() => {
      setForm(createInitialForm(post));
      setError(null);
    });
  }, [isOpen, post]);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(post ? `/api/blog/${encodeURIComponent(post.slug)}` : "/api/blog", {
        method: post ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          coverImageUrl: form.coverImageUrl,
          status: form.status,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Blog kaydedilemedi.");
      }

      onSaved(data.post);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blog kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-md border border-neutral-300 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">{post ? "Blogu düzenle" : "Yeni blog ekle"}</h2>
            <p className="mt-1 text-sm text-neutral-600">Kapak görselini URL ile ekle, içerikleri kaydet.</p>
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

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
              {coverPreview ? (
                <span
                  className="block h-36 w-full rounded-md bg-neutral-200 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverPreview})` }}
                />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-neutral-300" />
                  <span className="mt-3 text-sm font-semibold text-neutral-700">Kapak görseli</span>
                  <span className="mt-1 text-xs text-neutral-500">Görsel URL girince burada önizlenir.</span>
                </>
              )}
            </div>
            {coverPreview ? (
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({ ...current, coverImageUrl: "" }));
                }}
                className="mt-2 h-9 w-full rounded-md border border-neutral-300 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                Görseli kaldır
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            <Input
              label="Başlık"
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
              required
            />
            <Input
              label="Kısa açıklama"
              value={form.excerpt}
              onChange={(value) => setForm((current) => ({ ...current, excerpt: value }))}
            />
            <Input
              label="Kapak görseli URL"
              value={form.coverImageUrl}
              onChange={(value) => setForm((current) => ({ ...current, coverImageUrl: value }))}
              placeholder="https://..."
            />
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">İçerik</span>
              <textarea
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                required
                rows={10}
                className="mt-1 w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Durum</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as "draft" | "published" }))
                }
                className="mt-1 h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
              >
                <option value="published">Yayında</option>
                <option value="draft">Taslak</option>
              </select>
            </label>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving || !form.title.trim() || !form.content.trim()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {post ? "Değişiklikleri kaydet" : "Blogu ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function createInitialForm(post?: BlogPostRow | null): BlogFormState {
  return {
    title: post?.title ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    coverImageUrl: post?.cover_image_url ?? "",
    status: post?.status ?? "published",
  };
}

function Input({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
