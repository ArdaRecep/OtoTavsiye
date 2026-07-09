import { getAdminState } from "@/lib/admin";
export async function GET() {
  const state = await getAdminState();

  return Response.json({
    isAdmin: state.isAdmin,
    user: state.user,
  });
}
