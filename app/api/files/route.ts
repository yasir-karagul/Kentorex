import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createCodeFile, deleteCodeFile, getProjectForUser, hasCodeFilePathConflict, listCodeFiles, updateCodeFile } from "@/lib/repo";
import { CodeFilePathSchema, CodeFileSchema, SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const project = SlugSchema.safeParse(new URL(request.url).searchParams.get("project"));
  if (!project.success) return NextResponse.json({ error: "Invalid project." }, { status: 400 });
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(project.data, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(await listCodeFiles(project.data, user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await readJson(request, CodeFileSchema);
  if (parsed.response) return parsed.response;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(parsed.data.project, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (await hasCodeFilePathConflict(parsed.data.project, parsed.data.path, user.id)) {
      return NextResponse.json({ error: "That path is already used as a folder. Choose another file path." }, { status: 409 });
    }
    return NextResponse.json(await createCodeFile(parsed.data, user.id), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const query = new URL(request.url).searchParams;
  const project = SlugSchema.safeParse(query.get("project"));
  const originalPath = CodeFilePathSchema.safeParse(query.get("originalPath"));
  if (!project.success || !originalPath.success) {
    return NextResponse.json({ error: "A valid project and original file path are required." }, { status: 400 });
  }
  const parsed = await readJson(request, CodeFileSchema);
  if (parsed.response) return parsed.response;
  if (parsed.data.project !== project.data) return NextResponse.json({ error: "Project does not match the file." }, { status: 400 });
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(project.data, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (await hasCodeFilePathConflict(project.data, parsed.data.path, user.id, originalPath.data)) {
      return NextResponse.json({ error: "That path is already used as a folder. Choose another file path." }, { status: 409 });
    }
    const updated = await updateCodeFile(parsed.data, user.id, originalPath.data);
    return updated
      ? NextResponse.json(updated)
      : NextResponse.json({ error: "File not found." }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const query = new URL(request.url).searchParams;
  const project = SlugSchema.safeParse(query.get("project"));
  const path = CodeFilePathSchema.safeParse(query.get("path"));
  if (!project.success || !path.success) {
    return NextResponse.json({ error: "A valid project and file path are required." }, { status: 400 });
  }
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!await getProjectForUser(project.data, user.id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const deleted = await deleteCodeFile(project.data, path.data, user.id);
    return deleted
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "File not found." }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
