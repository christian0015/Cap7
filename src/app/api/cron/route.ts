// src/app/api/cron/route.ts
// Tâche quotidienne : tirages d'IRCC puis stock d'items. Protégée par CRON_SECRET (?secret= ou en-tête Authorization: Bearer).
import { checkCronAuth, errorResponse, jsonResponse, runCron } from "@/core";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  if (!checkCronAuth(req)) return new Response("Non autorisé", { status: 401 });
  try {
    return jsonResponse(await runCron());
  } catch (e) {
    return errorResponse(e);
  }
}
