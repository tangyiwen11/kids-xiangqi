import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f0e3",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ogImage = `${protocol}://${host}/og.png`;

  return {
    title: "儿童象棋｜认真陪你下好每一步",
    description: "专门陪 5 岁孩子下棋的中国象棋伙伴。有挑战，也有赢的机会。",
    applicationName: "儿童象棋",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "儿童象棋",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    openGraph: {
      title: "儿童象棋",
      description: "认真陪你下好每一步",
      type: "website",
      locale: "zh_CN",
      images: [{ url: ogImage, width: 1731, height: 909, alt: "儿童象棋——认真陪你下好每一步" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "儿童象棋",
      description: "认真陪你下好每一步",
      images: [ogImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
