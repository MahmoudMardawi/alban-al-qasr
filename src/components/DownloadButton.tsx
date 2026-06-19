"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface Props {
  label: string;
  onClick: () => Promise<void>;
}

export function DownloadButton({ label, onClick }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function go() {
    setErr(null); setBusy(true);
    try { await onClick(); }
    catch (e) { setErr(e instanceof Error ? e.message : "تعذّر التصدير"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <button onClick={go} disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60">
        <Download size={16} /> {busy ? "جارٍ التحضير..." : label}
      </button>
      {err && <p className="text-danger text-[11px] mt-1.5 font-cairo">{err}</p>}
    </div>
  );
}
