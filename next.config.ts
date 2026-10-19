// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const config: NextConfig = {
  poweredByHeader: false,
  // Le build n'a pas pu être typé contre Next dans l'environnement de construction (sans réseau).
  // Lancer `npm run typecheck` après `npm install` ; voir README « Décisions prises ».
  typescript: { ignoreBuildErrors: true },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    if (isProd) base.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/:path*", headers: base }];
  },
};

export default config;
