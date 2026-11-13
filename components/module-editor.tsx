"use client";

import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, ImagePlus, PencilLine, Plus, Table2, Trash2, X } from "lucide-react";
import { ModuleSchema, StatusSchema, type DocModule } from "@/lib/schemas";

type Props = { project: string; module?: DocModule };
type EditableModule = Omit<DocModule, "project">;
type ApiResult = {
  error?: string | { fieldErrors?: Record<string, string[]> };
  body?: string;
  images?: Array<{ markdown: string }>;
};

const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\((\/api\/content\/images\/[a-f\d]{24}\?project=[a-z\d-]+(?:&[a-z\d_-]+=[^)\s]*)*)\)/gi;

function slugify(value: string) {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function emptyModule(): EditableModule {
  return {
    slug: "",
    name: "",
    category: "Core",
    status: "planned",
    summary: "",
    tabs: [
      { id: "overview", label: "Overview", body: "" },
      { id: "architecture", label: "Architecture", body: "" },
      { id: "implementation", label: "Implementation", body: "" },
      { id: "notes", label: "Decisions & notes", body: "" },
    ],
  };
}

function errorText(result: ApiResult) {
  if (typeof result.error === "string") return result.error;
  return Object.values(result.error?.fieldErrors ?? {}).flat()[0] ?? "Please check your entries and try again.";
}

function imagePreview(markdown: string, alt: string, src: string) {
  const preview = document.createElement("span");
  preview.className = "doc-editor-image";
  preview.contentEditable = "false";
  preview.dataset.markdown = markdown;

  const image = document.createElement("img");
  image.src = `${src}${src.includes("?") ? "&" : "?"}v=2`;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.removeImage = "true";
  remove.setAttribute("aria-label", `Remove image ${alt || "preview"}`);
  remove.textContent = "×";
  preview.append(image, remove);
  return preview;
}

function editorNodes(markdown: string): Node[] {
  const nodes: Node[] = [];
  let cursor = 0;
  for (const match of markdown.matchAll(IMAGE_MARKDOWN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(document.createTextNode(markdown.slice(cursor, index)));
    nodes.push(imagePreview(match[0], match[1], match[2]));
    cursor = index + match[0].length;
  }
  if (cursor < markdown.length) nodes.push(document.createTextNode(markdown.slice(cursor)));
  return nodes;
}

function renderEditorBody(editor: HTMLDivElement, markdown: string) {
  editor.replaceChildren(...editorNodes(markdown));
  editor.dataset.hydrated = "true";
}

function serializeEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  if (element.dataset.markdown) return element.dataset.markdown;
  if (element.tagName === "BR") return "\n";
  const content = Array.from(element.childNodes).map(serializeEditorNode).join("");
  return element.tagName === "DIV" || element.tagName === "P" ? `${content}\n` : content;
}

function serializeEditor(editor: HTMLDivElement) {
  const content = Array.from(editor.childNodes).map(serializeEditorNode).join("");
  return /^(DIV|P)$/.test(editor.lastElementChild?.tagName ?? "") && content.endsWith("\n")
    ? content.slice(0, -1)
    : content;
}

function tableMarkdown(rows: number, columns: number) {
  const line = (values: string[]) => `| ${values.join(" | ")} |`;
  const headings = Array.from({ length: columns }, (_, index) => `Column ${index + 1}`);
  const separator = Array.from({ length: columns }, () => "---");
  const emptyRow = Array.from({ length: columns }, () => "");
  return `\n\n${[line(headings), line(separator), ...Array.from({ length: rows }, () => line(emptyRow))].join("\n")}\n\n`;
}

export function ModuleEditor({ project, module }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filePickerTrigger = useRef<HTMLButtonElement | null>(null);
  const editors = useRef<Record<string, HTMLDivElement | null>>({});
  const selections = useRef<Record<string, Range | null>>({});
  const isEditing = Boolean(module);
  const initial = module ?? emptyModule();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<EditableModule>(initial);
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tableTargetTab, setTableTargetTab] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState("3");
  const [tableColumns, setTableColumns] = useState("3");

  function restoreFilePickerFocus() {
    const trigger = filePickerTrigger.current;
    requestAnimationFrame(() => {
      if (dialogRef.current?.open && trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  }

  function openFilePicker(
    tabId: string,
    kind: "document" | "image",
    trigger: HTMLButtonElement,
  ) {
    const input = document.getElementById(`module-${kind}-${tabId}`);
    if (!(input instanceof HTMLInputElement)) {
      setError("Could not open the file picker. Please try again.");
      return;
    }
    filePickerTrigger.current = trigger;
    input.value = "";
    input.click();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleFilePickerCancel = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== "file") return;
      event.stopPropagation();
      event.target.value = "";
      restoreFilePickerFocus();
    };
    dialog.addEventListener("cancel", handleFilePickerCancel, true);
    return () => dialog.removeEventListener("cancel", handleFilePickerCancel, true);
  }, []);

  function updateName(name: string) {
    setValue((previous) => ({
      ...previous,
      name,
      slug: slugTouched ? previous.slug : slugify(name),
    }));
  }

  function openEditor() {
    Object.values(editors.current).forEach((editor) => {
      if (editor) editor.dataset.hydrated = "false";
    });
    selections.current = {};
    setValue(module
      ? { ...module, tabs: module.tabs.map((tab) => ({ ...tab })) }
      : emptyModule());
    setSlugTouched(Boolean(module));
    setConfirmDelete(false);
    setTableTargetTab(null);
    setError("");
    setOpen(true);
  }

  function updateTab(tabId: string, patch: Partial<DocModule["tabs"][number]>) {
    setValue((previous) => ({
      ...previous,
      tabs: previous.tabs.map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab),
    }));
  }

  function rememberSelection(tabId: string, editor: HTMLDivElement) {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
      selections.current[tabId] = selection.getRangeAt(0).cloneRange();
    }
  }

  function syncEditor(tabId: string, editor: HTMLDivElement) {
    rememberSelection(tabId, editor);
    updateTab(tabId, { body: serializeEditor(editor) });
  }

  function pastePlainText(tabId: string, editor: HTMLDivElement, event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    selections.current[tabId] = range.cloneRange();
    syncEditor(tabId, editor);
  }

  function insertAtCursor(tabId: string, markdown: string, asBlock = false) {
    const editor = editors.current[tabId];
    if (!editor) return;
    const form = editor.closest("form");
    const editorScrollTop = editor.scrollTop;
    const formScrollTop = form?.scrollTop ?? 0;
    const pageScrollTop = window.scrollY;
    let range = selections.current[tabId];
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    } else {
      range = range.cloneRange();
    }
    const insertion = asBlock ? `\n\n${markdown}\n\n` : markdown;
    range.deleteContents();
    const nodes = editorNodes(insertion);
    const fragment = document.createDocumentFragment();
    nodes.forEach((node) => fragment.appendChild(node));
    const lastNode = fragment.lastChild;
    if (!lastNode) return;
    range.insertNode(fragment);
    range.setStartAfter(lastNode);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus({ preventScroll: true });
    selections.current[tabId] = range.cloneRange();
    syncEditor(tabId, editor);
    requestAnimationFrame(() => {
      editor.scrollTop = editorScrollTop;
      if (form) form.scrollTop = formScrollTop;
      window.scrollTo({ top: pageScrollTop, behavior: "instant" });
      editor.focus({ preventScroll: true });
    });
  }

  function setEditorBody(tabId: string, body: string) {
    const editor = editors.current[tabId];
    if (editor) renderEditorBody(editor, body);
    selections.current[tabId] = null;
    updateTab(tabId, { body });
  }

  function insertTable(tabId: string) {
    const rows = Number(tableRows);
    const columns = Number(tableColumns);
    if (!Number.isInteger(rows) || rows < 1 || rows > 50 || !Number.isInteger(columns) || columns < 1 || columns > 20) {
      setError("Choose 1–50 data rows and 1–20 columns.");
      return;
    }
    setError("");
    insertAtCursor(tabId, tableMarkdown(rows, columns));
    setTableTargetTab(null);
  }

  function addTab() {
    const nextIndex = value.tabs.length + 1;
    let id = `section-${nextIndex}`;
    while (value.tabs.some((tab) => tab.id === id)) id = `section-${++idCounter.current}`;
    setValue((previous) => ({
      ...previous,
      tabs: [...previous.tabs, { id, label: `Section ${nextIndex}`, body: "" }],
    }));
  }

  const idCounter = useRef(4);

  async function importFile(tabId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      restoreFilePickerFocus();
      return;
    }
    setError("");
    setIsPending(true);
    let imported = false;
    try {
      const form = new FormData();
      form.set("project", project);
      form.set("file", file);
      const response = await fetch("/api/content/import", { method: "POST", body: form });
      const result = await response.json() as ApiResult;
      if (!response.ok || typeof result.body !== "string") {
        setError(errorText(result));
        return;
      }
      setEditorBody(tabId, result.body);
      editors.current[tabId]?.focus({ preventScroll: true });
      imported = true;
    } catch {
      setError("Could not import that file. Check your connection and try again.");
    } finally {
      event.target.value = "";
      setIsPending(false);
      if (!imported) restoreFilePickerFocus();
    }
  }

  async function importImages(tabId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      restoreFilePickerFocus();
      return;
    }
    setError("");
    setIsPending(true);
    let uploaded = false;
    try {
      const form = new FormData();
      form.set("project", project);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/content/images", { method: "POST", body: form });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.images?.length || result.images.some((image) => typeof image.markdown !== "string")) {
        setError(errorText(result));
        return;
      }
      insertAtCursor(tabId, result.images.map((image) => image.markdown).join("\n\n"), true);
      uploaded = true;
    } catch {
      setError("Could not add those images. Check your connection and try again.");
    } finally {
      event.target.value = "";
      setIsPending(false);
      if (!uploaded) restoreFilePickerFocus();
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = ModuleSchema.safeParse({ ...value, project });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the module fields.");
      return;
    }
    setIsPending(true);
    try {
      const originalSlug = module?.slug;
      const endpoint = originalSlug
        ? `/api/modules?originalSlug=${encodeURIComponent(originalSlug)}`
        : "/api/modules";
      const response = await fetch(endpoint, {
        method: originalSlug ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as DocModule | ApiResult;
      if (!response.ok) {
        setError("error" in result ? errorText(result) : "Could not save this module.");
        return;
      }
      const saved = ModuleSchema.safeParse(result);
      if (!saved.success) {
        setError("The server returned an invalid module. Your changes were not applied.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["modules", project] });
      setOpen(false);
      router.push(`/${project}/${saved.data.slug}`);
      router.refresh();
    } catch {
      setError("Could not save this module. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function remove() {
    if (!module) return;
    setError("");
    setIsPending(true);
    try {
      const query = new URLSearchParams({ project, slug: module.slug });
      const response = await fetch(`/api/modules?${query}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json() as ApiResult;
        setError(errorText(result));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["modules", project] });
      setOpen(false);
      router.replace(`/${project}`);
      router.refresh();
    } catch {
      setError("Could not delete this module. Check your connection and try again.");
    } finally {
      setIsPending(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openEditor} className={isEditing
        ? "inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition hover:border-accent/40 hover:text-accent"
        : "inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-white/70 px-4 py-3 text-sm font-medium text-accent transition hover:border-accent/40 hover:bg-white"}>
        {isEditing ? <PencilLine className="size-3.5" /> : <Plus className="size-4" />}
        {isEditing ? "Edit module" : "New module"}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="module-editor-title"
        onCancel={(event) => {
          if (event.target !== dialogRef.current) return;
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }}
        className="m-auto max-h-[92vh] w-[min(900px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-line bg-bg p-0 text-ink shadow-[0_24px_100px_rgba(20,35,27,0.28)] backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-7">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent">{isEditing ? "Update documentation" : "Add to the knowledge base"}</p>
            <h2 id="module-editor-title" className="mt-1 font-display text-xl font-semibold">{isEditing ? "Edit module" : "Create a module"}</h2>
          </div>
          <button type="button" aria-label="Close editor" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-bg hover:text-ink"><X className="size-4" /></button>
        </div>
        <form onSubmit={save} className="soft-scrollbar max-h-[calc(92vh-78px)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">
              Module name
              <input required autoFocus={!isEditing} maxLength={120} value={value.name} onChange={(event) => updateName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 font-normal" placeholder="e.g. Identity & access" />
            </label>
            <label className="text-sm font-medium">
              URL slug
              <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={value.slug} onChange={(event) => { setSlugTouched(true); setValue((previous) => ({ ...previous, slug: event.target.value })); }} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 font-mono text-sm font-normal" placeholder="identity-access" />
            </label>
            <label className="text-sm font-medium">
              Collection
              <input required maxLength={80} value={value.category} onChange={(event) => setValue((previous) => ({ ...previous, category: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 font-normal" placeholder="Core" />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Short description
              <textarea rows={2} maxLength={500} value={value.summary} onChange={(event) => setValue((previous) => ({ ...previous, summary: event.target.value }))} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-panel px-3 py-2.5 font-normal" placeholder="What does this module own?" />
            </label>
            <label className="text-sm font-medium">
              Lifecycle
              <select value={value.status} onChange={(event) => {
                const status = StatusSchema.safeParse(event.target.value);
                if (status.success) setValue((previous) => ({ ...previous, status: status.data }));
              }} className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 font-normal">
                <option value="planned">Planned</option>
                <option value="in-progress">In progress</option>
                <option value="stable">Stable</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </label>
          </div>

          <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Write or import content</p>
              <h3 className="mt-1 font-display text-lg font-semibold">Documentation sections</h3>
            </div>
            <button type="button" onClick={addTab} disabled={value.tabs.length >= 20} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-accent hover:border-accent/40 disabled:opacity-50"><Plus className="size-3.5" /> Add section</button>
          </div>

          <div className="space-y-3">
            {value.tabs.map((tab, index) => (
              <section key={tab.id} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
                <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-3 sm:grid-cols-[minmax(120px,0.65fr)_minmax(160px,1fr)]">
                    <label className="text-xs font-medium text-muted">
                      Section label
                      <input required maxLength={80} value={tab.label} onChange={(event) => updateTab(tab.id, { label: event.target.value })} className="mt-1 w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-sm font-normal text-ink" />
                    </label>
                    <label className="text-xs font-medium text-muted">
                      Section key
                      <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={tab.id} onChange={(event) => updateTab(tab.id, { id: event.target.value })} className="mt-1 w-full rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-xs font-normal text-ink" />
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" disabled={isPending} onClick={(event) => openFilePicker(tab.id, "document", event.currentTarget)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-2 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
                        <FileUp className="size-3.5" /> Import .md / .docx
                      </button>
                      <input id={`module-document-${tab.id}`} type="file" accept=".md,.markdown,.docx" className="hidden" disabled={isPending} onChange={(event) => importFile(tab.id, event)} />
                      <button type="button" disabled={isPending} onClick={(event) => openFilePicker(tab.id, "image", event.currentTarget)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-2 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
                        <ImagePlus className="size-3.5" /> Add images
                      </button>
                      <input id={`module-image-${tab.id}`} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden" disabled={isPending} onChange={(event) => importImages(tab.id, event)} />
                      <button type="button" disabled={isPending} onClick={() => { setTableTargetTab(tab.id); setTableRows("3"); setTableColumns("3"); setError(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-2 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-50"><Table2 className="size-3.5" /> Insert table</button>
                    </div>
                    <button type="button" disabled={isPending || value.tabs.length <= 1} onClick={() => setValue((previous) => ({ ...previous, tabs: previous.tabs.filter((item) => item.id !== tab.id) }))} aria-label={`Remove ${tab.label} section`} className="rounded-lg p-2 text-muted transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="size-4" /></button>
                  </div>
                </div>
                {tableTargetTab === tab.id && (
                  <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-bg p-3">
                    <label className="text-xs font-medium text-muted">
                      Data rows
                      <input type="number" min={1} max={50} value={tableRows} onChange={(event) => setTableRows(event.target.value)} className="mt-1 block w-24 rounded-lg border border-line bg-panel px-2.5 py-2 text-sm text-ink" />
                    </label>
                    <label className="text-xs font-medium text-muted">
                      Columns
                      <input type="number" min={1} max={20} value={tableColumns} onChange={(event) => setTableColumns(event.target.value)} className="mt-1 block w-24 rounded-lg border border-line bg-panel px-2.5 py-2 text-sm text-ink" />
                    </label>
                    <button type="button" disabled={isPending} onClick={() => insertTable(tab.id)} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-[#214e3c] disabled:opacity-50">Create table</button>
                    <button type="button" onClick={() => setTableTargetTab(null)} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-ink">Cancel</button>
                    <span className="text-xs text-muted">1–50 rows · 1–20 columns</span>
                  </div>
                )}
                <div className="block text-xs font-medium text-muted">
                  Content <span className="font-normal">· Markdown supported</span>
                  <div
                    ref={(element) => {
                      editors.current[tab.id] = element;
                      if (element && element.dataset.hydrated !== "true") renderEditorBody(element, tab.body);
                    }}
                    role="textbox"
                    aria-label={`${tab.label} content`}
                    aria-multiline="true"
                    contentEditable={!isPending}
                    suppressContentEditableWarning
                    data-placeholder={`Write ${tab.label.toLowerCase()} notes here, or import a Markdown/Word file.`}
                    onInput={(event) => syncEditor(tab.id, event.currentTarget)}
                    onSelect={(event) => rememberSelection(tab.id, event.currentTarget)}
                    onBlur={(event) => rememberSelection(tab.id, event.currentTarget)}
                    onPaste={(event) => pastePlainText(tab.id, event.currentTarget, event)}
                    onClick={(event) => {
                      const target = event.target;
                      if (target instanceof HTMLButtonElement && target.dataset.removeImage === "true") {
                        target.closest(".doc-editor-image")?.remove();
                        syncEditor(tab.id, event.currentTarget);
                      } else {
                        rememberSelection(tab.id, event.currentTarget);
                      }
                    }}
                    className="doc-editor soft-scrollbar mt-1.5 w-full min-h-[8rem] max-h-[60vh] overflow-y-auto resize-y rounded-xl border border-line bg-bg px-3 py-2.5 font-mono text-xs leading-6 text-ink outline-none focus:border-accent/50 disabled:opacity-70"
                  />
                </div>
              </section>
            ))}
            {!value.tabs.length && <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">No sections yet. Add one to start writing.</p>}
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error}</p>}
          {confirmDelete && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>Delete “{module?.name}” and all its sections?</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium">Cancel</button>
                <button type="button" onClick={remove} disabled={isPending} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{isPending ? "Deleting…" : "Delete module"}</button>
              </span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {isEditing
              ? <button type="button" onClick={() => { setConfirmDelete(true); setError(""); }} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"><Trash2 className="size-3.5" /> Delete module</button>
              : <span className="text-xs text-muted">You can edit these details any time.</span>}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-muted hover:text-ink">Cancel</button>
              <button type="submit" disabled={isPending} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#214e3c] disabled:cursor-wait disabled:opacity-60">{isPending ? "Saving…" : isEditing ? "Save changes" : "Create module"}</button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
