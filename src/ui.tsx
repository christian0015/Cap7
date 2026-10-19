// src/ui.tsx
// Composants UI partagés : en-tête, pied, boutons, cartes, jauge, graphiques SVG.
import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND, NON_AFFILIATION, contactEmail } from "./content.ts";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">{BRAND.name}</Link>
        <nav aria-label="Navigation principale">
          <Link href="/calculateur">Calculateur CRS</Link>
          <Link href="/tirages">Tirages</Link>
          <Link href="/guide/tcf/nclc-7">Guides</Link>
          <Link href="/tarifs">Tarifs</Link>
          <Link href="/espace">Mon espace</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>{NON_AFFILIATION}</p>
        <p>
          <Link href="/legal/cgu">CGU</Link> · <Link href="/legal/confidentialite">Confidentialité</Link> ·{" "}
          <Link href="/legal/mentions">Mentions légales</Link> · <Link href="/legal/non-affiliation">Non-affiliation</Link> ·{" "}
          <a href={`mailto:${contactEmail(site)}`}>{contactEmail(site)}</a>
        </p>
      </div>
    </footer>
  );
}

export function LinkButton({ href, children, alt }: { href: string; children: ReactNode; alt?: boolean }) {
  return <Link href={href} className={alt ? "btn alt" : "btn"}>{children}</Link>;
}

export function Card({ children, featured }: { children: ReactNode; featured?: boolean }) {
  return <div className={featured ? "card featured" : "card"}>{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p className="error" role="alert">{children}</p>;
}

/** Jauge horizontale : position d'un CRS entre deux bornes, avec repères. */
export function Gauge({ value, min, max, marks }: { value: number; min: number; max: number; marks: Array<{ at: number; label: string }> }) {
  const w = 640;
  const x = (v: number) => 20 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (w - 40);
  return (
    <svg className="gauge" viewBox={`0 0 ${w} 110`} role="img" aria-label={`Votre CRS estimé : ${value}`} style={{ maxWidth: "100%" }}>
      <rect x="20" y="50" width={w - 40} height="10" rx="5" fill="#dcd8cc" />
      <rect x="20" y="50" width={Math.max(0, x(value) - 20)} height="10" rx="5" fill="#0f4c4a" />
      {marks.map((m, i) => (
        <g key={i}>
          <line x1={x(m.at)} x2={x(m.at)} y1="38" y2="72" stroke="#8a4b08" strokeWidth="2" />
          <text x={x(m.at)} y={i % 2 ? 92 : 28} textAnchor="middle">{m.label}</text>
        </g>
      ))}
      <circle cx={x(value)} cy="55" r="9" fill="#17706c" stroke="#fff" strokeWidth="2" />
      <text x={x(value)} y="108" textAnchor="middle" style={{ fontWeight: 700 }}>{value}</text>
    </svg>
  );
}

/** Courbe NCLC dans le temps (fourchette bas/haut par point). */
export function RangeChart({ points, title }: { points: Array<{ label: string; low: number; high: number }>; title: string }) {
  const w = 640, h = 220, left = 36, bottom = 28;
  const y = (n: number) => 10 + (1 - (n - 3) / 7) * (h - bottom - 10);
  const step = points.length > 1 ? (w - left - 20) / (points.length - 1) : 0;
  const x = (i: number) => left + (points.length > 1 ? i * step : (w - left) / 2);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} style={{ maxWidth: "100%" }}>
      {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <g key={n}>
          <line x1={left} x2={w - 10} y1={y(n)} y2={y(n)} stroke={n === 7 ? "#8a4b08" : "#e6e2d6"} strokeDasharray={n === 7 ? "4 3" : undefined} />
          <text x={6} y={y(n) + 4}>{n}</text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1={y(p.high)} y2={y(p.low)} stroke="#17706c" strokeWidth="8" strokeLinecap="round" />
          <text x={x(i)} y={h - 8} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="small">{label}</div>
      <div style={{ background: "#e6e2d6", borderRadius: 6, height: 10, maxWidth: 360 }}>
        <div style={{ width: `${pct}%`, background: "#17706c", height: 10, borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* ---------- Affichage d'une correction ---------- */

import type { GradeResult } from "./db.ts";
import { formatScoreRange } from "./crs.ts";
import type { Exam } from "./crs.ts";
import { ORAL_CRITERIA, WRITTEN_CRITERIA } from "./content.ts";

export function GradeView({ grade, exam, skill, words, wpm }: { grade: GradeResult; exam: Exam; skill: "EE" | "EO"; words: number; wpm: number | null }) {
  const labels = Object.fromEntries([...WRITTEN_CRITERIA, ...ORAL_CRITERIA].map((c) => [c.id, c.label]));
  const f = grade.flags;
  const range = grade.nclc_low === grade.nclc_high ? `NCLC ${grade.nclc_high}` : `NCLC ${grade.nclc_low} à ${grade.nclc_high}`;
  return (
    <section aria-live="polite">
      <h2>Votre correction</h2>
      <div className="grid">
        <Card><p className="muted small">Niveau estimé</p><p className="big">{range}</p><p className="small">CECR indicatif : {grade.cecr}</p></Card>
        <Card>
          <p className="muted small">Équivalent indicatif {exam.toUpperCase()} Canada</p>
          <p className="big" style={{ fontSize: "1.7rem" }}>{formatScoreRange(exam, skill, grade.nclc_low, grade.nclc_high)}</p>
          <p className="small">{words} mots{wpm ? `, environ ${wpm} mots par minute` : ""}</p>
        </Card>
      </div>
      {f.too_short || f.off_topic || f.not_french || f.possible_memorized_template ? (
        <p className="note">
          Points d’attention :{" "}
          {[f.too_short && "texte trop court", f.off_topic && "hors sujet", f.not_french && "texte non français", f.possible_memorized_template && "possible gabarit appris par cœur, qui ne reflète pas votre vrai niveau"].filter(Boolean).join(" ; ")}.
        </p>
      ) : null}
      <h3>Critères</h3>
      {grade.criteria.map((c) => (
        <div key={c.id} style={{ margin: "10px 0" }}>
          <Bar value={c.score_0_4} max={4} label={`${labels[c.id] ?? c.id} : ${c.score_0_4} / 4`} />
          <p className="small" style={{ margin: "4px 0" }}>{c.comment}</p>
        </div>
      ))}
      <h3>Erreurs les plus coûteuses</h3>
      {grade.errors.length === 0 ? <p>Aucune erreur majeure relevée.</p> : (
        <div className="tablewrap"><table>
          <thead><tr><th scope="col">Extrait</th><th scope="col">Correction</th><th scope="col">Pourquoi</th></tr></thead>
          <tbody>{grade.errors.map((e, i) => <tr key={i}><td>{e.excerpt}</td><td>{e.correction}</td><td><span className="tag">{e.type}</span> {e.why}</td></tr>)}</tbody>
        </table></div>
      )}
      <h3>Points forts</h3>
      <ul>{grade.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <h3>À travailler en priorité</h3>
      <ul>{grade.priorities.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <h3>Version améliorée (niveau B2)</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{grade.rewrite}</p>
      <Notice>
        Estimation indicative non officielle, fondée sur un barème approximatif ; en cas d’hésitation, le niveau le plus bas est retenu. Elle ne garantit pas votre score à l’examen.
        {skill === "EO" ? " La prononciation n’est pas évaluée et l’exercice est un monologue enregistré, pas un dialogue en temps réel." : ""}
      </Notice>
    </section>
  );
}
