// src/app/api/auth/google/route.ts
// Connexion avec Google. Sans paramètre `code` : redirige vers Google (state, nonce et PKCE dans un cookie signé de 10 minutes).
// Avec `code` : URI de redirection autorisée dans la console Google Cloud, termine la connexion et ouvre la session.
import { NextResponse } from "next/server";
import { AppError, OAUTH_COOKIE, finishGoogleFlow, googleEnabled, ipFromRequest, sessionCookieFor, siteUrl, startGoogleFlow } from "@/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

const back = (msg: string) => NextResponse.redirect(`${siteUrl()}/connexion?error=${encodeURIComponent(msg)}`);

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (!googleEnabled()) return back("La connexion avec Google n'est pas activée sur ce site.");
  try {
    if (!url.searchParams.has("code") && !url.searchParams.has("error")) {
      const flow = startGoogleFlow(url.searchParams.get("ref"));
      const res = NextResponse.redirect(flow.url);
      res.cookies.set(flow.cookie.name, flow.cookie.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: flow.cookie.maxAge });
      return res;
    }
    const { user } = await finishGoogleFlow(url.searchParams, readCookie(req, OAUTH_COOKIE), ipFromRequest(req));
    const c = await sessionCookieFor(user._id);
    const res = NextResponse.redirect(`${siteUrl()}/espace`);
    res.cookies.set(c.name, c.value, c.options);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 }); // le cookie de départ ne sert qu'une fois
    return res;
  } catch (e) {
    return back(e instanceof AppError ? e.message : "La connexion avec Google a échoué. Réessayez.");
  }
}
