import { NextResponse } from "next/server";
import { apiErrorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser, getProjectImage } from "@/lib/repo";
import { SlugSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const project = SlugSchema.safeParse(new URL(request.url).searchParams.get("project"));
    if (!project.success || !await getProjectForUser(project.data, user.id)) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    const image = await getProjectImage(id, project.data, user.id);
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const body = new ArrayBuffer(image.data.byteLength);
    new Uint8Array(body).set(image.data);
    return new NextResponse(body, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
