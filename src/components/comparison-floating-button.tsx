"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Grid2X2 } from "lucide-react";
import { useAutoComparison } from "@/hooks/use-auto-comparison";
import { getComparisonItems } from "@/lib/compare-storage";
import type { RecommendedCar } from "@/lib/types";

export function ComparisonFloatingButton() {
  const [items, setItems] = useState<RecommendedCar[]>([]);
  const count = items.length;

  useAutoComparison(items);

  useEffect(() => {
    const syncItems = () => setItems(getComparisonItems());

    queueMicrotask(syncItems);
    window.addEventListener("hangi-arac-comparison-updated", syncItems);

    return () => window.removeEventListener("hangi-arac-comparison-updated", syncItems);
  }, []);

  if (!count) return null;

  return (
    <Link
      href="/karsilastirmalar"
      className="fixed bottom-5 right-4 z-50 inline-flex items-center gap-3 rounded-full border border-[#014636]/15 bg-[#014636] px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-950/20 transition hover:bg-[#003a2d] sm:right-6"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
        <Grid2X2 className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-[11px] font-bold text-[#014636]">
          {count}
        </span>
      </span>
      <span className="leading-tight">
        Karşılaştırma
        <span className="block text-xs font-medium text-emerald-50/80">Listeye git</span>
      </span>
    </Link>
  );
}
