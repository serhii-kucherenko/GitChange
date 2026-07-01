import { create } from "zustand";

interface DrillState {
  selectedCommitSha: string | null;
  selectedFilePath: string | null;
  selectedEraId: string | null;
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedFilePath: (path: string | null) => void;
  setSelectedEraId: (eraId: string | null) => void;
  clearDownstreamFromEra: () => void;
  clearDownstreamFromCommit: () => void;
}

export const useDrillStore = create<DrillState>((set) => ({
  selectedCommitSha: null,
  selectedFilePath: null,
  selectedEraId: null,
  setSelectedCommitSha: (sha) =>
    set({
      selectedCommitSha: sha,
      selectedFilePath: null,
    }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setSelectedEraId: (eraId) =>
    set({
      selectedEraId: eraId,
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  clearDownstreamFromEra: () =>
    set({
      selectedCommitSha: null,
      selectedFilePath: null,
    }),
  clearDownstreamFromCommit: () => set({ selectedFilePath: null }),
}));
