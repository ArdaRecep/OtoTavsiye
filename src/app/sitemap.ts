import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/site";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/topluluk`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${siteUrl}/karsilastirmalar`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
  ];

  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), { auth: { persistSession: false } });
    const [vehicles, posts, threads] = await Promise.all([
      supabase.from("vehicle_market_profiles").select("id, updated_at, image_url").limit(5000),
      supabase.from("blog_posts").select("slug, updated_at").eq("status", "published").limit(2000),
      supabase.from("community_threads").select("id, updated_at").limit(5000),
    ]);

    for (const vehicle of vehicles.data ?? []) {
      routes.push({
        url: `${siteUrl}/cars/${encodeURIComponent(vehicle.id)}`,
        lastModified: vehicle.updated_at,
        changeFrequency: "weekly",
        priority: 0.8,
        images: vehicle.image_url ? [vehicle.image_url] : undefined,
      });
    }
    for (const post of posts.data ?? []) {
      routes.push({ url: `${siteUrl}/blog/${encodeURIComponent(post.slug)}`, lastModified: post.updated_at, changeFrequency: "monthly", priority: 0.7 });
    }
    for (const thread of threads.data ?? []) {
      routes.push({ url: `${siteUrl}/topluluk/${thread.id}`, lastModified: thread.updated_at, changeFrequency: "daily", priority: 0.65 });
    }
  } catch {
    // Statik rotalar, veri kaynagi gecici olarak erisilemese de sitemap'te kalir.
  }

  return routes;
}
