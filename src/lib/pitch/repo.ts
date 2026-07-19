import type { Pitch } from "./types";

/* Pitch library — localStorage-backed repo, same subscribe/snapshot shape as
 * saved-views.ts. A real deployment would swap this for an API-backed repo
 * behind the same interface. */

const STORAGE_KEY = "pitchLibrary.v1";

interface PersistedState {
  pitches: Pitch[];
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return { pitches: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pitches: [] };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { pitches: [] };
  }
}

function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — degrade to in-memory state silently.
  }
}

class PitchLibraryRepo {
  private state: PersistedState = loadState();
  private subscribers = new Set<() => void>();

  snapshot(): Pitch[] {
    return this.state.pitches;
  }

  get(id: string): Pitch | undefined {
    return this.state.pitches.find((p) => p.id === id);
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /** Upsert by id — save a new pitch or overwrite a previously-saved one. */
  save(pitch: Pitch) {
    const exists = this.state.pitches.some((p) => p.id === pitch.id);
    this.state = {
      pitches: exists
        ? this.state.pitches.map((p) => (p.id === pitch.id ? pitch : p))
        : [pitch, ...this.state.pitches],
    };
    this.persist();
  }

  remove(id: string) {
    this.state = { pitches: this.state.pitches.filter((p) => p.id !== id) };
    this.persist();
  }

  private persist() {
    saveState(this.state);
    for (const fn of this.subscribers) fn();
  }
}

export const pitchLibraryRepo = new PitchLibraryRepo();
