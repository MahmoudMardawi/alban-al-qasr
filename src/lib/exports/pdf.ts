"use client";

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

let fontsReady = false;

async function ensureFonts(): Promise<void> {
  if (fontsReady) return;

  async function fetchAsBase64(url: string): Promise<string> {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  const cairo = await fetchAsBase64("/fonts/Cairo-Variable.ttf");

  type PMLike = {
    vfs?: Record<string, string>;
    fonts?: Record<string, { normal?: string; bold?: string; italics?: string; bolditalics?: string }>;
  };
  const pm = pdfMake as unknown as PMLike;
  pm.vfs = pm.vfs ?? {};
  pm.vfs["Cairo-Variable.ttf"] = cairo;
  // Variable font: same file for all 4 slots. Bold/italic axes won't visually differ
  // but Arabic shaping works correctly — sufficient for v1 receipts/reports.
  pm.fonts = {
    Cairo: {
      normal:      "Cairo-Variable.ttf",
      bold:        "Cairo-Variable.ttf",
      italics:     "Cairo-Variable.ttf",
      bolditalics: "Cairo-Variable.ttf",
    },
  };

  fontsReady = true;
}

/**
 * Build a pdfmake document and trigger download in browser.
 */
export async function downloadPdf(definition: TDocumentDefinitions, filename: string): Promise<void> {
  await ensureFonts();
  const fullDef: TDocumentDefinitions = {
    ...definition,
    defaultStyle: { font: "Cairo", fontSize: 10, ...(definition.defaultStyle ?? {}) },
  };
  pdfMake.createPdf(fullDef).download(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
