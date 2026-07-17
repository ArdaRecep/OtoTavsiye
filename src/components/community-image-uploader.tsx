"use client";

import { useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  COMMUNITY_IMAGE_TYPES,
  MAX_COMMUNITY_IMAGES,
  MAX_COMMUNITY_IMAGE_SIZE,
  type CommunityImageAttachment,
} from "@/lib/community-media";

export function CommunityImageUploader({
  value,
  onChange,
  disabled = false,
  canUpload = true,
  onAuthRequired,
  compact = false,
  threadId,
  deleteOnRemove = true,
}: {
  value: CommunityImageAttachment[];
  onChange: (images: CommunityImageAttachment[]) => void;
  disabled?: boolean;
  canUpload?: boolean;
  onAuthRequired?: () => void;
  compact?: boolean;
  threadId?: string;
  deleteOnRemove?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  function openPicker() {
    if (!canUpload) {
      onAuthRequired?.();
      return;
    }
    inputRef.current?.click();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_COMMUNITY_IMAGES - value.length;
    const selected = Array.from(files).slice(0, Math.min(1, remaining));
    if (!remaining) return setError(`En fazla ${MAX_COMMUNITY_IMAGES} görsel ekleyebilirsin.`);

    const invalid = selected.find((file) => !(COMMUNITY_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_COMMUNITY_IMAGE_SIZE);
    if (invalid) return setError("Görseller JPG, PNG veya WebP olmalı ve 2 MB'ı geçmemeli.");

    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      selected.forEach((file) => formData.append("files", file));
      if (threadId) formData.set("threadId", threadId);
      const response = await fetch("/api/community/media", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Görseller yüklenemedi.");
      onChange([...value, ...((data.images ?? []) as CommunityImageAttachment[])]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Görseller yüklenemedi.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(image: CommunityImageAttachment) {
    onChange(value.filter((item) => item.path !== image.path));
    if (!deleteOnRemove) return;
    await fetch("/api/community/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [image.path] }),
    }).catch(() => undefined);
  }

  function moveImage(fromPath: string, toPath: string) {
    if (fromPath === toPath) return;
    const fromIndex = value.findIndex((image) => image.path === fromPath);
    const toIndex = value.findIndex((image) => image.path === toPath);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {value.length ? (
        <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
          {value.map((image) => (
            <div
              key={image.path}
              draggable={!disabled}
              onDragStart={() => setDraggedPath(image.path)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedPath) moveImage(draggedPath, image.path); setDraggedPath(null); }}
              onDragEnd={() => setDraggedPath(null)}
              className={`group relative aspect-square overflow-hidden rounded-md border bg-neutral-100 ${draggedPath === image.path ? "border-[#014636] opacity-70" : "border-neutral-200"}`}
            >
              <img src={image.url} alt="Yüklenecek görsel" width={180} height={180} className="h-full w-full object-cover" />
              {value[0]?.path === image.path ? <span className="absolute right-1.5 bottom-1.5 rounded bg-[#014636] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">Kapak</span> : null}
              <span className="absolute left-1.5 top-1.5 inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-black/60 text-white active:cursor-grabbing" aria-hidden="true">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <button type="button" onClick={() => void remove(image)} disabled={disabled} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Görseli kaldır">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept={COMMUNITY_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event.target.files)} />
        {value.length < MAX_COMMUNITY_IMAGES ? (
          <button type="button" onClick={openPicker} disabled={disabled || isUploading} className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:border-[#014636]/40 hover:text-[#014636] disabled:cursor-not-allowed disabled:opacity-50">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {canUpload ? "Fotoğraf ekle" : "Fotoğraf için giriş yap"}
          </button>
        ) : null}
        <span className="text-[11px] text-neutral-400">{value.length}/{MAX_COMMUNITY_IMAGES} · ilk fotoğraf kapak · maks. 2 MB</span>
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
