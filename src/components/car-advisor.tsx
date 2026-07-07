"use client";

import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  CarFront,
  Check,
  ChevronRight,
  CircleHelp,
  Folder,
  Fuel,
  Grid2X2,
  Heart,
  Loader2,
  LogOut,
  PenLine,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureUser, getStoredUserId, getStoredUserName, getStoredAvatarUrl } from "@/lib/user-identity";
import { useDebounce } from "@/hooks/use-debounce";
import type {
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import type {
  BodyType,
  FuelType,
  Priority,
  RecommendationRequest,
  RecommendationResponse,
  RecommendedCar,
  RecommendedVehicle,
  Transmission,
} from "@/lib/types";

const PRICE_MIN = 200000;
const PRICE_MAX = 60000000;
const SLIDER_EDGE_GAP_PERCENT = 7;
const SLIDER_EXPANSION_DEAD_ZONE_PX = 5;

type PriceDomain = {
  min: number;
  max: number;
};

const initialSliderDomain: PriceDomain = {
  min: PRICE_MIN,
  max: PRICE_MAX,
};

import { Navbar, type ActiveTab } from "./navbar";

const priorityOptions: { id: Priority; label: string }[] = [
  { id: "safety", label: "Güvenlik" },
  { id: "economy", label: "Ekonomi" },
  { id: "family", label: "Aile" },
  { id: "comfort", label: "Konfor" },
  { id: "performance", label: "Performans" },
  { id: "youth", label: "Genç" },
  { id: "resale", label: "İkinci el" },
  { id: "city", label: "Şehir içi" },
  { id: "longTrip", label: "Uzun yol" },
  { id: "lowMaintenance", label: "Bakım" },
  { id: "tech", label: "Teknoloji" },
];

const featuredPriorities = priorityOptions.slice(0, 6);
const extraPriorities = priorityOptions.slice(6);

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
  priorities: [],
  bodyTypes: [],
  fuelTypes: [],
  transmission: "any",
  minSeats: 0,
};

const tabMeta: Record<ActiveTab, { title: string; description: string }> = {
  recommendations: {
    title: "Bütçene ve önceliklerine göre araç önerisi",
    description:
      "Fiyat aralığını ve opsiyonel kriterlerini seç. Sistem Supabase RPC fonksiyonundan tek listede 10 araç getirir.",
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



const priorityIcons: Record<Priority, typeof ShieldCheck> = {
  safety: ShieldCheck,
  economy: Fuel,
  family: UsersRound,
  comfort: BadgeCheck,
  performance: SlidersHorizontal,
  youth: Zap,
  resale: WalletCards,
  city: CarFront,
  longTrip: ChevronRight,
  lowMaintenance: Settings,
  tech: Sparkles,
};

const carImages = {
  fallback:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
};

export function CarAdvisor() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("recommendations");
  const [preferences, setPreferences] = useState<RecommendationRequest>(initialPreferences);
  const [appliedPreferences, setAppliedPreferences] = useState<RecommendationRequest>(initialPreferences);
  const [sliderDomain, setSliderDomain] = useState<PriceDomain>(initialSliderDomain);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<Record<string, RecommendedCar>>({});
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWeights, setShowWeights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const userIdRef = useRef("");

  useEffect(() => {
    const storedId = getStoredUserId();
    if (storedId) {
      userIdRef.current = storedId;
    }
  }, []);

  async function initUserIfNeeded(): Promise<string> {
    if (userIdRef.current) return userIdRef.current;
    const user = await ensureUser();
    userIdRef.current = user.id;
    return user.id;
  }

  const fetchInteractionsForVehicles = useCallback(async (vehicleIds: string[]) => {
    const userId = getStoredUserId();
    if (!vehicleIds.length) return;

    const results = await Promise.allSettled(
      vehicleIds.map((id) => {
        const params = new URLSearchParams({ vehicleId: id });
        if (userId) params.set("userId", userId);
        return fetch(`/api/interactions?${params.toString()}`).then((r) => r.json());
      }),
    );

    const nextCounts: Record<string, number> = { ...likeCounts };
    const nextLiked = new Set(likedIds);
    const nextFavorited = new Set(favoritedIds);

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        nextCounts[vehicleIds[index]] = result.value.likeCount ?? 0;
        if (result.value.isLiked) {
          nextLiked.add(vehicleIds[index]);
        } else {
          nextLiked.delete(vehicleIds[index]);
        }
        if (result.value.isFavorite) {
          nextFavorited.add(vehicleIds[index]);
        } else {
          nextFavorited.delete(vehicleIds[index]);
        }
      }
    });

    setLikeCounts(nextCounts);
    setLikedIds(nextLiked);
    setFavoritedIds(nextFavorited);

    // Sync favoriteIds state with DB favorites
    setFavoriteIds(Array.from(nextFavorited));
  }, [likeCounts, likedIds, favoritedIds]);

  useEffect(() => {
    if (data?.recommendations.length) {
      const ids = data.recommendations.map((r) => r.car.id);
      void fetchInteractionsForVehicles(ids);
    }
    // Only run when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function handleToggleLike(vehicleId: string) {
    try {
      const userId = await initUserIfNeeded();
      const response = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, userId, action: "like" }),
      });

      if (!response.ok) return;

      const result = await response.json();
      setLikeCounts((prev) => ({ ...prev, [vehicleId]: result.likeCount ?? 0 }));
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (result.isLiked) {
          next.add(vehicleId);
        } else {
          next.delete(vehicleId);
        }
        return next;
      });
    } catch {
      // Silently fail
    }
  }

  const activeMeta = tabMeta[activeTab];
  const formattedBudget = useMemo(
    () => `${formatMoney(preferences.minPrice)} - ${formatMoney(preferences.maxPrice)}`,
    [preferences.minPrice, preferences.maxPrice],
  );
  const uniqueRecommendations = useMemo(() => getUniqueRecommendations(data), [data]);
  const searchedRecommendations = useMemo(
    () => filterRecommendationsByQuery(uniqueRecommendations, searchQuery),
    [searchQuery, uniqueRecommendations],
  );
  const favoriteRecommendations = useMemo(
    () => getFavoriteRecommendations(favoriteIds, uniqueRecommendations, favoriteItems),
    [favoriteIds, favoriteItems, uniqueRecommendations],
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
        body: JSON.stringify(toRecommendationPayload(nextPreferences)),
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
      bodyTypes: current.bodyTypes.includes(bodyType) ? [] : [bodyType],
    }));
  }

  function toggleFuelType(fuelType: FuelType) {
    setPreferences((current) => ({
      ...current,
      fuelTypes: current.fuelTypes.includes(fuelType) ? [] : [fuelType],
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

  async function toggleFavorite(recommendation: RecommendedCar) {
    const carId = recommendation.car.id;

    // Optimistic UI update
    setFavoriteIds((current) =>
      current.includes(carId) ? current.filter((id) => id !== carId) : [...current, carId],
    );
    setFavoriteItems((current) => {
      if (current[carId]) {
        const next = { ...current };
        delete next[carId];
        return next;
      }
      return { ...current, [carId]: recommendation };
    });
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else {
        next.add(carId);
      }
      return next;
    });

    // Persist to DB
    try {
      const userId = await initUserIfNeeded();
      await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: carId, userId, action: "favorite" }),
      });
    } catch {
      // Revert on error
      setFavoriteIds((current) =>
        current.includes(carId) ? current.filter((id) => id !== carId) : [...current, carId],
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-xl font-semibold tracking-tight text-[#0a1110] sm:text-2xl">
              {activeMeta.title}
            </h1>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-600 sm:text-sm">
              {activeMeta.description}
            </p>
          </div>
          <div className="w-full rounded-md border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600 shadow-sm sm:w-auto">
            <div className="text-sm font-bold text-[#0a1110]">{formattedBudget}</div>
            <div className="mt-0.5">Aktif fiyat aralığı</div>
          </div>
        </header>

        {activeTab === "recommendations" ? (
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <form
              onSubmit={handleSubmit}
              className="h-fit rounded-md border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Tercihler</h2>
                  <p className="mt-1 text-[11px] text-neutral-600">Filtreler API üzerinden çalışır.</p>
                </div>
                <button
                  type="button"
                  onClick={resetPreferences}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                  aria-label="Filtreleri sıfırla"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-3 space-y-3.5">
                <section className="space-y-2">
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
                  <p className="text-[11px] leading-4 text-neutral-500">
                    Bıraktığın yerde görünür aralık daralır. Uçtan dışarı doğru sürüklemeye devam edersen aralık
                    tekrar genişler.
                  </p>
                </section>

                <section className="space-y-2.5">
                  <Label title="Öncelikler" value={`${preferences.priorities.length} seçili`} />
                  <div className="space-y-1.5">
                    {featuredPriorities.map((option) => {
                      const Icon = priorityIcons[option.id];
                      const isActive = preferences.priorities.includes(option.id);

                      return (
                        <PriorityButton
                          key={option.id}
                          icon={<Icon className="h-4 w-4" />}
                          isActive={isActive}
                          onClick={() => togglePriority(option.id)}
                        >
                          {option.label}
                        </PriorityButton>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <Label title="Diğer" />
                  <select
                    value=""
                    onChange={(event) => addExtraPriority(event.target.value)}
                    className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-xs outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
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

                <section className="space-y-2">
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
                        className={`rounded px-1.5 py-1.5 text-xs font-semibold transition ${
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

                <section className="space-y-2">
                  <Label title="Koltuk" value={preferences.minSeats > 0 ? `En az ${preferences.minSeats}` : "Farketmez"} />
                  <select
                    value={preferences.minSeats}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        minSeats: Number(event.target.value),
                      }))
                    }
                    className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-xs outline-none transition focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value={0}>Farketmez</option>
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
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#014636] px-3 text-xs font-semibold text-white transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                )}
                Önerileri güncelle
              </button>
            </form>

            <RecommendationResults
              data={data}
              recommendations={searchedRecommendations}
              searchQuery={searchQuery}
              error={error}
              isLoading={isLoading}
              showWeights={showWeights}
              onToggleWeights={() => setShowWeights((current) => !current)}
              priorities={preferences.priorities}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              likeCounts={likeCounts}
              likedIds={likedIds}
              onToggleLike={handleToggleLike}
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
            recommendations={searchedRecommendations}
            favorites={favoriteRecommendations}
            favoriteIds={favoriteIds}
            sliderDomain={sliderDomain}
            onTabChange={setActiveTab}
            onReset={resetPreferences}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>
    </div>
  );
}

function RecommendationResults({
  data,
  recommendations,
  searchQuery,
  error,
  isLoading,
  showWeights,
  priorities,
  favoriteIds,
  onToggleWeights,
  onToggleFavorite,
  likeCounts,
  likedIds,
  onToggleLike,
}: {
  data: RecommendationResponse | null;
  recommendations: RecommendedCar[];
  searchQuery: string;
  error: string | null;
  isLoading: boolean;
  showWeights: boolean;
  priorities: Priority[];
  favoriteIds: string[];
  onToggleWeights: () => void;
  onToggleFavorite: (recommendation: RecommendedCar) => void;
  likeCounts: Record<string, number>;
  likedIds: Set<string>;
  onToggleLike: (vehicleId: string) => void;
}) {
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <section className="min-w-0 space-y-4">
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && data && data.totalMatches === 0 ? <EmptyState /> : null}
      {!isLoading && data && data.totalMatches > 0 ? (
        <>
          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Öneri listesi</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  {hasSearch
                    ? `"${searchQuery.trim()}" için ${recommendations.length} araç bulundu.`
                    : `RPC fonksiyonundan dönen en iyi ${data.totalMatches} araç tek listede sıralandı.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleWeights}
                className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-200 px-3 text-xs font-semibold text-[#0a1110] transition hover:bg-neutral-50"
              >
                Ağırlıkları göster
              </button>
            </div>
            {showWeights ? <WeightPanel priorities={priorities} /> : null}
          </div>

          {recommendations.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((recommendation) => (
                <CarCard
                  key={recommendation.car.id}
                  recommendation={recommendation}
                  isFavorite={favoriteIds.includes(recommendation.car.id)}
                  onToggleFavorite={onToggleFavorite}
                  likeCount={likeCounts[recommendation.car.id] ?? 0}
                  isLiked={likedIds.has(recommendation.car.id)}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
              <h3 className="text-base font-semibold">Aramanla eşleşen araç yok</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
                &quot;{searchQuery.trim()}&quot; için sonuç bulunamadı. Farklı bir marka veya model deneyebilirsin.
              </p>
            </div>
          )}

          <p className="flex items-start gap-2 px-1 pb-4 text-xs leading-5 text-neutral-600">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
            Skor, sıralama ve fiyat kesişimi Supabase veritabanındaki arac_oner RPC fonksiyonundan gelir.
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
    <div className="fixed bottom-4 left-4 right-4 z-30 lg:right-6">
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
      className="relative h-8 touch-none select-none"
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
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#f7f8f4] bg-[#014636] shadow-md outline-none ring-[#014636]/20 transition focus:ring-4"
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
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#f7f8f4] bg-[#014636] shadow-md outline-none ring-[#014636]/20 transition focus:ring-4"
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
  onToggleFavorite: (recommendation: RecommendedCar) => void;
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
                  ["Piyasa fiyatı", ...comparisonItems.map((item) => formatPriceRange(item.car))],
                  ["Yıllık gider", ...comparisonItems.map((item) => formatMoney(item.car.avgAnnualCostTry))],
                  ["Model yılı", ...comparisonItems.map((item) => formatYearRange(item.car))],
                  ["KM aralığı", ...comparisonItems.map((item) => formatKmRange(item.car))],
                  ["Güç", ...comparisonItems.map((item) => `${item.car.powerHp} hp`)],
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
                likeCount={0}
                isLiked={false}
                onToggleLike={() => {}}
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
  likeCount,
  isLiked,
  onToggleLike,
}: {
  recommendation: RecommendedCar;
  isFavorite: boolean;
  onToggleFavorite: (recommendation: RecommendedCar) => void;
  likeCount: number;
  isLiked: boolean;
  onToggleLike: (vehicleId: string) => void;
}) {
  const { car } = recommendation;

  return (
    <div className="relative flex min-h-full flex-col rounded-md border border-neutral-200 bg-white p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-[#014636]/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#014636]">
            {formatYearRange(car)} / {car.segment}
          </p>
          <h4 className="mt-1 text-sm font-semibold leading-tight">
            {car.make} {car.model}
          </h4>
          <p className="mt-0.5 text-[11px] leading-4 text-neutral-600">{car.trimLevel}</p>
        </div>
        <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5">
          <div className="rounded bg-[#014636] px-2 py-0.5 text-xs font-bold text-white">
            %{recommendation.score}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleLike(car.id)}
              className={`flex h-7 items-center gap-1.5 rounded-full border px-2 transition ${
                isLiked
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-neutral-200 bg-white text-neutral-500 hover:text-blue-600 hover:border-blue-200"
              }`}
              aria-label={`${car.make} ${car.model} beğen`}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
              {likeCount > 0 && (
                <span className="text-xs font-bold">{likeCount}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(recommendation)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                isFavorite
                  ? "border-[#014636] bg-[#014636] text-white"
                  : "border-neutral-200 bg-white text-neutral-500 hover:text-[#014636]"
              }`}
              aria-label={`${car.make} ${car.model} favori`}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="mt-2.5 aspect-[16/10] rounded-md border border-neutral-200 bg-neutral-100"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.18)), url(${getCarImage(car)})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
        aria-label={`${car.make} ${car.model} araç görseli`}
        role="img"
      />

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-sm">
        <Metric label="Piyasa fiyatı" value={formatPriceRange(car)} />
        <Metric label="Yıllık gider" value={formatMoney(car.avgAnnualCostTry)} />
        <Metric label="KM aralığı" value={formatKmRange(car)} />
        <Metric label="Güç" value={`${car.powerHp} hp`} />
      </div>

      <div className="mt-3">
        <div className="text-xs font-semibold leading-4 text-[#0a1110]">
          {recommendation.matchedPriorities.slice(0, 3).join(", ") || recommendation.confidenceLabel}
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-neutral-200">
          <div
            className="h-1.5 rounded-full bg-[#014636]"
            style={{ width: `${recommendation.score}%` }}
          />
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <h5 className="text-xs font-semibold">Neden önerildi?</h5>
        <p className="text-xs leading-4 text-neutral-600">{car.conditionSummary}</p>
        <ul className="space-y-1.5 text-xs leading-4 text-neutral-700">
          {recommendation.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#014636]" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/cars/${car.id}`}
        className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-semibold text-[#014636] before:absolute before:inset-0"
      >
        Detayları gör
        <ChevronRight className="h-3.5 w-3.5" />
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
      <span className="text-xs text-neutral-600">{label}</span>
      <div className="mt-1 flex h-9 overflow-hidden rounded-md border border-neutral-200 bg-white focus-within:border-[#014636] focus-within:ring-2 focus-within:ring-emerald-100">
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
        <span className="flex w-7 items-center justify-center border-l border-neutral-200 text-xs font-semibold text-neutral-700 sm:w-8">
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
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-md border px-2.5 text-left text-xs font-semibold transition ${
        isActive
          ? "border-emerald-50 bg-[#eef7f0] text-[#0a1110]"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      <span className="text-[#014636]">{icon}</span>
      <span className="flex-1">{children}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border ${
          isActive ? "border-[#014636] bg-[#014636] text-white" : "border-neutral-300 bg-white text-transparent"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
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
      className={`rounded-md border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
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
    <section className="space-y-2">
      <Label title={title} value={value} />
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
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
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-1.5">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className="mt-0.5 break-words text-xs font-bold text-neutral-950">{value}</div>
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
  return data?.recommendations ?? [];
}

function filterRecommendationsByQuery(recommendations: RecommendedCar[], query: string) {
  const trimmed = query.trim().toLocaleLowerCase("tr-TR");

  if (!trimmed) return recommendations;

  return recommendations.filter(({ car }) =>
    `${car.make} ${car.model} ${car.trimLevel} ${car.segment}`.toLocaleLowerCase("tr-TR").includes(trimmed),
  );
}

function getFavoriteRecommendations(
  favoriteIds: string[],
  currentRecommendations: RecommendedCar[],
  favoriteItems: Record<string, RecommendedCar>,
) {
  const currentById = new Map(currentRecommendations.map((recommendation) => [recommendation.car.id, recommendation]));

  return favoriteIds
    .map((carId) => {
      const currentRecommendation = currentById.get(carId);

      if (currentRecommendation) return currentRecommendation;

      return favoriteItems[carId] ?? null;
    })
    .filter((item): item is RecommendedCar => Boolean(item));
}

function getCarImage(car: RecommendedVehicle) {
  return car.imageUrl ?? carImages.fallback;
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

function toRecommendationPayload(preferences: RecommendationRequest) {
  return {
    minBudget: preferences.minPrice,
    maxBudget: preferences.maxPrice,
    priorities: preferences.priorities,
    bodyType: preferences.bodyTypes[0],
    fuelType: preferences.fuelTypes[0],
    transmission: preferences.transmission === "any" ? undefined : preferences.transmission,
    minSeats: preferences.minSeats > 0 ? preferences.minSeats : undefined,
  };
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

function transmissionLabel(value: Transmission | "any") {
  const labels: Record<Transmission | "any", string> = {
    any: "Farketmez",
    automatic: "Otomatik",
    manual: "Manuel",
  };

  return labels[value];
}
