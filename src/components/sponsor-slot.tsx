import { Megaphone } from "lucide-react";

export function SponsorSlot({ compact = false }: { compact?: boolean }) {
  const name = process.env.NEXT_PUBLIC_SPONSOR_NAME?.trim();
  if (!name) return null;

  const href = process.env.NEXT_PUBLIC_SPONSOR_URL?.trim() || "#";
  const message = process.env.NEXT_PUBLIC_SPONSOR_MESSAGE?.trim() || "Bu alanın destekçisi";
  const imageUrl = process.env.NEXT_PUBLIC_SPONSOR_IMAGE_URL?.trim();

  return (
    <aside className="overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm" aria-label="Sponsor">
      <a href={href} target="_blank" rel="sponsored noreferrer" className={`flex items-center gap-3 transition hover:bg-neutral-50 ${compact ? "p-3" : "p-4"}`}>
        {imageUrl ? <img src={imageUrl} alt="" width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 rounded-md border border-neutral-200 object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[#014636]"><Megaphone className="h-5 w-5" /></span>}
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">Sponsorlu</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-neutral-900">{name}</span>
          <span className="mt-0.5 block text-xs text-neutral-500">{message}</span>
        </span>
      </a>
    </aside>
  );
}
