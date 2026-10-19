// src/app/tirages/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { listDrawsSafe } from "@/core";
import { DataTable, fmtDate, Notice } from "@/ui";
import { IRCC_ROUNDS_URL } from "@/content";

export const metadata: Metadata = {
  title: "Tirages Entrée express pour les candidats francophones",
  description: "Suivi des tirages de la catégorie « compétence en français » : dates, invitations et CRS minimum.",
  alternates: { canonical: "/tirages" },
};
export const revalidate = 3600;

export default async function Tirages() {
  const french = await listDrawsSafe("french");
  const total = french.reduce((s, d) => s + d.invitations, 0);
  return (
    <>
      <h1>Tirages « compétence en français »</h1>
      <p className="lead">{french.length} tirages suivis, {total.toLocaleString("fr-FR")} invitations au total. Ouvrez un tirage pour son détail.</p>
      <DataTable
        head={["Date", "Invitations", "CRS minimum"]}
        rows={french.map((d) => [d.date, d.invitations.toLocaleString("fr-FR"), String(d.crs)])}
      />
      <p>{french.map((d) => <Link key={d.date} href={`/tirages/${d.date}`} style={{ marginRight: 14, display: "inline-block" }}>{fmtDate(d.date)}</Link>)}</p>
      <Notice>
        Données de départ issues de sources tierces recoupées, puis mises à jour chaque jour depuis le flux d’IRCC lorsqu’il est configuré. Référence officielle :{" "}
        <a href={IRCC_ROUNDS_URL} rel="noopener noreferrer">page des tirages d’IRCC</a>. Aucun tirage passé ne préjuge des suivants.
      </Notice>
    </>
  );
}
