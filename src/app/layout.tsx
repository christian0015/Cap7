// src/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header, Footer } from "@/ui";
import { BRAND } from "@/content";

const site =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const TITLE = `${BRAND.name} : préparation TCF Canada et TEF Canada, points CRS`;
const SHARE_TITLE = `${BRAND.name} : ${BRAND.tagline}`;
const GOOGLE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION || "dKt8mHbbvvZzsXGkW9k8pZALuGId_GhmM_obYLt6WM8";

const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: SHARE_TITLE };

export const metadata: Metadata = {
  metadataBase: new URL(site),
  applicationName: BRAND.name,
  title: { default: TITLE, template: `%s | ${BRAND.name}` },
  description: BRAND.description,
  verification: { google: GOOGLE_VERIFICATION },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/icon.png",
    apple: [{ url: "/icon.png", sizes: "192x192" }],
  },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "fr_CA",
    title: SHARE_TITLE,
    description: BRAND.description,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: BRAND.description,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: "#14544f",
  colorScheme: "light",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${site}/#org`, name: BRAND.name, url: site, logo: `${site}/icon.png` },
    { "@type": "WebSite", "@id": `${site}/#site`, name: BRAND.name, url: site, inLanguage: "fr", publisher: { "@id": `${site}/#org` } },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <Header />
        <main className="wrap">{children}</main>
        <Footer />
      </body>
    </html>
  );
}