import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "crypto";

export async function GET() {
  const secret = process.env.SESSION_SECRET;
  const store = await cookies();
  const token = store.get("session_token")?.value;
  const allCookies = store.getAll().map(c => ({ name: c.name, value: c.value.slice(0, 20) }));
  const expected = secret 
    ? createHmac("sha256", secret).update("ai-chat-platform-auth-v1").digest("hex")
    : "NO SECRET";
  return NextResponse.json({
    secret_present: !!secret,
    token_present: !!token,
    token_value: token?.slice(0, 20),
    expected_value: expected.slice(0, 20),
    match: token === expected,
    all_cookies: allCookies,
  });
}
