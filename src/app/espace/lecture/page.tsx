// src/app/espace/lecture/page.tsx
// Séries de compréhension écrite (cette page) et orale (/espace/ecoute réutilise ce composant : la compétence vient de l'URL).
"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SERIES_LEVELS } from "@/crs";
import { ErrorBox } from "@/ui";

interface PublicItem { id: string; skill: "CE" | "CO"; level: string; title: string; text: string | null; audioUrl: string | null; questions: Array<{ q: string; options: string[] }> }
interface Review { chosen: number; answer: number; quote: string; why: string }
interface Result { correct: number; total: number; review: Review[]; text: string }

export default function Serie() {
  const skill: "CE" | "CO" = usePathname().endsWith("/ecoute") ? "CO" : "CE";
  const [level, setLevel] = useState("B1");
  const [item, setItem] = useState<PublicItem | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const sending = useRef(false);
  useEffect(() => () => { ctl.current?.abort(); }, []);

  const fail = (e: unknown) => setError({ msg: (e as Error).name === "AbortError" ? "Opération annulée. Aucun crédit ni essai gratuit n’a été consommé." : "Connexion impossible. Réessayez." });
  function cancel() { ctl.current?.abort(); }

  async function load() {
    if (sending.current) return; // blocage des envois en double
    sending.current = true;
    const c = new AbortController();
    ctl.current = c;
    setBusy(true); setError(null); setResult(null); setItem(null);
    try {
      const r = await fetch(`/api/items?skill=${skill}&level=${level}`, { signal: c.signal });
      const d = await r.json();
      if (!r.ok) return setError({ msg: d.error, code: d.code });
      setItem(d); setAnswers(new Array(d.questions.length).fill(-1));
    } catch (e) { fail(e); } finally { sending.current = false; ctl.current = null; setBusy(false); }
  }

  async function submit() {
    if (!item || sending.current) return;
    sending.current = true;
    const c = new AbortController();
    ctl.current = c;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id, answers }), signal: c.signal });
      const d = await r.json();
      if (!r.ok) setError({ msg: d.error, code: d.code }); else setResult(d);
    } catch (e) { fail(e); } finally { sending.current = false; ctl.current = null; setBusy(false); }
  }

  const complete = answers.length > 0 && answers.every((a) => a >= 0);
  return (
    <>
      <h1>{skill === "CE" ? "Compréhension écrite" : "Compréhension orale"}</h1>
      <p className="muted">Séries de 10 questions à choix multiple, contenus originaux. {skill === "CO" ? "Les voix sont synthétiques, sans bruits ni accents réels : un entraînement complémentaire à l’écoute de français authentique est conseillé." : ""} Niveau estimé indicatif.</p>
      <div className="row">
        <div><label htmlFor="lvl">Niveau de la série</label>
          <select id="lvl" value={level} onChange={(e) => setLevel(e.target.value)}>{SERIES_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
        <button className="btn" type="button" onClick={load} disabled={busy}>{busy && !item ? "Préparation de la série…" : "Nouvelle série"}</button>
        {busy ? <button className="btn alt" type="button" onClick={cancel}>Annuler</button> : null}
      </div>
      {error ? <ErrorBox>{error.msg} {error.code === "paywall" ? <a href="/tarifs">Voir les tarifs</a> : null}{error.code === "auth" ? <a href="/connexion">Se connecter</a> : null}</ErrorBox> : null}
      {item ? (
        <section>
          <h2>{item.title}</h2>
          {item.audioUrl ? <audio controls preload="none" src={item.audioUrl} style={{ width: "100%", maxWidth: 480 }} /> : null}
          {item.text ? <div className="card"><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.text}</p></div> : null}
          {item.questions.map((q, i) => (
            <fieldset className="q" key={i} disabled={!!result}>
              <legend>{i + 1}. {q.q}</legend>
              {q.options.map((o, j) => {
                const rv = result?.review[i];
                const cls = rv ? (j === rv.answer ? "right" : j === rv.chosen ? "wrong" : "") : "";
                return (
                  <label key={j} className={cls}>
                    <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} />
                    <span>{o}{rv && j === rv.answer ? " (bonne réponse)" : ""}</span>
                  </label>
                );
              })}
              {result ? <p className="small muted">Justification : « {result.review[i].quote} » {result.review[i].why}</p> : null}
            </fieldset>
          ))}
          {!result ? <button className="btn" type="button" onClick={submit} disabled={!complete || busy}>Valider mes réponses</button> : (
            <>
              <p className="big">{result.correct} / {result.total}</p>
              {skill === "CO" ? <><h3>Transcription</h3><p style={{ whiteSpace: "pre-wrap" }}>{result.text}</p></> : null}
              <button className="btn" type="button" onClick={load}>Série suivante</button>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
