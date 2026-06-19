"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, X } from "lucide-react";

interface Props {
  onUploaded: (publicUrl: string | null) => void;
}

export function ReceiptPhotoInput({ onUploaded }: Props) {
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("الملف كبير جداً (الحد 5MB)"); return; }
    setError(null);
    setUploading(true);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (upErr) { setError(upErr.message); setUploading(false); return; }

    const { data: signed, error: signErr } = await supabase.storage.from("receipts")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signErr || !signed) { setError(signErr?.message ?? "تعذّر إنشاء رابط"); setUploading(false); return; }

    setPreviewUrl(signed.signedUrl);
    onUploaded(signed.signedUrl);
    setUploading(false);
  }

  function clear() {
    setPreviewUrl(null);
    onUploaded(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />
      {!previewUrl ? (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 text-muted font-cairo text-sm hover:bg-info-bg/40 disabled:opacity-60">
          <Camera size={20} /> {uploading ? "جارٍ الرفع..." : "إرفاق صورة الفاتورة"}
        </button>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="صورة الفاتورة" className="w-full h-48 object-cover rounded-xl border border-border" />
          <button type="button" onClick={clear}
            className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1.5">
            <X size={14} />
          </button>
        </div>
      )}
      {error && <p className="text-danger text-[11px] mt-2 font-cairo">{error}</p>}
    </div>
  );
}
