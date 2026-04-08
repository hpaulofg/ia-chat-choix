import { requireAuthAndActiveUser } from "@/lib/require-active-session";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthAndActiveUser();
  return children;
}
