import React, { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, RotateCcw, Save, Upload } from 'lucide-react';
import { ClassSelector } from '@/src/components/ui/ClassSelector';
import { MemberAvatar } from '@/src/components/ui/CivicGraphics';
import { ConfirmDialog } from '@/src/components/ui/Primitives';
import { KC_GRADES, PRESET_AVATARS } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import type { AppBackupSnapshot } from '@/src/types/civic';
import { downloadTextFile, validateBackupSnapshot } from '@/src/utils/export';
import { compressAvatarFile } from '@/src/utils/media';
import { formatRoleLabel, isPrimaryAdmin } from '@/src/utils/permissions';

interface ProfileDraftCache {
  studentName: string;
  studentClass: string;
  grade: string;
  dateOfBirth: string;
  displayName: string;
  affiliation: string;
  bio: string;
  avatarId: string;
  avatarDataUrl: string;
}

function getProfileDraftKey(uid: string): string {
  return `kc_profile_draft_v1_${uid}`;
}

function readProfileDraft(uid?: string): ProfileDraftCache | null {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(getProfileDraftKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileDraftCache;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function writeProfileDraft(uid: string, draft: ProfileDraftCache): void {
  try {
    sessionStorage.setItem(getProfileDraftKey(uid), JSON.stringify(draft));
  } catch {
    try {
      sessionStorage.setItem(
        getProfileDraftKey(uid),
        JSON.stringify({ ...draft, avatarDataUrl: '' })
      );
    } catch {
      // Ignore storage quota errors
    }
  }
}

function clearProfileDraft(uid?: string): void {
  if (!uid) return;
  try {
    sessionStorage.removeItem(getProfileDraftKey(uid));
  } catch {
    // Ignore
  }
}

export const ProfileView: React.FC = () => {
  const { snapshot, repo, navigate, pushToast } = useCivic();
  const me = snapshot.currentUser;
  const cachedDraft = readProfileDraft(me?.uid);

  const [studentName, setStudentName] = useState(cachedDraft?.studentName ?? me?.studentName ?? '');
  const [studentClass, setStudentClass] = useState(cachedDraft?.studentClass ?? me?.studentClass ?? '');
  const [grade, setGrade] = useState(cachedDraft?.grade || me?.grade || KC_GRADES[0]);
  const [dateOfBirth, setDateOfBirth] = useState(cachedDraft?.dateOfBirth ?? me?.dateOfBirth ?? '');
  const [displayName, setDisplayName] = useState(cachedDraft?.displayName ?? me?.displayName ?? '');
  const [affiliation, setAffiliation] = useState(cachedDraft?.affiliation ?? me?.affiliation ?? '');
  const [bio, setBio] = useState(cachedDraft?.bio ?? me?.bio ?? '');
  const [avatarId, setAvatarId] = useState(cachedDraft?.avatarId ?? me?.avatarId ?? PRESET_AVATARS[0].id);
  const [avatarDataUrl, setAvatarDataUrl] = useState(cachedDraft?.avatarDataUrl ?? me?.avatarDataUrl ?? '');
  const [isDirty, setIsDirty] = useState(Boolean(cachedDraft));
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formError, setFormError] = useState('');
  const [restoreCandidate, setRestoreCandidate] = useState<AppBackupSnapshot | null>(null);
  const [restoreError, setRestoreError] = useState('');

  const hydratedUidRef = useRef<string | null>(me?.uid ?? null);
  const lastSyncedUpdatedAtRef = useRef<string | null>(me?.updatedAt ?? null);

  const hydrateFromMember = (member: NonNullable<typeof me>) => {
    clearProfileDraft(member.uid);
    setStudentName(member.studentName ?? '');
    setStudentClass(member.studentClass ?? '');
    setGrade(member.grade || KC_GRADES[0]);
    setDateOfBirth(member.dateOfBirth ?? '');
    setDisplayName(member.displayName ?? '');
    setAffiliation(member.affiliation ?? '');
    setBio(member.bio ?? '');
    setAvatarId(member.avatarId ?? PRESET_AVATARS[0].id);
    setAvatarDataUrl(member.avatarDataUrl ?? '');
    setFormError('');
    setIsDirty(false);
    hydratedUidRef.current = member.uid;
    lastSyncedUpdatedAtRef.current = member.updatedAt ?? null;
  };

  // Only hydrate when switching accounts or when clean and the profile genuinely updated externally
  useEffect(() => {
    if (!me) {
      hydratedUidRef.current = null;
      lastSyncedUpdatedAtRef.current = null;
      setIsDirty(false);
      return;
    }
    if (hydratedUidRef.current !== me.uid) {
      const draft = readProfileDraft(me.uid);
      if (draft) {
        hydratedUidRef.current = me.uid;
        lastSyncedUpdatedAtRef.current = me.updatedAt ?? null;
        setStudentName(draft.studentName);
        setStudentClass(draft.studentClass);
        setGrade(draft.grade || KC_GRADES[0]);
        setDateOfBirth(draft.dateOfBirth);
        setDisplayName(draft.displayName);
        setAffiliation(draft.affiliation);
        setBio(draft.bio);
        setAvatarId(draft.avatarId || PRESET_AVATARS[0].id);
        setAvatarDataUrl(draft.avatarDataUrl || '');
        setIsDirty(true);
        return;
      }
      hydrateFromMember(me);
      return;
    }
    if (!isDirty && me.updatedAt !== lastSyncedUpdatedAtRef.current) {
      hydrateFromMember(me);
    }
  }, [me, isDirty]);

  // Persist dirty profile edits across navigation so unsaved changes are never lost
  useEffect(() => {
    if (!me || !isDirty) return;
    writeProfileDraft(me.uid, {
      studentName,
      studentClass,
      grade,
      dateOfBirth,
      displayName,
      affiliation,
      bio,
      avatarId,
      avatarDataUrl,
    });
  }, [me, isDirty, studentName, studentClass, grade, dateOfBirth, displayName, affiliation, bio, avatarId, avatarDataUrl]);

  if (!me) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Sign in to manage your student profile
        </h1>
        <button
          type="button"
          onClick={() => navigate({ view: 'auth' })}
          className="min-h-[44px] rounded-lg bg-[#5B1586] hover:bg-[#460E69] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await compressAvatarFile(file);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setAvatarDataUrl(res.dataUrl);
      setIsDirty(true);
      pushToast({ tone: 'success', title: 'Avatar ready — click Save student profile to keep it' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    if (studentName.trim().length < 2) {
      setFormError("Please enter the student's full name.");
      return;
    }
    if (studentClass.trim().length < 1 || !grade || !dateOfBirth) {
      setFormError('Please provide your Grade, Class / Form, and Date of Birth.');
      return;
    }
    setBusy(true);
    try {
      const res = await repo.updateProfile({
        studentName: studentName.trim(),
        studentClass: studentClass.trim(),
        grade,
        dateOfBirth,
        displayName: displayName.trim() || studentName.trim(),
        affiliation,
        bio,
        avatarId,
        avatarDataUrl,
      });
      if (res.ok) {
        clearProfileDraft(me.uid);
        setIsDirty(false);
        pushToast({ tone: 'success', title: 'Student profile updated' });
      } else {
        setFormError(res.error || 'Could not update profile.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = () => {
    const data = repo.exportBackup();
    if (!data) return;
    downloadTextFile(
      `kc-council-backup-${me.uid}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json'
    );
    pushToast({
      tone: 'success',
      title: 'Personal JSON backup downloaded',
      description: 'Includes your student profile, authored petitions, endorsements, and comments.',
    });
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const valid = validateBackupSnapshot(parsed);
      if (!valid.ok) {
        setRestoreError(valid.error);
        return;
      }
      setRestoreCandidate(valid.snapshot);
    } catch {
      setRestoreError('Selected file could not be read as valid JSON.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreCandidate) return;
    try {
      const res = await repo.restoreBackup(restoreCandidate);
      setRestoreCandidate(null);
      if (res.ok) {
        setStudentName(restoreCandidate.member.studentName ?? '');
        setStudentClass(restoreCandidate.member.studentClass ?? '');
        setGrade(restoreCandidate.member.grade || KC_GRADES[0]);
        setDateOfBirth(restoreCandidate.member.dateOfBirth ?? '');
        setDisplayName(restoreCandidate.member.displayName);
        setAffiliation(restoreCandidate.member.affiliation ?? '');
        setBio(restoreCandidate.member.bio ?? '');
        setAvatarId(restoreCandidate.member.avatarId ?? PRESET_AVATARS[0].id);
        setAvatarDataUrl(restoreCandidate.member.avatarDataUrl ?? '');
        setIsDirty(false);
        pushToast({
          tone: 'success',
          title: 'Backup restored',
          description: 'Your student profile details and authored drafts have been restored.',
        });
      } else {
        pushToast({ tone: 'error', title: 'Restore failed', description: res.error });
      }
    } catch (err) {
      setRestoreCandidate(null);
      pushToast({
        tone: 'error',
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Unexpected error restoring backup.',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Student Profile &amp; Personal Data
        </h1>
        <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          {formatRoleLabel(me.role, isPrimaryAdmin(me))} · Account status:{' '}
          <strong className="capitalize">{me.accountStatus}</strong>
        </p>
      </div>

      {/* Profile Editor */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-5"
      >
        <div className="flex flex-wrap items-center gap-4">
          <MemberAvatar
            displayName={displayName || me.displayName}
            avatarId={avatarId}
            avatarDataUrl={avatarDataUrl}
            size="lg"
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
              Choose a Kingston College preset or upload a photo
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setAvatarId(preset.id);
                    setAvatarDataUrl('');
                    setIsDirty(true);
                  }}
                  aria-label={`Select ${preset.label} preset avatar`}
                  aria-pressed={!avatarDataUrl && avatarId === preset.id}
                  className={`h-9 w-9 rounded-lg border-2 transition-transform ${
                    !avatarDataUrl && avatarId === preset.id
                      ? 'border-[#5B1586] dark:border-[#C084FC] scale-105'
                      : 'border-black/10 dark:border-white/10'
                  }`}
                  style={{ backgroundColor: preset.bgHex }}
                />
              ))}

              <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]">
                <ImagePlus className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                <span>{uploadingAvatar ? 'Processing photo…' : 'Upload photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-student-name" className="block text-xs font-semibold mb-1">
              Student&apos;s Full Name
            </label>
            <input
              id="prof-student-name"
              type="text"
              required
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Dante Williams"
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>

          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold mb-1">
              Display Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Dante W."
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="prof-grade" className="block text-xs font-semibold mb-1">
              Grade
            </label>
            <select
              id="prof-grade"
              required
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setIsDirty(true);
              }}
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
            >
              {KC_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prof-class" className="block text-xs font-semibold mb-1">
              Class / Form
            </label>
            <ClassSelector
              id="prof-class"
              required
              value={studentClass}
              onChange={(nextClass) => {
                setStudentClass(nextClass);
                setIsDirty(true);
              }}
            />
          </div>

          <div>
            <label htmlFor="prof-dob" className="block text-xs font-semibold mb-1">
              D.O.B. (Date of Birth)
            </label>
            <input
              id="prof-dob"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                setIsDirty(true);
              }}
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-email" className="block text-xs font-semibold mb-1">
              Account email (immutable identity)
            </label>
            <input
              id="prof-email"
              type="email"
              value={me.email}
              disabled
              readOnly
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#F2ECF8] dark:bg-[#26173A] px-3.5 py-2 text-[#5B506B] dark:text-[#B7A8CC] cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="prof-affiliation" className="block text-xs font-semibold mb-1">
              House, club, or society affiliation
            </label>
            <input
              id="prof-affiliation"
              type="text"
              value={affiliation}
              onChange={(e) => {
                setAffiliation(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Chapel House · Key Club"
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prof-bio" className="block text-xs font-semibold mb-1">
            Short bio (optional)
          </label>
          <textarea
            id="prof-bio"
            rows={3}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setIsDirty(true);
            }}
            placeholder="School activities, clubs, or student issues you care about…"
            className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || uploadingAvatar}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{busy ? 'Saving…' : 'Save student profile'}</span>
          </button>
          {isDirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => hydrateFromMember(me)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium text-[#5B506B] dark:text-[#B7A8CC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Discard unsaved changes</span>
            </button>
          )}
        </div>
      </form>

      {/* Personal Data Backup & Restore */}
      <section className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Personal data backup &amp; restore
        </h2>
        <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          Download a portable JSON snapshot of your student profile, authored petitions/drafts, endorsements, and comments. Restoring a snapshot overwrites your editable profile fields and matching local drafts—you will be asked to confirm before anything is replaced.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-semibold hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
          >
            <Download className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
            <span>Download JSON backup</span>
          </button>

          <label className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]">
            <Upload className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
            <span>Restore from JSON file</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFileSelected}
              className="sr-only"
            />
          </label>
        </div>

        {restoreError && (
          <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {restoreError}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(restoreCandidate)}
        title="Overwrite profile with backup snapshot?"
        description={`This will replace your current student profile details, bio, avatar, and matching authored drafts with the snapshot exported on ${
          restoreCandidate ? new Date(restoreCandidate.exportedAt).toLocaleString() : ''
        }. Your account email remains unchanged.`}
        confirmLabel="Restore backup"
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setRestoreCandidate(null)}
      />
    </div>
  );
};
