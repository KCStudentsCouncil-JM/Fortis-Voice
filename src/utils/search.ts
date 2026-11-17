import type { Petition } from '@/src/types/civic';
import { matchesReferenceQuery } from '@/src/utils/references';

/**
 * Common stop words excluded from duplicate detection so petitions are only
 * flagged when meaningful civic terms overlap.
 */
const DUPLICATE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'should', 'now', 'please', 'fix',
  'issue', 'issues', 'problem', 'problems', 'campus', 'school', 'college',
  'need', 'needs', 'want', 'wants', 'make', 'help', 'our', 'your', 'their',
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'for', 'about',
  'around', 'along', 'across', 'petition', 'request', 'community', 'local',
  'neighborhood', 'neighbourhood', 'city', 'town', 'public', 'area', 'better',
  'improve', 'improved', 'improvement', 'urgent', 'standard', 'keep', 'get',
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Full-word search:
 * - Matches exact prefixed reference numbers ("PET-1041") or bare sequence ("1041").
 * - For text queries, every search token must match as a complete word (\bword\b)
 *   in the petition's title, summary, body, category, or location.
 *   Thus searching "park" will NOT match "parking" unless "parking" is also typed.
 */
export function matchesPetitionSearch(petition: Petition, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (matchesReferenceQuery(petition.referenceNumber, petition.numericSeq, trimmed)) {
    return true;
  }

  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w-]+|[^\w-]+$/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const haystack = [
    petition.referenceNumber,
    petition.title,
    petition.summary,
    petition.body,
    petition.category,
    petition.location,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => {
    const pattern = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
    return pattern.test(haystack);
  });
}

export function extractMeaningfulKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !DUPLICATE_STOP_WORDS.has(w));

  return Array.from(new Set(words));
}

export interface DuplicateMatch {
  petition: Petition;
  overlappingKeywords: string[];
}

/**
 * Checks against active/live petitions (skipping resolved/achieved, closed,
 * declined, and draft petitions) and flags a probable duplicate only when
 * at least 2 distinct meaningful keywords overlap.
 */
export function findProbableDuplicates(
  draftTitle: string,
  draftSummary: string,
  existingPetitions: Petition[],
  excludePetitionId?: string
): DuplicateMatch[] {
  const candidateKeywords = new Set(
    extractMeaningfulKeywords(`${draftTitle} ${draftSummary}`)
  );

  if (candidateKeywords.size < 2) return [];

  const matches: DuplicateMatch[] = [];

  for (const petition of existingPetitions) {
    if (petition.id === excludePetitionId) continue;
    // Skip resolved, closed, declined, or unpublished drafts
    if (
      petition.status !== 'live' &&
      petition.status !== 'responded' &&
      petition.status !== 'pending_review'
    ) {
      continue;
    }

    const existingKeywords = extractMeaningfulKeywords(
      `${petition.title} ${petition.summary} ${petition.location}`
    );

    const overlap = existingKeywords.filter((kw) => candidateKeywords.has(kw));
    const distinctOverlap = Array.from(new Set(overlap));

    if (distinctOverlap.length >= 2) {
      matches.push({
        petition,
        overlappingKeywords: distinctOverlap.slice(0, 5),
      });
    }
  }

  return matches.sort(
    (a, b) => b.overlappingKeywords.length - a.overlappingKeywords.length
  );
}
