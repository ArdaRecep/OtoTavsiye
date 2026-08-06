import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CarFront,
  Check,
  Fuel,
  Gauge,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CommentSection } from "@/components/comment-section";
import { VehicleDetailActions } from "@/components/vehicle-social-actions";
import type { RecommendedCar } from "@/lib/types";


export const dynamic = "force-dynamic";

type VehicleProfileRow = {
  id: string;
  make: string;
  model: string;
  trim_level: string;
  segment: string;
  body_type: string;
  fuel_type: string;
  transmission: string;
  min_seats: number;
  power_hp: number;
  min_year: number;
  max_year: number;
  min_km: number;
  max_km: number;
  market_min_price: number | string;
  market_max_price: number | string;
  avg_annual_cost_try: number | string;
  condition_summary: string;
  image_url: string | null;
  tags: string[] | null;
  why_listed: string[] | null;
  pros: string[] | null;
  cons: string[] | null;
  safety_score: number | string;
  efficiency_score: number | string;
  family_score: number | string;
  comfort_score: number | string;
  performance_score: number | string;
  youth_score: number | string;
  resale_score: number | string;
  city_score: number | string;
  long_trip_score: number | string;
  maintenance_score: number | string;
  tech_score: number | string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const car = await getVehicleProfile(id);

  if (!car) {
    return {
      title: "Araç bulunamadı",
    };
  }

  return {
    title: `${car.make} ${car.model} | Araç Detayı`,
    description: `${car.trim_level} için piyasa fiyatı, teknik özellikler ve güçlü/zayıf taraflar.`,
  };
}

export default async function CarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const car = await getVehicleProfile(id);

  if (!car) notFound();

  const heroImage = car.image_url ?? fallbackImage;
  const whyListed = car.why_listed ?? [];
  const pros = car.pros ?? [];
  const cons = car.cons ?? [];
  const tags = car.tags ?? [];
  const actionItem = toRecommendedCar(car);

  return (
    <>
      <main>
      <section
        className="relative overflow-hidden bg-[#00261e] px-4 py-5 text-white sm:px-6 lg:px-10"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(0,28,22,0.94) 0%, rgba(0,28,22,0.78) 42%, rgba(0,28,22,0.25) 72%), url(${heroImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white/15"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Önerilere dön
          </Link>

          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100">
              {formatYearRange(car)} / {car.segment} / {car.body_type}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-emerald-50/88">{car.trim_level}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/20 bg-white/12 px-2.5 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
        <section className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <DetailMetric icon={<WalletCards className="h-4 w-4" />} label="Piyasa fiyatı" value={formatPriceRange(car)} />
            <DetailMetric icon={<Fuel className="h-4 w-4" />} label="Yıllık gider" value={formatMoney(car.avg_annual_cost_try)} />
            <DetailMetric icon={<Gauge className="h-4 w-4" />} label="Güç" value={`${car.power_hp} hp`} />
            <DetailMetric icon={<ShieldCheck className="h-4 w-4" />} label="Güvenlik" value={`${formatScore(car.safety_score)}/10`} />
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Neden listede?</h2>
            <p className="mt-2 text-sm leading-5 text-neutral-600">{car.condition_summary}</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {(whyListed.length ? whyListed : pros).map((highlight) => (
                <div key={highlight} className="flex gap-2 rounded-md bg-[#f3faf5] p-2.5 text-sm leading-5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Puan profili</h2>
            <div className="mt-3 space-y-2.5">
              <ScoreRow label="Güvenlik" value={Number(car.safety_score)} />
              <ScoreRow label="Ekonomi" value={Number(car.efficiency_score)} />
              <ScoreRow label="Aile" value={Number(car.family_score)} />
              <ScoreRow label="Konfor" value={Number(car.comfort_score)} />
              <ScoreRow label="Performans" value={Number(car.performance_score)} />
              <ScoreRow label="Genç" value={Number(car.youth_score)} />
              <ScoreRow label="Teknoloji" value={Number(car.tech_score)} />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <VehicleDetailActions item={actionItem} />

          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Teknik özet</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <SpecRow label="Yakıt" value={car.fuel_type} />
              <SpecRow label="Şanzıman" value={car.transmission} />
              <SpecRow label="Koltuk" value={`${car.min_seats}+ kişi`} />
              <SpecRow label="Gövde" value={car.body_type} />
              <SpecRow label="Model yılı" value={formatYearRange(car)} />
              <SpecRow label="KM aralığı" value={formatKmRange(car)} />
            </dl>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold">
              <BadgeCheck className="h-4 w-4 text-[#014636]" />
              Güçlü taraflar
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-neutral-700">
              {pros.map((pro) => (
                <li key={pro} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold">
              <CarFront className="h-4 w-4 text-[#014636]" />
              Dikkat noktaları
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-neutral-700">
              {cons.map((con) => (
                <li key={con} className="flex gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <CommentSection vehicleId={id} />
        </div>
      </div>
      </main>
    </>
  );
}

async function getVehicleProfile(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vehicle_market_profiles")
    .select(
      "id, make, model, trim_level, segment, body_type, fuel_type, transmission, min_seats, power_hp, min_year, max_year, min_km, max_km, market_min_price, market_max_price, avg_annual_cost_try, condition_summary, image_url, tags, why_listed, pros, cons, safety_score, efficiency_score, family_score, comfort_score, performance_score, youth_score, resale_score, city_score, long_trip_score, maintenance_score, tech_score",
    )
    .eq("id", id)
    .maybeSingle<VehicleProfileRow>();

  if (error) {
    throw new Error(`Araç detayı alınamadı: ${error.message}`);
  }

  return data;
}

function toRecommendedCar(car: VehicleProfileRow): RecommendedCar {
  return {
    car: {
      id: car.id,
      make: car.make,
      model: car.model,
      trimLevel: car.trim_level,
      segment: car.segment,
      powerHp: car.power_hp,
      minYear: car.min_year,
      maxYear: car.max_year,
      minKm: car.min_km,
      maxKm: car.max_km,
      marketMinPrice: Number(car.market_min_price),
      marketMaxPrice: Number(car.market_max_price),
      avgAnnualCostTry: Number(car.avg_annual_cost_try),
      conditionSummary: car.condition_summary,
      imageUrl: car.image_url,
      tags: car.tags ?? [],
      whyListed: car.why_listed ?? [],
      pros: car.pros ?? [],
      cons: car.cons ?? [],
      matchScore: null,
    },
    score: null,
    confidenceLabel: "Detay",
    reasons: car.why_listed ?? car.pros ?? [],
    tradeoffs: car.cons ?? [],
    matchedPriorities: [],
  };
}

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[#014636]">{icon}</div>
      <div className="mt-2 text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-base font-bold text-neutral-950">{value}</div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-neutral-500">{value.toFixed(1)}/10</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-neutral-200">
        <div className="h-1.5 rounded-full bg-[#014636]" style={{ width: `${Math.min(100, value * 10)}%` }} />
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-semibold text-neutral-950">{value}</dd>
    </div>
  );
}

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatPriceRange(car: VehicleProfileRow) {
  return `${formatMoney(car.market_min_price)} - ${formatMoney(car.market_max_price)}`;
}

function formatYearRange(car: VehicleProfileRow) {
  return car.min_year === car.max_year ? `${car.min_year}` : `${car.min_year}-${car.max_year}`;
}

function formatKmRange(car: VehicleProfileRow) {
  const formatter = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  });

  return `${formatter.format(car.min_km)} - ${formatter.format(car.max_km)} km`;
}

function formatScore(value: number | string) {
  return Number(value).toFixed(1);
}
