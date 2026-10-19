// src/app/api/grade/route.ts
import { z } from "zod";
import { AppError, checkOrigin, errorResponse, gradeAttempt, jsonResponse, requireUser, resolveTopic } from "@/core";
import { examScoreRange, EXAM_MAX } from "@/crs";

export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({
  skill: z.enum(["EE", "EO"]),
  exam: z.enum(["tcf", "tef"]),
  task: z.string().min(1).max(10),
  topicId: z.string().max(80).nullable().optional(),
  topicText: z.string().max(400).optional(),
  text: z.string().max(8000),
  durationSeconds: z.number().min(0).max(900).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError("invalid", "Requête invalide.");
    const b = parsed.data;
    const mode = b.skill === "EE" ? "ecrit" : "oral";
    let topic: { id: string | null; text: string } | null = resolveTopic(b.topicId, b.exam, mode, b.task);
    if (!topic && b.topicId?.startsWith("gen-") && b.topicText) topic = { id: b.topicId, text: b.topicText };
    if (!topic) throw new AppError("invalid", "Sujet inconnu.");
    const out = await gradeAttempt({
      user, skill: b.skill, exam: b.exam, task: b.task, topicId: topic.id, topicText: topic.text, text: b.text, durationSeconds: b.durationSeconds, signal: req.signal,
    });
    // Le score d'examen affiché est dérivé de la fourchette NCLC par crs.ts (jamais inventé par le modèle).
    const range = examScoreRange(b.exam, b.skill, out.grade.nclc_low, out.grade.nclc_high);
    return jsonResponse({ ...out, examScore: { ...range, outOf: EXAM_MAX[b.exam][b.skill] } });
  } catch (e) {
    return errorResponse(e);
  }
}
