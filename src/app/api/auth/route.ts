import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  appendDeviceCookie,
  assertIdentityIsAllowed,
  assertUserCanLogin,
  getClientIdentity,
  moderationErrorResponse,
  recordUserIdentity,
} from "@/lib/auth/moderation";
import { createSyntheticEmail, normalizeUsername, validateUsername } from "@/lib/auth/username";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthPayload = {
  action?: "register" | "login";
  username?: string;
  password?: string;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  username: string;
  avatar_url: string | null;
  is_admin: boolean;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: user.id,
      email: null,
      username: user.profile?.username ?? user.email?.split("@")[0] ?? "Kullanıcı",
      avatarUrl: user.profile?.avatar_url ?? null,
      avatar_url: user.profile?.avatar_url ?? null,
      isAdmin: Boolean(user.profile?.is_admin),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AuthPayload;
    const identity = getClientIdentity(request);

    if (body.action === "register") {
      return appendDeviceCookie(await register(body, identity), identity);
    }

    if (body.action === "login") {
      return appendDeviceCookie(await login(body, identity), identity);
    }

    return appendDeviceCookie(NextResponse.json({ error: "Geçersiz auth aksiyonu." }, { status: 400 }), identity);
  } catch (error) {
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;

    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return Response.json({ ok: true });
}

async function register(payload: AuthPayload, identity: ReturnType<typeof getClientIdentity>) {
  const username = normalizeUsername(payload.username);
  const password = payload.password ?? "";
  const usernameError = validateUsername(username);

  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Şifre gerekli." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });
  }

  await assertIdentityIsAllowed(identity);

  const admin = createSupabaseAdminClient();
  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ error: "Bu kullanıcı adı alınmış." }, { status: 409 });
  }

  const email = createSyntheticEmail(username);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: "Kayıt başarısız." }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("users")
    .upsert({
      id: data.user.id,
      email,
      username,
      avatar_url: null,
      is_admin: false,
    }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "Kayıt başarısız." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json({ error: "Kayıt oluşturuldu ama giriş başlatılamadı." }, { status: 400 });
  }

  await recordUserIdentity(data.user.id, identity);

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: null,
      username,
      avatarUrl: null,
      avatar_url: null,
      isAdmin: false,
    },
    requiresEmailConfirmation: false,
  }, { status: 201 });
}

async function login(payload: AuthPayload, identity: ReturnType<typeof getClientIdentity>) {
  const username = normalizeUsername(payload.username);
  const password = payload.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli." }, { status: 400 });
  }

  await assertIdentityIsAllowed(identity);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, username, avatar_url, is_admin")
    .ilike("username", username)
    .maybeSingle<UserProfileRow>();

  if (!profile) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
  }

  await assertUserCanLogin(profile.id);

  const email = await getProfileAuthEmail(profile);

  if (!email) {
    return NextResponse.json({ error: "Bu hesap kullanıcı adıyla girişe uygun değil." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
  }

  await recordUserIdentity(profile.id, identity);

  return NextResponse.json({
    user: {
      id: profile.id,
      email: null,
      username: profile.username,
      avatarUrl: profile.avatar_url ?? null,
      avatar_url: profile.avatar_url ?? null,
      isAdmin: Boolean(profile.is_admin),
    },
  });
}

async function getProfileAuthEmail(profile: UserProfileRow) {
  if (profile.email) return profile.email;

  const admin = createSupabaseAdminClient();
  const { data } = await admin.auth.admin.getUserById(profile.id);

  return data.user?.email ?? null;
}
