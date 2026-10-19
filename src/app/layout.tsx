// src/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/ui";
import { BRAND } from "@/content";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: `${BRAND.name} : ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: BRAND.description,
  openGraph: { title: BRAND.name, description: BRAND.description, type: "website", locale: "fr_CA" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        <main className="wrap">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
