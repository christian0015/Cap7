// src/app/api/transcribe/route.ts
// Reçoit un enregistrement, le transcrit en mémoire et le supprime : aucun audio utilisateur n'est conservé.
import { AppError, checkOrigin, errorResponse, jsonResponse, requireUser, transcribeAudio, withLock } from "@/core";
import { LIMITS } from "@/content";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > LIMITS.maxAudioBytes + 100_000) throw new AppError("size", "Enregistrement trop volumineux (8 Mo maximum).", 413);
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) throw new AppError("invalid", "Fichier audio manquant.");
    const seconds = Math.min(Math.max(Number(form.get("seconds") ?? 0) || 0, 0), LIMITS.maxAudioSeconds + 5);
    const name = file instanceof File && file.name ? file.name : "enregistrement.webm";
    // Un seul envoi à la fois par utilisateur ; l'annulation du navigateur est propagée au fournisseur.
    const transcript = await withLock(`stt:${user._id}`, () => transcribeAudio(file, name, seconds, req.signal));
    return jsonResponse({ transcript, seconds });
  } catch (e) {
    return errorResponse(e);
  }
}
