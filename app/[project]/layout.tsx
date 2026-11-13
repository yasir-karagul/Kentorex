import { Sidebar } from "@/components/sidebar";
import { ScrollEdgeButton } from "@/components/scroll-edge-button";
import { requireProjectAccess } from "@/lib/access";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ project: string }> }) {
  const { project } = await params;
  const access = await requireProjectAccess(project);
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-panel px-4 py-2 text-sm text-ink focus:fixed focus:left-4 focus:top-4 focus:not-sr-only">Skip to content</a>
      <Sidebar project={project} projectName={access.project.name} user={access.user} />
      <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10 xl:px-12">{children}</main>
      <ScrollEdgeButton />
    </div>
  );
}
