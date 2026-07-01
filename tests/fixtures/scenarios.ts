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

export const OWNERSHIP_ALICE = {
  authorName: "Alice Original",
  authorEmail: "alice@gitchange.test",
} as const;

export const OWNERSHIP_BOB = {
  authorName: "Bob Editor",
  authorEmail: "bob@gitchange.test",
} as const;

const APP_SOURCE = [
  "export function greet(name: string): string {",
  "  return `Hello, ${name}!`;",
  "}",
  "",
  "export const version = 1;",
  "",
].join("\n");

/** Line-survival ownership fixture: rename, single-line edit, merge (CONT-04). */
export const OWNSHIP_SCENARIO: CommitSpec[] = [
  {
    message: "feat: add app module",
    ...OWNERSHIP_ALICE,
    files: {
      "src/app.ts": APP_SOURCE,
    },
  },
  {
    message: "refactor: move app into lib",
    ...OWNERSHIP_ALICE,
    renames: [{ from: "src/app.ts", to: "src/lib/app.ts" }],
  },
  {
    message: "feat: tweak greeting",
    ...OWNERSHIP_BOB,
    branch: "feature/greeting",
    files: {
      "src/lib/app.ts": APP_SOURCE.replace(
        "Hello, ${name}!",
        "Hi, ${name}!",
      ),
    },
  },
  {
    message: "Merge branch 'feature/greeting' into main",
    merge: { intoBranch: "main", fromBranch: "feature/greeting" },
  },
];

/** Adds a formatting-only commit for ignore-revs coverage (P2-D-02). */
export const OWNSHIP_SCENARIO_WITH_FORMAT: CommitSpec[] = [
  {
    message: "feat: add app module",
    ...OWNERSHIP_ALICE,
    files: {
      "src/app.ts": APP_SOURCE,
    },
  },
  {
    message: "refactor: move app into lib",
    ...OWNERSHIP_ALICE,
    renames: [{ from: "src/app.ts", to: "src/lib/app.ts" }],
  },
  {
    message: "chore: apply trailing-space format",
    ...OWNERSHIP_BOB,
    files: {
      "src/lib/app.ts": `${APP_SOURCE.replace(/\n/g, " \n")}`,
    },
  },
  {
    message: "feat: tweak greeting",
    ...OWNERSHIP_BOB,
    branch: "feature/greeting",
    files: {
      "src/lib/app.ts": APP_SOURCE.replace(
        "Hello, ${name}!",
        "Hi, ${name}!",
      ).replace(/\n/g, " \n"),
    },
  },
  {
    message: "Merge branch 'feature/greeting' into main",
    merge: { intoBranch: "main", fromBranch: "feature/greeting" },
  },
];
