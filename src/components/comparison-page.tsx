"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Grid2X2, Trash2 } from "lucide-react";
import {
  clearComparisonItems,
  getComparisonItems,
  removeComparisonItem,
} from "@/lib/compare-storage";
import type { RecommendedCar, RecommendedVehicle } from "@/lib/types";
import { Navbar } from "./navbar";

export function ComparisonPage() {
  const [items, setItems] = useState<RecommendedCar[]>([]);

  useEffect(() => {
    const syncItems = () => setItems(getComparisonItems());

    syncItems();
    window.addEventListener("hangi-arac-comparison-updated", syncItems);

    return () => window.removeEventListener("hangi-arac-comparison-updated", syncItems);
  }, []);

  function handleRemove(vehicleId: string) {
    setItems(removeComparisonItem(vehicleId));
  }

  function handleClear() {
    clearComparisonItems();
    setItems([]);
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 sm:px-5">
        <header className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#014636]">
                <Grid2X2 className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.14em]">Karşılaştırmalar</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0a1110]">
                Seçtiğin araçları yan yana incele
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                Araç kartlarındaki karşılaştırma ikonuyla eklediğin seçenekler burada görünür.
              </p>
            </div>
            {items.length ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <Trash2 className="h-4 w-4" />
                Listeyi temizle
              </button>
            ) : null}
          </div>
        </header>

        {items.length ? (
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-neutral-950">Kısa bakış</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {items.length} araç seçildi. Kartlardaki satırlar aynı kriteri yan yana görmen için hizalandı.
              </p>
              <div className="mt-4 space-y-2">
                {items.map((item, index) => (
                  <div key={item.car.id} className="rounded-md bg-neutral-50 p-3">
                    <div className="text-xs font-semibold text-neutral-500">{index + 1}. araç</div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">
                      {item.car.make} {item.car.model}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                  <article key={item.car.id} className="flex min-h-full flex-col rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#014636]">
                          {item.score === null ? item.confidenceLabel : `%${item.score} uyum`}
                        </div>
                        <h2 className="mt-1 text-base font-semibold leading-tight text-neutral-950">
                          {item.car.make} {item.car.model}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">{item.car.trimLevel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.car.id)}
                        className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`${item.car.make} ${item.car.model} karşılaştırmadan kaldır`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {buildRows([item]).slice(1).map((row) => (
                        <div key={row.label} className="rounded-md bg-neutral-50 px-3 py-2">
                          <div className="text-[11px] font-semibold text-neutral-500">{row.label}</div>
                          <div className="mt-1 text-sm font-semibold text-neutral-900">{row.values[0]}</div>
                        </div>
                      ))}
                    </div>

                    <Link
                      href={`/cars/${item.car.id}`}
                      className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-[#014636]"
                    >
                      Detayları gör
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
            <Grid2X2 className="mx-auto h-10 w-10 text-neutral-300" />
            <h2 className="mt-4 text-lg font-semibold">Karşılaştırma listen boş</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
              Önerilerdeki kartlardan karşılaştırma ikonuna basarak liste oluşturabilirsin.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
            >
              Araçlara dön
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function buildRows(items: RecommendedCar[]) {
  return [
    { label: "Uyum", values: items.map((item) => (item.score === null ? item.confidenceLabel : `%${item.score}`)) },
    { label: "Piyasa fiyatı", values: items.map((item) => formatPriceRange(item.car)) },
    { label: "Yıllık gider", values: items.map((item) => formatMoney(item.car.avgAnnualCostTry)) },
    { label: "Model yılı", values: items.map((item) => formatYearRange(item.car)) },
    { label: "KM aralığı", values: items.map((item) => formatKmRange(item.car)) },
    { label: "Segment", values: items.map((item) => item.car.segment) },
    { label: "Güç", values: items.map((item) => `${item.car.powerHp} hp`) },
    { label: "Öne çıkanlar", values: items.map((item) => item.matchedPriorities.slice(0, 3).join(", ") || "-") },
  ];
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

function formatKmRange(car: RecommendedVehicle) {
  const formatter = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  });

  return `${formatter.format(car.minKm)} - ${formatter.format(car.maxKm)} km`;
}
