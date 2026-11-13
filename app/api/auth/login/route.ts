import { NextResponse } from "next/server";
import { apiErrorResponse, readJson } from "@/lib/api-response";
import { startSession, verifyCredentials } from "@/lib/auth";
import { LoginSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await readJson(request, LoginSchema);
  if (parsed.response) return parsed.response;
  try {
    const result = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!result) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    if (!result.emailVerified) {
      return NextResponse.json({
        code: "EMAIL_NOT_VERIFIED",
        error: "Verify your email address before signing in.",
      }, { status: 403 });
    }
    await startSession(result.user.id);
    return NextResponse.json({ user: result.user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
