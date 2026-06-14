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
import cars from "@/data/cars.json";
import type { BodyType, Car, FuelType, Transmission } from "@/lib/types";

const allCars = cars as Car[];

const carImages = {
  electric:
    "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1600&q=80",
  suv: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1600&q=80",
  sedan:
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=80",
  hatchback:
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80",
  crossover:
    "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=80",
  default:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return allCars.map((car) => ({ id: car.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const car = getCar(id);

  if (!car) {
    return {
      title: "Araç bulunamadı",
    };
  }

  return {
    title: `${car.make} ${car.model} | Araç Detayı`,
    description: `${car.trim} için fiyat, teknik özellikler, güçlü yanlar ve dikkat edilmesi gerekenler.`,
  };
}

export default async function CarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const car = getCar(id);

  if (!car) notFound();

  const heroImage = getCarImage(car);

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
              {car.year} / {car.segment} / {bodyTypeLabel(car.bodyType)}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-50/88">{car.trim}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {car.tags.map((tag) => (
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
            <DetailMetric icon={<WalletCards className="h-5 w-5" />} label="Fiyat" value={formatMoney(car.priceTry)} />
            <DetailMetric icon={<Fuel className="h-5 w-5" />} label="Yıllık gider" value={formatMoney(car.annualCostTry)} />
            <DetailMetric icon={<Gauge className="h-5 w-5" />} label="Güç" value={`${car.powerHp} hp`} />
            <DetailMetric icon={<ShieldCheck className="h-5 w-5" />} label="Güvenlik" value={`${car.safetyScore}/10`} />
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Neden listede?</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {car.highlights.map((highlight) => (
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
              <ScoreRow label="Güvenlik" value={car.safetyScore} />
              <ScoreRow label="Ekonomi" value={car.efficiencyScore} />
              <ScoreRow label="Aile" value={car.familyScore} />
              <ScoreRow label="Konfor" value={car.comfortScore} />
              <ScoreRow label="Performans" value={car.performanceScore} />
              <ScoreRow label="Teknoloji" value={car.techScore} />
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Teknik özet</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SpecRow label="Yakıt" value={fuelLabel(car.fuelType)} />
              <SpecRow label="Şanzıman" value={transmissionLabel(car.transmission)} />
              <SpecRow label="Koltuk" value={`${car.seats} kişi`} />
              <SpecRow label="Gövde" value={bodyTypeLabel(car.bodyType)} />
              <SpecRow label="İkinci el" value={`${car.resaleScore}/10`} />
              <SpecRow label="Bakım" value={`${car.maintenanceScore}/10`} />
            </dl>
          </div>

          <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <BadgeCheck className="h-5 w-5 text-[#014636]" />
              Güçlü taraflar
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
              {car.highlights.slice(0, 3).map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#014636]" />
                  <span>{highlight}</span>
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
              {car.tradeoffs.map((tradeoff) => (
                <li key={tradeoff} className="flex gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span>{tradeoff}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function getCar(id: string) {
  return allCars.find((car) => car.id === id);
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

function getCarImage(car: Car) {
  if (car.fuelType === "electric") return carImages.electric;
  if (car.bodyType === "suv") return carImages.suv;
  if (car.bodyType === "crossover") return carImages.crossover;
  if (car.bodyType === "sedan") return carImages.sedan;
  if (car.bodyType === "hatchback") return carImages.hatchback;

  return carImages.default;
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

function transmissionLabel(value: Transmission) {
  const labels: Record<Transmission, string> = {
    automatic: "Otomatik",
    manual: "Manuel",
  };

  return labels[value];
}

function bodyTypeLabel(value: BodyType) {
  const labels: Record<BodyType, string> = {
    hatchback: "Hatchback",
    sedan: "Sedan",
    suv: "SUV",
    crossover: "Crossover",
    station: "Station",
    mpv: "MPV",
  };

  return labels[value];
}
