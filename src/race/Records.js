import { DIFFICULTIES, REPLAY } from '../core/constants.js';

// Storage is optional: private browsing or corrupt saved data must never stop a race.
export class Records {
  constructor(storage) {
    this.data = {}; this.storage = storage; this.saved = true;
    try {
      if (storage === undefined) this.storage = globalThis.localStorage;
      const raw = JSON.parse(this.storage?.getItem(REPLAY.storageKey) || '{}');
      for (const key of Object.keys(DIFFICULTIES)) {
        const entry = raw?.[key];
        if (entry && Number.isFinite(entry.score) && entry.score >= 0 && Number.isFinite(entry.time) && entry.time > 0)
          this.data[key] = { score: entry.score, time: entry.time };
      }
    } catch { this.saved = false; }
  }
  record(difficulty, result) {
    if (!result.finished) return { newScore: false, newTime: false };
    const old = this.data[difficulty];
    const newScore = !old || result.score > old.score, newTime = !old || result.time < old.time;
    this.data[difficulty] = { score: Math.max(old?.score ?? 0, result.score), time: Math.min(old?.time ?? Infinity, result.time) };
    try {
      this.saved = !!this.storage;
      this.storage?.setItem(REPLAY.storageKey, JSON.stringify(this.data));
    } catch { this.saved = false; }
    return { newScore, newTime };
  }
}
