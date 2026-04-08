import { redirect } from "next/navigation";

export default function LegacyGroupsRedirect() {
  redirect("/settings/projects");
}
