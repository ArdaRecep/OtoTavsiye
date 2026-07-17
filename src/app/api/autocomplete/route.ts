import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

type AutocompleteRow = {
  body_type: string;
  make: string;
  model: string;
  trim_level: string;
  fuel_type: string;
};

export async function GET(request: NextRequest) {
  try {
    const query = normalizeSearchTerm(request.nextUrl.searchParams.get("q"));

    if (!query || query.length < 2) {
      return Response.json({ suggestions: [], categories: [] });
    }

    const supabase = await createSupabaseServerClient();
    const searchTerms = query.split(" ").filter(Boolean).slice(0, 5);
    let autocompleteQuery = supabase
      .from("vehicle_market_profiles")
      .select("body_type, make, model, trim_level, fuel_type");

    for (const term of searchTerms) {
      const searchPattern = escapeIlike(term);
      autocompleteQuery = autocompleteQuery.or(
        [
          `body_type.ilike.%${searchPattern}%`,
          `make.ilike.%${searchPattern}%`,
          `model.ilike.%${searchPattern}%`,
          `trim_level.ilike.%${searchPattern}%`,
          `fuel_type.ilike.%${searchPattern}%`,
        ].join(","),
      );
    }

    const { data, error } = await autocompleteQuery
      .order("make", { ascending: true })
      .order("model", { ascending: true })
      .limit(30);

    if (error) {
      console.error("Autocomplete Error:", error);
      return Response.json({ error: "Öneriler alınamadı." }, { status: 500 });
    }

    const rows = (data ?? []) as AutocompleteRow[];
    const suggestions = unique(
      rows.map((row) => `${row.make} ${row.model} ${row.trim_level}`),
    ).slice(0, 6);
    const categories = unique(
      rows.map((row) => `${row.body_type} > ${row.make} > ${row.model} > ${row.trim_level}`),
    ).slice(0, 5);

    return Response.json({ suggestions, categories });
  } catch (err: unknown) {
    console.error("Autocomplete Error:", err);
    return Response.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

function normalizeSearchTerm(value: string | null) {
  if (!value) return "";

  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
