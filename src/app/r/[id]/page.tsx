// src/app/r/[id]/page.tsx
// Carte de résultat partageable (opt-in) : jamais le texte de l'essai.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXAMS } from "@/content";
import { publicCard } from "@/core";
import { LinkButton, Notice, fmtDate } from "@/ui";

type P = { params: Promise<{ id: string }> };
const okId = (id: string) => /^[a-f0-9-]{36}$/.test(id);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const c = okId(id) ? await publicCard(id).catch(() => null) : null;
  if (!c) return { robots: { index: false } };
  const t = `${EXAMS[c.exam].name} ${c.skill === "EE" ? "expression écrite" : "expression orale"} : NCLC ${c.low === c.high ? c.high : `${c.low} à ${c.high}`}`;
  return { title: t, description: "Estimation indicative non officielle établie avec Cap7.", robots: { index: false } };
}

export default async function Carte({ params }: P) {
  const { id } = await params;
  const c = okId(id) ? await publicCard(id).catch(() => null) : null;
  if (!c) notFound();
  return (
    <>
      <h1>{EXAMS[c.exam].name} : {c.skill === "EE" ? "expression écrite" : "expression orale"}</h1>
      <div className="card">
        <p className="big">NCLC {c.low === c.high ? c.high : `${c.low} à ${c.high}`}</p>
        <p className="muted">Estimation du {fmtDate(c.date)}, établie avec Cap7.</p>
      </div>
      <Notice>Estimation indicative non officielle, sans valeur de résultat d’examen. Cap7 n’est affilié ni à France Éducation international, ni à la CCI Paris Île-de-France, ni à IRCC.</Notice>
      <p><LinkButton href="/connexion?mode=register">Essayer une correction gratuite</LinkButton></p>
    </>
  );
}
