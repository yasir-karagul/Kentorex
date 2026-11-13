import { NextResponse } from "next/server";
import { apiErrorResponse, readJson, unauthorizedResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/repo";
import { ProjectInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    return NextResponse.json(await listProjects(user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await readJson(request, ProjectInputSchema);
  if (parsed.response) return parsed.response;
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    return NextResponse.json(await createProject(user.id, parsed.data), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
