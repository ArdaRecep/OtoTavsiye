import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import {
  comparisonRpcErrorResponse,
  normalizeComparisonDetail,
  type ComparisonDetailRpcRow,
} from "@/lib/comparisons/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ comparisonId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { comparisonId } = await context.params;

    if (!comparisonId) {
      return Response.json({ error: "comparisonId gerekli." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_vehicle_comparison_detail", {
      p_comparison_id: comparisonId,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Karşılaştırma alınamadı." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return Response.json({ error: "Karşılaştırma bulunamadı." }, { status: 404 });
    }

    return Response.json({ comparison: normalizeComparisonDetail(row as ComparisonDetailRpcRow) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Karşılaştırma alınamadı." }, { status: 500 });
  }
}
