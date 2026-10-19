// src/app/api/items/route.ts
// GET : prochaine série de compréhension (ou, avec kind=topic, un nouveau sujet) ; POST : soumission des réponses.
import { z } from "zod";
import { AppError, canStartItem, checkOrigin, errorResponse, jsonResponse, newTopic, nextItem, publicItem, requireUser, submitItem } from "@/core";
import { SERIES_LEVELS } from "@/crs";
import type { SeriesLevel } from "@/crs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    if (url.searchParams.get("kind") === "topic") {
      // « Nouveau sujet » : consigne originale générée par le modèle rapide, mise en cache.
      const exam = url.searchParams.get("exam");
      const mode = url.searchParams.get("mode");
      const task = url.searchParams.get("task") ?? "";
      if ((exam !== "tcf" && exam !== "tef") || (mode !== "ecrit" && mode !== "oral") || !/^[a-z0-9]{1,3}$/.test(task)) throw new AppError("invalid", "Requête invalide.");
      return jsonResponse(await newTopic(exam, mode, task, req.signal));
    }
    const skill = url.searchParams.get("skill");
    const level = url.searchParams.get("level") ?? "B1";
    if (skill !== "CE" && skill !== "CO") throw new AppError("invalid", "Compétence inconnue.");
    if (!SERIES_LEVELS.includes(level as SeriesLevel)) throw new AppError("invalid", "Niveau inconnu.");
    if (!(await canStartItem(user, skill))) throw new AppError("paywall", "Votre série gratuite est déjà utilisée. Un pass donne accès à toutes les séries.", 402);
    const item = await nextItem(user, skill, level as SeriesLevel, req.signal);
    if (!item) throw new AppError("empty", "Aucune série n'a pu être préparée pour le moment. Réessayez dans quelques minutes.", 503);
    return jsonResponse(publicItem(item));
  } catch (e) {
    return errorResponse(e);
  }
}

const submit = z.object({ itemId: z.string().min(1).max(80), answers: z.array(z.number().int().min(0).max(3)).min(1).max(20) });

export async function POST(req: Request): Promise<Response> {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const parsed = submit.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError("invalid", "Requête invalide.");
    return jsonResponse(await submitItem(user, parsed.data.itemId, parsed.data.answers));
  } catch (e) {
    return errorResponse(e);
  }
}
