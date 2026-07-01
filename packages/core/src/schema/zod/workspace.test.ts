import { describe, expect, it } from "vitest";
import {
  CrossRepoLink,
  RepoEntry,
  WorkspaceArtifact,
} from "./workspace.js";

describe("WorkspaceArtifact schema", () => {
  it("parses a valid workspace with repos and manual links", () => {
    const workspace = WorkspaceArtifact.parse({
      schemaVersion: "1",
      primaryRepoId: "frontend",
      repos: [
        {
          repoId: "frontend",
          label: "Frontend",
          repoPath: "/repos/frontend",
          gitchangeDir: "/repos/frontend/.gitchange",
        },
        {
          repoId: "backend",
          label: "Backend",
          repoPath: "/repos/backend",
          gitchangeDir: "/repos/backend/.gitchange",
        },
      ],
      links: [
        CrossRepoLink.parse({
          id: "link-1",
          sourceRepoId: "frontend",
          targetRepoId: "backend",
          kind: "manual",
          label: "Shared API migration",
          evidenceNote: "Coordinated OpenAPI rollout",
        }),
      ],
    });

    expect(workspace.primaryRepoId).toBe("frontend");
    expect(workspace.repos).toHaveLength(2);
    expect(workspace.links[0]?.kind).toBe("manual");
  });

  it("rejects workspaces without repos", () => {
    expect(() =>
      WorkspaceArtifact.parse({
        schemaVersion: "1",
        primaryRepoId: "only",
        repos: [],
        links: [],
      }),
    ).toThrow();
  });

  it("rejects invalid link kinds", () => {
    expect(() =>
      CrossRepoLink.parse({
        id: "link-1",
        sourceRepoId: "a",
        targetRepoId: "b",
        kind: "inferred",
        label: "Bad link",
      }),
    ).toThrow();
  });

  it("requires absolute-style repo paths on entries", () => {
    const entry = RepoEntry.parse({
      repoId: "app",
      label: "App",
      repoPath: "/tmp/app",
      gitchangeDir: "/tmp/app/.gitchange",
    });

    expect(entry.gitchangeDir).toBe("/tmp/app/.gitchange");
  });
});
