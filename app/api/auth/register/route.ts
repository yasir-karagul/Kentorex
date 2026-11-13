import { NextResponse } from "next/server";
import { apiErrorResponse, readJson } from "@/lib/api-response";
import { enforceRegistrationRateLimit } from "@/lib/auth-rate-limit";
import { VerificationEmailDeliveryError } from "@/lib/auth-errors";
import { registerAccount } from "@/lib/auth";
import { sendFirebaseVerificationEmail } from "@/lib/firebase-auth";
import { getClientIp } from "@/lib/client-ip";
import { RegisterSchema } from "@/lib/schemas";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await readJson(request, RegisterSchema);
  if (parsed.response) return parsed.response;
  try {
    const { turnstileToken, ...accountInput } = parsed.data;
    await verifyTurnstile(turnstileToken, request, "register");
    await enforceRegistrationRateLimit(accountInput.email, getClientIp(request));
    const { user, firebaseUid } = await registerAccount(accountInput);
    try {
      await sendFirebaseVerificationEmail(firebaseUid);
    } catch (error) {
      if (!(error instanceof VerificationEmailDeliveryError)) throw error;
      return NextResponse.json({
        error: "Your account was created, but the verification email could not be sent. Please request another email.",
        accountCreated: true,
      }, { status: 503 });
    }
    return NextResponse.json({
      user,
      message: "Check your inbox for a verification link before signing in.",
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
