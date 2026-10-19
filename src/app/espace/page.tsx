// src/app/espace/page.tsx
// Tableau de bord : plan, progression, compte à rebours, résultat officiel, partage, suppression de compte.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SKILLS, SKILL_LABEL } from "@/crs";
import type { Exam, Skill } from "@/crs";
import { COUNTRY_CHOICES, EXAMS, PLANS, WEAKNESS_LABEL } from "@/content";
import { AppError, changePassword, completeProfile, currentUser, dashboardData, deleteAccountConfirmed, emailEnabled, endSession, needsProfile, progressPoints, saveOfficialResult, setAttemptPublic, siteUrl, startSession, updateProfile } from "@/core";
import { Card, DataTable, ErrorBox, LinkButton, Notice, RangeChart, fmtDate } from "@/ui";

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const skillFrom = (s: Skill, v: string): number | undefined => {
  const n = Number(v);
  return v !== "" && Number.isInteger(n) && n >= 4 && n <= 10 ? n : undefined;
};

async function logout() {
  "use server";
  await endSession();
  redirect("/");
}

async function saveProfile(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const targets: Partial<Record<Skill, number>> = {};
  for (const k of SKILLS) {
    const n = skillFrom(k, str(fd, `t_${k}`));
    if (n) targets[k] = n;
  }
  const exam = str(fd, "exam");
  try {
    await updateProfile(user, {
      exam: exam === "tcf" || exam === "tef" ? exam : null,
      country: str(fd, "country") || undefined,
      exam_date: str(fd, "exam_date") || null,
      sessions_per_week: Number(str(fd, "sessions")) || 4,
      targets,
    });
  } catch (e) {
    if (e instanceof AppError) redirect(`/espace?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/espace?info=" + encodeURIComponent("Profil enregistré."));
}

async function officialResult(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const nclc = {} as Record<Skill, number>;
  for (const k of SKILLS) nclc[k] = Number(str(fd, `o_${k}`));
  const exam: Exam = str(fd, "o_exam") === "tef" ? "tef" : "tcf";
  try {
    await saveOfficialResult(user, exam, str(fd, "o_date"), nclc, fd.get("c_anon") === "on", fd.get("c_testi") === "on");
  } catch (e) {
    if (e instanceof AppError) redirect(`/espace?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/espace?info=" + encodeURIComponent("Merci : votre résultat officiel est enregistré."));
}

async function togglePublic(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  await setAttemptPublic(user, str(fd, "id"), str(fd, "value") === "1");
  redirect("/espace");
}

async function removeAccount(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  try {
    await deleteAccountConfirmed(user, str(fd, "confirm"), str(fd, "password"));
  } catch (e) {
    if (e instanceof AppError) redirect("/espace?error=" + encodeURIComponent(e.message));
    throw e;
  }
  await endSession();
  redirect("/?info=compte-supprime");
}

/** Informations que Google ne fournit pas : pays, examen visé, date d'examen, acceptation des conditions. */
async function finishProfile(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  try {
    await completeProfile(user, { country: str(fd, "country"), exam: str(fd, "exam") || null, examDate: str(fd, "exam_date") || null, accepted: fd.get("accept") === "on" });
  } catch (e) {
    if (e instanceof AppError) redirect("/espace?error=" + encodeURIComponent(e.message));
    throw e;
  }
  (await cookies()).delete("cap7_later");
  redirect("/espace?info=" + encodeURIComponent("Profil complété. Merci !"));
}

/** « Plus tard » : la fenêtre de rappel disparaît 24 h, un bandeau reste visible. */
async function snoozeProfile() {
  "use server";
  (await cookies()).set("cap7_later", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
  redirect("/espace");
}

async function resumeProfile() {
  "use server";
  (await cookies()).delete("cap7_later");
  redirect("/espace");
}

async function updatePassword(fd: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/connexion");
  try {
    await changePassword(user, str(fd, "current"), str(fd, "next"));
  } catch (e) {
    if (e instanceof AppError) redirect("/espace?error=" + encodeURIComponent(e.message));
    throw e;
  }
  await startSession(user._id); // les autres sessions sont fermées ; celle-ci est renouvelée
  redirect("/espace?info=" + encodeURIComponent("Mot de passe enregistré. Vos autres appareils ont été déconnectés."));
}

export default async function Espace({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const sp = await searchParams;
  const error = String(Array.isArray(sp.error) ? sp.error[0] : sp.error ?? "").slice(0, 240);
  const info = String(Array.isArray(sp.info) ? sp.info[0] : sp.info ?? "").slice(0, 240);
  const d = await dashboardData(user);
  const incomplete = needsProfile(user);
  const snoozed = (await cookies()).get("cap7_later")?.value === "1";
  const hasPassword = !!user.pass_hash;
  const ee = await progressPoints(user._id, "EE");
  const eo = await progressPoints(user._id, "EO");
  const today = new Date().toISOString().slice(0, 10);
  const days = user.exam_date ? Math.ceil((new Date(user.exam_date + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400_000) : null;
  const refLink = `${siteUrl()}/connexion?mode=register&ref=${user._id}`;
  const showEstimate = (k: Skill) => {
    const e = d.est[k];
    if (!e) return "pas encore mesuré";
    if ("level" in e) return `niveau indicatif ${e.level}, NCLC ${e.nclcLow}${e.nclcHigh !== e.nclcLow ? " à " + e.nclcHigh : ""}`;
    return `NCLC ${e.low}${e.high !== e.low ? " à " + e.high : ""}`;
  };

  return (
    <>
      {incomplete && !snoozed ? (
        <div className="modal-backdrop">
          <dialog open className="modal" aria-labelledby="pf-title">
            <h2 id="pf-title">Terminons votre profil</h2>
            <p>Google nous a transmis votre adresse e-mail{user.name ? ` et votre nom (${user.name})` : ""}. Il reste quelques informations qu’il ne fournit pas.</p>
            <form action={finishProfile}>
              <label htmlFor="pf-country">Pays de résidence</label>
              <select id="pf-country" name="country" defaultValue="" required autoFocus>
                <option value="" disabled>Choisir…</option>
                {COUNTRY_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <label htmlFor="pf-exam">Examen visé</label>
              <select id="pf-exam" name="exam" defaultValue=""><option value="">Je ne sais pas encore</option><option value="tcf">TCF Canada</option><option value="tef">TEF Canada</option></select>
              <label htmlFor="pf-date">Date d’examen (facultatif)</label>
              <input id="pf-date" name="exam_date" type="date" />
              <label style={{ fontWeight: 400 }}><input style={{ width: "auto" }} type="checkbox" name="accept" required /> J’accepte les <a href="/legal/cgu" target="_blank" rel="noopener">conditions d’utilisation</a> et la <a href="/legal/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a>.</label>
              <p><button className="btn" type="submit">Enregistrer</button></p>
            </form>
            <form action={snoozeProfile}><button className="btn alt" type="submit">Plus tard</button></form>
            <p className="small muted">Nous vous le rappellerons à votre prochaine visite.</p>
          </dialog>
        </div>
      ) : null}
      {incomplete && snoozed ? (
        <form action={resumeProfile} className="note">
          Votre profil n’est pas terminé (pays, examen visé). <button className="btn alt" type="submit" style={{ padding: "4px 12px" }}>Terminer maintenant</button>
        </form>
      ) : null}
      <h1>{user.name ? `Bonjour ${user.name.split(" ")[0]}` : "Mon espace"}</h1>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {info ? <p className="note">{info}</p> : null}

      <div className="grid">
        <Card>
          <p className="muted small">Mon accès</p>
          {d.ent.hasPass ? (
            <><p className="big" style={{ fontSize: "1.6rem" }}>{d.ent.correctionsLeft} correction{d.ent.correctionsLeft > 1 ? "s" : ""}</p><p className="small">restantes, pass actif jusqu’au {d.ent.passEnd ? fmtDate(d.ent.passEnd.toISOString().slice(0, 10)) : "?"}. Aujourd’hui : {d.ent.usedToday} / 8.</p></>
          ) : (
            <><p>Niveau gratuit : écrit {d.free.EE ? "disponible" : "utilisé"}, oral {d.free.EO ? "disponible" : "utilisé"}, lecture {d.free.CE ? "disponible" : "utilisée"}, écoute {d.free.CO ? "disponible" : "utilisée"}.</p><LinkButton href="/tarifs">Voir les pass ({PLANS.p30.price.toFixed(2)} $ et {PLANS.p90.price.toFixed(2)} $)</LinkButton></>
          )}
        </Card>
        <Card>
          <p className="muted small">Compte à rebours</p>
          {days === null ? <p>Indiquez votre date d’examen ci-dessous.</p> : days >= 0 ? <><p className="big">{days} j</p><p className="small">avant l’examen du {fmtDate(user.exam_date!)}.</p></> : <p>La date d’examen est passée : déclarez votre résultat officiel plus bas.</p>}
        </Card>
        <Card><p className="muted small">Régularité</p><p className="big">{d.streak} j</p><p className="small">de pratique consécutifs. Séries faites : {d.series.CE} en lecture, {d.series.CO} en écoute.</p></Card>
      </div>

      <h2>S’entraîner</h2>
      <div className="row">
        <LinkButton href="/espace/ecrit">Expression écrite</LinkButton>
        <LinkButton href="/espace/oral">Expression orale</LinkButton>
        <LinkButton href="/espace/lecture" alt>Compréhension écrite</LinkButton>
        <LinkButton href="/espace/ecoute" alt>Compréhension orale</LinkButton>
      </div>

      <h2>Niveau estimé par compétence</h2>
      <DataTable head={["Compétence", "Estimation (indicative)"]} rows={SKILLS.map((k) => [SKILL_LABEL[k], showEstimate(k)])} />
      {ee.length ? <><h3>Expression écrite dans le temps</h3><RangeChart points={ee} title="Progression de l’expression écrite" /></> : null}
      {eo.length ? <><h3>Expression orale dans le temps</h3><RangeChart points={eo} title="Progression de l’expression orale" /></> : null}
      {d.weak.length ? <><h3>Critères les plus faibles</h3><ul>{d.weak.map(([t, n]) => <li key={t}>{WEAKNESS_LABEL[t] ?? t} ({n} fois)</li>)}</ul></> : null}

      <h2>Mon plan de travail</h2>
      <p className="muted">Plan calculé sans IA à partir de vos faiblesses mesurées et de votre date d’examen.</p>
      {d.plan.length ? <DataTable head={["Date", "Séance"]} rows={d.plan.slice(0, 12).map((s) => [fmtDate(s.date), s.focus])} /> : <p>Aucune séance planifiée.</p>}
      {d.plan.slice(0, 1).map((s) => <p key={s.date}><Link href={s.href} className="btn alt">Commencer la prochaine séance</Link></p>)}

      <h2>Mes réglages</h2>
      <form action={saveProfile}>
        <div className="row">
          <div><label htmlFor="exam">Examen visé</label>
            <select id="exam" name="exam" defaultValue={user.exam ?? ""}><option value="">À définir</option>{(["tcf", "tef"] as const).map((e) => <option key={e} value={e}>{EXAMS[e].name}</option>)}</select></div>
          <div><label htmlFor="country">Pays de résidence</label>
            <select id="country" name="country" defaultValue={user.country}>{COUNTRY_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          <div><label htmlFor="exam_date">Date d’examen</label><input id="exam_date" name="exam_date" type="date" defaultValue={user.exam_date ?? ""} /></div>
          <div><label htmlFor="sessions">Séances par semaine</label><input id="sessions" name="sessions" type="number" min={1} max={7} defaultValue={user.sessions_per_week} /></div>
        </div>
        <fieldset><legend>NCLC cible par compétence</legend><div className="skills">
          {SKILLS.map((k) => <div key={k}><label htmlFor={`t_${k}`}>{SKILL_LABEL[k]}</label><input id={`t_${k}`} name={`t_${k}`} type="number" min={4} max={10} defaultValue={user.targets[k] ?? 7} /></div>)}
        </div></fieldset>
        <button className="btn" type="submit">Enregistrer</button>
      </form>

      <h2>Mes dernières corrections</h2>
      {d.history.length === 0 ? <p>Aucune correction pour le moment.</p> : (
        <div className="tablewrap"><table>
          <thead><tr><th scope="col">Date</th><th scope="col">Épreuve</th><th scope="col">Niveau</th><th scope="col">Partage</th></tr></thead>
          <tbody>{d.history.map((h) => (
            <tr key={h.id}>
              <td>{fmtDate(h.at.slice(0, 10))}</td>
              <td>{h.exam.toUpperCase()} {h.skill === "EE" ? "écrit" : "oral"} ({h.task})</td>
              <td>NCLC {h.low}{h.high !== h.low ? ` à ${h.high}` : ""}</td>
              <td>
                <form action={togglePublic}>
                  <input type="hidden" name="id" value={h.id} /><input type="hidden" name="value" value={h.public ? "0" : "1"} />
                  <button className="btn alt" type="submit">{h.public ? "Retirer la carte publique" : "Créer une carte à partager"}</button>
                  {h.public ? <> <Link href={`/r/${h.id}`}>Voir</Link></> : null}
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="small muted">Une carte publique affiche seulement l’examen, la compétence, la fourchette de niveau et la date, jamais le texte de votre essai.</p>

      <h2>Résultat officiel</h2>
      <p>Après l’examen, indiquez vos niveaux NCLC officiels : cela nous aide à calibrer nos estimations. {d.official ? `(${d.official} enregistré${d.official > 1 ? "s" : ""})` : ""}</p>
      <form action={officialResult}>
        <div className="row">
          <div><label htmlFor="o_exam">Examen</label><select id="o_exam" name="o_exam"><option value="tcf">TCF Canada</option><option value="tef">TEF Canada</option></select></div>
          <div><label htmlFor="o_date">Date de l’examen</label><input id="o_date" name="o_date" type="date" required /></div>
        </div>
        <fieldset><legend>Niveaux NCLC officiels</legend><div className="skills">
          {SKILLS.map((k) => <div key={k}><label htmlFor={`o_${k}`}>{SKILL_LABEL[k]}</label><input id={`o_${k}`} name={`o_${k}`} type="number" min={3} max={12} required /></div>)}
        </div></fieldset>
        <label style={{ fontWeight: 400 }}><input style={{ width: "auto" }} type="checkbox" name="c_anon" /> J’autorise l’usage anonymisé de ce résultat pour améliorer Cap7.</label>
        <label style={{ fontWeight: 400 }}><input style={{ width: "auto" }} type="checkbox" name="c_testi" /> J’autorise Cap7 à me contacter pour un témoignage (aucune publication sans mon accord explicite).</label>
        <p><button className="btn" type="submit">Enregistrer mon résultat</button></p>
      </form>

      <h2>Parrainage</h2>
      <p>Chaque inscription faite avec votre lien vous donne, ainsi qu’à la personne parrainée, une correction gratuite en plus :</p>
      <p><code style={{ wordBreak: "break-all" }}>{refLink}</code></p>

      <h2>Connexion et sécurité</h2>
      <p>
        Méthode de connexion : {user.google_sub ? "Google" : "adresse e-mail et mot de passe"}{user.google_sub && hasPassword ? ", plus un mot de passe" : ""}. Adresse : {user.email}.
      </p>
      <form action={updatePassword}>
        {hasPassword ? (
          <>
            <label htmlFor="cur">Mot de passe actuel</label>
            <input id="cur" name="current" type="password" autoComplete="current-password" required />
          </>
        ) : <p className="muted small">Votre compte n’a pas de mot de passe (connexion Google). Vous pouvez en définir un pour vous connecter aussi avec votre adresse e-mail.</p>}
        <label htmlFor="nxt">{hasPassword ? "Nouveau mot de passe" : "Mot de passe"} (10 caractères minimum)</label>
        <input id="nxt" name="next" type="password" minLength={10} autoComplete="new-password" required />
        <p><button className="btn" type="submit">{hasPassword ? "Changer le mot de passe" : "Définir un mot de passe"}</button></p>
      </form>
      {!hasPassword || !emailEnabled() ? null : <p className="small muted">Mot de passe oublié ? Déconnectez-vous, puis utilisez « Mot de passe oublié » sur la page de connexion.</p>}

      <h2>Compte</h2>
      <div className="row">
        <form action={logout}><button className="btn alt" type="submit">Se déconnecter</button></form>
      </div>
      <form action={removeAccount}>
        <p>La suppression est définitive : votre compte, vos textes, transcriptions, résultats et droits d’accès sont effacés.</p>
        {hasPassword ? (
          <>
            <label htmlFor="delpw">Votre mot de passe</label>
            <input id="delpw" name="password" type="password" autoComplete="current-password" required />
          </>
        ) : null}
        <label htmlFor="confirm">Pour confirmer, tapez SUPPRIMER</label>
        <input id="confirm" name="confirm" autoComplete="off" required />
        <p><button className="btn" type="submit" style={{ background: "#9b2c2c" }}>Supprimer définitivement mon compte</button></p>
      </form>
      <Notice>Les achats sont conservés par le prestataire de paiement ; vos textes, résultats et droits d’accès locaux sont effacés.</Notice>
    </>
  );
}
