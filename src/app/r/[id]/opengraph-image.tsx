// src/app/r/[id]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { EXAMS } from "@/content";
import { publicCard } from "@/core";

export const alt = "Carte de résultat Cap7";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = /^[a-f0-9-]{36}$/.test(id) ? await publicCard(id).catch(() => null) : null;
  const title = c ? `${EXAMS[c.exam].name} · ${c.skill === "EE" ? "Expression écrite" : "Expression orale"}` : "Cap7";
  const level = c ? `NCLC ${c.low === c.high ? c.high : `${c.low} à ${c.high}`}` : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0f4c4a", color: "#f7f5ef" }}>
        <div style={{ fontSize: 40, opacity: 0.85 }}>{title}</div>
        <div style={{ fontSize: 150, fontWeight: 700, marginTop: 20 }}>{level}</div>
        <div style={{ fontSize: 30, marginTop: 40, opacity: 0.8 }}>Estimation indicative non officielle · Cap7</div>
      </div>
    ),
    size,
  );
}
