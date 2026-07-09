"use client";

import { CheckCircle2 } from "lucide-react";

export function ComparisonToast({ message }: { message: string }) {
  return (
    <div className="fixed right-4 top-20 z-[80] w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-emerald-200/70 bg-emerald-50/85 px-4 py-3 text-[#014636] shadow-xl shadow-emerald-950/10 backdrop-blur-md sm:right-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#014636]/10">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold leading-6">{message}</p>
      </div>
    </div>
  );
}
