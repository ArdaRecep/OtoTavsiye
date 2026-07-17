import type { Metadata } from "next";
import { CommunityPage } from "@/components/community-page";

export const metadata: Metadata = {
  title: "Topluluk",
  description: "Araç tavsiyesi iste, sahip deneyimlerini oku ve teknik soruları otomobil topluluğuyla tartış.",
};

export default function CommunityRoutePage() {
  return <CommunityPage />;
}
