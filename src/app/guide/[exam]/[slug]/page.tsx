// src/app/guide/[exam]/[slug]/page.tsx
// Pages SEO générées depuis content.ts (pays × examen, niveaux NCLC, formats d'épreuve, thèmes).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allGuideParams, buildGuide, isExam } from "@/content";
import { DataTable, LinkButton } from "@/ui";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return allGuideParams();
}

type P = { params: Promise<{ exam: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { exam, slug } = await params;
  const g = isExam(exam) ? buildGuide(exam, slug) : null;
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guide/${exam}/${slug}` },
    openGraph: { title: g.title, description: g.description, type: "article" },
  };
}

export default async function Guide({ params }: P) {
  const { exam, slug } = await params;
  const g = isExam(exam) ? buildGuide(exam, slug) : null;
  if (!g) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <article>
      <p className="crumbs"><Link href="/">Accueil</Link> › Guides › {exam.toUpperCase()} Canada</p>
      <h1>{g.h1}</h1>
      <p className="lead">{g.intro}</p>
      {g.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((t, i) => <p key={i}>{t}</p>)}
          {s.table ? <DataTable head={s.table.head} rows={s.table.rows} /> : null}
        </section>
      ))}
      <section>
        <h2>Questions fréquentes</h2>
        {g.faq.map((f) => (
          <details key={f.q} style={{ margin: "10px 0" }}>
            <summary><strong>{f.q}</strong></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <p><LinkButton href={g.cta.href}>{g.cta.label}</LinkButton></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </article>
  );
}
