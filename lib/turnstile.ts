import { ServiceConfigurationError, TurnstileRejectedError } from "./auth-errors";
import { getAppUrl } from "./app-url";
import { getClientIp } from "./client-ip";

type TurnstileResponse = { success?: boolean; action?: string; hostname?: string };

export async function verifyTurnstile(token: string, request: Request, expectedAction: "register" | "resend"): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new ServiceConfigurationError("Missing TURNSTILE_SECRET_KEY.");
  const expectedHost = getAppUrl().hostname;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = getClientIp(request);
  if (ip !== "unknown") form.set("remoteip", ip);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ServiceConfigurationError("Cloudflare Turnstile could not be reached.");
  }
  if (!response.ok) throw new ServiceConfigurationError("Cloudflare Turnstile could not be reached.");
  let result: TurnstileResponse;
  try {
    result = await response.json() as TurnstileResponse;
  } catch {
    throw new ServiceConfigurationError("Cloudflare Turnstile returned an invalid response.");
  }
  if (result.success !== true || result.action !== expectedAction || result.hostname !== expectedHost) {
    throw new TurnstileRejectedError();
  }
}
