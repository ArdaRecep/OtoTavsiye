"use client";

import type { RecommendedCar } from "@/lib/types";

const COMPARISON_KEY = "hangi_arac_comparison_items";
export const MAX_COMPARISON_ITEMS = 4;

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
  localStorage.setItem(COMPARISON_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("hangi-arac-comparison-updated"));
}
