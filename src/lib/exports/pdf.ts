"use client";

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

let fontsReady = false;

/**
 * pdfmake 0.3.x browser API (the proper one — found in the build/pdfmake.js bundle):
 *
 *   pdfMake.addVirtualFileSystem({ "filename.ttf": "<base64-string>" })
 *   pdfMake.setFonts({ Cairo: { normal, bold, italics, bolditalics } })
 *   pdfMake.createPdf(def).download(filename)
 *
 * The legacy globals (pdfMake.vfs / pdfMake.fonts) are GONE in 0.3.x.
 * Don't use `virtualfs.writeFileSync` directly either — that requires Node Buffer
 * which isn't reliably polyfilled in every browser bundle. addVirtualFileSystem
 * handles the encoding internally.
 */
async function ensureCairoFont(): Promise<void> {
  if (fontsReady) return;

  const r = await fetch("/fonts/Cairo-Variable.ttf");
  if (!r.ok) throw new Error(`فشل تحميل خط Cairo (HTTP ${r.status})`);
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const cairoBase64 = btoa(bin);

  type PdfMakeBrowser = {
    addVirtualFileSystem: (vfs: Record<string, string>) => void;
    setFonts: (fonts: Record<string, { normal: string; bold?: string; italics?: string; bolditalics?: string }>) => void;
  };
  const pm = pdfMake as unknown as PdfMakeBrowser;

  pm.addVirtualFileSystem({
    "Cairo-Variable.ttf": cairoBase64,
  });

  pm.setFonts({
    Cairo: {
      normal:      "Cairo-Variable.ttf",
      bold:        "Cairo-Variable.ttf",
      italics:     "Cairo-Variable.ttf",
      bolditalics: "Cairo-Variable.ttf",
    },
  });

  fontsReady = true;
}

export async function downloadPdf(definition: TDocumentDefinitions, filename: string): Promise<void> {
  await ensureCairoFont();
  const fullDef: TDocumentDefinitions = {
    ...definition,
    defaultStyle: { font: "Cairo", fontSize: 10, ...(definition.defaultStyle ?? {}) },
  };
  pdfMake.createPdf(fullDef).download(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
