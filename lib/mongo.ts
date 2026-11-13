import { MongoClient, type Db } from "mongodb";
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };
/** Returns null when MONGODB_URI is unset; account and project data require MongoDB. */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  g._mongo ??= new MongoClient(uri).connect();
  return (await g._mongo).db(process.env.MONGODB_DB ?? "waypoint");
}
