export type UserRole = 'visitor' | 'member' | 'organiser' | 'moderator';

export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface Member {
  uid: string;
  email: string;
  studentName?: string;
  studentClass?: string;
  grade?: string;
  dateOfBirth?: string;
  displayName: string;
  role: Exclude<UserRole, 'visitor'>;
  accountStatus: AccountStatus;
  affiliation?: string;
  bio?: string;
  avatarId?: string;
  avatarDataUrl?: string;
  rejectionReason?: string;
  appealNote?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedSortMode = 'newest' | 'trending' | 'most_signed' | 'closing_soon';

export type PetitionStatus =
  | 'draft'
  | 'pending_review'
  | 'live'
  | 'responded'
  | 'achieved'
  | 'closed'
  | 'declined';

export type PetitionUrgency = 'urgent' | 'standard' | 'low';

export type PetitionKind = 'petition' | 'campaign';

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'video_link';
  url: string;
  caption?: string;
}

export interface Petition {
  id: string;
  referenceNumber: string;
  numericSeq: number;
  kind: PetitionKind;
  title: string;
  summary: string;
  body: string;
  category: string;
  urgency: PetitionUrgency;
  location: string;
  status: PetitionStatus;
  isAnonymous: boolean;
  authorId: string;
  /** Public display string — always "Anonymous resident" when isAnonymous is true */
  authorDisplayName: string;
  authorAffiliation?: string;
  goalSignatures: number;
  signatureCount: number;
  pinned: boolean;
  slaHours: number;
  slaDeadlineAt: string;
  respondedAt?: string;
  moderationReason?: string;
  lastActivityNote?: string;
  media?: MediaAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface SignatureRecord {
  userId: string;
  displayName: string;
  roleBadge: string;
  signedAt: string;
}

export type ActivityEntryKind =
  | 'submission'
  | 'comment'
  | 'reply'
  | 'official_response'
  | 'organiser_update'
  | 'moderator_decision'
  | 'status_change'
  | 'edit';

export interface ActivityEntry {
  id: string;
  petitionId: string;
  parentId?: string;
  kind: ActivityEntryKind;
  body: string;
  authorId: string;
  authorDisplayName: string;
  authorRoleBadge?: string;
  isAnonymousAuthor: boolean;
  triggeredStatus?: PetitionStatus;
  media?: MediaAttachment[];
  createdAt: string;
}

export interface CampaignEvent {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  location: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD (same as startDate for single-day events) */
  endDate: string;
  timeLabel: string;
  organiserId: string;
  organiserName: string;
  capacity?: number;
  rsvpCount: number;
  promoVideoUrl?: string;
  gallery?: MediaAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface EventRsvp {
  userId: string;
  displayName: string;
  createdAt: string;
}

export type NoticeKind = 'notice' | 'alert' | 'update' | 'poll';

export interface PollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  kind: NoticeKind;
  pinned: boolean;
  authorId: string;
  authorDisplayName: string;
  pollOptions?: PollOption[];
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface PollVote {
  userId: string;
  optionId: string;
  updatedAt: string;
}

export type AppView =
  | 'feed'
  | 'petition'
  | 'create'
  | 'activity'
  | 'drafts'
  | 'events'
  | 'notices'
  | 'queue'
  | 'directory'
  | 'analytics'
  | 'profile'
  | 'auth';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export interface AppBackupSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  platform: string;
  member: Member;
  authoredPetitions: Petition[];
  signedPetitionIds: string[];
  comments: ActivityEntry[];
}
