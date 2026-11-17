import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  EyeOff,
  FilePlus2,
  ImagePlus,
  Link2,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { PETITION_CATEGORIES } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import type {
  MediaAttachment,
  Petition,
  PetitionKind,
  PetitionUrgency,
} from '@/src/types/civic';
import { processMediaFile, validateExternalVideoUrl } from '@/src/utils/media';
import { findProbableDuplicates } from '@/src/utils/search';

interface PetitionDraftCache {
  kind: PetitionKind;
  title: string;
  summary: string;
  body: string;
  category: string;
  urgency: PetitionUrgency;
  location: string;
  goalSignaturesInput: string;
  isAnonymous: boolean;
  media: MediaAttachment[];
  updatedAt: number;
}

function getDraftStorageKey(editingPetitionId?: string): string {
  return `kc_petition_draft_v1_${editingPetitionId || 'new'}`;
}

function readSessionDraft(key: string): PetitionDraftCache | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PetitionDraftCache;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionDraft(key: string, draft: PetitionDraftCache): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // If media data URLs exceed sessionStorage quota, preserve all text fields and external links
    try {
      const compact: PetitionDraftCache = {
        ...draft,
        media: draft.media.filter((m) => !m.url.startsWith('data:')),
      };
      sessionStorage.setItem(key, JSON.stringify(compact));
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }
}

function clearSessionDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export const PetitionForm: React.FC<{ editingPetitionId?: string }> = ({
  editingPetitionId,
}) => {
  const { snapshot, repo, permissions, navigate, openPetition, pushToast } = useCivic();
  const existing = editingPetitionId
    ? snapshot.petitions.find((p) => p.id === editingPetitionId)
    : undefined;

  const storageKey = getDraftStorageKey(editingPetitionId);
  const initialDraft = readSessionDraft(storageKey);

  const [kind, setKind] = useState<PetitionKind>(
    initialDraft?.kind ?? existing?.kind ?? 'petition'
  );
  const [title, setTitle] = useState(initialDraft?.title ?? existing?.title ?? '');
  const [summary, setSummary] = useState(initialDraft?.summary ?? existing?.summary ?? '');
  const [body, setBody] = useState(initialDraft?.body ?? existing?.body ?? '');
  const [category, setCategory] = useState(
    initialDraft?.category ?? existing?.category ?? PETITION_CATEGORIES[0]
  );
  const [urgency, setUrgency] = useState<PetitionUrgency>(
    initialDraft?.urgency ?? existing?.urgency ?? 'standard'
  );
  const [location, setLocation] = useState(initialDraft?.location ?? existing?.location ?? '');
  const [goalSignaturesInput, setGoalSignaturesInput] = useState<string>(
    initialDraft?.goalSignaturesInput ?? String(existing?.goalSignatures ?? 200)
  );
  const [isAnonymous, setIsAnonymous] = useState(
    initialDraft?.isAnonymous ?? existing?.isAnonymous ?? false
  );
  const [media, setMedia] = useState<MediaAttachment[]>(
    initialDraft?.media ?? existing?.media ?? []
  );

  const [restoredFromSession, setRestoredFromSession] = useState<boolean>(Boolean(initialDraft));
  const [isDirty, setIsDirty] = useState<boolean>(Boolean(initialDraft));
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [formError, setFormError] = useState('');
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [submittedConfirmationId, setSubmittedConfirmationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const activeKeyRef = useRef<string>(storageKey);
  const hydratedExistingIdRef = useRef<string | undefined>(existing?.id);

  const applyPetitionRecord = (record?: Petition) => {
    setKind(record?.kind ?? 'petition');
    setTitle(record?.title ?? '');
    setSummary(record?.summary ?? '');
    setBody(record?.body ?? '');
    setCategory(record?.category ?? PETITION_CATEGORIES[0]);
    setUrgency(record?.urgency ?? 'standard');
    setLocation(record?.location ?? '');
    setGoalSignaturesInput(String(record?.goalSignatures ?? 200));
    setIsAnonymous(record?.isAnonymous ?? false);
    setMedia(record?.media ?? []);
    setFormError('');
    setMediaError('');
    setDuplicateAcknowledged(false);
    setRestoredFromSession(false);
    setIsDirty(false);
  };

  // Sync when switching between "new" and an edited petition, or when existing loads asynchronously
  useEffect(() => {
    if (activeKeyRef.current !== storageKey) {
      activeKeyRef.current = storageKey;
      setSubmittedConfirmationId(null);
      const cached = readSessionDraft(storageKey);
      if (cached) {
        setKind(cached.kind);
        setTitle(cached.title);
        setSummary(cached.summary);
        setBody(cached.body);
        setCategory(cached.category);
        setUrgency(cached.urgency);
        setLocation(cached.location);
        setGoalSignaturesInput(cached.goalSignaturesInput);
        setIsAnonymous(cached.isAnonymous);
        setMedia(cached.media);
        setRestoredFromSession(true);
        setIsDirty(true);
        hydratedExistingIdRef.current = existing?.id;
        return;
      }
      hydratedExistingIdRef.current = existing?.id;
      applyPetitionRecord(existing);
      return;
    }

    if (
      editingPetitionId &&
      existing &&
      hydratedExistingIdRef.current !== existing.id &&
      !isDirty
    ) {
      hydratedExistingIdRef.current = existing.id;
      applyPetitionRecord(existing);
    }
  }, [editingPetitionId, existing, isDirty, storageKey]);

  // Auto-save in-progress edits to sessionStorage so progress is never lost
  useEffect(() => {
    if (!isDirty || submittedConfirmationId) return;
    writeSessionDraft(storageKey, {
      kind,
      title,
      summary,
      body,
      category,
      urgency,
      location,
      goalSignaturesInput,
      isAnonymous,
      media,
      updatedAt: Date.now(),
    });
  }, [
    body,
    category,
    goalSignaturesInput,
    isAnonymous,
    isDirty,
    kind,
    location,
    media,
    storageKey,
    submittedConfirmationId,
    summary,
    title,
    urgency,
  ]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleDiscardSessionDraft = () => {
    clearSessionDraft(storageKey);
    applyPetitionRecord(existing);
    pushToast({ tone: 'info', title: existing ? 'Reverted to saved petition' : 'Cleared unsaved draft' });
  };

  const probableDuplicates = useMemo(
    () => findProbableDuplicates(title, summary, snapshot.petitions, existing?.id),
    [existing?.id, snapshot.petitions, summary, title]
  );

  if (!permissions.canCreatePetition) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Verified student membership required
        </h1>
        <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          Please sign in with an approved Kingston College student account before drafting or submitting a petition.
        </p>
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

  if (submittedConfirmationId) {
    const saved = snapshot.petitions.find((p) => p.id === submittedConfirmationId);
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#0F766E]/40 p-8 space-y-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-7 h-7 text-[#0F766E] dark:text-[#2DD4BF] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              {saved?.status === 'live'
                ? 'Petition published to the campus feed'
                : 'Petition submitted for Council review'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
              {saved?.status === 'live'
                ? `Reference ${saved.referenceNumber} is now open for student signatures.`
                : `Reference ${saved?.referenceNumber ?? ''} is now with the Students' Council review panel. It remains private until approved for the campus feed.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openPetition(submittedConfirmationId)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
          >
            <span>View submission</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navigate({ view: 'drafts' })}
            className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
          >
            Go to My Drafts &amp; Submissions
          </button>
        </div>
      </div>
    );
  }

  const handleMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (media.length >= 4) {
      setMediaError('Maximum 4 supporting media items per petition.');
      return;
    }
    setUploadingMedia(true);
    try {
      const res = await processMediaFile(file);
      if (!res.ok) {
        setMediaError(res.error);
        return;
      }
      setMedia((prev) => [...prev, res.attachment]);
      markDirty();
      pushToast({ tone: 'success', title: 'Media attached & compressed' });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAddVideoLink = () => {
    setMediaError('');
    const valid = validateExternalVideoUrl(videoLinkInput);
    if (!valid.ok) {
      setMediaError(valid.error);
      return;
    }
    if (media.length >= 4) {
      setMediaError('Maximum 4 supporting media items per petition.');
      return;
    }
    setMedia((prev) => [
      ...prev,
      {
        id: `vlink-${Date.now()}`,
        type: 'video_link',
        url: valid.url,
        caption: 'External hosted supporting video',
      },
    ]);
    markDirty();
    setVideoLinkInput('');
  };

  const handleSave = async (submitForReview: boolean) => {
    if (busy) return;
    setFormError('');
    if (title.trim().length < 5) {
      setFormError('Please provide a clear title of at least 5 characters.');
      return;
    }
    if (summary.trim().length < 5) {
      setFormError('Please enter a concise one-line summary.');
      return;
    }
    if (location.trim().length < 2) {
      setFormError('Please specify the campus location, building, or form group.');
      return;
    }
    if (body.trim().length < 15) {
      setFormError('Please explain the issue and the specific action requested (at least 15 characters).');
      return;
    }

    const parsedGoal = Math.round(Number(goalSignaturesInput) || 0);
    if (parsedGoal < 10 || parsedGoal > 1000000) {
      setFormError('Signature goal must be between 10 and 1,000,000.');
      return;
    }

    if (submitForReview && probableDuplicates.length > 0 && !duplicateAcknowledged) {
      setFormError(
        'A similar active petition was found below. Support the existing campaign or confirm you wish to continue submitting a distinct petition.'
      );
      return;
    }

    setBusy(true);
    try {
      const res = await repo.savePetition({
        id: existing?.id,
        kind,
        title,
        summary,
        body,
        category,
        urgency,
        location,
        goalSignatures: parsedGoal,
        isAnonymous,
        media,
        submitForReview,
      });

      if (!res.ok || !res.data) {
        setFormError(res.error || 'Could not save petition.');
        return;
      }

      clearSessionDraft(storageKey);
      setIsDirty(false);
      setRestoredFromSession(false);

      if (res.warning) {
        pushToast({ tone: 'info', title: 'Storage notice', description: res.warning });
      }

      if (submitForReview) {
        pushToast({
          tone: 'success',
          title:
            res.data.status === 'live'
              ? 'Petition published'
              : 'Submitted for Council review',
        });
        setSubmittedConfirmationId(res.data.id);
      } else {
        pushToast({ tone: 'success', title: 'Draft saved privately' });
        navigate({ view: 'drafts' });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save petition.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate({ view: existing ? 'drafts' : 'feed' })}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] px-3.5 py-2 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back</span>
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          {existing ? `Edit ${existing.referenceNumber}` : 'Start a student petition or initiative'}
        </h1>
      </div>

      {(restoredFromSession || isDirty) && (
        <div className="rounded-xl border border-[#DFD1EE] dark:border-[#372352] bg-[#FAF6FE] dark:bg-[#26173A] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#2B0B42] dark:text-[#E7DFF2]">
          <span>
            {restoredFromSession
              ? 'Unsaved edits restored from this session.'
              : 'In-progress edits are auto-saved in this session while you work.'}
          </span>
          <button
            type="button"
            onClick={handleDiscardSessionDraft}
            className="inline-flex items-center gap-1.5 font-semibold text-[#5B1586] dark:text-[#C084FC] hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{existing ? 'Revert changes' : 'Clear draft'}</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave(true);
          }}
          className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-5"
        >
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setKind('petition');
                markDirty();
              }}
              className={`min-h-[48px] rounded-xl border p-3 text-left transition-colors ${
                kind === 'petition'
                  ? 'border-[#5B1586] bg-[#5B1586]/10 text-[#2B0B42] dark:border-[#C084FC] dark:bg-[#7E22CE]/25 dark:text-[#F7F3FC]'
                  : 'border-[#E2D9EC] dark:border-[#372352] text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <p className="text-sm font-semibold">Formal Petition</p>
              <p className="text-xs">Request Council or Administration action (PET)</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setKind('campaign');
                markDirty();
              }}
              className={`min-h-[48px] rounded-xl border p-3 text-left transition-colors ${
                kind === 'campaign'
                  ? 'border-[#5B1586] bg-[#5B1586]/10 text-[#2B0B42] dark:border-[#C084FC] dark:bg-[#7E22CE]/25 dark:text-[#F7F3FC]'
                  : 'border-[#E2D9EC] dark:border-[#372352] text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <p className="text-sm font-semibold">School Initiative</p>
              <p className="text-xs">Organize a shared student project (CMP)</p>
            </button>
          </div>

          <div>
            <label
              htmlFor="pet-title"
              className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
            >
              Petition title
            </label>
            <input
              id="pet-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDuplicateAcknowledged(false);
                markDirty();
              }}
              placeholder="State the specific improvement you want on campus"
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="pet-summary"
              className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
            >
              One-line summary
            </label>
            <input
              id="pet-summary"
              type="text"
              required
              maxLength={260}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setDuplicateAcknowledged(false);
                markDirty();
              }}
              placeholder="A brief sentence shown on the campus feed card"
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>

          {/* Duplicate Check Alert */}
          {probableDuplicates.length > 0 && (
            <div
              role="region"
              aria-label="Possible existing petitions"
              className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/35 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                    Similar active petition found
                  </p>
                  <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    Joining an existing campaign avoids splitting student signatures. Check if one of these covers your goal:
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {probableDuplicates.map(({ petition: dup, overlappingKeywords }) => (
                  <li
                    key={dup.id}
                    className="rounded-lg bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-[#5B506B] dark:text-[#B7A8CC]">
                        {dup.referenceNumber} · matched keywords: {overlappingKeywords.join(', ')}
                      </p>
                      <p className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] truncate">
                        {dup.title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPetition(dup.id)}
                      className="min-h-[40px] rounded-lg bg-[#5B1586] px-3 py-1.5 text-xs font-semibold text-white shrink-0"
                    >
                      Support existing
                    </button>
                  </li>
                ))}
              </ul>

              <label className="flex items-center gap-2.5 text-xs font-medium text-[#2B0B42] dark:text-[#F7F3FC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={duplicateAcknowledged}
                  onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#5B1586]"
                />
                <span>My proposal addresses a distinct issue — proceed with submission</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pet-category"
                className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
              >
                Category
              </label>
              <select
                id="pet-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  markDirty();
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              >
                {PETITION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pet-urgency"
                className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
              >
                Response urgency window
              </label>
              <select
                id="pet-urgency"
                value={urgency}
                onChange={(e) => {
                  setUrgency(e.target.value as PetitionUrgency);
                  markDirty();
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              >
                <option value="urgent">Urgent (24h response target)</option>
                <option value="standard">Standard (48h response target)</option>
                <option value="low">Low (72h response target)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pet-location"
                className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
              >
                Campus location or scope
              </label>
              <input
                id="pet-location"
                type="text"
                required
                maxLength={120}
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. North Street Main Quad or Melbourne Campus"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="pet-goal"
                className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
              >
                Signature goal
              </label>
              <input
                id="pet-goal"
                type="number"
                min={10}
                max={1000000}
                required
                value={goalSignaturesInput}
                onChange={(e) => {
                  setGoalSignaturesInput(e.target.value);
                  markDirty();
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pet-body"
              className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1"
            >
              Full statement &amp; proposed solution
            </label>
            <textarea
              id="pet-body"
              rows={7}
              required
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                markDirty();
              }}
              placeholder="Describe what is happening on campus, which students are affected, and the concrete steps you want the Council or Administration to take…"
              className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3.5 text-sm leading-relaxed"
            />
          </div>

          {/* Media Upload + External Video Fallback */}
          <div className="space-y-3 pt-2 border-t border-[#E2D9EC] dark:border-[#372352]">
            <p className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
              Supporting photos or short video (optional)
            </p>
            <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
              Images (JPEG, PNG, WebP) are compressed automatically. Direct MP4/WebM clips work up to 500 KB, or paste any external hosted video link below.
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              <label className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3.5 py-2 text-xs font-semibold cursor-pointer hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]">
                <ImagePlus className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                <span>{uploadingMedia ? 'Processing media…' : 'Upload photo or video'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                  disabled={uploadingMedia}
                  onChange={handleMediaFile}
                  className="sr-only"
                />
              </label>

              <div className="flex-1 min-w-[220px] flex gap-2">
                <input
                  type="url"
                  value={videoLinkInput}
                  onChange={(e) => setVideoLinkInput(e.target.value)}
                  placeholder="Or paste external video link (https://...)"
                  aria-label="External hosted video URL"
                  className="flex-1 min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddVideoLink}
                  className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 text-xs font-semibold"
                >
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add link</span>
                </button>
              </div>
            </div>

            {mediaError && (
              <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                {mediaError}
              </p>
            )}

            {media.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#E2D9EC] dark:border-[#372352] p-2.5 text-xs"
                  >
                    <span className="truncate font-medium">
                      {m.type.toUpperCase()} · {m.caption || 'Attachment'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMedia((prev) => prev.filter((x) => x.id !== m.id));
                        markDirty();
                      }}
                      aria-label="Remove media item"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anonymous Submission Option with Honest Disclosure */}
          <div className="rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] border border-[#E2D9EC] dark:border-[#372352] p-4 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked);
                  markDirty();
                }}
                className="mt-1 h-4 w-4 rounded accent-[#5B1586]"
              />
              <span className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] inline-flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC]" aria-hidden="true" />
                Submit anonymously to the school body
              </span>
            </label>
            <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] pl-7 leading-relaxed">
              <strong>What anonymity means:</strong> Your student name and class/affiliation are never displayed on the public feed. However, your internal student account ID remains recorded for Council moderation and safeguarding.
            </p>
          </div>

          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={busy || uploadingMedia}
              onClick={() => void handleSave(false)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{busy ? 'Saving…' : 'Save as draft'}</span>
            </button>
            <button
              type="submit"
              disabled={busy || uploadingMedia}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white"
            >
              <FilePlus2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {busy
                  ? 'Submitting…'
                  : existing?.status === 'live'
                  ? 'Save changes'
                  : 'Submit for review'}
              </span>
            </button>
          </div>
        </form>

        {/* Guidance Sidebar */}
        <aside className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4">
          <h2 className="text-base font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            What makes a strong KC petition
          </h2>
          <ul className="space-y-3 text-xs leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
            <li>
              <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">Name the decision-maker:</strong>{' '}
              Specify which Council committee, Vice Principal, Sports Department, or School Office can act on the request.
            </li>
            <li>
              <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">Be concrete and measurable:</strong>{' '}
              Requests with clear campus locations, timetable hours, or equipment specs receive faster official responses.
            </li>
            <li>
              <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">Check for duplicates:</strong>{' '}
              Our keyword check runs automatically before submission so Fortis student voices stay unified.
            </li>
            <li>
              <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">Moderation review:</strong>{' '}
              Submissions stay private to you and Council moderators until approved for the campus feed.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
};
