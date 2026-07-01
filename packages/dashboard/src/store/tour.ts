import { create } from "zustand";

export interface PersistedTourProgress {
  activeTourId: string | null;
  chapterIndex: number;
  stopIndex: number;
  completedStopIds: string[];
}

interface TourChapterBounds {
  stops: Array<{ id: string }>;
}

interface TourState extends PersistedTourProgress {
  setActiveTour: (tourId: string) => void;
  goToChapter: (chapterIndex: number) => void;
  goToStop: (chapterIndex: number, stopIndex: number) => void;
  advanceStop: (chapters: TourChapterBounds[]) => void;
  retreatStop: (chapters: TourChapterBounds[]) => void;
  markStopComplete: (stopId: string) => void;
  hydrateFromStorage: (headSha: string, storage?: Storage) => void;
  persistToStorage: (headSha: string, storage?: Storage) => void;
  reset: () => void;
}

const INITIAL_STATE: PersistedTourProgress = {
  activeTourId: null,
  chapterIndex: 0,
  stopIndex: 0,
  completedStopIds: [],
};

function getStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  if (typeof globalThis.localStorage !== "undefined") {
    return globalThis.localStorage;
  }
  return null;
}

export function tourProgressStorageKey(headSha: string): string {
  return `gitchange-tour-progress:${headSha}`;
}

function parsePersisted(raw: string): PersistedTourProgress | null {
  try {
    const parsed = JSON.parse(raw) as PersistedTourProgress;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray(parsed.completedStopIds) ||
      typeof parsed.chapterIndex !== "number" ||
      typeof parsed.stopIndex !== "number" ||
      (parsed.activeTourId !== null && typeof parsed.activeTourId !== "string")
    ) {
      return null;
    }
    return {
      activeTourId: parsed.activeTourId,
      chapterIndex: parsed.chapterIndex,
      stopIndex: parsed.stopIndex,
      completedStopIds: parsed.completedStopIds,
    };
  } catch {
    return null;
  }
}

export const useTourStore = create<TourState>((set, get) => ({
  ...INITIAL_STATE,

  setActiveTour: (tourId) =>
    set({
      activeTourId: tourId,
      chapterIndex: 0,
      stopIndex: 0,
    }),

  goToChapter: (chapterIndex) =>
    set({
      chapterIndex,
      stopIndex: 0,
    }),

  goToStop: (chapterIndex, stopIndex) =>
    set({
      chapterIndex,
      stopIndex,
    }),

  advanceStop: (chapters) => {
    const { chapterIndex, stopIndex } = get();
    const currentChapter = chapters[chapterIndex];
    if (!currentChapter) {
      return;
    }

    if (stopIndex < currentChapter.stops.length - 1) {
      set({ stopIndex: stopIndex + 1 });
      return;
    }

    if (chapterIndex < chapters.length - 1) {
      set({
        chapterIndex: chapterIndex + 1,
        stopIndex: 0,
      });
    }
  },

  retreatStop: (chapters) => {
    const { chapterIndex, stopIndex } = get();

    if (stopIndex > 0) {
      set({ stopIndex: stopIndex - 1 });
      return;
    }

    if (chapterIndex > 0) {
      const previousChapter = chapters[chapterIndex - 1];
      if (!previousChapter) {
        return;
      }
      set({
        chapterIndex: chapterIndex - 1,
        stopIndex: Math.max(0, previousChapter.stops.length - 1),
      });
    }
  },

  markStopComplete: (stopId) => {
    const { completedStopIds } = get();
    if (completedStopIds.includes(stopId)) {
      return;
    }
    set({ completedStopIds: [...completedStopIds, stopId] });
  },

  hydrateFromStorage: (headSha, storage) => {
    const store = getStorage(storage);
    if (!store) {
      return;
    }

    const raw = store.getItem(tourProgressStorageKey(headSha));
    if (!raw) {
      return;
    }

    const parsed = parsePersisted(raw);
    if (!parsed) {
      return;
    }

    set(parsed);
  },

  persistToStorage: (headSha, storage) => {
    const store = getStorage(storage);
    if (!store) {
      return;
    }

    const { activeTourId, chapterIndex, stopIndex, completedStopIds } = get();
    const payload: PersistedTourProgress = {
      activeTourId,
      chapterIndex,
      stopIndex,
      completedStopIds,
    };
    store.setItem(tourProgressStorageKey(headSha), JSON.stringify(payload));
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
