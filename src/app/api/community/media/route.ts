import { authErrorResponse } from "@/lib/auth/handle-auth-error";
import { assertCanPostComment, moderationErrorResponse } from "@/lib/auth/moderation";
import { requireUser } from "@/lib/auth/require-user";
import {
  COMMUNITY_IMAGE_TYPES,
  MAX_COMMUNITY_IMAGES,
  MAX_COMMUNITY_IMAGE_SIZE,
  normalizeCommunityImagePaths,
} from "@/lib/community-media";
import { COMMUNITY_IMAGE_BUCKET } from "@/lib/community-media-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set<string>(COMMUNITY_IMAGE_TYPES);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await assertCanPostComment(user.id, "görsel");
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const threadId = typeof formData.get("threadId") === "string" ? String(formData.get("threadId")).trim() : "";

    if (!files.length || files.length > MAX_COMMUNITY_IMAGES) {
      return Response.json({ error: `1-${MAX_COMMUNITY_IMAGES} görsel seçmelisin.` }, { status: 400 });
    }

    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        return Response.json({ error: "Sadece JPG, PNG veya WebP yükleyebilirsin." }, { status: 400 });
      }
      if (file.size <= 0 || file.size > MAX_COMMUNITY_IMAGE_SIZE) {
        return Response.json({ error: "Her görsel en fazla 2 MB olabilir." }, { status: 400 });
      }
      if (!(await hasValidImageSignature(file))) {
        return Response.json({ error: "Dosyanın görsel biçimi doğrulanamadı." }, { status: 400 });
      }
    }

    const admin = createSupabaseAdminClient();
    const { data: activeThread } = await admin
      .from("community_threads")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (threadId) {
      const { data: editableThread } = await admin
        .from("community_threads")
        .select("id")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .eq("status", "open")
        .maybeSingle<{ id: string }>();
      if (!editableThread) return Response.json({ error: "Bu konuya görsel ekleyemezsin." }, { status: 403 });
    } else if (activeThread) {
      return Response.json({ error: "Açık konun varken yeni konu görseli yükleyemezsin." }, { status: 409 });
    }

    await ensureBucket(admin);
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      const { error } = await admin.storage.from(COMMUNITY_IMAGE_BUCKET).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        if (uploadedPaths.length) await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(uploadedPaths);
        return Response.json({ error: "Görseller yüklenemedi." }, { status: 500 });
      }
      uploadedPaths.push(path);
    }

    return Response.json({
      images: uploadedPaths.map((path) => ({
        path,
        url: admin.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
      })),
    }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const moderationResponse = moderationErrorResponse(error);
    if (moderationResponse) return moderationResponse;
    return Response.json({ error: "Görseller yüklenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { paths?: unknown };
    const paths = normalizeCommunityImagePaths(body.paths, user.id);
    if (!paths.length) return Response.json({ ok: true });

    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from(COMMUNITY_IMAGE_BUCKET).remove(paths);
    if (error) return Response.json({ error: "Görsel kaldırılamadı." }, { status: 500 });
    return Response.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ error: error instanceof Error ? error.message : "Görsel kaldırılamadı." }, { status: 400 });
  }
}

async function ensureBucket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.storage.getBucket(COMMUNITY_IMAGE_BUCKET);
  if (data) return;

  const { error } = await admin.storage.createBucket(COMMUNITY_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_COMMUNITY_IMAGE_SIZE,
    allowedMimeTypes: Array.from(COMMUNITY_IMAGE_TYPES),
  });
  if (error && !error.message.toLocaleLowerCase("tr-TR").includes("already exists")) throw error;
}

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function extensionFor(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "webp";
}
