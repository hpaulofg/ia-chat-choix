import { DEFAULT_ANTHROPIC_MODEL_ID } from "@/lib/provider-config";
import ChatClient from "./ChatClient";

export default function ChatPage() {
  const defaultModel =
    process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL_ID;
  return <ChatClient defaultModel={defaultModel} />;
}
