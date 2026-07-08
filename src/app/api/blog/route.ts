import { getAdminState } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  status: "draft" | "published";
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const includeDrafts = request.nextUrl.searchParams.get("includeDrafts") === "true";
    const adminState = includeDrafts ? await getAdminState(userId) : { isAdmin: false };
    const supabase = createSupabaseServerClient();

    let query = supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, content, cover_image_url, status, author_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (!adminState.isAdmin) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingBlogTableError(error.message)) {
        return Response.json({ posts: [] });
      }

      return Response.json({ posts: [], error: "Bloglar alınamadı.", details: error.message }, { status: 500 });
    }

    return Response.json({ posts: data ?? [] });
  } catch (err) {
    if (err instanceof Error && isMissingBlogTableError(err.message)) {
      return Response.json({ posts: [] });
    }

    return Response.json({ posts: [], error: "Bloglar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    if (!adminState.isAdmin || !adminState.user) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    if (!title?.trim() || !content?.trim()) {
      return Response.json({ error: "Başlık ve içerik gerekli." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const slug = await createUniqueSlug(title, supabase);
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: title.trim(),
        slug,
        excerpt: excerpt?.trim() || content.trim().slice(0, 180),
        content: content.trim(),
        cover_image_url: coverImageUrl?.trim() || null,
        status: status === "draft" ? "draft" : "published",
        author_id: adminState.user.id,
      })
      .select("id, title, slug, excerpt, content, cover_image_url, status, author_id, created_at, updated_at")
      .single<BlogPostRow>();

    if (error) {
      return Response.json({ error: "Blog eklenemedi.", details: error.message }, { status: 500 });
    }

    return Response.json({ post: data }, { status: 201 });
  } catch {
    return Response.json({ error: "Blog eklenemedi." }, { status: 400 });
  }
}

async function createUniqueSlug(title: string, supabase: ReturnType<typeof createSupabaseServerClient>) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 2;

  while (counter < 50) {
    const { data } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return `${baseSlug}-${Date.now()}`;
}

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "blog";
}

function isMissingBlogTableError(message: string) {
  return message.includes("blog_posts") && message.includes("schema cache");
}
