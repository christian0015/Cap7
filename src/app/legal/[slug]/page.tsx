// src/app/legal/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL, accountServicesSection, legalPage, providersSection } from "@/content";
import { activeProviders, geminiTier, googleEnabled, mailTransport } from "@/core";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL.map((l) => ({ slug: l.slug }));
}

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const p = legalPage(slug);
  return p ? { title: p.title, alternates: { canonical: `/legal/${slug}` } } : {};
}

export default async function Legal({ params }: P) {
  const { slug } = await params;
  const base = legalPage(slug);
  if (!base) notFound();
  // Confidentialité : la liste des fournisseurs d'IA reflète la configuration (.env) au moment du déploiement.
  const p = slug === "confidentialite"
    ? { ...base, sections: [...base.sections.filter((s) => s.h !== "Vos droits"), providersSection(activeProviders(), geminiTier()), accountServicesSection({ google: googleEnabled(), mail: mailTransport() }), ...base.sections.filter((s) => s.h === "Vos droits")] }
    : base;
  return (
    <article>
      <h1>{p.title}</h1>
      {p.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((t, i) => <p key={i}>{t}</p>)}
        </section>
      ))}
    </article>
  );
}
