"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Grid2X2, Heart, Loader2, Star, X } from "lucide-react";
import type { RecommendedCar, VehicleSocialState } from "@/lib/types";
import { getStoredUserId } from "@/lib/user-identity";
import { getComparisonItemIds, toggleComparisonItem } from "@/lib/compare-storage";
import { RatingStars } from "./rating-stars";

const emptySocialState: VehicleSocialState = {
  vehicleId: "",
  averageRating: 0,
  ratingCount: 0,
  userRating: null,
  favoriteCount: 0,
  isFavorited: false,
};

export function VehicleRatingButton({
  vehicleId,
  state,
  onChange,
  compact,
}: {
  vehicleId: string;
  state?: VehicleSocialState;
  onChange?: (state: Partial<VehicleSocialState>) => void;
  compact?: boolean;
}) {
  const social = state ?? { ...emptySocialState, vehicleId };
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [selected, setSelected] = useState<number>(social.userRating ?? social.averageRating ?? 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(social.userRating ?? social.averageRating ?? 0);
  }, [social.averageRating, social.userRating]);

  async function saveRating(nextRating: number) {
    const userId = getStoredUserId();

    if (!userId) {
      setError("Puan vermek için giriş yapmalısın.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/vehicle-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, userId, rating: nextRating }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Puan kaydedilemedi.");
      }

      onChange?.({
        vehicleId,
        averageRating: data.averageRating,
        ratingCount: data.ratingCount,
        userRating: data.userRating,
      });
      setSelected(data.userRating ?? nextRating);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Puan kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-neutral-950/75 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative z-[1000] w-full max-w-sm rounded-md border border-neutral-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Aracı puanla</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">Yarım yıldız desteklenir. Kendi puanını sonra değiştirebilirsin.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <RatingStars
            value={selected}
            previewValue={preview}
            interactive
            disabled={isSaving}
            size="lg"
            onPreview={setPreview}
            onLeave={() => setPreview(null)}
            onSelect={(value) => {
              setSelected(value);
              void saveRating(value);
            }}
          />
          <div className="text-sm font-semibold text-neutral-700">
            {((preview ?? selected) || 0).toFixed(1)} / 5
          </div>
          {isSaving ? (
            <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kaydediliyor
            </div>
          ) : null}
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-300 bg-white font-semibold text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 ${
          compact ? "h-9 px-3 text-xs" : "h-10 px-3 text-sm"
        }`}
        aria-label="Araç puanla"
      >
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span>{social.ratingCount ? social.averageRating.toFixed(1) : "Puanla"}</span>
        {social.ratingCount ? <span className="text-neutral-400">({social.ratingCount})</span> : null}
      </button>

      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}

export function FavoriteButton({
  vehicleId,
  state,
  onChange,
  compact,
}: {
  vehicleId: string;
  state?: VehicleSocialState;
  onChange?: (state: Partial<VehicleSocialState>) => void;
  compact?: boolean;
}) {
  const social = state ?? { ...emptySocialState, vehicleId };
  const [isLoading, setIsLoading] = useState(false);

  async function toggleFavorite() {
    const userId = getStoredUserId();

    if (!userId) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, userId, action: "favorite" }),
      });
      const data = await response.json();

      if (response.ok) {
        onChange?.({
          vehicleId,
          isFavorited: data.isFavorited ?? data.isFavorite,
          favoriteCount: data.favoriteCount ?? data.favCount ?? 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold transition ${
        social.isFavorited
          ? "border-[#014636] bg-[#014636] text-white"
          : "border-neutral-300 bg-white text-neutral-600 hover:border-[#014636]/40 hover:text-[#014636]"
      } ${compact ? "h-9 px-3 text-xs" : "h-10 px-3 text-sm"}`}
      aria-label={social.isFavorited ? "Favoriden çıkar" : "Favoriye ekle"}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${social.isFavorited ? "fill-current" : ""}`} />}
      <span>{social.favoriteCount}</span>
    </button>
  );
}

export function VehicleDetailActions({
  item,
  initialState,
}: {
  item: RecommendedCar;
  initialState?: VehicleSocialState;
}) {
  const [state, setState] = useState<VehicleSocialState>(initialState ?? { ...emptySocialState, vehicleId: item.car.id });
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setComparisonIds(getComparisonItemIds());
      void fetchSocialState();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.car.id]);

  async function fetchSocialState() {
    const userId = getStoredUserId();
    const response = await fetch("/api/vehicle-social-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleIds: [item.car.id], userId }),
    });
    const data = await response.json();

    if (response.ok && data.vehicles?.[0]) {
      setState(data.vehicles[0]);
    }
  }

  function mergeState(nextState: Partial<VehicleSocialState>) {
    setState((current) => ({ ...current, ...nextState, vehicleId: item.car.id }));
  }

  async function toggleComparison() {
    await new Promise((resolve) => setTimeout(resolve, 240));
    const { items, status } = toggleComparisonItem(item);
    setComparisonIds(items.map((current) => current.car.id));

    if (status === "added") setComparisonNotice("Karşılaştırmaya eklendi.");
    else if (status === "removed") setComparisonNotice("Karşılaştırmadan çıkarıldı.");
    else setComparisonNotice("Karşılaştırma listesi dolu. En fazla 4 araç ekleyebilirsin.");

    window.setTimeout(() => setComparisonNotice(null), 2400);
  }

  const isCompared = comparisonIds.includes(item.car.id);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Aksiyonlar</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <VehicleRatingButton vehicleId={item.car.id} state={state} onChange={mergeState} />
        <FavoriteButton vehicleId={item.car.id} state={state} onChange={mergeState} />
        <button
          type="button"
          onClick={toggleComparison}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
            isCompared
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-neutral-300 bg-white text-neutral-600 hover:border-amber-300 hover:text-amber-700"
          }`}
        >
          <Grid2X2 className="h-4 w-4" />
          {isCompared ? "Listede" : "Karşılaştır"}
        </button>
      </div>
      {comparisonNotice ? <p className="mt-3 text-sm font-semibold text-[#014636]">{comparisonNotice}</p> : null}
    </div>
  );
}
