import type {
  DecisionDetail,
  DecisionListPage,
  OpenWorkListPage,
  OpenWorkThreadDetail,
  TourDetail,
  TourListPage,
} from "../types.js";
import type { MatchableOpenWorkThread } from "../utils/open-work-match.js";

export interface CommitSummary {
  sha: string;
  summary: string;
  committedAt: number;
  authorName: string;
  authorEmail: string;
  repoId?: string;
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
  repoId?: string;
}

export interface DashboardEra {
  id: string;
  name: string;
  summary: string;
  startCommitSha: string;
  endCommitSha: string;
  startAt: number;
  endAt: number;
  repoId?: string;
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

export interface FileHistoryEvent {
  commitSha: string;
  committedAt: number;
  changeType: string;
  summary: string;
  path: string;
  oldPath: string | null;
}

export interface FileHistoryPage {
  events: FileHistoryEvent[];
  nextCursor: string | null;
  order: "newest_first";
}

export interface FetchCommitsParams extends CommitListFilters {
  limit?: number;
  cursor?: string;
}

export interface FetchFileHistoryParams {
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
  if (params.repoId?.trim()) {
    search.set("repoId", params.repoId.trim());
  }

  const query = search.toString();
  const response = await fetch(`/api/commits${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Commits request failed (${response.status})`);
  }

  return (await response.json()) as CommitsPage;
}

export async function fetchFileHistoryPage(
  path: string,
  params: FetchFileHistoryParams = {},
): Promise<FileHistoryPage> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  const query = search.toString();
  const encodedPath = encodeURIComponent(path);
  const response = await fetch(
    `/api/files/${encodedPath}/history${query ? `?${query}` : ""}`,
  );

  if (response.status === 400) {
    throw new Error("invalid_file_path");
  }

  if (!response.ok) {
    throw new Error(`File history request failed (${response.status})`);
  }

  return (await response.json()) as FileHistoryPage;
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

export interface FetchDecisionsParams {
  limit?: number;
  cursor?: string;
}

export async function fetchDecisionsPage(
  params: FetchDecisionsParams = {},
): Promise<DecisionListPage> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.cursor) {
    search.set("cursor", params.cursor);
  }

  const query = search.toString();
  const response = await fetch(`/api/decisions${query ? `?${query}` : ""}`);

  if (response.status === 404) {
    return { decisions: [], nextCursor: null };
  }

  if (!response.ok) {
    throw new Error(`Decisions request failed (${response.status})`);
  }

  return (await response.json()) as DecisionListPage;
}

export async function fetchDecisionDetail(id: string): Promise<DecisionDetail> {
  const response = await fetch(`/api/decisions/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    throw new Error("decision_not_found");
  }

  if (!response.ok) {
    throw new Error(`Decision detail request failed (${response.status})`);
  }

  return (await response.json()) as DecisionDetail;
}

export async function fetchOpenWorkThreads(): Promise<OpenWorkListPage> {
  const response = await fetch("/api/open-work");

  if (response.status === 404) {
    return { threads: [] };
  }

  if (!response.ok) {
    throw new Error(`Open work request failed (${response.status})`);
  }

  return (await response.json()) as OpenWorkListPage;
}

export async function fetchOpenWorkThread(
  id: string,
): Promise<OpenWorkThreadDetail> {
  const response = await fetch(`/api/open-work/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    throw new Error("thread_not_found");
  }

  if (!response.ok) {
    throw new Error(`Open work thread request failed (${response.status})`);
  }

  return (await response.json()) as OpenWorkThreadDetail;
}

function toMatchableThread(
  detail: OpenWorkThreadDetail,
): MatchableOpenWorkThread {
  const lastEvent = detail.events.at(-1);
  return {
    id: detail.id,
    kind: detail.kind,
    status: detail.status,
    title: detail.title,
    confidence: detail.confidence,
    lastEventAt: lastEvent?.committedAt ?? null,
    linkedDecisionId: detail.linkedDecisionId,
    relatedPaths: detail.relatedPaths,
    events: detail.events,
  };
}

export async function fetchOpenWorkMatchableThreads(): Promise<
  MatchableOpenWorkThread[]
> {
  const list = await fetchOpenWorkThreads();
  if (list.threads.length === 0) {
    return [];
  }

  const details = await Promise.all(
    list.threads.map((thread) => fetchOpenWorkThread(thread.id)),
  );
  return details.map(toMatchableThread);
}

export const tours = {
  list: ["tours", "list"] as const,
  detail: (tourId: string) => ["tours", "detail", tourId] as const,
};

export async function fetchTours(): Promise<TourListPage> {
  const response = await fetch("/api/tours");

  if (response.status === 404) {
    throw new Error("tours_not_found");
  }

  if (!response.ok) {
    throw new Error(`Tours request failed (${response.status})`);
  }

  return (await response.json()) as TourListPage;
}

export async function fetchTour(tourId: string): Promise<TourDetail> {
  const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}`);

  if (response.status === 404) {
    throw new Error("tour_not_found");
  }

  if (!response.ok) {
    throw new Error(`Tour detail request failed (${response.status})`);
  }

  return (await response.json()) as TourDetail;
}

export interface WorkspaceResponse {
  isMultiRepo: boolean;
  primaryRepoId: string | null;
  repos: Array<{ repoId: string; label: string }>;
  links: Array<{
    id: string;
    sourceRepoId: string;
    targetRepoId: string;
    kind: "shared_migration" | "manual";
    label: string;
    evidenceNote?: string;
  }>;
}

export async function fetchWorkspace(): Promise<WorkspaceResponse> {
  const response = await fetch("/api/workspace");

  if (!response.ok) {
    throw new Error(`Workspace request failed (${response.status})`);
  }

  return (await response.json()) as WorkspaceResponse;
}
