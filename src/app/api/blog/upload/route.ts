import { getAdminState } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const BLOG_BUCKET = process.env.SUPABASE_BLOG_BUCKET ?? "blog-images";
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const adminState = await getAdminState();

    if (!adminState.isAdmin) {
      return Response.json({ error: "Yetkin yok." }, { status: 403 });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: "Görsel dosyası gerekli." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: "Sadece jpg, png, webp veya gif yükleyebilirsin." }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return Response.json({ error: "Görsel en fazla 4 MB olabilir." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    await ensureBucket(supabase);

    const extension = getExtension(file);
    const path = `posts/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(BLOG_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return Response.json({ error: "Görsel yüklenemedi." }, { status: 500 });
    }

    const { data } = supabase.storage.from(BLOG_BUCKET).getPublicUrl(path);

    return Response.json({ url: data.publicUrl });
  } catch {
    return Response.json({ error: "Görsel yüklenemedi." }, { status: 400 });
  }
}

async function ensureBucket(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.storage.getBucket(BLOG_BUCKET);

  if (!error) return;

  await supabase.storage.createBucket(BLOG_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
  });
}

function getExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";

  return file.name.split(".").pop()?.toLowerCase() || "jpg";
}
