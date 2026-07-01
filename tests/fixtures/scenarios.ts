import type { CommitSpec } from "./builder.js";

const MESSAGE_SECRET = `ghp_${"a".repeat(36)}`;
const DOC_SECRET = `AKIA${"A".repeat(16)}`;
const IGNORED_SECRET = `ghp_${"b".repeat(36)}`;

/** Canonical synthetic repo for golden tests (Plans 03–08). */
export const BASIC_SCENARIO: CommitSpec[] = [
  {
    message: "feat(core): initial scaffold",
    files: {
      "README.md": "# Fixture Repo\n",
      "src/index.ts": "export const version = 1;\n",
    },
  },
  {
    message: "chore: add ignored env",
    files: {
      ".env": `API_KEY=${IGNORED_SECRET}\n`,
      ".gitchangeignore": ".env\n",
    },
  },
  {
    message: "docs: add leak doc",
    files: {
      "docs/leak.md": `# Leak\n\n${DOC_SECRET}\n`,
    },
  },
  {
    message: "refactor(core): rename entry module",
    renames: [{ from: "src/index.ts", to: "src/main.ts" }],
  },
  {
    message: "feat(api): start feature branch",
    branch: "feature/api",
    files: {
      "src/feature.ts": "export const feature = true;\n",
    },
  },
  {
    message: `feat(api): wire endpoint — token ${MESSAGE_SECRET}`,
    files: {
      "src/feature.ts": "export const feature = 2;\n",
    },
  },
  {
    message: "Merge branch 'feature/api' into main",
    merge: { intoBranch: "main", fromBranch: "feature/api" },
  },
];

export { MESSAGE_SECRET, DOC_SECRET, IGNORED_SECRET };
