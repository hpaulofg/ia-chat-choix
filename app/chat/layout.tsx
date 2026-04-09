import { requireAuthAndActiveUser } from "@/lib/require-active-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthAndActiveUser();
  return children;
}
