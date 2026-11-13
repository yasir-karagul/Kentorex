import { NextResponse } from "next/server";
import { apiErrorResponse, readJson } from "@/lib/api-response";
import { enforceResendRateLimit } from "@/lib/auth-rate-limit";
import { resendVerificationEmail } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { ResendVerificationSchema } from "@/lib/schemas";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await readJson(request, ResendVerificationSchema);
  if (parsed.response) return parsed.response;
  try {
    await verifyTurnstile(parsed.data.turnstileToken, request, "resend");
    await enforceResendRateLimit(parsed.data.email, getClientIp(request));
    await resendVerificationEmail(parsed.data.email);
    return NextResponse.json({
      message: "If that address has an unverified account, a verification email has been sent.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
