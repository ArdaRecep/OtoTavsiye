"use client";

import { useCallback, useEffect, useState } from "react";
import { CarFront, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import type { AdminVehicle } from "@/lib/vehicles/admin";
import { VehicleEditorModal } from "./vehicle-editor-modal";

const PAGE_SIZE = 12;

export function AdminVehicleManager() {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const fetchVehicles = useCallback(async () => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const response = await fetch(`/api/admin/vehicles?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Araçlar alınamadı.");
      setVehicles(data.vehicles ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Araçlar alınamadı.");
    } finally {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [debouncedSearch, page]);

  useEffect(() => {
    queueMicrotask(() => void fetchVehicles());
  }, [fetchVehicles]);

  useEffect(() => {
    queueMicrotask(() => setPage(0));
  }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><CarFront className="h-5 w-5 text-[#014636]" /><h2 className="text-lg font-semibold">Araç kataloğu</h2></div>
          <p className="mt-1 text-sm text-neutral-500">{total} araç. Kart içeriği, fiyat aralığı ve karar puanlarını yönet.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Marka, model veya paket ara" className="h-10 w-full rounded-md border border-neutral-300 pl-9 pr-3 text-sm outline-none focus:border-[#014636] focus:ring-2 focus:ring-emerald-100" />
          </div>
          <button type="button" onClick={() => setIsCreating(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white hover:bg-[#003a2d]">
            <Plus className="h-4 w-4" /> Yeni araç
          </button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#014636]" /></div>
      ) : vehicles.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <article key={vehicle.id} className="flex min-w-0 gap-3 rounded-md border border-neutral-200 p-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-neutral-100">
                {vehicle.image_url ? <img src={vehicle.image_url} alt="" width={96} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <CarFront className="m-auto mt-5 h-6 w-6 text-neutral-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-neutral-950">{vehicle.make} {vehicle.model}</div>
                <div className="mt-0.5 truncate text-xs text-neutral-500">{vehicle.trim_level}</div>
                <div className="mt-2 text-xs font-semibold text-[#014636]">{formatPrice(vehicle.market_min_price)} - {formatPrice(vehicle.market_max_price)}</div>
              </div>
              <button type="button" onClick={() => setEditingId(vehicle.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50 hover:text-[#014636]" aria-label={`${vehicle.make} ${vehicle.model} düzenle`}>
                <Pencil className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">Araç bulunamadı.</div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Önceki</button>
          <span className="text-sm font-semibold text-neutral-500">{page + 1} / {totalPages}</span>
          <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm font-semibold disabled:opacity-40">Sonraki <ChevronRight className="h-4 w-4" /></button>
        </div>
      ) : null}

      <VehicleEditorModal
        isOpen={isCreating || Boolean(editingId)}
        vehicleId={editingId}
        onClose={() => { setIsCreating(false); setEditingId(null); }}
        onSaved={() => void fetchVehicles()}
        onDeleted={() => void fetchVehicles()}
      />
    </section>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
}
