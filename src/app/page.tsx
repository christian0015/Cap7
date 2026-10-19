// src/app/page.tsx
import { BRAND, FAQ, frenchSeedStats } from "@/content";
import { listDrawsSafe } from "@/core";
import { Card, LinkButton, Notice, fmtDate } from "@/ui";

export const revalidate = 3600;

export default async function Home() {
  const [french, cec] = [await listDrawsSafe("french"), await listDrawsSafe("cec")];
  const last = french[0];
  const lastGeneral = cec[0];
  const stats = frenchSeedStats();
  return (
    <>
      <section className="hero">
        <h1>{BRAND.tagline}</h1>
        <p className="lead">
          Préparez le TCF Canada et le TEF Canada avec des corrections détaillées de l’écrit et de l’oral, des séries de compréhension et un plan de travail,
          et mesurez ce que votre niveau de français vous rapporte en points CRS.
        </p>
        <div className="row">
          <LinkButton href="/calculateur">Calculer mes points</LinkButton>
          <LinkButton href="/connexion" alt>Correction gratuite</LinkButton>
          <LinkButton href="/tarifs" alt>Tarifs</LinkButton>
        </div>
      </section>

      <section aria-labelledby="preuve">
        <h2 id="preuve">Le dernier tirage pour les candidats francophones</h2>
        {last ? (
          <Card>
            <p className="big">{last.crs}</p>
            <p>
              CRS minimum du tirage du {fmtDate(last.date)} : {last.invitations.toLocaleString("fr-FR")} invitations.
              {lastGeneral ? ` À titre de comparaison, le dernier tirage de l’Expérience canadienne que nous suivons (${fmtDate(lastGeneral.date)}) s’est arrêté à ${lastGeneral.crs}.` : ""}
            </p>
            <p className="muted small">
              {stats.count} tirages français suivis en 2026, avec un CRS minimum entre {stats.min} et {stats.max}. <a href="/tirages">Voir tous les tirages</a>.
            </p>
          </Card>
        ) : null}
      </section>

      <section aria-labelledby="transparence">
        <h2 id="transparence">Une mesure honnête</h2>
        <div className="grid">
          <Card><h3>Des fourchettes, pas de fausse précision</h3><p>Chaque correction donne une fourchette de niveaux NCLC. En cas d’hésitation, le niveau le plus bas est retenu.</p></Card>
          <Card><h3>Un barème transparent</h3><p>Les points CRS du calculateur et les tables de conversion sont affichés, avec ce qu’ils ne couvrent pas.</p></Card>
          <Card><h3>Des limites affichées</h3><p>Prononciation non évaluée, pas de dialogue en direct, voix de synthèse pour l’écoute. Aucune promesse de score.</p></Card>
        </div>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq">Questions fréquentes</h2>
        {FAQ.map((f) => (
          <details key={f.q} style={{ margin: "10px 0" }}>
            <summary><strong>{f.q}</strong></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <Notice>Cap7 n’est affilié ni à France Éducation international, ni à la CCI Paris Île-de-France, ni à IRCC. Estimations indicatives non officielles.</Notice>
    </>
  );
}
