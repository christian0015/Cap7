// src/app/calculateur/page.tsx
// Calculateur « Combien de points vaut mon français ? ». Formulaire GET rendu côté serveur : fonctionne sans JavaScript,
// indexable, avec les derniers tirages en données live. Le calcul vient de crs.ts (fonctions pures partagées).
import type { Metadata } from "next";
import { frenchGain, SKILLS, SKILL_LABEL } from "@/crs";
import type { Levels } from "@/crs";
import { IRCC_CRS_TOOL_URL } from "@/content";
import { listDrawsSafe } from "@/core";
import { Card, Gauge, Notice, fmtDate } from "@/ui";

export const metadata: Metadata = {
  title: "Calculateur : combien de points vaut mon français ?",
  description: "Estimez le gain de points CRS apporté par un niveau NCLC en français, et comparez-le aux derniers tirages français et généraux.",
  alternates: { canonical: "/calculateur" },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const toInt = (v: string, lo: number, hi: number): number | null => {
  if (v.trim() === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

function readLevels(sp: SP, prefix: string): Levels | null {
  const out = {} as Levels;
  let any = false;
  for (const k of SKILLS) {
    const n = toInt(one(sp[`${prefix}_${k}`]), 0, 12);
    out[k] = n ?? 0;
    if (n !== null) any = true;
  }
  return any ? out : null;
}

function LevelFields({ prefix, sp, legend, hint }: { prefix: string; sp: SP; legend: string; hint: string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <p className="muted small">{hint}</p>
      <div className="skills">
        {SKILLS.map((k) => (
          <div key={k}>
            <label htmlFor={`${prefix}_${k}`}>{SKILL_LABEL[k]}</label>
            <input id={`${prefix}_${k}`} name={`${prefix}_${k}`} type="number" min={0} max={12} inputMode="numeric" defaultValue={one(sp[`${prefix}_${k}`])} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export default async function Calculateur({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const crs = toInt(one(sp.crs), 0, 1200);
  const english = readLevels(sp, "en");
  const french = readLevels(sp, "fr");
  const french1 = (await listDrawsSafe("french"))[0];
  const general1 = (await listDrawsSafe("cec"))[0];
  const g = crs !== null && french !== null ? frenchGain(crs, english, french) : null;

  return (
    <>
      <h1>Combien de points vaut mon français ?</h1>
      <p className="lead">Entrez votre CRS actuel (avec l’anglais, sans français), vos niveaux d’anglais (CLB) et les niveaux de français visés (NCLC). Estimation pour un candidat seul.</p>
      <form method="get" action="/calculateur">
        <label htmlFor="crs">CRS actuel, sans le français</label>
        <input id="crs" name="crs" type="number" min={0} max={1200} inputMode="numeric" defaultValue={one(sp.crs)} required />
        <LevelFields prefix="en" sp={sp} legend="Votre anglais (niveaux CLB)" hint="Laissez vide si vous n’avez pas de résultat d’anglais." />
        <LevelFields prefix="fr" sp={sp} legend="Votre français visé (niveaux NCLC)" hint="Niveau par compétence, de 4 à 10." />
        <button className="btn" type="submit">Estimer mon gain</button>
      </form>

      {g && crs !== null ? (
        <section aria-live="polite">
          <h2>Résultat (estimation)</h2>
          <div className="grid">
            <Card><p className="muted small">Gain estimé</p><p className="big">+{g.gain}</p><p className="small">dont {g.languageDelta} points de langue et {g.bonus} points de bonus français.</p></Card>
            <Card><p className="muted small">Nouveau CRS estimé</p><p className="big">{g.newCrs}</p><p className="small">{g.bestOption === "french_first" ? "Le français compte ici comme première langue." : "Le français compte ici comme deuxième langue."}</p></Card>
          </div>
          <Gauge
            value={g.newCrs} min={300} max={600}
            marks={[
              ...(french1 ? [{ at: french1.crs, label: `Tirage français : ${french1.crs}` }] : []),
              ...(general1 ? [{ at: general1.crs, label: `Tirage général (CEC) : ${general1.crs}` }] : []),
            ]}
          />
          <p>
            {!g.allSkillsNclc7
              ? "Attention : les tirages réservés aux francophones exigent au moins NCLC 7 dans les quatre compétences. Avec un niveau inférieur dans l’une d’elles, ce bonus et ces tirages ne vous concernent pas."
              : french1 && g.newCrs >= french1.crs
                ? `Votre CRS estimé (${g.newCrs}) serait au niveau ou au-dessus du minimum du dernier tirage français (${french1.crs}, le ${fmtDate(french1.date)}). Cela ne garantit aucune invitation : les seuils changent à chaque tirage.`
                : french1
                  ? `Votre CRS estimé (${g.newCrs}) resterait sous le minimum du dernier tirage français (${french1.crs}, le ${fmtDate(french1.date)}). L’écart est de ${french1.crs - g.newCrs} points.`
                  : "Les données de tirage ne sont pas disponibles pour le moment."}
          </p>
          <Notice>
            Estimation indicative non officielle. Non inclus : transférabilité des compétences, conjoint, autres facteurs. Seul le système d’IRCC fait foi :{" "}
            <a href={IRCC_CRS_TOOL_URL} rel="noopener noreferrer">outil CRS officiel</a>.
          </Notice>
          <p><a className="btn" href="/connexion">Mesurer mon niveau de français</a></p>
        </section>
      ) : (
        <p className="muted">Renseignez au moins votre CRS actuel et un niveau de français.</p>
      )}
    </>
  );
}
