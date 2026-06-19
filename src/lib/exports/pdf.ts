"use client";

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

let fontsReady = false;

/**
 * pdfmake 0.3.x API (the legacy pdfMake.vfs / pdfMake.fonts globals are GONE):
 *  - virtual file system is `pdfMake.virtualfs` (one word; a VirtualFileSystem instance)
 *  - register a binary via `virtualfs.writeFileSync(name, base64String, "base64")`
 *  - fonts dict via `pdfMake.setFonts({...})` (or direct `pdfMake.fonts = {...}`)
 *  - `createPdf(def, options?)` takes only 1-2 args; everything else is on the printer
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

  // Register binary in pdfmake's vfs. "base64" tells the Buffer to decode the string.
  type Vfs = { writeFileSync: (name: string, content: string, encoding?: string) => void };
  const vfs = (pdfMake as unknown as { virtualfs: Vfs }).virtualfs;
  vfs.writeFileSync("Cairo-Variable.ttf", cairoBase64, "base64");

  // Register the font dict via setFonts.
  type SetFonts = (fonts: Record<string, { normal: string; bold?: string; italics?: string; bolditalics?: string }>) => void;
  (pdfMake as unknown as { setFonts: SetFonts }).setFonts({
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
