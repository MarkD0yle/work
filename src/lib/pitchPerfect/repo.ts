import type { Opportunity } from "./types";
import { SEED_OPPORTUNITIES } from "./opportunityData";

/* Opportunity repo — localStorage-backed, same subscribe/snapshot shape as
 * lib/pitch/repo.ts's PitchLibraryRepo. Seeds from SEED_OPPORTUNITIES on
 * first run (unlike PitchLibraryRepo, which starts empty) so the list and
 * Insights view aren't empty on first load. */

const STORAGE_KEY = "pitchPerfect.opportunities.v1";

interface PersistedState {
  opportunities: Opportunity[];
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return { opportunities: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { opportunities: [] };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { opportunities: [] };
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

class OpportunityRepo {
  private state: PersistedState = this.loadOrSeed();

  private loadOrSeed(): PersistedState {
    const loaded = loadState();
    if (loaded.opportunities.length > 0) return loaded;
    const seeded = { opportunities: SEED_OPPORTUNITIES };
    saveState(seeded);
    return seeded;
  }

  private subscribers = new Set<() => void>();

  snapshot(): Opportunity[] {
    return this.state.opportunities;
  }

  get(id: string): Opportunity | undefined {
    return this.state.opportunities.find((o) => o.id === id);
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /** Upsert by id — save a new opportunity or overwrite a previously-saved one. */
  save(opp: Opportunity) {
    const exists = this.state.opportunities.some((o) => o.id === opp.id);
    this.state = {
      opportunities: exists
        ? this.state.opportunities.map((o) => (o.id === opp.id ? opp : o))
        : [opp, ...this.state.opportunities],
    };
    this.persist();
  }

  remove(id: string) {
    this.state = { opportunities: this.state.opportunities.filter((o) => o.id !== id) };
    this.persist();
  }

  private persist() {
    saveState(this.state);
    for (const fn of this.subscribers) fn();
  }
}

export const opportunityRepo = new OpportunityRepo();
