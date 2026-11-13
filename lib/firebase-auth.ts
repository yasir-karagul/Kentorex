import { randomBytes } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth, type UserRecord } from "firebase-admin/auth";
import {
  AuthServiceUnavailableError,
  DuplicateAccountError,
  ServiceConfigurationError,
  VerificationEmailDeliveryError,
} from "./auth-errors";
import { getAppUrl } from "./app-url";

type FirebaseAccountInput = { email: string; name: string };
type IdentityToolkitToken = { idToken?: string };

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ServiceConfigurationError(`Missing ${name}.`);
  return value;
}

function firebaseAdminAuth(): Auth {
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  try {
    const app = getApps()[0] ?? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return getAuth(app);
  } catch {
    throw new ServiceConfigurationError("Firebase Admin credentials are invalid.");
  }
}

export function assertFirebaseEmailConfiguration(): void {
  firebaseAdminAuth();
  requiredEnv("FIREBASE_API_KEY");
  getAppUrl();
}

export async function createFirebaseAccount(input: FirebaseAccountInput): Promise<UserRecord> {
  try {
    return await firebaseAdminAuth().createUser({
      email: input.email,
      password: `${randomBytes(48).toString("base64url")}Aa1!`,
      displayName: input.name,
      emailVerified: false,
    });
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/email-already-exists") {
      throw new DuplicateAccountError();
    }
    throw new AuthServiceUnavailableError();
  }
}

export async function deleteFirebaseAccount(uid: string): Promise<void> {
  await firebaseAdminAuth().deleteUser(uid);
}

export async function isFirebaseEmailVerified(uid: string, email: string): Promise<boolean> {
  try {
    const user = await firebaseAdminAuth().getUser(uid);
    return user.emailVerified && user.email?.toLowerCase() === email;
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    throw new AuthServiceUnavailableError();
  }
}

async function postIdentityToolkit(
  method: "accounts:signInWithCustomToken" | "accounts:sendOobCode",
  body: Record<string, string | boolean>,
): Promise<IdentityToolkitToken> {
  const apiKey = requiredEnv("FIREBASE_API_KEY");
  let response: Response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new VerificationEmailDeliveryError();
  }
  if (!response.ok) throw new VerificationEmailDeliveryError();
  return response.json() as Promise<IdentityToolkitToken>;
}

export async function sendFirebaseVerificationEmail(uid: string): Promise<void> {
  try {
    const auth = firebaseAdminAuth();
    const customToken = await auth.createCustomToken(uid);
    const signedIn = await postIdentityToolkit("accounts:signInWithCustomToken", {
      token: customToken,
      returnSecureToken: true,
    });
    if (!signedIn.idToken) throw new VerificationEmailDeliveryError();
    await postIdentityToolkit("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken: signedIn.idToken,
      continueUrl: new URL("/verify-email", getAppUrl()).toString(),
    });
  } catch (error) {
    if (error instanceof ServiceConfigurationError || error instanceof VerificationEmailDeliveryError) throw error;
    throw new VerificationEmailDeliveryError();
  }
}
