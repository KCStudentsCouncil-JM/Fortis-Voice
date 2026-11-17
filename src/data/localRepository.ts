import { BRAND_CONFIG, PRIMARY_ADMIN_EMAIL } from '@/src/config/brand';
import type {
  ActionResult,
  CivicRepository,
  CivicStoreSnapshot,
  CreateEventInput,
  CreateNoticeInput,
  SavePetitionInput,
} from '@/src/data/repository';
import {
  SEED_ACTIVITY,
  SEED_EVENT_RSVPS,
  SEED_EVENTS,
  SEED_MEMBERS,
  SEED_NOTICES,
  SEED_PETITIONS,
  SEED_POLL_VOTES,
  SEED_SIGNATURES,
} from '@/src/data/seed';
import type {
  ActivityEntry,
  AppBackupSnapshot,
  CampaignEvent,
  EventRsvp,
  Member,
  Notice,
  Petition,
  PetitionStatus,
  PollVote,
  SignatureRecord,
  UserRole,
} from '@/src/types/civic';
import { formatRoleLabel, getPermissions } from '@/src/utils/permissions';
import { formatEventReference, formatPetitionReference } from '@/src/utils/references';
import { computeSlaDeadlineIso } from '@/src/utils/sla';
import {
  normalizeEmail,
  pruneOldestPetitionMedia,
  safeLocalStorageWrite,
  stripUndefined,
} from '@/src/utils/storageGuard';

const STORAGE_KEY = 'kc_council_local_store_v1';
const SESSION_UID_KEY = 'kc_council_local_session_uid_v1';

interface PersistedLocalDb {
  members: Member[];
  petitions: Petition[];
  signaturesByPetition: Record<string, SignatureRecord[]>;
  activityByPetition: Record<string, ActivityEntry[]>;
  events: CampaignEvent[];
  rsvpsByEvent: Record<string, EventRsvp[]>;
  notices: Notice[];
  votesByNotice: Record<string, PollVote[]>;
  nextPetitionSeq: number;
  nextEventSeq: number;
}

function buildInitialLocalDb(): PersistedLocalDb {
  return {
    members: structuredClone(SEED_MEMBERS),
    petitions: structuredClone(SEED_PETITIONS),
    signaturesByPetition: structuredClone(SEED_SIGNATURES),
    activityByPetition: groupSeedActivity(SEED_ACTIVITY),
    events: structuredClone(SEED_EVENTS),
    rsvpsByEvent: structuredClone(SEED_EVENT_RSVPS),
    notices: structuredClone(SEED_NOTICES),
    votesByNotice: structuredClone(SEED_POLL_VOTES),
    nextPetitionSeq: 1047,
    nextEventSeq: 2003,
  };
}

function groupSeedActivity(entries: ActivityEntry[]): Record<string, ActivityEntry[]> {
  const grouped: Record<string, ActivityEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.petitionId]) grouped[entry.petitionId] = [];
    grouped[entry.petitionId].push(structuredClone(entry));
  }
  return grouped;
}

export class LocalDemoRepository implements CivicRepository {
  readonly mode = 'local' as const;
  private db: PersistedLocalDb;
  private currentUid: string | null = null;
  private listeners = new Set<(snapshot: CivicStoreSnapshot) => void>();

  constructor() {
    this.db = this.loadFromStorage();
    const savedUid = localStorage.getItem(SESSION_UID_KEY);
    if (savedUid && this.db.members.some((m) => m.uid === savedUid)) {
      this.currentUid = savedUid;
    }
  }

  private loadFromStorage(): PersistedLocalDb {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = buildInitialLocalDb();
        this.persist(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedLocalDb>;
      if (!Array.isArray(parsed.petitions) || !Array.isArray(parsed.members)) {
        const fresh = buildInitialLocalDb();
        this.persist(fresh);
        return fresh;
      }
      const members = parsed.members.map((m) =>
        normalizeEmail(m.email) === PRIMARY_ADMIN_EMAIL
          ? { ...m, role: 'moderator' as const, accountStatus: 'approved' as const }
          : m
      );
      return {
        members,
        petitions: parsed.petitions,
        signaturesByPetition: parsed.signaturesByPetition ?? {},
        activityByPetition: parsed.activityByPetition ?? {},
        events: parsed.events ?? [],
        rsvpsByEvent: parsed.rsvpsByEvent ?? {},
        notices: parsed.notices ?? [],
        votesByNotice: parsed.votesByNotice ?? {},
        nextPetitionSeq: parsed.nextPetitionSeq ?? 1050,
        nextEventSeq: parsed.nextEventSeq ?? 2010,
      };
    } catch {
      return buildInitialLocalDb();
    }
  }

  private persist(target: PersistedLocalDb = this.db): string | undefined {
    const res = safeLocalStorageWrite(STORAGE_KEY, target, (state) => {
      const { petitions, removedCount } = pruneOldestPetitionMedia(state.petitions);
      return {
        pruned: { ...state, petitions },
        removedCount,
      };
    });
    if (res.prunedMediaCount > 0) {
      return `Browser storage was near capacity, so ${res.prunedMediaCount} older inline media attachment(s) were trimmed while preserving all petition records.`;
    }
    return undefined;
  }

  private getCurrentMember(): Member | null {
    if (!this.currentUid) return null;
    return this.db.members.find((m) => m.uid === this.currentUid) ?? null;
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private getSnapshot(): CivicStoreSnapshot {
    return {
      mode: 'local',
      ready: true,
      currentUser: this.getCurrentMember(),
      members: this.db.members,
      petitions: this.db.petitions,
      signaturesByPetition: this.db.signaturesByPetition,
      activityByPetition: this.db.activityByPetition,
      events: this.db.events,
      rsvpsByEvent: this.db.rsvpsByEvent,
      notices: this.db.notices,
      votesByNotice: this.db.votesByNotice,
    };
  }

  subscribe(listener: (snapshot: CivicStoreSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.listeners.clear();
  }

  async signInDemo(emailOrRole: string): Promise<ActionResult<Member>> {
    const key = normalizeEmail(emailOrRole);
    let found: Member | undefined;

    if (key === 'moderator' || key === 'admin') {
      found =
        this.db.members.find(
          (m) =>
            normalizeEmail(m.email) === PRIMARY_ADMIN_EMAIL &&
            m.role === 'moderator' &&
            m.accountStatus === 'approved'
        ) ??
        this.db.members.find((m) => m.role === 'moderator' && m.accountStatus === 'approved');
    } else if (key === 'organiser') {
      found = this.db.members.find((m) => m.role === 'organiser' && m.accountStatus === 'approved');
    } else if (key === 'member') {
      found = this.db.members.find((m) => m.role === 'member' && m.accountStatus === 'approved');
    } else if (key === 'pending') {
      found = this.db.members.find((m) => m.accountStatus === 'pending');
    } else if (key === 'rejected') {
      found = this.db.members.find((m) => m.accountStatus === 'rejected');
    } else {
      found = this.db.members.find((m) => normalizeEmail(m.email) === key);
    }

    if (!found) {
      return { ok: false, error: 'No demo account matched that email or role.' };
    }

    this.currentUid = found.uid;
    localStorage.setItem(SESSION_UID_KEY, found.uid);
    await this.recordPresence();
    this.emit();
    return { ok: true, data: found };
  }

  async signUpDemo(input: {
    studentName: string;
    studentClass: string;
    grade: string;
    dateOfBirth: string;
    displayName: string;
    email: string;
    affiliation?: string;
  }): Promise<ActionResult<Member>> {
    const email = normalizeEmail(input.email);
    const studentName = input.studentName.trim();
    const studentClass = input.studentClass.trim();
    const grade = input.grade.trim();
    const dateOfBirth = input.dateOfBirth.trim();
    const displayName = input.displayName.trim();

    if (studentName.length < 2) {
      return { ok: false, error: "Please enter the student's full name (at least 2 characters)." };
    }
    if (!grade) {
      return { ok: false, error: 'Please select a Grade / Form level.' };
    }
    if (!studentClass) {
      return { ok: false, error: 'Please enter the student class / form section (e.g. 5B or L6-Sci).' };
    }
    if (!dateOfBirth) {
      return { ok: false, error: 'Please enter the student date of birth (D.O.B.).' };
    }
    if (displayName.length < 2) {
      return { ok: false, error: 'Please enter a display name of at least 2 characters.' };
    }
    if (!email.includes('@') || email.length < 5) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }
    if (this.db.members.some((m) => normalizeEmail(m.email) === email)) {
      return { ok: false, error: 'An account with that email already exists. Try signing in instead.' };
    }

    const now = new Date().toISOString();
    const member: Member = stripUndefined({
      uid: `mem-${Date.now()}`,
      email,
      studentName,
      studentClass,
      grade,
      dateOfBirth,
      displayName,
      role: 'member',
      accountStatus: 'pending',
      affiliation: input.affiliation?.trim() || undefined,
      avatarId: 'fortis-purple',
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    });

    this.db.members = [member, ...this.db.members];
    this.currentUid = member.uid;
    localStorage.setItem(SESSION_UID_KEY, member.uid);
    this.persist();
    this.emit();
    return { ok: true, data: member };
  }

  async switchDemoRole(role: UserRole): Promise<ActionResult> {
    if (role === 'visitor') {
      await this.signOut();
      return { ok: true };
    }
    const res = await this.signInDemo(role);
    return { ok: res.ok, error: res.error };
  }

  async signOut(): Promise<void> {
    this.currentUid = null;
    localStorage.removeItem(SESSION_UID_KEY);
    this.emit();
  }

  async updateProfile(input: {
    studentName?: string;
    studentClass?: string;
    grade?: string;
    dateOfBirth?: string;
    displayName: string;
    affiliation?: string;
    bio?: string;
    avatarId?: string;
    avatarDataUrl?: string;
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me) return { ok: false, error: 'You must be signed in to update your profile.' };
    const name = input.displayName.trim();
    if (name.length < 2 || name.length > 80) {
      return { ok: false, error: 'Display name must be between 2 and 80 characters.' };
    }

    const now = new Date().toISOString();
    this.db.members = this.db.members.map((m) =>
      m.uid === me.uid
        ? stripUndefined({
            ...m,
            studentName:
              input.studentName !== undefined ? input.studentName.trim() || undefined : m.studentName,
            studentClass:
              input.studentClass !== undefined ? input.studentClass.trim() || undefined : m.studentClass,
            grade: input.grade !== undefined ? input.grade.trim() || undefined : m.grade,
            dateOfBirth:
              input.dateOfBirth !== undefined ? input.dateOfBirth.trim() || undefined : m.dateOfBirth,
            displayName: name,
            affiliation: input.affiliation?.trim() || undefined,
            bio: input.bio?.trim() || undefined,
            avatarId: input.avatarId || m.avatarId,
            avatarDataUrl: input.avatarDataUrl === '' ? undefined : input.avatarDataUrl ?? m.avatarDataUrl,
            updatedAt: now,
          })
        : m
    );

    const warning = this.persist();
    this.emit();
    return { ok: true, warning };
  }

  async submitAppeal(appealNote: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me) return { ok: false, error: 'Sign in required.' };
    const note = appealNote.trim();
    if (note.length < 10) {
      return { ok: false, error: 'Please provide at least 10 characters explaining your verification appeal.' };
    }
    const now = new Date().toISOString();
    this.db.members = this.db.members.map((m) =>
      m.uid === me.uid
        ? { ...m, appealNote: note, accountStatus: 'pending', updatedAt: now }
        : m
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async recordPresence(): Promise<void> {
    const me = this.getCurrentMember();
    if (!me) return;
    const now = new Date().toISOString();
    this.db.members = this.db.members.map((m) =>
      m.uid === me.uid ? { ...m, lastActiveAt: now } : m
    );
    this.persist();
  }

  async savePetition(input: SavePetitionInput): Promise<ActionResult<Petition>> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canCreatePetition) {
      return {
        ok: false,
        error: 'Only verified, approved members can create or edit petitions.',
      };
    }

    const now = new Date().toISOString();
    const targetStatus: PetitionStatus = input.submitForReview
      ? perms.canModerate
        ? 'live'
        : 'pending_review'
      : 'draft';

    if (input.id) {
      const existing = this.db.petitions.find((p) => p.id === input.id);
      if (!existing) return { ok: false, error: 'Petition not found.' };
      if (!perms.canModerate && existing.authorId !== me.uid) {
        return { ok: false, error: 'You do not have permission to edit this petition.' };
      }

      const wasDraft = existing.status === 'draft';
      const nextStatus: PetitionStatus = input.submitForReview
        ? existing.status === 'live' || existing.status === 'responded'
          ? existing.status
          : perms.canModerate
          ? 'live'
          : 'pending_review'
        : existing.status === 'draft'
        ? 'draft'
        : existing.status;

      const updated: Petition = stripUndefined({
        ...existing,
        kind: input.kind,
        title: input.title.trim(),
        summary: input.summary.trim(),
        body: input.body.trim(),
        category: input.category,
        urgency: input.urgency,
        location: input.location.trim(),
        goalSignatures: Math.max(10, Math.round(input.goalSignatures)),
        isAnonymous: input.isAnonymous,
        authorDisplayName: input.isAnonymous ? 'Anonymous student' : me.displayName,
        authorAffiliation: input.isAnonymous ? undefined : me.affiliation,
        status: nextStatus,
        referenceNumber: formatPetitionReference(nextStatus, input.kind, existing.numericSeq),
        media: input.media?.length ? input.media : undefined,
        lastActivityNote:
          wasDraft && input.submitForReview
            ? perms.canModerate
              ? 'Draft published to public feed'
              : 'Draft submitted for moderator review'
            : 'Petition details updated',
        updatedAt: now,
      });

      this.db.petitions = this.db.petitions.map((p) => (p.id === updated.id ? updated : p));

      const activityEntry: ActivityEntry = stripUndefined({
        id: `act-${Date.now()}`,
        petitionId: updated.id,
        kind: wasDraft && input.submitForReview ? 'submission' : 'edit',
        body:
          wasDraft && input.submitForReview
            ? 'Draft published and submitted into the civic review record.'
            : 'Author updated the petition statement or supporting details.',
        authorId: me.uid,
        authorDisplayName: updated.isAnonymous ? 'Anonymous student' : me.displayName,
        authorRoleBadge: updated.isAnonymous ? undefined : formatRoleLabel(me.role),
        isAnonymousAuthor: updated.isAnonymous,
        triggeredStatus: wasDraft && input.submitForReview ? nextStatus : undefined,
        createdAt: now,
      });

      const list = this.db.activityByPetition[updated.id] ?? [];
      this.db.activityByPetition = {
        ...this.db.activityByPetition,
        [updated.id]: [...list, activityEntry],
      };

      const warning = this.persist();
      this.emit();
      return { ok: true, data: updated, warning };
    }

    const seq = this.db.nextPetitionSeq++;
    const id = `pet-${seq}`;
    const { slaHours, slaDeadlineAt } = computeSlaDeadlineIso(now, input.urgency);

    const created: Petition = stripUndefined({
      id,
      referenceNumber: formatPetitionReference(targetStatus, input.kind, seq),
      numericSeq: seq,
      kind: input.kind,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      category: input.category,
      urgency: input.urgency,
      location: input.location.trim(),
      status: targetStatus,
      isAnonymous: input.isAnonymous,
      authorId: me.uid,
      authorDisplayName: input.isAnonymous ? 'Anonymous student' : me.displayName,
      authorAffiliation: input.isAnonymous ? undefined : me.affiliation,
      goalSignatures: Math.max(10, Math.round(input.goalSignatures)),
      signatureCount: 0,
      pinned: false,
      slaHours,
      slaDeadlineAt,
      media: input.media?.length ? input.media : undefined,
      lastActivityNote:
        targetStatus === 'draft'
          ? 'Saved as private draft'
          : targetStatus === 'live'
          ? 'Published to public feed'
          : 'Awaiting moderator review',
      createdAt: now,
      updatedAt: now,
    });

    this.db.petitions = [created, ...this.db.petitions];
    this.db.signaturesByPetition = { ...this.db.signaturesByPetition, [id]: [] };

    if (targetStatus !== 'draft') {
      const submissionEntry: ActivityEntry = stripUndefined({
        id: `act-${Date.now()}`,
        petitionId: id,
        kind: 'submission',
        body:
          targetStatus === 'live'
            ? 'Petition published directly to the public feed.'
            : 'Petition submitted for moderator review.',
        authorId: me.uid,
        authorDisplayName: created.isAnonymous ? 'Anonymous student' : me.displayName,
        authorRoleBadge: created.isAnonymous ? undefined : formatRoleLabel(me.role),
        isAnonymousAuthor: created.isAnonymous,
        triggeredStatus: targetStatus,
        createdAt: now,
      });
      this.db.activityByPetition = {
        ...this.db.activityByPetition,
        [id]: [submissionEntry],
      };
    }

    const warning = this.persist();
    this.emit();
    return { ok: true, data: created, warning };
  }

  async signPetition(petitionId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me) return { ok: false, error: 'Please sign in to endorse this petition.' };
    if (!perms.canSign) {
      return {
        ok: false,
        error:
          me.accountStatus === 'pending'
            ? 'Your account is awaiting moderator verification. Signing unlocks as soon as your profile is approved.'
            : 'Your account is not currently eligible to sign petitions.',
      };
    }

    const petition = this.db.petitions.find((p) => p.id === petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };
    if (petition.status !== 'live' && petition.status !== 'responded') {
      return { ok: false, error: 'Only open petitions can accept new signatures.' };
    }

    const currentSigs = this.db.signaturesByPetition[petitionId] ?? [];
    if (currentSigs.some((s) => s.userId === me.uid)) {
      return { ok: false, error: 'You have already endorsed this petition.' };
    }

    const now = new Date().toISOString();
    const newSig: SignatureRecord = {
      userId: me.uid,
      displayName: me.displayName,
      roleBadge: formatRoleLabel(me.role),
      signedAt: now,
    };

    this.db.signaturesByPetition = {
      ...this.db.signaturesByPetition,
      [petitionId]: [newSig, ...currentSigs],
    };
    this.db.petitions = this.db.petitions.map((p) =>
      p.id === petitionId
        ? { ...p, signatureCount: p.signatureCount + 1, updatedAt: now }
        : p
    );

    this.persist();
    this.emit();
    return { ok: true };
  }

  async retractSignature(petitionId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canSign) {
      return { ok: false, error: 'Verified membership required.' };
    }

    const petition = this.db.petitions.find((p) => p.id === petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };
    if (petition.status !== 'live' && petition.status !== 'responded') {
      return { ok: false, error: 'Signatures cannot be altered on closed or resolved records.' };
    }

    const currentSigs = this.db.signaturesByPetition[petitionId] ?? [];
    if (!currentSigs.some((s) => s.userId === me.uid)) {
      return { ok: false, error: 'You have not signed this petition.' };
    }

    const now = new Date().toISOString();
    this.db.signaturesByPetition = {
      ...this.db.signaturesByPetition,
      [petitionId]: currentSigs.filter((s) => s.userId !== me.uid),
    };
    this.db.petitions = this.db.petitions.map((p) =>
      p.id === petitionId
        ? { ...p, signatureCount: Math.max(0, p.signatureCount - 1), updatedAt: now }
        : p
    );

    this.persist();
    this.emit();
    return { ok: true };
  }

  async addActivityEntry(input: {
    petitionId: string;
    kind: ActivityEntry['kind'];
    body: string;
    parentId?: string;
    media?: ActivityEntry['media'];
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canComment) {
      return { ok: false, error: 'Verified membership required to post in the thread.' };
    }

    if (input.kind === 'official_response' && !perms.canModerate) {
      return { ok: false, error: 'Only moderators can post official responses.' };
    }
    if (input.kind === 'organiser_update' && !perms.canPublishOfficialUpdate) {
      return { ok: false, error: 'Only verified organisers or moderators can post campaign updates.' };
    }
    if (input.media?.length && !perms.canAttachMediaToUpdate) {
      return { ok: false, error: 'Attaching thread media requires Verified Organiser or Moderator status.' };
    }

    const body = input.body.trim();
    if (!body) return { ok: false, error: 'Please write a message before posting.' };

    const petition = this.db.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const isAnonAuthor = petition.isAnonymous && petition.authorId === me.uid && input.kind !== 'official_response';

    const entry: ActivityEntry = stripUndefined({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      petitionId: input.petitionId,
      parentId: input.parentId,
      kind: input.kind,
      body,
      authorId: me.uid,
      authorDisplayName: isAnonAuthor ? 'Anonymous student' : me.displayName,
      authorRoleBadge:
        input.kind === 'official_response'
          ? 'Official Response'
          : isAnonAuthor
          ? undefined
          : formatRoleLabel(me.role),
      isAnonymousAuthor: isAnonAuthor,
      media: input.media?.length ? input.media : undefined,
      createdAt: now,
    });

    const existingList = this.db.activityByPetition[input.petitionId] ?? [];
    this.db.activityByPetition = {
      ...this.db.activityByPetition,
      [input.petitionId]: [...existingList, entry],
    };

    if (input.kind === 'official_response' || input.kind === 'organiser_update') {
      this.db.petitions = this.db.petitions.map((p) =>
        p.id === input.petitionId
          ? {
              ...p,
              lastActivityNote:
                input.kind === 'official_response'
                  ? 'Official response added'
                  : 'Organiser update posted',
              updatedAt: now,
            }
          : p
      );
    }

    const warning = this.persist();
    this.emit();
    return { ok: true, warning };
  }

  async moderatePetitionDecision(input: {
    petitionId: string;
    decision: 'approve' | 'decline';
    reason: string;
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const reason = input.reason.trim();
    if (reason.length < 5) {
      return { ok: false, error: 'Please state a clear written reason (at least 5 characters).' };
    }

    const petition = this.db.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const nextStatus: PetitionStatus = input.decision === 'approve' ? 'live' : 'declined';
    const nextSla = computeSlaDeadlineIso(now, petition.urgency);

    this.db.petitions = this.db.petitions.map((p) =>
      p.id === input.petitionId
        ? stripUndefined({
            ...p,
            status: nextStatus,
            referenceNumber: formatPetitionReference(nextStatus, p.kind, p.numericSeq),
            moderationReason: reason,
            slaHours: input.decision === 'approve' ? nextSla.slaHours : p.slaHours,
            slaDeadlineAt: input.decision === 'approve' ? nextSla.slaDeadlineAt : p.slaDeadlineAt,
            lastActivityNote:
              input.decision === 'approve' ? 'Approved by moderator' : 'Declined by moderator',
            updatedAt: now,
          })
        : p
    );

    const entry: ActivityEntry = {
      id: `act-${Date.now()}`,
      petitionId: input.petitionId,
      kind: 'moderator_decision',
      body: `${input.decision === 'approve' ? 'Approved' : 'Declined'}: ${reason}`,
      authorId: me.uid,
      authorDisplayName: me.displayName,
      authorRoleBadge: 'Moderator',
      isAnonymousAuthor: false,
      triggeredStatus: nextStatus,
      createdAt: now,
    };

    const existingList = this.db.activityByPetition[input.petitionId] ?? [];
    this.db.activityByPetition = {
      ...this.db.activityByPetition,
      [input.petitionId]: [...existingList, entry],
    };

    this.persist();
    this.emit();
    return { ok: true };
  }

  async updatePetitionStatus(input: {
    petitionId: string;
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const note = input.note.trim();
    if (note.length < 4) {
      return { ok: false, error: 'Please include an official note for the public record.' };
    }

    const petition = this.db.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const isResponseStatus = input.status === 'responded' || input.status === 'achieved';

    this.db.petitions = this.db.petitions.map((p) =>
      p.id === input.petitionId
        ? stripUndefined({
            ...p,
            status: input.status,
            referenceNumber: formatPetitionReference(input.status, p.kind, p.numericSeq),
            respondedAt: isResponseStatus ? p.respondedAt ?? now : p.respondedAt,
            lastActivityNote:
              input.status === 'responded'
                ? 'Official response recorded'
                : input.status === 'achieved'
                ? 'Marked achieved by moderator'
                : `Status set to ${input.status.replace('_', ' ')}`,
            updatedAt: now,
          })
        : p
    );

    const entry: ActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      petitionId: input.petitionId,
      kind: input.status === 'responded' || input.status === 'achieved' ? 'official_response' : 'status_change',
      body: note,
      authorId: me.uid,
      authorDisplayName: me.displayName,
      authorRoleBadge: isResponseStatus ? 'Official Response' : 'Moderator',
      isAnonymousAuthor: false,
      triggeredStatus: input.status,
      createdAt: now,
    };

    const existingList = this.db.activityByPetition[input.petitionId] ?? [];
    this.db.activityByPetition = {
      ...this.db.activityByPetition,
      [input.petitionId]: [...existingList, entry],
    };

    this.persist();
    this.emit();
    return { ok: true };
  }

  async bulkUpdatePetitionStatus(input: {
    petitionIds: string[];
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    if (input.petitionIds.length === 0) {
      return { ok: false, error: 'Select at least one petition.' };
    }
    for (const id of input.petitionIds) {
      const res = await this.updatePetitionStatus({
        petitionId: id,
        status: input.status,
        note: input.note,
      });
      if (!res.ok) return res;
    }
    return { ok: true };
  }

  async togglePinPetition(petitionId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const now = new Date().toISOString();
    this.db.petitions = this.db.petitions.map((p) =>
      p.id === petitionId ? { ...p, pinned: !p.pinned, updatedAt: now } : p
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async createEvent(input: CreateEventInput): Promise<ActionResult<CampaignEvent>> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canCreateEvent) {
      return { ok: false, error: 'Only Verified Organisers or Moderators can publish events.' };
    }

    const now = new Date().toISOString();
    const seq = this.db.nextEventSeq++;
    const event: CampaignEvent = stripUndefined({
      id: `evt-${seq}`,
      referenceNumber: formatEventReference(seq),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      tags: input.tags.filter(Boolean).slice(0, 6),
      location: input.location.trim(),
      startDate: input.startDate,
      endDate: input.endDate || input.startDate,
      timeLabel: input.timeLabel.trim(),
      organiserId: me.uid,
      organiserName: me.displayName,
      capacity: input.capacity && input.capacity > 0 ? Math.round(input.capacity) : undefined,
      rsvpCount: 0,
      promoVideoUrl: input.promoVideoUrl?.trim() || undefined,
      gallery: input.gallery?.length ? input.gallery : undefined,
      createdAt: now,
      updatedAt: now,
    });

    this.db.events = [event, ...this.db.events];
    this.db.rsvpsByEvent = { ...this.db.rsvpsByEvent, [event.id]: [] };
    const warning = this.persist();
    this.emit();
    return { ok: true, data: event, warning };
  }

  async deleteEvent(eventId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    const event = this.db.events.find((e) => e.id === eventId);
    if (!event) return { ok: false, error: 'Event not found.' };
    if (!me || (!perms.canDeleteAnyEvent && !(perms.canCreateEvent && event.organiserId === me.uid))) {
      return { ok: false, error: 'You do not have permission to delete this event.' };
    }

    this.db.events = this.db.events.filter((e) => e.id !== eventId);
    const nextRsvps = { ...this.db.rsvpsByEvent };
    delete nextRsvps[eventId];
    this.db.rsvpsByEvent = nextRsvps;
    this.persist();
    this.emit();
    return { ok: true };
  }

  async rsvpEvent(eventId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canRsvpEvent) {
      return { ok: false, error: 'Only verified members can RSVP to community events.' };
    }
    const event = this.db.events.find((e) => e.id === eventId);
    if (!event) return { ok: false, error: 'Event not found.' };
    const current = this.db.rsvpsByEvent[eventId] ?? [];
    if (current.some((r) => r.userId === me.uid)) {
      return { ok: false, error: 'You are already on the RSVP list.' };
    }
    if (event.capacity && event.rsvpCount >= event.capacity) {
      return { ok: false, error: 'This event has reached full capacity.' };
    }

    const now = new Date().toISOString();
    this.db.rsvpsByEvent = {
      ...this.db.rsvpsByEvent,
      [eventId]: [...current, { userId: me.uid, displayName: me.displayName, createdAt: now }],
    };
    this.db.events = this.db.events.map((e) =>
      e.id === eventId ? { ...e, rsvpCount: e.rsvpCount + 1, updatedAt: now } : e
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async cancelEventRsvp(eventId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canRsvpEvent) return { ok: false, error: 'Sign in required.' };

    const current = this.db.rsvpsByEvent[eventId] ?? [];
    if (!current.some((r) => r.userId === me.uid)) {
      return { ok: false, error: 'You do not have an active RSVP for this event.' };
    }
    const now = new Date().toISOString();
    this.db.rsvpsByEvent = {
      ...this.db.rsvpsByEvent,
      [eventId]: current.filter((r) => r.userId !== me.uid),
    };
    this.db.events = this.db.events.map((e) =>
      e.id === eventId ? { ...e, rsvpCount: Math.max(0, e.rsvpCount - 1), updatedAt: now } : e
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async createNotice(input: CreateNoticeInput): Promise<ActionResult<Notice>> {
    const me = this.getCurrentMember();
    const perms = getPermissions(me);
    if (!me || !perms.canPostNotice) {
      return { ok: false, error: 'Only moderators can publish notices or polls.' };
    }

    const now = new Date().toISOString();
    const pollOptions =
      input.kind === 'poll'
        ? (input.pollOptions ?? [])
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((label, idx) => ({ id: `opt-${Date.now()}-${idx}`, label, voteCount: 0 }))
        : undefined;

    if (input.kind === 'poll' && (!pollOptions || pollOptions.length < 2)) {
      return { ok: false, error: 'A community poll requires at least two answer choices.' };
    }

    const notice: Notice = stripUndefined({
      id: `not-${Date.now()}`,
      title: input.title.trim(),
      body: input.body.trim(),
      kind: input.kind,
      pinned: input.pinned,
      authorId: me.uid,
      authorDisplayName: me.displayName,
      pollOptions,
      totalVotes: 0,
      createdAt: now,
      updatedAt: now,
    });

    this.db.notices = [notice, ...this.db.notices];
    this.persist();
    this.emit();
    return { ok: true, data: notice };
  }

  async togglePinNotice(noticeId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me || !getPermissions(me).canPostNotice) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const now = new Date().toISOString();
    this.db.notices = this.db.notices.map((n) =>
      n.id === noticeId ? { ...n, pinned: !n.pinned, updatedAt: now } : n
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async deleteNotice(noticeId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me || !getPermissions(me).canPostNotice) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    this.db.notices = this.db.notices.filter((n) => n.id !== noticeId);
    const nextVotes = { ...this.db.votesByNotice };
    delete nextVotes[noticeId];
    this.db.votesByNotice = nextVotes;
    this.persist();
    this.emit();
    return { ok: true };
  }

  async votePoll(noticeId: string, optionId: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me || !getPermissions(me).canVotePoll) {
      return { ok: false, error: 'Only verified members can vote in community polls.' };
    }
    const notice = this.db.notices.find((n) => n.id === noticeId && n.kind === 'poll');
    if (!notice || !notice.pollOptions) return { ok: false, error: 'Poll not found.' };
    if (!notice.pollOptions.some((o) => o.id === optionId)) {
      return { ok: false, error: 'Invalid poll option.' };
    }

    const currentVotes = this.db.votesByNotice[noticeId] ?? [];
    const existingVote = currentVotes.find((v) => v.userId === me.uid);
    if (existingVote && existingVote.optionId === optionId) {
      return { ok: true };
    }

    const now = new Date().toISOString();
    const updatedOptions = notice.pollOptions.map((opt) => {
      let count = opt.voteCount;
      if (existingVote && opt.id === existingVote.optionId) {
        count = Math.max(0, count - 1);
      }
      if (opt.id === optionId) {
        count += 1;
      }
      return { ...opt, voteCount: count };
    });

    const nextVotes = existingVote
      ? currentVotes.map((v) =>
          v.userId === me.uid ? { ...v, optionId, updatedAt: now } : v
        )
      : [...currentVotes, { userId: me.uid, optionId, updatedAt: now }];

    this.db.votesByNotice = { ...this.db.votesByNotice, [noticeId]: nextVotes };
    this.db.notices = this.db.notices.map((n) =>
      n.id === noticeId
        ? {
            ...n,
            pollOptions: updatedOptions,
            totalVotes: existingVote ? n.totalVotes : n.totalVotes + 1,
            updatedAt: now,
          }
        : n
    );

    this.persist();
    this.emit();
    return { ok: true };
  }

  async updateMemberDirectory(input: {
    targetUid: string;
    accountStatus?: Member['accountStatus'];
    role?: Member['role'];
    rejectionReason?: string;
  }): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me || !getPermissions(me).canManageDirectory) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const target = this.db.members.find((m) => m.uid === input.targetUid);
    if (!target) return { ok: false, error: 'Member not found.' };
    if (normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL) {
      return {
        ok: false,
        error: `The main administrator (${PRIMARY_ADMIN_EMAIL}) cannot be demoted or rejected.`,
      };
    }

    const now = new Date().toISOString();
    this.db.members = this.db.members.map((m) =>
      m.uid === input.targetUid
        ? stripUndefined({
            ...m,
            accountStatus: input.accountStatus ?? m.accountStatus,
            role: input.role ?? m.role,
            rejectionReason:
              input.accountStatus === 'rejected'
                ? input.rejectionReason?.trim() || 'Account did not meet community verification requirements.'
                : input.accountStatus === 'approved'
                ? undefined
                : m.rejectionReason,
            updatedAt: now,
          })
        : m
    );
    this.persist();
    this.emit();
    return { ok: true };
  }

  async removeMember(targetUid: string): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me || !getPermissions(me).canManageDirectory) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    if (targetUid === me.uid) {
      return { ok: false, error: 'For safety, you cannot remove your own moderator account.' };
    }
    const target = this.db.members.find((m) => m.uid === targetUid);
    if (target && normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL) {
      return {
        ok: false,
        error: `The main administrator (${PRIMARY_ADMIN_EMAIL}) cannot be removed.`,
      };
    }
    this.db.members = this.db.members.filter((m) => m.uid !== targetUid);
    this.persist();
    this.emit();
    return { ok: true };
  }

  exportBackup(): AppBackupSnapshot | null {
    const me = this.getCurrentMember();
    if (!me) return null;
    const authoredPetitions = this.db.petitions.filter((p) => p.authorId === me.uid);
    const signedPetitionIds = Object.entries(this.db.signaturesByPetition)
      .filter(([, sigs]) => sigs.some((s) => s.userId === me.uid))
      .map(([pid]) => pid);
    const comments = Object.values(this.db.activityByPetition)
      .flat()
      .filter((a) => a.authorId === me.uid);

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      platform: BRAND_CONFIG.name,
      member: me,
      authoredPetitions,
      signedPetitionIds,
      comments,
    };
  }

  async restoreBackup(snapshot: AppBackupSnapshot): Promise<ActionResult> {
    const me = this.getCurrentMember();
    if (!me) return { ok: false, error: 'Sign in before restoring a personal backup.' };

    const now = new Date().toISOString();
    // Restore editable profile fields (email stays immutable for current account identity)
    this.db.members = this.db.members.map((m) =>
      m.uid === me.uid
        ? stripUndefined({
            ...m,
            studentName: snapshot.member.studentName ?? m.studentName,
            studentClass: snapshot.member.studentClass ?? m.studentClass,
            grade: snapshot.member.grade ?? m.grade,
            dateOfBirth: snapshot.member.dateOfBirth ?? m.dateOfBirth,
            displayName: snapshot.member.displayName,
            affiliation: snapshot.member.affiliation,
            bio: snapshot.member.bio,
            avatarId: snapshot.member.avatarId,
            avatarDataUrl: snapshot.member.avatarDataUrl,
            updatedAt: now,
          })
        : m
    );

    // Restore authored drafts & petitions belonging to the current member
    const existingIds = new Set(this.db.petitions.map((p) => p.id));
    const restoredPetitions: Petition[] = [];
    for (const p of snapshot.authoredPetitions) {
      const normalized = { ...p, authorId: me.uid };
      if (existingIds.has(p.id)) {
        this.db.petitions = this.db.petitions.map((cur) => (cur.id === p.id ? normalized : cur));
      } else {
        restoredPetitions.push(normalized);
      }
    }
    if (restoredPetitions.length > 0) {
      this.db.petitions = [...restoredPetitions, ...this.db.petitions];
    }

    const warning = this.persist();
    this.emit();
    return { ok: true, warning };
  }

  async clearLocalDeviceCache(): Promise<ActionResult> {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_UID_KEY);
    this.currentUid = null;
    this.db = buildInitialLocalDb();
    this.persist();
    this.emit();
    return { ok: true };
  }
}
