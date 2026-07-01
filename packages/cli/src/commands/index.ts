import {
  computeIntelligence,
  indexFull,
  indexIncremental,
  readManifest,
} from "@gitchange/core";

export interface IndexCommandOptions {
  repoPath: string;
  gitchangeDir: string;
}

export async function runIndexCommand(
  options: IndexCommandOptions,
): Promise<void> {
  const { repoPath, gitchangeDir } = options;
  const existingManifest = readManifest(gitchangeDir);

  const indexResult = existingManifest
    ? await indexIncremental({ repoPath, gitchangeDir })
    : await indexFull({ repoPath, gitchangeDir });

  const intelligenceResult = await computeIntelligence({
    repoPath,
    gitchangeDir,
  });

  const manifest = intelligenceResult.manifest;

  console.log(`Indexed ${indexResult.commitsIndexed} commit(s)`);
  console.log(`Manifest lastIndexedCommit: ${manifest.lastIndexedCommit}`);
  console.log(
    `Intelligence schemaVersion: ${manifest.intelligenceSchemaVersion ?? "n/a"}`,
  );

  for (const warning of manifest.warnings) {
    console.log(`Warning [${warning.code}]: ${warning.message}`);
  }
}
