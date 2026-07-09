export type ComparisonStatus = "pending" | "generating" | "ready" | "failed" | "stale" | "disabled";

export type GenerationJobStatus = "queued" | "processing" | "completed" | "failed";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EnsureComparisonRpcRow = {
  comparison_id: string;
  combination_key: string;
  vehicle_count: number;
  status: ComparisonStatus;
  job_id: string | null;
};

export type ComparisonDetailRpcRow = {
  comparison_id: string;
  combination_key: string;
  vehicle_count: number;
  status: ComparisonStatus;
  ai_result: JsonValue | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  ai_model: string | null;
  prompt_version: string;
  source_hash: string | null;
  generation_attempts: number;
  generation_started_at: string | null;
  generated_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  vehicles: JsonValue;
  active_ai_review: JsonValue | null;
};

export type ComparisonCommentRpcRow = {
  id: string;
  comparison_id: string;
  parent_id: string | null;
  root_id: string;
  user_id: string;
  body: string;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author_username: string;
  author_avatar_url: string | null;
  like_count?: number | null;
  dislike_count?: number | null;
  current_user_reaction?: "like" | "dislike" | null;
  reply_count?: number | null;
  author_car_rating?: number | null;
};

export function normalizeEnsureComparison(row: EnsureComparisonRpcRow) {
  return {
    id: row.comparison_id,
    combinationKey: row.combination_key,
    vehicleCount: Number(row.vehicle_count),
    status: row.status,
    jobId: row.job_id,
  };
}

export function normalizeComparisonDetail(row: ComparisonDetailRpcRow) {
  return {
    id: row.comparison_id,
    combinationKey: row.combination_key,
    vehicleCount: Number(row.vehicle_count),
    status: row.status,
    aiResult: row.ai_result,
    aiSummary: row.ai_summary,
    aiRecommendation: row.ai_recommendation,
    aiModel: row.ai_model,
    promptVersion: row.prompt_version,
    sourceHash: row.source_hash,
    generationAttempts: Number(row.generation_attempts),
    generationStartedAt: row.generation_started_at,
    generatedAt: row.generated_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles : [],
    activeAiReview: row.active_ai_review,
  };
}

export function normalizeComparisonComment(row: ComparisonCommentRpcRow) {
  return {
    id: row.id,
    comparisonId: row.comparison_id,
    parentId: row.parent_id,
    rootId: row.root_id,
    userId: row.user_id,
    body: row.body,
    depth: Number(row.depth),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    author: {
      username: row.author_username,
      avatarUrl: row.author_avatar_url,
    },
    likeCount: Number(row.like_count ?? 0),
    dislikeCount: Number(row.dislike_count ?? 0),
    userInteraction: row.current_user_reaction ?? null,
    replyCount: Number(row.reply_count ?? 0),
    authorCarRating: row.author_car_rating === null || row.author_car_rating === undefined ? null : Number(row.author_car_rating),
  };
}

export function comparisonRpcErrorResponse(message?: string) {
  if (!message) return null;

  if (message.includes("AUTH_REQUIRED")) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  if (
    message.includes("INVALID_VEHICLE_COUNT") ||
    message.includes("INVALID_COMPARISON_COMMENT_LENGTH") ||
    message.includes("INVALID_COMPARISON_COMMENT_REACTION_TYPE") ||
    message.includes("MAX_COMPARISON_COMMENT_DEPTH_EXCEEDED") ||
    message.includes("INVALID_COMPARISON_COMMENT_PARENT")
  ) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (
    message.includes("VEHICLE_NOT_FOUND") ||
    message.includes("COMPARISON_NOT_FOUND") ||
    message.includes("COMMENT_NOT_FOUND")
  ) {
    return Response.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  }

  return null;
}
