// src/crs.ts
// Fonctions pures partagées client/serveur : points CRS, conversions NCLC <-> scores, estimation de niveau.
// Sources : critères CRS officiels d'IRCC (page consultée le 17/10/2026) ; tableaux d'équivalence TCF/TEF
// (voir README « Décisions prises » pour le statut de vérification de chaque table).

export type Skill = "CO" | "CE" | "EE" | "EO";
export type Exam = "tcf" | "tef";
export type Levels = Record<Skill, number>;
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const SKILLS: readonly Skill[] = ["CO", "CE", "EE", "EO"];
export const SKILL_LABEL: Record<Skill, string> = {
  CO: "Compréhension orale",
  CE: "Compréhension écrite",
  EE: "Expression écrite",
  EO: "Expression orale",
};

/* ---------- Points CRS (candidat seul) ---------- */

/** Points CRS pour UNE compétence, 1re langue officielle, sans conjoint. */
export function firstLangPoints(level: number): number {
  if (level >= 10) return 34;
  if (level === 9) return 31;
  if (level === 8) return 23;
  if (level === 7) return 17;
  if (level === 6) return 9;
  if (level >= 4) return 6;
  return 0;
}

/** Points CRS pour UNE compétence, 2e langue officielle, sans conjoint. */
export function secondLangPoints(level: number): number {
  if (level >= 9) return 6;
  if (level >= 7) return 3;
  if (level >= 5) return 1;
  return 0;
}

export function sumFirst(levels: Levels | null): number {
  if (!levels) return 0;
  return SKILLS.reduce((s, k) => s + firstLangPoints(levels[k]), 0);
}

export function sumSecond(levels: Levels | null): number {
  if (!levels) return 0;
  return Math.min(24, SKILLS.reduce((s, k) => s + secondLangPoints(levels[k]), 0));
}

/** Bonus français : NCLC 7+ partout ; +25 si anglais <= CLB 4 (ou absent), +50 si anglais >= CLB 5 partout. */
export function frenchBonus(french: Levels, english: Levels | null): 0 | 25 | 50 {
  if (!SKILLS.every((k) => french[k] >= 7)) return 0;
  if (english && SKILLS.every((k) => english[k] >= 5)) return 50;
  return 25;
}

export interface FrenchGain {
  englishFirst: number;
  optionFrenchSecond: number; // anglais 1re langue + français 2e langue
  optionFrenchFirst: number; // français 1re langue + anglais 2e langue
  bestOption: "french_second" | "french_first";
  languageDelta: number;
  bonus: 0 | 25 | 50;
  gain: number;
  newCrs: number;
  allSkillsNclc7: boolean;
}

/**
 * Gain estimé apporté par le français pour un candidat seul.
 * gain = max(français en 2e langue, français en 1re + anglais en 2e) + bonus - situation actuelle (anglais en 1re).
 * Non inclus : transférabilité des compétences, conjoint, autres facteurs.
 */
export function frenchGain(currentCrs: number, english: Levels | null, french: Levels): FrenchGain {
  const englishFirst = sumFirst(english);
  const optionFrenchSecond = englishFirst + sumSecond(french);
  const optionFrenchFirst = sumFirst(french) + sumSecond(english);
  const bestOption = optionFrenchFirst > optionFrenchSecond ? "french_first" : "french_second";
  const best = Math.max(optionFrenchSecond, optionFrenchFirst);
  const languageDelta = best - englishFirst;
  const bonus = frenchBonus(french, english);
  const gain = languageDelta + bonus;
  return {
    englishFirst,
    optionFrenchSecond,
    optionFrenchFirst,
    bestOption,
    languageDelta,
    bonus,
    gain,
    newCrs: currentCrs + gain,
    allSkillsNclc7: SKILLS.every((k) => french[k] >= 7),
  };
}

/* ---------- Conversions NCLC <-> scores ---------- */

type Thresholds = Record<number, number>; // NCLC (4..10) -> score minimal

/** TCF Canada : CO/CE sur 699, EE/EO sur 20. [VÉRIFIÉ par recoupement, voir README] */
const TCF: Record<Skill, Thresholds> = {
  CO: { 4: 331, 5: 369, 6: 398, 7: 458, 8: 503, 9: 523, 10: 549 },
  CE: { 4: 342, 5: 375, 6: 406, 7: 453, 8: 499, 9: 524, 10: 549 },
  EE: { 4: 4, 5: 6, 6: 7, 7: 10, 8: 12, 9: 14, 10: 16 },
  EO: { 4: 4, 5: 6, 6: 7, 7: 10, 8: 12, 9: 14, 10: 16 },
};

/** TEF Canada, colonne « équivalence ancien score » utilisée par IRCC pour l'Entrée express : CO/360, CE/300, EE/EO sur 450. */
const TEF: Record<Skill, Thresholds> = {
  CO: { 4: 145, 5: 181, 6: 217, 7: 249, 8: 280, 9: 298, 10: 316 },
  CE: { 4: 121, 5: 151, 6: 181, 7: 207, 8: 233, 9: 248, 10: 263 },
  EE: { 4: 181, 5: 226, 6: 271, 7: 310, 8: 349, 9: 371, 10: 393 },
  EO: { 4: 181, 5: 226, 6: 271, 7: 310, 8: 349, 9: 371, 10: 393 },
};

export const EXAM_MAX: Record<Exam, Record<Skill, number>> = {
  tcf: { CO: 699, CE: 699, EE: 20, EO: 20 },
  tef: { CO: 360, CE: 300, EE: 450, EO: 450 },
};

function table(exam: Exam, skill: Skill): Thresholds {
  return (exam === "tcf" ? TCF : TEF)[skill];
}

/** NCLC (3 = « inférieur à 4 ») correspondant à un score d'examen. */
export function scoreToNclc(exam: Exam, skill: Skill, score: number): number {
  const t = table(exam, skill);
  let level = 3;
  for (let n = 4; n <= 10; n++) if (score >= t[n]) level = n;
  return level;
}

/** Plage de scores correspondant à un niveau NCLC. Pour NCLC 3 : de 0 au seuil du NCLC 4 moins 1. */
export function nclcToScoreRange(exam: Exam, skill: Skill, nclc: number): { min: number; max: number } {
  const t = table(exam, skill);
  const max = EXAM_MAX[exam][skill];
  const n = Math.min(10, Math.max(3, Math.round(nclc)));
  const min = n === 3 ? 0 : t[n];
  const upper = n === 10 ? max : t[n + 1] - 1;
  return { min, max: upper };
}

/** Plage de score affichée pour une fourchette NCLC [low, high]. */
export function examScoreRange(exam: Exam, skill: Skill, low: number, high: number): { min: number; max: number } {
  const a = nclcToScoreRange(exam, skill, Math.min(low, high));
  const b = nclcToScoreRange(exam, skill, Math.max(low, high));
  return { min: a.min, max: b.max };
}

/** Texte lisible : « 10–11 / 20 » ou « 310–348 / 450 ». */
export function formatScoreRange(exam: Exam, skill: Skill, low: number, high: number): string {
  const r = examScoreRange(exam, skill, low, high);
  const max = EXAM_MAX[exam][skill];
  return r.min === r.max ? `${r.min} / ${max}` : `${r.min}–${r.max} / ${max}`;
}

export function nclcTableRows(exam: Exam): Array<{ nclc: number; ranges: Record<Skill, string> }> {
  const rows: Array<{ nclc: number; ranges: Record<Skill, string> }> = [];
  for (let n = 10; n >= 4; n--) {
    const ranges = {} as Record<Skill, string>;
    for (const k of SKILLS) {
      const r = nclcToScoreRange(exam, k, n);
      ranges[k] = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
    }
    rows.push({ nclc: n, ranges });
  }
  return rows;
}

/* ---------- Estimation de niveau depuis des séries de compréhension ---------- */

export type SeriesLevel = "A2" | "B1" | "B2" | "C1";
export const SERIES_LEVELS: readonly SeriesLevel[] = ["A2", "B1", "B2", "C1"];

export const LEVEL_TO_NCLC: Record<SeriesLevel, [number, number]> = {
  A2: [4, 4],
  B1: [5, 6],
  B2: [7, 8],
  C1: [9, 10],
};

export interface SeriesResult {
  level: SeriesLevel;
  correct: number;
  total: number;
}

export interface LevelEstimate {
  level: SeriesLevel | "sous A2";
  nclcLow: number;
  nclcHigh: number;
  label: "indicatif";
}

/** Niveau = plus haut niveau avec >= 70 % de bonnes réponses sur >= 6 items cumulés. */
export function estimateLevel(results: SeriesResult[]): LevelEstimate | null {
  if (results.length === 0) return null;
  let best: SeriesLevel | null = null;
  for (const lvl of SERIES_LEVELS) {
    let correct = 0;
    let total = 0;
    for (const r of results) if (r.level === lvl) { correct += r.correct; total += r.total; }
    if (total >= 6 && correct / total >= 0.7) best = lvl;
  }
  if (!best) return { level: "sous A2", nclcLow: 3, nclcHigh: 4, label: "indicatif" };
  const [low, high] = LEVEL_TO_NCLC[best];
  return { level: best, nclcLow: low, nclcHigh: high, label: "indicatif" };
}

/** Un niveau estimé « qualifie-t-il » pour NCLC 7 ? Prudent : il faut que le bas de la fourchette soit >= 7. */
export function qualifiesNclc7(e: LevelEstimate | null): boolean {
  return !!e && e.nclcLow >= 7;
}

/* ---------- Mots ---------- */

/** Compte de mots tolérant (apostrophes et traits d'union gardent le mot entier). */
export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}
