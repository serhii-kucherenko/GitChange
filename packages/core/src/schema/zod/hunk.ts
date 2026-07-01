import { z } from "zod";

export const HunkRecord = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  patch: z.string(),
});

export type HunkRecord = z.infer<typeof HunkRecord>;
