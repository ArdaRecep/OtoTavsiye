import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "HangiAraç | Araç önerisi ve otomobil topluluğu",
    template: "%s | HangiAraç",
  },
  description: "Bütçene ve kullanım tarzına göre araçları karşılaştır, sahip deneyimlerini oku ve topluluktan tavsiye al.",
  applicationName: "HangiAraç",
  keywords: ["araç önerisi", "hangi araba alınır", "otomobil karşılaştırma", "ikinci el araç", "araç tavsiyesi"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "HangiAraç",
    title: "HangiAraç | Kararını ver, deneyimi paylaş",
    description: "Akıllı araç önerileri, gerçek kullanıcı deneyimleri ve otomobil topluluğu.",
    images: [{ url: "/hangiArac.jpeg", width: 1200, height: 630, alt: "HangiAraç" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HangiAraç",
    description: "Araçları keşfet, karşılaştır ve topluluktan tavsiye al.",
    images: ["/hangiArac.jpeg"],
  },
  icons: {
    icon: "/hangiArac.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
