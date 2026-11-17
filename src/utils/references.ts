import type { PetitionKind, PetitionStatus } from '@/src/types/civic';

/**
 * Reference Prefix Scheme:
 * - DRF-XXXX: Unpublished draft petition or initiative
 * - REV-XXXX: Submitted and awaiting moderator review
 * - PET-XXXX: Approved live, responded, or closed standard petition
 * - CMP-XXXX: Approved live, responded, or closed community campaign/initiative
 * - RES-XXXX: Achieved / resolved petition or initiative
 * - DEC-XXXX: Declined submission (visible only to author and moderators)
 * - EVT-XXXX: Campaign or community event
 */
export function formatPetitionReference(
  status: PetitionStatus,
  kind: PetitionKind,
  numericSeq: number
): string {
  const padded = String(numericSeq).padStart(4, '0');
  switch (status) {
    case 'draft':
      return `DRF-${padded}`;
    case 'pending_review':
      return `REV-${padded}`;
    case 'achieved':
      return `RES-${padded}`;
    case 'declined':
      return `DEC-${padded}`;
    case 'live':
    case 'responded':
    case 'closed':
    default:
      return kind === 'campaign' ? `CMP-${padded}` : `PET-${padded}`;
  }
}

export function formatEventReference(numericSeq: number): string {
  return `EVT-${String(numericSeq).padStart(4, '0')}`;
}

/**
 * Matches either a prefixed reference (e.g. "PET-1041", "rev-1045")
 * or a bare reference number (e.g. "1041").
 */
export function matchesReferenceQuery(
  referenceNumber: string,
  numericSeq: number,
  rawQuery: string
): boolean {
  const q = rawQuery.trim().toUpperCase();
  if (!q) return false;
  const normalizedRef = referenceNumber.toUpperCase();
  if (normalizedRef === q) return true;
  if (/^\d+$/.test(q) && Number(q) === numericSeq) return true;
  return false;
}
