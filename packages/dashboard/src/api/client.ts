export interface CommitSummary {
  sha: string;
  summary: string;
  committedAt: number;
  authorName: string;
  authorEmail: string;
}

export interface CommitsPage {
  commits: CommitSummary[];
  nextCursor: string | null;
}

export interface FetchCommitsParams {
  limit?: number;
  cursor?: string;
}

export async function fetchCommitsPage(
  params: FetchCommitsParams = {},
): Promise<CommitsPage> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  const query = search.toString();
  const response = await fetch(`/api/commits${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Commits request failed (${response.status})`);
  }

  return (await response.json()) as CommitsPage;
}
