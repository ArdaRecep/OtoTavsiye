import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

/** GET /api/auth?userId=... — Kullanıcı bilgilerini getirir */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "userId gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, email, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return Response.json({ error: "Kullanıcı bulunamadı.", details: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    return Response.json({ user: data });
  } catch {
    return Response.json({ error: "Beklenmeyen hata." }, { status: 500 });
  }
}

/**
 * POST /api/auth
 * action: "register" → Yeni kullanıcı kaydı (email + username + opsiyonel password)
 * action: "login"    → E-posta ile giriş (password kontrolü)
 * action: "guest"    → Misafir kullanıcı oluşturma (eski davranış)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, username, password } = body as {
      action?: "register" | "login" | "guest";
      email?: string;
      username?: string;
      password?: string;
    };

    const supabase = createSupabaseServerClient();

    // === KAYIT OL ===
    if (action === "register") {
      if (!email?.trim() || !username?.trim() || !password?.trim()) {
        return Response.json(
          { error: "E-posta, kullanıcı adı ve şifre gerekli." },
          { status: 400 },
        );
      }

      if (password.trim().length < 6) {
        return Response.json(
          { error: "Şifre en az 6 karakter olmalı." },
          { status: 400 },
        );
      }

      // E-posta zaten var mı kontrol et
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return Response.json(
          { error: "Bu e-posta adresi ile zaten bir hesap mevcut." },
          { status: 409 },
        );
      }

      // Basit hash — üretim ortamında bcrypt veya Supabase Auth kullanılmalı
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password.trim()));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data, error } = await supabase
        .from("users")
        .insert({
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password_hash: passwordHash,
        })
        .select("id, username, avatar_url, email, created_at")
        .single();

      if (error) {
        return Response.json(
          { error: "Kayıt başarısız.", details: error.message },
          { status: 500 },
        );
      }

      return Response.json({ user: data }, { status: 201 });
    }

    // === GİRİŞ YAP ===
    if (action === "login") {
      if (!email?.trim() || !password?.trim()) {
        return Response.json(
          { error: "E-posta ve şifre gerekli." },
          { status: 400 },
        );
      }

      // Hash the incoming password
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password.trim()));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: user, error } = await supabase
        .from("users")
        .select("id, username, avatar_url, email, created_at, password_hash")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (error || !user) {
        return Response.json(
          { error: "E-posta veya şifre hatalı." },
          { status: 401 },
        );
      }

      // Şifre kontrolü
      if (user.password_hash !== passwordHash) {
        return Response.json(
          { error: "E-posta veya şifre hatalı." },
          { status: 401 },
        );
      }

      // password_hash'i response'dan çıkar
      const { password_hash: _, ...safeUser } = user;

      return Response.json({ user: safeUser });
    }

    // === MİSAFİR KAYIT (eski davranış) ===
    if (!username?.trim()) {
      return Response.json({ error: "username gerekli." }, { status: 400 });
    }

    const guestEmail = `guest_${crypto.randomUUID().slice(0, 8)}@ototavsiye.local`;

    const { data, error } = await supabase
      .from("users")
      .insert({
        username: username.trim(),
        email: guestEmail,
      })
      .select("id, username, avatar_url, email, created_at")
      .single();

    if (error) {
      return Response.json(
        { error: "Kullanıcı oluşturulamadı.", details: error.message },
        { status: 500 },
      );
    }

    return Response.json({ user: data }, { status: 201 });
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
}
