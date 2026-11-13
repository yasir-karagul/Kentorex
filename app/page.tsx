import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listProjects } from "@/lib/repo";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const projects = await listProjects(user.id);
  if (!projects.length) redirect("/projects/new");
  redirect(`/${projects[0].slug}`);
}
