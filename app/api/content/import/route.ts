import mammoth from "mammoth";
import TurndownService from "turndown";
import { NextResponse } from "next/server";
import { apiErrorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/repo";
import { SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 100_000;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const form = await request.formData();
    const projectValue = form.get("project");
    const file = form.get("file");
    const project = SlugSchema.safeParse(projectValue);
    if (!project.success || !(file instanceof File)) {
      return NextResponse.json({ error: "Choose a project and a Markdown or DOCX file." }, { status: 400 });
    }
    if (!await getProjectForUser(project.data, user.id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Files must be between 1 byte and 5 MB." }, { status: 413 });
    }

    const extension = file.name.toLowerCase().split(".").pop();
    let body: string;
    if (extension === "md" || extension === "markdown") {
      body = await file.text();
    } else if (extension === "docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const { value: html } = await mammoth.convertToHtml({ buffer });
        body = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" }).turndown(html);
      } catch (error) {
        if (error instanceof Error) return NextResponse.json({ error: "Could not read this DOCX file. Check that it is a valid Word document." }, { status: 422 });
        throw error;
      }
    } else {
      return NextResponse.json({ error: "Only .md, .markdown, and .docx files are supported." }, { status: 415 });
    }

    if (body.length > MAX_TEXT_CHARACTERS) {
      return NextResponse.json({ error: "Imported content exceeds the 100,000 character limit." }, { status: 413 });
    }
    return NextResponse.json({ body });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
