import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Boxes, CircleDot, Compass, Layers3, MoveUpRight } from "lucide-react";
import { StatusMark } from "@/components/status-mark";
import { ModuleEditor } from "@/components/module-editor";
import { CodeBrowser } from "@/components/code-browser";
import { requireProjectAccess } from "@/lib/access";
import { listModules } from "@/lib/repo";

const iconByCategory: Record<string, typeof Layers3> = {
  Core: Layers3,
  Foundation: Boxes,
  Product: Compass,
  Platform: Boxes,
};

const accentByCategory: Record<string, string> = {
  Core: "bg-[#eaf1ec] text-[#2b654e]",
  Foundation: "bg-[#f8eee3] text-[#ac6634]",
  Product: "bg-[#edf0fa] text-[#5968a5]",
  Platform: "bg-[#f5ecf2] text-[#8f5e7d]",
};

export default async function ProjectHome({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const { user, project: projectInfo } = await requireProjectAccess(project);
  const mods = await listModules(project, user.id);
  if (!mods.length) {
    return (
      <div className="mx-auto max-w-5xl">
        <div id="project-overview" className="rounded-[28px] border border-line bg-panel p-8 shadow-sm sm:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">A new space</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">{projectInfo.name} starts here.</h1>
          <p className="mt-3 max-w-xl leading-7 text-muted">Create a module to give your architecture, decisions, and guides a place to live. Add your first notes manually or import a Markdown or Word document.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ModuleEditor project={project} />
            <a href="#source-files" className="rounded-xl border border-line bg-bg px-4 py-3 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-accent">Browse source files</a>
          </div>
        </div>
        <CodeBrowser project={project} documentationHref="#project-overview" />
      </div>
    );
  }

  const stable = mods.filter((m) => m.status === "stable").length;
  const inProgress = mods.filter((m) => m.status === "in-progress").length;
  const planned = mods.filter((m) => m.status === "planned").length;
  const coverage = Math.round((stable / mods.length) * 100);
  const categories = new Set(mods.map((m) => m.category)).size;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>Workspace</span><span className="text-line">/</span>          <span className="font-medium text-ink">{projectInfo.name}</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <span className="size-1.5 rounded-full bg-accent" /> Project index
        </span>
      </div>

      <section className="relative isolate overflow-hidden rounded-[30px] border border-[#dbe5d9] bg-[#edf3e9] px-6 py-7 shadow-[0_16px_50px_rgba(40,71,51,0.06)] sm:px-9 sm:py-9 lg:px-11 lg:py-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 -z-10 size-[440px] rounded-full border border-[#d4e0d1] opacity-70" />
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-16 -z-10 size-[310px] rounded-full border border-[#d4e0d1] opacity-80" />
        <div aria-hidden className="pointer-events-none absolute right-8 top-8 -z-10 size-[190px] rounded-full border border-[#d4e0d1] opacity-80" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(290px,0.7fr)] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
              <span className="h-px w-5 bg-accent" /> Your project, in focus
            </p>
            <h1 className="max-w-[13ch] font-display text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-ink sm:text-5xl lg:text-[3.55rem]">
              Good work starts with a clear picture.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#657468] sm:text-lg">
              {projectInfo.description || "One thoughtful home for the systems, decisions, and details behind the work you build."}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#module-library" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-[#214e3c]">
                Explore the index <ArrowDownRight className="size-4" />
              </a>
              <a href="#source-files" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-accent">
                Browse source files <ArrowUpRight className="size-4" />
              </a>
              <ModuleEditor project={project} />
              <span className="inline-flex items-center gap-2 px-2 py-2 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-emerald-500" /> {mods.length} modules · {categories} collections
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[390px] lg:ml-auto">
            <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_50px_rgba(45,76,53,0.10)] backdrop-blur">
              <div className="flex items-start justify-between gap-4 border-b border-line/80 pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Systems map</p>
                  <p className="mt-1 text-sm font-semibold">Everything has a place.</p>
                </div>
                <span className="rounded-lg bg-soft p-2 text-accent"><MoveUpRight className="size-4" /></span>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <div aria-hidden className="absolute left-[24%] right-[24%] top-1/2 h-px bg-[#d9e3d8]" />
                <div aria-hidden className="absolute bottom-[23%] left-1/2 top-[23%] w-px bg-[#d9e3d8]" />
                {mods.slice(0, 4).map((module, index) => {
                  const Icon = iconByCategory[module.category] ?? CircleDot;
                  return (
                    <Link key={module.slug} href={`/${project}/${module.slug}`} className="group relative z-[1] rounded-2xl border border-line/80 bg-white p-3 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
                      <span className={`mb-3 grid size-8 place-items-center rounded-xl ${accentByCategory[module.category] ?? "bg-soft text-accent"}`}><Icon className="size-4" /></span>
                      <span className="block truncate text-xs font-medium text-ink">{module.name}</span>
                      <span className="mt-1 flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted">{module.category}</span>
                        <StatusMark status={module.status} />
                      </span>
                      {index === 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-white bg-[#e06d4a]" />}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-bg px-3 py-2.5">
                <span className="text-xs text-muted">Browse all modules</span>
                <span className="font-mono text-xs text-accent">{mods.length.toString().padStart(2, "0")} <ArrowUpRight className="ml-1 inline size-3" /></span>
              </div>
            </div>
            <div aria-hidden className="absolute -bottom-3 -left-3 -z-10 size-16 rounded-2xl bg-[#e06d4a]/80" />
          </div>
        </div>
      </section>

      <section aria-label="Project status" className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-4 shadow-sm shadow-ink/[0.02]">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf1ec] text-accent"><Layers3 className="size-[18px]" /></span>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Documented</p><p className="mt-0.5 font-display text-xl font-semibold">{mods.length}<span className="ml-1 text-sm font-normal text-muted">modules</span></p></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-4 shadow-sm shadow-ink/[0.02]">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf1ec] text-accent"><CircleDot className="size-[18px]" /></span>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Ready to use</p><p className="mt-0.5 font-display text-xl font-semibold">{stable}<span className="ml-1 text-sm font-normal text-muted">stable</span></p></div>
        </div>
        <div className="rounded-2xl border border-line bg-panel px-4 py-4 shadow-sm shadow-ink/[0.02]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Documentation health</p>
            <span className="font-mono text-xs font-medium text-accent">{coverage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${coverage}%` }} /></div>
          <p className="mt-2 text-[11px] text-muted">{inProgress} in progress · {planned} planned</p>
        </div>
      </section>

      <section id="module-library" className="mt-12 scroll-mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">The knowledge base</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Project modules</h2>
          </div>
          <span className="text-xs text-muted">Choose a module to open its documentation <ArrowUpRight className="ml-1 inline size-3.5" /></span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mods.map((module, index) => {
            const Icon = iconByCategory[module.category] ?? CircleDot;
            return (
              <Link key={module.slug} href={`/${project}/${module.slug}`} className="group relative flex min-h-[178px] flex-col overflow-hidden rounded-[22px] border border-line bg-panel p-5 shadow-sm shadow-ink/[0.02] transition duration-200 hover:-translate-y-1 hover:border-[#c5d5c9] hover:shadow-[0_14px_36px_rgba(36,61,44,0.09)]">
                <span aria-hidden className="absolute right-0 top-0 h-20 w-20 rounded-bl-[52px] bg-bg transition-colors group-hover:bg-soft" />
                <div className="relative flex items-start justify-between gap-3">
                  <span className={`grid size-10 place-items-center rounded-[14px] ${accentByCategory[module.category] ?? "bg-soft text-accent"}`}><Icon className="size-[18px]" /></span>
                  <StatusMark status={module.status} withLabel />
                </div>
                <div className="relative mt-5 flex-1">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{module.category} <span className="px-1 text-line">/</span> {String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{module.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted">{module.summary}</p>
                </div>
                <span className="absolute bottom-5 right-5 grid size-8 place-items-center rounded-full border border-line text-muted transition group-hover:border-accent group-hover:bg-accent group-hover:text-white"><ArrowUpRight className="size-4" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <CodeBrowser project={project} documentationHref="#module-library" />

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-muted">
        <span>waypoint is your adaptable project documentation starter.</span>
        <span className="font-mono">Made to grow with your work</span>
      </footer>
    </div>
  );
}
