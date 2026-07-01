import { z } from "zod";

export const Evidence = z.discriminatedUnion("type", [
  z.object({ type: z.literal("commit"), sha: z.string().length(40) }),
  z.object({
    type: z.literal("file"),
    path: z.string(),
    commitSha: z.string().length(40),
  }),
  // RESERVED for Phase 5 (must NOT be required now):
  // z.object({ type: z.literal("hunk"), path, commitSha, startLine, endLine })
]);

export type Evidence = z.infer<typeof Evidence>;
