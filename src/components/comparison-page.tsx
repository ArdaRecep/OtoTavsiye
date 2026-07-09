"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, Grid2X2, Loader2, Trash2 } from "lucide-react";
import { useAutoComparison } from "@/hooks/use-auto-comparison";
import {
  clearComparisonItems,
  getComparisonItems,
  getStoredComparisonResult,
  removeComparisonItem,
  type StoredComparisonResult,
} from "@/lib/compare-storage";
import type { RecommendedCar, RecommendedVehicle } from "@/lib/types";
import { ComparisonCommentSection } from "./comment-section";

const fallbackImage =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80";

function getCarImage(car: RecommendedVehicle) {
  return car.imageUrl || fallbackImage;
}

type ComparisonDetail = {
  id: string;
  status: string;
  aiResult: unknown;
  aiSummary: string | null;
  aiRecommendation: string | null;
  activeAiReview: unknown;
  lastError: string | null;
  generatedAt: string | null;
  updatedAt: string;
};

export function ComparisonPage() {
  const [items, setItems] = useState<RecommendedCar[]>([]);
  const [storedComparison, setStoredComparison] = useState<StoredComparisonResult | null>(null);
  const [comparisonDetail, setComparisonDetail] = useState<ComparisonDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const autoComparison = useAutoComparison(items);
  const activeComparison = autoComparison.comparison ?? storedComparison;

  useEffect(() => {
    const syncItems = () => {
      setItems(getComparisonItems());
      setStoredComparison(getStoredComparisonResult());
    };

    syncItems();
    window.addEventListener("hangi-arac-comparison-updated", syncItems);

    return () => window.removeEventListener("hangi-arac-comparison-updated", syncItems);
  }, []);

  useEffect(() => {
    if (!activeComparison?.id) {
      setComparisonDetail(null);
      setDetailError(null);
      return;
    }

    const comparisonId = activeComparison.id;
    const controller = new AbortController();

    async function fetchComparisonDetail() {
      try {
        setDetailError(null);
        const response = await fetch(`/api/comparisons/${comparisonId}`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Karşılaştırma detayı alınamadı.");
        }

        const payload = (await response.json()) as { comparison: ComparisonDetail };
        setComparisonDetail(payload.comparison);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setComparisonDetail(null);
        setDetailError(error instanceof Error ? error.message : "Karşılaştırma detayı alınamadı.");
      }
    }

    void fetchComparisonDetail();

    return () => controller.abort();
  }, [activeComparison?.id, activeComparison?.updatedAt, autoComparison.status]);

  function handleRemove(vehicleId: string) {
    setItems(removeComparisonItem(vehicleId));
  }

  function handleClear() {
    clearComparisonItems();
    setItems([]);
    setStoredComparison(null);
    setComparisonDetail(null);
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 sm:px-5">
        <header className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <Trash2 className="h-4 w-4" />
                Listeyi temizle
              </button>
            ) : null}
          </div>
        </header>

        {items.length ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
            <div className="min-w-0 space-y-4">
              <section className="min-w-0 rounded-md border border-neutral-300 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-950">Araçlar</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      {items.length} araç yan yana karşılaştırılıyor.
                    </p>
                  </div>
                  {activeComparison?.id ? (
                    <div className="text-xs font-medium text-neutral-500">
                      ID: <span className="font-semibold text-neutral-800">{activeComparison.id}</span>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <ComparisonVehicleCard key={item.car.id} item={item} onRemove={handleRemove} />
                  ))}
                </div>
              </section>

              <ComparisonAiPanel
                autoStatus={autoComparison.status}
                detail={comparisonDetail}
                detailError={detailError || autoComparison.error}
                storedComparison={activeComparison}
              />
            </div>

            <aside className="min-w-0">
              {activeComparison?.id ? (
                <ComparisonCommentSection
                  comparisonId={activeComparison.id}
                  className="mt-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
                />
              ) : (
                <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-semibold">Yorumlar</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Karşılaştırma kaydı hazırlandığında yorumlar burada açılacak.
                  </p>
                </section>
              )}
            </aside>
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
    </>
  );
}

function ComparisonVehicleCard({
  item,
  onRemove,
}: {
  item: RecommendedCar;
  onRemove: (vehicleId: string) => void;
}) {
  return (
    <article className="flex min-h-full flex-col rounded-md border border-neutral-300 bg-white p-3 shadow-sm">
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
          onClick={() => onRemove(item.car.id)}
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label={`${item.car.make} ${item.car.model} karşılaştırmadan kaldır`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div
        className="mt-3 aspect-[16/10] w-full rounded-md border border-neutral-300 bg-neutral-100"
        style={{
          backgroundImage: `url(${getCarImage(item.car)})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />

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
  );
}

function ComparisonAiPanel({
  autoStatus,
  detail,
  detailError,
  storedComparison,
}: {
  autoStatus: string;
  detail: ComparisonDetail | null;
  detailError: string | null;
  storedComparison: StoredComparisonResult | null;
}) {
  const status = detail?.status ?? storedComparison?.status ?? null;
  const statusView = getComparisonStatusView(autoStatus, status, detailError);
  const StatusIcon = statusView.icon;
  const aiResult = getAiResult(detail);
  const criteria = getAiCriteria(aiResult);
  const vehicleNotes = getAiVehicleNotes(aiResult);

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-950">
            Karşılaştırma özeti
          </h2>
        </div>
        <div className="inline-flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
          <StatusIcon className={`mt-0.5 h-4 w-4 ${statusView.iconClassName}`} />
          <p className="max-w-sm text-xs leading-5 text-neutral-700">{statusView.description}</p>
        </div>
      </div>

      {storedComparison ? (
        <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-600">
          Karşılaştırma ID: <span className="font-semibold text-neutral-900">{storedComparison.id}</span>
        </div>
      ) : null}

      {detail?.aiSummary || detail?.aiRecommendation ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {detail.aiSummary ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#014636]">Özet</div>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{detail.aiSummary}</p>
            </div>
          ) : null}

          {detail.aiRecommendation ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#014636]">Tavsiye</div>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{detail.aiRecommendation}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {criteria.length ? (
        <div className="mt-4 rounded-md border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-950">
            Kriterlere göre kısa değerlendirme
          </div>
          <div className="divide-y divide-neutral-200">
            {criteria.map((criterion, index) => (
              <div key={`${criterion.label}-${index}`} className="px-4 py-3">
                <div className="text-sm font-semibold text-neutral-900">{criterion.label}</div>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{criterion.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {vehicleNotes.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {vehicleNotes.map((vehicle) => (
            <div key={vehicle.id || vehicle.label} className="rounded-md border border-neutral-200 bg-white px-3 py-3">
              <div className="text-sm font-semibold text-neutral-950">{vehicle.label}</div>
              {vehicle.bestFor ? <p className="mt-1 text-xs leading-5 text-neutral-500">{vehicle.bestFor}</p> : null}
              {vehicle.strengths.length ? (
                <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-700">
                  {vehicle.strengths.map((strength) => <li key={strength}>+ {strength}</li>)}
                </ul>
              ) : null}
              {vehicle.weaknesses.length ? (
                <ul className="mt-2 space-y-1 text-xs leading-5 text-red-600">
                  {vehicle.weaknesses.map((weakness) => <li key={weakness}>- {weakness}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

    </section>
  );
}

function getComparisonStatusView(autoStatus: string, status: string | null, error: string | null) {
  if (error || autoStatus === "error") {
    return {
      icon: AlertCircle,
      iconClassName: "text-red-600",
      description: error || "Karşılaştırma kaydı hazırlanırken hata oluştu.",
    };
  }

  if (autoStatus === "waiting_for_auth") {
    return {
      icon: Clock3,
      iconClassName: "text-amber-600",
      description: "Karşılaştırma kaydını oluşturmak için giriş yapılması gerekiyor.",
    };
  }

  if (autoStatus === "syncing") {
    return {
      icon: Loader2,
      iconClassName: "animate-spin text-[#014636]",
      description: "Seçili araçlar için karşılaştırma kaydı hazırlanıyor.",
    };
  }

  if (status === "ready") {
    return {
      icon: CheckCircle2,
      iconClassName: "text-[#014636]",
      description: "Karşılaştırma özeti hazır.",
    };
  }

  if (status === "failed") {
    return {
      icon: AlertCircle,
      iconClassName: "text-red-600",
      description: "Karşılaştırma özeti oluşturulamadı. Kayıt korunuyor, tekrar denenebilir.",
    };
  }

  if (status === "generating") {
    return {
      icon: Loader2,
      iconClassName: "animate-spin text-[#014636]",
      description: "Karşılaştırma özeti hazırlanıyor.",
    };
  }

  if (status === "pending" || status === "stale") {
    return {
      icon: Clock3,
      iconClassName: "text-[#014636]",
      description: "Karşılaştırma kaydı hazır. Özet hazırlanmak üzere sıraya alındı.",
    };
  }

  return {
    icon: Clock3,
    iconClassName: "text-neutral-500",
    description: "İki veya üç araç seçildiğinde backend karşılaştırma kaydı otomatik oluşturulur.",
  };
}

type AiResultRecord = {
  missingDataWarnings?: unknown;
  criteria?: unknown;
  vehicles?: unknown;
};

type AiCriterion = {
  label: string;
  explanation: string;
};

type AiVehicleNote = {
  id: string;
  label: string;
  bestFor: string;
  strengths: string[];
  weaknesses: string[];
};

function getAiResult(detail: ComparisonDetail | null): AiResultRecord | null {
  if (!detail) return null;

  if (isRecord(detail.aiResult)) return detail.aiResult as AiResultRecord;

  if (isRecord(detail.activeAiReview) && isRecord(detail.activeAiReview.result)) {
    return detail.activeAiReview.result as AiResultRecord;
  }

  return null;
}

function getAiCriteria(result: AiResultRecord | null): AiCriterion[] {
  if (!Array.isArray(result?.criteria)) return [];

  return result.criteria.filter(isRecord).map((criterion) => ({
    label: getStringValue(criterion.label, "Kriter"),
    explanation: getStringValue(criterion.explanation, "Verilen araçlar bu kritere göre karşılaştırıldı."),
  }));
}

function getAiVehicleNotes(result: AiResultRecord | null): AiVehicleNote[] {
  if (!Array.isArray(result?.vehicles)) return [];

  return result.vehicles.filter(isRecord).map((vehicle) => ({
    id: getStringValue(vehicle.id, ""),
    label: getStringValue(vehicle.label, "Araç"),
    bestFor: getStringValue(vehicle.bestFor, ""),
    strengths: getAiStringArray(vehicle.strengths).slice(0, 2),
    weaknesses: getAiStringArray(vehicle.weaknesses).slice(0, 2),
  }));
}

function getAiStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function getStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
