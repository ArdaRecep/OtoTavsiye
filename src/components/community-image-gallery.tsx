"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function CommunityImageGallery({ images, compact = false, variant = "grid" }: { images: string[]; compact?: boolean; variant?: "grid" | "carousel" }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  if (!images.length) return null;

  const openPreview = (index: number) => setPreviewIndex(Math.min(Math.max(index, 0), images.length - 1));

  if (variant === "carousel") {
    const current = images[Math.min(activeIndex, images.length - 1)] ?? images[0];
    const canNavigate = images.length > 1;
    const go = (direction: -1 | 1) => {
      setActiveIndex((index) => (index + direction + images.length) % images.length);
    };

    return (
      <>
        <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-neutral-950">
          <div className="relative aspect-[16/10] w-full bg-neutral-900">
            <button type="button" onClick={() => openPreview(activeIndex)} className="block h-full w-full" aria-label={`Görsel ${activeIndex + 1} büyüt`}>
            <img src={current} alt="Topluluk gönderisi görseli" width={1100} height={700} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
            <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">{activeIndex + 1}/{images.length}</span>
            {canNavigate ? (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/75" aria-label="Önceki görsel"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/75" aria-label="Sonraki görsel"><ChevronRight className="h-5 w-5" /></button>
              </>
            ) : null}
          </div>
          {canNavigate ? <GalleryDots images={images} activeIndex={activeIndex} onSelect={setActiveIndex} /> : null}
        </div>

        {previewIndex !== null ? <ImagePreview images={images} index={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} /> : null}
      </>
    );
  }

  const visible = images.slice(0, 4);
  const gridClass = visible.length === 1
    ? "grid-cols-1"
    : visible.length === 2
      ? "grid-cols-2"
      : "grid-cols-2";

  return (
    <>
      <div className={`mt-3 grid overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 ${gridClass} ${compact ? "max-w-xl gap-0.5" : "gap-1"}`}>
        {visible.map((url, index) => (
          <button key={url} type="button" onClick={() => openPreview(index)} className={`relative overflow-hidden bg-neutral-100 ${visible.length === 1 ? (compact ? "max-h-80 aspect-[16/10]" : "max-h-[560px] aspect-[16/10]") : "aspect-square"}`} aria-label={`Görsel ${index + 1} büyüt`}>
            <img src={url} alt="Topluluk gönderisi görseli" width={900} height={600} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-200 hover:scale-[1.015]" />
          </button>
        ))}
      </div>

      {previewIndex !== null ? <ImagePreview images={images} index={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} /> : null}
    </>
  );
}

function GalleryDots({ images, activeIndex, onSelect }: { images: string[]; activeIndex: number; onSelect: (index: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-black px-3 py-3">
      {images.map((image, index) => (
        <button key={image} type="button" onClick={() => onSelect(index)} className={`h-1.5 rounded-full transition ${index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/35 hover:bg-white/60"}`} aria-label={`${index + 1}. görsel`} />
      ))}
    </div>
  );
}

function ImagePreview({ images, index, onIndexChange, onClose }: { images: string[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const canNavigate = images.length > 1;
  const image = images[index] ?? images[0] ?? "";
  const go = (direction: -1 | 1) => onIndexChange((index + direction + images.length) % images.length);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canNavigate) onIndexChange((index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight" && canNavigate) onIndexChange((index + 1) % images.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNavigate, images.length, index, onClose, onIndexChange]);

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Görsel önizleme" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/75" aria-label="Görseli kapat"><X className="h-5 w-5" /></button>
      <span className="absolute right-4 top-16 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white shadow-lg transition">{index + 1}/{images.length}</span>
      {canNavigate ? (
        <>
          <button type="button" onClick={(event) => { event.stopPropagation(); go(-1); }} className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/75" aria-label="Önceki görsel"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); go(1); }} className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition hover:bg-black/75" aria-label="Sonraki görsel"><ChevronRight className="h-6 w-6" /></button>
        </>
      ) : null}
      <img src={image} alt="Büyütülmüş topluluk görseli" className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
    </div>,
    document.body,
  );
}
