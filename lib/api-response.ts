import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";
import {
  AuthRateLimitError,
  AuthServiceUnavailableError,
  DuplicateAccountError,
  ServiceConfigurationError,
  TurnstileRejectedError,
  VerificationEmailDeliveryError,
} from "./auth-errors";
import { DatabaseUnavailableError } from "./auth";

export async function readJson<T>(request: Request, schema: { parse: (value: unknown) => T }) {
  let value: unknown;
  try {
    value = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { data: null, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
    }
    throw error;
  }
  try {
    return { data: schema.parse(value), response: null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { data: null, response: NextResponse.json({ error: error.flatten() }, { status: 422 }) };
    }
    throw error;
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof DatabaseUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof ServiceConfigurationError || error instanceof AuthServiceUnavailableError || error instanceof VerificationEmailDeliveryError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof TurnstileRejectedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AuthRateLimitError) {
    return NextResponse.json(
      { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof DuplicateAccountError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof MongoServerError && error.code === 11000) {
    return NextResponse.json({ error: "That email, slug, or record already exists." }, { status: 409 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.flatten() }, { status: 422 });
  }
  throw error;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
}
