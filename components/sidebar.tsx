"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen, Command, Layers3, Menu, Plus, Search, X } from "lucide-react";
import { z } from "zod";
import type { AccountUser } from "@/lib/auth";
import { ModuleSchema, ProjectSchema, type DocModule } from "@/lib/schemas";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";
import { StatusMark } from "./status-mark";
import { SignOutButton } from "./sign-out-button";

export function Sidebar({ project, projectName, user }: { project: string; projectName: string; user: AccountUser }) {
  const { slug } = useParams<{ slug?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery, menuOpen, setMenu } = useUi();
  const searchRef = useRef<HTMLInputElement>(null);
  const { data = [], isPending, isError } = useQuery({
    queryKey: ["modules", project],
    queryFn: async () => {
      const res = await fetch(`/api/modules?${new URLSearchParams({ project })}`);
      if (!res.ok) throw new Error("Could not load modules");
      return z.array(ModuleSchema).parse(await res.json());
    },
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Could not load projects");
      return z.array(ProjectSchema).parse(await response.json());
    },
  });
  const shown = data.filter((m) => `${m.name} ${m.category} ${m.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = shown.reduce<Record<string, DocModule[]>>((a, m) => ((a[m.category] ??= []).push(m), a), {});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMenu(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setMenu]);

  return (
    <>
      {menuOpen && <button aria-label="Close navigation overlay" onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-ink/25 backdrop-blur-sm lg:hidden" />}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/80 bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href={`/${project}`} onClick={() => setMenu(false)} className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-white"><Layers3 className="size-4" /></span>
          waypoint
        </Link>
        <button aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenu(!menuOpen)} className="rounded-xl border border-line bg-panel p-2 hover:bg-soft">
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[292px] flex-col overflow-y-auto border-r border-line bg-bg px-4 pb-5 pt-5 transition-transform duration-300 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0", menuOpen ? "translate-x-0" : "-translate-x-full")}>
        <Link href={`/${project}`} onClick={() => setMenu(false)} className="mb-7 hidden items-center gap-3 px-2 lg:flex">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/20"><Layers3 className="size-5" /></span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-bold leading-none tracking-tight">waypoint</span>
            <span className="mt-1 block truncate text-xs text-muted">{projectName}</span>
          </span>
          <ArrowUpRight className="ml-auto size-4 text-muted" />
        </Link>
        {projectsQuery.data && projectsQuery.data.length > 1 && (
          <label className="mb-4 block px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Switch project
            <select value={project} onChange={(event) => router.push(`/${event.target.value}`)} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink">
              {projectsQuery.data.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
        )}
        <Link href={`/${project}`} onClick={() => setMenu(false)} aria-current={pathname === `/${project}` ? "page" : undefined}
          className={cn("mb-5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", pathname === `/${project}` ? "bg-soft text-accent" : "text-muted hover:bg-panel hover:text-ink")}>
          <BookOpen className="size-[17px]" />
          Project overview
        </Link>
        <Link href="/projects/new" onClick={() => setMenu(false)} className="mb-5 inline-flex items-center gap-2 self-start rounded-lg px-3 text-xs font-medium text-accent transition hover:bg-soft">
          <Plus className="size-3.5" /> New project
        </Link>
        <label className="relative mb-6 block">
          <Search className="absolute left-3 top-3 size-4 text-muted" aria-hidden />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules" aria-label="Search modules" className="w-full rounded-xl border border-line bg-panel py-2.5 pl-9 pr-10 text-sm shadow-sm shadow-ink/[0.02] placeholder:text-muted/80" />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:bg-soft hover:text-ink"><X className="size-4" /></button>
          ) : (
            <kbd className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md border border-line bg-bg px-1.5 py-1 font-mono text-[10px] text-muted"><Command className="size-3" /> /</kbd>
          )}
        </label>
        <div className="mb-3 flex items-center justify-between px-2">
          <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Knowledge base</h2>
          {!isPending && !isError && <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] text-muted">{shown.length}</span>}
        </div>
        {isPending && <p className="px-2 py-3 text-sm text-muted">Loading modules…</p>}
        {isError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">Couldn’t load the module index. Refresh the page to try again.</p>}
        {!isPending && !isError && shown.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">{query ? `No modules match “${query}”.` : "Add a module to start your index."}</p>}
        <nav aria-label="Project modules" className="flex-1 space-y-6">
          {Object.entries(groups).map(([category, mods]) => (
            <div key={category}>
              <h3 className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted/80">{category}</h3>
              <ul className="space-y-1">
                {mods.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/${project}/${m.slug}`} onClick={() => setMenu(false)} aria-current={m.slug === slug ? "page" : undefined}
                      className={cn("group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-panel", m.slug === slug ? "bg-panel font-medium text-ink shadow-sm shadow-ink/[0.04] ring-1 ring-line" : "text-muted hover:text-ink")}>
                      <span className="truncate">{m.name}</span><StatusMark status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 rounded-2xl border border-line bg-panel p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Signed in</span>
            <span className="size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
          </div>
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="mt-1 truncate text-xs leading-relaxed text-muted">{user.email}</p>
          <div className="mt-2 border-t border-line pt-2"><SignOutButton /></div>
        </div>
      </aside>
    </>
  );
}
