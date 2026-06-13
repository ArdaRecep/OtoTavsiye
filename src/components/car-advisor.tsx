"use client";

import {
  AlertCircle,
  BadgeCheck,
  CarFront,
  Check,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  BodyType,
  FuelType,
  Priority,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationSection,
  Transmission,
} from "@/lib/types";

const priorityOptions: { id: Priority; label: string }[] = [
  { id: "safety", label: "Güvenlik" },
  { id: "economy", label: "Ekonomi" },
  { id: "family", label: "Aile" },
  { id: "comfort", label: "Konfor" },
  { id: "performance", label: "Performans" },
  { id: "resale", label: "İkinci el" },
  { id: "city", label: "Şehir içi" },
  { id: "longTrip", label: "Uzun yol" },
  { id: "lowMaintenance", label: "Bakım" },
  { id: "tech", label: "Teknoloji" },
];

const bodyOptions: { id: BodyType; label: string }[] = [
  { id: "hatchback", label: "Hatchback" },
  { id: "sedan", label: "Sedan" },
  { id: "crossover", label: "Crossover" },
  { id: "suv", label: "SUV" },
];

const fuelOptions: { id: FuelType; label: string }[] = [
  { id: "gasoline", label: "Benzin" },
  { id: "diesel", label: "Dizel" },
  { id: "hybrid", label: "Hibrit" },
  { id: "electric", label: "Elektrik" },
];

const initialPreferences: RecommendationRequest = {
  minPrice: 900000,
  maxPrice: 2200000,
  priorities: ["safety", "economy", "lowMaintenance"],
  bodyTypes: [],
  fuelTypes: [],
  transmission: "any",
  minSeats: 5,
};

const categoryIcons: Record<RecommendationSection["id"], typeof ShieldCheck> = {
  bestFit: Sparkles,
  safeChoice: ShieldCheck,
  budgetSmart: WalletCards,
  comfortTech: BadgeCheck,
};

export function CarAdvisor() {
  const [preferences, setPreferences] = useState<RecommendationRequest>(initialPreferences);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formattedBudget = useMemo(
    () => `${formatMoney(preferences.minPrice)} - ${formatMoney(preferences.maxPrice)}`,
    [preferences.minPrice, preferences.maxPrice],
  );

  useEffect(() => {
    void fetchRecommendations(initialPreferences);
  }, []);

  async function fetchRecommendations(nextPreferences: RecommendationRequest) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPreferences),
      });

      if (!response.ok) {
        throw new Error("Öneriler alınamadı.");
      }

      const payload = (await response.json()) as RecommendationResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchRecommendations(preferences);
  }

  function togglePriority(priority: Priority) {
    setPreferences((current) => ({
      ...current,
      priorities: current.priorities.includes(priority)
        ? current.priorities.filter((item) => item !== priority)
        : [...current.priorities, priority],
    }));
  }

  function toggleBodyType(bodyType: BodyType) {
    setPreferences((current) => ({
      ...current,
      bodyTypes: current.bodyTypes.includes(bodyType)
        ? current.bodyTypes.filter((item) => item !== bodyType)
        : [...current.bodyTypes, bodyType],
    }));
  }

  function toggleFuelType(fuelType: FuelType) {
    setPreferences((current) => ({
      ...current,
      fuelTypes: current.fuelTypes.includes(fuelType)
        ? current.fuelTypes.filter((item) => item !== fuelType)
        : [...current.fuelTypes, fuelType],
    }));
  }

  function setBudget(key: "minPrice" | "maxPrice", value: number) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };

      if (next.minPrice > next.maxPrice) {
        return key === "minPrice"
          ? { ...next, maxPrice: value }
          : { ...next, minPrice: value };
      }

      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f8f6] text-neutral-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-800">
              <CarFront className="h-4 w-4" />
              Araç karar motoru
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Bütçene ve önceliklerine göre araç önerisi
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
                Fiyat aralığını ve önemli kriterleri seç. Sistem JSON veri setini filtreleyip
                farklı başlıklarda açıklanabilir öneriler üretir.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
            <div className="font-semibold text-neutral-950">{formattedBudget}</div>
            <div>Demo veri seti, fiyatlar temsili</div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tercihler</h2>
                <p className="text-sm text-neutral-600">Filtreler Vercel API route üzerinden çalışır.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreferences(initialPreferences);
                  void fetchRecommendations(initialPreferences);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                aria-label="Filtreleri sıfırla"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <section className="space-y-3">
                <Label title="Fiyat aralığı" value={formattedBudget} />
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    label="Min"
                    value={preferences.minPrice}
                    onChange={(value) => setBudget("minPrice", value)}
                  />
                  <NumberInput
                    label="Maks"
                    value={preferences.maxPrice}
                    onChange={(value) => setBudget("maxPrice", value)}
                  />
                </div>
                <input
                  type="range"
                  min={500000}
                  max={4000000}
                  step={50000}
                  value={preferences.maxPrice}
                  onChange={(event) => setBudget("maxPrice", Number(event.target.value))}
                  className="w-full accent-emerald-700"
                  aria-label="Maksimum fiyat"
                />
              </section>

              <section className="space-y-3">
                <Label title="Öncelikler" value={`${preferences.priorities.length || 0} seçili`} />
                <div className="grid grid-cols-2 gap-2">
                  {priorityOptions.map((option) => (
                    <ToggleButton
                      key={option.id}
                      isActive={preferences.priorities.includes(option.id)}
                      onClick={() => togglePriority(option.id)}
                    >
                      {option.label}
                    </ToggleButton>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <Label title="Gövde tipi" value={preferences.bodyTypes.length ? "Filtreli" : "Hepsi"} />
                <div className="grid grid-cols-2 gap-2">
                  {bodyOptions.map((option) => (
                    <ToggleButton
                      key={option.id}
                      isActive={preferences.bodyTypes.includes(option.id)}
                      onClick={() => toggleBodyType(option.id)}
                    >
                      {option.label}
                    </ToggleButton>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <Label title="Yakıt tipi" value={preferences.fuelTypes.length ? "Filtreli" : "Hepsi"} />
                <div className="grid grid-cols-2 gap-2">
                  {fuelOptions.map((option) => (
                    <ToggleButton
                      key={option.id}
                      isActive={preferences.fuelTypes.includes(option.id)}
                      onClick={() => toggleFuelType(option.id)}
                    >
                      {option.label}
                    </ToggleButton>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <Label title="Şanzıman" value={transmissionLabel(preferences.transmission)} />
                <div className="grid grid-cols-3 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                  {[
                    ["any", "Farketmez"],
                    ["automatic", "Otomatik"],
                    ["manual", "Manuel"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          transmission: value as Transmission | "any",
                        }))
                      }
                      className={`rounded-md px-2 py-2 text-sm font-medium transition ${
                        preferences.transmission === value
                          ? "bg-white text-emerald-800 shadow-sm"
                          : "text-neutral-600 hover:text-neutral-950"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <Label title="Koltuk" value={`En az ${preferences.minSeats}`} />
                <select
                  value={preferences.minSeats}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      minSeats: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value={2}>En az 2 koltuk</option>
                  <option value={4}>En az 4 koltuk</option>
                  <option value={5}>En az 5 koltuk</option>
                  <option value={7}>En az 7 koltuk</option>
                </select>
              </section>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
              Önerileri güncelle
            </button>
          </form>

          <section className="min-w-0 space-y-5">
            {error ? <ErrorState message={error} /> : null}
            {isLoading ? <LoadingState /> : null}
            {!isLoading && data && data.totalMatches === 0 ? <EmptyState /> : null}
            {!isLoading && data && data.totalMatches > 0 ? (
              <>
                <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Öneri listesi</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      {data.totalMatches} araç filtrelere uydu. Her başlık kendi karar ağırlığıyla sıralandı.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                    <Check className="h-4 w-4" />
                    Açıklamalı skor
                  </div>
                </div>

                {data.sections.map((section) => {
                  const Icon = categoryIcons[section.id];

                  return (
                    <article
                      key={section.id}
                      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{section.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-neutral-600">{section.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        {section.recommendations.map((recommendation) => (
                          <CarCard key={`${section.id}-${recommendation.car.id}`} recommendation={recommendation} />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function CarCard({
  recommendation,
}: {
  recommendation: NonNullable<RecommendationResponse["sections"][number]["recommendations"][number]>;
}) {
  const { car } = recommendation;

  return (
    <div className="flex min-h-full flex-col rounded-lg border border-neutral-200 bg-[#fbfdfb] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            {car.year} / {car.segment}
          </p>
          <h4 className="mt-1 text-lg font-semibold leading-tight">
            {car.make} {car.model}
          </h4>
          <p className="mt-1 text-sm text-neutral-600">{car.trim}</p>
        </div>
        <div className="rounded-md bg-neutral-950 px-2.5 py-1 text-sm font-semibold text-white">
          %{recommendation.score}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Fiyat" value={formatMoney(car.priceTry)} />
        <Metric label="Yıllık gider" value={formatMoney(car.annualCostTry)} />
        <Metric label="Yakıt" value={fuelLabel(car.fuelType)} />
        <Metric label="Şanzıman" value={transmissionLabel(car.transmission)} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-600">
          <span>{recommendation.confidenceLabel}</span>
          <span>{recommendation.matchedPriorities.join(", ") || "Dengeli profil"}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-neutral-200">
          <div
            className="h-2 rounded-full bg-emerald-700"
            style={{ width: `${recommendation.score}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <h5 className="text-sm font-semibold">Neden önerildi?</h5>
        <ul className="space-y-2 text-sm leading-5 text-neutral-700">
          {recommendation.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
        <span className="font-semibold">Dikkat: </span>
        {recommendation.tradeoffs[0] ?? "Bu aday için belirgin bir ödün alanı işaretlenmedi."}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <input
        type="number"
        min={0}
        step={50000}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function ToggleButton({
  children,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-md border px-3 py-2 text-left text-sm font-medium transition ${
        isActive
          ? "border-emerald-700 bg-emerald-50 text-emerald-900"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-xs font-medium text-neutral-500">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold text-neutral-950">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
        <p className="mt-3 font-semibold">Araçlar puanlanıyor</p>
        <p className="mt-1 text-sm text-neutral-600">Bütçe, filtreler ve öncelikler birlikte değerlendiriliyor.</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Bu filtrelerle eşleşme yok</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        Bütçeyi biraz genişletmeyi, gövde/yakıt filtresini kaldırmayı veya koltuk sayısını düşürmeyi deneyebilirsin.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h2 className="font-semibold">Bir şey ters gitti</h2>
        <p className="mt-1 text-sm">{message}</p>
      </div>
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

function fuelLabel(value: FuelType) {
  const labels: Record<FuelType, string> = {
    gasoline: "Benzin",
    diesel: "Dizel",
    hybrid: "Hibrit",
    electric: "Elektrik",
  };

  return labels[value];
}

function transmissionLabel(value: Transmission | "any") {
  const labels: Record<Transmission | "any", string> = {
    any: "Farketmez",
    automatic: "Otomatik",
    manual: "Manuel",
  };

  return labels[value];
}
