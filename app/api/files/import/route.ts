import { NextResponse } from "next/server";
import { apiErrorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/repo";
import { CodeFilePathSchema, SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_CONTENT_CHARACTERS = 300_000;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const form = await request.formData();
    const project = SlugSchema.safeParse(form.get("project"));
    const file = form.get("file");
    if (!project.success || !(file instanceof File)) {
      return NextResponse.json({ error: "Choose a project and a text file." }, { status: 400 });
    }
    if (!await getProjectForUser(project.data, user.id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Files must be between 1 byte and 1 MB." }, { status: 413 });
    }
    const path = CodeFilePathSchema.safeParse(file.name);
    if (!path.success) {
      return NextResponse.json({ error: "The imported file name is not a valid relative file path." }, { status: 422 });
    }

    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch (error) {
      if (error instanceof TypeError) {
        return NextResponse.json({ error: "This file is not valid UTF-8 text." }, { status: 415 });
      }
      throw error;
    }
    if (content.includes("\0")) {
      return NextResponse.json({ error: "Binary files are not supported." }, { status: 415 });
    }
    if (content.length > MAX_CONTENT_CHARACTERS) {
      return NextResponse.json({ error: "Imported content exceeds the 300,000 character limit." }, { status: 413 });
    }
    return NextResponse.json({ path: path.data, content });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
