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

export interface CommitListFilters {
  author?: string;
  path?: string;
  q?: string;
  after?: number;
  before?: number;
}

export interface DashboardEra {
  id: string;
  name: string;
  summary: string;
  startCommitSha: string;
  endCommitSha: string;
  startAt: number;
  endAt: number;
  inflections: Array<{
    type: string;
    title: string;
    description: string;
    evidence: unknown[];
  }>;
  claims: Array<{
    text: string;
    evidence: unknown[];
  }>;
  commitCountInWindow: number;
}

export interface FetchCommitsParams extends CommitListFilters {
  limit?: number;
  cursor?: string;
}

export function countActiveFilters(filters: CommitListFilters): number {
  let count = 0;
  if (filters.author?.trim()) {
    count += 1;
  }
  if (filters.path?.trim()) {
    count += 1;
  }
  if (filters.q?.trim()) {
    count += 1;
  }
  if (filters.after !== undefined) {
    count += 1;
  }
  if (filters.before !== undefined) {
    count += 1;
  }
  return count;
}

export function hasActiveFilters(filters: CommitListFilters): boolean {
  return countActiveFilters(filters) > 0;
}

export function dateInputToAfterUnix(date: string): number | undefined {
  if (!date.trim()) {
    return undefined;
  }
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed / 1000);
}

export function dateInputToBeforeUnix(date: string): number | undefined {
  if (!date.trim()) {
    return undefined;
  }
  const parsed = Date.parse(`${date}T23:59:59.999Z`);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed / 1000);
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
  if (params.author?.trim()) {
    search.set("author", params.author.trim());
  }
  if (params.path?.trim()) {
    search.set("path", params.path.trim());
  }
  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }
  if (params.after !== undefined) {
    search.set("after", String(params.after));
  }
  if (params.before !== undefined) {
    search.set("before", String(params.before));
  }

  const query = search.toString();
  const response = await fetch(`/api/commits${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Commits request failed (${response.status})`);
  }

  return (await response.json()) as CommitsPage;
}

export async function fetchEras(): Promise<DashboardEra[]> {
  const response = await fetch("/api/eras");

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Eras request failed (${response.status})`);
  }

  return (await response.json()) as DashboardEra[];
}
