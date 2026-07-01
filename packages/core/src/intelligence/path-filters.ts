import { minimatch } from "minimatch";

export const INTELLIGENCE_IGNORE_GLOBS = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "go.sum",
  "vendor/**",
  "dist/**",
  "**/*.pb.go",
  "node_modules/**",
] as const;

export function isIntelligenceIgnoredPath(path: string): boolean {
  return INTELLIGENCE_IGNORE_GLOBS.some((glob) =>
    minimatch(path, glob, { dot: true }),
  );
}
