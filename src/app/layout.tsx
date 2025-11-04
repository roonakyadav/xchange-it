import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthModal } from "@/components/auth-modal";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { registerServiceWorker } from "@/lib/pwa";

export const metadata: Metadata = {
  title: "Xchange - Share & Request Digital Assets",
  description: "A marketplace for users to share or request digital assets like subscriptions, coupons, API credits, and files.",
  keywords: ["marketplace", "digital assets", "subscriptions", "api credits", "coupons"],
  authors: [{ name: "Xchange Team" }],
  creator: "Xchange",
  publisher: "Xchange",
  manifest: "/manifest.json",
  openGraph: {
    title: "Xchange - Share & Request Digital Assets",
    description: "A marketplace for users to share or request digital assets like subscriptions, coupons, API credits, and files.",
    url: "https://xchange.app",
    siteName: "Xchange",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Xchange - Digital Asset Marketplace",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Xchange - Share & Request Digital Assets",
    description: "A marketplace for users to share or request digital assets like subscriptions, coupons, API credits, and files.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF3B30",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="bg-background text-foreground antialiased"
        suppressHydrationWarning={true}
      >
        <Providers>
          {children}
          <AuthModal />
          <PWAInstallPrompt />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (${registerServiceWorker.toString()})();
            `,
          }}
        />
      </body>
    </html>
  );
}
