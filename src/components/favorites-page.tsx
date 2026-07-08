"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Grid2X2, Heart, Loader2, Trash2 } from "lucide-react";
import { getComparisonItemIds, toggleComparisonItem } from "@/lib/compare-storage";
import type { RecommendationResponse, RecommendedCar, RecommendedVehicle } from "@/lib/types";
import { getStoredUserId } from "@/lib/user-identity";
import { Navbar } from "./navbar";

const fallbackImage =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80";

export function FavoritesPage() {
  const [items, setItems] = useState<RecommendedCar[]>([]);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [pendingComparisonId, setPendingComparisonId] = useState<string | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async (nextUserId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/favorites?userId=${encodeURIComponent(nextUserId)}`);
      const data = (await response.json()) as RecommendationResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Favoriler alınamadı.");
      }

      setItems(data.recommendations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Favoriler alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const storedUserId = getStoredUserId();
      setUserId(storedUserId);
      setComparisonIds(getComparisonItemIds());

      if (!storedUserId) {
        setIsLoading(false);
        return;
      }

      void fetchFavorites(storedUserId);
    });
  }, [fetchFavorites]);

  async function removeFavorite(item: RecommendedCar) {
    if (!userId) return;

    setItems((current) => current.filter((favorite) => favorite.car.id !== item.car.id));

    const response = await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: item.car.id, userId, action: "favorite" }),
    });

    if (!response.ok) {
      setItems((current) => [item, ...current]);
    }
  }

  async function handleToggleComparison(item: RecommendedCar) {
    const carName = `${item.car.make} ${item.car.model}`;
    setPendingComparisonId(item.car.id);
    setComparisonNotice(null);

    await new Promise((resolve) => setTimeout(resolve, 280));

    const { items: nextItems, status } = toggleComparisonItem(item);
    setComparisonIds(nextItems.map((current) => current.car.id));
    setPendingComparisonId(null);

    if (status === "added") {
      setComparisonNotice(`${carName} karşılaştırmaya eklendi.`);
    } else if (status === "removed") {
      setComparisonNotice(`${carName} karşılaştırmadan çıkarıldı.`);
    } else {
      setComparisonNotice("Karşılaştırma listesi dolu. En fazla 4 araç ekleyebilirsin.");
    }

    window.setTimeout(() => setComparisonNotice(null), 2600);
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 sm:px-5">
        <header className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#014636]">
            <Heart className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Favoriler</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0a1110]">Favori araçların</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Beğendiğin seçenekleri burada sakla, istediğini karşılaştırma listene ekle.
          </p>
        </header>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center rounded-md border border-neutral-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
          </div>
        ) : !userId ? (
          <EmptyState
            title="Favorilerini görmek için giriş yap"
            description="Favori listeni hesabına bağlı tutuyoruz."
            actionHref="/giris"
            actionLabel="Giriş yap"
          />
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>
        ) : items.length ? (
          <>
            {comparisonNotice ? (
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#014636]">
                {comparisonNotice}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <FavoriteCard
                  key={item.car.id}
                  item={item}
                  isCompared={comparisonIds.includes(item.car.id)}
                  isComparisonPending={pendingComparisonId === item.car.id}
                  onRemove={() => removeFavorite(item)}
                  onToggleComparison={() => handleToggleComparison(item)}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Henüz favori aracın yok"
            description="Araç kartlarındaki kalp ikonuyla favori listeni oluşturmaya başlayabilirsin."
            actionHref="/"
            actionLabel="Araçlara dön"
          />
        )}
      </main>
    </div>
  );
}

function FavoriteCard({
  item,
  isCompared,
  isComparisonPending,
  onRemove,
  onToggleComparison,
}: {
  item: RecommendedCar;
  isCompared: boolean;
  isComparisonPending: boolean;
  onRemove: () => void;
  onToggleComparison: () => void;
}) {
  const car = item.car;

  return (
    <article className="relative flex min-h-full flex-col rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-[#014636]/30 hover:shadow-md">
      <div
        className="aspect-[16/9] rounded-md border border-neutral-200 bg-neutral-100"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.18)), url(${car.imageUrl ?? fallbackImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#014636]">
            {formatYearRange(car)} / {car.segment}
          </p>
          <h2 className="mt-1 text-base font-semibold">
            {car.make} {car.model}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-600">{car.trimLevel}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onToggleComparison}
            disabled={isComparisonPending}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              isCompared
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-neutral-200 text-neutral-500 hover:border-amber-300 hover:text-amber-700"
            }`}
            aria-label={isCompared ? `${car.make} ${car.model} karşılaştırmadan çıkar` : `${car.make} ${car.model} karşılaştır`}
            title={isCompared ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
          >
            {isComparisonPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Grid2X2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label={`${car.make} ${car.model} favorilerden çıkar`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Piyasa fiyatı" value={formatPriceRange(car)} />
        <Metric label="Yıllık gider" value={formatMoney(car.avgAnnualCostTry)} />
      </div>
      <Link
        href={`/cars/${car.id}`}
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-[#014636]"
      >
        Detayları gör
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
      <Heart className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-1.5">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className="mt-0.5 break-words text-xs font-bold text-neutral-950">{value}</div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPriceRange(car: RecommendedVehicle) {
  return `${formatMoney(car.marketMinPrice)} - ${formatMoney(car.marketMaxPrice)}`;
}

function formatYearRange(car: RecommendedVehicle) {
  return car.minYear === car.maxYear ? `${car.minYear}` : `${car.minYear}-${car.maxYear}`;
}
