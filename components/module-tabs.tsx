"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { BookOpen, FileCode2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocModule } from "@/lib/schemas";

export function ModuleTabs({ tabs }: { tabs: DocModule["tabs"] }) {
  if (!tabs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel px-5 py-10 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-soft text-accent"><BookOpen className="size-5" /></span>
        <h3 className="mt-4 font-display text-lg font-semibold">This handbook is ready for its first note.</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Add section definitions to the module data to start documenting this system.</p>
      </div>
    );
  }

  return (
    <Tabs.Root defaultValue={tabs[0].id} className="overflow-hidden rounded-[22px] border border-line bg-panel shadow-sm shadow-ink/[0.02]">
      <Tabs.List className="soft-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line bg-[#fbfcf9] px-3 pt-2 sm:px-5" aria-label="Module sections">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id} className="group -mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-xs font-medium text-muted transition hover:text-ink data-[state=active]:border-accent data-[state=active]:text-accent sm:px-4 sm:text-sm">
            <span className="grid size-5 place-items-center rounded-md bg-transparent text-muted group-data-[state=active]:bg-soft group-data-[state=active]:text-accent">
              <FileCode2 className="size-3.5" />
            </span>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id} className="soft-scrollbar max-h-[min(75vh,760px)] min-h-64 overflow-y-auto p-5 outline-none sm:p-8">
          <div className="mb-6 flex items-start gap-3 border-b border-line pb-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft text-accent"><BookOpen className="size-4" /></span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Section</p>
              <h3 className="mt-0.5 font-display text-lg font-semibold">{tab.label}</h3>
            </div>
          </div>
          {tab.body ? (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                img: ({ alt, src }) => typeof src === "string" && src.startsWith("/api/content/images/")
                  ? <img src={`${src}${src.includes("?") ? "&" : "?"}v=2`} alt={alt ?? ""} loading="lazy" decoding="async" className="my-5 max-h-[70vh] max-w-full rounded-2xl border border-line object-contain" />
                  : <span className="rounded-lg bg-bg px-2 py-1 text-xs text-muted">Image unavailable: {alt || "embedded media"}</span>,
                table: ({ children }) => <table className="soft-scrollbar">{children}</table>,
                pre: ({ children }) => <pre className="soft-scrollbar">{children}</pre>,
              }}>{tab.body}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex max-w-xl items-start gap-3 rounded-2xl bg-bg p-4">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white text-muted"><FileCode2 className="size-3.5" /></span>
              <div>
                <p className="text-sm font-medium text-ink">A space for your documentation</p>
                <p className="mt-1 text-sm leading-6 text-muted">This section is empty in the starter data. Add notes for {tab.label.toLowerCase()} when you are ready.</p>
              </div>
            </div>
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
