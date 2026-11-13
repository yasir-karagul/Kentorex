import { createHmac } from "node:crypto";
import { MongoServerError, type Collection, type Db } from "mongodb";
import { DatabaseUnavailableError } from "./auth";
import { AuthRateLimitError } from "./auth-errors";
import { getClientIp } from "./client-ip";
import { getDb } from "./mongo";

type RateLimitRecord = {
  key: string;
  count: number;
  expiresAt: Date;
  lastAttemptAt?: Date;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
let indexesPromise: Promise<void> | undefined;

async function rateLimitCollection(): Promise<Collection<RateLimitRecord>> {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  indexesPromise ??= Promise.all([
    db.collection<RateLimitRecord>("authRateLimits").createIndex({ key: 1 }, { unique: true }),
    db.collection<RateLimitRecord>("authRateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).then(() => undefined);
  try {
    await indexesPromise;
  } catch (error) {
    indexesPromise = undefined;
    throw error;
  }
  return db.collection<RateLimitRecord>("authRateLimits");
}

function fingerprint(value: string): string {
  return createHmac("sha256", process.env.MONGODB_URI ?? "kentorex-rate-limit")
    .update(value)
    .digest("hex");
}

async function countAttempt(
  collection: Awaited<ReturnType<typeof rateLimitCollection>>,
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<void> {
  const bucket = Math.floor(now / windowMs);
  const key = `${scope}:${fingerprint(identity)}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowMs + DAY);
  try {
    await collection.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    await collection.updateOne({ key }, { $inc: { count: 1 } });
  }
  const record = await collection.findOne({ key }, { projection: { count: 1 } });
  if (!record) throw new Error("Rate-limit counter was not available after update.");
  if (record.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
    throw new AuthRateLimitError(retryAfterSeconds);
  }
}

async function enforceEmailCooldown(
  collection: Awaited<ReturnType<typeof rateLimitCollection>>,
  email: string,
  now: number,
): Promise<void> {
  const key = `resend-cooldown:${fingerprint(email)}`;
  const lastAllowedAt = new Date(now - MINUTE);
  try {
    await collection.updateOne(
      { key, $or: [{ lastAttemptAt: { $lte: lastAllowedAt } }, { lastAttemptAt: { $exists: false } }] },
      { $set: { lastAttemptAt: new Date(now), expiresAt: new Date(now + DAY) } },
      { upsert: true },
    );
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    const record = await collection.findOne({ key }, { projection: { lastAttemptAt: 1 } });
    if (!record?.lastAttemptAt) throw error;
    const retryAfterSeconds = Math.max(1, Math.ceil((record.lastAttemptAt.getTime() + MINUTE - now) / 1000));
    throw new AuthRateLimitError(retryAfterSeconds);
  }
}

export async function enforceRegistrationRateLimit(email: string, ip: string): Promise<void> {
  const collection = await rateLimitCollection();
  const now = Date.now();
  await countAttempt(collection, "register-email-hour", email, 3, HOUR, now);
  await countAttempt(collection, "register-ip-hour", ip, 10, HOUR, now);
}

export async function enforceResendRateLimit(email: string, ip: string): Promise<void> {
  const collection = await rateLimitCollection();
  const now = Date.now();
  await enforceEmailCooldown(collection, email, now);
  await countAttempt(collection, "resend-email-day", email, 5, DAY, now);
  await countAttempt(collection, "resend-ip-hour", ip, 10, HOUR, now);
}
