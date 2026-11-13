import { z } from "zod";

export const StatusSchema = z.enum(["planned", "in-progress", "stable", "deprecated"]);
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");
export const CodeFilePathSchema = z.string().trim().min(1).max(240).refine((path) => {
  const segments = path.split("/");
  return segments.every((segment) =>
    segment !== "." &&
    segment !== ".." &&
    /^[A-Za-z0-9._ -]+$/.test(segment) &&
    !/[. ]$/.test(segment),
  );
}, "Use a relative file path with letters, numbers, dots, underscores, hyphens, and forward slashes.");
export const CodeFileSchema = z.object({
  project: SlugSchema,
  path: CodeFilePathSchema,
  content: z.string().max(300_000),
});
export const TabSchema = z.object({
  id: SlugSchema,
  label: z.string().trim().min(1).max(80),
  body: z.string().max(100_000),
});
export const ModuleSchema = z.object({
  project: SlugSchema,
  slug: SlugSchema,
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  status: StatusSchema,
  summary: z.string().trim().max(500),
  tabs: z.array(TabSchema).max(20),
}).superRefine((module, ctx) => {
  const ids = new Set<string>();
  let totalBodyLength = 0;
  for (const [index, tab] of module.tabs.entries()) {
    if (ids.has(tab.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tabs", index, "id"], message: "Section IDs must be unique." });
    }
    ids.add(tab.id);
    totalBodyLength += tab.body.length;
  }
  if (totalBodyLength > 200_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tabs"], message: "Module content must be under 200 KB." });
  }
});
export const ProjectSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
});
export const ProjectInputSchema = ProjectSchema.omit({ slug: true });
export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
  turnstileToken: z.string().min(1).max(2048),
});
export const ResendVerificationSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  turnstileToken: z.string().min(1).max(2048),
});
export const LoginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type DocModule = z.infer<typeof ModuleSchema>;
export type CodeFile = z.infer<typeof CodeFileSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Project = z.infer<typeof ProjectSchema>;
