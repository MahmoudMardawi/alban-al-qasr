"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Send, Plus, Sparkles, History, Trash2, X } from "lucide-react";
import { ChatBubble } from "@/components/ChatBubble";
import { listChats, upsertChat, deleteChat as deleteChatAction, type PersistedChatMsg } from "./actions";

interface ChatMsg extends PersistedChatMsg {
  thumbnailUrl?: string;   // volatile, not persisted
}
interface Chat {
  id: string;
  title: string;
  messages: ChatMsg[];
  updated_at: number;      // local timestamp for sorting
}

const SUGGESTIONS = [
  "كم بعت لبن هذا الشهر؟",
  "أي زبون عنده أعلى ديون؟",
  "ما أكثر منتج مرتجع؟",
  "قارن أرباح هذا الشهر بالشهر السابق",
];

function stripVolatile(msgs: ChatMsg[]): PersistedChatMsg[] {
  return msgs.map((m) => ({
    id: m.id, role: m.role, text: m.text, ...(m.provider ? { provider: m.provider } : {}),
  }));
}
function deriveTitle(messages: ChatMsg[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "محادثة جديدة";
  return firstUser.text.slice(0, 60).replace(/\n/g, " ");
}
function relativeWhen(ts: number): string {
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 7) return `قبل ${d} يوم`;
  return new Date(ts).toISOString().slice(0, 10);
}

export default function AiAssistant() {
  const [chats, setChats]         = useState<Chat[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput]         = useState("");
  const [busy, setBusy]           = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load chats from server on mount
  useEffect(() => {
    (async () => {
      const res = await listChats();
      if (res.error) {
        setSyncError(res.error);
      } else if (res.chats) {
        const loaded: Chat[] = res.chats.map((c) => ({
          id: c.id, title: c.title,
          messages: c.messages as ChatMsg[],
          updated_at: new Date(c.updated_at).getTime(),
        }));
        setChats(loaded);
        if (loaded.length > 0) setActiveId(loaded[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;
  const messages = activeChat?.messages ?? [];

  // Save a chat to the server (best-effort; surfaces error in syncError)
  async function persist(chat: Chat) {
    const res = await upsertChat({
      id: chat.id,
      title: chat.title,
      messages: stripVolatile(chat.messages),
    });
    if (res.error) setSyncError(res.error);
    else setSyncError(null);
  }

  function ensureActiveChat(): string {
    if (activeId && chats.some((c) => c.id === activeId)) return activeId;
    const id = crypto.randomUUID();
    const fresh: Chat = { id, title: "محادثة جديدة", messages: [], updated_at: Date.now() };
    setChats((prev) => [fresh, ...prev]);
    setActiveId(id);
    // First persist will happen when first message is appended
    return id;
  }

  function appendMessage(chatId: string, msg: ChatMsg) {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== chatId) return c;
        const newMessages = [...c.messages, msg];
        return {
          ...c,
          messages: newMessages,
          title: deriveTitle(newMessages),
          updated_at: Date.now(),
        };
      });
      const sorted = [...updated].sort((a, b) => b.updated_at - a.updated_at);
      // Persist the affected chat
      const target = sorted.find((c) => c.id === chatId);
      if (target) void persist(target);
      return sorted;
    });
  }

  async function send(textOverride?: string) {
    const question = (textOverride ?? input).trim();
    if (!question || busy) return;
    const chatId = ensureActiveChat();
    setInput("");
    appendMessage(chatId, { id: crypto.randomUUID(), role: "user", text: question });
    setBusy(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json();
      appendMessage(chatId, {
        id: crypto.randomUUID(), role: "assistant",
        text: data.answer ?? data.error ?? "—",
        provider: data.provider,
      });
    } catch (e) {
      appendMessage(chatId, {
        id: crypto.randomUUID(), role: "assistant",
        text: `خطأ: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function sendImage(file: File) {
    if (busy) return;
    const chatId = ensureActiveChat();
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(",");
      const mimeType = meta.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      const thumb = URL.createObjectURL(file);
      appendMessage(chatId, { id: crypto.randomUUID(), role: "user", text: "📷 صورة فاتورة", thumbnailUrl: thumb });
      setBusy(true);
      try {
        const r = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await r.json();
        appendMessage(chatId, {
          id: crypto.randomUUID(), role: "assistant",
          text: data.answer ?? "—", provider: data.provider,
        });
      } catch (e) {
        appendMessage(chatId, {
          id: crypto.randomUUID(), role: "assistant",
          text: `خطأ: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function newChat() {
    const id = crypto.randomUUID();
    const fresh: Chat = { id, title: "محادثة جديدة", messages: [], updated_at: Date.now() };
    setChats((prev) => [fresh, ...prev]);
    setActiveId(id);
    setHistoryOpen(false);
    // Don't persist yet — empty chat. Persists when first message lands.
  }

  function selectChat(id: string) {
    setActiveId(id);
    setHistoryOpen(false);
  }

  async function removeChat(id: string) {
    // Optimistic
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(filtered[0]?.id ?? null);
      return filtered;
    });
    // Server delete (best-effort)
    const res = await deleteChatAction(id);
    if (res.error) setSyncError(res.error);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={20} className="text-gold shrink-0" />
          <div className="min-w-0">
            <div className="font-cairo font-bold text-sm truncate">{activeChat?.title ?? "اسأل بياناتك"}</div>
            <div className="text-[10px] opacity-80 font-cairo">
              مدعوم بـ Gemini · Groq
              {syncError && <span className="text-warn mr-2">· خطأ مزامنة</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1 text-xs bg-white/15 px-2.5 py-1 rounded-lg font-cairo">
            <History size={12} /> {chats.length > 0 && <span className="text-[10px] bg-gold/30 rounded-full px-1.5">{chats.length}</span>} السجل
          </button>
          <button onClick={newChat}
            className="flex items-center gap-1 text-xs bg-white/15 px-2.5 py-1 rounded-lg font-cairo">
            <Plus size={12} /> جديدة
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 bg-surface">
        {loading ? (
          <div className="text-center text-muted text-sm mt-8 font-cairo">جارٍ تحميل المحادثات...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted text-sm mt-8 font-cairo">
            اسأل عن مبيعاتك، أرباحك، أو ارفع صورة فاتورة لتسجيلها كمصروف.
          </div>
        ) : null}
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

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setHistoryOpen(false)}>
          <aside className="absolute top-0 right-0 bottom-0 w-80 max-w-[85%] bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-forest to-primary-dk text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-cairo font-bold text-base flex items-center gap-2">
                <History size={16} /> المحادثات السابقة
              </h3>
              <button onClick={() => setHistoryOpen(false)} className="text-white/80"><X size={18} /></button>
            </div>
            <button onClick={newChat}
              className="m-3 flex items-center justify-center gap-1.5 bg-primary text-white font-cairo font-bold py-2.5 rounded-xl">
              <Plus size={14} /> محادثة جديدة
            </button>
            {chats.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-sm font-cairo p-6 text-center">
                لا توجد محادثات بعد. اسأل سؤالاً لبدء أول محادثة.
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
                {chats.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <div className={`flex items-stretch gap-1 border rounded-xl overflow-hidden ${
                        isActive ? "bg-info-bg border-primary" : "bg-white border-border"
                      }`}>
                        <button onClick={() => selectChat(c.id)}
                          className="flex-1 text-right px-3 py-2.5">
                          <div className={`font-cairo font-semibold text-sm truncate ${isActive ? "text-forest" : "text-ink"}`}>
                            {c.title}
                          </div>
                          <div className="text-[10px] text-muted font-cairo mt-0.5">
                            {c.messages.length} رسالة · {relativeWhen(c.updated_at)}
                          </div>
                        </button>
                        <button onClick={() => removeChat(c.id)} aria-label="حذف"
                          className="px-3 text-muted hover:text-danger flex items-center">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
