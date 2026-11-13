"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  PencilLine,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { z } from "zod";
import { CodeFileSchema, type CodeFile } from "@/lib/schemas";

type TreeNode = { name: string; path: string; file?: CodeFile; children: Map<string, TreeNode> };
type ApiResult = { error?: string | { fieldErrors?: Record<string, string[]> }; path?: string; content?: string };

function errorText(result: ApiResult) {
  if (typeof result.error === "string") return result.error;
  return Object.values(result.error?.fieldErrors ?? {}).flat()[0] ?? "Please check your entries and try again.";
}

function makeTree(files: CodeFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const file of files) {
    let node = root;
    const segments = file.path.split("/");
    segments.forEach((name, index) => {
      const path = node.path ? `${node.path}/${name}` : name;
      let child = node.children.get(name);
      if (!child) {
        child = { name, path, children: new Map() };
        node.children.set(name, child);
      }
      if (index === segments.length - 1) child.file = file;
      node = child;
    });
  }
  return root;
}

export function CodeBrowser({ project, documentationHref = "#documentation" }: { project: string; documentationHref?: string }) {
  const queryClient = useQueryClient();
  const { data: files = [], isPending, isError } = useQuery({
    queryKey: ["files", project],
    queryFn: async () => {
      const response = await fetch(`/api/files?${new URLSearchParams({ project })}`);
      if (!response.ok) throw new Error("Could not load project files.");
      return z.array(CodeFileSchema).parse(await response.json());
    },
  });
  const [selectedPath, setSelectedPath] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [editingOriginalPath, setEditingOriginalPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPendingAction, setIsPendingAction] = useState(false);
  const tree = useMemo(() => makeTree(files), [files]);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;

  useEffect(() => {
    if (!editing && !selectedPath && files.length) setSelectedPath(files[0].path);
  }, [editing, files, selectedPath]);

  function startCreate() {
    setSelectedPath("");
    setEditingOriginalPath(null);
    setPath("");
    setContent("");
    setError("");
    setNotice("");
    setEditing(true);
  }

  function startEdit() {
    if (!selectedFile) return;
    setEditingOriginalPath(selectedFile.path);
    setPath(selectedFile.path);
    setContent(selectedFile.content);
    setError("");
    setNotice("");
    setEditing(true);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setIsPendingAction(true);
    try {
      const form = new FormData();
      form.set("project", project);
      form.set("file", file);
      const response = await fetch("/api/files/import", { method: "POST", body: form });
      const result = await response.json() as ApiResult;
      if (!response.ok || typeof result.path !== "string" || typeof result.content !== "string") {
        setError(errorText(result));
        return;
      }
      const existing = files.find((item) => item.path === result.path);
      setPath(result.path);
      setContent(result.content);
      setSelectedPath(existing?.path ?? "");
      setEditingOriginalPath(existing?.path ?? null);
      setEditing(true);
      setNotice("Imported into the editor. Review it, then save the file.");
    } catch {
      setError("Could not import that file. Check your connection and try again.");
    } finally {
      event.target.value = "";
      setIsPendingAction(false);
    }
  }

  async function saveFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const originalPath = editingOriginalPath;
    const parsed = CodeFileSchema.safeParse({ project, path, content });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the file details.");
      return;
    }
    setIsPendingAction(true);
    try {
      const query = new URLSearchParams({ project });
      if (originalPath) query.set("originalPath", originalPath);
      const response = await fetch(`/api/files${originalPath ? `?${query}` : ""}`, {
        method: originalPath ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as CodeFile | ApiResult;
      if (!response.ok) {
        setError("error" in result ? errorText(result) : "Could not save this file.");
        return;
      }
      const saved = CodeFileSchema.safeParse(result);
      if (!saved.success) {
        setError("The server returned an invalid file. Your changes were not applied.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["files", project] });
      setSelectedPath(saved.data.path);
      setEditingOriginalPath(null);
      setEditing(false);
      setNotice("File saved.");
    } catch {
      setError("Could not save this file. Check your connection and try again.");
    } finally {
      setIsPendingAction(false);
    }
  }

  async function removeFile() {
    if (!selectedFile || !window.confirm(`Delete ${selectedFile.path}? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    setIsPendingAction(true);
    try {
      const query = new URLSearchParams({ project, path: selectedFile.path });
      const response = await fetch(`/api/files?${query}`, { method: "DELETE" });
      if (!response.ok) {
        setError(errorText(await response.json() as ApiResult));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["files", project] });
      setSelectedPath("");
      setNotice("File deleted.");
    } catch {
      setError("Could not delete this file. Check your connection and try again.");
    } finally {
      setIsPendingAction(false);
    }
  }

  async function copyFile() {
    if (!selectedFile) return;
    setError("");
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setNotice("Code copied to clipboard.");
    } catch {
      setError("Could not copy the code. Check your browser clipboard permissions.");
    }
  }

  function renderTree(node: TreeNode, depth = 0): React.ReactNode {
    const folders = [...node.children.values()].filter((child) => child.children.size > 0).sort((a, b) => a.name.localeCompare(b.name));
    const leafFiles = [...node.children.values()].filter((child) => child.file && child.children.size === 0).sort((a, b) => a.name.localeCompare(b.name));
    const rows = [
      ...folders.map((child) => {
        const isCollapsed = collapsed.has(child.path);
        return (
          <li key={`folder-${child.path}`}>
            <button type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsed((previous) => {
              const next = new Set(previous);
              if (next.has(child.path)) next.delete(child.path);
              else next.add(child.path);
              return next;
            })} style={{ paddingLeft: `${12 + depth * 14}px` }} className="flex min-h-9 w-full items-center gap-2 rounded-lg pr-3 text-left text-xs font-medium text-muted transition hover:bg-white hover:text-ink">
              {isCollapsed ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
              {isCollapsed ? <Folder className="size-4 shrink-0 text-[#9b815b]" /> : <FolderOpen className="size-4 shrink-0 text-[#9b815b]" />}
              <span className="truncate">{child.name}</span>
            </button>
            {!isCollapsed && <ul>{renderTree(child, depth + 1)}</ul>}
          </li>
        );
      }),
      ...leafFiles.map((child) => (
        <li key={`file-${child.path}`}>
          <button type="button" onClick={() => {
            setSelectedPath(child.path);
            setEditingOriginalPath(null);
            setEditing(false);
            setError("");
            setNotice("");
          }} aria-current={selectedPath === child.path ? "page" : undefined} style={{ paddingLeft: `${30 + depth * 14}px` }} className={`flex min-h-9 w-full items-center gap-2 rounded-lg pr-3 text-left text-xs transition ${selectedPath === child.path ? "bg-white font-medium text-accent shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}>
            <FileCode2 className="size-3.5 shrink-0" />
            <span className="truncate">{child.name}</span>
          </button>
        </li>
      )),
    ];
    return rows;
  }

  return (
    <section id="source-files" aria-labelledby="source-files-title" className="mt-10 scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Project source</p>
          <h2 id="source-files-title" className="mt-1 font-display text-xl font-semibold">Code & file hierarchy</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={documentationHref} className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-panel hover:text-accent">Back to documentation</a>
          <button type="button" onClick={startCreate} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-accent transition hover:border-accent/40"><FilePlus2 className="size-3.5" /> New file</button>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-[#214e3c] ${isPendingAction ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="size-3.5" /> Import file
            <input type="file" accept="text/*,.md,.markdown,.json,.yaml,.yml,.xml,.html,.css,.scss,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.cs,.cpp,.h,.sql,.sh,.bat,.ps1,.toml,.ini,.env" disabled={isPendingAction} className="sr-only" onChange={importFile} />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-line bg-panel shadow-sm shadow-ink/[0.03]">
        <div className="grid min-h-[420px] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside aria-label="Project file hierarchy" className="border-b border-line bg-[#fafbf8] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">Files</span>
              <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] text-muted">{files.length}</span>
            </div>
            <div className="soft-scrollbar max-h-[250px] overflow-y-auto p-2.5 lg:max-h-[min(68vh,680px)]">
              {isPending && <p className="px-2 py-3 text-xs text-muted">Loading files…</p>}
              {isError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-800">Couldn’t load files. Refresh the page to try again.</p>}
              {!isPending && !isError && files.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-muted">Your project has no source files yet. Add one or import a text file.</p>}
              {!isPending && !isError && files.length > 0 && <ul className="space-y-0.5">{renderTree(tree)}</ul>}
            </div>
          </aside>

          <div className="min-w-0">
            {editing ? (
              <form onSubmit={saveFile} className="flex min-h-[420px] flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="code-file-path" className="sr-only">File path</label>
                    <input id="code-file-path" required maxLength={240} value={path} onChange={(event) => setPath(event.target.value)} placeholder="src/example.ts" className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink" />
                  </div>
                  <button type="button" aria-label="Cancel editing" onClick={() => { setEditing(false); setEditingOriginalPath(null); setError(""); setNotice(""); }} className="rounded-lg p-2 text-muted transition hover:bg-bg hover:text-ink"><X className="size-4" /></button>
                </div>
                <label htmlFor="code-file-content" className="sr-only">File content</label>
                <textarea id="code-file-content" maxLength={300_000} value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} className="soft-scrollbar min-h-[340px] flex-1 resize-y bg-[#1e2b25] p-4 font-mono text-xs leading-6 text-[#ecf1e8] outline-none sm:p-5" placeholder="Write or paste file content…" />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                  <span className="text-[11px] text-muted">{content.length.toLocaleString()} / 300,000 characters</span>
                  <button type="submit" disabled={isPendingAction} className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#214e3c] disabled:cursor-wait disabled:opacity-60">{isPendingAction ? "Saving…" : "Save file"}</button>
                </div>
              </form>
            ) : selectedFile ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <FileCode2 className="size-4 shrink-0 text-accent" />
                    <span className="truncate font-mono text-muted">{selectedFile.path}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={copyFile} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-bg hover:text-accent"><Clipboard className="size-3.5" /> Copy</button>
                    <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-bg hover:text-accent"><PencilLine className="size-3.5" /> Edit</button>
                    <button type="button" onClick={removeFile} disabled={isPendingAction} aria-label={`Delete ${selectedFile.path}`} className="rounded-lg p-2 text-muted transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
                <pre className="soft-scrollbar max-h-[min(68vh,680px)] min-h-[340px] overflow-auto bg-[#1e2b25] p-4 text-xs leading-6 text-[#ecf1e8] sm:p-5"><code>{selectedFile.content}</code></pre>
              </>
            ) : (
              <div className="grid min-h-[420px] place-items-center px-6 py-10 text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-soft text-accent"><FileCode2 className="size-5" /></span>
                  <h3 className="mt-4 font-display text-lg font-semibold">A home for your project files</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">Choose a file from the hierarchy to view and copy its code, or add/import a file to get started.</p>
                  <button type="button" onClick={startCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-xs font-medium text-white transition hover:bg-[#214e3c]"><FilePlus2 className="size-3.5" /> Create a file</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {(error || notice) && (
          <div className="border-t border-line px-4 py-3 sm:px-5">
            {error
              ? <p role="alert" className="text-xs text-rose-800">{error}</p>
              : <p role="status" className="flex items-center gap-1.5 text-xs text-accent"><Check className="size-3.5" />{notice}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
