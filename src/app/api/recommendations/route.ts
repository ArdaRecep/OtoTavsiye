import { buildRecommendations } from "@/lib/recommendations";
import type { RecommendationRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<RecommendationRequest>;

    return Response.json(buildRecommendations(payload));
  } catch {
    return Response.json(
      {
        error: "Geçersiz istek gövdesi. Lütfen tercihleri JSON formatında gönderin.",
      },
      { status: 400 },
    );
  }
}
