"use client";

import type { RecommendedCar } from "@/lib/types";

const COMPARISON_KEY = "hangi_arac_comparison_items";
const COMPARISON_RESULT_KEY = "hangi_arac_comparison_result";

export const MAX_COMPARISON_ITEMS = 3;

export type StoredComparisonResult = {
  id: string;
  combinationKey: string;
  vehicleCount: number;
  status: string;
  jobId: string | null;
  vehicleIds: string[];
  updatedAt: string;
};

export function getComparisonItems(): RecommendedCar[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(COMPARISON_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getComparisonItemIds(): string[] {
  return getComparisonItems().map((item) => item.car.id);
}

export function getComparisonCanonicalKey(vehicleIds: string[]) {
  return Array.from(new Set(vehicleIds.filter(Boolean))).sort().join("|");
}

export function getStoredComparisonResult(): StoredComparisonResult | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(COMPARISON_RESULT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!isStoredComparisonResult(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function storeComparisonResult(result: StoredComparisonResult) {
  if (typeof window === "undefined") return;

  localStorage.setItem(COMPARISON_RESULT_KEY, JSON.stringify(result));
  window.dispatchEvent(new Event("hangi-arac-comparison-updated"));
}

export function clearStoredComparisonResult(emit = true) {
  if (typeof window === "undefined") return;

  localStorage.removeItem(COMPARISON_RESULT_KEY);
  if (emit) window.dispatchEvent(new Event("hangi-arac-comparison-updated"));
}

export function toggleComparisonItem(item: RecommendedCar) {
  const items = getComparisonItems();
  const exists = items.some((current) => current.car.id === item.car.id);

  if (exists) {
    const nextItems = items.filter((current) => current.car.id !== item.car.id);
    storeComparisonItems(nextItems);

    return {
      status: "removed" as const,
      isCompared: false,
      items: nextItems,
    };
  }

  if (items.length >= MAX_COMPARISON_ITEMS) {
    return {
      status: "limit" as const,
      isCompared: false,
      items,
    };
  }

  const nextItems = [item, ...items];

  storeComparisonItems(nextItems);

  return {
    status: "added" as const,
    isCompared: true,
    items: nextItems,
  };
}

export function removeComparisonItem(vehicleId: string) {
  const nextItems = getComparisonItems().filter((item) => item.car.id !== vehicleId);

  storeComparisonItems(nextItems);

  return nextItems;
}

export function clearComparisonItems() {
  storeComparisonItems([]);
}

function storeComparisonItems(items: RecommendedCar[]) {
  if (typeof window === "undefined") return;

  pruneStoredComparisonResult(items);
  localStorage.setItem(COMPARISON_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("hangi-arac-comparison-updated"));
}

function pruneStoredComparisonResult(items: RecommendedCar[]) {
  const storedResult = getStoredComparisonResult();

  if (!storedResult) return;

  const vehicleIds = items.map((item) => item.car.id);
  const nextKey = getComparisonCanonicalKey(vehicleIds);
  const storedKey = getComparisonCanonicalKey(storedResult.vehicleIds);

  if (vehicleIds.length < 2 || vehicleIds.length > MAX_COMPARISON_ITEMS || nextKey !== storedKey) {
    clearStoredComparisonResult(false);
  }
}

function isStoredComparisonResult(value: unknown): value is StoredComparisonResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<StoredComparisonResult>;

  return (
    typeof result.id === "string" &&
    typeof result.combinationKey === "string" &&
    typeof result.vehicleCount === "number" &&
    typeof result.status === "string" &&
    (typeof result.jobId === "string" || result.jobId === null) &&
    Array.isArray(result.vehicleIds) &&
    result.vehicleIds.every((vehicleId) => typeof vehicleId === "string") &&
    typeof result.updatedAt === "string"
  );
}
