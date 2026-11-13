import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { endSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
