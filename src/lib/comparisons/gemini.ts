import { createHash } from "crypto";
import type { JsonValue } from "./types";

export type ComparisonVehicleSnapshot = {
  id: string;
  make: string;
  model: string;
  trimLevel: string | null;
  segment: string | null;
  bodyType: string | null;
  fuelType: string | null;
  transmission: string | null;
  minSeats: number | null;
  powerHp: number | null;
  minYear: number | null;
  maxYear: number | null;
  minKm: number | null;
  maxKm: number | null;
  marketMinPrice: number | null;
  marketMaxPrice: number | null;
  avgAnnualCostTry: number | null;
  conditionSummary: string | null;
  tags: string[];
  whyListed: string[];
  pros: string[];
  cons: string[];
  canonicalPosition: number;
};

export type GeminiComparisonResult = {
  headline: string;
  summary: string;
  recommendation: string;
  vehicles: {
    id: string;
    label: string;
    strengths: string[];
    weaknesses: string[];
    bestFor: string;
    riskNotes: string[];
  }[];
  criteria: {
    label: string;
    winnerVehicleId: string | null;
    explanation: string;
  }[];
  missingDataWarnings: string[];
};

type GeminiGenerateContentResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 15000;

export function getGeminiComparisonConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-flash-lite-latest,gemini-2.0-flash-lite")
    .split(",")
    .map((fallbackModel) => fallbackModel.trim())
    .filter(Boolean)
    .filter((fallbackModel) => fallbackModel !== model);
  const promptVersion = process.env.COMPARISON_PROMPT_VERSION || "gemini-v2";

  return { apiKey, model, fallbackModels, promptVersion };
}

export function normalizeVehicleSnapshots(value: JsonValue): ComparisonVehicleSnapshot[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const vehicle = isRecord(item) ? item : {};

    return {
      id: toStringValue(vehicle.id),
      make: toStringValue(vehicle.make),
      model: toStringValue(vehicle.model),
      trimLevel: toNullableString(vehicle.trimLevel),
      segment: toNullableString(vehicle.segment),
      bodyType: toNullableString(vehicle.bodyType),
      fuelType: toNullableString(vehicle.fuelType),
      transmission: toNullableString(vehicle.transmission),
      minSeats: toNullableNumber(vehicle.minSeats),
      powerHp: toNullableNumber(vehicle.powerHp),
      minYear: toNullableNumber(vehicle.minYear),
      maxYear: toNullableNumber(vehicle.maxYear),
      minKm: toNullableNumber(vehicle.minKm),
      maxKm: toNullableNumber(vehicle.maxKm),
      marketMinPrice: toNullableNumber(vehicle.marketMinPrice),
      marketMaxPrice: toNullableNumber(vehicle.marketMaxPrice),
      avgAnnualCostTry: toNullableNumber(vehicle.avgAnnualCostTry),
      conditionSummary: toNullableString(vehicle.conditionSummary),
      tags: toStringArray(vehicle.tags),
      whyListed: toStringArray(vehicle.whyListed),
      pros: toStringArray(vehicle.pros),
      cons: toStringArray(vehicle.cons),
      canonicalPosition: toNullableNumber(vehicle.canonicalPosition) ?? index + 1,
    };
  });
}

export function buildComparisonSourceHash(vehicles: ComparisonVehicleSnapshot[], promptVersion: string) {
  const source = JSON.stringify({
    promptVersion,
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      trimLevel: vehicle.trimLevel,
      segment: vehicle.segment,
      bodyType: vehicle.bodyType,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      minSeats: vehicle.minSeats,
      powerHp: vehicle.powerHp,
      minYear: vehicle.minYear,
      maxYear: vehicle.maxYear,
      minKm: vehicle.minKm,
      maxKm: vehicle.maxKm,
      marketMinPrice: vehicle.marketMinPrice,
      marketMaxPrice: vehicle.marketMaxPrice,
      avgAnnualCostTry: vehicle.avgAnnualCostTry,
      conditionSummary: vehicle.conditionSummary,
      tags: vehicle.tags,
      whyListed: vehicle.whyListed,
      pros: vehicle.pros,
      cons: vehicle.cons,
    })),
  });

  return createHash("sha256").update(source).digest("hex");
}

export async function generateGeminiComparison({
  apiKey,
  model,
  fallbackModels = [],
  promptVersion,
  vehicles,
}: {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  promptVersion: string;
  vehicles: ComparisonVehicleSnapshot[];
}) {
  let lastError: unknown = null;

  for (const candidateModel of [model, ...fallbackModels]) {
    try {
      return {
        model: candidateModel,
        result: await requestGeminiComparison({
          apiKey,
          model: candidateModel,
          promptVersion,
          vehicles,
        }),
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini karsilastirma istegi basarisiz oldu.");
}

async function requestGeminiComparison({
  apiKey,
  model,
  promptVersion,
  vehicles,
}: {
  apiKey: string;
  model: string;
  promptVersion: string;
  vehicles: ComparisonVehicleSnapshot[];
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildGeminiPrompt(vehicles, promptVersion) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1100,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | { error?: unknown } | null;

    if (!response.ok) {
      throw new GeminiRequestError("Gemini karsilastirma istegi basarisiz oldu.", response.status);
    }

    const text = extractGeminiText(payload);
    const parsed = parseJsonObject(text);

    return validateGeminiComparisonResult(parsed);
  } finally {
    clearTimeout(timeoutId);
  }
}

class GeminiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isRetryableGeminiError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
    ? false
    : error instanceof GeminiRequestError && [429, 500, 502, 503, 504].includes(error.status);
}

function buildGeminiPrompt(vehicles: ComparisonVehicleSnapshot[], promptVersion: string) {
  return [
    "Sen OtoTavsiye icin Turkce arac karsilastirma analisti olarak calisiyorsun.",
    "Yalnizca verilen arac ozelliklerini kullan. Bilinmeyen veya veride olmayan teknik iddialar ekleme.",
    "summary 2-3 cumle olsun; araclarin karakterini, gunluk kullanim hissini, masraf/performans dengesini ve belirgin ayrimlarini renkli ama abartisiz anlat.",
    "recommendation 2-3 cumle olsun; hangi kullanici tipi icin hangi arac daha mantikli, hangi durumda diger secenek tercih edilir ve son karar nasil verilmeli net soyle.",
    "summary ve recommendation dogal, akici ve kullaniciya yol gosteren bir dille yazilsin; emoji, markdown ve yapay zeka ifadesi kullanma.",
    "Her arac icin strengths, weaknesses ve riskNotes alanlari en fazla 2 madde olsun.",
    "criteria en fazla 4 madde olsun. Her explanation tek cumle olsun.",
    "Cevabi sadece gecerli JSON olarak dondur. Markdown, kod blogu veya aciklama ekleme.",
    `Prompt version: ${promptVersion}`,
    "JSON semasi:",
    JSON.stringify({
      headline: "Kisa karsilastirma basligi",
      summary: "Araclarin temel farklarini, kullanim hissini ve one cikan ayrimlarini anlatan 2-3 cumlelik metin",
      recommendation: "Kullanici tiplerine gore net tercih yonlendirmesi yapan 2-3 cumlelik tavsiye",
      vehicles: [
        {
          id: "vehicle-id",
          label: "Marka Model",
          strengths: ["Guclu yon, kisa"],
          weaknesses: ["Zayif yon, kisa"],
          bestFor: "En uygun kullanim tipi",
          riskNotes: ["Dikkat noktasi, kisa"],
        },
      ],
      criteria: [
        {
          label: "Fiyat / gider / performans / aile / sehir ici gibi kriter",
          winnerVehicleId: "vehicle-id veya null",
          explanation: "Kisa gerekce",
        },
      ],
      missingDataWarnings: ["Eksik veri varsa kisa uyari"],
    }),
    "Arac verileri:",
    JSON.stringify(vehicles),
  ].join("\n\n");
}

function extractGeminiText(payload: GeminiGenerateContentResponse | { error?: unknown } | null) {
  if (!payload || !("candidates" in payload)) {
    throw new Error("Gemini bos cevap verdi.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

  if (!text) {
    throw new Error("Gemini bos cevap verdi.");
  }

  return text;
}

function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!isRecord(parsed)) throw new Error("Gemini JSON nesnesi bekleniyordu.");

    return parsed;
  } catch {
    throw new Error("Gemini gecerli JSON dondurmedi.");
  }
}

function validateGeminiComparisonResult(value: Record<string, unknown>): GeminiComparisonResult {
  const result: GeminiComparisonResult = {
    headline: normalizeText(value.headline, "Karşılaştırma özeti"),
    summary: truncateText(normalizeText(value.summary, "Araçlar verilen teknik ve piyasa verilerine göre karşılaştırıldı."), 650),
    recommendation: truncateText(normalizeText(value.recommendation, "Seçim kullanım önceliklerine göre yapılmalıdır."), 600),
    vehicles: normalizeVehicleResults(value.vehicles),
    criteria: normalizeCriteria(value.criteria),
    missingDataWarnings: toStringArray(value.missingDataWarnings).slice(0, 3),
  };

  if (!result.vehicles.length || !result.criteria.length) {
    throw new Error("Gemini eksik karsilastirma JSON'u dondurdu.");
  }

  return result;
}

function normalizeVehicleResults(value: unknown): GeminiComparisonResult["vehicles"] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((vehicle) => ({
    id: toStringValue(vehicle.id),
    label: normalizeText(vehicle.label, "Araç"),
    strengths: toStringArray(vehicle.strengths).slice(0, 2),
    weaknesses: toStringArray(vehicle.weaknesses).slice(0, 2),
    bestFor: truncateText(normalizeText(vehicle.bestFor, "Genel kullanım"), 140),
    riskNotes: toStringArray(vehicle.riskNotes).slice(0, 2),
  }));
}

function normalizeCriteria(value: unknown): GeminiComparisonResult["criteria"] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).slice(0, 4).map((criterion) => ({
    label: normalizeText(criterion.label, "Kriter"),
    winnerVehicleId: typeof criterion.winnerVehicleId === "string" && criterion.winnerVehicleId.trim()
      ? criterion.winnerVehicleId.trim()
      : null,
    explanation: truncateText(normalizeText(criterion.explanation, "Verilen araçlar bu kritere göre karşılaştırıldı."), 180),
  }));
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
