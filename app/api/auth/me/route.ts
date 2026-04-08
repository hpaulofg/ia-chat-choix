import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { getSessionEmail, getSessionRole } from "@/lib/session-user";
import { isAdminRole } from "@/lib/user-role";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const email = await getSessionEmail();
  const role = await getSessionRole();
  return NextResponse.json({
    email,
    role,
    isAdmin: isAdminRole(role),
  });
}
