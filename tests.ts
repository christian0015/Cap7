// tests.ts
// Tests (`npm test`) avec node:test. Les appels externes sont simulés (MOCK_EXTERNALS=1) et la base est en mémoire.

process.env.MOCK_EXTERNALS = "1";
process.env.LS_WEBHOOK_SECRET = "secret-de-test";
process.env.LS_VARIANT_30 = "111";
process.env.LS_VARIANT_90 = "222";
process.env.AUTH_SECRET = "a".repeat(40);
process.env.MAX_DAILY_LLM_USD = "15";
delete process.env.MONGODB_URI;
delete process.env.RESEND_API_KEY;

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  firstLangPoints, secondLangPoints, frenchBonus, frenchGain, scoreToNclc, nclcToScoreRange, formatScoreRange,
  estimateLevel, qualifiesNclc7, countWords,
} from "./src/crs.ts";
import type { Levels } from "./src/crs.ts";
import {
  allGuideParams, buildGuide, guideWordCount, allTopicCount, topicsFor, DRAWS_SEED, EXAM_LIST, EXAMS, LEGAL, findTopic, providersSection,
} from "./src/content.ts";
import * as core from "./src/core.ts";
import { resetMemoryDb, col } from "./src/db.ts";
import type { PassDoc, QuestionDoc } from "./src/db.ts";

const L = (n: number): Levels => ({ CO: n, CE: n, EE: n, EO: n });

/* ---------- (a) crs.ts : points ---------- */

test("crs: points 1re langue par compétence", () => {
  const expected: Array<[number, number]> = [[3, 0], [4, 6], [5, 6], [6, 9], [7, 17], [8, 23], [9, 31], [10, 34], [12, 34]];
  for (const [clb, pts] of expected) assert.equal(firstLangPoints(clb), pts, `CLB ${clb}`);
});

test("crs: points 2e langue par compétence", () => {
  const expected: Array<[number, number]> = [[4, 0], [5, 1], [6, 1], [7, 3], [8, 3], [9, 6], [10, 6]];
  for (const [clb, pts] of expected) assert.equal(secondLangPoints(clb), pts, `CLB ${clb}`);
});

test("crs: bonus français 25 / 50 et cas limites", () => {
  assert.equal(frenchBonus(L(7), null), 25);
  assert.equal(frenchBonus(L(7), L(4)), 25);
  assert.equal(frenchBonus(L(7), L(5)), 50);
  assert.equal(frenchBonus(L(9), L(8)), 50);
  assert.equal(frenchBonus({ CO: 7, CE: 7, EE: 6, EO: 7 }, L(8)), 0, "un seul NCLC 6 supprime le bonus");
  assert.equal(frenchBonus(L(6), null), 0);
  // anglais partiellement >= 5 : pas de bonus 50
  assert.equal(frenchBonus(L(8), { CO: 6, CE: 6, EE: 4, EO: 6 }), 25);
});

test("crs: gain du français (exemple chiffré) et gain maximal", () => {
  // Anglais CLB 8,8,7,7 = 80 points en 1re langue ; français NCLC 7 partout en 2e langue = 12 ; bonus 50.
  const g = frenchGain(400, { CO: 8, CE: 8, EE: 7, EO: 7 }, L(7));
  assert.equal(g.englishFirst, 80);
  assert.equal(g.languageDelta, 12);
  assert.equal(g.bonus, 50);
  assert.equal(g.gain, 62);
  assert.equal(g.newCrs, 462);
  assert.equal(g.bestOption, "french_second");
  // Français meilleur que l'anglais : le français passe en 1re langue.
  const g2 = frenchGain(350, L(5), L(10));
  assert.equal(g2.bestOption, "french_first");
  assert.equal(g2.gain, 4 * 34 + 4 * 1 - 4 * 6 + 50);
  // Gain maximal : français CLB 10 partout, sans anglais.
  const g3 = frenchGain(300, null, L(10));
  assert.equal(g3.gain, 136 + 25);
  // Sans NCLC 7 partout : pas de bonus, gain réduit.
  const g4 = frenchGain(400, L(8), { CO: 7, CE: 7, EE: 6, EO: 6 });
  assert.equal(g4.bonus, 0);
  assert.equal(g4.allSkillsNclc7, false);
});

/* ---------- (b) conversions NCLC <-> scores et estimation ---------- */

test("conversions: TCF et TEF vers NCLC et retour", () => {
  assert.equal(scoreToNclc("tcf", "CO", 458), 7);
  assert.equal(scoreToNclc("tcf", "CO", 457), 6);
  assert.equal(scoreToNclc("tcf", "CE", 453), 7);
  assert.equal(scoreToNclc("tcf", "EE", 10), 7);
  assert.equal(scoreToNclc("tcf", "EO", 9), 6);
  assert.equal(scoreToNclc("tef", "EE", 310), 7);
  assert.equal(scoreToNclc("tef", "EE", 309), 6);
  assert.equal(scoreToNclc("tef", "CE", 207), 7);
  assert.equal(scoreToNclc("tef", "CO", 249), 7);
  assert.equal(scoreToNclc("tef", "CO", 100), 3);
  assert.deepEqual(nclcToScoreRange("tef", "EE", 7), { min: 310, max: 348 });
  assert.deepEqual(nclcToScoreRange("tcf", "EE", 7), { min: 10, max: 11 });
  assert.equal(formatScoreRange("tcf", "EE", 7, 7), "10–11 / 20");
  assert.equal(formatScoreRange("tef", "EE", 7, 7), "310–348 / 450");
  // aller-retour : le plancher de chaque niveau reconvertit au même niveau
  for (const exam of ["tcf", "tef"] as const) {
    for (const sk of ["CO", "CE", "EE", "EO"] as const) {
      for (let n = 4; n <= 10; n++) assert.equal(scoreToNclc(exam, sk, nclcToScoreRange(exam, sk, n).min), n);
    }
  }
});

test("estimation de niveau depuis des séries", () => {
  assert.equal(estimateLevel([]), null);
  // 8/10 en B2 : niveau B2, NCLC 7-8
  const e = estimateLevel([{ level: "B2", correct: 8, total: 10 }]);
  assert.equal(e?.level, "B2");
  assert.equal(e?.nclcLow, 7);
  assert.equal(e?.nclcHigh, 8);
  assert.equal(qualifiesNclc7(e), true);
  // moins de 6 items : le niveau ne compte pas
  assert.equal(estimateLevel([{ level: "C1", correct: 5, total: 5 }])?.level, "sous A2");
  // plus haut niveau avec >= 70 % : B1 à 90 %, B2 à 50 % -> B1
  const e2 = estimateLevel([{ level: "B1", correct: 9, total: 10 }, { level: "B2", correct: 5, total: 10 }]);
  assert.equal(e2?.level, "B1");
  assert.equal(qualifiesNclc7(e2), false);
  // cumul de plusieurs séries du même niveau
  const e3 = estimateLevel([{ level: "B2", correct: 3, total: 4 }, { level: "B2", correct: 4, total: 4 }]);
  assert.equal(e3?.level, "B2");
});

test("comptage de mots", () => {
  assert.equal(countWords("L'été n'est pas très-chaud, n'est-ce pas ?"), 6);
  assert.equal(countWords(""), 0);
});

/* ---------- (c) webhook : signature et idempotence ---------- */

function sign(body: string, secret = "secret-de-test"): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function orderBody(orderId: string, userId: string, variant: string, event = "order_created"): string {
  return JSON.stringify({
    meta: { event_name: event, custom_data: { user_id: userId } },
    data: { id: orderId, type: "orders", attributes: { status: "paid", first_order_item: { variant_id: Number(variant) } } },
  });
}

function memoryPassStore(known: string[]) {
  const passes = new Map<string, PassDoc>();
  const store: core.PassStore = {
    async insertPass(p) { if (passes.has(p.order_id)) return false; passes.set(p.order_id, p); return true; },
    async revokePass(id) { const p = passes.get(id); if (!p) return false; p.revoked = true; return true; },
    async userExists(id) { return known.includes(id); },
  };
  return { store, passes };
}

test("webhook: signature valide, invalide, corps altéré", async () => {
  const body = orderBody("A1", "u1", "111");
  assert.equal(core.verifyWebhookSignature(body, sign(body), "secret-de-test"), true);
  assert.equal(core.verifyWebhookSignature(body, sign(body, "autre"), "secret-de-test"), false);
  assert.equal(core.verifyWebhookSignature(body + " ", sign(body), "secret-de-test"), false, "corps altéré");
  assert.equal(core.verifyWebhookSignature(body, "", "secret-de-test"), false);
  const { store } = memoryPassStore(["u1"]);
  assert.equal((await core.handleWebhook(body, sign(body, "autre"), store)).status, 401);
  assert.equal((await core.handleWebhook(body, null, store)).status, 401);
  assert.equal((await core.handleWebhook(body + "x", sign(body), store)).status, 401);
});

test("webhook: création du pass, idempotence par order_id, remboursement", async () => {
  const { store, passes } = memoryPassStore(["u1"]);
  const body = orderBody("ORD-1", "u1", "222");
  const now = new Date("2026-10-17T10:00:00Z");
  const r1 = await core.handleWebhook(body, sign(body), store, now);
  assert.equal(r1.status, 200);
  assert.equal(passes.size, 1);
  const p = passes.get("ORD-1")!;
  assert.equal(p.plan, "p90");
  assert.equal(p.corrections_total, 150);
  assert.equal(p.end.toISOString(), new Date(now.getTime() + 90 * 86400_000).toISOString());
  const r2 = await core.handleWebhook(body, sign(body), store, now);
  assert.equal(r2.status, 200);
  assert.equal(r2.body, "déjà traité");
  assert.equal(passes.size, 1, "idempotent : pas de second pass");
  const refund = orderBody("ORD-1", "u1", "222", "order_refunded");
  await core.handleWebhook(refund, sign(refund), store, now);
  assert.equal(passes.get("ORD-1")!.revoked, true);
  // utilisateur inconnu ou variante inconnue
  const bad = orderBody("ORD-2", "inconnu", "222");
  assert.equal((await core.handleWebhook(bad, sign(bad), store)).status, 400);
  const badVariant = orderBody("ORD-3", "u1", "999");
  assert.equal((await core.handleWebhook(badVariant, sign(badVariant), store)).status, 400);
});

/* ---------- (d) validation zod d'une correction ---------- */

const validGrade = {
  nclc_low: 6, nclc_high: 7, cecr: "B1",
  criteria: [
    { id: "adequation", score_0_4: 3, comment: "ok" }, { id: "coherence", score_0_4: 3, comment: "ok" },
    { id: "lexique", score_0_4: 2, comment: "ok" }, { id: "grammaire", score_0_4: 2, comment: "ok" },
  ],
  errors: [{ excerpt: "je suis allé", correction: "je suis allée", type: "accord", why: "accord du participe" }],
  strengths: ["clair"], priorities: ["accords"], weakness_tags: ["accord"], rewrite: "texte amélioré",
  flags: { off_topic: false, too_short: false, not_french: false, possible_memorized_template: false },
};

test("zod: correction valide et invalide", () => {
  const ok = core.parseGrade(validGrade);
  assert.equal(ok.ok, true);
  assert.equal(core.parseGrade({ ...validGrade, nclc_low: 11 }).ok, false);
  assert.equal(core.parseGrade({ ...validGrade, cecr: "Z9" }).ok, false);
  assert.equal(core.parseGrade({ ...validGrade, flags: undefined }).ok, false);
  assert.equal(core.parseGrade({ ...validGrade, errors: [{ ...validGrade.errors[0], type: "inconnu" }] }).ok, false);
  assert.equal(core.parseGrade("n'importe quoi").ok, false);
  // fourchette au plus 2 niveaux, bas <= haut
  const wide = core.parseGrade({ ...validGrade, nclc_low: 4, nclc_high: 8 });
  assert.equal(wide.ok && wide.grade.nclc_high - wide.grade.nclc_low <= 2, true);
  const swapped = core.parseGrade({ ...validGrade, nclc_low: 7, nclc_high: 6 });
  assert.equal(swapped.ok && swapped.grade.nclc_low, 6);
});

/* ---------- (e) plan de travail déterministe ---------- */

test("plan de travail: déterministe, borné par la date d'examen, priorise la faiblesse", () => {
  const input = {
    today: "2026-10-19",
    examDate: "2026-11-30",
    sessionsPerWeek: 4,
    targets: { CO: 7, CE: 7, EE: 7, EO: 7 },
    levels: { CO: 7, CE: 7, EE: 5, EO: 6 },
    weaknessCounts: { accord: 5, connecteurs: 2 },
  } as const;
  const a = core.buildPlan(input);
  const b = core.buildPlan(input);
  assert.deepEqual(a, b, "même entrée, même plan");
  assert.equal(a.length, Math.round((42 / 7) * 4));
  assert.ok(a.every((s) => s.date >= "2026-10-19" && s.date <= "2026-11-30"));
  const by = (k: string) => a.filter((s) => s.skill === k).length;
  assert.ok(by("EE") > by("CO"), "la compétence la plus faible reçoit le plus de séances");
  assert.ok(by("EE") >= by("EO"));
  assert.ok(a.some((s) => s.focus.includes("Accords")), "la faiblesse la plus fréquente sert de thème");
  const dates = a.map((s) => s.date);
  assert.deepEqual([...dates].sort(), dates, "séances ordonnées dans le temps");
  // sans date d'examen : horizon par défaut de 4 semaines
  const c = core.buildPlan({ ...input, examDate: null });
  assert.ok(c.length >= 1 && c.every((s) => s.date <= "2026-11-16"));
});

/* ---------- (f) rejet d'un item dont la vérification échoue ---------- */

test("compréhension: rejet d'un item si la vérification échoue", () => {
  const qs: QuestionDoc[] = Array.from({ length: 10 }, (_, i) => ({ q: `Q${i}`, options: ["a", "b", "c", "d"], answer: i % 4, quote: "x", why: "y" }));
  const good = qs.map((q) => [q.answer]);
  assert.equal(core.itemPassesVerification(qs, good), true);
  const two = good.map((d) => [...d]);
  two[3] = [qs[3].answer, (qs[3].answer + 1) % 4];
  assert.equal(core.itemPassesVerification(qs, two), false, "deux options défendables : rejet");
  const wrong = good.map((d) => [...d]);
  wrong[5] = [(qs[5].answer + 1) % 4];
  assert.equal(core.itemPassesVerification(qs, wrong), false, "l'option défendable n'est pas la clé : rejet");
  const none = good.map((d) => [...d]);
  none[0] = [];
  assert.equal(core.itemPassesVerification(qs, none), false, "aucune option défendable : rejet");
  assert.equal(core.itemPassesVerification(qs, good.slice(0, 9)), false, "vérification incomplète : rejet");
});

/* ---------- Contrôles déterministes avant l'appel LLM ---------- */

const FR = "Bonjour, je vous écris pour vous dire que je suis très content de mon nouvel appartement et que vous êtes invités à la fête de samedi. ";

test("contrôles avant LLM: mots par tâche, français, taille", () => {
  assert.equal(core.preCheckWriting("tcf", "t1", FR.repeat(3)).ok, true);
  assert.equal(core.preCheckWriting("tcf", "t1", FR).ok, false, "trop court");
  assert.equal(core.preCheckWriting("tcf", "t1", FR.repeat(8)).ok, false, "trop long");
  assert.equal(core.preCheckWriting("tef", "b", FR.repeat(2)).ok, false, "TEF B : 200 mots minimum");
  assert.equal(core.preCheckWriting("tef", "a", FR.repeat(4)).ok, true);
  const english = "The weather is very nice today and we are going to the park with all of our friends and it is a good day for that ".repeat(4);
  assert.equal(core.preCheckWriting("tcf", "t1", english).ok, false, "texte non français");
  assert.equal(core.preCheckWriting("tcf", "t9", FR).ok, false, "tâche inconnue");
  assert.equal(core.preCheckSpeech("trop court", 20).ok, false);
  assert.equal(core.preCheckSpeech(FR.repeat(2), 500).ok, false, "enregistrement trop long");
  assert.equal(core.preCheckSpeech(FR.repeat(2), 120).ok, true);
});

test("tirages: lecture du flux IRCC et rejet des formats inattendus", () => {
  const feed = [
    { drawNumber: "437", drawDate: "2026-08-19", drawName: "French language proficiency (Version 2)", drawSize: "5,000", drawCRS: "382" },
    { drawNumber: "436", drawDate: "2026-08-18", drawName: "Provincial Nominee Program", drawSize: "1,000", drawCRS: "523" },
    { drawNumber: "435", drawDate: "2026-08-05", drawName: "Canadian Experience Class", drawSize: "3,000", drawCRS: "516" },
  ];
  const out = core.parseIrccFeed(feed);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { date: "2026-08-19", category: "french", invitations: 5000, crs: 382, n: 437 });
  assert.equal(core.parseIrccFeed({ rounds: feed }).length, 2);
  assert.deepEqual(core.parseIrccFeed("n'importe quoi"), []);
});

/* ---------- Contenu ---------- */

test("contenu: sujets, pages de guide, pages légales", () => {
  assert.ok(allTopicCount() >= 120, "12 sujets minimum par tâche et par examen");
  for (const exam of EXAM_LIST) {
    for (const mode of ["ecrit", "oral"] as const) {
      for (const t of mode === "ecrit" ? EXAMS[exam].writing : EXAMS[exam].speaking) {
        assert.ok(topicsFor(exam, mode, t.id).length >= 12, `${exam} ${mode} ${t.id}`);
      }
    }
  }
  assert.equal(findTopic("tcf-ecrit-t1-3")?.task, "t1");
  assert.equal(findTopic("tcf-ecrit-t9-1"), null);
  const params = allGuideParams();
  assert.ok(params.length >= 60 && params.length <= 100, `pages de guide : ${params.length}`);
  const slugs = new Set(params.map((p) => `${p.exam}/${p.slug}`));
  assert.equal(slugs.size, params.length, "pas de doublon");
  for (const p of params) {
    const g = buildGuide(p.exam, p.slug);
    assert.ok(g, `${p.exam}/${p.slug}`);
    assert.ok(guideWordCount(g!) >= 300, `${p.exam}/${p.slug} : ${guideWordCount(g!)} mots`);
    assert.ok(g!.sections.some((s) => s.table) || g!.cta.href === "/calculateur", "chaque page embarque une donnée ou un outil");
  }
  assert.equal(buildGuide("tcf", "inconnu"), null);
  assert.deepEqual(LEGAL.map((l) => l.slug).sort(), ["cgu", "confidentialite", "mentions", "non-affiliation"]);
  assert.ok(DRAWS_SEED.filter((d) => d.category === "french").length === 11);
});

/* ---------- Parcours complet (base en mémoire, services simulés) ---------- */

test("parcours: inscription, correction gratuite, paywall, webhook, correction payante, séries", async () => {
  resetMemoryDb();
  const { user } = await core.registerUser({ email: "Test@Exemple.com", password: "mot-de-passe-long", country: "maroc", exam: "tcf", ref: null }, "10.0.0.1");
  assert.equal(user.email, "test@exemple.com");
  assert.ok(user.pass_hash.startsWith("scrypt$") && !user.pass_hash.includes("mot-de-passe"));
  assert.equal((await core.loginUser("test@exemple.com", "mot-de-passe-long"))._id, user._id);
  await assert.rejects(core.loginUser("test@exemple.com", "mauvais-mot-de-passe"), { code: "login" });
  await assert.rejects(core.registerUser({ email: "test@exemple.com", password: "mot-de-passe-long" }, "10.0.0.2"), { code: "exists" });
  await assert.rejects(core.registerUser({ email: "court@exemple.com", password: "court" }, "10.0.0.3"), { code: "invalid" });

  const req = { user, skill: "EE" as const, exam: "tcf" as const, task: "t1", topicId: "tcf-ecrit-t1-1", topicText: "Sujet", text: FR.repeat(3) };
  // 1) correction gratuite
  const first = await core.gradeAttempt(req);
  assert.equal(first.free, true);
  assert.ok(first.grade.nclc_low <= first.grade.nclc_high);
  // 2) paywall : la correction gratuite est utilisée
  await assert.rejects(core.gradeAttempt(req), { code: "paywall" });
  // 3) webhook simulé : pass actif
  const body = orderBody("ORD-100", user._id, "111");
  const wh = await core.handleWebhook(body, sign(body));
  assert.equal(wh.status, 200);
  assert.equal((await core.handleWebhook(body, sign(body))).body, "déjà traité");
  let ent = await core.entitlement(user._id);
  assert.equal(ent.hasPass, true);
  assert.equal(ent.correctionsLeft, 40);
  // 4) correction payante
  const paid = await core.gradeAttempt(req);
  assert.equal(paid.free, false);
  ent = await core.entitlement(user._id);
  assert.equal(ent.correctionsLeft, 39);
  // 5) plafond de 8 corrections par jour
  for (let i = 0; i < 6; i++) await core.gradeAttempt(req);
  await assert.rejects(core.gradeAttempt(req), { code: "daily" });
  // 6) série de compréhension écrite, puis estimation
  const item = await core.nextItem(user, "CE", "B1");
  assert.ok(item);
  const sub = await core.submitItem(user, item!._id, item!.questions.map((q) => q.answer));
  assert.equal(sub.correct, 10);
  await assert.rejects(core.submitItem(user, item!._id, item!.questions.map((q) => q.answer)), { code: "done" });
  const est = await core.estimates(user._id);
  assert.equal(est.EE?.low, 4, "biais conservateur : niveau bas des tentatives récentes");
  // 7) remboursement : le pass est révoqué
  const refund = orderBody("ORD-100", user._id, "111", "order_refunded");
  await core.handleWebhook(refund, sign(refund));
  assert.equal((await core.entitlement(user._id)).hasPass, false);
  // 8) suppression du compte : tout est effacé
  await core.deleteAccount(user);
  assert.equal(await (await col("users")).countDocuments({ _id: user._id }), 0);
  assert.equal(await (await col("attempts")).countDocuments({ user: user._id }), 0);
});

test("parcours: série gratuite unique par type, sans pass", async () => {
  resetMemoryDb();
  const { user } = await core.registerUser({ email: "autre@exemple.com", password: "mot-de-passe-long" }, "10.0.1.1");
  const a = await core.nextItem(user, "CE", "A2");
  await core.submitItem(user, a!._id, a!.questions.map(() => 0));
  const b = await core.nextItem(user, "CE", "A2");
  await assert.rejects(core.submitItem(user, b!._id, b!.questions.map(() => 0)), { code: "paywall" });
  assert.equal(await core.canStartItem(user, "CE"), false);
  assert.equal(await core.canStartItem(user, "CO"), true);
  const co = await core.nextItem(user, "CO", "B2");
  assert.ok(co?.audio_id, "une série de compréhension orale a un audio");
  const audio = await core.getAudio(co!.audio_id!);
  assert.ok(audio && audio.length > 0);
});

test("abus: limite de comptes gratuits par réseau, garde-fou de coût", async () => {
  resetMemoryDb();
  for (let i = 0; i < 3; i++) await core.registerUser({ email: `u${i}@exemple.com`, password: "mot-de-passe-long" }, "10.9.9.9");
  await assert.rejects(core.registerUser({ email: "u4@exemple.com", password: "mot-de-passe-long" }, "10.9.9.9"), { code: "abuse" });
  // plafond : à 80 % les corrections gratuites sont suspendues, à 100 % tout est suspendu
  await core.addCost(12.5);
  await assert.rejects(core.guardCost("free"), { code: "budget_free" });
  await core.guardCost("paid");
  await core.addCost(3);
  await assert.rejects(core.guardCost("paid"), { code: "budget" });
  await assert.rejects(core.guardCost("any"), { code: "budget" });
});

test("parrainage: une correction gratuite en plus", async () => {
  resetMemoryDb();
  const { user: parrain } = await core.registerUser({ email: "parrain@exemple.com", password: "mot-de-passe-long" }, "10.2.0.1");
  const { user: filleul } = await core.registerUser({ email: "filleul@exemple.com", password: "mot-de-passe-long", ref: parrain._id }, "10.2.0.2");
  assert.equal(filleul.bonus_corrections, 1);
  const req = { user: filleul, skill: "EE" as const, exam: "tcf" as const, task: "t1", topicId: null, topicText: "Sujet", text: FR.repeat(3) };
  await core.gradeAttempt(req);
  await core.gradeAttempt(req); // bonus de parrainage
  await assert.rejects(core.gradeAttempt(req), { code: "paywall" });
});

test("sessions JWT et mots de passe", async () => {
  const token = await core.signSession("u-42");
  assert.equal(await core.verifySession(token), "u-42");
  assert.equal(await core.verifySession(token + "x"), null);
  assert.equal(await core.verifySession("n.importe.quoi"), null);
  const h = await core.hashPassword("mot-de-passe-long");
  assert.equal(await core.verifyPassword("mot-de-passe-long", h), true);
  assert.equal(await core.verifyPassword("autre-mot-de-passe", h), false);
});

/* ---------- Données officielles vérifiées le 18/10/2026 ---------- */

// Tables d'équivalence d'IRCC (page « Language test equivalency charts »), ligne par niveau NCLC 10 -> 4.
// Ordre des colonnes : lecture (CE), écriture (EE), écoute (CO), expression orale (EO).
const OFFICIAL: Record<"tcf" | "tef", Record<number, [string, string, string, string]>> = {
  tcf: {
    10: ["549-699", "16-20", "549-699", "16-20"], 9: ["524-548", "14-15", "523-548", "14-15"],
    8: ["499-523", "12-13", "503-522", "12-13"], 7: ["453-498", "10-11", "458-502", "10-11"],
    6: ["406-452", "7-9", "398-457", "7-9"], 5: ["375-405", "6-6", "369-397", "6-6"], 4: ["342-374", "4-5", "331-368", "4-5"],
  },
  // TEF Canada, colonne « équivalence ancien score » (celle qu'IRCC exige pour l'Entrée express).
  tef: {
    10: ["263-300", "393-450", "316-360", "393-450"], 9: ["248-262", "371-392", "298-315", "371-392"],
    8: ["233-247", "349-370", "280-297", "349-370"], 7: ["207-232", "310-348", "249-279", "310-348"],
    6: ["181-206", "271-309", "217-248", "271-309"], 5: ["151-180", "226-270", "181-216", "226-270"], 4: ["121-150", "181-225", "145-180", "181-225"],
  },
};

test("conversions: identiques aux tables officielles d'IRCC, niveau par niveau", () => {
  for (const exam of ["tcf", "tef"] as const) {
    for (let n = 4; n <= 10; n++) {
      const [ce, ee, co, eo] = OFFICIAL[exam][n];
      const got = (sk: "CO" | "CE" | "EE" | "EO") => { const r = nclcToScoreRange(exam, sk, n); return `${r.min}-${r.max}`; };
      assert.deepEqual([got("CE"), got("EE"), got("CO"), got("EO")], [ce, ee, co, eo], `${exam} NCLC ${n}`);
    }
  }
});

test("tirages: lecture d'un extrait réel du flux officiel d'IRCC (ee_rounds_123_en.json)", () => {
  const link = (n: string) => `<a href='/content/canadasite/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds/invitations.html?q=${n}'>${n}</a>`;
  const real = {
    classes: "wb-tables",
    rounds: [
      { drawNumber: "450", drawNumberURL: link("450"), drawDate: "2026-10-16", drawDateFull: "October 16, 2026", drawName: "French-Language proficiency 2026-Version 2", drawSize: "5,000", drawCRS: "435", drawText2: "Federal Skilled Worker Program, Canadian Experience Class and Federal Skilled Trades Program", dd1: "749", dd18: "229,456" },
      { drawNumber: "449", drawNumberURL: link("449"), drawDate: "2026-10-15", drawDateFull: "October 15, 2026", drawName: "Canadian Experience Class", drawSize: "2,500", drawCRS: "519", drawText2: "Canadian Experience Class" },
      { drawNumber: "448", drawNumberURL: link("448"), drawDate: "2026-10-13", drawDateFull: "October 13, 2026", drawName: "Provincial Nominee Program", drawSize: "752", drawCRS: "772" },
      { drawNumber: "447", drawNumberURL: link("447"), drawDate: "2026-10-01", drawDateFull: "October 1, 2026", drawName: "Trades Occupations, 2026-Version 3", drawSize: "3,500", drawCRS: "476" },
      { drawNumber: "388", drawNumberURL: link("388"), drawDate: "2025-12-17", drawDateFull: "December 17, 2025", drawName: "French language proficiency (Version 1)", drawSize: "6,000", drawCRS: "399" },
    ],
  };
  const out = core.parseIrccFeed(real);
  assert.deepEqual(out, [
    { date: "2026-10-16", category: "french", invitations: 5000, crs: 435, n: 450 },
    { date: "2026-10-15", category: "cec", invitations: 2500, crs: 519, n: 449 },
    { date: "2025-12-17", category: "french", invitations: 6000, crs: 399, n: 388 },
  ]);
  // Les tirages de départ de Cap7 correspondent à ces enregistrements officiels.
  const seed = (d: string, c: string) => DRAWS_SEED.find((x) => x.date === d && x.category === c);
  assert.equal(seed("2026-10-16", "french")?.crs, 435);
  assert.equal(seed("2026-10-15", "cec")?.crs, 519);
  assert.equal(core.IRCC_FEED_URL, "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json");
});

test("OpenAI: formulaire de transcription selon le modèle", () => {
  const blob = new Blob(["x"], { type: "audio/webm" });
  const recent = core.buildTranscriptionForm("gpt-transcribe", blob, "a.webm");
  assert.deepEqual(recent.getAll("languages[]"), ["fr"]);
  assert.equal(recent.get("language"), null, "ne jamais envoyer language et languages ensemble");
  assert.equal(recent.get("response_format"), null);
  const legacy = core.buildTranscriptionForm("gpt-4o-transcribe", blob, "a.webm");
  assert.equal(legacy.get("language"), "fr");
  assert.equal(legacy.getAll("languages[]").length, 0);
  assert.ok(String(recent.get("prompt")).length > 20);
  assert.ok(!/[<>]/.test(String(recent.get("prompt"))));
});

/* =====================================================================
   Multi-fournisseur IA : choix, repli, annulation, quota, plafonds, adaptateurs
   ===================================================================== */

const ENV_KEYS = [
  "GRADER_PROVIDER", "ITEMS_PROVIDER", "TRANSCRIBE_PROVIDER", "TTS_PROVIDER", "GEMINI_MODEL_FAST", "GEMINI_MODEL_SMART", "GEMINI_TIER",
  "MAX_DAILY_CALLS", "MAX_DAILY_CALLS_GEMINI", "MAX_DAILY_LLM_USD", "AI_CALL_TIMEOUT_MS", "MOCK_AI", "MOCK_FAIL", "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY", "GEMINI_API_KEY", "PRICE_GEMINI_SMART_IN_PER_MTOK", "PRICE_GEMINI_SMART_OUT_PER_MTOK",
];
const savedEnv: Record<string, string | undefined> = {};
function cleanEnv() {
  for (const k of ENV_KEYS) { if (!(k in savedEnv)) savedEnv[k] = process.env[k]; delete process.env[k]; }
  core.setMockBehavior(null);
  core.resetMockCalls();
  resetMemoryDb();
  process.env.MAX_DAILY_LLM_USD = "15";
}

let ipCounter = 0;
async function newUser() {
  const n = ++ipCounter;
  const { user } = await core.registerUser({ email: `multi${n}@exemple.com`, password: "mot-de-passe-long" }, `10.7.${n}.1`);
  return user;
}
const gradeReq = (user: Awaited<ReturnType<typeof newUser>>, signal?: AbortSignal) =>
  ({ user, skill: "EE" as const, exam: "tcf" as const, task: "t1", topicId: "tcf-ecrit-t1-1", topicText: "Sujet", text: FR.repeat(3), signal });
const calls = () => core.mockCalls.map((c) => c.provider);
const attemptsOf = async (uid: string) => (await col("attempts")).countDocuments({ user: uid });

test("fournisseurs: choix par tâche, défaut gemini, valeurs invalides, modèles", () => {
  cleanEnv();
  assert.equal(core.providerFor("grader", {}), "gemini");
  assert.equal(core.providerFor("grader", { GRADER_PROVIDER: " Anthropic " }), "anthropic");
  assert.equal(core.providerFor("items", { ITEMS_PROVIDER: "anthropic" }), "anthropic");
  assert.equal(core.providerFor("transcribe", { TRANSCRIBE_PROVIDER: "openai" }), "openai");
  assert.equal(core.providerFor("tts", { TTS_PROVIDER: "openai" }), "openai");
  assert.equal(core.providerFor("transcribe", { TRANSCRIBE_PROVIDER: "anthropic" }), "gemini", "valeur non autorisée pour cette tâche");
  assert.equal(core.providerFor("items", { ITEMS_PROVIDER: "openai" }), "gemini");
  assert.equal(core.modelFor("anthropic", "grader", "smart", false, {}), "claude-sonnet-5-5");
  assert.equal(core.modelFor("anthropic", "items", "fast", false, {}), "claude-haiku-5-5");
  assert.equal(core.modelFor("gemini", "grader", "smart", false, {}), "gemini-3.8-flash");
  assert.equal(core.modelFor("gemini", "items", "fast", false, {}), "gemini-3.5-flash-lite");
  assert.equal(core.modelFor("gemini", "transcribe", "smart", false, {}), "gemini-3.8-flash");
  assert.equal(core.modelFor("gemini", "tts", "smart", false, {}), "gemini-3.8-flash-lite-tts");
  assert.equal(core.modelFor("openai", "transcribe", "smart", false, {}), "gpt-transcribe");
  assert.equal(core.modelFor("openai", "tts", "smart", false, {}), "gpt-4o-mini-tts");
  assert.equal(core.modelFor("gemini", "grader", "smart", true, { GEMINI_MODEL_FAST: "f" }), "f", "réessai avec le modèle rapide s'il est renseigné");
  assert.equal(core.modelFor("gemini", "grader", "smart", true, {}), "gemini-3.8-flash", "sinon même modèle");
  assert.equal(core.modelFor("gemini", "tts", "smart", true, { GEMINI_MODEL_FAST: "f" }), "gemini-3.8-flash-lite-tts", "le TTS garde son modèle");
});

test("repli: échec, 429 ou délai du fournisseur choisi -> une seule bascule sur Gemini", async () => {
  for (const action of ["error", "429", "timeout"] as const) {
    cleanEnv();
    process.env.GRADER_PROVIDER = "anthropic";
    core.setMockBehavior((p) => (p === "anthropic" ? action : "ok"));
    const user = await newUser();
    const out = await core.gradeAttempt(gradeReq(user));
    assert.deepEqual(calls(), ["anthropic", "gemini"], action);
    assert.equal(out.free, true);
    const u = await core.usageToday();
    assert.deepEqual([u.calls, u.calls_anthropic, u.calls_gemini], [2, 1, 1], "les deux appels sont comptés");
  }
});

test("repli: Gemini choisi -> un seul réessai (GEMINI_MODEL_FAST), jamais de boucle, quota intact", async () => {
  cleanEnv();
  process.env.GRADER_PROVIDER = "gemini";
  process.env.GEMINI_MODEL_SMART = "smart-x";
  process.env.GEMINI_MODEL_FAST = "fast-x";
  const user = await newUser();
  core.setMockBehavior(() => "error");
  await assert.rejects(core.gradeAttempt(gradeReq(user)), { code: "llm" });
  assert.deepEqual(core.mockCalls.map((c) => c.model), ["smart-x", "fast-x"], "exactement deux appels");
  assert.equal((await core.freeStatus(user)).EE, true, "un échec ne consomme pas l'essai gratuit");
  assert.equal(await attemptsOf(user._id), 0);
  // sans GEMINI_MODEL_FAST : même modèle pour le réessai
  core.resetMockCalls();
  delete process.env.GEMINI_MODEL_FAST;
  await assert.rejects(core.gradeAttempt(gradeReq(user)), { code: "llm" });
  assert.deepEqual(core.mockCalls.map((c) => c.model), ["smart-x", "smart-x"]);
  // le premier appel échoue, le réessai réussit
  core.resetMockCalls();
  process.env.GEMINI_MODEL_FAST = "fast-x";
  core.setMockBehavior((_p, _t, model) => (model === "smart-x" ? "error" : "ok"));
  const ok = await core.gradeAttempt(gradeReq(user));
  assert.equal(ok.free, true);
  assert.equal(core.mockCalls.length, 2);
  // 429 sur les deux appels : message dédié, toujours deux appels au plus
  cleanEnv();
  process.env.GRADER_PROVIDER = "anthropic";
  core.setMockBehavior(() => "429");
  const u2 = await newUser();
  await assert.rejects(core.gradeAttempt(gradeReq(u2)), { code: "rate", status: 429 });
  assert.equal(core.mockCalls.length, 2, "principal puis Gemini, pas davantage");
  assert.equal(await attemptsOf(u2._id), 0);
});

test("annulation: propagée, aucun repli, rien consommé, verrou libéré", async () => {
  cleanEnv();
  const user = await newUser();
  const ctl = new AbortController();
  core.setMockBehavior(() => "hang");
  const pending = core.gradeAttempt(gradeReq(user, ctl.signal));
  await new Promise((r) => setTimeout(r, 20));
  ctl.abort();
  await assert.rejects(pending, { code: "aborted", status: 499 });
  assert.equal(core.mockCalls.length, 1, "pas de repli après une annulation");
  assert.equal((await core.freeStatus(user)).EE, true, "l'essai gratuit n'est pas consommé");
  assert.equal(await attemptsOf(user._id), 0);
  // signal déjà annulé : aucun appel
  core.resetMockCalls();
  const done = new AbortController();
  done.abort();
  await assert.rejects(core.gradeAttempt(gradeReq(user, done.signal)), { code: "aborted" });
  assert.equal(core.mockCalls.length, 0);
  // résultat obtenu mais annulé juste avant l'enregistrement : rien n'est consommé
  const late = new AbortController();
  core.setMockBehavior(() => { late.abort(); return "ok"; });
  await assert.rejects(core.gradeAttempt(gradeReq(user, late.signal)), { code: "aborted" });
  assert.equal((await core.freeStatus(user)).EE, true);
  assert.equal(await attemptsOf(user._id), 0);
  // le verrou est libéré : une nouvelle demande réussit et consomme l'essai
  core.setMockBehavior(null);
  const ok = await core.gradeAttempt(gradeReq(user));
  assert.equal(ok.free, true);
  assert.equal((await core.freeStatus(user)).EE, false);
});

test("double envoi: un seul envoi à la fois par utilisateur", async () => {
  cleanEnv();
  const user = await newUser();
  const ctl = new AbortController();
  core.setMockBehavior(() => "hang");
  const first = core.gradeAttempt(gradeReq(user, ctl.signal));
  await new Promise((r) => setTimeout(r, 20));
  await assert.rejects(core.gradeAttempt(gradeReq(user)), { code: "busy", status: 409 });
  assert.equal(core.mockCalls.length, 1, "le second envoi n'a déclenché aucun appel");
  ctl.abort();
  await assert.rejects(first, { code: "aborted" });
  // un autre utilisateur n'est pas bloqué
  core.setMockBehavior(null);
  const other = await newUser();
  assert.equal((await core.gradeAttempt(gradeReq(other))).free, true);
});

test("plafonds: appels totaux, appels Gemini, dollars ; message propre, jamais de plantage", async () => {
  cleanEnv();
  process.env.MAX_DAILY_CALLS = "3";
  for (let i = 0; i < 3; i++) await core.countCall("gemini");
  await assert.rejects(core.guardCaps("gemini", "any"), { code: "budget", status: 503 });
  await assert.rejects(core.guardCaps("anthropic", "any"), { code: "budget" });
  process.env.MAX_DAILY_CALLS = "0"; // 0 = désactivé
  await core.guardCaps("gemini", "any");
  process.env.MAX_DAILY_CALLS_GEMINI = "3";
  await assert.rejects(core.guardCaps("gemini", "any"), { code: "budget" });
  await core.guardCaps("anthropic", "any"); // le plafond Gemini ne bloque pas les autres fournisseurs
  process.env.MAX_DAILY_CALLS_GEMINI = "0";
  await core.guardCaps("gemini", "any");

  // de bout en bout : le plafond Gemini atteint pendant le réessai donne un message propre, sans consommer le quota
  cleanEnv();
  process.env.GRADER_PROVIDER = "gemini";
  process.env.MAX_DAILY_CALLS_GEMINI = "1";
  const user = await newUser();
  core.setMockBehavior(() => "error");
  await assert.rejects(core.gradeAttempt(gradeReq(user)), { code: "budget", status: 503 });
  assert.equal(core.mockCalls.length, 1, "le réessai n'a pas contourné le plafond");
  assert.equal((await core.freeStatus(user)).EE, true);
  // les plafonds sont lus dans usage_daily : compteurs par fournisseur
  const u = await core.usageToday();
  assert.deepEqual([u.calls, u.calls_gemini, u.calls_anthropic, u.calls_openai], [1, 1, 0, 0]);
  // plafond en dollars atteint : refus propre
  cleanEnv();
  await core.addCost(15);
  const user2 = await newUser();
  await assert.rejects(core.gradeAttempt(gradeReq(user2)), { code: "budget" });
  assert.equal(core.mockCalls.length, 0);
});

test("coûts: palier Gemini free = 0, paid = prix des variables PRICE_*", () => {
  const prices = { PRICE_GEMINI_SMART_IN_PER_MTOK: "1", PRICE_GEMINI_SMART_OUT_PER_MTOK: "2" };
  assert.equal(core.geminiCostUsd("smart", 1_000_000, 1_000_000, { GEMINI_TIER: "free", ...prices }), 0);
  assert.equal(core.geminiCostUsd("smart", 1_000_000, 1_000_000, { GEMINI_TIER: "paid", ...prices }), 3);
  assert.equal(core.geminiCostUsd("smart", 1_000_000, 1_000_000, { ...prices }), 3, "palier non déclaré = paid");
  assert.equal(core.geminiCostUsd("fast", 1_000_000, 1_000_000, { GEMINI_TIER: "paid" }), 0, "prix absents = 0");
  assert.equal(core.geminiTier({ GEMINI_TIER: " FREE " }), "free");
});

test("palier gratuit: avertissement au démarrage seulement, aucun blocage", async () => {
  const w = core.startupWarnings({ GEMINI_API_KEY: "k", GEMINI_TIER: "free" });
  assert.equal(w.length, 1);
  assert.match(w[0], /réutiliser les contenus/);
  assert.equal(core.startupWarnings({ GEMINI_API_KEY: "k", GEMINI_TIER: "paid", PRICE_GEMINI_SMART_IN_PER_MTOK: "1" }).length, 0);
  assert.match(core.startupWarnings({ GEMINI_API_KEY: "k", GEMINI_TIER: "paid" })[0], /PRICE_GEMINI/);
  assert.equal(core.startupWarnings({ GRADER_PROVIDER: "anthropic", ITEMS_PROVIDER: "anthropic", TRANSCRIBE_PROVIDER: "openai", TTS_PROVIDER: "openai" }).length, 0, "Gemini inutilisé : rien à signaler");
  assert.match(core.startupWarnings({ GRADER_PROVIDER: "claude", GEMINI_TIER: "paid", PRICE_GEMINI_SMART_IN_PER_MTOK: "1" })[0], /GRADER_PROVIDER=claude/);
  // en production comme en local, le palier free ne bloque rien
  cleanEnv();
  process.env.GEMINI_TIER = "free";
  const user = await newUser();
  assert.equal((await core.gradeAttempt(gradeReq(user))).free, true);
  assert.equal((await core.usageToday()).usd, 0, "coût compté à 0");
});

test("mode simulé par fournisseur: séries, transcription et voix passent par le fournisseur choisi", async () => {
  cleanEnv();
  process.env.ITEMS_PROVIDER = "anthropic";
  process.env.TTS_PROVIDER = "openai";
  process.env.TRANSCRIBE_PROVIDER = "openai";
  const user = await newUser();
  const co = await core.nextItem(user, "CO", "B1");
  assert.ok(co?.audio_id);
  const t = core.mockCalls.map((c) => `${c.task}:${c.provider}`);
  assert.deepEqual(t, ["items:anthropic", "items:anthropic", "tts:openai"], "génération, vérification, voix");
  assert.equal((await core.getAudioWithMime(co!.audio_id!))?.mime, "audio/mpeg");
  // voix OpenAI en échec : repli sur Gemini, audio WAV
  core.resetMockCalls();
  core.setMockBehavior((p, task) => (p === "openai" && task === "tts" ? "429" : "ok"));
  const user2 = await newUser();
  const co2 = await core.nextItem(user2, "CO", "B2");
  const stored = await core.getAudioWithMime(co2!.audio_id!);
  assert.equal(stored?.mime, "audio/wav");
  assert.equal(stored?.data.toString("ascii", 0, 4), "RIFF");
  // transcription : OpenAI en échec -> Gemini
  core.resetMockCalls();
  core.setMockBehavior((p) => (p === "openai" ? "timeout" : "ok"));
  const text = await core.transcribeAudio(new Blob(["x"], { type: "audio/webm" }), "a.webm", 20);
  assert.ok(text.length > 20);
  assert.deepEqual(calls(), ["openai", "gemini"]);
  // transcription annulée
  core.resetMockCalls();
  const ctl = new AbortController();
  core.setMockBehavior(() => "hang");
  const pending = core.transcribeAudio(new Blob(["x"]), "a.webm", 20, ctl.signal);
  await new Promise((r) => setTimeout(r, 15));
  ctl.abort();
  await assert.rejects(pending, { code: "aborted" });
  assert.equal(core.mockCalls.length, 1);
});

test("audio: enveloppe WAV, sortie Gemini, type MIME d'entrée", () => {
  const pcm = Buffer.alloc(100, 1);
  const wav = core.wrapPcmAsWav(pcm, 24000);
  assert.equal(wav.length, 144);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(40), 100);
  assert.equal(core.geminiAudioToWav(wav, "audio/wav").data.length, 144, "WAV déjà complet : inchangé");
  const raw = core.geminiAudioToWav(pcm, "audio/L16;codec=pcm;rate=16000");
  assert.equal(raw.mime, "audio/wav");
  assert.equal(raw.data.readUInt32LE(24), 16000);
  assert.equal(core.geminiAudioMime("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(core.geminiAudioMime("audio/mp4"), "audio/m4a");
  assert.equal(core.geminiAudioMime(""), "audio/webm");
});

test("Gemini: conversion du schéma vers responseSchema", () => {
  const out = core.toGeminiSchema({
    type: "object",
    properties: { n: { type: "integer", minimum: 0, maximum: 3 }, tags: { type: "array", items: { type: "string" } }, e: { type: "string", enum: ["a", "b"] } },
    required: ["n"],
  }) as { type: string; properties: Record<string, Record<string, unknown>>; required: string[] };
  assert.equal(out.type, "OBJECT");
  assert.deepEqual(out.properties.n, { type: "INTEGER" }, "mots-clés non pris en charge retirés");
  assert.deepEqual(out.properties.tags, { type: "ARRAY", items: { type: "STRING" } });
  assert.deepEqual(out.properties.e, { type: "STRING", enum: ["a", "b"] });
  assert.deepEqual(out.required, ["n"]);
});

test("confidentialité: fournisseurs réellement actifs d'après l'environnement", () => {
  const saved = process.env.MOCK_EXTERNALS;
  process.env.MOCK_EXTERNALS = ""; // hors mode simulé, seules les clés présentes comptent
  try {
    const a = core.activeProviders({ GRADER_PROVIDER: "anthropic", ITEMS_PROVIDER: "anthropic", TRANSCRIBE_PROVIDER: "openai", TTS_PROVIDER: "openai", ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" });
    assert.deepEqual(a.map((x) => x.provider), ["anthropic", "openai"], "pas de clé Gemini : Gemini n'est pas actif, même en repli");
    const b = core.activeProviders({ GRADER_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: "g" });
    assert.deepEqual(b.map((x) => x.provider), ["anthropic", "gemini"]);
    assert.ok(b[1].roles.includes("repli si le fournisseur principal échoue"));
    const c = core.activeProviders({ GEMINI_API_KEY: "g" });
    assert.deepEqual(c.map((x) => x.provider), ["gemini"]);
    assert.equal(c[0].roles.length, 5, "quatre tâches et le repli");
    const free = providersSection(c, "free");
    assert.ok(free.p.some((t) => t.includes("palier gratuit") && t.includes("réutiliser les contenus envoyés pour améliorer ses produits")));
    assert.ok(providersSection(c, "paid").p.some((t) => t.includes("réutiliser les contenus envoyés pour améliorer ses produits")), "la mention figure aussi avec le palier payant");
    const none = providersSection(a, "free");
    assert.ok(!none.p.join(" ").includes("Gemini"), "aucune mention de Google si Gemini n'est pas actif");
    assert.ok(none.p.some((t) => t.startsWith("Anthropic")) && none.p.some((t) => t.startsWith("OpenAI")));
  } finally {
    process.env.MOCK_EXTERNALS = saved;
  }
});

/* ---------- Adaptateurs réels, avec fetch simulé (aucun appel réseau) ---------- */

type FetchCall = { url: string; init: RequestInit };
function stubFetch(handler: (c: FetchCall) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const seen: FetchCall[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    seen.push(call);
    return await handler(call);
  }) as typeof fetch;
  return { seen, restore: () => { globalThis.fetch = original; } };
}
const hangUntilAbort = (init: RequestInit) => new Promise<Response>((_, reject) => {
  init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const geminiText = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 10 } });
const taskDef = EXAMS.tcf.writing[0];

test("adaptateur Gemini: requête generateContent (modèle, clé, responseSchema, systemInstruction), coût, parsing", async () => {
  cleanEnv();
  process.env.MOCK_AI = "0";
  process.env.GRADER_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "cle-de-test";
  process.env.GEMINI_TIER = "paid";
  process.env.PRICE_GEMINI_SMART_IN_PER_MTOK = "1";
  process.env.PRICE_GEMINI_SMART_OUT_PER_MTOK = "2";
  const f = stubFetch(() => json(geminiText(validGrade)));
  try {
    const { grade, costUsd } = await core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3));
    assert.equal(grade.nclc_high, 7);
    assert.equal(f.seen.length, 1);
    assert.equal(f.seen[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    const headers = f.seen[0].init.headers as Record<string, string>;
    assert.equal(headers["x-goog-api-key"], "cle-de-test");
    const body = JSON.parse(String(f.seen[0].init.body));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal(body.generationConfig.responseSchema.type, "OBJECT");
    assert.equal(body.generationConfig.responseSchema.properties.nclc_low.type, "INTEGER");
    assert.ok(body.generationConfig.maxOutputTokens >= 4096, "marge pour la réflexion");
    assert.ok(body.systemInstruction.parts[0].text.includes("NCLC"));
    assert.ok(body.contents[0].parts[0].text.includes("<production>"));
    assert.ok(Math.abs(costUsd - (100 * 1 + 60 * 2) / 1_000_000) < 1e-12, "la réflexion est comptée comme de la sortie");
    assert.ok(Math.abs((await core.usageToday()).usd - costUsd) < 1e-12);
  } finally { f.restore(); }
});

test("adaptateur Anthropic: requête /v1/messages (en-têtes, outil forcé, modèle) et lecture du bloc tool_use", async () => {
  cleanEnv();
  process.env.MOCK_AI = "0";
  process.env.GRADER_PROVIDER = "anthropic";
  process.env.ANTHROPIC_API_KEY = "cle-a";
  const f = stubFetch(() => json({ content: [{ type: "tool_use", name: "submit_grade", input: validGrade }], usage: { input_tokens: 1000, output_tokens: 500 } }));
  try {
    const { grade } = await core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3));
    assert.equal(grade.cecr, "B1");
    assert.equal(f.seen[0].url, "https://api.anthropic.com/v1/messages");
    const h = f.seen[0].init.headers as Record<string, string>;
    assert.equal(h["x-api-key"], "cle-a");
    assert.equal(h["anthropic-version"], "2023-06-01");
    const body = JSON.parse(String(f.seen[0].init.body));
    assert.equal(body.model, "claude-sonnet-5-5");
    assert.deepEqual(body.tool_choice, { type: "tool", name: "submit_grade" });
    assert.equal(body.tools[0].input_schema.type, "object");
    assert.equal(body.temperature, undefined);
  } finally { f.restore(); }
});

test("fiabilité réelle: délai maximum par appel, 429 puis repli réussi, réponse inexploitable, annulation du fetch", async () => {
  cleanEnv();
  process.env.MOCK_AI = "0";
  process.env.GEMINI_API_KEY = "g";
  process.env.GRADER_PROVIDER = "gemini";
  process.env.AI_CALL_TIMEOUT_MS = "40";
  // délai dépassé sur les deux appels : deux fetch exactement, durée bornée, message propre
  let f = stubFetch((c) => hangUntilAbort(c.init));
  try {
    const t0 = Date.now();
    await assert.rejects(core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3)), { code: "llm", status: 502 });
    assert.equal(f.seen.length, 2);
    assert.ok(Date.now() - t0 < 1500);
  } finally { f.restore(); }
  // 429 puis succès au réessai
  let n = 0;
  f = stubFetch(() => (++n === 1 ? json({ error: "quota" }, 429) : json(geminiText(validGrade))));
  try {
    const out = await core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3));
    assert.equal(out.grade.nclc_low, 6);
    assert.equal(f.seen.length, 2);
  } finally { f.restore(); }
  // JSON invalide puis JSON valide : le réessai est utilisé, jamais plus de deux appels
  n = 0;
  f = stubFetch(() => (++n === 1 ? json({ candidates: [{ content: { parts: [{ text: "pas du JSON" }] } }] }) : json(geminiText(validGrade))));
  try {
    await core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3));
    assert.equal(f.seen.length, 2);
  } finally { f.restore(); }
  // annulation de l'utilisateur : le fetch est annulé, pas de repli
  const ctl = new AbortController();
  f = stubFetch((c) => hangUntilAbort(c.init));
  try {
    process.env.AI_CALL_TIMEOUT_MS = "5000";
    const pending = core.callGrader("EE", "tcf", taskDef, "Sujet", FR.repeat(3), ctl.signal);
    await new Promise((r) => setTimeout(r, 20));
    ctl.abort();
    await assert.rejects(pending, { code: "aborted" });
    assert.equal(f.seen.length, 1);
    assert.equal((f.seen[0].init.signal as AbortSignal).aborted, true, "l'annulation est propagée à la requête sortante");
  } finally { f.restore(); }
});

test("adaptateurs audio réels: transcription Gemini (inlineData) et voix Gemini (responseModalities)", async () => {
  cleanEnv();
  process.env.MOCK_AI = "0";
  process.env.GEMINI_API_KEY = "g";
  // transcription
  let f = stubFetch(() => json({ candidates: [{ content: { parts: [{ text: "  bonjour tout le monde  " }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 10 } }));
  try {
    const text = await core.transcribeAudio(new Blob(["abc"], { type: "audio/webm;codecs=opus" }), "a.webm", 12);
    assert.equal(text, "bonjour tout le monde");
    assert.ok(f.seen[0].url.endsWith("/models/gemini-3.8-flash:generateContent"));
    const body = JSON.parse(String(f.seen[0].init.body));
    const part = body.contents[0].parts[1].inlineData;
    assert.equal(part.mimeType, "audio/webm");
    assert.equal(Buffer.from(part.data, "base64").toString(), "abc");
  } finally { f.restore(); }
  // voix : PCM brut renvoyé par Gemini -> WAV
  const pcm = Buffer.alloc(480, 2).toString("base64");
  f = stubFetch(() => json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: pcm } }] } }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 400 } }));
  try {
    const audio = await core.synthesize("Bonjour à tous.");
    assert.equal(audio.mime, "audio/wav");
    assert.equal(audio.data.toString("ascii", 0, 4), "RIFF");
    assert.equal(audio.data.length, 44 + 480);
    assert.ok(f.seen[0].url.endsWith("/models/gemini-3.8-flash-lite-tts:generateContent"));
    const body = JSON.parse(String(f.seen[0].init.body));
    assert.deepEqual(body.generationConfig.responseModalities, ["AUDIO"]);
    assert.ok(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName);
    assert.equal(body.contents[0].parts[0].text, "Bonjour à tous.", "le texte est lu tel quel");
  } finally { f.restore(); }
});

test("nettoyage: variables d'environnement restaurées", () => {
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  process.env.MOCK_EXTERNALS = "1";
  core.setMockBehavior(null);
  assert.equal(core.isMock(), true);
});

/* =====================================================================
   Connexion Google, e-mails (SMTP Google), mot de passe, suppression de compte
   ===================================================================== */

import net from "node:net";

const ACCOUNT_ENV = ["SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "FROM_EMAIL", "RESEND_API_KEY", "MOCK_MAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXT_PUBLIC_SITE_URL"];
const savedAcc: Record<string, string | undefined> = {};
function accountEnv(set: Record<string, string> = {}) {
  for (const k of ACCOUNT_ENV) { if (!(k in savedAcc)) savedAcc[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, set);
  core.mockOutbox.length = 0;
  resetMemoryDb();
}
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret-xyz", NEXT_PUBLIC_SITE_URL: "https://cap7.example" };
let acc = 0;
const ipOf = () => `10.8.${++acc}.1`;

test("SMTP Google: configuration par défaut (Gmail, 465 SSL, 587 STARTTLS, espaces du mot de passe d'application ignorés)", () => {
  assert.equal(core.smtpConfig({}), null);
  assert.equal(core.smtpConfig({ SMTP_USER: "moi@gmail.com" }), null, "mot de passe absent");
  const c = core.smtpConfig({ SMTP_USER: "moi@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" })!;
  assert.deepEqual([c.host, c.port, c.secure, c.pass, c.from], ["smtp.gmail.com", 465, "ssl", "abcdefghijklmnop", "moi@gmail.com"]);
  assert.equal(core.smtpConfig({ SMTP_USER: "u@g.com", SMTP_PASS: "p", SMTP_PORT: "587" })!.secure, "starttls");
  assert.equal(core.smtpConfig({ SMTP_USER: "u@g.com", SMTP_PASS: "p", FROM_EMAIL: "noreply@cap7.example" })!.from, "noreply@cap7.example");
  assert.equal(core.mailTransport({ SMTP_USER: "u@g.com", SMTP_PASS: "p", RESEND_API_KEY: "r", FROM_EMAIL: "a@b.c" }), "smtp", "SMTP prioritaire");
  assert.equal(core.mailTransport({ RESEND_API_KEY: "r", FROM_EMAIL: "a@b.c" }), "resend");
  assert.equal(core.mailTransport({ RESEND_API_KEY: "r" }), null, "Resend sans expéditeur : désactivé");
  assert.equal(core.mailTransport({}), null);
});

test("SMTP: message MIME sûr (UTF-8 en base64, aucune injection d'en-tête)", () => {
  const mime = core.buildMime("moi@gmail.com", "ami@exemple.com", "Réinitialisation\r\nBcc: pirate@x.com", "<p>Bonjour é</p>\r\n.\r\nQUIT");
  const [head, body] = mime.split("\r\n\r\n");
  assert.ok(!/^Bcc:/mi.test(mime), "la tentative d'injection ne crée pas d'en-tête");
  assert.match(head, /^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/m);
  assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), "<p>Bonjour é</p>\r\n.\r\nQUIT");
  assert.ok(!body.split("\r\n").some((l) => l === "."), "le corps en base64 ne contient jamais la ligne de fin SMTP");
  assert.throws(() => core.buildMime("moi@gmail.com", "x@y.com>\r\nRCPT TO:<z@z.com", "s", "h"), /adresse invalide/);
});

/** Faux serveur SMTP local (sans TLS) qui enregistre la conversation. */
function fakeSmtp(opts: { authCode?: number } = {}) {
  const log: string[] = [];
  const data: string[] = [];
  const server = net.createServer((sock) => {
    let buf = "";
    let inData = false;
    let msg = "";
    sock.write("220 fake ESMTP\r\n");
    sock.on("data", (d) => {
      buf += d.toString();
      for (;;) {
        if (inData) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end === -1) return;
          msg = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          data.push(msg);
          sock.write("250 queued\r\n");
          continue;
        }
        const e = buf.indexOf("\r\n");
        if (e === -1) return;
        const line = buf.slice(0, e);
        buf = buf.slice(e + 2);
        log.push(line);
        if (line.startsWith("EHLO")) sock.write("250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("AUTH PLAIN")) sock.write(`${opts.authCode ?? 235} ${opts.authCode && opts.authCode !== 235 ? "5.7.8 Username and Password not accepted" : "2.7.0 Accepted"}\r\n`);
        else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) sock.write("250 OK\r\n");
        else if (line === "DATA") { sock.write("354 go\r\n"); inData = true; }
        else if (line === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      }
    });
  });
  return new Promise<{ port: number; log: string[]; data: string[]; close: () => void }>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, log, data, close: () => server.close() }));
  });
}

test("SMTP: conversation complète (EHLO, AUTH PLAIN, MAIL, RCPT, DATA, QUIT) avec un serveur local", async () => {
  const srv = await fakeSmtp();
  accountEnv({ SMTP_HOST: "127.0.0.1", SMTP_PORT: String(srv.port), SMTP_SECURE: "none", SMTP_USER: "moi@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop", MOCK_EXTERNALS: "1", MOCK_MAIL: "0" });
  try {
    const ok = await core.sendEmail("ami@exemple.com", "Réinitialisation du mot de passe", '<p><a href="https://cap7.example/connexion?reset=abc">Lien</a></p>');
    assert.equal(ok, true);
    assert.ok(srv.log[0].startsWith("EHLO"));
    const auth = srv.log.find((l) => l.startsWith("AUTH PLAIN"))!;
    assert.equal(Buffer.from(auth.slice(11), "base64").toString(), "\0moi@gmail.com\0abcdefghijklmnop");
    assert.ok(srv.log.includes("MAIL FROM:<moi@gmail.com>"));
    assert.ok(srv.log.includes("RCPT TO:<ami@exemple.com>"));
    assert.equal(srv.log.at(-1), "QUIT");
    const body = srv.data[0].split("\r\n\r\n")[1];
    assert.match(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), /connexion\?reset=abc/);
  } finally { srv.close(); }
  // refus d'authentification : renvoie false, ne lève rien, journalise l'erreur sans le mot de passe
  const bad = await fakeSmtp({ authCode: 535 });
  accountEnv({ SMTP_HOST: "127.0.0.1", SMTP_PORT: String(bad.port), SMTP_SECURE: "none", SMTP_USER: "moi@gmail.com", SMTP_PASS: "mot-de-passe-secret", MOCK_EXTERNALS: "1", MOCK_MAIL: "0" });
  try {
    assert.equal(await core.sendEmail("ami@exemple.com", "Sujet", "<p>x</p>"), false);
    const events = await (await col<{ kind: string; msg: string }>("events")).find({ kind: "error" });
    assert.ok(events.some((e) => e.msg.includes("SMTP 535")));
    assert.ok(!events.some((e) => e.msg.includes("mot-de-passe-secret")));
  } finally { bad.close(); }
  // SMTP sans chiffrement refusé hors localhost ; serveur injoignable : false, sans exception
  assert.ok(await core.smtpSend({ host: "smtp.exemple.com", port: 25, user: "u", pass: "p", secure: "none", from: "a@b.c" }, "x@y.z", "s", "h").then(() => false, (e) => /refusé/.test(String(e))));
  accountEnv({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_SECURE: "none", SMTP_USER: "u@g.com", SMTP_PASS: "p", MOCK_EXTERNALS: "1", MOCK_MAIL: "0" });
  assert.equal(await core.sendEmail("ami@exemple.com", "Sujet", "<p>x</p>"), false);
});

test("mot de passe oublié: lien à usage unique, expiration, délai d'une minute, sessions anciennes invalidées", async () => {
  accountEnv({ SMTP_USER: "moi@gmail.com", SMTP_PASS: "p" }); // transport SMTP simulé (boîte d'envoi)
  assert.equal(core.emailEnabled(), true);
  const { user, verifyToken } = await core.registerUser({ email: "oubli@exemple.com", password: "ancien-mot-de-passe" }, ipOf());
  assert.ok(verifyToken, "avec un e-mail actif, l'adresse doit être confirmée");
  await assert.rejects(core.loginUser("oubli@exemple.com", "ancien-mot-de-passe"), { code: "unverified" });
  assert.equal(await core.verifyEmailToken(verifyToken!), true);
  assert.equal(await core.verifyEmailToken(verifyToken!), false, "lien de confirmation à usage unique");
  await core.loginUser("oubli@exemple.com", "ancien-mot-de-passe");

  assert.equal(await core.startPasswordReset("inconnu@exemple.com"), null, "aucun jeton pour une adresse inconnue");
  const token = await core.startPasswordReset("oubli@exemple.com");
  assert.ok(token && token.length >= 40);
  assert.equal(await core.startPasswordReset("oubli@exemple.com"), null, "un seul lien par minute");
  await assert.rejects(core.finishPasswordReset(token!, "court"), { code: "invalid" });
  assert.equal(await core.finishPasswordReset("jeton-faux", "nouveau-mot-de-passe"), false);
  assert.equal(await core.finishPasswordReset(token!, "nouveau-mot-de-passe"), true);
  assert.equal(await core.finishPasswordReset(token!, "encore-un-autre-mot"), false, "jeton à usage unique");
  await assert.rejects(core.loginUser("oubli@exemple.com", "ancien-mot-de-passe"), { code: "login" });
  const again = await core.loginUser("oubli@exemple.com", "nouveau-mot-de-passe");
  // les sessions émises avant la réinitialisation sont refusées, une session émise après est acceptée
  const fresh = (await (await col<{ _id: string; pw_changed_at?: Date }>("users")).findOne({ _id: user._id }))!;
  assert.ok(fresh.pw_changed_at);
  const t = Math.floor(fresh.pw_changed_at!.getTime() / 1000);
  assert.equal(core.sessionValidFor(fresh, t - 5), false);
  assert.equal(core.sessionValidFor(fresh, t), true);
  assert.equal(core.sessionValidFor({}, 0), true, "compte sans changement : toute session reste valable");
  assert.equal(again._id, user._id);
  // jeton expiré
  const t2 = await (async () => { await (await col<{ _id: string }>("users")).updateOne({ _id: user._id }, { $set: { reset_sent_at: new Date(Date.now() - 120_000) } }); return core.startPasswordReset("oubli@exemple.com"); })();
  await (await col<{ _id: string }>("users")).updateOne({ _id: user._id }, { $set: { reset_expires: new Date(Date.now() - 1000) } });
  assert.equal(await core.finishPasswordReset(t2!, "mot-de-passe-expire-1"), false, "jeton expiré");
});

test("mot de passe: modification avec contrôle du mot de passe actuel", async () => {
  accountEnv();
  const { user } = await core.registerUser({ email: "chg@exemple.com", password: "premier-mot-de-passe" }, ipOf());
  await assert.rejects(core.changePassword(user, "mauvais", "deuxieme-mot-de-passe"), { code: "login" });
  await assert.rejects(core.changePassword(user, "premier-mot-de-passe", "court"), { code: "invalid" });
  await assert.rejects(core.changePassword(user, "premier-mot-de-passe", "premier-mot-de-passe"), { code: "invalid" });
  await core.changePassword(user, "premier-mot-de-passe", "deuxieme-mot-de-passe");
  await assert.rejects(core.loginUser("chg@exemple.com", "premier-mot-de-passe"), { code: "login" });
  assert.equal((await core.loginUser("chg@exemple.com", "deuxieme-mot-de-passe"))._id, user._id);
});

test("Google: URL d'autorisation (PKCE S256, state, nonce, portée), défi PKCE du RFC 7636", () => {
  assert.equal(core.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  accountEnv(GOOGLE_ENV);
  assert.equal(core.googleEnabled(), true);
  const flow = core.startGoogleFlow(null);
  const u = new URL(flow.url);
  assert.equal(`${u.origin}${u.pathname}`, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), GOOGLE_ENV.GOOGLE_CLIENT_ID);
  assert.equal(u.searchParams.get("redirect_uri"), "https://cap7.example/api/auth/google");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.ok(u.searchParams.get("state") && u.searchParams.get("nonce") && u.searchParams.get("code_challenge"));
  assert.equal(flow.cookie.name, "cap7_oauth");
  assert.equal(flow.cookie.maxAge, 600);
  assert.ok(!flow.url.includes(GOOGLE_ENV.GOOGLE_CLIENT_SECRET), "le secret ne figure jamais dans l'URL");
  accountEnv();
  assert.equal(core.googleEnabled(), false);
  assert.throws(() => core.startGoogleFlow(null), { code: "config" });
});

test("Google: profil depuis l'ID token (adresse vérifiée exigée)", () => {
  assert.deepEqual(core.googleProfileFromClaims({ sub: "123", email: " Marie@Exemple.com ", email_verified: true, name: "Marie Dupont" }), { sub: "123", email: "marie@exemple.com", name: "Marie Dupont" });
  assert.equal(core.googleProfileFromClaims({ sub: "1", email: "a@b.co", email_verified: "true" }).name, "");
  assert.throws(() => core.googleProfileFromClaims({ sub: "1", email: "a@b.co", email_verified: false }), { code: "google" });
  assert.throws(() => core.googleProfileFromClaims({ sub: "1", email: "a@b.co" }), { code: "google" });
  assert.throws(() => core.googleProfileFromClaims({ email: "a@b.co", email_verified: true }), { code: "google" });
  assert.throws(() => core.googleProfileFromClaims({ sub: "1", email: "pas-une-adresse", email_verified: true }), { code: "google" });
});

test("Google: retour d'autorisation (state, échange du code avec PKCE, ID token vérifié, session)", async () => {
  accountEnv(GOOGLE_ENV);
  const flow = core.startGoogleFlow(null);
  const state = new URL(flow.url).searchParams.get("state")!;
  const nonce = new URL(flow.url).searchParams.get("nonce")!;
  const challenge = new URL(flow.url).searchParams.get("code_challenge")!;
  let captured: { url: string; body: URLSearchParams } | null = null;
  const f = stubFetch((c) => {
    captured = { url: c.url, body: c.init.body as URLSearchParams };
    return json({ id_token: "jeton.id.google", access_token: "inutile" });
  });
  const verify = async (idToken: string, n: string, clientId: string) => {
    assert.equal(idToken, "jeton.id.google");
    assert.equal(n, nonce, "le nonce vérifié est celui du départ");
    assert.equal(clientId, GOOGLE_ENV.GOOGLE_CLIENT_ID);
    return { sub: "g-1", email: "Nouveau@Exemple.com", email_verified: true, name: "Nina Martin" };
  };
  try {
    const out = await core.finishGoogleFlow(new URLSearchParams({ code: "code-abc", state }), flow.cookie.value, ipOf(), { verifyIdToken: verify });
    assert.equal(out.created, true);
    assert.equal(out.user.email, "nouveau@exemple.com");
    assert.equal(out.user.name, "Nina Martin");
    assert.equal(out.user.auth_provider, "google");
    assert.equal(out.user.pass_hash, "", "aucun mot de passe");
    assert.equal(out.user.profile_complete, false);
    assert.equal(out.user.country, "autre");
    assert.equal(captured!.url, "https://oauth2.googleapis.com/token");
    const b = captured!.body;
    assert.equal(b.get("grant_type"), "authorization_code");
    assert.equal(b.get("code"), "code-abc");
    assert.equal(b.get("client_secret"), "secret-xyz");
    assert.equal(b.get("redirect_uri"), "https://cap7.example/api/auth/google");
    assert.equal(core.pkceChallenge(b.get("code_verifier")!), challenge, "le vérificateur PKCE correspond au défi envoyé à Google");
    // un second passage avec le même compte Google reconnaît l'utilisateur
    const again = await core.finishGoogleFlow(new URLSearchParams({ code: "c2", state }), flow.cookie.value, ipOf(), { verifyIdToken: verify });
    assert.equal(again.created, false);
    assert.equal(again.user._id, out.user._id);
    // refus : state incorrect, cookie absent ou altéré, retour d'erreur de Google
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ code: "c", state: "autre" }), flow.cookie.value, ipOf(), { verifyIdToken: verify }), { code: "google" });
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ code: "c", state }), undefined, ipOf(), { verifyIdToken: verify }), { code: "google" });
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ code: "c", state }), flow.cookie.value.replace(/.$/, "x"), ipOf(), { verifyIdToken: verify }), { code: "google" });
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ error: "access_denied", state }), flow.cookie.value, ipOf(), { verifyIdToken: verify }), { code: "google" });
    // ID token non vérifiable : refus propre
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ code: "c", state }), flow.cookie.value, ipOf(), { verifyIdToken: async () => { throw new Error("signature"); } }), { code: "google" });
  } finally { f.restore(); }
  // Google injoignable ou en erreur
  const down = stubFetch(() => json({ error: "invalid_grant" }, 400));
  try {
    await assert.rejects(core.finishGoogleFlow(new URLSearchParams({ code: "c", state }), flow.cookie.value, ipOf()), { code: "google", status: 502 });
  } finally { down.restore(); }
});

test("Google: rattachement à un compte existant, protection contre la prise de contrôle préalable", async () => {
  accountEnv(GOOGLE_ENV);
  // compte par mot de passe dont l'adresse n'a jamais été confirmée par e-mail : le mot de passe est retiré au rattachement
  const { user } = await core.registerUser({ email: "victime@exemple.com", password: "mot-de-passe-pirate" }, ipOf());
  const linked = await core.signInWithGoogle({ sub: "g-victime", email: "victime@exemple.com", name: "Vraie Victime" }, ipOf(), null);
  assert.equal(linked.created, false);
  assert.equal(linked.user._id, user._id);
  await assert.rejects(core.loginUser("victime@exemple.com", "mot-de-passe-pirate"), { code: "login" }, "l'ancien mot de passe ne fonctionne plus");
  assert.equal((await core.signInWithGoogle({ sub: "g-victime", email: "victime@exemple.com", name: "" }, ipOf(), null)).user._id, user._id);
  // compte dont l'adresse a été prouvée par e-mail : le mot de passe est conservé
  accountEnv({ ...GOOGLE_ENV, SMTP_USER: "moi@gmail.com", SMTP_PASS: "p" });
  const { user: u2, verifyToken } = await core.registerUser({ email: "prouve@exemple.com", password: "mot-de-passe-valide" }, ipOf());
  await core.verifyEmailToken(verifyToken!);
  await core.signInWithGoogle({ sub: "g-prouve", email: "prouve@exemple.com", name: "Pat" }, ipOf(), null);
  assert.equal((await core.loginUser("prouve@exemple.com", "mot-de-passe-valide"))._id, u2._id);
  // même adresse Google, autre identifiant : la liaison existante n'est pas écrasée
  const stored = await (await col<{ google_sub?: string }>("users")).findOne({ _id: u2._id });
  assert.equal(stored?.google_sub, "g-prouve");
  // un compte Google n'a pas de mot de passe : message explicite, puis définition possible
  accountEnv(GOOGLE_ENV);
  const g = (await core.signInWithGoogle({ sub: "g-seul", email: "seul@exemple.com", name: "Seul" }, ipOf(), null)).user;
  await assert.rejects(core.loginUser("seul@exemple.com", "nimporte-quoi-long"), { code: "login", message: /Google/ });
  await core.changePassword(g, "", "mot-de-passe-defini-1");
  assert.equal((await core.loginUser("seul@exemple.com", "mot-de-passe-defini-1"))._id, g._id);
  // limite de comptes gratuits par réseau, parrainage
  accountEnv(GOOGLE_ENV);
  for (let i = 0; i < 3; i++) await core.signInWithGoogle({ sub: `s${i}`, email: `abus${i}@exemple.com`, name: "" }, "10.99.0.1", null);
  await assert.rejects(core.signInWithGoogle({ sub: "s9", email: "abus9@exemple.com", name: "" }, "10.99.0.1", null), { code: "abuse" });
  const parrain = (await core.signInWithGoogle({ sub: "p0", email: "parrain@exemple.com", name: "" }, ipOf(), null)).user;
  const filleul = (await core.signInWithGoogle({ sub: "p1", email: "filleul@exemple.com", name: "" }, ipOf(), parrain._id)).user;
  assert.equal(filleul.bonus_corrections, 1);
  assert.equal(filleul.referred_by, parrain._id);
});

test("Google: informations manquantes à compléter (rappel), acceptation des conditions obligatoire", async () => {
  accountEnv(GOOGLE_ENV);
  const user = (await core.signInWithGoogle({ sub: "g-prof", email: "profil@exemple.com", name: "Profil" }, ipOf(), null)).user;
  assert.equal(core.needsProfile(user), true);
  await assert.rejects(core.completeProfile(user, { country: "maroc", exam: "tcf", examDate: null, accepted: false }), { code: "invalid" });
  await assert.rejects(core.completeProfile(user, { country: "atlantide", exam: "tcf", examDate: null, accepted: true }), { code: "invalid" });
  await assert.rejects(core.completeProfile(user, { country: "maroc", exam: "tcf", examDate: "demain", accepted: true }), { code: "invalid" });
  assert.equal(core.needsProfile((await (await col<{ _id: string; profile_complete?: boolean }>("users")).findOne({ _id: user._id }))!), true, "rien n'est enregistré tant que le formulaire est invalide");
  await core.completeProfile(user, { country: "maroc", exam: "tef", examDate: "2027-03-01", accepted: true });
  const done = (await (await col<{ _id: string; country: string; exam: string | null; exam_date: string | null; profile_complete?: boolean }>("users")).findOne({ _id: user._id }))!;
  assert.deepEqual([done.country, done.exam, done.exam_date, core.needsProfile(done)], ["maroc", "tef", "2027-03-01", false]);
  // un compte créé par mot de passe n'est jamais « à compléter »
  const pw = (await core.registerUser({ email: "mdp@exemple.com", password: "mot-de-passe-long" }, ipOf())).user;
  assert.equal(core.needsProfile(pw), false);
  assert.equal(core.needsProfile({}), false, "compte ancien sans le champ : complet");
});

test("suppression de compte: confirmation par mot-clé et mot de passe, effacement complet, y compris compte Google", async () => {
  accountEnv(GOOGLE_ENV);
  const { user } = await core.registerUser({ email: "supp@exemple.com", password: "mot-de-passe-long" }, ipOf());
  await core.gradeAttempt({ user, skill: "EE", exam: "tcf", task: "t1", topicId: "tcf-ecrit-t1-1", topicText: "Sujet", text: FR.repeat(3) });
  await core.saveOfficialResult(user, "tcf", "2026-10-01", { CO: 7, CE: 7, EE: 7, EO: 7 }, true, false);
  const body = orderBody("ORD-SUPP", user._id, "111");
  await core.handleWebhook(body, sign(body));
  assert.equal((await core.entitlement(user._id)).hasPass, true);
  await assert.rejects(core.deleteAccountConfirmed(user, "oui", "mot-de-passe-long"), { code: "invalid" });
  await assert.rejects(core.deleteAccountConfirmed(user, "SUPPRIMER", "mauvais-mot-de-passe"), { code: "login" });
  assert.equal(await (await col("users")).countDocuments({ _id: user._id }), 1, "rien n'est supprimé tant que la confirmation échoue");
  await core.deleteAccountConfirmed(user, " supprimer ", "mot-de-passe-long");
  for (const name of ["users", "attempts", "passes", "official_results", "item_results", "events"] as const) {
    const field = name === "users" ? "_id" : "user";
    assert.equal(await (await col(name)).countDocuments({ [field]: user._id }), 0, name);
  }
  await assert.rejects(core.loginUser("supp@exemple.com", "mot-de-passe-long"), { code: "login" });
  // compte Google (sans mot de passe) : le mot-clé suffit
  const g = (await core.signInWithGoogle({ sub: "g-del", email: "gdel@exemple.com", name: "G" }, ipOf(), null)).user;
  await core.deleteAccountConfirmed(g, "SUPPRIMER", "");
  assert.equal(await (await col("users")).countDocuments({ google_sub: "g-del" }), 0);
  // la même adresse peut se réinscrire ensuite
  assert.equal((await core.signInWithGoogle({ sub: "g-del2", email: "gdel@exemple.com", name: "G" }, ipOf(), null)).created, true);
});

test("nettoyage: variables de compte restaurées", () => {
  for (const k of ACCOUNT_ENV) { if (savedAcc[k] === undefined) delete process.env[k]; else process.env[k] = savedAcc[k]; }
  process.env.MOCK_EXTERNALS = "1";
  assert.equal(core.isMock(), true);
});
