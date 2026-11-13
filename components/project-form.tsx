"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Layers3 } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function ProjectForm({ hasProjects }: { hasProjects: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result = await response.json() as { slug?: string; error?: string | { fieldErrors?: Record<string, string[]> } };
      if (!response.ok || !result.slug) {
        const message = typeof result.error === "string"
          ? result.error
          : Object.values(result.error?.fieldErrors ?? {}).flat()[0] ?? "Could not create the project.";
        setError(message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.replace(`/${result.slug}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        {hasProjects
          ? <Link href="/" className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-accent text-white"><Layers3 className="size-4" /></span>kentorex</Link>
          : <span className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-accent text-white"><Layers3 className="size-4" /></span>kentorex</span>}
        <SignOutButton />
      </header>
      <main className="mx-auto mt-16 max-w-2xl">
        {hasProjects && <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent"><ArrowLeft className="size-4" /> Back to workspace</Link>}
        <section className="mt-6 rounded-[28px] border border-line bg-panel p-6 shadow-sm sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">A new project space</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Start with a name.</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">Each project gets its own private index and documentation. You can add modules and import existing notes right from its pages.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium">
              Project name
              <input required autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-3 font-normal placeholder:text-muted/70" placeholder="e.g. Studio website" />
            </label>
            <label className="block text-sm font-medium">
              Short description <span className="font-normal text-muted">(optional)</span>
              <textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-3 font-normal placeholder:text-muted/70" placeholder="What are you building?" />
            </label>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error}</p>}
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#214e3c] disabled:cursor-wait disabled:opacity-60">
              {isPending ? "Creating…" : "Create project"} {!isPending && <ArrowRight className="size-4" />}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
