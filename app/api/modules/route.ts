import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createModule, deleteModule, getProjectForUser, listModules, updateModule } from "@/lib/repo";
import { ModuleSchema, SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const project = new URL(request.url).searchParams.get("project") ?? "";
  const parsedProject = SlugSchema.safeParse(project);
  if (!parsedProject.success) return NextResponse.json({ error: "Invalid project." }, { status: 400 });
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(project, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(await listModules(project, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await readJson(request, ModuleSchema);
  if (parsed.response) return parsed.response;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(parsed.data.project, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(await createModule(parsed.data, user.id), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const originalSlug = new URL(request.url).searchParams.get("originalSlug") ?? "";
  const parsedSlug = SlugSchema.safeParse(originalSlug);
  if (!parsedSlug.success) return NextResponse.json({ error: "Invalid original module slug." }, { status: 400 });
  const parsed = await readJson(request, ModuleSchema);
  if (parsed.response) return parsed.response;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(parsed.data.project, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const updated = await updateModule(parsed.data, user.id, originalSlug);
    return updated
      ? NextResponse.json(updated)
      : NextResponse.json({ error: "Module not found." }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const query = new URL(request.url).searchParams;
  const project = SlugSchema.safeParse(query.get("project"));
  const slug = SlugSchema.safeParse(query.get("slug"));
  if (!project.success || !slug.success) return NextResponse.json({ error: "A valid project and module slug are required." }, { status: 400 });
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(project.data, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const deleted = await deleteModule(project.data, slug.data, user.id);
    return deleted
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Module not found." }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
