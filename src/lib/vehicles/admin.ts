export const ADMIN_VEHICLE_SELECT = [
  "id",
  "make",
  "model",
  "trim_level",
  "segment",
  "body_type",
  "fuel_type",
  "transmission",
  "min_seats",
  "power_hp",
  "min_year",
  "max_year",
  "min_km",
  "max_km",
  "market_min_price",
  "market_max_price",
  "avg_annual_cost_try",
  "city_fuel_consumption",
  "highway_fuel_consumption",
  "condition_summary",
  "image_url",
  "tags",
  "why_listed",
  "pros",
  "cons",
  "safety_score",
  "efficiency_score",
  "family_score",
  "comfort_score",
  "performance_score",
  "youth_score",
  "resale_score",
  "city_score",
  "long_trip_score",
  "maintenance_score",
  "tech_score",
  "created_at",
  "updated_at",
].join(", ");

export type AdminVehicle = {
  id: string;
  make: string;
  model: string;
  trim_level: string;
  segment: string;
  body_type: "Hatchback" | "Sedan" | "Crossover" | "SUV";
  fuel_type: "Benzin" | "Dizel" | "Hibrit" | "Elektrik";
  transmission: "Manuel" | "Otomatik";
  min_seats: number;
  power_hp: number;
  min_year: number;
  max_year: number;
  min_km: number;
  max_km: number;
  market_min_price: number;
  market_max_price: number;
  avg_annual_cost_try: number;
  city_fuel_consumption: number | null;
  highway_fuel_consumption: number | null;
  condition_summary: string;
  image_url: string | null;
  tags: string[];
  why_listed: string[];
  pros: string[];
  cons: string[];
  safety_score: number;
  efficiency_score: number;
  family_score: number;
  comfort_score: number;
  performance_score: number;
  youth_score: number;
  resale_score: number;
  city_score: number;
  long_trip_score: number;
  maintenance_score: number;
  tech_score: number;
  created_at?: string;
  updated_at?: string;
};

type VehiclePayload = Omit<AdminVehicle, "created_at" | "updated_at">;

const bodyTypes = ["Hatchback", "Sedan", "Crossover", "SUV"] as const;
const fuelTypes = ["Benzin", "Dizel", "Hibrit", "Elektrik"] as const;
const transmissions = ["Manuel", "Otomatik"] as const;
const scoreKeys = [
  "safety_score",
  "efficiency_score",
  "family_score",
  "comfort_score",
  "performance_score",
  "youth_score",
  "resale_score",
  "city_score",
  "long_trip_score",
  "maintenance_score",
  "tech_score",
] as const;

export function parseAdminVehiclePayload(input: unknown, fixedId?: string) {
  if (!input || typeof input !== "object") {
    return { error: "Araç bilgileri gerekli.", vehicle: null } as const;
  }

  const raw = input as Record<string, unknown>;
  const make = requiredText(raw.make, 50);
  const model = requiredText(raw.model, 50);
  const trimLevel = requiredText(raw.trim_level, 100);
  const segment = requiredText(raw.segment, 30);
  const conditionSummary = requiredText(raw.condition_summary, 2000);

  if (!make || !model || !trimLevel || !segment || !conditionSummary) {
    return { error: "Marka, model, paket, segment ve kondisyon özeti zorunlu.", vehicle: null } as const;
  }

  if (!bodyTypes.includes(raw.body_type as (typeof bodyTypes)[number])) {
    return { error: "Geçersiz gövde tipi.", vehicle: null } as const;
  }
  if (!fuelTypes.includes(raw.fuel_type as (typeof fuelTypes)[number])) {
    return { error: "Geçersiz yakıt tipi.", vehicle: null } as const;
  }
  if (!transmissions.includes(raw.transmission as (typeof transmissions)[number])) {
    return { error: "Geçersiz şanzıman tipi.", vehicle: null } as const;
  }

  const numeric = {
    min_seats: integer(raw.min_seats),
    power_hp: integer(raw.power_hp),
    min_year: integer(raw.min_year),
    max_year: integer(raw.max_year),
    min_km: integer(raw.min_km),
    max_km: integer(raw.max_km),
    market_min_price: number(raw.market_min_price),
    market_max_price: number(raw.market_max_price),
    avg_annual_cost_try: number(raw.avg_annual_cost_try),
  };

  if (Object.values(numeric).some((value) => value === null || value < 0)) {
    return { error: "Sayısal araç bilgileri geçersiz.", vehicle: null } as const;
  }
  if (numeric.min_year! > numeric.max_year! || numeric.min_km! > numeric.max_km!) {
    return { error: "Yıl ve kilometre aralıklarını kontrol et.", vehicle: null } as const;
  }
  if (numeric.market_min_price! > numeric.market_max_price!) {
    return { error: "Minimum fiyat maksimum fiyattan büyük olamaz.", vehicle: null } as const;
  }

  const scores = {} as Record<(typeof scoreKeys)[number], number>;
  for (const key of scoreKeys) {
    const value = number(raw[key]);
    if (value === null || value < 0 || value > 10) {
      return { error: "Tüm puanlar 0 ile 10 arasında olmalı.", vehicle: null } as const;
    }
    scores[key] = Math.round(value * 10) / 10;
  }

  const id = fixedId || requiredText(raw.id, 50) || createVehicleId(make, model, trimLevel, numeric.min_year!);
  const cityConsumption = nullableNumber(raw.city_fuel_consumption);
  const highwayConsumption = nullableNumber(raw.highway_fuel_consumption);

  const vehicle: VehiclePayload = {
    id,
    make,
    model,
    trim_level: trimLevel,
    segment,
    body_type: raw.body_type as VehiclePayload["body_type"],
    fuel_type: raw.fuel_type as VehiclePayload["fuel_type"],
    transmission: raw.transmission as VehiclePayload["transmission"],
    min_seats: numeric.min_seats!,
    power_hp: numeric.power_hp!,
    min_year: numeric.min_year!,
    max_year: numeric.max_year!,
    min_km: numeric.min_km!,
    max_km: numeric.max_km!,
    market_min_price: numeric.market_min_price!,
    market_max_price: numeric.market_max_price!,
    avg_annual_cost_try: numeric.avg_annual_cost_try!,
    city_fuel_consumption: cityConsumption,
    highway_fuel_consumption: highwayConsumption,
    condition_summary: conditionSummary,
    image_url: optionalText(raw.image_url, 2000),
    tags: textArray(raw.tags),
    why_listed: textArray(raw.why_listed),
    pros: textArray(raw.pros),
    cons: textArray(raw.cons),
    ...scores,
  };

  return { error: null, vehicle } as const;
}

function requiredText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength: number) {
  const text = requiredText(value, maxLength);
  return text || null;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = number(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function textArray(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((item) => item.slice(0, 500));
}

function createVehicleId(make: string, model: string, trimLevel: string, minYear: number) {
  return `${make}-${model}-${trimLevel}-${minYear}`
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
