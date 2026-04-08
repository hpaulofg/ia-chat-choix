import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-cookie";

export default async function Home() {
  if (await isAuthenticated()) {
    redirect("/chat");
  }
  redirect("/login");
}
