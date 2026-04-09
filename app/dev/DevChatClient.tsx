"use client";

import ChatClient from "../chat/ChatClient";

/**
 * Chat só do modo Dev — `kind: "dev"` no Supabase, modelos Claude/GPT apenas.
 * O chat em /chat usa `ChatClient` sem `mode="dev"`.
 */
export default function DevChatClient({ defaultModel }: { defaultModel: string }) {
  return <ChatClient defaultModel={defaultModel} mode="dev" />;
}
