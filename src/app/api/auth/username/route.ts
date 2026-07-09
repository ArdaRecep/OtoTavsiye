import { NextRequest } from "next/server";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const username = normalizeUsername(request.nextUrl.searchParams.get("username"));
  const validationError = validateUsername(username);

  if (validationError) {
    return Response.json({
      available: false,
      error: validationError,
    }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    return Response.json({ available: false, error: "Kullanıcı adı kontrol edilemedi." }, { status: 500 });
  }

  return Response.json({
    available: !data,
    message: data ? "Bu kullanıcı adı alınmış." : "Bu kullanıcı adı uygun.",
  });
}
