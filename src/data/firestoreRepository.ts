import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { BRAND_CONFIG, PRIMARY_ADMIN_EMAIL } from '@/src/config/brand';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  reportFirestoreError,
  testFirestoreConnection,
} from '@/src/data/firebaseClient';
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
  SEED_EVENTS,
  SEED_NOTICES,
  SEED_PETITIONS,
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
} from '@/src/types/civic';
import { formatRoleLabel, getPermissions } from '@/src/utils/permissions';
import { formatEventReference, formatPetitionReference } from '@/src/utils/references';
import { computeSlaDeadlineIso } from '@/src/utils/sla';
import { normalizeEmail, stripUndefined } from '@/src/utils/storageGuard';

const BOOTSTRAP_ADMIN_EMAIL = PRIMARY_ADMIN_EMAIL;
const PUBLIC_PETITION_STATUSES: PetitionStatus[] = ['live', 'responded', 'achieved', 'closed'];

/**
 * Live Firebase Authentication + Cloud Firestore repository.
 * Enforces permissions both locally and via deployed firestore.rules.
 */
export class FirestoreRepository implements CivicRepository {
  readonly mode = 'firebase' as const;
  private listeners = new Set<(snapshot: CivicStoreSnapshot) => void>();
  private unsubs: Unsubscribe[] = [];
  private petitionSubUnsubs = new Map<string, () => void>();
  private eventSubUnsubs = new Map<string, () => void>();
  private noticeSubUnsubs = new Map<string, () => void>();
  private authUnsub: (() => void) | null = null;
  private activeAuthUid: string | null | undefined = undefined;
  private seededThisSession = false;

  private state: CivicStoreSnapshot = {
    mode: 'firebase',
    ready: false,
    currentUser: null,
    members: [],
    petitions: [],
    signaturesByPetition: {},
    activityByPetition: {},
    events: [],
    rsvpsByEvent: {},
    notices: [],
    votesByNotice: {},
  };

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    if (!auth || !db) {
      this.state = { ...this.state, ready: true };
      this.emit();
      return;
    }

    await testFirestoreConnection();

    this.authUnsub = onAuthStateChanged(auth, async (fbUser) => {
      const nextUid = fbUser?.uid ?? null;
      // Avoid tearing down and re-attaching all listeners on background token refreshes for the same user
      if (this.activeAuthUid === nextUid && this.unsubs.length > 0) {
        return;
      }
      this.activeAuthUid = nextUid;
      this.clearCollectionListeners();
      if (fbUser) {
        await this.ensureMemberDocument(fbUser);
      } else {
        this.state = {
          ...this.state,
          currentUser: null,
          members: [],
        };
      }
      this.attachCollectionListeners(fbUser);
    });
  }

  private async ensureMemberDocument(fbUser: FirebaseUser): Promise<void> {
    if (!db) return;
    const memberRef = doc(db, 'members', fbUser.uid);
    try {
      const snap = await getDoc(memberRef);
      const email = normalizeEmail(fbUser.email || `${fbUser.uid}@member.local`);
      const isBootstrapAdmin =
        email === BOOTSTRAP_ADMIN_EMAIL && Boolean(fbUser.emailVerified);
      const now = new Date().toISOString();

      if (!snap.exists()) {
        const newMember: Member = stripUndefined({
          uid: fbUser.uid,
          email,
          studentName: fbUser.displayName?.trim() || '',
          displayName: fbUser.displayName?.trim() || email.split('@')[0] || 'KC Student',
          role: isBootstrapAdmin ? 'moderator' : 'member',
          accountStatus: isBootstrapAdmin ? 'approved' : 'pending',
          avatarId: 'fortis-purple',
          lastActiveAt: now,
          createdAt: now,
          updatedAt: now,
        });
        await setDoc(memberRef, newMember);
        this.state = { ...this.state, currentUser: newMember };
      } else {
        const existing = snap.data() as Member;
        if (
          isBootstrapAdmin &&
          (existing.role !== 'moderator' || existing.accountStatus !== 'approved')
        ) {
          const promoted: Member = stripUndefined({
            ...existing,
            role: 'moderator',
            accountStatus: 'approved',
            rejectionReason: '',
            updatedAt: now,
          });
          await updateDoc(memberRef, {
            role: 'moderator',
            accountStatus: 'approved',
            rejectionReason: '',
            updatedAt: now,
          });
          this.state = { ...this.state, currentUser: promoted };
        } else {
          this.state = { ...this.state, currentUser: existing };
        }
      }

      if (isBootstrapAdmin) {
        const adminRef = doc(db, 'admins', fbUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: fbUser.uid,
            grantedBy: 'bootstrap-primary-admin',
            createdAt: now,
          });
        }
        if (!this.seededThisSession) {
          this.seededThisSession = true;
          await this.seedIfEmpty(fbUser.uid);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `members/${fbUser.uid}`);
    }
  }

  private async seedIfEmpty(adminUid: string): Promise<void> {
    if (!db) return;
    try {
      const existingPetitions = await getDocs(collection(db, 'petitions'));
      if (!existingPetitions.empty) return;

      const batch = writeBatch(db);
      for (const p of SEED_PETITIONS) {
        batch.set(
          doc(db, 'petitions', p.id),
          stripUndefined({ ...p, authorId: adminUid })
        );
      }
      for (const act of SEED_ACTIVITY) {
        batch.set(
          doc(db, 'petitions', act.petitionId, 'activity', act.id),
          stripUndefined({ ...act, authorId: adminUid })
        );
      }
      for (const evt of SEED_EVENTS) {
        batch.set(
          doc(db, 'events', evt.id),
          stripUndefined({ ...evt, organiserId: adminUid })
        );
      }
      for (const notice of SEED_NOTICES) {
        batch.set(
          doc(db, 'notices', notice.id),
          stripUndefined({ ...notice, authorId: adminUid })
        );
      }
      await batch.commit();
    } catch (error) {
      console.warn('Initial Firestore seed skipped or failed:', error);
    }
  }

  private clearCollectionListeners(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const u of this.petitionSubUnsubs.values()) u();
    this.petitionSubUnsubs.clear();
    for (const u of this.eventSubUnsubs.values()) u();
    this.eventSubUnsubs.clear();
    for (const u of this.noticeSubUnsubs.values()) u();
    this.noticeSubUnsubs.clear();
  }

  private attachCollectionListeners(fbUser: FirebaseUser | null): void {
    if (!db) return;

    const isBootstrapAdmin =
      Boolean(fbUser?.emailVerified) &&
      normalizeEmail(fbUser?.email || '') === BOOTSTRAP_ADMIN_EMAIL;
    const isMod =
      isBootstrapAdmin ||
      (this.state.currentUser?.role === 'moderator' &&
        this.state.currentUser?.accountStatus === 'approved');

    // 1. Current member profile listener
    if (fbUser) {
      const myRef = doc(db, 'members', fbUser.uid);
      this.unsubs.push(
        onSnapshot(
          myRef,
          (snap) => {
            if (snap.exists()) {
              const member = snap.data() as Member;
              const wasMod = this.state.currentUser?.role === 'moderator';
              this.state = { ...this.state, currentUser: member };
              this.emit();
              if (!wasMod && member.role === 'moderator' && member.accountStatus === 'approved') {
                this.attachModeratorListeners();
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `members/${fbUser.uid}`)
        )
      );
    }

    if (isMod) {
      this.attachModeratorListeners();
    }

    // 2. Petitions listener (public live/responded/achieved/closed + own drafts if signed in)
    const publicQuery = isMod
      ? collection(db, 'petitions')
      : query(collection(db, 'petitions'), where('status', 'in', PUBLIC_PETITION_STATUSES));

    let publicPetitions: Petition[] = [];
    let ownPetitions: Petition[] = [];

    const mergeAndSyncPetitions = () => {
      const map = new Map<string, Petition>();
      for (const p of publicPetitions) map.set(p.id, p);
      for (const p of ownPetitions) map.set(p.id, p);
      const merged = Array.from(map.values()).sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
      this.state = { ...this.state, petitions: merged, ready: true };
      this.syncPetitionSubcollections(merged);
      this.emit();
    };

    this.unsubs.push(
      onSnapshot(
        publicQuery,
        (snap) => {
          publicPetitions = snap.docs.map((d) => d.data() as Petition);
          mergeAndSyncPetitions();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'petitions')
      )
    );

    if (fbUser && !isMod) {
      const ownQuery = query(
        collection(db, 'petitions'),
        where('authorId', '==', fbUser.uid)
      );
      this.unsubs.push(
        onSnapshot(
          ownQuery,
          (snap) => {
            ownPetitions = snap.docs.map((d) => d.data() as Petition);
            mergeAndSyncPetitions();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'petitions(own)')
        )
      );
    }

    // 3. Events listener
    this.unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          const events = snap.docs
            .map((d) => d.data() as CampaignEvent)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
          this.state = { ...this.state, events };
          this.syncEventSubcollections(events, fbUser, isMod);
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'events')
      )
    );

    // 4. Notices listener
    this.unsubs.push(
      onSnapshot(
        collection(db, 'notices'),
        (snap) => {
          const notices = snap.docs
            .map((d) => d.data() as Notice)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          this.state = { ...this.state, notices };
          this.syncNoticeSubcollections(notices, fbUser, isMod);
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notices')
      )
    );
  }

  private attachModeratorListeners(): void {
    if (!db) return;
    this.unsubs.push(
      onSnapshot(
        collection(db, 'members'),
        (snap) => {
          const members = snap.docs.map((d) => d.data() as Member);
          this.state = { ...this.state, members };
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'members')
      )
    );
  }

  private syncPetitionSubcollections(petitions: Petition[]): void {
    if (!db) return;
    const activeIds = new Set(petitions.map((p) => p.id));
    for (const [pid, unsub] of this.petitionSubUnsubs.entries()) {
      if (!activeIds.has(pid)) {
        unsub();
        this.petitionSubUnsubs.delete(pid);
      }
    }
    for (const p of petitions) {
      if (this.petitionSubUnsubs.has(p.id)) continue;
      const isPublic = PUBLIC_PETITION_STATUSES.includes(p.status);
      const sigUnsub = isPublic
        ? onSnapshot(
            collection(db, 'petitions', p.id, 'signatures'),
            (snap) => {
              const sigs = snap.docs.map((d) => d.data() as SignatureRecord);
              this.state = {
                ...this.state,
                signaturesByPetition: { ...this.state.signaturesByPetition, [p.id]: sigs },
              };
              this.emit();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, `petitions/${p.id}/signatures`)
          )
        : () => {};

      const actUnsub = onSnapshot(
        collection(db, 'petitions', p.id, 'activity'),
        (snap) => {
          const entries = snap.docs
            .map((d) => d.data() as ActivityEntry)
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          this.state = {
            ...this.state,
            activityByPetition: { ...this.state.activityByPetition, [p.id]: entries },
          };
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `petitions/${p.id}/activity`)
      );

      this.petitionSubUnsubs.set(p.id, () => {
        sigUnsub();
        actUnsub();
      });
    }
  }

  private syncEventSubcollections(
    events: CampaignEvent[],
    fbUser: FirebaseUser | null,
    isMod: boolean
  ): void {
    if (!db || !fbUser) return;
    const activeIds = new Set(events.map((e) => e.id));
    for (const [eid, unsub] of this.eventSubUnsubs.entries()) {
      if (!activeIds.has(eid)) {
        unsub();
        this.eventSubUnsubs.delete(eid);
      }
    }
    for (const ev of events) {
      if (this.eventSubUnsubs.has(ev.id)) continue;
      const q = isMod
        ? collection(db, 'events', ev.id, 'rsvps')
        : query(collection(db, 'events', ev.id, 'rsvps'), where('userId', '==', fbUser.uid));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const rsvps = snap.docs.map((d) => d.data() as EventRsvp);
          this.state = {
            ...this.state,
            rsvpsByEvent: { ...this.state.rsvpsByEvent, [ev.id]: rsvps },
          };
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `events/${ev.id}/rsvps`)
      );
      this.eventSubUnsubs.set(ev.id, unsub);
    }
  }

  private syncNoticeSubcollections(
    notices: Notice[],
    fbUser: FirebaseUser | null,
    isMod: boolean
  ): void {
    if (!db || !fbUser) return;
    for (const notice of notices) {
      if (notice.kind !== 'poll' || this.noticeSubUnsubs.has(notice.id)) continue;
      const q = isMod
        ? collection(db, 'notices', notice.id, 'votes')
        : query(collection(db, 'notices', notice.id, 'votes'), where('userId', '==', fbUser.uid));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const votes = snap.docs.map((d) => d.data() as PollVote);
          this.state = {
            ...this.state,
            votesByNotice: { ...this.state.votesByNotice, [notice.id]: votes },
          };
          this.emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `notices/${notice.id}/votes`)
      );
      this.noticeSubUnsubs.set(notice.id, unsub);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: (snapshot: CivicStoreSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.clearCollectionListeners();
    if (this.authUnsub) this.authUnsub();
    this.listeners.clear();
  }

  async signInWithGoogle(): Promise<ActionResult> {
    if (!auth) return { ok: false, error: 'Firebase Auth is not initialized.' };
    try {
      await signInWithPopup(auth, googleProvider);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.';
      if (msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        return {
          ok: false,
          error: `Google Sign-In is not yet authorized for "${host}". Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains, or switch to Local Demo Sandbox.`,
        };
      }
      return {
        ok: false,
        error: msg,
      };
    }
  }

  async signInDemo(): Promise<ActionResult<Member>> {
    return {
      ok: false,
      error: 'Demo sign-in is only active in Local Demo Mode. Use Google Sign-In or switch to Local Demo Sandbox.',
    };
  }

  async signUpDemo(): Promise<ActionResult<Member>> {
    return this.signInDemo();
  }

  async signOut(): Promise<void> {
    if (auth) await firebaseSignOut(auth);
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
    if (!db || !this.state.currentUser) return { ok: false, error: 'Sign in required.' };
    const uid = this.state.currentUser.uid;
    const now = new Date().toISOString();
    try {
      await updateDoc(
        doc(db, 'members', uid),
        stripUndefined({
          studentName:
            input.studentName !== undefined
              ? input.studentName.trim()
              : this.state.currentUser.studentName,
          studentClass:
            input.studentClass !== undefined
              ? input.studentClass.trim()
              : this.state.currentUser.studentClass,
          grade: input.grade !== undefined ? input.grade.trim() : this.state.currentUser.grade,
          dateOfBirth:
            input.dateOfBirth !== undefined
              ? input.dateOfBirth.trim()
              : this.state.currentUser.dateOfBirth,
          displayName: input.displayName.trim(),
          affiliation: input.affiliation?.trim() || '',
          bio: input.bio?.trim() || '',
          avatarId: input.avatarId || this.state.currentUser.avatarId || 'fortis-purple',
          avatarDataUrl: input.avatarDataUrl === '' ? '' : input.avatarDataUrl ?? this.state.currentUser.avatarDataUrl,
          updatedAt: now,
        })
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.UPDATE, `members/${uid}`),
      };
    }
  }

  async submitAppeal(appealNote: string): Promise<ActionResult> {
    if (!db || !this.state.currentUser) return { ok: false, error: 'Sign in required.' };
    const uid = this.state.currentUser.uid;
    try {
      await updateDoc(doc(db, 'members', uid), {
        appealNote: appealNote.trim(),
        updatedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.UPDATE, `members/${uid}`),
      };
    }
  }

  async recordPresence(): Promise<void> {
    if (!db || !this.state.currentUser) return;
    const uid = this.state.currentUser.uid;
    try {
      await updateDoc(doc(db, 'members', uid), {
        lastActiveAt: new Date().toISOString(),
      });
    } catch {
      // Presence is non-critical; ignore transient errors
    }
  }

  async savePetition(input: SavePetitionInput): Promise<ActionResult<Petition>> {
    const me = this.state.currentUser;
    const perms = getPermissions(me);
    if (!db || !me || !perms.canCreatePetition) {
      return { ok: false, error: 'Only approved verified members can create petitions.' };
    }
    const now = new Date().toISOString();

    if (input.id) {
      const existing = this.state.petitions.find((p) => p.id === input.id);
      if (!existing) return { ok: false, error: 'Petition not found.' };
      const wasDraft = existing.status === 'draft';
      const nextStatus: PetitionStatus = input.submitForReview
        ? existing.status === 'live' || existing.status === 'responded'
          ? existing.status
          : perms.canModerate
          ? 'live'
          : 'pending_review'
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
          wasDraft && input.submitForReview ? 'Draft submitted for review' : 'Updated by author',
        updatedAt: now,
      });

      if (JSON.stringify(updated).length > 900_000) {
        return {
          ok: false,
          error:
            'Petition attachments exceed the 1 MB cloud document limit. Remove a large attachment or link an external video instead.',
        };
      }

      try {
        await setDoc(doc(db, 'petitions', updated.id), updated);
        const actId = `act-${Date.now()}`;
        await setDoc(
          doc(db, 'petitions', updated.id, 'activity', actId),
          stripUndefined({
            id: actId,
            petitionId: updated.id,
            kind: wasDraft && input.submitForReview ? 'submission' : 'edit',
            body:
              wasDraft && input.submitForReview
                ? 'Draft published and submitted into the civic review record.'
                : 'Author updated the petition statement.',
            authorId: me.uid,
            authorDisplayName: updated.isAnonymous ? 'Anonymous student' : me.displayName,
            authorRoleBadge: updated.isAnonymous ? undefined : formatRoleLabel(me.role),
            isAnonymousAuthor: updated.isAnonymous,
            triggeredStatus: wasDraft && input.submitForReview ? nextStatus : undefined,
            createdAt: now,
          })
        );
        return { ok: true, data: updated };
      } catch (err) {
        return {
          ok: false,
          error: reportFirestoreError(err, OperationType.WRITE, `petitions/${updated.id}`),
        };
      }
    }

    const maxSeq = this.state.petitions.reduce((acc, p) => Math.max(acc, p.numericSeq), 1046);
    const seq = maxSeq + 1;
    const id = `pet-${seq}-${Date.now().toString(36)}`;
    const status: PetitionStatus = input.submitForReview
      ? perms.canModerate
        ? 'live'
        : 'pending_review'
      : 'draft';
    const { slaHours, slaDeadlineAt } = computeSlaDeadlineIso(now, input.urgency);

    const created: Petition = stripUndefined({
      id,
      referenceNumber: formatPetitionReference(status, input.kind, seq),
      numericSeq: seq,
      kind: input.kind,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      category: input.category,
      urgency: input.urgency,
      location: input.location.trim(),
      status,
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
      lastActivityNote: status === 'draft' ? 'Saved as draft' : 'Submitted for review',
      createdAt: now,
      updatedAt: now,
    });

    if (JSON.stringify(created).length > 900_000) {
      return {
        ok: false,
        error:
          'Petition attachments exceed the 1 MB cloud document limit. Remove a large attachment or link an external video instead.',
      };
    }

    try {
      await setDoc(doc(db, 'petitions', id), created);
      if (status !== 'draft') {
        const actId = `act-${Date.now()}`;
        await setDoc(
          doc(db, 'petitions', id, 'activity', actId),
          stripUndefined({
            id: actId,
            petitionId: id,
            kind: 'submission',
            body: status === 'live' ? 'Petition published.' : 'Petition submitted for moderator review.',
            authorId: me.uid,
            authorDisplayName: created.isAnonymous ? 'Anonymous student' : me.displayName,
            authorRoleBadge: created.isAnonymous ? undefined : formatRoleLabel(me.role),
            isAnonymousAuthor: created.isAnonymous,
            triggeredStatus: status,
            createdAt: now,
          })
        );
      }
      return { ok: true, data: created };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.CREATE, `petitions/${id}`),
      };
    }
  }

  async signPetition(petitionId: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    const perms = getPermissions(me);
    if (!db || !me || !perms.canSign) {
      return {
        ok: false,
        error:
          me?.accountStatus === 'pending'
            ? 'Your account is pending moderator approval.'
            : 'Approved verified account required to sign.',
      };
    }
    const petition = this.state.petitions.find((p) => p.id === petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.set(doc(db, 'petitions', petitionId, 'signatures', me.uid), {
      userId: me.uid,
      displayName: me.displayName,
      roleBadge: formatRoleLabel(me.role),
      signedAt: now,
    });
    batch.update(doc(db, 'petitions', petitionId), {
      signatureCount: petition.signatureCount + 1,
      updatedAt: now,
    });

    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.WRITE, `petitions/${petitionId}/signatures/${me.uid}`),
      };
    }
  }

  async retractSignature(petitionId: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canSign) {
      return { ok: false, error: 'Approved account required.' };
    }
    const petition = this.state.petitions.find((p) => p.id === petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'petitions', petitionId, 'signatures', me.uid));
    batch.update(doc(db, 'petitions', petitionId), {
      signatureCount: Math.max(0, petition.signatureCount - 1),
      updatedAt: now,
    });

    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.DELETE, `petitions/${petitionId}/signatures/${me.uid}`),
      };
    }
  }

  async addActivityEntry(input: {
    petitionId: string;
    kind: ActivityEntry['kind'];
    body: string;
    parentId?: string;
    media?: ActivityEntry['media'];
  }): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canComment) {
      return { ok: false, error: 'Approved membership required.' };
    }
    const petition = this.state.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const actId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isAnon = petition.isAnonymous && petition.authorId === me.uid && input.kind !== 'official_response';
    const entry: ActivityEntry = stripUndefined({
      id: actId,
      petitionId: input.petitionId,
      parentId: input.parentId,
      kind: input.kind,
      body: input.body.trim(),
      authorId: me.uid,
      authorDisplayName: isAnon ? 'Anonymous student' : me.displayName,
      authorRoleBadge:
        input.kind === 'official_response'
          ? 'Official Response'
          : isAnon
          ? undefined
          : formatRoleLabel(me.role),
      isAnonymousAuthor: isAnon,
      media: input.media?.length ? input.media : undefined,
      createdAt: now,
    });

    if (JSON.stringify(entry).length > 900_000) {
      return {
        ok: false,
        error: 'Update attachments exceed the 1 MB cloud document limit. Please attach fewer or smaller media items.',
      };
    }
    try {
      await setDoc(doc(db, 'petitions', input.petitionId, 'activity', actId), entry);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.CREATE, `petitions/${input.petitionId}/activity/${actId}`),
      };
    }
  }

  async moderatePetitionDecision(input: {
    petitionId: string;
    decision: 'approve' | 'decline';
    reason: string;
  }): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const petition = this.state.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const nextStatus: PetitionStatus = input.decision === 'approve' ? 'live' : 'declined';
    const nextSla = computeSlaDeadlineIso(now, petition.urgency);
    const actId = `act-${Date.now()}`;

    const batch = writeBatch(db);
    batch.update(
      doc(db, 'petitions', input.petitionId),
      stripUndefined({
        status: nextStatus,
        referenceNumber: formatPetitionReference(nextStatus, petition.kind, petition.numericSeq),
        moderationReason: input.reason.trim(),
        slaHours: input.decision === 'approve' ? nextSla.slaHours : petition.slaHours,
        slaDeadlineAt: input.decision === 'approve' ? nextSla.slaDeadlineAt : petition.slaDeadlineAt,
        lastActivityNote: input.decision === 'approve' ? 'Approved by moderator' : 'Declined by moderator',
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'petitions', input.petitionId, 'activity', actId), {
      id: actId,
      petitionId: input.petitionId,
      kind: 'moderator_decision',
      body: `${input.decision === 'approve' ? 'Approved' : 'Declined'}: ${input.reason.trim()}`,
      authorId: me.uid,
      authorDisplayName: me.displayName,
      authorRoleBadge: 'Moderator',
      isAnonymousAuthor: false,
      triggeredStatus: nextStatus,
      createdAt: now,
    });

    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.WRITE, `petitions/${input.petitionId}`),
      };
    }
  }

  async updatePetitionStatus(input: {
    petitionId: string;
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const petition = this.state.petitions.find((p) => p.id === input.petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };

    const now = new Date().toISOString();
    const isResponse = input.status === 'responded' || input.status === 'achieved';
    const actId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const batch = writeBatch(db);
    batch.update(
      doc(db, 'petitions', input.petitionId),
      stripUndefined({
        status: input.status,
        referenceNumber: formatPetitionReference(input.status, petition.kind, petition.numericSeq),
        respondedAt: isResponse ? petition.respondedAt ?? now : petition.respondedAt,
        lastActivityNote: `Status updated to ${input.status.replace('_', ' ')}`,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'petitions', input.petitionId, 'activity', actId), {
      id: actId,
      petitionId: input.petitionId,
      kind: isResponse ? 'official_response' : 'status_change',
      body: input.note.trim(),
      authorId: me.uid,
      authorDisplayName: me.displayName,
      authorRoleBadge: isResponse ? 'Official Response' : 'Moderator',
      isAnonymousAuthor: false,
      triggeredStatus: input.status,
      createdAt: now,
    });

    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.WRITE, `petitions/${input.petitionId}`),
      };
    }
  }

  async bulkUpdatePetitionStatus(input: {
    petitionIds: string[];
    status: PetitionStatus;
    note: string;
  }): Promise<ActionResult> {
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
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canModerate) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const petition = this.state.petitions.find((p) => p.id === petitionId);
    if (!petition) return { ok: false, error: 'Petition not found.' };
    try {
      await updateDoc(doc(db, 'petitions', petitionId), {
        pinned: !petition.pinned,
        updatedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.UPDATE, `petitions/${petitionId}`),
      };
    }
  }

  async createEvent(input: CreateEventInput): Promise<ActionResult<CampaignEvent>> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canCreateEvent) {
      return { ok: false, error: 'Only Verified Organisers or Moderators can create events.' };
    }
    const seq = 2003 + this.state.events.length;
    const id = `evt-${seq}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const event: CampaignEvent = stripUndefined({
      id,
      referenceNumber: formatEventReference(seq),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      tags: input.tags.slice(0, 6),
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

    if (JSON.stringify(event).length > 900_000) {
      return {
        ok: false,
        error: 'Event gallery attachments exceed the 1 MB cloud document limit. Please attach fewer or smaller photos.',
      };
    }
    try {
      await setDoc(doc(db, 'events', id), event);
      return { ok: true, data: event };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.CREATE, `events/${id}`),
      };
    }
  }

  async deleteEvent(eventId: string): Promise<ActionResult> {
    if (!db || !this.state.currentUser) return { ok: false, error: 'Sign in required.' };
    try {
      await deleteDoc(doc(db, 'events', eventId));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.DELETE, `events/${eventId}`),
      };
    }
  }

  async rsvpEvent(eventId: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canRsvpEvent) {
      return { ok: false, error: 'Approved membership required to RSVP.' };
    }
    const ev = this.state.events.find((e) => e.id === eventId);
    if (!ev) return { ok: false, error: 'Event not found.' };
    if (ev.capacity && ev.rsvpCount >= ev.capacity) {
      return { ok: false, error: 'This event has reached full capacity.' };
    }
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.set(doc(db, 'events', eventId, 'rsvps', me.uid), {
      userId: me.uid,
      displayName: me.displayName,
      createdAt: now,
    });
    batch.update(doc(db, 'events', eventId), {
      rsvpCount: ev.rsvpCount + 1,
      updatedAt: now,
    });
    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.WRITE, `events/${eventId}/rsvps/${me.uid}`),
      };
    }
  }

  async cancelEventRsvp(eventId: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canRsvpEvent) {
      return { ok: false, error: 'Approved membership required.' };
    }
    const ev = this.state.events.find((e) => e.id === eventId);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events', eventId, 'rsvps', me.uid));
    batch.update(doc(db, 'events', eventId), {
      rsvpCount: Math.max(0, ev.rsvpCount - 1),
      updatedAt: now,
    });
    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.DELETE, `events/${eventId}/rsvps/${me.uid}`),
      };
    }
  }

  async createNotice(input: CreateNoticeInput): Promise<ActionResult<Notice>> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canPostNotice) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const id = `not-${Date.now()}`;
    const now = new Date().toISOString();
    const notice: Notice = stripUndefined({
      id,
      title: input.title.trim(),
      body: input.body.trim(),
      kind: input.kind,
      pinned: input.pinned,
      authorId: me.uid,
      authorDisplayName: me.displayName,
      pollOptions:
        input.kind === 'poll'
          ? (input.pollOptions ?? [])
              .map((l) => l.trim())
              .filter(Boolean)
              .slice(0, 6)
              .map((label, i) => ({ id: `opt-${i}`, label, voteCount: 0 }))
          : undefined,
      totalVotes: 0,
      createdAt: now,
      updatedAt: now,
    });
    try {
      await setDoc(doc(db, 'notices', id), notice);
      return { ok: true, data: notice };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.CREATE, `notices/${id}`),
      };
    }
  }

  async togglePinNotice(noticeId: string): Promise<ActionResult> {
    if (!db || !this.state.currentUser || !getPermissions(this.state.currentUser).canPostNotice) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const notice = this.state.notices.find((n) => n.id === noticeId);
    if (!notice) return { ok: false, error: 'Notice not found.' };
    try {
      await updateDoc(doc(db, 'notices', noticeId), {
        pinned: !notice.pinned,
        updatedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.UPDATE, `notices/${noticeId}`),
      };
    }
  }

  async deleteNotice(noticeId: string): Promise<ActionResult> {
    if (!db || !this.state.currentUser || !getPermissions(this.state.currentUser).canPostNotice) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.DELETE, `notices/${noticeId}`),
      };
    }
  }

  async votePoll(noticeId: string, optionId: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canVotePoll) {
      return { ok: false, error: 'Approved membership required to vote.' };
    }
    const notice = this.state.notices.find((n) => n.id === noticeId && n.kind === 'poll');
    if (!notice || !notice.pollOptions) return { ok: false, error: 'Poll not found.' };

    const votes = this.state.votesByNotice[noticeId] ?? [];
    const prevVote = votes.find((v) => v.userId === me.uid);
    if (prevVote && prevVote.optionId === optionId) return { ok: true };

    const now = new Date().toISOString();
    const nextOptions = notice.pollOptions.map((o) => {
      let voteCount = o.voteCount;
      if (prevVote && o.id === prevVote.optionId) voteCount = Math.max(0, voteCount - 1);
      if (o.id === optionId) voteCount += 1;
      return { ...o, voteCount };
    });

    const batch = writeBatch(db);
    batch.set(doc(db, 'notices', noticeId, 'votes', me.uid), {
      userId: me.uid,
      optionId,
      updatedAt: now,
    });
    batch.update(doc(db, 'notices', noticeId), {
      pollOptions: nextOptions,
      totalVotes: prevVote ? notice.totalVotes : notice.totalVotes + 1,
      updatedAt: now,
    });
    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.WRITE, `notices/${noticeId}/votes/${me.uid}`),
      };
    }
  }

  async updateMemberDirectory(input: {
    targetUid: string;
    accountStatus?: Member['accountStatus'];
    role?: Member['role'];
    rejectionReason?: string;
  }): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canManageDirectory) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    const target = this.state.members.find((m) => m.uid === input.targetUid);
    if (!target) return { ok: false, error: 'Member not found.' };
    if (normalizeEmail(target.email) === BOOTSTRAP_ADMIN_EMAIL) {
      return {
        ok: false,
        error: `The main administrator (${BOOTSTRAP_ADMIN_EMAIL}) cannot be demoted or rejected.`,
      };
    }
    const now = new Date().toISOString();
    const nextRole = input.role ?? target.role;

    const batch = writeBatch(db);
    batch.update(
      doc(db, 'members', input.targetUid),
      stripUndefined({
        accountStatus: input.accountStatus ?? target.accountStatus,
        role: nextRole,
        rejectionReason:
          input.accountStatus === 'rejected'
            ? input.rejectionReason?.trim() || 'Account did not pass verification.'
            : input.accountStatus === 'approved'
            ? ''
            : target.rejectionReason,
        updatedAt: now,
      })
    );

    if (nextRole === 'moderator') {
      batch.set(doc(db, 'admins', input.targetUid), {
        uid: input.targetUid,
        grantedBy: me.uid,
        createdAt: now,
      });
    } else if (target.role === 'moderator') {
      batch.delete(doc(db, 'admins', input.targetUid));
    }

    try {
      await batch.commit();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.UPDATE, `members/${input.targetUid}`),
      };
    }
  }

  async removeMember(targetUid: string): Promise<ActionResult> {
    const me = this.state.currentUser;
    if (!db || !me || !getPermissions(me).canManageDirectory) {
      return { ok: false, error: 'Moderator privileges required.' };
    }
    if (targetUid === me.uid) {
      return { ok: false, error: 'You cannot remove your own account.' };
    }
    const target = this.state.members.find((m) => m.uid === targetUid);
    if (target && normalizeEmail(target.email) === BOOTSTRAP_ADMIN_EMAIL) {
      return {
        ok: false,
        error: `The main administrator (${BOOTSTRAP_ADMIN_EMAIL}) cannot be removed.`,
      };
    }
    try {
      await deleteDoc(doc(db, 'members', targetUid));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: reportFirestoreError(err, OperationType.DELETE, `members/${targetUid}`),
      };
    }
  }

  exportBackup(): AppBackupSnapshot | null {
    const me = this.state.currentUser;
    if (!me) return null;
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      platform: BRAND_CONFIG.name,
      member: me,
      authoredPetitions: this.state.petitions.filter((p) => p.authorId === me.uid),
      signedPetitionIds: Object.entries(this.state.signaturesByPetition)
        .filter(([, sigs]) => sigs.some((s) => s.userId === me.uid))
        .map(([pid]) => pid),
      comments: Object.values(this.state.activityByPetition)
        .flat()
        .filter((a) => a.authorId === me.uid),
    };
  }

  async restoreBackup(snapshot: AppBackupSnapshot): Promise<ActionResult> {
    if (!this.state.currentUser) return { ok: false, error: 'Sign in required.' };
    return this.updateProfile({
      studentName: snapshot.member.studentName,
      studentClass: snapshot.member.studentClass,
      grade: snapshot.member.grade,
      dateOfBirth: snapshot.member.dateOfBirth,
      displayName: snapshot.member.displayName,
      affiliation: snapshot.member.affiliation,
      bio: snapshot.member.bio,
      avatarId: snapshot.member.avatarId,
      avatarDataUrl: snapshot.member.avatarDataUrl,
    });
  }

  async clearLocalDeviceCache(): Promise<ActionResult> {
    localStorage.removeItem('kc_council_local_store_v1');
    localStorage.removeItem('kc_council_local_session_uid_v1');
    return { ok: true };
  }
}
