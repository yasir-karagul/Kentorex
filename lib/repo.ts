import { randomBytes } from "node:crypto";
import { Binary, ObjectId } from "mongodb";
import { z } from "zod";
import { DatabaseUnavailableError } from "./auth";
import { getDb } from "./mongo";
import { CodeFileSchema, ModuleSchema, ProjectInputSchema, ProjectSchema, type CodeFile, type DocModule, type Project } from "./schemas";

type StoredProject = Project & { ownerId: ObjectId; createdAt: Date };
type StoredModule = DocModule & { ownerId: ObjectId; createdAt: Date; updatedAt: Date };
type StoredCodeFile = CodeFile & { ownerId: ObjectId; createdAt: Date; updatedAt: Date };
export type ProjectImage = { id: string; contentType: string; data: Buffer };
type StoredProjectImage = {
  _id: ObjectId;
  project: string;
  ownerId: ObjectId;
  contentType: string;
  data: Buffer | Binary;
  createdAt: Date;
};
let contentIndexes: Promise<void> | undefined;

function toImageBuffer(data: Buffer | Binary): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data.value());
}

function requireDb() {
  return getDb().then((db) => {
    if (!db) throw new DatabaseUnavailableError();
    return db;
  });
}

async function ensureContentIndexes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  contentIndexes ??= Promise.all([
    db.collection<StoredProject>("projects").createIndex({ slug: 1 }, { unique: true }),
    db.collection<StoredModule>("modules").createIndex({ project: 1, slug: 1 }, { unique: true }),
    db.collection<StoredCodeFile>("codeFiles").createIndex({ project: 1, ownerId: 1, path: 1 }, { unique: true }),
  ]).then(() => undefined);
  try {
    await contentIndexes;
  } catch (error) {
    contentIndexes = undefined;
    throw error;
  }
}

function toProject(project: StoredProject): Project {
  return ProjectSchema.parse({ slug: project.slug, name: project.name, description: project.description });
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  const db = await requireDb();
  const rows = await db.collection<StoredProject>("projects")
    .find({ ownerId: new ObjectId(ownerId) })
    .project<StoredProject>({ _id: 0 })
    .sort({ createdAt: 1 })
    .toArray();
  return rows.map(toProject);
}

export async function getProjectForUser(slug: string, ownerId: string): Promise<Project | null> {
  const db = await requireDb();
  const project = await db.collection<StoredProject>("projects").findOne(
    { slug, ownerId: new ObjectId(ownerId) },
    { projection: { _id: 0 } },
  );
  return project ? toProject(project) : null;
}

export async function createProject(ownerId: string, input: unknown): Promise<Project> {
  const data = ProjectInputSchema.parse(input);
  const db = await requireDb();
  await ensureContentIndexes(db);
  const baseSlug = data.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "project";
  const project: StoredProject = {
    ...data,
    slug: `${baseSlug}-${randomBytes(3).toString("hex")}`,
    ownerId: new ObjectId(ownerId),
    createdAt: new Date(),
  };
  await db.collection<StoredProject>("projects").insertOne(project);
  return toProject(project);
}

export async function listModules(project: string, ownerId: string): Promise<DocModule[]> {
  const db = await requireDb();
  const docs = await db.collection<StoredModule>("modules")
    .find({ project, ownerId: new ObjectId(ownerId) })
    .project<DocModule>({ _id: 0, ownerId: 0, createdAt: 0, updatedAt: 0 })
    .sort({ category: 1, name: 1 })
    .toArray();
  return z.array(ModuleSchema).parse(docs);
}

export async function getModule(project: string, slug: string, ownerId: string): Promise<DocModule | null> {
  const db = await requireDb();
  const doc = await db.collection<StoredModule>("modules").findOne(
    { project, slug, ownerId: new ObjectId(ownerId) },
    { projection: { _id: 0, ownerId: 0, createdAt: 0, updatedAt: 0 } },
  );
  return doc ? ModuleSchema.parse(doc) : null;
}

export async function createModule(input: unknown, ownerId: string): Promise<DocModule> {
  const module = ModuleSchema.parse(input);
  const db = await requireDb();
  await ensureContentIndexes(db);
  await db.collection<StoredModule>("modules").insertOne({
    ...module,
    ownerId: new ObjectId(ownerId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return module;
}

export async function updateModule(input: unknown, ownerId: string, originalSlug: string): Promise<DocModule | null> {
  const module = ModuleSchema.parse(input);
  const db = await requireDb();
  await ensureContentIndexes(db);
  const result = await db.collection<StoredModule>("modules").updateOne(
    { project: module.project, slug: originalSlug, ownerId: new ObjectId(ownerId) },
    { $set: { ...module, updatedAt: new Date() } },
  );
  return result.matchedCount ? module : null;
}

export async function deleteModule(project: string, slug: string, ownerId: string): Promise<boolean> {
  const db = await requireDb();
  const result = await db.collection<StoredModule>("modules").deleteOne({
    project,
    slug,
    ownerId: new ObjectId(ownerId),
  });
  return result.deletedCount > 0;
}

export async function listCodeFiles(project: string, ownerId: string): Promise<CodeFile[]> {
  const db = await requireDb();
  const docs = await db.collection<StoredCodeFile>("codeFiles")
    .find({ project, ownerId: new ObjectId(ownerId) })
    .project<CodeFile>({ _id: 0, ownerId: 0, createdAt: 0, updatedAt: 0 })
    .sort({ path: 1 })
    .toArray();
  return z.array(CodeFileSchema).parse(docs);
}

export async function hasCodeFilePathConflict(project: string, path: string, ownerId: string, ignorePath?: string): Promise<boolean> {
  const db = await requireDb();
  await ensureContentIndexes(db);
  const collection = db.collection<StoredCodeFile>("codeFiles");
  const owner = new ObjectId(ownerId);
  const parentPaths: string[] = [];
  const segments = path.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    parentPaths.push(segments.slice(0, index).join("/"));
  }
  if (parentPaths.length) {
    const parentFilter: Record<string, unknown> = { $in: parentPaths };
    if (ignorePath) parentFilter.$ne = ignorePath;
    if (await collection.findOne({ project, ownerId: owner, path: parentFilter })) return true;
  }

  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const descendantFilter: Record<string, unknown> = { $regex: `^${escapedPath}/` };
  if (ignorePath) descendantFilter.$ne = ignorePath;
  return Boolean(await collection.findOne({ project, ownerId: owner, path: descendantFilter }));
}

export async function createCodeFile(input: unknown, ownerId: string): Promise<CodeFile> {
  const file = CodeFileSchema.parse(input);
  const db = await requireDb();
  await ensureContentIndexes(db);
  await db.collection<StoredCodeFile>("codeFiles").insertOne({
    ...file,
    ownerId: new ObjectId(ownerId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return file;
}

export async function updateCodeFile(input: unknown, ownerId: string, originalPath: string): Promise<CodeFile | null> {
  const file = CodeFileSchema.parse(input);
  const db = await requireDb();
  await ensureContentIndexes(db);
  const result = await db.collection<StoredCodeFile>("codeFiles").updateOne(
    { project: file.project, path: originalPath, ownerId: new ObjectId(ownerId) },
    { $set: { ...file, updatedAt: new Date() } },
  );
  return result.matchedCount ? file : null;
}

export async function deleteCodeFile(project: string, path: string, ownerId: string): Promise<boolean> {
  const db = await requireDb();
  const result = await db.collection<StoredCodeFile>("codeFiles").deleteOne({
    project,
    path,
    ownerId: new ObjectId(ownerId),
  });
  return result.deletedCount > 0;
}

export async function createProjectImages(
  project: string,
  ownerId: string,
  images: Array<{ contentType: string; data: Buffer }>,
): Promise<ProjectImage[]> {
  const db = await requireDb();
  const stored: StoredProjectImage[] = images.map((image) => ({
    _id: new ObjectId(),
    project,
    ownerId: new ObjectId(ownerId),
    contentType: image.contentType,
    data: image.data,
    createdAt: new Date(),
  }));
  await db.collection<StoredProjectImage>("projectImages").insertMany(stored);
  return stored.map(({ _id, contentType, data }) => ({ id: _id.toHexString(), contentType, data: toImageBuffer(data) }));
}

export async function getProjectImage(id: string, project: string, ownerId: string): Promise<ProjectImage | null> {
  const db = await requireDb();
  const image = await db.collection<StoredProjectImage>("projectImages").findOne({
    _id: new ObjectId(id),
    project,
    ownerId: new ObjectId(ownerId),
  });
  if (!image) return null;
  return { id: image._id.toHexString(), contentType: image.contentType, data: toImageBuffer(image.data) };
}
