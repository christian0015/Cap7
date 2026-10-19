// src/app/api/webhook/route.ts
// Webhook de paiement. La signature est vérifiée sur le corps BRUT ; la création du pass est idempotente par order_id.
import { handleWebhook } from "@/core";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const out = await handleWebhook(raw, req.headers.get("x-signature"));
  return new Response(out.body, { status: out.status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
