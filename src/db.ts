// src/db.ts
// Connexion MongoDB Atlas (client mis en cache global pour le serverless), index idempotents, accès aux collections.
// Une interface étroite (Coll) isole le reste du code du driver. Avec MOCK_EXTERNALS=1 et sans MONGODB_URI,
// une base en mémoire (processus unique) permet de dérouler tout le parcours en local et dans les tests.

import type { Exam, Skill } from "./crs.ts";
import type { PlanId } from "./content.ts";

/* ---------- Types de documents ---------- */

export interface UserDoc {
  _id: string;
  email: string;
  pass_hash: string;
  country: string;
  exam: Exam | null;
  exam_date: string | null; // AAAA-MM-JJ
  sessions_per_week: number;
  targets: Partial<Record<Skill, number>>;
  ip_hash: string;
  created_at: Date;
  verified: boolean;
  email_enabled: boolean; // la vérification par e-mail était active à l'inscription
  verify_hash?: string;
  reset_hash?: string;
  reset_expires?: Date;
  referred_by: string | null;
  bonus_corrections: number;
  /** Méthode de création du compte ; les comptes Google n'ont pas de mot de passe tant que l'utilisateur n'en définit pas un. */
  auth_provider?: "password" | "google";
  google_sub?: string;
  name?: string;
  /** false = informations non fournies par Google (pays, examen visé) encore à compléter. Absent = complet. */
  profile_complete?: boolean;
  /** Les sessions émises avant cette date sont refusées (changement ou réinitialisation du mot de passe). */
  pw_changed_at?: Date;
  reset_sent_at?: Date;
}

export interface Criterion { id: string; score_0_4: number; comment: string }
export interface GradeError { excerpt: string; correction: string; type: string; why: string }
export interface GradeResult {
  nclc_low: number;
  nclc_high: number;
  cecr: string;
  criteria: Criterion[];
  errors: GradeError[];
  strengths: string[];
  priorities: string[];
  weakness_tags: string[];
  rewrite: string;
  flags: { off_topic: boolean; too_short: boolean; not_french: boolean; possible_memorized_template: boolean };
}

export interface AttemptDoc {
  _id: string;
  user: string;
  exam: Exam;
  skill: "EE" | "EO";
  task: string;
  topic_id: string | null;
  topic_text: string;
  text: string; // texte écrit ou transcription (jamais l'audio)
  words: number;
  wpm: number | null;
  result: GradeResult;
  nclc_low: number;
  nclc_high: number;
  cost_usd: number;
  free: boolean;
  public: boolean;
  created_at: Date;
}

export interface PassDoc {
  _id: string;
  user: string;
  order_id: string;
  plan: PlanId;
  start: Date;
  end: Date;
  corrections_total: number;
  corrections_used: number;
  revoked: boolean;
}

export interface DrawDoc {
  _id: string; // `${date}-${category}`
  date: string;
  category: "french" | "cec";
  invitations: number;
  crs: number;
  n?: number;
  source: "seed" | "ircc";
}

export interface QuestionDoc { q: string; options: string[]; answer: number; quote: string; why: string }
export interface ItemDoc {
  _id: string;
  skill: "CE" | "CO";
  level: "A2" | "B1" | "B2" | "C1";
  title: string;
  text: string;
  questions: QuestionDoc[];
  audio_id: string | null;
  verified: boolean;
  created_at: Date;
}

export interface AudioDoc { _id: string; data: unknown; mime?: string; bytes: number; created_at: Date }

export interface ItemResultDoc {
  _id: string;
  user: string;
  item: string;
  skill: "CE" | "CO";
  level: "A2" | "B1" | "B2" | "C1";
  answers: number[];
  correct: number;
  total: number;
  created_at: Date;
}

export interface UsageDailyDoc {
  _id: string;
  day: string;
  usd: number;
  calls?: number;
  calls_anthropic?: number;
  calls_openai?: number;
  calls_gemini?: number;
}

export interface OfficialResultDoc {
  _id: string;
  user: string;
  exam: Exam;
  date: string;
  nclc: Record<Skill, number>;
  consent_anonymous: boolean;
  consent_testimonial: boolean;
  created_at: Date;
}

export interface EventDoc { _id: string; kind: string; msg: string; user: string | null; at: Date }

export type CollName =
  | "users" | "attempts" | "passes" | "draws" | "items" | "audio"
  | "item_results" | "usage_daily" | "official_results" | "events";

/* ---------- Interface étroite ---------- */

export type Filter = Record<string, unknown>;
export interface Update {
  $set?: Record<string, unknown>;
  $inc?: Record<string, number>;
  $unset?: Record<string, unknown>;
  $setOnInsert?: Record<string, unknown>;
}

export interface Coll<T> {
  findOne(filter: Filter): Promise<T | null>;
  find(filter: Filter, opts?: { sort?: Record<string, 1 | -1>; limit?: number }): Promise<T[]>;
  insertOne(doc: T): Promise<void>; // lève { code: 11000 } si doublon sur un index unique
  updateOne(filter: Filter, update: Update, opts?: { upsert?: boolean }): Promise<number>; // nombre de documents touchés
  deleteMany(filter: Filter): Promise<number>;
  countDocuments(filter?: Filter): Promise<number>;
}

export function isDuplicate(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === 11000;
}

const UNIQUE: Partial<Record<CollName, string[][]>> = {
  users: [["email"]],
  passes: [["order_id"]],
  draws: [["date", "category"]],
};

/* ---------- Base en mémoire (MOCK_EXTERNALS) ---------- */

type Row = Record<string, unknown>;

function valueOf(x: unknown): unknown {
  return x instanceof Date ? x.getTime() : x;
}

function matchField(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    const a = valueOf(actual) as number | string;
    for (const [op, v0] of Object.entries(c)) {
      const v = valueOf(v0) as number | string;
      if (op === "$gt" && !(a > v)) return false;
      if (op === "$gte" && !(a >= v)) return false;
      if (op === "$lt" && !(a < v)) return false;
      if (op === "$lte" && !(a <= v)) return false;
      if (op === "$ne" && a === v) return false;
      if (op === "$in" && !(v0 as unknown[]).map(valueOf).includes(a)) return false;
      if (op === "$exists" && (actual !== undefined) !== Boolean(v0)) return false;
    }
    return true;
  }
  return valueOf(actual) === valueOf(cond);
}

function matches(row: Row, filter: Filter): boolean {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === "$or") {
      if (!(cond as Filter[]).some((f) => matches(row, f))) return false;
    } else if (!matchField(row[k], cond)) return false;
  }
  return true;
}

function memColl<T>(name: CollName): Coll<T> {
  const rows: Row[] = [];
  const uniq = UNIQUE[name] ?? [];
  const clone = (r: Row): T => ({ ...r }) as unknown as T;
  const dup = (doc: Row, skipSelf?: Row) =>
    rows.some((r) => r !== skipSelf && (r._id === doc._id || uniq.some((keys) => keys.every((k) => valueOf(r[k]) === valueOf(doc[k])))));
  return {
    async findOne(filter) {
      const r = rows.find((x) => matches(x, filter));
      return r ? clone(r) : null;
    },
    async find(filter, opts) {
      let out = rows.filter((x) => matches(x, filter));
      if (opts?.sort) {
        const [[key, dir]] = Object.entries(opts.sort);
        out = [...out].sort((a, b) => {
          const av = valueOf(a[key]) as number | string;
          const bv = valueOf(b[key]) as number | string;
          return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
        });
      }
      if (opts?.limit) out = out.slice(0, opts.limit);
      return out.map(clone);
    },
    async insertOne(doc) {
      const row = { ...(doc as unknown as Row) };
      if (dup(row)) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      rows.push(row);
    },
    async updateOne(filter, update, opts) {
      let row = rows.find((x) => matches(x, filter));
      let inserted = false;
      if (!row) {
        if (!opts?.upsert) return 0;
        const base: Row = {};
        for (const [k, v] of Object.entries(filter)) if (v === null || typeof v !== "object" || v instanceof Date) base[k] = v;
        Object.assign(base, update.$setOnInsert ?? {});
        row = base;
        inserted = true;
      }
      for (const [k, v] of Object.entries(update.$set ?? {})) row[k] = v;
      for (const [k, v] of Object.entries(update.$inc ?? {})) row[k] = ((row[k] as number) ?? 0) + v;
      for (const k of Object.keys(update.$unset ?? {})) delete row[k];
      if (inserted) {
        if (dup(row)) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        rows.push(row);
      }
      return 1;
    },
    async deleteMany(filter) {
      let n = 0;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], filter)) { rows.splice(i, 1); n++; }
      return n;
    },
    async countDocuments(filter) {
      return rows.filter((x) => matches(x, filter ?? {})).length;
    },
  };
}

/* ---------- Connexion Atlas ---------- */

interface Handle { get<T>(name: CollName): Coll<T> }

interface Cache { __cap7Handle?: Promise<Handle>; __cap7Mem?: Map<CollName, Coll<unknown>> }
const g = globalThis as unknown as Cache;

function isMock(): boolean {
  return process.env.MOCK_EXTERNALS === "1" && !process.env.MONGODB_URI;
}

/** Index créés au premier démarrage, de façon idempotente (createIndex ne recrée pas un index identique). */
async function ensureIndexes(db: { collection(n: string): { createIndex(spec: Record<string, 1 | -1>, opts?: Record<string, unknown>): Promise<unknown> } }): Promise<void> {
  const c = (n: CollName) => db.collection(n);
  await Promise.all([
    c("users").createIndex({ email: 1 }, { unique: true }),
    c("users").createIndex({ ip_hash: 1, created_at: -1 }),
    c("users").createIndex({ google_sub: 1 }, { unique: true, partialFilterExpression: { google_sub: { $type: "string" } } }),
    c("attempts").createIndex({ user: 1, created_at: -1 }),
    c("passes").createIndex({ order_id: 1 }, { unique: true }),
    c("passes").createIndex({ user: 1, end: -1 }),
    c("draws").createIndex({ date: 1, category: 1 }, { unique: true }),
    c("items").createIndex({ skill: 1, level: 1, verified: 1 }),
    c("item_results").createIndex({ user: 1, item: 1 }),
    c("official_results").createIndex({ user: 1 }),
    c("events").createIndex({ kind: 1, at: -1 }),
  ]);
}

function wrapMongo(db: { collection(n: string): unknown }): Handle {
  return {
    get<T>(name: CollName): Coll<T> {
      // Le driver est typé de façon générique ; l'adaptateur garde le reste du code indépendant de ces types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = db.collection(name) as any;
      return {
        async findOne(filter) { return (await c.findOne(filter)) ?? null; },
        async find(filter, opts) {
          let cur = c.find(filter);
          if (opts?.sort) cur = cur.sort(opts.sort);
          if (opts?.limit) cur = cur.limit(opts.limit);
          return await cur.toArray();
        },
        async insertOne(doc) { await c.insertOne(doc); },
        async updateOne(filter, update, opts) {
          const r = await c.updateOne(filter, update, { upsert: opts?.upsert ?? false });
          return (r.matchedCount ?? 0) + (r.upsertedCount ?? 0);
        },
        async deleteMany(filter) { return (await c.deleteMany(filter)).deletedCount ?? 0; },
        async countDocuments(filter) { return await c.countDocuments(filter ?? {}); },
      };
    },
  };
}

async function connect(): Promise<Handle> {
  if (isMock()) {
    if (!g.__cap7Mem) g.__cap7Mem = new Map();
    const mem = g.__cap7Mem;
    return {
      get<T>(name: CollName): Coll<T> {
        if (!mem.has(name)) mem.set(name, memColl<unknown>(name));
        return mem.get(name) as Coll<T>;
      },
    };
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant");
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db();
  await ensureIndexes(db as never);
  return wrapMongo(db as never);
}

export async function col<T>(name: CollName): Promise<Coll<T>> {
  if (!g.__cap7Handle) {
    g.__cap7Handle = connect().catch((e) => {
      g.__cap7Handle = undefined; // permet de réessayer à la requête suivante
      throw e;
    });
  }
  return (await g.__cap7Handle).get<T>(name);
}

/** Réinitialise la base en mémoire (tests uniquement). */
export function resetMemoryDb(): void {
  g.__cap7Mem = new Map();
  g.__cap7Handle = undefined;
}
