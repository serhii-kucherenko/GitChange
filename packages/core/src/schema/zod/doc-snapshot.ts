import { z } from "zod";
import { Evidence } from "./evidence.js";

export const DocSnapshot = z.object({
  path: z.string(),
  commitSha: z.string().length(40),
  contentHash: z.string(),
  content: z.string().nullable(),
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  evidence: z.array(Evidence).min(1),
});

export type DocSnapshot = z.infer<typeof DocSnapshot>;
