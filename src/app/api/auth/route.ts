import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";

type AuthPayload = {
  action?: "register" | "login";
  email?: string;
  username?: string;
  password?: string;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.profile?.email ?? user.email,
      username: user.profile?.username ?? user.email?.split("@")[0] ?? "Kullanıcı",
      avatarUrl: user.profile?.avatar_url ?? null,
      avatar_url: user.profile?.avatar_url ?? null,
      isAdmin: Boolean(user.profile?.is_admin),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthPayload;

    if (body.action === "register") {
      return register(body);
    }

    if (body.action === "login") {
      return login(body);
    }

    return Response.json({ error: "Geçersiz auth aksiyonu." }, { status: 400 });
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return Response.json({ ok: true });
}

async function register(payload: AuthPayload) {
  const email = payload.email?.trim().toLowerCase();
  const username = payload.username?.trim();
  const password = payload.password ?? "";

  if (!email || !username || !password) {
    return Response.json({ error: "E-posta, kullanıcı adı ve şifre gerekli." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile) {
    return Response.json({ error: "Bu kullanıcı adı ile zaten bir hesap mevcut." }, { status: 409 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    return Response.json({ error: "Kayıt başarısız." }, { status: 400 });
  }

  if (data.user) {
    await admin
      .from("users")
      .upsert({
        id: data.user.id,
        email: data.user.email ?? email,
        username,
        avatar_url: null,
      }, { onConflict: "id" });
  }

  return Response.json({
    user: data.user
      ? {
          id: data.user.id,
          email: data.user.email ?? email,
          username,
          avatarUrl: null,
          avatar_url: null,
          isAdmin: false,
        }
      : null,
    requiresEmailConfirmation: !data.session,
  }, { status: 201 });
}

async function login(payload: AuthPayload) {
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";

  if (!email || !password) {
    return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return Response.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  const user = await getCurrentUser();

  return Response.json({
    user: user
      ? {
          id: user.id,
          email: user.profile?.email ?? user.email,
          username: user.profile?.username ?? user.email?.split("@")[0] ?? "Kullanıcı",
          avatarUrl: user.profile?.avatar_url ?? null,
          avatar_url: user.profile?.avatar_url ?? null,
          isAdmin: Boolean(user.profile?.is_admin),
        }
      : null,
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
