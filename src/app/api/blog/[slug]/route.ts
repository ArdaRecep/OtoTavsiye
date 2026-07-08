import { NextRequest } from "next/server";
import { getAdminState } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { BlogPostRow } from "../route";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const userId = request.nextUrl.searchParams.get("userId");
    const adminState = userId ? await getAdminState(userId) : { isAdmin: false };
    const supabase = createSupabaseServerClient();
    let query = supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, content, cover_image_url, status, author_id, created_at, updated_at")
      .eq("slug", slug);

    if (!adminState.isAdmin) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query.maybeSingle<BlogPostRow>();

    if (error) {
      if (error.message.includes("blog_posts") && error.message.includes("schema cache")) {
        return Response.json({ error: "Blog bulunamadı." }, { status: 404 });
      }

      return Response.json({ error: "Blog alınamadı.", details: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ error: "Blog bulunamadı." }, { status: 404 });
    }

    return Response.json({ post: data });
  } catch {
    return Response.json({ error: "Blog alınamadı." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const { userId, title, excerpt, content, coverImageUrl, status } = body as {
      userId?: string;
      title?: string;
      excerpt?: string;
      content?: string;
      coverImageUrl?: string;
      status?: "draft" | "published";
    };
    const adminState = await getAdminState(userId);

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (title?.trim()) updates.title = title.trim();
    if (excerpt !== undefined) updates.excerpt = excerpt.trim();
    if (content?.trim()) updates.content = content.trim();
    if (coverImageUrl !== undefined) updates.cover_image_url = coverImageUrl.trim() || null;
    if (status === "draft" || status === "published") updates.status = status;

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .update(updates)
      .eq("slug", slug)
      .select("id, title, slug, excerpt, content, cover_image_url, status, author_id, created_at, updated_at")
      .single<BlogPostRow>();

    if (error) {
      return Response.json({ error: "Blog güncellenemedi.", details: error.message }, { status: 500 });
    }

    return Response.json({ post: data });
  } catch {
    return Response.json({ error: "Blog güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({}));
    const adminState = await getAdminState(body.userId);

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("blog_posts").delete().eq("slug", slug);

    if (error) {
      return Response.json({ error: "Blog silinemedi.", details: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Blog silinemedi." }, { status: 400 });
  }
}
