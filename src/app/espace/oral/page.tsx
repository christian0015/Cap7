// src/app/espace/oral/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { Exam } from "@/crs";
import type { GradeResult } from "@/db";
import { EXAMS, LIMITS, topicsFor } from "@/content";
import { ErrorBox, GradeView, Notice } from "@/ui";

interface Out { grade: GradeResult; words: number; wpm: number | null }

export default function Oral() {
  const [exam, setExam] = useState<Exam>("tcf");
  const [task, setTask] = useState("t1");
  const [idx, setIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalSeconds = useRef(0);
  const ctl = useRef<AbortController | null>(null);
  const sending = useRef(false);

  const tasks = EXAMS[exam].speaking;
  const def = tasks.find((t) => t.id === task) ?? tasks[0];
  const bank = topicsFor(exam, "oral", def.id);
  const topic = bank[idx % bank.length];

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { ctl.current?.abort(); }, []);

  function stop() {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setRecording(false);
  }

  async function start() {
    setError(null); setOut(null); setTranscript(null); setBlob(null); setUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        finalSeconds.current = Math.round((Date.now() - t0.current) / 1000);
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      };
      rec.current = mr;
      t0.current = Date.now();
      setSeconds(0);
      mr.start();
      setRecording(true);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - t0.current) / 1000);
        setSeconds(s);
        if (s >= LIMITS.maxAudioSeconds) stop();
      }, 500);
    } catch {
      setError({ msg: "Le micro n’est pas accessible. Autorisez-le dans votre navigateur puis réessayez." });
    }
  }

  async function send() {
    if (!blob || sending.current) return; // blocage des envois en double
    if (blob.size > LIMITS.maxAudioBytes) return setError({ msg: "Enregistrement trop volumineux (8 Mo maximum). Refaites un enregistrement plus court." });
    sending.current = true;
    const c = new AbortController();
    ctl.current = c;
    setBusy(true); setError(null); setOut(null);
    try {
      // Si la transcription a déjà réussi (correction échouée ou annulée), on la réutilise sans relancer de transcription.
      let text = transcript;
      if (text === null) {
        const fd = new FormData();
        fd.append("audio", blob, blob.type.includes("mp4") ? "enregistrement.m4a" : "enregistrement.webm");
        fd.append("seconds", String(Math.min(finalSeconds.current, LIMITS.maxAudioSeconds)));
        const tr = await fetch("/api/transcribe", { method: "POST", body: fd, signal: c.signal });
        const td = await tr.json();
        if (!tr.ok) return setError({ msg: td.error, code: td.code });
        text = td.transcript as string;
        setTranscript(text);
      }
      const gr = await fetch("/api/grade", {
        method: "POST", headers: { "content-type": "application/json" }, signal: c.signal,
        body: JSON.stringify({ skill: "EO", exam, task: def.id, topicId: topic.id, text, durationSeconds: finalSeconds.current }),
      });
      const gd = await gr.json();
      if (!gr.ok) setError({ msg: gd.error, code: gd.code }); else setOut(gd);
    } catch (e) {
      setError({ msg: (e as Error).name === "AbortError" ? "Envoi annulé. Aucun crédit n’a été consommé." : "Connexion impossible. Réessayez." });
    } finally { sending.current = false; ctl.current = null; setBusy(false); }
  }

  function cancel() { ctl.current?.abort(); }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <h1>Expression orale</h1>
      <Notice>Monologue enregistré : pas de dialogue en temps réel, et la prononciation n’est pas évaluée. L’enregistrement dure {LIMITS.maxAudioSeconds / 60} minutes au maximum et n’est jamais conservé : il est transcrit puis supprimé.</Notice>
      <div className="row">
        <div><label htmlFor="exam">Examen</label>
          <select id="exam" value={exam} onChange={(e) => { const x = e.target.value as Exam; setExam(x); setTask(EXAMS[x].speaking[0].id); setIdx(0); setOut(null); }}>
            <option value="tcf">TCF Canada</option><option value="tef">TEF Canada</option>
          </select></div>
        <div><label htmlFor="task">Tâche</label>
          <select id="task" value={def.id} onChange={(e) => { setTask(e.target.value); setIdx(0); setOut(null); }}>{tasks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
      </div>
      <p className="muted">{def.brief}</p>
      <div className="card"><p style={{ margin: 0 }}><strong>Sujet :</strong> {topic.text}</p></div>
      <p><button className="btn alt" type="button" onClick={() => { setIdx(idx + 1); setOut(null); }}>Autre sujet</button></p>
      <p className="row">
        {!recording ? <button className="btn" type="button" onClick={start}>Enregistrer</button> : <button className="btn" type="button" onClick={stop}>Arrêter</button>}
        <span className="timer" aria-label="Durée">{mm}:{ss}</span>
      </p>
      {url ? (
        <>
          <audio controls src={url} style={{ width: "100%", maxWidth: 480 }} />
          <p className="row">
            <button className="btn" type="button" disabled={busy} onClick={send}>{busy ? "Transcription et correction…" : "Transcrire et corriger"}</button>
            {busy ? <button className="btn alt" type="button" onClick={cancel}>Annuler</button> : null}
          </p>
        </>
      ) : null}
      {error ? <ErrorBox>{error.msg} {error.code === "paywall" ? <a href="/tarifs">Voir les tarifs</a> : null}{error.code === "auth" ? <a href="/connexion">Se connecter</a> : null}</ErrorBox> : null}
      {transcript ? <><h3>Transcription littérale</h3><p style={{ whiteSpace: "pre-wrap" }}>{transcript}</p></> : null}
      {out ? <GradeView grade={out.grade} exam={exam} skill="EO" words={out.words} wpm={out.wpm} /> : null}
    </>
  );
}
