import { requireAuthAndActiveUser } from "@/lib/require-active-session";

export const dynamic = "force-dynamic";

export default async function VozLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthAndActiveUser();
  return children;
}
