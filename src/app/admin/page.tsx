// src/app/admin/page.tsx
// Métriques en lecture seule, protégées par ADMIN_TOKEN (/admin?token=…).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminStats, safeEqual } from "@/core";
import { Card, DataTable } from "@/ui";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = String(Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "");
  const expected = process.env.ADMIN_TOKEN ?? "";
  if (!expected || !token || !safeEqual(token, expected)) notFound();
  const s = await adminStats();
  const usd = (n: number) => `${n.toFixed(2)} $`;
  return (
    <>
      <h1>Métriques</h1>
      <div className="grid">
        <Card><p className="muted small">Inscrits</p><p className="big">{s.users}</p></Card>
        <Card><p className="muted small">Corrections</p><p className="big">{s.attempts}</p></Card>
        <Card><p className="muted small">Séries faites</p><p className="big">{s.seriesDone}</p></Card>
        <Card><p className="muted small">Paywalls vus / achats</p><p className="big">{s.paywalls} / {s.purchases}</p></Card>
        <Card><p className="muted small">Revenu brut (hors frais)</p><p className="big">{usd(s.revenueUsd)}</p></Card>
        <Card><p className="muted small">Coût LLM jour / mois</p><p className="big" style={{ fontSize: "1.6rem" }}>{usd(s.llmToday)} / {usd(s.llmMonth)}</p></Card>
      </div>
      <h2>Fournisseurs d’IA</h2>
      <DataTable
        head={["Tâche", "Fournisseur choisi", "Modèle", "Clé présente", "Repli Gemini prêt"]}
        rows={s.providers.map((x) => [x.task, x.provider, x.model, x.keyPresent ? "oui" : "NON", x.fallbackReady ? "oui" : "non"])}
      />
      <p className="small muted">Palier Gemini déclaré : {s.geminiTier}. Repli : une seule bascule sur Gemini, ou un seul réessai si Gemini est déjà le fournisseur choisi.</p>
      <p className="small muted">E-mails de service : {s.mail ?? "désactivés"}. Connexion Google : {s.googleAuth ? "activée" : "désactivée"}.</p>
      <h2>Appels du jour et plafonds</h2>
      <DataTable
        head={["Compteur", "Aujourd’hui", "Plafond (0 = désactivé)"]}
        rows={[
          ["Appels, tous fournisseurs", String(s.usage.calls), String(s.caps.calls)],
          ["Appels Gemini", String(s.usage.calls_gemini), String(s.caps.callsGemini)],
          ["Appels Anthropic", String(s.usage.calls_anthropic), "-"],
          ["Appels OpenAI", String(s.usage.calls_openai), "-"],
          ["Coût compté", usd(s.usage.usd), usd(s.caps.usd)],
        ]}
      />
      {s.warnings.length ? <><h3>Avertissements de configuration</h3><ul>{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></> : null}
      <h2>Dernier tirage français</h2>
      <p>{s.lastDraw ? `${s.lastDraw.date} : CRS ${s.lastDraw.crs}, ${s.lastDraw.invitations} invitations (source : ${s.lastDraw.source})` : "Aucun"}</p>
      <h2>Top pays</h2>
      <DataTable head={["Pays", "Inscrits"]} rows={s.topCountries.map(([c, n]) => [c, String(n)])} />
      <h2>Stock d’items</h2>
      <DataTable head={["Compétence et niveau", "Items vérifiés"]} rows={Object.entries(s.stock).map(([k, n]) => [k, String(n)])} />
      <h2>Erreurs récentes (cron et services)</h2>
      {s.cronErrors.length ? <ul>{s.cronErrors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p>Aucune erreur.</p>}
    </>
  );
}
