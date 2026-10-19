// src/app/connexion/page.tsx
// Inscription, connexion, mot de passe oublié, vérification d'e-mail : actions serveur, sans JavaScript côté client.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppError, emailEnabled, finishPasswordReset, googleEnabled, loginUser, registerUser, sendEmail, siteUrl, startPasswordReset, startSession, verifyEmailToken } from "@/core";
import { BRAND, COUNTRY_CHOICES } from "@/content";
import { ErrorBox, Notice } from "@/ui";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const back = (q: Record<string, string>) => `/connexion?${new URLSearchParams(q).toString()}`;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "0.0.0.0");
}

async function register(fd: FormData) {
  "use server";
  const ref = str(fd, "ref");
  let target = "/espace";
  try {
    const { user, verifyToken } = await registerUser(
      { email: str(fd, "email"), password: str(fd, "password"), country: str(fd, "country") || "autre", exam: str(fd, "exam") || null, ref: ref || null },
      await clientIp(),
    );
    if (verifyToken) {
      await sendEmail(user.email, `Confirmez votre adresse e-mail : ${BRAND.name}`, `<p>Bienvenue sur ${BRAND.name}.</p><p><a href="${siteUrl()}/connexion?verify=${verifyToken}">Confirmer mon adresse e-mail</a></p>`);
      target = back({ info: "Un lien de confirmation vient de vous être envoyé par e-mail." });
    } else {
      await startSession(user._id);
    }
  } catch (e) {
    if (e instanceof AppError) redirect(back({ mode: "register", error: e.message }));
    throw e;
  }
  redirect(target);
}

async function login(fd: FormData) {
  "use server";
  try {
    const u = await loginUser(str(fd, "email"), str(fd, "password"));
    await startSession(u._id);
  } catch (e) {
    if (e instanceof AppError) redirect(back({ error: e.message }));
    throw e;
  }
  redirect("/espace");
}

async function forgot(fd: FormData) {
  "use server";
  const email = str(fd, "email");
  const token = await startPasswordReset(email);
  if (token) await sendEmail(email.trim().toLowerCase(), `Réinitialisation du mot de passe : ${BRAND.name}`, `<p><a href="${siteUrl()}/connexion?reset=${token}">Choisir un nouveau mot de passe</a> (valable une heure).</p>`);
  redirect(back({ info: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé." }));
}

async function reset(fd: FormData) {
  "use server";
  const token = str(fd, "token");
  try {
    const ok = await finishPasswordReset(token, str(fd, "password"));
    if (!ok) redirect(back({ error: "Ce lien est invalide ou expiré." }));
  } catch (e) {
    if (e instanceof AppError) redirect(back({ reset: token, error: e.message }));
    throw e;
  }
  redirect(back({ info: "Mot de passe modifié. Vous pouvez vous connecter." }));
}

function GoogleButton({ refId, label }: { refId: string; label: string }) {
  return (
    <>
      <p>
        <a className="btn google" href={`/api/auth/google${refId ? `?ref=${encodeURIComponent(refId)}` : ""}`}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {label}
        </a>
      </p>
      <p className="small muted">Avec Google, nous recevons votre adresse e-mail vérifiée et votre nom, jamais votre mot de passe Google. Nous vous demanderons ensuite votre pays et l’examen visé.</p>
      <div className="divider">ou avec une adresse e-mail</div>
    </>
  );
}

export default async function Connexion({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = one(sp.mode) || "login";
  const error = one(sp.error).slice(0, 240);
  const info = one(sp.info).slice(0, 240);
  const verify = one(sp.verify);
  const resetToken = one(sp.reset);
  const ref = one(sp.ref);
  const mailOn = emailEnabled();
  const googleOn = googleEnabled();
  let verified: boolean | null = null;
  if (verify) verified = await verifyEmailToken(verify);

  return (
    <>
      <h1>{mode === "register" ? "Créer un compte" : "Connexion"}</h1>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {info ? <p className="note">{info}</p> : null}
      {verified === true ? <p className="note">Adresse confirmée. Vous pouvez vous connecter.</p> : null}
      {verified === false ? <ErrorBox>Ce lien de confirmation est invalide ou déjà utilisé.</ErrorBox> : null}

      {resetToken ? (
        <form action={reset}>
          <input type="hidden" name="token" value={resetToken} />
          <label htmlFor="np">Nouveau mot de passe (10 caractères minimum)</label>
          <input id="np" name="password" type="password" minLength={10} autoComplete="new-password" required />
          <p><button className="btn" type="submit">Enregistrer</button></p>
        </form>
      ) : mode === "register" ? (
        <>
          {googleOn ? <GoogleButton refId={ref} label="S’inscrire avec Google" /> : null}
          <form action={register}>
            <input type="hidden" name="ref" value={ref} />
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="password">Mot de passe (10 caractères minimum)</label>
            <input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
            <label htmlFor="country">Pays de résidence</label>
            <select id="country" name="country" defaultValue="autre">{COUNTRY_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            <label htmlFor="exam">Examen visé</label>
            <select id="exam" name="exam" defaultValue=""><option value="">Je ne sais pas encore</option><option value="tcf">TCF Canada</option><option value="tef">TEF Canada</option></select>
            <p className="small muted">En créant un compte, vous acceptez les <a href="/legal/cgu">conditions d’utilisation</a> et la <a href="/legal/confidentialite">politique de confidentialité</a>.</p>
            <p><button className="btn" type="submit">Créer mon compte gratuit</button></p>
          </form>
          {!mailOn ? <Notice>La vérification de l’adresse e-mail et la réinitialisation du mot de passe par e-mail sont désactivées sur ce site : conservez bien votre mot de passe, il ne pourra pas être récupéré par e-mail.</Notice> : null}
          <p><a href="/connexion">J’ai déjà un compte</a></p>
        </>
      ) : mode === "forgot" ? (
        mailOn ? (
          <form action={forgot}>
            <label htmlFor="fe">Adresse e-mail</label>
            <input id="fe" name="email" type="email" required />
            <p><button className="btn" type="submit">Envoyer le lien</button></p>
          </form>
        ) : (
          <Notice>La réinitialisation par e-mail n’est pas activée sur ce site.</Notice>
        )
      ) : (
        <>
          {googleOn ? <GoogleButton refId={ref} label="Continuer avec Google" /> : null}
          <form action={login}>
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
            <p><button className="btn" type="submit">Se connecter</button></p>
          </form>
          <p><a href={`/connexion?mode=register${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`}>Créer un compte gratuit</a>{mailOn ? <> · <a href="/connexion?mode=forgot">Mot de passe oublié</a></> : null}</p>
        </>
      )}
    </>
  );
}
