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

export type AracOnerRow = {
  id: string;
  make: string;
  model: string;
  trim_level: string;
  segment: string;
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
  match_score: number | string;
};

export type AracOnerArgs = {
  p_min_budget: number;
  p_max_budget: number;
  p_body_type?: string | null;
  p_fuel_type?: string | null;
  p_transmission?: string | null;
  p_min_seats?: number | null;
  w_safety?: number;
  w_efficiency?: number;
  w_family?: number;
  w_comfort?: number;
  w_performance?: number;
  w_youth?: number;
  w_resale?: number;
  w_city?: number;
  w_long_trip?: number;
  w_maintenance?: number;
  w_tech?: number;
};

type AracOnerWeightKey =
  | "w_safety"
  | "w_efficiency"
  | "w_family"
  | "w_comfort"
  | "w_performance"
  | "w_youth"
  | "w_resale"
  | "w_city"
  | "w_long_trip"
  | "w_maintenance"
  | "w_tech";

export type RawRecommendationRequest = Partial<Omit<RecommendationRequest, "priorities">> & {
  priorities?: Priority[] | Partial<Record<Priority | "efficiency" | "maintenance" | "long_trip", number>>;
  bodyType?: BodyType;
  fuelType?: FuelType;
};

const bodyTypeLabels: Partial<Record<BodyType, string>> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  crossover: "Crossover",
  suv: "SUV",
};

const fuelTypeLabels: Record<FuelType, string> = {
  gasoline: "Benzin",
  diesel: "Dizel",
  hybrid: "Hibrit",
  electric: "Elektrik",
};

const transmissionLabels: Record<Transmission, string> = {
  manual: "Manuel",
  automatic: "Otomatik",
};

const priorityRpcWeights: Record<Priority, AracOnerWeightKey> = {
  safety: "w_safety",
  economy: "w_efficiency",
  family: "w_family",
  comfort: "w_comfort",
  performance: "w_performance",
  youth: "w_youth",
  resale: "w_resale",
  city: "w_city",
  longTrip: "w_long_trip",
  lowMaintenance: "w_maintenance",
  tech: "w_tech",
};

const objectPriorityAliases: Record<string, Priority> = {
  efficiency: "economy",
  maintenance: "lowMaintenance",
  long_trip: "longTrip",
};

export function normalizeRecommendationRequest(input: RawRecommendationRequest): RecommendationRequest {
  const minBudget = parseRequiredBudget(input.minBudget ?? input.minPrice, "minBudget");
  const maxBudget = parseRequiredBudget(input.maxBudget ?? input.maxPrice, "maxBudget");

  if (maxBudget < minBudget) {
    throw new Error("maxBudget, minBudget degerinden kucuk olamaz.");
  }

  return {
    minPrice: minBudget,
    maxPrice: maxBudget,
    minBudget,
    maxBudget,
    priorities: normalizePriorities(input.priorities),
    bodyTypes: normalizeSingleSelection(input.bodyTypes, input.bodyType, Object.keys(bodyTypeLabels) as BodyType[]),
    fuelTypes: normalizeSingleSelection(input.fuelTypes, input.fuelType, Object.keys(fuelTypeLabels) as FuelType[]),
    transmission:
      input.transmission === "manual" || input.transmission === "automatic" ? input.transmission : "any",
    minSeats: normalizeOptionalSeats(input.minSeats),
  };
}

export function buildAracOnerArgs(request: RecommendationRequest): AracOnerArgs {
  const args: AracOnerArgs = {
    p_min_budget: request.minPrice,
    p_max_budget: request.maxPrice,
  };

  const bodyType = request.bodyTypes[0];
  const fuelType = request.fuelTypes[0];

  if (bodyType && bodyTypeLabels[bodyType]) args.p_body_type = bodyTypeLabels[bodyType];
  if (fuelType) args.p_fuel_type = fuelTypeLabels[fuelType];
  if (request.transmission !== "any") args.p_transmission = transmissionLabels[request.transmission];
  if (request.minSeats > 0) args.p_min_seats = request.minSeats;

  request.priorities.forEach((priority) => {
    args[priorityRpcWeights[priority]] = 1;
  });

  return args;
}

export function buildRecommendationResponse(
  rows: AracOnerRow[],
  appliedFilters: RecommendationRequest,
): RecommendationResponse {
  return {
    appliedFilters,
    totalMatches: rows.length,
    recommendations: rows.map(mapAracOnerRow),
  };
}

function mapAracOnerRow(row: AracOnerRow): RecommendedCar {
  const vehicle: RecommendedVehicle = {
    id: row.id,
    make: row.make,
    model: row.model,
    trimLevel: row.trim_level,
    segment: row.segment,
    powerHp: Number(row.power_hp),
    minYear: Number(row.min_year),
    maxYear: Number(row.max_year),
    minKm: Number(row.min_km),
    maxKm: Number(row.max_km),
    marketMinPrice: Number(row.market_min_price),
    marketMaxPrice: Number(row.market_max_price),
    avgAnnualCostTry: Number(row.avg_annual_cost_try),
    conditionSummary: row.condition_summary,
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    whyListed: row.why_listed ?? [],
    pros: row.pros ?? [],
    cons: row.cons ?? [],
    matchScore: Number(row.match_score),
  };
  const score = Math.round(vehicle.matchScore);

  return {
    car: vehicle,
    score,
    confidenceLabel: score >= 88 ? "Cok guclu eslesme" : score >= 76 ? "Guclu eslesme" : "Makul eslesme",
    reasons: vehicle.whyListed.length ? vehicle.whyListed : [vehicle.conditionSummary],
    tradeoffs: vehicle.cons,
    matchedPriorities: vehicle.tags,
  };
}

function normalizePriorities(rawPriorities: RawRecommendationRequest["priorities"]) {
  if (Array.isArray(rawPriorities)) {
    return rawPriorities.filter(isPriority);
  }

  if (!rawPriorities || typeof rawPriorities !== "object") return [];

  return Object.entries(rawPriorities).reduce<Priority[]>((selected, [key, value]) => {
    const priority = objectPriorityAliases[key] ?? key;

    if (isPriority(priority) && Number(value) > 0) selected.push(priority);

    return selected;
  }, []);
}

function normalizeSingleSelection<T extends string>(
  listValue: T[] | undefined,
  singleValue: T | undefined,
  allowedValues: T[],
) {
  const selected = singleValue ?? listValue?.[0];

  return selected && allowedValues.includes(selected) ? [selected] : [];
}

function normalizeOptionalSeats(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0;
}

function parseRequiredBudget(value: unknown, label: "minBudget" | "maxBudget") {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} zorunludur.`);
  }

  return Math.round(numberValue);
}

function isPriority(value: unknown): value is Priority {
  return (
    value === "safety" ||
    value === "economy" ||
    value === "family" ||
    value === "comfort" ||
    value === "performance" ||
    value === "youth" ||
    value === "resale" ||
    value === "city" ||
    value === "longTrip" ||
    value === "lowMaintenance" ||
    value === "tech"
  );
}
