// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { allGuideParams, LEGAL } from "@/content";
import { listDrawsSafe } from "@/core";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const draws = await listDrawsSafe("french");
  const entries: MetadataRoute.Sitemap = [
    { url: `${site}/`, lastModified: now, priority: 1 },
    { url: `${site}/calculateur`, lastModified: now, priority: 0.9 },
    { url: `${site}/tirages`, lastModified: draws[0] ? new Date(draws[0].date) : now, priority: 0.9 },
    { url: `${site}/tarifs`, lastModified: now, priority: 0.6 },
    ...draws.map((d) => ({ url: `${site}/tirages/${d.date}`, lastModified: new Date(d.date), priority: 0.6 })),
    ...allGuideParams().map((p) => ({ url: `${site}/guide/${p.exam}/${p.slug}`, lastModified: now, priority: 0.7 })),
    ...LEGAL.map((l) => ({ url: `${site}/legal/${l.slug}`, lastModified: now, priority: 0.2 })),
  ];
  return entries;
}
