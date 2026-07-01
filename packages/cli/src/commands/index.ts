import {
  computeIntelligence,
  indexFull,
  indexIncremental,
  readManifest,
  type IndexProgress,
} from "@gitchange/core";

export interface IndexCommandOptions {
  repoPath: string;
  gitchangeDir: string;
  useWorkers?: boolean;
}

function formatIndexProgress(progress: IndexProgress): string {
  const elapsedSec = Math.round(progress.elapsedMs / 1000);
  const rate = Math.round(progress.rate * 10) / 10;
  return `indexed=${progress.indexed} rate=${rate}/s elapsed=${elapsedSec}s`;
}

export async function runIndexCommand(
  options: IndexCommandOptions,
): Promise<void> {
  const { repoPath, gitchangeDir, useWorkers = true } = options;
  const existingManifest = readManifest(gitchangeDir);

  const onProgress = (progress: IndexProgress): void => {
    process.stderr.write(`${formatIndexProgress(progress)}\n`);
  };

  const indexResult = existingManifest
    ? await indexIncremental({ repoPath, gitchangeDir, useWorkers, onProgress })
    : await indexFull({ repoPath, gitchangeDir, useWorkers, onProgress });

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
