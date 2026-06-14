"use client";

import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  CarFront,
  Check,
  ChevronRight,
  CircleHelp,
  Fuel,
  Grid2X2,
  Heart,
  Loader2,
  PenLine,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import type {
  BodyType,
  Car,
  FuelType,
  Priority,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationSection,
  RecommendedCar,
  Transmission,
} from "@/lib/types";
import cars from "@/data/cars.json";

const PRICE_MIN = 200000;
const PRICE_MAX = 60000000;
const SLIDER_EDGE_GAP_PERCENT = 7;
const SLIDER_EXPANSION_DEAD_ZONE_PX = 5;
const allCars = cars as Car[];

type PriceDomain = {
  min: number;
  max: number;
};

const initialSliderDomain: PriceDomain = {
  min: PRICE_MIN,
  max: PRICE_MAX,
};

type ActiveTab = "recommendations" | "comparisons" | "favorites" | "settings";

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

const featuredPriorities = priorityOptions.slice(0, 5);
const extraPriorities = priorityOptions.slice(5);

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
  minPrice: PRICE_MIN,
  maxPrice: PRICE_MAX,
  priorities: ["safety", "economy", "family", "comfort"],
  bodyTypes: [],
  fuelTypes: [],
  transmission: "any",
  minSeats: 5,
};

const tabMeta: Record<ActiveTab, { title: string; description: string }> = {
  recommendations: {
    title: "Bütçene ve önceliklerine göre araç önerisi",
    description:
      "Fiyat aralığını ve öncelik kriterlerini seç. Sistem JSON veri setini filtreleyip farklı başlıklarda açıklanabilir öneriler üretir.",
  },
  comparisons: {
    title: "Karşılaştırmalar",
    description: "Öne çıkan adayları fiyat, gider, güvenlik ve kullanım profiliyle yan yana gör.",
  },
  favorites: {
    title: "Favoriler",
    description: "Beğendiğin araçları kaybetmeden kenara ayır, sonra karar masasına geri dön.",
  },
  settings: {
    title: "Ayarlar",
    description: "Dinamik fiyat ölçeği, demo veri ve tercih reseti gibi karar motoru ayarlarını yönet.",
  },
};

const navItems: { id: ActiveTab; label: string; icon: typeof PenLine }[] = [
  { id: "recommendations", label: "Öneriler", icon: PenLine },
  { id: "comparisons", label: "Karşılaştırmalar", icon: Grid2X2 },
  { id: "favorites", label: "Favoriler", icon: Heart },
  { id: "settings", label: "Ayarlar", icon: Settings },
];

const categoryIcons: Record<RecommendationSection["id"], typeof ShieldCheck> = {
  bestFit: Sparkles,
  safeChoice: ShieldCheck,
  budgetSmart: WalletCards,
  comfortTech: BadgeCheck,
};

const priorityIcons: Record<Priority, typeof ShieldCheck> = {
  safety: ShieldCheck,
  economy: Fuel,
  family: UsersRound,
  comfort: BadgeCheck,
  performance: SlidersHorizontal,
  resale: WalletCards,
  city: CarFront,
  longTrip: ChevronRight,
  lowMaintenance: Settings,
  tech: Sparkles,
};

const sectionImages: Record<RecommendationSection["id"], string> = {
  bestFit:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80",
  safeChoice:
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1400&q=80",
  budgetSmart:
    "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1400&q=80",
  comfortTech:
    "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1400&q=80",
};

const carImages = {
  electric:
    "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=900&q=80",
  suv: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80",
  sedan:
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
  hatchback:
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
  crossover:
    "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=80",
};

export function CarAdvisor() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("recommendations");
  const [preferences, setPreferences] = useState<RecommendationRequest>(initialPreferences);
  const [appliedPreferences, setAppliedPreferences] = useState<RecommendationRequest>(initialPreferences);
  const [sliderDomain, setSliderDomain] = useState<PriceDomain>(initialSliderDomain);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWeights, setShowWeights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMeta = tabMeta[activeTab];
  const formattedBudget = useMemo(
    () => `${formatMoney(preferences.minPrice)} - ${formatMoney(preferences.maxPrice)}`,
    [preferences.minPrice, preferences.maxPrice],
  );
  const uniqueRecommendations = useMemo(() => getUniqueRecommendations(data), [data]);
  const favoriteRecommendations = useMemo(
    () => getFavoriteRecommendations(favoriteIds, uniqueRecommendations),
    [favoriteIds, uniqueRecommendations],
  );
  const hasPendingChanges = useMemo(
    () => getPreferenceKey(preferences) !== getPreferenceKey(appliedPreferences),
    [appliedPreferences, preferences],
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
      setAppliedPreferences(payload.appliedFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyCurrentPreferences();
  }

  function applyCurrentPreferences() {
    void fetchRecommendations(preferences);
  }

  function resetPreferences() {
    setPreferences(initialPreferences);
    setAppliedPreferences(initialPreferences);
    setSliderDomain(initialSliderDomain);
    void fetchRecommendations(initialPreferences);
  }

  function applyBudgetRange(minPrice: number, maxPrice: number, domain?: PriceDomain) {
    const nextRange = normalizeBudgetRange(minPrice, maxPrice);
    const nextDomain = domain ?? getDomainForSelection(nextRange.minPrice, nextRange.maxPrice);

    setSliderDomain(normalizeDomain(nextDomain));
    setPreferences((current) => ({
      ...current,
      ...nextRange,
    }));
  }

  function setBudgetRange(key: "minPrice" | "maxPrice", value: number) {
    if (key === "minPrice") {
      const step = getPriceStepForRange(Math.abs(preferences.maxPrice - value));
      const nextMax = value >= preferences.maxPrice ? value + step : preferences.maxPrice;

      applyBudgetRange(value, nextMax);
      return;
    }

    const step = getPriceStepForRange(Math.abs(value - preferences.minPrice));
    const nextMin = value <= preferences.minPrice ? value - step : preferences.minPrice;

    applyBudgetRange(nextMin, value);
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

  function addExtraPriority(priority: string) {
    if (!priority) return;

    const nextPriority = priority as Priority;
    setPreferences((current) => ({
      ...current,
      priorities: current.priorities.includes(nextPriority)
        ? current.priorities
        : [...current.priorities, nextPriority],
    }));
  }

  function toggleFavorite(carId: string) {
    setFavoriteIds((current) =>
      current.includes(carId) ? current.filter((id) => id !== carId) : [...current, carId],
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#0d1511] lg:pl-[252px]">
      <DesktopSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <MobileTopbar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-[#0a1110] sm:text-4xl">
              {activeMeta.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
              {activeMeta.description}
            </p>
          </div>
          <div className="w-full rounded-md border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600 shadow-sm sm:w-auto">
            <div className="text-base font-bold text-[#0a1110]">{formattedBudget}</div>
            <div className="mt-1">Aktif fiyat aralığı</div>
          </div>
        </header>

        {activeTab === "recommendations" ? (
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <form
              onSubmit={handleSubmit}
              className="h-fit rounded-md border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Tercihler</h2>
                  <p className="mt-2 text-sm text-neutral-600">Filtreler Vercel API route üzerinden çalışır.</p>
                </div>
                <button
                  type="button"
                  onClick={resetPreferences}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                  aria-label="Filtreleri sıfırla"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-7 space-y-7">
                <section className="space-y-4">
                  <Label
                    title="Fiyat aralığı"
                    value={`${formatShortMoney(sliderDomain.min)} - ${formatShortMoney(sliderDomain.max)}`}
                  />
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                    <NumberInput
                      label="Min"
                      value={preferences.minPrice}
                      onChange={(value) => setBudgetRange("minPrice", value)}
                    />
                    <span className="pb-3 text-neutral-500">-</span>
                    <NumberInput
                      label="Maks"
                      value={preferences.maxPrice}
                      onChange={(value) => setBudgetRange("maxPrice", value)}
                    />
                  </div>
                  <PriceRangeSlider
                    domain={sliderDomain}
                    minValue={preferences.minPrice}
                    maxValue={preferences.maxPrice}
                    onChange={(minPrice, maxPrice, domain) => applyBudgetRange(minPrice, maxPrice, domain)}
                    onCommit={(minPrice, maxPrice) => applyBudgetRange(minPrice, maxPrice)}
                  />
                  <p className="text-xs leading-5 text-neutral-500">
                    Bıraktığın yerde görünür aralık daralır. Uçtan dışarı doğru sürüklemeye devam edersen aralık
                    tekrar genişler.
                  </p>
                </section>

                <section className="space-y-4">
                  <Label title="Öncelikler" value={`${preferences.priorities.length} seçili`} />
                  <div className="space-y-2">
                    {featuredPriorities.map((option) => {
                      const Icon = priorityIcons[option.id];
                      const isActive = preferences.priorities.includes(option.id);

                      return (
                        <PriorityButton
                          key={option.id}
                          icon={<Icon className="h-5 w-5" />}
                          isActive={isActive}
                          onClick={() => togglePriority(option.id)}
                        >
                          {option.label}
                        </PriorityButton>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <Label title="Diğer" />
                  <select
                    value=""
                    onChange={(event) => addExtraPriority(event.target.value)}
                    className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Seçiniz</option>
                    {extraPriorities.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {preferences.priorities.some((priority) =>
                    extraPriorities.some((option) => option.id === priority),
                  ) ? (
                    <div className="flex flex-wrap gap-2">
                      {preferences.priorities
                        .filter((priority) => extraPriorities.some((option) => option.id === priority))
                        .map((priority) => (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => togglePriority(priority)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#014636]"
                          >
                            {priorityOptions.find((option) => option.id === priority)?.label}
                            <X className="h-3 w-3" />
                          </button>
                        ))}
                    </div>
                  ) : null}
                </section>

                <FilterGroup
                  title="Gövde tipi"
                  value={preferences.bodyTypes.length ? "Filtreli" : "Hepsi"}
                >
                  {bodyOptions.map((option) => (
                    <CompactToggle
                      key={option.id}
                      isActive={preferences.bodyTypes.includes(option.id)}
                      onClick={() => toggleBodyType(option.id)}
                    >
                      {option.label}
                    </CompactToggle>
                  ))}
                </FilterGroup>

                <FilterGroup
                  title="Yakıt tipi"
                  value={preferences.fuelTypes.length ? "Filtreli" : "Hepsi"}
                >
                  {fuelOptions.map((option) => (
                    <CompactToggle
                      key={option.id}
                      isActive={preferences.fuelTypes.includes(option.id)}
                      onClick={() => toggleFuelType(option.id)}
                    >
                      {option.label}
                    </CompactToggle>
                  ))}
                </FilterGroup>

                <section className="space-y-3">
                  <Label title="Şanzıman" value={transmissionLabel(preferences.transmission)} />
                  <div className="grid grid-cols-3 rounded-md border border-neutral-200 bg-neutral-50 p-1">
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
                        className={`rounded px-2 py-2 text-sm font-semibold transition ${
                          preferences.transmission === value
                            ? "bg-white text-[#014636] shadow-sm"
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
                    className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
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
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SlidersHorizontal className="h-4 w-4" />
                )}
                Önerileri güncelle
              </button>
            </form>

            <RecommendationResults
              data={data}
              error={error}
              isLoading={isLoading}
              showWeights={showWeights}
              onToggleWeights={() => setShowWeights((current) => !current)}
              priorities={preferences.priorities}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />

            <PendingApplyBar
              isVisible={hasPendingChanges}
              isLoading={isLoading}
              activeRange={formattedBudget}
              onApply={applyCurrentPreferences}
            />
          </div>
        ) : (
          <SecondaryPanel
            activeTab={activeTab}
            recommendations={uniqueRecommendations}
            favorites={favoriteRecommendations}
            favoriteIds={favoriteIds}
            sliderDomain={sliderDomain}
            onTabChange={setActiveTab}
            onReset={resetPreferences}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>
    </main>
  );
}

function RecommendationResults({
  data,
  error,
  isLoading,
  showWeights,
  priorities,
  favoriteIds,
  onToggleWeights,
  onToggleFavorite,
}: {
  data: RecommendationResponse | null;
  error: string | null;
  isLoading: boolean;
  showWeights: boolean;
  priorities: Priority[];
  favoriteIds: string[];
  onToggleWeights: () => void;
  onToggleFavorite: (carId: string) => void;
}) {
  return (
    <section className="min-w-0 space-y-4">
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && data && data.totalMatches === 0 ? <EmptyState /> : null}
      {!isLoading && data && data.totalMatches > 0 ? (
        <>
          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Öneri listesi</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  {data.totalMatches} araç filtrelere uygun. Her başlık kendi karar ağırlığına göre sıralandı.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleWeights}
                className="inline-flex h-11 items-center justify-center rounded-md border border-neutral-200 px-4 text-sm font-semibold text-[#0a1110] transition hover:bg-neutral-50"
              >
                Ağırlıkları göster
              </button>
            </div>
            {showWeights ? <WeightPanel priorities={priorities} /> : null}
          </div>

          {data.sections.map((section) => {
            const Icon = categoryIcons[section.id];

            return (
              <article
                key={section.id}
                className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
              >
                <div
                  className="relative min-h-28 bg-[#dfe9e2] p-5"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(239,246,241,0.98) 0%, rgba(239,246,241,0.86) 38%, rgba(239,246,241,0.28) 66%, rgba(239,246,241,0.08) 100%), url(${sectionImages[section.id]})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                >
                  <div className="flex max-w-2xl gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#014636] text-white shadow-sm">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{section.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">{section.description}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-3 min-[1180px]:grid-cols-3">
                  {section.recommendations.map((recommendation) => (
                    <CarCard
                      key={`${section.id}-${recommendation.car.id}`}
                      recommendation={recommendation}
                      isFavorite={favoriteIds.includes(recommendation.car.id)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              </article>
            );
          })}

          <p className="flex items-start gap-2 px-1 pb-4 text-xs leading-5 text-neutral-600">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
            Skorlar, seçtiğin önceliklerin ağırlıklarına göre hesaplanır. Demo fiyatlar gerçek piyasa verisi yerine
            örnek JSON üzerinden gelir.
          </p>
        </>
      ) : null}
    </section>
  );
}

function PendingApplyBar({
  isVisible,
  isLoading,
  activeRange,
  onApply,
}: {
  isVisible: boolean;
  isLoading: boolean;
  activeRange: string;
  onApply: () => void;
}) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 lg:left-[276px] lg:right-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-md border border-emerald-900/15 bg-[#0a3329] p-3 text-white shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Filtrelerde uygulanmamış değişiklik var</div>
          <div className="mt-1 text-xs text-emerald-50/80">Aktif seçim: {activeRange}</div>
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={isLoading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#014636] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-white/70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
          Değişiklikleri uygula
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] overflow-hidden bg-[#00261e] text-white lg:block">
      <div
        className="absolute inset-0 opacity-42"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,31,24,0.82), rgba(0,31,24,0.68)), url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#014636]">
            <CarFront className="h-7 w-7" />
          </div>
          <div className="font-semibold">Araç karar motoru</div>
        </div>

        <nav className="mt-10 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex h-14 w-full items-center gap-4 rounded-md px-4 text-left text-sm font-semibold transition ${
                  isActive ? "bg-[#0b513c] text-white" : "text-emerald-50/90 hover:bg-white/10"
                }`}
              >
                <Icon className="h-6 w-6" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-8">
          <div className="rounded-md border border-white/22 bg-[#00261e]/72 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4" />
              Hızlı ipucu
            </div>
            <p className="mt-4 text-sm leading-6 text-white/88">
              Fiyat bandını değiştirince slider yakınlaşıp uzaklaşır; yüksek fiyat aralıklarında hassasiyet korunur.
            </p>
            <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              Daha fazla bilgi
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button type="button" className="flex items-center gap-3 text-sm font-semibold text-white">
            <CircleHelp className="h-5 w-5" />
            Yardım
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileTopbar({
  activeTab,
  onTabChange,
}: {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-emerald-950/20 bg-[#00261e] px-4 py-3 text-white lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#014636]">
            <CarFront className="h-6 w-6" />
          </div>
          <div className="font-semibold">Araç karar motoru</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pb-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              activeTab === item.id ? "bg-[#0b513c] text-white" : "bg-white/10 text-emerald-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceRangeSlider({
  domain,
  minValue,
  maxValue,
  onChange,
  onCommit,
}: {
  domain: PriceDomain;
  minValue: number;
  maxValue: number;
  onChange: (minValue: number, maxValue: number, domain: PriceDomain) => void;
  onCommit: (minValue: number, maxValue: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const [dragPreview, setDragPreview] = useState<{ thumb: "min" | "max"; percent: number } | null>(null);
  const activeThumbRef = useRef<"min" | "max" | null>(null);
  const valuesRef = useRef({ minValue, maxValue, domain });
  const dragStartRef = useRef<{
    domain: PriceDomain;
    minValue: number;
    maxValue: number;
  } | null>(null);
  const step = getPriceStepForDomain(domain);
  const restingMinPercent = getDisplayRangePercent(minValue, domain);
  const restingMaxPercent = getDisplayRangePercent(maxValue, domain);
  const minPercent = dragPreview?.thumb === "min" ? dragPreview.percent : restingMinPercent;
  const maxPercent = dragPreview?.thumb === "max" ? dragPreview.percent : restingMaxPercent;

  useEffect(() => {
    valuesRef.current = { minValue, maxValue, domain };
  }, [domain, maxValue, minValue]);

  function valueFromClientX(clientX: number, thumb: "min" | "max") {
    const rect = trackRef.current?.getBoundingClientRect();
    const current = valuesRef.current;

    if (!rect) {
      return {
        domain: current.domain,
        value: thumb === "min" ? current.minValue : current.maxValue,
      };
    }

    const currentStep = getPriceStepForDomain(current.domain);
    const currentRange = current.domain.max - current.domain.min;
    const edgeGap = rect.width * (SLIDER_EDGE_GAP_PERCENT / 100);
    const activeLeft = rect.left + edgeGap;
    const activeRight = rect.right - edgeGap;
    const activeWidth = Math.max(1, activeRight - activeLeft);

    if (thumb === "max" && clientX > activeRight) {
      const base = dragStartRef.current ?? current;
      const baseStep = getPriceStepForDomain(base.domain);
      const expansion = getSliderExpansion({
        available: PRICE_MAX - base.domain.max,
        baseRange: base.domain.max - base.domain.min,
        overflowPx: clientX - activeRight,
        trackWidth: rect.width,
      });
      const nextValue = clampToStep(base.domain.max + expansion, baseStep, PRICE_MIN, PRICE_MAX);
      const nextMax = expansion > 0 ? Math.max(nextValue, current.maxValue + baseStep) : base.domain.max;
      const nextDomain = normalizeDomain({
        min: base.domain.min,
        max: nextMax,
      });

      return {
        domain: nextDomain,
        previewPercent: getPointerPercent(clientX, rect),
        value: nextDomain.max,
      };
    }

    if (thumb === "min" && clientX < activeLeft) {
      const base = dragStartRef.current ?? current;
      const baseStep = getPriceStepForDomain(base.domain);
      const expansion = getSliderExpansion({
        available: base.domain.min - PRICE_MIN,
        baseRange: base.domain.max - base.domain.min,
        overflowPx: activeLeft - clientX,
        trackWidth: rect.width,
      });
      const nextValue = clampToStep(base.domain.min - expansion, baseStep, PRICE_MIN, PRICE_MAX);
      const nextMin = expansion > 0 ? Math.min(nextValue, current.minValue - baseStep) : base.domain.min;
      const nextDomain = normalizeDomain({
        min: nextMin,
        max: base.domain.max,
      });

      return {
        domain: nextDomain,
        previewPercent: getPointerPercent(clientX, rect),
        value: nextDomain.min,
      };
    }

    const percent = Math.min(1, Math.max(0, (clientX - activeLeft) / activeWidth));
    const rawValue = current.domain.min + percent * currentRange;

    return {
      domain: current.domain,
      previewPercent: null,
      value: clampToStep(rawValue, currentStep, current.domain.min, current.domain.max),
    };
  }

  function moveThumb(thumb: "min" | "max", clientX: number) {
    const next = valueFromClientX(clientX, thumb);

    setDragPreview(
      next.previewPercent === null || next.previewPercent === undefined
        ? null
        : { thumb, percent: next.previewPercent },
    );
    updateThumb(thumb, next.value, next.domain);
  }

  function updateThumb(thumb: "min" | "max", value: number, nextDomain = valuesRef.current.domain) {
    const current = valuesRef.current;
    const currentStep = getPriceStepForDomain(nextDomain);

    if (thumb === "min") {
      const nextMin = Math.min(value, current.maxValue - currentStep);
      const normalized = normalizeBudgetRange(nextMin, current.maxValue);

      valuesRef.current = {
        domain: normalizeDomain(nextDomain),
        minValue: normalized.minPrice,
        maxValue: normalized.maxPrice,
      };
      onChange(normalized.minPrice, normalized.maxPrice, valuesRef.current.domain);
      return;
    }

    const nextMax = Math.max(value, current.minValue + currentStep);
    const normalized = normalizeBudgetRange(current.minValue, nextMax);

    valuesRef.current = {
      domain: normalizeDomain(nextDomain),
      minValue: normalized.minPrice,
      maxValue: normalized.maxPrice,
    };
    onChange(normalized.minPrice, normalized.maxPrice, valuesRef.current.domain);
  }

  function beginDrag(thumb: "min" | "max", event: PointerEvent<HTMLElement>) {
    event.preventDefault();
    activeThumbRef.current = thumb;
    dragStartRef.current = { ...valuesRef.current };
    setActiveThumb(thumb);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  }

  function beginMouseDrag(thumb: "min" | "max", event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    activeThumbRef.current = thumb;
    dragStartRef.current = { ...valuesRef.current };
    setActiveThumb(thumb);
    event.currentTarget.focus();
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp, { once: true });
  }

  function handleWindowMouseMove(event: globalThis.MouseEvent) {
    const currentThumb = activeThumbRef.current;

    if (!currentThumb) return;

    moveThumb(currentThumb, event.clientX);
  }

  function handleWindowMouseUp() {
    window.removeEventListener("mousemove", handleWindowMouseMove);
    const current = valuesRef.current;

    activeThumbRef.current = null;
    dragStartRef.current = null;
    setDragPreview(null);
    setActiveThumb(null);
    onCommit(current.minValue, current.maxValue);
  }

  function handleTrackPointerDown(event: PointerEvent<HTMLDivElement>) {
    const current = valuesRef.current;
    const nextThumb =
      Math.abs(valueFromClientX(event.clientX, "min").value - current.minValue) <=
      Math.abs(valueFromClientX(event.clientX, "max").value - current.maxValue)
        ? "min"
        : "max";

    beginDrag(nextThumb, event);
    moveThumb(nextThumb, event.clientX);
  }

  function handleTrackMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const current = valuesRef.current;
    const minCandidate = valueFromClientX(event.clientX, "min").value;
    const maxCandidate = valueFromClientX(event.clientX, "max").value;
    const nextThumb =
      Math.abs(minCandidate - current.minValue) <= Math.abs(maxCandidate - current.maxValue) ? "min" : "max";

    beginMouseDrag(nextThumb, event);
    moveThumb(nextThumb, event.clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const currentThumb = activeThumbRef.current ?? activeThumb;

    if (!currentThumb) return;

    moveThumb(currentThumb, event.clientX);
  }

  function handlePointerEnd() {
    const current = valuesRef.current;

    activeThumbRef.current = null;
    dragStartRef.current = null;
    setDragPreview(null);
    setActiveThumb(null);
    onCommit(current.minValue, current.maxValue);
  }

  function handleThumbKeyDown(thumb: "min" | "max", event: KeyboardEvent<HTMLButtonElement>) {
    const movement: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -step * 5,
      PageUp: step * 5,
    };

    if (event.key === "Home") {
      event.preventDefault();
      updateThumb(thumb, thumb === "min" ? domain.min : minValue + step);
      onCommit(valuesRef.current.minValue, valuesRef.current.maxValue);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      updateThumb(thumb, thumb === "min" ? maxValue - step : domain.max);
      onCommit(valuesRef.current.minValue, valuesRef.current.maxValue);
      return;
    }

    const delta = movement[event.key];

    if (!delta) return;

    event.preventDefault();
    updateThumb(thumb, thumb === "min" ? minValue + delta : maxValue + delta);
    onCommit(valuesRef.current.minValue, valuesRef.current.maxValue);
  }

  return (
    <div
      ref={trackRef}
      className="relative h-10 touch-none select-none"
      onPointerDown={handleTrackPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onMouseDown={handleTrackMouseDown}
      aria-label="Fiyat aralığı seçici"
    >
      <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#d8dfdd]" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#cbd7d3]"
        style={{
          left: `${SLIDER_EDGE_GAP_PERCENT}%`,
          right: `${SLIDER_EDGE_GAP_PERCENT}%`,
        }}
      />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#014636]"
        style={{
          left: `${minPercent}%`,
          width: `${maxPercent - minPercent}%`,
        }}
      />
      <button
        type="button"
        role="slider"
        aria-label="Minimum fiyat"
        aria-valuemin={domain.min}
        aria-valuemax={maxValue - step}
        aria-valuenow={minValue}
        aria-valuetext={formatMoney(minValue)}
        onPointerDown={(event) => {
          event.stopPropagation();
          beginDrag("min", event);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onMouseDown={(event) => {
          event.stopPropagation();
          beginMouseDrag("min", event);
        }}
        onKeyDown={(event) => handleThumbKeyDown("min", event)}
        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#f7f8f4] bg-[#014636] shadow-md outline-none ring-[#014636]/20 transition focus:ring-4"
        style={{ left: `${minPercent}%` }}
      />
      <button
        type="button"
        role="slider"
        aria-label="Maksimum fiyat"
        aria-valuemin={minValue + step}
        aria-valuemax={domain.max}
        aria-valuenow={maxValue}
        aria-valuetext={formatMoney(maxValue)}
        onPointerDown={(event) => {
          event.stopPropagation();
          beginDrag("max", event);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onMouseDown={(event) => {
          event.stopPropagation();
          beginMouseDrag("max", event);
        }}
        onKeyDown={(event) => handleThumbKeyDown("max", event)}
        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#f7f8f4] bg-[#014636] shadow-md outline-none ring-[#014636]/20 transition focus:ring-4"
        style={{ left: `${maxPercent}%` }}
      />
    </div>
  );
}

function SecondaryPanel({
  activeTab,
  recommendations,
  favorites,
  favoriteIds,
  sliderDomain,
  onTabChange,
  onReset,
  onToggleFavorite,
}: {
  activeTab: ActiveTab;
  recommendations: RecommendedCar[];
  favorites: RecommendedCar[];
  favoriteIds: string[];
  sliderDomain: PriceDomain;
  onTabChange: (tab: ActiveTab) => void;
  onReset: () => void;
  onToggleFavorite: (carId: string) => void;
}) {
  if (activeTab === "comparisons") {
    const comparisonItems = recommendations.slice(0, 3);

    return (
      <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">İlk 3 adayı karşılaştır</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Öneriler sekmesindeki güncel filtre sonuçlarından otomatik seçilir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTabChange("recommendations")}
            className="h-11 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
          >
            Önerilere dön
          </button>
        </div>
        {comparisonItems.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[780px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="border-b border-neutral-200 py-3 pr-4 font-semibold">Kriter</th>
                  {comparisonItems.map((item) => (
                    <th key={item.car.id} className="border-b border-neutral-200 px-4 py-3 font-semibold">
                      {item.car.make} {item.car.model}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Eşleşme", ...comparisonItems.map((item) => `%${item.score}`)],
                  ["Fiyat", ...comparisonItems.map((item) => formatMoney(item.car.priceTry))],
                  ["Yıllık gider", ...comparisonItems.map((item) => formatMoney(item.car.annualCostTry))],
                  ["Güvenlik", ...comparisonItems.map((item) => `${item.car.safetyScore}/10`)],
                  ["Konfor", ...comparisonItems.map((item) => `${item.car.comfortScore}/10`)],
                  ["Yakıt", ...comparisonItems.map((item) => fuelLabel(item.car.fuelType))],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td
                        key={`${row[0]}-${index}`}
                        className={`border-b border-neutral-100 py-3 ${index === 0 ? "pr-4 font-semibold" : "px-4"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyTabState title="Karşılaştırma için önce öneri üret" onClick={() => onTabChange("recommendations")} />
        )}
      </div>
    );
  }

  if (activeTab === "favorites") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Favori araçlar</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Kartlardaki kalp ikonuna basınca araçlar burada görünür.
          </p>
        </div>
        {favorites.length ? (
          <div className="grid gap-3 min-[900px]:grid-cols-2 min-[1180px]:grid-cols-3">
            {favorites.map((item) => (
              <CarCard
                key={item.car.id}
                recommendation={item}
                isFavorite={favoriteIds.includes(item.car.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <EmptyTabState title="Henüz favori yok" onClick={() => onTabChange("recommendations")} />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Fiyat ölçeği</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Görünür slider aralığı{" "}
          <span className="font-semibold text-[#014636]">
            {formatMoney(sliderDomain.min)} - {formatMoney(sliderDomain.max)}
          </span>
          . Aralık daraldıkça slider otomatik yakınlaşır, uçtan dışarı sürükleyince tekrar genişler.
        </p>
      </div>
      <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Demo veri</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Fiyatlar temsili. Gerçek ürünleşmede bu JSON kaynağı ilan API verisi veya güncel veri deposuyla değiştirilecek.
        </p>
      </div>
      <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Tercihleri sıfırla</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Başlangıç bütçesine ve varsayılan önceliklere geri döner.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 h-11 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
        >
          Sıfırla
        </button>
      </div>
    </div>
  );
}

function EmptyTabState({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        Önce öneri listesinden birkaç adayı inceleyip favori ekleyebilir veya filtreleri güncelleyebilirsin.
      </p>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 h-11 rounded-md bg-[#014636] px-4 text-sm font-semibold text-white"
      >
        Önerilere git
      </button>
    </div>
  );
}

function CarCard({
  recommendation,
  isFavorite,
  onToggleFavorite,
}: {
  recommendation: RecommendedCar;
  isFavorite: boolean;
  onToggleFavorite: (carId: string) => void;
}) {
  const { car } = recommendation;

  return (
    <div className="flex min-h-full flex-col rounded-md border border-neutral-200 bg-white p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#014636]">
            {car.year} / {car.segment}
          </p>
          <h4 className="mt-2 text-base font-semibold leading-tight sm:text-lg">
            {car.make} {car.model}
          </h4>
          <p className="mt-1 text-xs leading-5 text-neutral-600 sm:text-sm">{car.trim}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="rounded bg-[#014636] px-2.5 py-1 text-sm font-bold text-white">
            %{recommendation.score}
          </div>
          <button
            type="button"
            onClick={() => onToggleFavorite(car.id)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              isFavorite
                ? "border-[#014636] bg-[#014636] text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:text-[#014636]"
            }`}
            aria-label={`${car.make} ${car.model} favori`}
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="mt-4 aspect-[16/9] rounded-md border border-neutral-200 bg-neutral-100"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.18)), url(${getCarImage(car)})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
        aria-label={`${car.make} ${car.model} araç görseli`}
        role="img"
      />

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Fiyat" value={formatMoney(car.priceTry)} />
        <Metric label="Yıllık gider" value={formatMoney(car.annualCostTry)} />
        <Metric label="Yakıt" value={fuelLabel(car.fuelType)} />
        <Metric label="Şanzıman" value={transmissionLabel(car.transmission)} />
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold leading-5 text-[#0a1110]">
          {recommendation.matchedPriorities.join(", ") || recommendation.confidenceLabel}
        </div>
        <div className="mt-2 h-2 rounded-full bg-neutral-200">
          <div
            className="h-2 rounded-full bg-[#014636]"
            style={{ width: `${recommendation.score}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <h5 className="text-sm font-semibold">Neden önerildi?</h5>
        <ul className="space-y-2 text-sm leading-5 text-neutral-700">
          {recommendation.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/cars/${car.id}`}
        className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[#014636]"
      >
        Detayları gör
        <ChevronRight className="h-4 w-4" />
      </Link>
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
  const [draft, setDraft] = useState(formatPlainNumber(value));
  const [isEditing, setIsEditing] = useState(false);

  function commitDraft(event?: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseNumberInput(draft);

    setIsEditing(false);
    onChange(parsedValue);
    event?.currentTarget.blur();
  }

  return (
    <label className="block">
      <span className="text-sm text-neutral-600">{label}</span>
      <div className="mt-2 flex h-11 overflow-hidden rounded-md border border-neutral-200 bg-white focus-within:border-[#014636] focus-within:ring-2 focus-within:ring-emerald-100">
        <input
          type="text"
          inputMode="numeric"
          value={isEditing ? draft : formatPlainNumber(value)}
          onFocus={() => {
            setIsEditing(true);
            setDraft(String(value));
          }}
          onBlur={(event) => commitDraft(event)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft();
            }
          }}
          className="min-w-0 flex-1 px-1.5 text-xs font-semibold outline-none sm:px-2"
        />
        <span className="flex w-8 items-center justify-center border-l border-neutral-200 text-sm font-semibold text-neutral-700 sm:w-10">
          ₺
        </span>
      </div>
    </label>
  );
}

function PriorityButton({
  children,
  icon,
  isActive,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-4 rounded-md border px-4 text-left text-sm font-semibold transition ${
        isActive
          ? "border-emerald-50 bg-[#eef7f0] text-[#0a1110]"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      <span className="text-[#014636]">{icon}</span>
      <span className="flex-1">{children}</span>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded border ${
          isActive ? "border-[#014636] bg-[#014636] text-white" : "border-neutral-300 bg-white text-transparent"
        }`}
      >
        <Check className="h-4 w-4" />
      </span>
    </button>
  );
}

function CompactToggle({
  children,
  isActive,
  onClick,
}: {
  children: ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
        isActive
          ? "border-[#014636] bg-[#eef7f0] text-[#014636]"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <Label title={title} value={value} />
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function Label({ title, value }: { title: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {value ? <span className="text-xs font-medium text-neutral-500">{value}</span> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-1 break-words text-[13px] font-bold text-neutral-950">{value}</div>
    </div>
  );
}

function WeightPanel({ priorities }: { priorities: Priority[] }) {
  const activeLabels = priorities
    .map((priority) => priorityOptions.find((option) => option.id === priority)?.label)
    .filter(Boolean);

  return (
    <div className="mt-5 rounded-md border border-emerald-100 bg-[#f3faf5] p-4">
      <div className="text-sm font-semibold text-[#014636]">Aktif karar ağırlıkları</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(activeLabels.length ? activeLabels : ["Varsayılan denge"]).map((label) => (
          <span
            key={label}
            className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-[#014636]"
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Bu prototipte seçilen her öncelik eşit ağırlıkla puanlanır. Sonraki adımda her öncelik için ayrı yüzde
        sürgüsü eklenebilir.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#014636]" />
        <p className="mt-3 font-semibold">Araçlar puanlanıyor</p>
        <p className="mt-1 text-sm text-neutral-600">Bütçe, filtreler ve öncelikler birlikte değerlendiriliyor.</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Bu filtrelerle eşleşme yok</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        Bütçeyi biraz genişletmeyi, gövde/yakıt filtresini kaldırmayı veya koltuk sayısını düşürmeyi deneyebilirsin.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-950">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h2 className="font-semibold">Bir şey ters gitti</h2>
        <p className="mt-1 text-sm">{message}</p>
      </div>
    </div>
  );
}

function normalizeBudgetRange(minPrice: number, maxPrice: number) {
  const step = getPriceStepForRange(Math.abs(maxPrice - minPrice));
  const minValue = clampToStep(minPrice, step, PRICE_MIN, PRICE_MAX);
  const maxValue = clampToStep(maxPrice, step, PRICE_MIN, PRICE_MAX);

  if (maxValue - minValue >= step) {
    return { minPrice: minValue, maxPrice: maxValue };
  }

  if (minValue <= PRICE_MIN) {
    return { minPrice: PRICE_MIN, maxPrice: Math.min(PRICE_MAX, PRICE_MIN + step) };
  }

  return {
    minPrice: Math.max(PRICE_MIN, maxValue - step),
    maxPrice: maxValue,
  };
}

function getDomainForSelection(minPrice: number, maxPrice: number) {
  const normalized = normalizeBudgetRange(minPrice, maxPrice);

  return normalizeDomain({
    min: normalized.minPrice,
    max: normalized.maxPrice,
  });
}

function normalizeDomain(domain: PriceDomain) {
  const minValue = Math.max(PRICE_MIN, Math.min(domain.min, PRICE_MAX));
  const maxValue = Math.max(PRICE_MIN, Math.min(domain.max, PRICE_MAX));
  const step = getPriceStepForRange(Math.abs(maxValue - minValue));

  if (maxValue - minValue >= step) {
    return { min: minValue, max: maxValue };
  }

  if (minValue <= PRICE_MIN) {
    return { min: PRICE_MIN, max: Math.min(PRICE_MAX, PRICE_MIN + step) };
  }

  return {
    min: Math.max(PRICE_MIN, maxValue - step),
    max: maxValue,
  };
}

function getRangePercent(value: number, domain: PriceDomain) {
  return ((value - domain.min) / Math.max(1, domain.max - domain.min)) * 100;
}

function getDisplayRangePercent(value: number, domain: PriceDomain) {
  const usablePercent = 100 - SLIDER_EDGE_GAP_PERCENT * 2;

  return SLIDER_EDGE_GAP_PERCENT + (getRangePercent(value, domain) * usablePercent) / 100;
}

function getPointerPercent(clientX: number, rect: DOMRect) {
  return Math.min(100, Math.max(0, ((clientX - rect.left) / Math.max(1, rect.width)) * 100));
}

function getSliderExpansion({
  available,
  baseRange,
  overflowPx,
  trackWidth,
}: {
  available: number;
  baseRange: number;
  overflowPx: number;
  trackWidth: number;
}) {
  const activeOverflow = Math.max(0, overflowPx - SLIDER_EXPANSION_DEAD_ZONE_PX);

  if (available <= 0 || activeOverflow <= 0) return 0;

  const overflowRatio = Math.min(1.25, activeOverflow / Math.max(1, trackWidth));
  const easedRatio = Math.pow(overflowRatio / 1.25, 1.35);
  const expansionWindow = Math.min(available, Math.max(baseRange * 3, 2500000));

  return Math.min(available, expansionWindow * easedRatio);
}

function getPriceStepForDomain(domain: PriceDomain) {
  return getPriceStepForRange(domain.max - domain.min);
}

function getPriceStepForRange(range: number) {
  if (range <= 1500000) return 25000;
  if (range <= 5000000) return 50000;

  return 100000;
}

function clampToStep(value: number, step: number, min: number, max: number) {
  const safeValue = Number.isFinite(value) ? value : min;
  const clamped = Math.min(max, Math.max(min, safeValue));

  return Math.min(max, Math.max(min, min + Math.round((clamped - min) / step) * step));
}

function getUniqueRecommendations(data: RecommendationResponse | null) {
  if (!data) return [];

  const seen = new Set<string>();
  const recommendations: RecommendedCar[] = [];

  data.sections.forEach((section) => {
    section.recommendations.forEach((recommendation) => {
      if (seen.has(recommendation.car.id)) return;

      seen.add(recommendation.car.id);
      recommendations.push(recommendation);
    });
  });

  return recommendations;
}

function getFavoriteRecommendations(favoriteIds: string[], currentRecommendations: RecommendedCar[]) {
  const currentById = new Map(currentRecommendations.map((recommendation) => [recommendation.car.id, recommendation]));

  return favoriteIds
    .map((carId) => {
      const currentRecommendation = currentById.get(carId);

      if (currentRecommendation) return currentRecommendation;

      const car = allCars.find((item) => item.id === carId);

      if (!car) return null;

      return createFavoriteRecommendation(car);
    })
    .filter((item): item is RecommendedCar => Boolean(item));
}

function createFavoriteRecommendation(car: Car): RecommendedCar {
  const score = Math.round(
    Math.min(
      98,
      Math.max(
        1,
        ((car.safetyScore + car.efficiencyScore + car.familyScore + car.comfortScore + car.reliabilityScore) / 5) *
          10,
      ),
    ),
  );

  return {
    car,
    score,
    confidenceLabel: "Favoriye eklendi",
    matchedPriorities: car.tags.slice(0, 3),
    reasons: [
      "Bu araç favorilerine eklendiği için arama filtresinden bağımsız gösteriliyor.",
      ...car.highlights,
    ].slice(0, 5),
    tradeoffs: car.tradeoffs,
  };
}

function getCarImage(car: Car) {
  if (car.fuelType === "electric") return carImages.electric;
  if (car.bodyType === "suv") return carImages.suv;
  if (car.bodyType === "crossover") return carImages.crossover;
  if (car.bodyType === "sedan") return carImages.sedan;

  return carImages.hatchback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortMoney(value: number) {
  if (value >= 1000000) {
    return `${new Intl.NumberFormat("tr-TR", {
      maximumFractionDigits: value >= 10000000 ? 0 : 1,
    }).format(value / 1000000)}M`;
  }

  return `${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value / 1000)}K`;
}

function formatPlainNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNumberInput(value: string) {
  const numericValue = Number(value.replace(/\D/g, ""));

  return Number.isFinite(numericValue) ? numericValue : PRICE_MIN;
}

function getPreferenceKey(preferences: RecommendationRequest) {
  return JSON.stringify({
    minPrice: preferences.minPrice,
    maxPrice: preferences.maxPrice,
    priorities: [...preferences.priorities].sort(),
    bodyTypes: [...preferences.bodyTypes].sort(),
    fuelTypes: [...preferences.fuelTypes].sort(),
    transmission: preferences.transmission,
    minSeats: preferences.minSeats,
  });
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
