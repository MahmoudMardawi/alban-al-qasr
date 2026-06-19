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

// Loose-typed client helper — the ai_chats table is new and not yet in the
// generated Database types. After running `npm run types:gen` this can be
// replaced with the proper generic client.
type LooseSupabaseClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    upsert: (row: Record<string, unknown>, opts?: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    delete: () => { eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }> };
  };
};

async function looseClient(): Promise<LooseSupabaseClient> {
  const sb = await createClient();
  return sb as unknown as LooseSupabaseClient;
}

export async function listChats(): Promise<{ chats?: ServerChat[]; error?: string }> {
  const supabase = await looseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("ai_chats")
    .select("id, title, messages, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message };

  type RawRow = { id: string; title: string; messages: unknown; updated_at: string };
  const rows = (data ?? []) as RawRow[];

  const chats: ServerChat[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    messages: Array.isArray(r.messages) ? (r.messages as PersistedChatMsg[]) : [],
    updated_at: r.updated_at,
  }));

  return { chats };
}

export async function upsertChat(input: { id: string; title: string; messages: PersistedChatMsg[] }): Promise<{ error?: string }> {
  const supabase = await looseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { error } = await supabase
    .from("ai_chats")
    .upsert({
      id:         input.id,
      owner_id:   user.id,
      title:      input.title.slice(0, 200),
      messages:   input.messages,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) return { error: error.message };
  return {};
}

export async function deleteChat(id: string): Promise<{ error?: string }> {
  const supabase = await looseClient();
  const { error } = await supabase.from("ai_chats").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
