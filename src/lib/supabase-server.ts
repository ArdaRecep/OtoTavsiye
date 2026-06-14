import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const explicitUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (explicitUrl) return explicitUrl;

  const projectId = process.env.PROJECT_ID;

  if (projectId) return `https://${projectId}.supabase.co`;

  throw new Error("Supabase URL bulunamadi. SUPABASE_URL veya PROJECT_ID tanimlayin.");
}

function getSupabaseKey() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_SECRET ??
    process.env.SECRET_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.ANON_PUBLIC ??
    process.env.PUBLISHABLE_KEY;

  if (key) return key;

  throw new Error("Supabase key bulunamadi. SERVICE_ROLE_SECRET, SECRET_KEY veya ANON_PUBLIC tanimlayin.");
}

export function createSupabaseServerClient() {
  return createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
