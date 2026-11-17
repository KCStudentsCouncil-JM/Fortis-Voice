import type {
  ActivityEntry,
  ActivityEntryKind,
  AppBackupSnapshot,
  CampaignEvent,
  EventRsvp,
  Member,
  Notice,
  NoticeKind,
  Petition,
  PetitionKind,
  PetitionStatus,
  PetitionUrgency,
  PollVote,
  SignatureRecord,
  UserRole,
} from '@/src/types/civic';

export interface CivicStoreSnapshot {
  mode: 'firebase' | 'local';
  ready: boolean;
  currentUser: Member | null;
  members: Member[];
  petitions: Petition[];
  signaturesByPetition: Record<string, SignatureRecord[]>;
  activityByPetition: Record<string, ActivityEntry[]>;
  events: CampaignEvent[];
  rsvpsByEvent: Record<string, EventRsvp[]>;
  notices: Notice[];
  votesByNotice: Record<string, PollVote[]>;
}

export interface SavePetitionInput {
  id?: string;
  kind: PetitionKind;
  title: string;
  summary: string;
  body: string;
  category: string;
  urgency: PetitionUrgency;
  location: string;
  goalSignatures: number;
  isAnonymous: boolean;
  media?: Petition['media'];
  submitForReview: boolean;
}

export interface CreateEventInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  location: string;
  startDate: string;
  endDate: string;
  timeLabel: string;
  capacity?: number;
  promoVideoUrl?: string;
  gallery?: CampaignEvent['gallery'];
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  kind: NoticeKind;
  pinned: boolean;
  pollOptions?: string[];
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

/**
 * Unified repository contract implemented by both FirestoreRepository
 * (live Firebase Auth + Firestore) and LocalDemoRepository (browser fallback).
 * Components interact strictly through this interface.
 */
export interface CivicRepository {
  readonly mode: 'firebase' | 'local';
  subscribe(listener: (snapshot: CivicStoreSnapshot) => void): () => void;
  destroy(): void;

  // Auth & onboarding
  signInWithGoogle?(): Promise<ActionResult>;
  signInDemo(emailOrRole: string): Promise<ActionResult<Member>>;
  signUpDemo(input: {
    studentName: string;
    studentClass: string;
    grade: string;
    dateOfBirth: string;
    displayName: string;
    email: string;
    affiliation?: string;
  }): Promise<ActionResult<Member>>;
  switchDemoRole?(role: UserRole): Promise<ActionResult>;
  signOut(): Promise<void>;

  // Profile & presence
  updateProfile(input: {
    studentName?: string;
    studentClass?: string;
    grade?: string;
    dateOfBirth?: string;
    displayName: string;
    affiliation?: string;
    bio?: string;
    avatarId?: string;
    avatarDataUrl?: string;
  }): Promise<ActionResult>;
  submitAppeal(appealNote: string): Promise<ActionResult>;
  recordPresence(): Promise<void>;

  // Petitions & activity
  savePetition(input: SavePetitionInput): Promise<ActionResult<Petition>>;
  signPetition(petitionId: string): Promise<ActionResult>;
  retractSignature(petitionId: string): Promise<ActionResult>;
  addActivityEntry(input: {
    petitionId: string;
    kind: ActivityEntryKind;
    body: string;
    parentId?: string;
    media?: ActivityEntry['media'];
  }): Promise<ActionResult>;

  // Moderator actions on petitions
  moderatePetitionDecision(input: {
    petitionId: string;
    decision: 'approve' | 'decline';
    reason: string;
  }): Promise<ActionResult>;
  updatePetitionStatus(input: {
    petitionId: string;
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult>;
  bulkUpdatePetitionStatus(input: {
    petitionIds: string[];
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult>;
  togglePinPetition(petitionId: string): Promise<ActionResult>;

  // Events
  createEvent(input: CreateEventInput): Promise<ActionResult<CampaignEvent>>;
  deleteEvent(eventId: string): Promise<ActionResult>;
  rsvpEvent(eventId: string): Promise<ActionResult>;
  cancelEventRsvp(eventId: string): Promise<ActionResult>;

  // Notices & Polls
  createNotice(input: CreateNoticeInput): Promise<ActionResult<Notice>>;
  togglePinNotice(noticeId: string): Promise<ActionResult>;
  deleteNotice(noticeId: string): Promise<ActionResult>;
  votePoll(noticeId: string, optionId: string): Promise<ActionResult>;

  // Directory management
  updateMemberDirectory(input: {
    targetUid: string;
    accountStatus?: Member['accountStatus'];
    role?: Member['role'];
    rejectionReason?: string;
  }): Promise<ActionResult>;
  removeMember(targetUid: string): Promise<ActionResult>;

  // Backup & Restore
  exportBackup(): AppBackupSnapshot | null;
  restoreBackup(snapshot: AppBackupSnapshot): Promise<ActionResult>;
  clearLocalDeviceCache(): Promise<ActionResult>;
}
