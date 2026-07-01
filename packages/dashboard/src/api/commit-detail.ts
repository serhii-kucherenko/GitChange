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

export async function fetchCommitDetail(
  sha: string,
  repoId?: string | null,
): Promise<CommitDetail> {
  const search = new URLSearchParams();
  if (repoId) {
    search.set("repoId", repoId);
  }
  const query = search.toString();
  const response = await fetch(
    `/api/commits/${sha}${query ? `?${query}` : ""}`,
  );

  if (response.status === 404) {
    throw new Error("commit_not_found");
  }

  if (!response.ok) {
    throw new Error(`Commit detail request failed (${response.status})`);
  }

  return (await response.json()) as CommitDetail;
}
