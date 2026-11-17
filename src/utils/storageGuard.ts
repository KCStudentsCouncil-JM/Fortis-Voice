import type { Petition } from '@/src/types/civic';

/** Normalizes email strings for consistent case-insensitive identity matching. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Recursively strips undefined keys before Firestore or JSON writes. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Writes a JSON payload to localStorage while guarding against QuotaExceededError.
 * If storage is tight, prunes large inline media payloads from non-critical/older items
 * via the supplied `pruneState` callback so core petition records are never lost.
 */
export function safeLocalStorageWrite<T>(
  key: string,
  state: T,
  pruneMediaPass: (current: T) => { pruned: T; removedCount: number }
): { saved: boolean; prunedMediaCount: number } {
  try {
    localStorage.setItem(key, JSON.stringify(stripUndefined(state)));
    return { saved: true, prunedMediaCount: 0 };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    if (!isQuota) {
      return { saved: false, prunedMediaCount: 0 };
    }

    let candidate = state;
    let totalPruned = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { pruned, removedCount } = pruneMediaPass(candidate);
      if (removedCount === 0) break;
      totalPruned += removedCount;
      candidate = pruned;
      try {
        localStorage.setItem(key, JSON.stringify(stripUndefined(candidate)));
        return { saved: true, prunedMediaCount: totalPruned };
      } catch {
        // Continue pruning older media payloads
      }
    }
    return { saved: false, prunedMediaCount: totalPruned };
  }
}

export function pruneOldestPetitionMedia(petitions: Petition[]): {
  petitions: Petition[];
  removedCount: number;
} {
  let removed = 0;
  // Prioritize pruning resolved/declined/closed petitions first, then oldest live ones
  const sortedIndices = petitions
    .map((p, idx) => ({
      idx,
      priority:
        p.status === 'achieved' || p.status === 'declined' || p.status === 'closed' ? 0 : 1,
      ts: Date.parse(p.updatedAt) || 0,
      hasInlineMedia: Boolean(p.media?.some((m) => m.url.startsWith('data:'))),
    }))
    .filter((entry) => entry.hasInlineMedia)
    .sort((a, b) => a.priority - b.priority || a.ts - b.ts);

  if (sortedIndices.length === 0) {
    return { petitions, removedCount: 0 };
  }

  const targetIdx = sortedIndices[0].idx;
  const updated = petitions.map((p, idx) => {
    if (idx !== targetIdx || !p.media) return p;
    const filtered = p.media.filter((m) => !m.url.startsWith('data:'));
    removed = p.media.length - filtered.length;
    return { ...p, media: filtered };
  });

  return { petitions: updated, removedCount: removed };
}
