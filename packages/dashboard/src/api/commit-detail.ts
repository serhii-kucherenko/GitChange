export interface CommitDetailHunk {
  startLine: number;
  endLine: number;
  patch: string;
}

export interface CommitDetailFile {
  path: string;
  changeType: string;
  hunks: CommitDetailHunk[];
  contentIgnored: boolean;
  contentRedacted: boolean;
}

export interface CommitDetail {
  commit: {
    sha: string;
    summary: string;
    message: string;
    committedAt: number;
    authorName: string;
    authorEmail: string;
  };
  files: CommitDetailFile[];
}

export async function fetchCommitDetail(sha: string): Promise<CommitDetail> {
  const response = await fetch(`/api/commits/${sha}`);

  if (response.status === 404) {
    throw new Error("commit_not_found");
  }

  if (!response.ok) {
    throw new Error(`Commit detail request failed (${response.status})`);
  }

  return (await response.json()) as CommitDetail;
}
