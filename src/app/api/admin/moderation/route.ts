import { getAdminState } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("forbidden_words").select("id, word, active, created_at").order("word");
  if (error) return Response.json({ error: "Yasaklı kelimeler alınamadı." }, { status: 500 });
  return Response.json({ words: data ?? [] });
}

export async function POST(request: Request) {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const body = (await request.json()) as { word?: unknown };
  const word = typeof body.word === "string" ? body.word.trim().slice(0, 40) : "";
  if (word.length < 2) return Response.json({ error: "Kelime en az 2 karakter olmalı." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("forbidden_words")
    .select("id")
    .ilike("word", word)
    .limit(1)
    .maybeSingle<{ id: string }>();
  const result = existing
    ? await admin.from("forbidden_words").update({ active: true, word }).eq("id", existing.id).select("id, word, active, created_at").single()
    : await admin.from("forbidden_words").insert({ word, active: true }).select("id, word, active, created_at").single();
  if (result.error) return Response.json({ error: "Kelime eklenemedi." }, { status: 500 });
  return Response.json({ word: result.data }, { status: existing ? 200 : 201 });
}

export async function PATCH(request: Request) {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const body = (await request.json()) as { id?: unknown; active?: unknown };
  if (typeof body.id !== "string" || typeof body.active !== "boolean") return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("forbidden_words").update({ active: body.active }).eq("id", body.id);
  if (error) return Response.json({ error: "Kelime güncellenemedi." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const adminState = await getAdminState();
  if (!adminState.isAdmin) return Response.json({ error: "Yetkin yok." }, { status: 403 });
  const body = (await request.json()) as { id?: unknown };
  if (typeof body.id !== "string") return Response.json({ error: "Geçersiz parametreler." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("forbidden_words").delete().eq("id", body.id);
  if (error) return Response.json({ error: "Kelime silinemedi." }, { status: 500 });
  return Response.json({ ok: true });
}
