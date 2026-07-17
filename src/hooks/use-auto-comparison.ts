"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/auth/client-user";
import {
  getComparisonCanonicalKey,
  storeComparisonResult,
  type StoredComparisonResult,
} from "@/lib/compare-storage";
import type { RecommendedCar } from "@/lib/types";

type EnsureComparisonResponse = {
  comparison?: {
    id: string;
    combinationKey: string;
    vehicleCount: number;
    status: string;
    jobId: string | null;
  };
  error?: string;
};

type GenerateComparisonResponse = {
  comparison?: {
    id: string;
    status: string;
  };
  error?: string;
};

export type AutoComparisonStatus = "idle" | "waiting_for_auth" | "syncing" | "ready" | "error";

export type AutoComparisonState = {
  status: AutoComparisonStatus;
  comparison: StoredComparisonResult | null;
  error: string | null;
};

const initialState: AutoComparisonState = {
  status: "idle",
  comparison: null,
  error: null,
};

export function useAutoComparison(items: RecommendedCar[]): AutoComparisonState {
  const { userId, isLoading } = useCurrentUser();
  const [state, setState] = useState<AutoComparisonState>(initialState);
  const lastEnsuredKeyRef = useRef<string | null>(null);

  const vehicleIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.car.id).filter(Boolean))).sort(),
    [items],
  );
  const canonicalKey = useMemo(() => getComparisonCanonicalKey(vehicleIds), [vehicleIds]);
  const vehicleCount = vehicleIds.length;

  useEffect(() => {
    if (isLoading) return;

    if (vehicleCount < 2 || vehicleCount > 3) {
      lastEnsuredKeyRef.current = null;
      return;
    }

    if (!userId) {
      lastEnsuredKeyRef.current = null;
      return;
    }

    if (lastEnsuredKeyRef.current === canonicalKey) return;

    const requestVehicleIds = canonicalKey.split("|").filter(Boolean);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setState((current) => ({
        ...current,
        status: "syncing",
        error: null,
      }));

      try {
        const response = await fetch("/api/comparisons/ensure", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vehicleIds: requestVehicleIds }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as EnsureComparisonResponse;

        if (!response.ok || !payload.comparison) {
          throw new Error(payload.error || "Karşılaştırma kaydı oluşturulamadı.");
        }

        const storedComparison: StoredComparisonResult = {
          ...payload.comparison,
          vehicleIds: requestVehicleIds,
          updatedAt: new Date().toISOString(),
        };

        lastEnsuredKeyRef.current = canonicalKey;
        storeComparisonResult(storedComparison);

        const generatedComparison = await requestComparisonGeneration(storedComparison.id, controller.signal);
        const nextStoredComparison: StoredComparisonResult = {
          ...storedComparison,
          status: generatedComparison?.status ?? storedComparison.status,
          updatedAt: new Date().toISOString(),
        };

        storeComparisonResult(nextStoredComparison);
        setState({
          status: "ready",
          comparison: nextStoredComparison,
          error: null,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        lastEnsuredKeyRef.current = null;
        setState({
          status: "error",
          comparison: null,
          error: error instanceof Error ? error.message : "Karşılaştırma kaydı oluşturulamadı.",
        });
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [canonicalKey, isLoading, userId, vehicleCount]);

  if (!isLoading && (vehicleCount < 2 || vehicleCount > 3)) return initialState;
  if (!isLoading && !userId) {
    return { status: "waiting_for_auth", comparison: null, error: null };
  }

  return state;
}

async function requestComparisonGeneration(comparisonId: string, signal: AbortSignal) {
  const response = await fetch(`/api/comparisons/${comparisonId}/generate`, {
    method: "POST",
    credentials: "include",
    signal,
  });
  const payload = (await response.json()) as GenerateComparisonResponse;

  if (!response.ok) {
    throw new Error(payload.error || "Karşılaştırma özeti oluşturulamadı.");
  }

  return payload.comparison ?? null;
}
