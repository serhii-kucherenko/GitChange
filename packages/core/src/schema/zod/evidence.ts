import { z } from "zod";

export const Evidence = z.discriminatedUnion("type", [
  z.object({ type: z.literal("commit"), sha: z.string().length(40) }),
  z.object({
    type: z.literal("file"),
    path: z.string(),
    commitSha: z.string().length(40),
  }),
  z.object({
    type: z.literal("doc"),
    path: z.string(),
    commitSha: z.string().length(40),
    excerpt: z.string().max(500),
  }),
  z.object({
    type: z.literal("hunk"),
    path: z.string(),
    commitSha: z.string().length(40),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("interview"),
    path: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.startsWith("interviews/") &&
          !value.includes("..") &&
          !value.startsWith("/"),
        { message: "interview path must resolve under interviews/" },
      ),
    recordedAt: z.string().min(1),
    excerpt: z.string().max(500),
  }),
]);

export type Evidence = z.infer<typeof Evidence>;
