// src/app/tarifs/page.tsx
import type { Metadata } from "next";
import { PLANS, FREE_FEATURES, PAID_FEATURES, REFUND_POLICY } from "@/content";
import { billing, currentUser } from "@/core";
import { Card, LinkButton, Notice } from "@/ui";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Un niveau gratuit, puis deux pass en paiement unique : 14,99 $ pour 30 jours, 29,99 $ pour 90 jours.",
  alternates: { canonical: "/tarifs" },
};

export default async function Tarifs() {
  const user = await currentUser();
  return (
    <>
      <h1>Tarifs</h1>
      <p className="lead">Pas d’abonnement : votre achat est lié à votre date d’examen. Paiement unique, en dollars américains.</p>
      <div className="grid">
        <Card>
          <h3>Gratuit</h3>
          <p className="price">0 $</p>
          <ul>{FREE_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <LinkButton href="/connexion" alt>Commencer</LinkButton>
        </Card>
        {Object.values(PLANS).map((p) => {
          const href = user ? billing.checkoutUrl(p.id, user) : null;
          return (
            <Card key={p.id} featured={p.featured}>
              <h3>{p.name} {p.featured ? <span className="tag">Le plus choisi</span> : null}</h3>
              <p className="price">{p.price.toFixed(2).replace(".", ",")} $</p>
              <p>{p.corrections} corrections IA (écrit et oral) pendant {p.days} jours.</p>
              <ul>{PAID_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
              {!user ? (
                <LinkButton href="/connexion">Créer un compte pour acheter</LinkButton>
              ) : href ? (
                <a className="btn" href={href}>Acheter le {p.name.toLowerCase()}</a>
              ) : (
                <p className="muted">Le paiement n’est pas encore configuré.</p>
              )}
            </Card>
          );
        })}
      </div>
      <p>Plafond de 8 corrections par jour et par utilisateur. {REFUND_POLICY}</p>
      <Notice>Les corrections sont des estimations indicatives, non officielles, et ne garantissent aucun résultat à l’examen.</Notice>
    </>
  );
}
