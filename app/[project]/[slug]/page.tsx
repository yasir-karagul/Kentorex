import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Layers3 } from "lucide-react";
import { notFound } from "next/navigation";
import { ModuleTabs } from "@/components/module-tabs";
import { ModuleEditor } from "@/components/module-editor";
import { CodeBrowser } from "@/components/code-browser";
import { StatusMark } from "@/components/status-mark";
import { requireProjectAccess } from "@/lib/access";
import { getModule, listModules } from "@/lib/repo";

type P = { params: Promise<{ project: string; slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { project, slug } = await params;
  const { user } = await requireProjectAccess(project);
  return { title: (await getModule(project, slug, user.id))?.name ?? "Not found" };
}

export default async function ModulePage({ params }: P) {
  const { project, slug } = await params;
  const { user } = await requireProjectAccess(project);
  const [module, modules] = await Promise.all([
    getModule(project, slug, user.id),
    listModules(project, user.id),
  ]);
  if (!module) notFound();

  const neighbors = modules.filter((item) => item.slug !== slug).slice(0, 3);
  return (
    <article className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
          <Link href={`/${project}`} className="transition hover:text-accent">Project overview</Link>
          <span className="text-line">/</span>
          <span className="font-medium text-ink">{module.category}</span>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={`/${project}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-panel hover:text-ink"><ArrowLeft className="size-3.5" /> All modules</Link>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-[28px] border border-line bg-panel p-6 shadow-sm shadow-ink/[0.03] sm:p-9">
        <div aria-hidden className="absolute -right-10 -top-20 size-64 rounded-full border border-[#dfe8de]" />
        <div aria-hidden className="absolute -right-2 -top-12 size-44 rounded-full border border-[#e7ede5]" />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent"><Layers3 className="size-3.5" /> {module.category}</span>
            <StatusMark status={module.status} withLabel />
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">{module.name}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">{module.summary}</p>
        </div>
        <div className="relative mt-8 grid gap-2 border-t border-line pt-5 sm:grid-cols-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Lifecycle</p><p className="mt-1 text-sm font-medium">{module.status.replace("-", " ")}</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Collection</p><p className="mt-1 text-sm font-medium">{module.category}</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Sections</p><p className="mt-1 text-sm font-medium">{module.tabs.length} documentation {module.tabs.length === 1 ? "section" : "sections"}</p></div>
        </div>
      </header>

      <nav aria-label="Module sections" className="sticky top-[60px] z-10 my-5 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-panel/95 p-1.5 shadow-sm backdrop-blur lg:top-2">
        <div className="flex min-w-0 gap-1">
          <a href="#documentation" className="rounded-lg bg-soft px-3 py-2 text-xs font-medium text-accent">Documentation</a>
          <a href="#source-files" className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:bg-bg hover:text-ink">Source files</a>
        </div>
        <ModuleEditor project={project} module={module} />
      </nav>

      <section id="documentation" aria-label="Module documentation" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Module handbook</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Documentation</h2>
          </div>
          <span className="hidden rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted sm:inline-flex">{module.tabs.length} sections</span>
        </div>
        <ModuleTabs tabs={module.tabs} />
      </section>

      <CodeBrowser project={project} />

      {neighbors.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Keep exploring</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Other project modules</h2>
            </div>
            <Link href={`/${project}`} className="text-xs font-medium text-accent hover:underline">View index</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {neighbors.map((item) => (
              <Link key={item.slug} href={`/${project}/${item.slug}`} className="group rounded-2xl border border-line bg-panel p-4 transition hover:-translate-y-0.5 hover:border-[#c5d5c9] hover:shadow-md">
                <span className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{item.category}</span>
                  <ArrowUpRight className="size-4 text-muted transition group-hover:text-accent" />
                </span>
                <span className="block font-display text-base font-semibold">{item.name}</span>
                <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">{item.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
