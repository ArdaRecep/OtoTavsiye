import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import {
  comparisonRpcErrorResponse,
  normalizeComparisonComment,
  type ComparisonCommentRpcRow,
} from "@/lib/comparisons/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ commentId: string }>;
};

type UpdateCommentPayload = {
  body?: unknown;
  content?: unknown;
};

type DeleteCommentRpcRow = {
  id: string;
  comparison_id: string;
  deleted_at: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { commentId } = await context.params;
    const body = (await request.json()) as UpdateCommentPayload;
    const content = typeof body.body === "string" ? body.body : typeof body.content === "string" ? body.content : "";

    if (!commentId || !content.trim()) {
      return Response.json({ error: "commentId ve yorum gerekli." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_vehicle_comparison_comment", {
      p_comment_id: commentId,
      p_body: content,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorum güncellenemedi." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    return Response.json({ comment: normalizeComparisonComment(row as ComparisonCommentRpcRow) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Yorum güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { commentId } = await context.params;

    if (!commentId) {
      return Response.json({ error: "commentId gerekli." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("delete_vehicle_comparison_comment", {
      p_comment_id: commentId,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Yorum silinemedi." }, { status: 500 });
    }

    const row = (Array.isArray(data) ? data[0] : data) as DeleteCommentRpcRow | null;

    if (!row) {
      return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    return Response.json({
      ok: true,
      comment: {
        id: row.id,
        comparisonId: row.comparison_id,
        deletedAt: row.deleted_at,
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Yorum silinemedi." }, { status: 400 });
  }
}
