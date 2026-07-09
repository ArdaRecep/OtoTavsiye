export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? getProjectUrl();

  if (!url) throw new Error("Supabase URL bulunamadi.");

  return url;
}

export function getSupabaseAnonKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.ANON_PUBLIC ??
    process.env.PUBLISHABLE_KEY;

  if (!key) throw new Error("Supabase anon key bulunamadi.");

  return key;
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_SECRET ?? process.env.SECRET_KEY;

  if (!key) throw new Error("Supabase service role key bulunamadi.");

  return key;
}

function getProjectUrl() {
  const projectId = process.env.PROJECT_ID;

  return projectId ? `https://${projectId}.supabase.co` : undefined;
}
