import { z } from "zod";
import { Evidence } from "./evidence.js";

export const ChangeType = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typechange",
]);

export type ChangeType = z.infer<typeof ChangeType>;

export const FileChangeRecord = z.object({
  commitSha: z.string().length(40),
  path: z.string(),
  oldPath: z.string().nullable(),
  changeType: ChangeType,
  isBinary: z.boolean(),
  contentIgnored: z.boolean(),
  contentRedacted: z.boolean(),
  evidence: z.array(Evidence).min(1),
});

export type FileChangeRecord = z.infer<typeof FileChangeRecord>;
