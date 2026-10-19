// src/app/api/audio/[id]/route.ts
// Sert un audio (MP3 ou WAV selon le fournisseur) avec requêtes Range (206, Accept-Ranges: bytes), obligatoire pour Safari/iOS, et cache immuable.
import { getAudioWithMime } from "@/core";

export const runtime = "nodejs";

const BASE_HEADERS = {
  "accept-ranges": "bytes",
  "cache-control": "public, max-age=31536000, immutable",
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const found = await getAudioWithMime(id);
  if (!found) return new Response("Introuvable", { status: 404 });
  const data = found.data;
  const HEADERS = { ...BASE_HEADERS, "content-type": found.mime }; // MP3 (OpenAI) ou WAV (Gemini)
  const size = data.length;
  const range = req.headers.get("range");
  if (!range) return new Response(new Uint8Array(data), { status: 200, headers: { ...HEADERS, "content-length": String(size) } });

  const m = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": `bytes */${size}` } });
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]); // « bytes=-N » : les N derniers octets
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!(start <= end) || start >= size) return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": `bytes */${size}` } });
  const chunk = data.subarray(start, end + 1);
  return new Response(new Uint8Array(chunk), {
    status: 206,
    headers: { ...HEADERS, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(chunk.length) },
  });
}
