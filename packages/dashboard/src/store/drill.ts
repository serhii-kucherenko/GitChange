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
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedFilePath: (path: string | null) => void;
  setSelectedEraId: (era: SelectedEra | null) => void;
  clearEra: () => void;
  clearDownstreamFromEra: () => void;
  clearDownstreamFromCommit: () => void;
}

export const useDrillStore = create<DrillState>((set) => ({
  selectedCommitSha: null,
  selectedFilePath: null,
  selectedEra: null,
  setSelectedCommitSha: (sha) =>
    set({
      selectedCommitSha: sha,
      selectedFilePath: null,
    }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setSelectedEraId: (era) =>
    set({
      selectedEra: era,
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  clearEra: () => set({ selectedEra: null }),
  clearDownstreamFromEra: () =>
    set({
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  clearDownstreamFromCommit: () => set({ selectedFilePath: null }),
}));

export function eraToCommitFilters(
  era: SelectedEra,
): { after: number; before: number } {
  return {
    after: Math.floor(era.startAt / 1000),
    before: Math.floor(era.endAt / 1000),
  };
}
