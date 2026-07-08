import { NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback`;
  const disabledRedirect = new URL("/giris", origin);
  disabledRedirect.searchParams.set("oauthError", "google_disabled");

  if (!(await isGoogleProviderEnabled())) {
    return Response.redirect(disabledRedirect.toString(), 302);
  }

  const authorizeUrl = new URL(`${getSupabaseUrl()}/auth/v1/authorize`);

  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);
  authorizeUrl.searchParams.set("response_type", "token");
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "select_account");
  authorizeUrl.searchParams.set("apikey", getSupabasePublicKey());

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function isGoogleProviderEnabled() {
  try {
    const response = await fetch(`${getSupabaseUrl()}/auth/v1/settings`, {
      headers: {
        apikey: getSupabasePublicKey(),
        Authorization: `Bearer ${getSupabasePublicKey()}`,
      },
      cache: "no-store",
    });
    const settings = await response.json();

    return Boolean(settings?.external?.google);
  } catch {
    return true;
  }
}
