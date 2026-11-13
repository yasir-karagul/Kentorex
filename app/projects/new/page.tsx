import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";
import { getCurrentUser } from "@/lib/auth";
import { listProjects } from "@/lib/repo";

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const projects = await listProjects(user.id);
  return <ProjectForm hasProjects={projects.length > 0} />;
}
