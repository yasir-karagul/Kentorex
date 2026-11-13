import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { getProjectForUser } from "./repo";

export async function requireProjectAccess(slug: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const project = await getProjectForUser(slug, user.id);
  if (!project) notFound();
  return { user, project };
}
