import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-cookie";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";

export async function POST() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(SESSION_EMAIL_COOKIE);
  return NextResponse.json({ ok: true });
}
