import { requireAuthAndActiveUser } from "@/lib/require-active-session";
import { SettingsShell } from "@/components/SettingsShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthAndActiveUser();
  return <SettingsShell>{children}</SettingsShell>;
}
