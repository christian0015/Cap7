// src/app/espace/ecrit/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { countWords, EXAM_MAX } from "@/crs";
import type { Exam } from "@/crs";
import type { GradeResult } from "@/db";
import { EXAMS, topicsFor } from "@/content";
import { ErrorBox, GradeView } from "@/ui";

interface Out { grade: GradeResult; words: number; wpm: number | null; free: boolean; examScore: { min: number; max: number; outOf: number } }

export default function Ecrit() {
  const [exam, setExam] = useState<Exam>("tcf");
  const [task, setTask] = useState("t1");
  const [idx, setIdx] = useState(0);
  const [generated, setGenerated] = useState<{ id: string; text: string } | null>(null);
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const started = useRef<number | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [out, setOut] = useState<Out | null>(null);

  const tasks = EXAMS[exam].writing;
  const def = tasks.find((t) => t.id === task) ?? tasks[0];
  const bank = topicsFor(exam, "ecrit", def.id);
  const topic = generated ?? { id: bank[idx % bank.length].id, text: bank[idx % bank.length].text };
  const words = countWords(text);
  const okLength = words >= (def.minWords ?? 0) && (!def.maxWords || words <= def.maxWords);

  useEffect(() => {
    const t = setInterval(() => { if (started.current) setSeconds(Math.floor((Date.now() - started.current) / 1000)); }, 1000);
    return () => { clearInterval(t); ctl.current?.abort(); };
  }, []);

  function reset(nextExam: Exam, nextTask: string) {
    setExam(nextExam); setTask(nextTask); setIdx(0); setGenerated(null); setText(""); setOut(null); setError(null); setSeconds(0); started.current = null;
  }

  async function newTopic() {
    setError(null);
    const r = await fetch(`/api/items?kind=topic&exam=${exam}&mode=ecrit&task=${def.id}`);
    const d = await r.json();
    if (!r.ok) return setError({ msg: d.error, code: d.code });
    setGenerated(d);
  }

  async function submit() {
    if (sending.current) return; // blocage des envois en double (avant même la mise à jour de l'état)
    sending.current = true;
    const c = new AbortController();
    ctl.current = c;
    setBusy(true); setError(null); setOut(null);
    try {
      const r = await fetch("/api/grade", {
        method: "POST", headers: { "content-type": "application/json" }, signal: c.signal,
        body: JSON.stringify({ skill: "EE", exam, task: def.id, topicId: topic.id, topicText: topic.text, text }),
      });
      const d = await r.json();
      if (!r.ok) setError({ msg: d.error, code: d.code }); else setOut(d);
    } catch (e) {
      setError({ msg: (e as Error).name === "AbortError" ? "Envoi annulé. Aucun crédit n’a été consommé." : "Connexion impossible. Réessayez." });
    } finally { sending.current = false; ctl.current = null; setBusy(false); }
  }

  function cancel() { ctl.current?.abort(); }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <h1>Expression écrite</h1>
      <div className="row">
        <div><label htmlFor="exam">Examen</label>
          <select id="exam" value={exam} onChange={(e) => reset(e.target.value as Exam, EXAMS[e.target.value as Exam].writing[0].id)}>
            <option value="tcf">TCF Canada</option><option value="tef">TEF Canada</option>
          </select></div>
        <div><label htmlFor="task">Tâche</label>
          <select id="task" value={def.id} onChange={(e) => reset(exam, e.target.value)}>{tasks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
      </div>
      <p className="muted">{def.brief} {def.minWords ? `Longueur : ${def.minWords}${def.maxWords ? " à " + def.maxWords : " mots au minimum"}${def.maxWords ? " mots" : ""}. ` : ""}Durée conseillée : {def.minutes} minutes.</p>
      <div className="card"><p style={{ margin: 0 }}><strong>Sujet :</strong> {topic.text}</p></div>
      <p className="row">
        <button className="btn alt" type="button" onClick={() => { setGenerated(null); setIdx(idx + 1); }}>Autre sujet de la banque</button>
        <button className="btn alt" type="button" onClick={newTopic}>Nouveau sujet généré</button>
      </p>
      <label htmlFor="text">Votre texte</label>
      <textarea id="text" value={text} onChange={(e) => { if (!started.current) started.current = Date.now(); setText(e.target.value); }} maxLength={4000} />
      <p className="row">
        <span className="timer" aria-label="Chronomètre">{mm}:{ss}</span>
        <span className={okLength ? "good" : "muted"}>{words} mot{words > 1 ? "s" : ""}{def.minWords ? ` (minimum ${def.minWords}${def.maxWords ? `, maximum ${def.maxWords}` : ""})` : ""}</span>
      </p>
      <p className="row">
        <button className="btn" type="button" disabled={busy || words === 0} onClick={submit}>{busy ? "Correction en cours…" : "Envoyer pour correction"}</button>
        {busy ? <button className="btn alt" type="button" onClick={cancel}>Annuler</button> : null}
      </p>
      <p className="small muted">Barème sur {EXAM_MAX[exam].EE} points à titre indicatif uniquement ; la correction donne une fourchette de niveaux.</p>
      {error ? (
        <ErrorBox>{error.msg} {error.code === "paywall" ? <a href="/tarifs">Voir les tarifs</a> : null}{error.code === "auth" ? <a href="/connexion">Se connecter</a> : null}</ErrorBox>
      ) : null}
      {out ? <GradeView grade={out.grade} exam={exam} skill="EE" words={out.words} wpm={out.wpm} /> : null}
    </>
  );
}
