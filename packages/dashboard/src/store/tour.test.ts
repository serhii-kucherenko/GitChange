import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tourProgressStorageKey, useTourStore } from "./tour.js";

function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("useTourStore", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    useTourStore.getState().reset();
  });

  afterEach(() => {
    useTourStore.getState().reset();
  });

  it("persists and hydrates progress per headSha", () => {
    const headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    useTourStore.getState().setActiveTour("tour:01DEFAULT");
    useTourStore.getState().goToStop(2, 1);
    useTourStore.getState().markStopComplete("stop:01BOOT");
    useTourStore.getState().persistToStorage(headSha, storage);

    useTourStore.getState().reset();
    expect(useTourStore.getState().activeTourId).toBeNull();

    useTourStore.getState().hydrateFromStorage(headSha, storage);

    const state = useTourStore.getState();
    expect(state.activeTourId).toBe("tour:01DEFAULT");
    expect(state.chapterIndex).toBe(2);
    expect(state.stopIndex).toBe(1);
    expect(state.completedStopIds).toEqual(["stop:01BOOT"]);
  });

  it("uses headSha-scoped storage keys", () => {
    const key = tourProgressStorageKey(
      "cccccccccccccccccccccccccccccccccccccccc",
    );
    expect(key).toBe(
      "gitchange-tour-progress:cccccccccccccccccccccccccccccccccccccccc",
    );
  });

  it("advanceStop moves within and across chapters", () => {
    const chapters = [
      { stops: [{ id: "a" }, { id: "b" }] },
      { stops: [{ id: "c" }] },
    ];

    useTourStore.getState().setActiveTour("tour:01DEFAULT");
    expect(useTourStore.getState().stopIndex).toBe(0);

    useTourStore.getState().advanceStop(chapters);
    expect(useTourStore.getState().chapterIndex).toBe(0);
    expect(useTourStore.getState().stopIndex).toBe(1);

    useTourStore.getState().advanceStop(chapters);
    expect(useTourStore.getState().chapterIndex).toBe(1);
    expect(useTourStore.getState().stopIndex).toBe(0);
  });

  it("retreatStop moves backward across chapter boundaries", () => {
    const chapters = [
      { stops: [{ id: "a" }, { id: "b" }] },
      { stops: [{ id: "c" }] },
    ];

    useTourStore.getState().setActiveTour("tour:01DEFAULT");
    useTourStore.getState().goToStop(1, 0);

    useTourStore.getState().retreatStop(chapters);
    expect(useTourStore.getState().chapterIndex).toBe(0);
    expect(useTourStore.getState().stopIndex).toBe(1);
  });
});
