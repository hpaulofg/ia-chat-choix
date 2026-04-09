import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { getSessionAppUser } from "@/lib/session-user";
import { isAdminRole } from "@/lib/user-role";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { email, user, role } = await getSessionAppUser();
  return NextResponse.json({
    email: email ?? "",
    fullName: user?.fullName ?? "",
    isAdmin: isAdminRole(role),
    id: user?.id ?? null,
    role,
  });
}
