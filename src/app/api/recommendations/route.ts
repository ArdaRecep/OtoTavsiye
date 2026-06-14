import {
  buildAracOnerArgs,
  buildRecommendationResponse,
  normalizeRecommendationRequest,
  type AracOnerRow,
  type RawRecommendationRequest,
} from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RawRecommendationRequest;
    const appliedFilters = normalizeRecommendationRequest(payload);
    const rpcArgs = buildAracOnerArgs(appliedFilters);
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("arac_oner", rpcArgs).limit(10);

    if (error) {
      return Response.json(
        {
          error: "Araç önerileri Supabase RPC üzerinden alınamadı.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return Response.json(buildRecommendationResponse((data ?? []) as AracOnerRow[], appliedFilters));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Geçersiz istek gövdesi. Lütfen tercihleri JSON formatında gönderin.",
      },
      { status: 400 },
    );
  }
}
