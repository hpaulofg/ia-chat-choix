import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "session_token";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret)
    .update("ai-chat-platform-auth-v1")
    .digest("hex");
}

export async function isAuthenticated(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const want = expectedToken(secret);
  try {
    return timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(want, "utf8"));
  } catch {
    return false;
  }
}

export function authCookieValue(secret: string): string {
  return expectedToken(secret);
}

export { COOKIE_NAME };
