import { create } from "zustand";

export interface SelectedEra {
  id: string;
  name: string;
  startAt: number;
  endAt: number;
}

interface DrillState {
  selectedCommitSha: string | null;
  selectedFilePath: string | null;
  selectedEra: SelectedEra | null;
  selectedDecisionId: string | null;
  selectedThreadId: string | null;
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedFilePath: (path: string | null) => void;
  selectCommitAndFile: (sha: string, path: string) => void;
  setSelectedEraId: (era: SelectedEra | null) => void;
  setSelectedDecisionId: (id: string | null) => void;
  setSelectedThreadId: (id: string | null) => void;
  clearEra: () => void;
  clearDownstreamFromEra: () => void;
  clearDownstreamFromCommit: () => void;
}

export const useDrillStore = create<DrillState>((set) => ({
  selectedCommitSha: null,
  selectedFilePath: null,
  selectedEra: null,
  selectedDecisionId: null,
  selectedThreadId: null,
  setSelectedCommitSha: (sha) =>
    set({
      selectedCommitSha: sha,
      selectedFilePath: null,
    }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  selectCommitAndFile: (sha, path) =>
    set({
      selectedCommitSha: sha,
      selectedFilePath: path,
    }),
  setSelectedEraId: (era) =>
    set({
      selectedEra: era,
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  setSelectedDecisionId: (id) =>
    set({
      selectedDecisionId: id,
      selectedThreadId: null,
    }),
  setSelectedThreadId: (id) =>
    set({
      selectedThreadId: id,
      selectedDecisionId: null,
    }),
  clearEra: () => set({ selectedEra: null }),
  clearDownstreamFromEra: () =>
    set({
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  clearDownstreamFromCommit: () => set({ selectedFilePath: null }),
}));

export function eraToCommitFilters(era: SelectedEra): {
  after: number;
  before: number;
} {
  return {
    after: Math.floor(era.startAt / 1000),
    before: Math.floor(era.endAt / 1000),
  };
}
