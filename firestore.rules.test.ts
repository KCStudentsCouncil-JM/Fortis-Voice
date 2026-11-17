/**
 * Security Rules Specification Verification Matrix (Dirty Dozen)
 * Designed for execution against the Firebase Emulator Suite (`@firebase/rules-unit-testing`).
 * Documents and verifies every security invariant enforced in `firestore.rules`.
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'list' | 'get' | 'delete';
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
  rationale: string;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-role escalation on member signup',
    collectionPath: 'members/user-a',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-bootstrapped user attempting role=moderator or accountStatus=approved is rejected.',
  },
  {
    id: 2,
    name: 'Pending member self-approval on update',
    collectionPath: 'members/user-a',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Owner update allows only profile fields; role and accountStatus must match existing().',
  },
  {
    id: 3,
    name: 'PII directory scraping via list /members',
    collectionPath: 'members',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    rationale: 'Only moderators may list /members containing private email addresses.',
  },
  {
    id: 4,
    name: 'Bypassing review queue on petition create',
    collectionPath: 'petitions/pet-99',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-moderator create restricts status to draft or pending_review.',
  },
  {
    id: 5,
    name: 'Self-pinning petition to feed top',
    collectionPath: 'petitions/pet-99',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Owner update enforces incoming().pinned == existing().pinned and allowlists editable fields.',
  },
  {
    id: 6,
    name: 'Shadow ghost field injection',
    collectionPath: 'petitions/pet-99',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidPetition enforces strict data.keys().hasOnly(...) schema.',
  },
  {
    id: 7,
    name: 'Author UID spoofing',
    collectionPath: 'petitions/pet-99',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Create enforces incoming().authorId == request.auth.uid.',
  },
  {
    id: 8,
    name: 'Pending member signing live petition',
    collectionPath: 'petitions/pet-1/signatures/pending-user',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Signature creation requires isApprovedMember() with accountStatus == approved.',
  },
  {
    id: 9,
    name: 'Signing on behalf of another member',
    collectionPath: 'petitions/pet-1/signatures/other-user',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Signature doc ID and incoming().userId must equal request.auth.uid.',
  },
  {
    id: 10,
    name: 'Member posting fake official_response',
    collectionPath: 'petitions/pet-1/activity/act-99',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'official_response and moderator_decision kinds are restricted to isModerator().',
  },
  {
    id: 11,
    name: 'Member creating notice board announcement',
    collectionPath: 'notices/not-99',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Notice creation is strictly restricted to isModerator().',
  },
  {
    id: 12,
    name: 'Resource poisoning via oversized ID or title',
    collectionPath: 'petitions/oversized',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidId enforces <= 128 chars regex and isValidPetition enforces string size bounds.',
  },
];
