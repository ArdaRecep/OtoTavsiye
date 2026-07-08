import { BlogDetailPage } from "@/components/blog-detail-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostRoutePage({ params }: PageProps) {
  const { slug } = await params;

  return <BlogDetailPage slug={slug} />;
}
