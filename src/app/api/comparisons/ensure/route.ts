import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { requireUser } from "@/lib/auth/require-user";
import {
  comparisonRpcErrorResponse,
  normalizeEnsureComparison,
  type EnsureComparisonRpcRow,
} from "@/lib/comparisons/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type EnsurePayload = {
  vehicleIds?: unknown;
};

export async function POST(request: Request) {
  try {
    await requireUser();

    const body = (await request.json()) as EnsurePayload;
    const vehicleIds = normalizeVehicleIds(body.vehicleIds);

    if (vehicleIds.length < 2 || vehicleIds.length > 3) {
      return Response.json({ error: "2 veya 3 araç seçmelisin." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("ensure_vehicle_comparison", {
      p_vehicle_ids: vehicleIds,
    });

    if (error) {
      const rpcResponse = comparisonRpcErrorResponse(error.message);
      if (rpcResponse) return rpcResponse;

      return Response.json({ error: "Karşılaştırma oluşturulamadı." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return Response.json({ error: "Karşılaştırma oluşturulamadı." }, { status: 500 });
    }

    return Response.json({ comparison: normalizeEnsureComparison(row as EnsureComparisonRpcRow) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}

function normalizeVehicleIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
