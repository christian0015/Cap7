// src/app/tirages/[date]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { drawsOnDateSafe, listDrawsSafe } from "@/core";
import { DRAWS_SEED } from "@/content";
import { fmtDate, LinkButton, Notice } from "@/ui";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return Array.from(new Set(DRAWS_SEED.map((d) => d.date))).map((date) => ({ date }));
}

type P = { params: Promise<{ date: string }> };
const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { date } = await params;
  return { title: `Tirage du ${okDate(date) ? fmtDate(date) : date}`, alternates: { canonical: `/tirages/${date}` } };
}

export default async function Tirage({ params }: P) {
  const { date } = await params;
  if (!okDate(date)) notFound();
  const draws = await drawsOnDateSafe(date);
  if (draws.length === 0) notFound();
  const all = await listDrawsSafe("french");
  const idx = all.findIndex((d) => d.date === date);
  const prev = idx >= 0 ? all[idx + 1] : undefined;
  return (
    <>
      <h1>Tirage du {fmtDate(date)}</h1>
      {draws.map((d) => (
        <div className="card" key={d._id} style={{ marginBottom: 14 }}>
          <p className="tag">{d.category === "french" ? "Compétence en français" : "Expérience canadienne"}</p>
          <p className="big">{d.crs}</p>
          <p>CRS minimum, {d.invitations.toLocaleString("fr-FR")} invitations.</p>
          {d.category === "french" && prev ? (
            <p className="muted">
              Tirage français précédent : {fmtDate(prev.date)}, CRS minimum {prev.crs} ({d.crs - prev.crs >= 0 ? "+" : ""}{d.crs - prev.crs} point{Math.abs(d.crs - prev.crs) > 1 ? "s" : ""} d’écart).
            </p>
          ) : null}
        </div>
      ))}
      <p>Pour savoir où vous vous situez par rapport à ce seuil :</p>
      <LinkButton href="/calculateur">Estimer mon CRS avec le français</LinkButton>
      <Notice>Un tirage passé ne garantit rien pour le suivant. Référez-vous toujours aux pages officielles d’IRCC.</Notice>
    </>
  );
}
