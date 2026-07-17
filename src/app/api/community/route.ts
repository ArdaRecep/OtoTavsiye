import { NextRequest } from "next/server";
import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { requireUser } from "@/lib/auth/require-user";
import { normalizeCommunityImagePaths } from "@/lib/community-media";
import { getCommunityImageUrls } from "@/lib/community-media-server";
import {
  communityMigrationError,
  isCommunityCategory,
  normalizeCommunityThread,
  type CommunityThreadRpcRow,
} from "@/lib/community";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const categoryValue = request.nextUrl.searchParams.get("category");
    const category = isCommunityCategory(categoryValue) ? categoryValue : null;
    const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) || null;
    const sort = request.nextUrl.searchParams.get("sort") === "popular" ? "popular" : "newest";
    const page = normalizePage(request.nextUrl.searchParams.get("page"));
    const pageSize = normalizePageSize(request.nextUrl.searchParams.get("pageSize"));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_community_threads", {
      p_category: category,
      p_search: search,
      p_page: page,
      p_page_size: pageSize,
      p_sort: sort,
    });

    if (error) {
      return Response.json(
        { error: communityMigrationError(error.message) ? "Topluluk kurulumu henüz tamamlanmadı." : "Konular alınamadı." },
        { status: communityMigrationError(error.message) ? 503 : 500 },
      );
    }

    const rows = (data ?? []) as CommunityThreadRpcRow[];
    const total = Number(rows[0]?.total_count ?? 0);
    return Response.json({ threads: rows.map((row) => normalizeCommunityThread(row, getCommunityImageUrls(row.image_paths))), total, page, pageSize, hasMore: (page + 1) * pageSize < total });
  } catch {
    return Response.json({ error: "Konular alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { title?: unknown; body?: unknown; category?: unknown; vehicleId?: unknown; imagePaths?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.body === "string" ? body.body.trim() : "";
    const category = isCommunityCategory(body.category) ? body.category : null;
    const vehicleId = typeof body.vehicleId === "string" && body.vehicleId.trim() ? body.vehicleId.trim() : null;
    const imagePaths = normalizeCommunityImagePaths(body.imagePaths, user.id);

    if (title.length < 5 || title.length > 120 || content.length < 10 || content.length > 3000 || !category) {
      return Response.json({ error: "Başlık 5-120, açıklama 10-3000 karakter olmalı." }, { status: 400 });
    }

    await assertCanPostComment(user.id, `${title} ${content}`);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_community_thread", {
      p_title: title,
      p_body: content,
      p_category: category,
      p_vehicle_id: vehicleId,
      p_image_paths: imagePaths,
    });

    if (error) {
      const message = communityWriteError(error.message, "Konu açılamadı.");
      return Response.json(
        { error: message },
        { status: communityMigrationError(error.message) ? 503 : error.message.includes("RATE_LIMIT") ? 429 : 400 },
      );
    }

    const threadId = typeof data === "string" ? data : Array.isArray(data) ? data[0] : data;
    return Response.json({ id: threadId }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;
    return Response.json({ error: "Konu açılamadı." }, { status: 400 });
  }
}

function normalizePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizePageSize(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(40, Math.max(10, Math.floor(parsed))) : 20;
}

function communityWriteError(message: string, fallback: string) {
  if (communityMigrationError(message)) return "Topluluk kurulumu henüz tamamlanmadı.";
  if (message.includes("RATE_LIMIT")) return "Yeni konu açmadan önce kısa bir süre bekle.";
  if (message.includes("ACTIVE_THREAD_EXISTS") || message.includes("community_threads_one_open_per_user_idx")) {
    return "Aynı anda yalnızca 1 açık konu açabilirsin. Yeni konu için mevcut konunu kapatmalısın.";
  }
  if (message.includes("CHAT_BANNED")) return "Toplulukta yazma yetkin geçici olarak kısıtlanmış.";
  if (message.includes("FORBIDDEN_WORD")) return "Metin yasaklı bir kelime içeriyor.";
  return fallback;
}
