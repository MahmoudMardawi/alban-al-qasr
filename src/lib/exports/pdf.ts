"use client";

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";

// Cache the font as base64 — fetched once, reused for every PDF.
let cairoBase64: string | null = null;

async function ensureCairo(): Promise<string> {
  if (cairoBase64) return cairoBase64;

  const r = await fetch("/fonts/Cairo-Variable.ttf");
  if (!r.ok) throw new Error(`فشل تحميل خط Cairo (HTTP ${r.status})`);
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  cairoBase64 = btoa(bin);
  return cairoBase64;
}

/**
 * Build a pdfmake document and trigger download in browser.
 *
 * pdfmake 0.3.x removed the global `pdfMake.vfs` / `pdfMake.fonts` config —
 * fonts + vfs are now passed as positional arguments to createPdf:
 *   createPdf(def, tableLayouts, fonts, vfs)
 *
 * We use a Cairo variable TTF for all four weight slots; bold won't visually
 * differ but Arabic shapes correctly (v1 tradeoff to avoid a separate Bold file).
 */
export async function downloadPdf(definition: TDocumentDefinitions, filename: string): Promise<void> {
  const cairo = await ensureCairo();

  const vfs: Record<string, string> = {
    "Cairo-Variable.ttf": cairo,
  };

  const fonts: TFontDictionary = {
    Cairo: {
      normal:      "Cairo-Variable.ttf",
      bold:        "Cairo-Variable.ttf",
      italics:     "Cairo-Variable.ttf",
      bolditalics: "Cairo-Variable.ttf",
    },
  };

  const fullDef: TDocumentDefinitions = {
    ...definition,
    defaultStyle: { font: "Cairo", fontSize: 10, ...(definition.defaultStyle ?? {}) },
  };

  // pdfmake 0.3.x signature: createPdf(def, tableLayouts, fonts, vfs).
  // TS types only declare the first 1-2 args; cast through unknown to bypass.
  type CreatePdf = (
    def: TDocumentDefinitions,
    tableLayouts: unknown,
    fonts: TFontDictionary,
    vfs: Record<string, string>,
  ) => { download: (filename: string) => void };
  const cp = pdfMake.createPdf as unknown as CreatePdf;
  cp(fullDef, undefined, fonts, vfs)
    .download(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
