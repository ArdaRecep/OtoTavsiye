export type BodyType =
  | "hatchback"
  | "sedan"
  | "suv"
  | "crossover"
  | "station"
  | "mpv";

export type FuelType = "gasoline" | "diesel" | "hybrid" | "electric";

export type Transmission = "manual" | "automatic";

export type Priority =
  | "safety"
  | "economy"
  | "family"
  | "comfort"
  | "performance"
  | "resale"
  | "city"
  | "longTrip"
  | "lowMaintenance"
  | "tech";

export type RecommendationCategory =
  | "bestFit"
  | "safeChoice"
  | "budgetSmart"
  | "comfortTech";

export interface Car {
  id: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  priceTry: number;
  segment: string;
  bodyType: BodyType;
  fuelType: FuelType;
  transmission: Transmission;
  seats: number;
  powerHp: number;
  annualCostTry: number;
  safetyScore: number;
  efficiencyScore: number;
  familyScore: number;
  comfortScore: number;
  performanceScore: number;
  resaleScore: number;
  cityScore: number;
  longTripScore: number;
  maintenanceScore: number;
  reliabilityScore: number;
  techScore: number;
  tags: string[];
  highlights: string[];
  tradeoffs: string[];
}

export interface RecommendationRequest {
  minPrice: number;
  maxPrice: number;
  priorities: Priority[];
  bodyTypes: BodyType[];
  fuelTypes: FuelType[];
  transmission: Transmission | "any";
  minSeats: number;
}

export interface RecommendedCar {
  car: Car;
  score: number;
  confidenceLabel: string;
  reasons: string[];
  tradeoffs: string[];
  matchedPriorities: string[];
}

export interface RecommendationSection {
  id: RecommendationCategory;
  title: string;
  description: string;
  recommendations: RecommendedCar[];
}

export interface RecommendationResponse {
  sections: RecommendationSection[];
  totalMatches: number;
  appliedFilters: RecommendationRequest;
}
