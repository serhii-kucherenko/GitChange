import { and, eq } from "drizzle-orm";
import type { DrizzleDb } from "./db.js";
import * as schema from "../schema/drizzle/schema.js";
import { CommitRecord, type CommitRecord as CommitRecordType } from "../schema/zod/commit.js";
import {
  DocSnapshot,
  type DocSnapshot as DocSnapshotType,
} from "../schema/zod/doc-snapshot.js";
import {
  FileChangeRecord,
  type FileChangeRecord as FileChangeRecordType,
} from "../schema/zod/file-change.js";

export interface SecretFindingInput {
  commitSha: string;
  filePath: string | null;
  ruleId: string;
  location: string;
}

export interface IndexWriter {
  addCommit(record: CommitRecordType): void;
  addFileChange(record: FileChangeRecordType): void;
  addDocSnapshot(record: DocSnapshotType): void;
  addSecretFinding(finding: SecretFindingInput): void;
  flush(): void;
}

const DEFAULT_BATCH_SIZE = 750;

export function createWriter(db: DrizzleDb, batchSize = DEFAULT_BATCH_SIZE): IndexWriter {
  const commitBuffer: CommitRecordType[] = [];
  const fileChangeBuffer: FileChangeRecordType[] = [];
  const docSnapshotBuffer: DocSnapshotType[] = [];
  const secretFindingBuffer: SecretFindingInput[] = [];
  let pendingRows = 0;

  const flushBuffers = (): void => {
    if (pendingRows === 0) {
      return;
    }

    const commits = commitBuffer.splice(0, commitBuffer.length);
    const fileChanges = fileChangeBuffer.splice(0, fileChangeBuffer.length);
    const docSnapshots = docSnapshotBuffer.splice(0, docSnapshotBuffer.length);
    const secretFindings = secretFindingBuffer.splice(0, secretFindingBuffer.length);
    pendingRows = 0;

    db.transaction((tx) => {
      const authorCache = new Map<string, number>();

      const resolveAuthorId = (name: string, email: string): number => {
        const cacheKey = `${name}\0${email}`;
        const cached = authorCache.get(cacheKey);
        if (cached !== undefined) {
          return cached;
        }

        const existing = tx
          .select()
          .from(schema.authors)
          .where(and(eq(schema.authors.name, name), eq(schema.authors.email, email)))
          .get();

        if (existing) {
          authorCache.set(cacheKey, existing.id);
          return existing.id;
        }

        const inserted = tx
          .insert(schema.authors)
          .values({ name, email })
          .returning({ id: schema.authors.id })
          .get();

        authorCache.set(cacheKey, inserted.id);
        return inserted.id;
      };

      for (const record of commits) {
        const authorId = resolveAuthorId(record.authorName, record.authorEmail);
        const committerId = resolveAuthorId(record.committerName, record.committerEmail);

        tx.insert(schema.commits)
          .values({
            sha: record.sha,
            authorId,
            committerId,
            authoredAt: record.authoredAt,
            committedAt: record.committedAt,
            summary: record.summary,
            message: record.message,
            isMerge: record.isMerge,
            parentCount: record.parentCount,
            parentsJson: JSON.stringify(record.parents),
            ccType: record.conventional?.type ?? null,
            ccScope: record.conventional?.scope ?? null,
            ccBreaking: record.conventional?.breaking ?? null,
          })
          .run();
      }

      for (const record of fileChanges) {
        tx.insert(schema.fileChanges)
          .values({
            commitSha: record.commitSha,
            path: record.path,
            oldPath: record.oldPath,
            changeType: record.changeType,
            isBinary: record.isBinary,
            contentIgnored: record.contentIgnored,
            contentRedacted: record.contentRedacted,
            evidenceJson: JSON.stringify(record.evidence),
            hunkStart: null,
            hunkEnd: null,
          })
          .run();
      }

      for (const record of docSnapshots) {
        tx.insert(schema.docSnapshots)
          .values({
            commitSha: record.commitSha,
            path: record.path,
            contentHash: record.contentHash,
            content: record.content,
            frontmatterJson: record.frontmatter ? JSON.stringify(record.frontmatter) : null,
            evidenceJson: JSON.stringify(record.evidence),
          })
          .run();
      }

      for (const finding of secretFindings) {
        tx.insert(schema.secretFindings)
          .values({
            commitSha: finding.commitSha,
            filePath: finding.filePath,
            ruleId: finding.ruleId,
            location: finding.location,
          })
          .run();
      }
    });
  };

  const maybeFlush = (): void => {
    if (pendingRows >= batchSize) {
      flushBuffers();
    }
  };

  return {
    addCommit(record) {
      CommitRecord.parse(record);
      commitBuffer.push(record);
      pendingRows += 1;
      maybeFlush();
    },

    addFileChange(record) {
      FileChangeRecord.parse(record);
      fileChangeBuffer.push(record);
      pendingRows += 1;
      maybeFlush();
    },

    addDocSnapshot(record) {
      DocSnapshot.parse(record);
      docSnapshotBuffer.push(record);
      pendingRows += 1;
      maybeFlush();
    },

    addSecretFinding(finding) {
      secretFindingBuffer.push(finding);
      pendingRows += 1;
      maybeFlush();
    },

    flush() {
      flushBuffers();
    },
  };
}
