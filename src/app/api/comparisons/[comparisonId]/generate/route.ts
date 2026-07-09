import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import {
  buildComparisonSourceHash,
  generateGeminiComparison,
  getGeminiComparisonConfig,
  normalizeVehicleSnapshots,
} from "@/lib/comparisons/gemini";
import {
  comparisonRpcErrorResponse,
  normalizeComparisonDetail,
  type ComparisonStatus,
  type ComparisonDetailRpcRow,
  type JsonValue,
} from "@/lib/comparisons/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ comparisonId: string }>;
};

type ClaimComparisonGenerationRpcRow = {
  job_id: string;
  comparison_id: string;
  combination_key: string;
  vehicle_count: number;
  attempt_count: number;
  vehicles: JsonValue;
};

export async function POST(_request: Request, context: RouteContext) {
  let claimedJobId: string | null = null;

  try {
    await requireUser();
    const { comparisonId } = await context.params;

    if (!comparisonId) {
      return Response.json({ error: "comparisonId gerekli." }, { status: 400 });
    }

    const { apiKey, model, fallbackModels, promptVersion } = getGeminiComparisonConfig();

    if (!apiKey) {
      return Response.json({ error: "Karşılaştırma özeti servisi yapılandırılmamış." }, { status: 503 });
    }

    const serverSupabase = await createSupabaseServerClient();
    const currentComparison = await fetchComparisonDetail(serverSupabase, comparisonId);
    const adminSupabase = createSupabaseAdminClient();

    if (!currentComparison) {
      return Response.json({ error: "Karşılaştırma bulunamadı." }, { status: 404 });
    }

    if (currentComparison?.status === "ready") {
      return Response.json({ comparison: currentComparison, skipped: true });
    }

    const { data: claimData, error: claimError } = await adminSupabase.rpc("claim_vehicle_comparison_generation_by_id", {
      p_comparison_id: comparisonId,
      p_max_attempts: 8,
    });

    if (claimError) {
      const rpcResponse = comparisonRpcErrorResponse(claimError.message);
      if (rpcResponse) return rpcResponse;

      if (isMissingGeminiGenerationMigrationError(claimError.message)) {
        return Response.json(
          { error: "Karşılaştırma özeti SQL migrationı Supabase'de çalıştırılmalı." },
          { status: 503 },
        );
      }

      return Response.json({ error: "Karşılaştırma işi alınamadı." }, { status: 500 });
    }

    const claimRow = (Array.isArray(claimData) ? claimData[0] : claimData) as ClaimComparisonGenerationRpcRow | null;

    if (!claimRow) {
      const comparison = await fetchComparisonDetail(serverSupabase, comparisonId);

      return Response.json(
        {
          comparison,
          skipped: true,
        },
        { status: 202 },
      );
    }

    claimedJobId = claimRow.job_id;

    const vehicles = normalizeVehicleSnapshots(claimRow.vehicles);

    if (vehicles.length < 2 || vehicles.length > 3) {
      throw new Error("INVALID_VEHICLE_COUNT");
    }

    const sourceHash = buildComparisonSourceHash(vehicles, promptVersion);
    const generation = await generateGeminiComparison({
      apiKey,
      model,
      fallbackModels,
      promptVersion,
      vehicles,
    });
    const result = generation.result;

    await completeGeneration(adminSupabase, {
      jobId: claimedJobId,
      comparisonId,
      result,
      summary: result.summary,
      recommendation: result.recommendation,
      model: generation.model,
      promptVersion,
      sourceHash,
    });

    const comparison = await fetchComparisonDetail(serverSupabase, comparisonId);

    return Response.json({ comparison });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (claimedJobId) {
      await failGeneration(claimedJobId, error);
    }

    return Response.json({ error: "Karşılaştırma özeti oluşturulamadı." }, { status: 500 });
  }
}

async function fetchComparisonDetail(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, comparisonId: string) {
  const { data, error } = await supabase.rpc("get_vehicle_comparison_detail", {
    p_comparison_id: comparisonId,
  });

  if (error) {
    const rpcResponse = comparisonRpcErrorResponse(error.message);
    if (rpcResponse) throw new Error(error.message);

    throw new Error("COMPARISON_DETAIL_FAILED");
  }

  const row = Array.isArray(data) ? data[0] : data;

  return row ? normalizeComparisonDetail(row as ComparisonDetailRpcRow) : null;
}

async function failGeneration(jobId: string, error: unknown) {
  const adminSupabase = createSupabaseAdminClient();
  const message = error instanceof Error ? error.message : "GENERATION_FAILED";

  await adminSupabase.rpc("fail_vehicle_comparison_generation", {
    p_job_id: jobId,
    p_error: message,
    p_max_attempts: 8,
  });
}

async function completeGeneration(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    jobId,
    comparisonId,
    result,
    summary,
    recommendation,
    model,
    promptVersion,
    sourceHash,
  }: {
    jobId: string;
    comparisonId: string;
    result: JsonValue;
    summary: string;
    recommendation: string;
    model: string;
    promptVersion: string;
    sourceHash: string;
  },
) {
  const now = new Date().toISOString();

  const { error: deactivateError } = await supabase
    .from("vehicle_comparison_ai_reviews")
    .update({ is_active: false })
    .eq("comparison_id", comparisonId)
    .eq("is_active", true);

  if (deactivateError) throw new Error(deactivateError.message || "DEACTIVATE_AI_REVIEW_FAILED");

  const { error: reviewError } = await supabase.from("vehicle_comparison_ai_reviews").insert({
    comparison_id: comparisonId,
    provider: "gemini",
    model,
    prompt_version: promptVersion,
    source_hash: sourceHash,
    result,
    summary: normalizeNullableText(summary),
    recommendation: normalizeNullableText(recommendation),
    is_active: true,
    generated_at: now,
  });

  if (reviewError) throw new Error(reviewError.message || "INSERT_AI_REVIEW_FAILED");

  const { error: comparisonError } = await supabase
    .from("vehicle_comparisons")
    .update({
      status: "ready" satisfies ComparisonStatus,
      ai_result: result,
      ai_summary: normalizeNullableText(summary),
      ai_recommendation: normalizeNullableText(recommendation),
      ai_model: model,
      prompt_version: promptVersion,
      source_hash: sourceHash,
      generated_at: now,
      last_error: null,
    })
    .eq("id", comparisonId);

  if (comparisonError) throw new Error(comparisonError.message || "UPDATE_COMPARISON_FAILED");

  const { error: jobError } = await supabase
    .from("vehicle_comparison_generation_jobs")
    .update({
      status: "completed",
      completed_at: now,
      locked_at: null,
      last_error: null,
    })
    .eq("id", jobId);

  if (jobError) throw new Error(jobError.message || "COMPLETE_JOB_FAILED");
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function isMissingGeminiGenerationMigrationError(message?: string) {
  if (!message) return false;

  return (
    message.includes("claim_vehicle_comparison_generation_by_id") ||
    message.includes("complete_vehicle_comparison_generation_with_provider") ||
    message.includes("Could not find the function") ||
    message.includes("function") && message.includes("does not exist")
  );
}
