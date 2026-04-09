import { DEFAULT_ANTHROPIC_MODEL_ID } from "@/lib/provider-config";
import DevChatClient from "./DevChatClient";

export default function DevChatPage() {
  const defaultModel =
    process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL_ID;
  return <DevChatClient defaultModel={defaultModel} />;
}