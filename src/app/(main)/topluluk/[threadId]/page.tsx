import type { Metadata } from "next";
import { CommunityThreadPage } from "@/components/community-thread-page";

export const metadata: Metadata = {
  title: "Topluluk konusu",
};

export default async function CommunityThreadRoutePage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <CommunityThreadPage threadId={threadId} />;
}
