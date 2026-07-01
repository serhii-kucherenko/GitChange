import { z } from "zod";

export const CommitRecord = z.object({
  sha: z.string().length(40),
  authorName: z.string(),
  authorEmail: z.string(),
  committerName: z.string(),
  committerEmail: z.string(),
  authoredAt: z.number().int(),
  committedAt: z.number().int(),
  summary: z.string(),
  message: z.string(),
  isMerge: z.boolean(),
  parentCount: z.number().int(),
  parents: z.array(z.string().length(40)),
  conventional: z
    .object({
      type: z.string().optional(),
      scope: z.string().optional(),
      breaking: z.boolean().optional(),
    })
    .optional(),
});

export type CommitRecord = z.infer<typeof CommitRecord>;
