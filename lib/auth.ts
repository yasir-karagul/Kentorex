import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ObjectId, type Db } from "mongodb";
import {
  assertFirebaseEmailConfiguration,
  createFirebaseAccount,
  deleteFirebaseAccount,
  isFirebaseEmailVerified,
  sendFirebaseVerificationEmail,
} from "./firebase-auth";
import { DuplicateAccountError } from "./auth-errors";
import { getDb } from "./mongo";

const COOKIE_NAME = "kentorex_session";
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14;

type StoredUser = {
  _id: ObjectId;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  firebaseUid?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date;
  createdAt: Date;
};

type StoredSession = {
  tokenHash: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
};

export type AccountUser = { id: string; name: string; email: string };

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Account storage is unavailable. Configure MONGODB_URI and try again.");
    this.name = "DatabaseUnavailableError";
  }
}

let indexesPromise: Promise<void> | undefined;

async function authDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  indexesPromise ??= Promise.all([
    db.collection<StoredUser>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<StoredSession>("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<StoredSession>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).then(() => undefined);
  try {
    await indexesPromise;
  } catch (error) {
    indexesPromise = undefined;
    throw error;
  }
  return db;
}

async function passwordDigest(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function publicUser(user: Pick<StoredUser, "_id" | "name" | "email">): AccountUser {
  return { id: user._id.toHexString(), name: user.name, email: user.email };
}

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<{ user: AccountUser; firebaseUid: string }> {
  const db = await authDb();
  const users = db.collection<StoredUser>("users");
  if (await users.findOne({ email: input.email }, { projection: { _id: 1 } })) {
    throw new DuplicateAccountError();
  }
  assertFirebaseEmailConfiguration();
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = (await passwordDigest(input.password, passwordSalt)).toString("hex");
  const firebaseUser = await createFirebaseAccount({ email: input.email, name: input.name });
  const user: StoredUser = {
    _id: new ObjectId(),
    name: input.name,
    email: input.email,
    passwordSalt,
    passwordHash,
    firebaseUid: firebaseUser.uid,
    emailVerified: false,
    createdAt: new Date(),
  };
  try {
    await users.insertOne(user);
  } catch (error) {
    try {
      await deleteFirebaseAccount(firebaseUser.uid);
    } catch (cleanupError) {
      console.error("Could not remove the Firebase account after registration failed.", cleanupError);
    }
    throw error;
  }
  return { user: publicUser(user), firebaseUid: firebaseUser.uid };
}

export async function verifyCredentials(email: string, password: string): Promise<{ user: AccountUser; emailVerified: boolean } | null> {
  const db = await authDb();
  const user = await db.collection<StoredUser>("users").findOne({ email });
  if (!user) {
    await passwordDigest(password, "kentorex-invalid-account-check");
    return null;
  }
  const actual = await passwordDigest(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const emailVerified = user.firebaseUid
    ? await isFirebaseEmailVerified(user.firebaseUid, user.email)
    : user.emailVerified !== false;
  if (user.firebaseUid && emailVerified && user.emailVerified !== true) {
    await db.collection<StoredUser>("users").updateOne(
      { _id: user._id, firebaseUid: user.firebaseUid },
      { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
    );
  }
  return { user: publicUser(user), emailVerified };
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const db = await authDb();
  const user = await db.collection<StoredUser>("users").findOne({ email });
  if (!user || user.emailVerified !== false || !user.firebaseUid) return;
  if (await isFirebaseEmailVerified(user.firebaseUid, user.email)) {
    await db.collection<StoredUser>("users").updateOne(
      { _id: user._id, firebaseUid: user.firebaseUid },
      { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
    );
    return;
  }
  await sendFirebaseVerificationEmail(user.firebaseUid);
}

export async function startSession(userId: string): Promise<void> {
  const db = await authDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.collection<StoredSession>("sessions").insertOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId: new ObjectId(userId),
    createdAt: new Date(),
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AccountUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await authDb();
  const session = await db.collection<StoredSession>("sessions").findOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const user = await db.collection<StoredUser>("users").findOne({ _id: session.userId });
  return user && user.emailVerified !== false ? publicUser(user) : null;
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);
  if (!token) return;
  const db = await authDb();
  await db.collection<StoredSession>("sessions").deleteOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
  });
}
