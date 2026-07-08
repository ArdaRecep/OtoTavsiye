import { getAdminState } from "@/lib/admin";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const state = await getAdminState(userId);

  return Response.json({
    isAdmin: state.isAdmin,
    user: state.user,
  });
}
