import cars from "@/data/cars.json";
import type {
  Car,
  Priority,
  RecommendationCategory,
  RecommendationRequest,
  RecommendationResponse,
  RecommendedCar,
} from "@/lib/types";

type ScoreField =
  | "safetyScore"
  | "efficiencyScore"
  | "familyScore"
  | "comfortScore"
  | "performanceScore"
  | "resaleScore"
  | "cityScore"
  | "longTripScore"
  | "maintenanceScore"
  | "techScore";

const allCars = cars as Car[];

export const priorityLabels: Record<Priority, string> = {
  safety: "Güvenlik",
  economy: "Yakıt / enerji ekonomisi",
  family: "Aile kullanımı",
  comfort: "Konfor",
  performance: "Performans",
  resale: "İkinci el değeri",
  city: "Şehir içi pratiklik",
  longTrip: "Uzun yol",
  lowMaintenance: "Düşük bakım maliyeti",
  tech: "Teknoloji",
};

const priorityFields: Record<Priority, ScoreField> = {
  safety: "safetyScore",
  economy: "efficiencyScore",
  family: "familyScore",
  comfort: "comfortScore",
  performance: "performanceScore",
  resale: "resaleScore",
  city: "cityScore",
  longTrip: "longTripScore",
  lowMaintenance: "maintenanceScore",
  tech: "techScore",
};

const categoryConfigs: Record<
  RecommendationCategory,
  {
    title: string;
    description: string;
    priorities: Priority[];
  }
> = {
  bestFit: {
    title: "Sana en uygunlar",
    description: "Bütçe, filtreler ve seçtiğin önceliklerin en dengeli kesişimi.",
    priorities: [],
  },
  safeChoice: {
    title: "Güvenli seçim",
    description: "Güvenlik, güvenilirlik, bakım ve ikinci el tarafı daha kuvvetli adaylar.",
    priorities: ["safety", "lowMaintenance", "resale", "family"],
  },
  budgetSmart: {
    title: "Bütçe dostu akıllı seçim",
    description: "Satın alma fiyatı ve yıllık kullanım gideri daha rahat seçenekler.",
    priorities: ["economy", "lowMaintenance", "city", "resale"],
  },
  comfortTech: {
    title: "Konfor ve teknoloji",
    description: "Uzun yol, kabin konforu ve modern donanım isteyenlere yakın seçenekler.",
    priorities: ["comfort", "tech", "longTrip", "safety"],
  },
};

const defaultRequest: RecommendationRequest = {
  minPrice: 900000,
  maxPrice: 2200000,
  priorities: ["safety", "economy", "lowMaintenance"],
  bodyTypes: [],
  fuelTypes: [],
  transmission: "any",
  minSeats: 5,
};

export function normalizeRecommendationRequest(
  input: Partial<RecommendationRequest>,
): RecommendationRequest {
  const minPrice = clampNumber(input.minPrice, 0, 20000000, defaultRequest.minPrice);
  const maxPrice = clampNumber(input.maxPrice, minPrice, 20000000, defaultRequest.maxPrice);
  const minSeats = clampNumber(input.minSeats, 2, 9, defaultRequest.minSeats);

  return {
    minPrice,
    maxPrice,
    minSeats,
    priorities: sanitizeList(input.priorities, Object.keys(priorityLabels) as Priority[]),
    bodyTypes: sanitizeList(input.bodyTypes, [
      "hatchback",
      "sedan",
      "suv",
      "crossover",
      "station",
      "mpv",
    ]),
    fuelTypes: sanitizeList(input.fuelTypes, ["gasoline", "diesel", "hybrid", "electric"]),
    transmission:
      input.transmission === "manual" || input.transmission === "automatic"
        ? input.transmission
        : "any",
  };
}

export function buildRecommendations(
  rawRequest: Partial<RecommendationRequest>,
): RecommendationResponse {
  const request = normalizeRecommendationRequest(rawRequest);
  const filteredCars = allCars.filter((car) => matchesFilters(car, request));
  const priorityFallback = request.priorities.length
    ? request.priorities
    : defaultRequest.priorities;

  return {
    appliedFilters: request,
    totalMatches: filteredCars.length,
    sections: (Object.keys(categoryConfigs) as RecommendationCategory[]).map((id) => {
      const config = categoryConfigs[id];
      const categoryPriorities =
        id === "bestFit"
          ? priorityFallback
          : mergePriorities(priorityFallback, config.priorities);

      return {
        id,
        title: config.title,
        description: config.description,
        recommendations: rankCars(filteredCars, request, categoryPriorities, id).slice(0, 3),
      };
    }),
  };
}

function matchesFilters(car: Car, request: RecommendationRequest) {
  if (car.priceTry < request.minPrice || car.priceTry > request.maxPrice) return false;
  if (car.seats < request.minSeats) return false;
  if (request.bodyTypes.length > 0 && !request.bodyTypes.includes(car.bodyType)) return false;
  if (request.fuelTypes.length > 0 && !request.fuelTypes.includes(car.fuelType)) return false;
  if (request.transmission !== "any" && car.transmission !== request.transmission) return false;

  return true;
}

function rankCars(
  candidates: Car[],
  request: RecommendationRequest,
  priorities: Priority[],
  category: RecommendationCategory,
): RecommendedCar[] {
  return candidates
    .map((car) => {
      const priceScore = priceFitScore(car, request);
      const costScore = annualCostScore(car);
      const priorityScore = weightedPriorityScore(car, priorities);
      const reliabilityBoost = (car.reliabilityScore + car.maintenanceScore) / 20;
      const categoryBoost = getCategoryBoost(car, category);
      const rawScore =
        priceScore * 0.2 +
        costScore * 0.12 +
        priorityScore * 0.5 +
        reliabilityBoost * 0.1 +
        categoryBoost * 0.08;
      const score = Math.round(Math.min(98, Math.max(1, rawScore * 100)));

      return {
        car,
        score,
        confidenceLabel: score >= 88 ? "Çok güçlü eşleşme" : score >= 76 ? "Güçlü eşleşme" : "Makul eşleşme",
        reasons: buildReasons(car, request, priorities),
        tradeoffs: buildTradeoffs(car, priorities),
        matchedPriorities: priorities
          .filter((priority) => car[priorityFields[priority]] >= 8)
          .map((priority) => priorityLabels[priority])
          .slice(0, 4),
      };
    })
    .sort((a, b) => b.score - a.score || a.car.priceTry - b.car.priceTry);
}

function weightedPriorityScore(car: Car, priorities: Priority[]) {
  if (priorities.length === 0) return 0.72;

  const total = priorities.reduce((sum, priority) => sum + car[priorityFields[priority]], 0);
  return total / priorities.length / 10;
}

function priceFitScore(car: Car, request: RecommendationRequest) {
  const range = Math.max(1, request.maxPrice - request.minPrice);
  const position = (car.priceTry - request.minPrice) / range;
  const sweetSpot = 1 - Math.abs(position - 0.45);

  return Math.max(0.45, Math.min(1, sweetSpot));
}

function annualCostScore(car: Car) {
  const costs = allCars.map((item) => item.annualCostTry);
  const min = Math.min(...costs);
  const max = Math.max(...costs);

  return 1 - (car.annualCostTry - min) / (max - min);
}

function getCategoryBoost(car: Car, category: RecommendationCategory) {
  if (category === "safeChoice") {
    return (car.safetyScore + car.reliabilityScore + car.maintenanceScore + car.resaleScore) / 40;
  }

  if (category === "budgetSmart") {
    return (car.efficiencyScore + car.maintenanceScore + annualCostScore(car) * 10) / 30;
  }

  if (category === "comfortTech") {
    return (car.comfortScore + car.techScore + car.longTripScore) / 30;
  }

  return (car.reliabilityScore + car.resaleScore) / 20;
}

function buildReasons(car: Car, request: RecommendationRequest, priorities: Priority[]) {
  const priorityReasons = priorities
    .map((priority) => ({
      priority,
      label: priorityLabels[priority],
      score: car[priorityFields[priority]],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => `${item.label} önceliğinde ${item.score.toFixed(1)}/10 puan alıyor.`);

  const budgetReason =
    car.priceTry <= request.minPrice + (request.maxPrice - request.minPrice) * 0.6
      ? "Bütçe aralığının daha rahat tarafında kalıyor."
      : "Bütçe aralığına giriyor ama üst sınıra yakın duruyor.";

  return [budgetReason, ...priorityReasons, ...car.highlights].slice(0, 5);
}

function buildTradeoffs(car: Car, priorities: Priority[]) {
  const weakPriority = priorities.find((priority) => car[priorityFields[priority]] < 7.2);

  if (weakPriority) {
    return [
      `${priorityLabels[weakPriority]} senin için çok kritikse alternatifleri de karşılaştır.`,
      ...car.tradeoffs,
    ].slice(0, 3);
  }

  return car.tradeoffs.slice(0, 3);
}

function mergePriorities(primary: Priority[], secondary: Priority[]) {
  return Array.from(new Set([...primary, ...secondary])).slice(0, 6);
}

function sanitizeList<T extends string>(value: unknown, allowed: T[]) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is T => allowed.includes(item as T));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}
