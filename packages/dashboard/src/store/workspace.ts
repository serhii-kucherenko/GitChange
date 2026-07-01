import { create } from "zustand";

export interface WorkspaceRepo {
  repoId: string;
  label: string;
}

export interface WorkspaceLink {
  id: string;
  sourceRepoId: string;
  targetRepoId: string;
  kind: "shared_migration" | "manual";
  label: string;
  evidenceNote?: string;
}

export interface WorkspaceSnapshot {
  isMultiRepo: boolean;
  primaryRepoId: string | null;
  repos: WorkspaceRepo[];
  links: WorkspaceLink[];
}

interface WorkspaceState {
  snapshot: WorkspaceSnapshot | null;
  selectedRepoId: string | null;
  setSelectedRepoId: (repoId: string | null) => void;
  setSnapshot: (snapshot: WorkspaceSnapshot) => void;
  repoLabel: (repoId: string) => string;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  snapshot: null,
  selectedRepoId: null,
  setSelectedRepoId: (repoId) => set({ selectedRepoId: repoId }),
  setSnapshot: (snapshot) => set({ snapshot }),
  repoLabel: (repoId) => {
    const repo = get().snapshot?.repos.find((entry) => entry.repoId === repoId);
    return repo?.label ?? repoId;
  },
}));

const REPO_COLORS = [
  "border-sky-700 bg-sky-950/40 text-sky-200",
  "border-emerald-700 bg-emerald-950/40 text-emerald-200",
  "border-amber-700 bg-amber-950/40 text-amber-200",
  "border-slate-600 bg-slate-800/60 text-slate-300",
  "border-red-800 bg-red-950/40 text-red-200",
];

export function repoColorClass(repoId: string): string {
  let hash = 0;
  for (let index = 0; index < repoId.length; index += 1) {
    hash = (hash + repoId.charCodeAt(index) * (index + 1)) % REPO_COLORS.length;
  }
  return REPO_COLORS[hash] ?? REPO_COLORS[0] ?? "";
}
