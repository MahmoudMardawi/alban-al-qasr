"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Send, RotateCcw, Sparkles } from "lucide-react";
import { ChatBubble } from "@/components/ChatBubble";

interface ChatMsg {
  id: string; role: "user" | "assistant"; text: string;
  provider?: "gemini" | "groq"; thumbnailUrl?: string;
}

const SUGGESTIONS = [
  "كم بعت لبن هذا الشهر؟",
  "أي زبون عنده أعلى ديون؟",
  "ما أكثر منتج مرتجع؟",
  "قارن أرباح هذا الشهر بالشهر السابق",
];

const STORAGE_KEY = "ai-chat-history-v1";

// Strip thumbnails (object URLs) before persisting — they expire on reload
function persistableMessages(msgs: ChatMsg[]): ChatMsg[] {
  return msgs.map((m) => {
    if (m.thumbnailUrl) { const { thumbnailUrl: _drop, ...rest } = m; void _drop; return rest as ChatMsg; }
    return m;
  });
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [restored, setRestored] = useState(false);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore history on mount FIRST
  useEffect(() => {
    if (typeof window === "undefined") { setRestored(true); return; }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ChatMsg[] = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch { /* ignore corrupt history */ }
    setRestored(true);
  }, []);

  // Persist on every change — but ONLY after restore has run.
  // Otherwise the initial empty [] would overwrite saved history on mount.
  useEffect(() => {
    if (!restored || typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persistableMessages(messages))); }
    catch { /* localStorage full / disabled */ }
  }, [messages, restored]);

  async function send(textOverride?: string) {
    const question = (textOverride ?? input).trim();
    if (!question || busy) return;
    setInput("");
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: question };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json();
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: data.answer ?? data.error ?? "—",
        provider: data.provider,
      }]);
    } catch (e) {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: `خطأ: ${e instanceof Error ? e.message : String(e)}`,
      }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendImage(file: File) {
    if (busy) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(",");
      const mimeType = meta.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      const thumb = URL.createObjectURL(file);

      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "user",
        text: "📷 صورة فاتورة", thumbnailUrl: thumb,
      }]);
      setBusy(true);
      try {
        const r = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await r.json();
        setMessages((m) => [...m, {
          id: crypto.randomUUID(), role: "assistant",
          text: data.answer ?? "—", provider: data.provider,
        }]);
      } catch (e) {
        setMessages((m) => [...m, {
          id: crypto.randomUUID(), role: "assistant",
          text: `خطأ: ${e instanceof Error ? e.message : String(e)}`,
        }]);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setMessages([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-gold" />
          <div>
            <div className="font-cairo font-bold text-base">اسأل بياناتك</div>
            <div className="text-[10px] opacity-80 font-cairo">مدعوم بـ Gemini · مجاني</div>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs bg-white/15 px-2.5 py-1 rounded-lg font-cairo">
          <RotateCcw size={12} /> محادثة جديدة
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 bg-surface">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm mt-8 font-cairo">
            اسأل عن مبيعاتك، أرباحك، أو ارفع صورة فاتورة لتسجيلها كمصروف.
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.text} provider={m.provider} thumbnailUrl={m.thumbnailUrl} />
        ))}
        {busy && <div className="text-center text-muted text-xs font-cairo">جارٍ التفكير...</div>}
      </div>

      <div className="bg-white border-t border-border">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              className="whitespace-nowrap text-[11px] font-cairo bg-info-bg text-primary-dk border border-border rounded-full px-3 py-1.5 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) sendImage(f);
              if (fileRef.current) fileRef.current.value = "";
            }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary-dk disabled:opacity-50">
            <Camera size={16} />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="اكتب سؤالك..." disabled={busy}
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={() => send()} disabled={busy || !input.trim()}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 shadow-sm">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
