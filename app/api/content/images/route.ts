import { NextResponse } from "next/server";
import { apiErrorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createProjectImages, getProjectForUser } from "@/lib/repo";
import { SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_COUNT = 8;

type UploadImage = { contentType: string; data: Buffer; name: string };

function identifyImage(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 6 && ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6))) return "image/gif";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function escapeAltText(name: string) {
  return name.replace(/[\[\]\\\r\n]/g, " ").trim() || "Uploaded image";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const form = await request.formData();
    const project = SlugSchema.safeParse(form.get("project"));
    const files = form.getAll("files");
    if (!project.success || files.length === 0 || files.some((file) => !(file instanceof File))) {
      return NextResponse.json({ error: "Choose a project and one or more image files." }, { status: 400 });
    }
    if (files.length > MAX_IMAGE_COUNT) {
      return NextResponse.json({ error: `Upload up to ${MAX_IMAGE_COUNT} images at a time.` }, { status: 413 });
    }
    if (!await getProjectForUser(project.data, user.id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const uploads: UploadImage[] = [];
    let totalBytes = 0;
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Each image must be between 1 byte and 2 MB." }, { status: 413 });
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        return NextResponse.json({ error: "The total image upload must be 12 MB or less." }, { status: 413 });
      }
      const data = Buffer.from(await file.arrayBuffer());
      const contentType = identifyImage(data);
      if (!contentType) {
        return NextResponse.json({ error: "Use PNG, JPEG, GIF, or WebP images. SVG and other file types are not supported." }, { status: 415 });
      }
      uploads.push({ contentType, data, name: file.name });
    }

    const stored = await createProjectImages(project.data, user.id, uploads);
    const images = stored.map((image, index) => ({
      markdown: `![${escapeAltText(uploads[index].name)}](/api/content/images/${image.id}?project=${project.data})`,
    }));
    return NextResponse.json({ images }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
