"use server";

import { createClient } from "@/lib/supabase/server";

export interface PersistedChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  provider?: "gemini" | "groq";
}

export interface ServerChat {
  id: string;
  title: string;
  messages: PersistedChatMsg[];
  updated_at: string;
}

export async function listChats(): Promise<{ chats?: ServerChat[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("ai_chats")
    .select("id, title, messages, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message };

  const chats: ServerChat[] = (data ?? []).map((r) => {
    const raw = r as { id: string; title: string; messages: unknown; updated_at: string };
    return {
      id: raw.id,
      title: raw.title,
      messages: Array.isArray(raw.messages) ? (raw.messages as PersistedChatMsg[]) : [],
      updated_at: raw.updated_at,
    };
  });

  return { chats };
}

export async function upsertChat(input: { id: string; title: string; messages: PersistedChatMsg[] }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { error } = await supabase
    .from("ai_chats")
    .upsert({
      id:         input.id,
      owner_id:   user.id,
      title:      input.title.slice(0, 200),
      messages:   input.messages as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) return { error: error.message };
  return {};
}

export async function deleteChat(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_chats").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
