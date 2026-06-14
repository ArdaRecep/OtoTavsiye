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
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#0d1511]">
      <section
        className="relative min-h-[420px] overflow-hidden bg-[#00261e] px-4 py-6 text-white sm:px-6 lg:px-10"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(0,28,22,0.94) 0%, rgba(0,28,22,0.78) 42%, rgba(0,28,22,0.25) 72%), url(${heroImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex h-full max-w-7xl flex-col justify-between gap-16">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Önerilere dön
          </Link>

          <div className="max-w-3xl pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              {formatYearRange(car)} / {car.segment} / {car.body_type}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-50/88">{car.trim_level}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailMetric icon={<WalletCards className="h-5 w-5" />} label="Piyasa fiyatı" value={formatPriceRange(car)} />
            <DetailMetric icon={<Fuel className="h-5 w-5" />} label="Yıllık gider" value={formatMoney(car.avg_annual_cost_try)} />
            <DetailMetric icon={<Gauge className="h-5 w-5" />} label="Güç" value={`${car.power_hp} hp`} />
            <DetailMetric icon={<ShieldCheck className="h-5 w-5" />} label="Güvenlik" value={`${formatScore(car.safety_score)}/10`} />
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Neden listede?</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{car.condition_summary}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {(whyListed.length ? whyListed : pros).map((highlight) => (
                <div key={highlight} className="flex gap-3 rounded-md bg-[#f3faf5] p-3 text-sm leading-6">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Puan profili</h2>
            <div className="mt-5 space-y-4">
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

        <aside className="space-y-5">
          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Teknik özet</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SpecRow label="Yakıt" value={car.fuel_type} />
              <SpecRow label="Şanzıman" value={car.transmission} />
              <SpecRow label="Koltuk" value={`${car.min_seats}+ kişi`} />
              <SpecRow label="Gövde" value={car.body_type} />
              <SpecRow label="Model yılı" value={formatYearRange(car)} />
              <SpecRow label="KM aralığı" value={formatKmRange(car)} />
            </dl>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <BadgeCheck className="h-5 w-5 text-[#014636]" />
              Güçlü taraflar
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
              {pros.map((pro) => (
                <li key={pro} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <CarFront className="h-5 w-5 text-[#014636]" />
              Dikkat noktaları
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
              {cons.map((con) => (
                <li key={con} className="flex gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

async function getVehicleProfile(id: string) {
  const supabase = createSupabaseServerClient();
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

function DetailMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[#014636]">{icon}</div>
      <div className="mt-3 text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-950">{value}</div>
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
      <div className="mt-2 h-2 rounded-full bg-neutral-200">
        <div className="h-2 rounded-full bg-[#014636]" style={{ width: `${Math.min(100, value * 10)}%` }} />
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
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
