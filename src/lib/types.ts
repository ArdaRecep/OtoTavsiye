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
  | "youth"
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
  minBudget?: number;
  maxBudget?: number;
  priorities: Priority[];
  bodyTypes: BodyType[];
  fuelTypes: FuelType[];
  transmission: Transmission | "any";
  minSeats: number;
}

export interface RecommendedVehicle {
  id: string;
  make: string;
  model: string;
  trimLevel: string;
  segment: string;
  powerHp: number;
  minYear: number;
  maxYear: number;
  minKm: number;
  maxKm: number;
  marketMinPrice: number;
  marketMaxPrice: number;
  avgAnnualCostTry: number;
  conditionSummary: string;
  imageUrl: string | null;
  tags: string[];
  whyListed: string[];
  pros: string[];
  cons: string[];
  matchScore: number;
}

export interface RecommendedCar {
  car: RecommendedVehicle;
  score: number;
  confidenceLabel: string;
  reasons: string[];
  tradeoffs: string[];
  matchedPriorities: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendedCar[];
  totalMatches: number;
  appliedFilters: RecommendationRequest;
}
