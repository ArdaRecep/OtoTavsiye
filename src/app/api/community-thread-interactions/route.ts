import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import { communityMigrationError } from "@/lib/community";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { threadId?: unknown; action?: unknown };
    if (typeof body.threadId !== "string" || !["like", "dislike"].includes(String(body.action))) {
      return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
    }

    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("toggle_community_thread_reaction", {
      p_thread_id: body.threadId,
      p_type: body.action,
    });

    if (error) {
      return Response.json(
        { error: communityMigrationError(error.message) ? "Topluluk etkileşim kurulumu henüz tamamlanmadı." : "Etkileşim kaydedilemedi." },
        { status: communityMigrationError(error.message) ? 503 : 500 },
      );
    }

    const row = (Array.isArray(data) ? data[0] : data) as { thread_id: string; like_count: number; dislike_count: number; current_user_reaction: string | null } | null;
    return Response.json({
      threadId: row?.thread_id ?? body.threadId,
      likeCount: Number(row?.like_count ?? 0),
      dislikeCount: Number(row?.dislike_count ?? 0),
      userInteraction: row?.current_user_reaction ?? null,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ error: "Etkileşim kaydedilemedi." }, { status: 500 });
  }
}
