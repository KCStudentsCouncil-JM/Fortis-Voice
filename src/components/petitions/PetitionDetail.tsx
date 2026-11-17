import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  EyeOff,
  FileVideo,
  ImagePlus,
  Link2,
  MapPin,
  MessageSquare,
  PenLine,
  Pin,
  Reply,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  MediaGallery,
  ProgressBar,
  StatusBadge,
  UrgencyIndicator,
} from '@/src/components/ui/Primitives';
import { useCivic } from '@/src/context/CivicContext';
import type {
  ActivityEntry,
  ActivityEntryKind,
  MediaAttachment,
  PetitionStatus,
} from '@/src/types/civic';
import { canEditPetition, canViewPetition } from '@/src/utils/permissions';
import { processMediaFile, validateExternalVideoUrl } from '@/src/utils/media';
import { evaluatePetitionSla } from '@/src/utils/sla';

const TIMELINE_STEPS: Array<{ key: PetitionStatus; label: string }> = [
  { key: 'pending_review', label: 'Under Review' },
  { key: 'live', label: 'Live' },
  { key: 'responded', label: 'Responded' },
  { key: 'achieved', label: 'Achieved' },
];

export const PetitionDetail: React.FC<{ petitionId: string }> = ({ petitionId }) => {
  const {
    snapshot,
    repo,
    permissions,
    navigate,
    toggleSignature,
    hasSignedPetition,
    getDisplaySignatureCount,
    pushToast,
  } = useCivic();

  const petition = snapshot.petitions.find((p) => p.id === petitionId);
  const me = snapshot.currentUser;

  const [signError, setSignError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [entryKind, setEntryKind] = useState<ActivityEntryKind>('comment');
  const [commentMedia, setCommentMedia] = useState<MediaAttachment[]>([]);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [showVideoLinkBox, setShowVideoLinkBox] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [commentError, setCommentError] = useState('');

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const [modNote, setModNote] = useState('');
  const [modNextStatus, setModNextStatus] = useState<PetitionStatus>('responded');
  const [modError, setModError] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [postingEntry, setPostingEntry] = useState(false);
  const [modBusy, setModBusy] = useState(false);

  const activityEntries = snapshot.activityByPetition[petitionId] ?? [];
  const signatures = snapshot.signaturesByPetition[petitionId] ?? [];

  const { topLevelEntries, repliesByParent } = useMemo(() => {
    const replies: Record<string, ActivityEntry[]> = {};
    const top: ActivityEntry[] = [];
    for (const entry of activityEntries) {
      if (entry.parentId) {
        if (!replies[entry.parentId]) replies[entry.parentId] = [];
        replies[entry.parentId].push(entry);
      } else {
        top.push(entry);
      }
    }
    return { topLevelEntries: top, repliesByParent: replies };
  }, [activityEntries]);

  if (!petition || !canViewPetition(petition, me)) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Petition unavailable
        </h1>
        <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          This record may be an unpublished draft, awaiting review, or removed.
        </p>
        <button
          type="button"
          onClick={() => navigate({ view: 'feed' })}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Return to public feed</span>
        </button>
      </div>
    );
  }

  const displayCount = getDisplaySignatureCount(petition.id, petition.signatureCount);
  const signedByMe = hasSignedPetition(petition.id);
  const sla = evaluatePetitionSla(petition);
  const isSignable = petition.status === 'live' || petition.status === 'responded';
  const editable = canEditPetition(petition, me);

  const handleSignToggle = async () => {
    setSignError('');
    if (!me) {
      setSignError('Sign in or register as a verified KC student to add your signature.');
      return;
    }
    if (!permissions.canSign) {
      setSignError(
        me.accountStatus === 'pending'
          ? 'Your student account is awaiting Council verification. Signing unlocks as soon as your profile is approved.'
          : 'Your account cannot sign petitions while restricted.'
      );
      return;
    }
    const res = await toggleSignature(petition.id);
    if (!res.ok && res.error) {
      setSignError(res.error);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=petition&id=${encodeURIComponent(petition.id)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      pushToast({
        tone: 'success',
        title: 'Deep link copied',
        description: `Shareable link for ${petition.referenceNumber} copied to clipboard.`,
      });
    } catch {
      pushToast({
        tone: 'info',
        title: 'Copy link from address bar',
        description: shareUrl,
      });
    }
  };

  const handleThreadMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (commentMedia.length >= 3) {
      setMediaError('You can attach up to 3 media items per update.');
      return;
    }
    setUploadingMedia(true);
    try {
      const res = await processMediaFile(file);
      if (!res.ok) {
        setMediaError(res.error);
        return;
      }
      setCommentMedia((prev) => [...prev, res.attachment]);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAddExternalVideo = () => {
    setMediaError('');
    const valid = validateExternalVideoUrl(videoLinkInput);
    if (!valid.ok) {
      setMediaError(valid.error);
      return;
    }
    setCommentMedia((prev) => [
      ...prev,
      {
        id: `vid-${Date.now()}`,
        type: 'video_link',
        url: valid.url,
        caption: 'External hosted campaign video',
      },
    ]);
    setVideoLinkInput('');
    setShowVideoLinkBox(false);
  };

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (postingEntry) return;
    setCommentError('');
    if (!commentBody.trim()) {
      setCommentError('Please enter a message before posting.');
      return;
    }
    setPostingEntry(true);
    try {
      const res = await repo.addActivityEntry({
        petitionId: petition.id,
        kind: entryKind,
        body: commentBody,
        media: commentMedia,
      });
      if (!res.ok) {
        setCommentError(res.error || 'Could not post entry.');
        return;
      }
      const submittedKind = entryKind;
      setCommentBody('');
      setCommentMedia([]);
      setEntryKind('comment');
      pushToast({
        tone: 'success',
        title:
          submittedKind === 'official_response'
            ? 'Official response recorded'
            : submittedKind === 'organiser_update'
            ? 'Campaign update posted'
            : 'Comment posted',
      });
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Could not post entry.');
    } finally {
      setPostingEntry(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyBody.trim() || postingEntry) return;
    setPostingEntry(true);
    try {
      const res = await repo.addActivityEntry({
        petitionId: petition.id,
        parentId,
        kind: 'reply',
        body: replyBody,
      });
      if (res.ok) {
        setReplyingToId(null);
        setReplyBody('');
        pushToast({ tone: 'success', title: 'Reply added' });
      } else {
        pushToast({ tone: 'error', title: 'Could not post reply', description: res.error });
      }
    } finally {
      setPostingEntry(false);
    }
  };

  const handleModDecision = async (decision: 'approve' | 'decline') => {
    if (modBusy) return;
    setModError('');
    setModBusy(true);
    try {
      const res = await repo.moderatePetitionDecision({
        petitionId: petition.id,
        decision,
        reason: modNote,
      });
      if (!res.ok) {
        setModError(res.error || 'Moderation action failed.');
        return;
      }
      setModNote('');
      pushToast({
        tone: 'success',
        title: decision === 'approve' ? 'Petition approved & published' : 'Petition declined',
      });
    } finally {
      setModBusy(false);
    }
  };

  const handleModStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modBusy) return;
    setModError('');
    setModBusy(true);
    try {
      const res = await repo.updatePetitionStatus({
        petitionId: petition.id,
        status: modNextStatus,
        note: modNote,
      });
      if (!res.ok) {
        setModError(res.error || 'Status update failed.');
        return;
      }
      setModNote('');
      pushToast({
        tone: 'success',
        title: 'Status updated on the public record',
      });
    } finally {
      setModBusy(false);
    }
  };

  const currentTimelineIndex =
    petition.status === 'achieved'
      ? 3
      : petition.status === 'responded'
      ? 2
      : petition.status === 'live'
      ? 1
      : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top breadcrumb & actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate({ view: 'feed' })}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] px-3.5 py-2 text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to petitions</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button
              type="button"
              onClick={() => navigate({ view: 'create', editingPetitionId: petition.id })}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] px-3.5 py-2 text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              <span>Edit petition</span>
            </button>
          )}
          {permissions.canModerate && (
            <button
              type="button"
              onClick={() =>
                void repo.togglePinPetition(petition.id).then((res) => {
                  if (res.ok) {
                    pushToast({
                      tone: 'success',
                      title: petition.pinned ? 'Unpinned from feed top' : 'Pinned to feed top',
                    });
                  }
                })
              }
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] px-3.5 py-2 text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              <Pin className="w-4 h-4" aria-hidden="true" />
              <span>{petition.pinned ? 'Unpin' : 'Pin to top'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] px-3.5 py-2 text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span>Share link</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Petition Statement & Thread */}
        <div className="lg:col-span-8 space-y-6">
          <article className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-5">
            {/* Metadata & Status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                <span className="font-mono font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                  {petition.referenceNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>{petition.category}</span>
                <span aria-hidden="true">·</span>
                <span>{petition.kind === 'campaign' ? 'School Initiative' : 'Petition'}</span>
              </div>
              <StatusBadge status={petition.status} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B0B42] dark:text-[#F7F3FC] [text-wrap:balance]">
              {petition.title}
            </h1>

            <p className="text-base font-medium text-[#5B506B] dark:text-[#E7DFF2]">
              {petition.summary}
            </p>

            {/* Author & Scope Metadata */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 border-y border-[#E2D9EC] dark:border-[#372352] text-xs sm:text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              <span className="inline-flex items-center gap-1.5">
                {petition.isAnonymous ? (
                  <>
                    <EyeOff className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC]" aria-hidden="true" />
                    <span>Started by Anonymous student</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
                    <span>
                      Started by <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">{petition.authorDisplayName}</strong>
                      {petition.authorAffiliation ? ` · ${petition.authorAffiliation}` : ''}
                    </span>
                  </>
                )}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{petition.location}</span>
              </span>

              <UrgencyIndicator urgency={petition.urgency} />
            </div>

            {petition.isAnonymous && permissions.canModerate && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-950 dark:text-amber-200">
                <strong>Moderator internal record:</strong> Author identity is protected publicly as <em>Anonymous student</em> (internal member ID: <code className="font-mono">{petition.authorId}</code>).
              </div>
            )}

            {petition.status === 'declined' && petition.moderationReason && (
              <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-900 dark:text-rose-200">
                <p className="font-semibold">Declined during review</p>
                <p className="mt-1">{petition.moderationReason}</p>
              </div>
            )}

            {/* Compact Status Timeline */}
            <div aria-label="Petition lifecycle timeline" className="pt-1">
              <div className="grid grid-cols-4 gap-2">
                {TIMELINE_STEPS.map((step, idx) => {
                  const completed =
                    petition.status !== 'declined' &&
                    petition.status !== 'draft' &&
                    idx <= currentTimelineIndex;
                  const current =
                    petition.status === step.key ||
                    (petition.status === 'closed' && step.key === 'responded');
                  return (
                    <div
                      key={step.key}
                      className={`rounded-lg border px-2.5 py-2 text-xs ${
                        current
                          ? 'border-[#5B1586] bg-[#5B1586]/10 text-[#2B0B42] dark:border-[#C084FC] dark:bg-[#7E22CE]/25 dark:text-[#F7F3FC] font-semibold'
                          : completed
                          ? 'border-[#0F766E]/40 bg-teal-50/60 dark:bg-teal-950/30 text-[#0F766E] dark:text-[#2DD4BF] font-medium'
                          : 'border-[#E2D9EC] dark:border-[#372352] text-[#5B506B] dark:text-[#B7A8CC]'
                      }`}
                    >
                      <span className="block truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Long-Form Statement */}
            <div className="prose-civic max-w-[70ch] text-[15px] sm:text-base leading-[1.7] text-[#261D33] dark:text-[#E7DFF2] whitespace-pre-line">
              {petition.body}
            </div>

            {/* Supporting Media */}
            {petition.media && petition.media.length > 0 && (
              <div className="pt-2">
                <MediaGallery media={petition.media} />
              </div>
            )}
          </article>

          {/* Activity Thread */}
          <section
            aria-label="Chronological petition activity thread"
            className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                Public record &amp; discussion
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]">
                {activityEntries.length} {activityEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {topLevelEntries.length === 0 ? (
              <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC]">
                No updates or comments yet. Verified students can add the first perspective below.
              </p>
            ) : (
              <ol className="space-y-4">
                {topLevelEntries.map((entry) => {
                  const isOfficial = entry.kind === 'official_response';
                  const isMod = entry.kind === 'moderator_decision' || entry.kind === 'status_change';
                  const isOrganiser = entry.kind === 'organiser_update';
                  const childReplies = repliesByParent[entry.id] ?? [];

                  return (
                    <li
                      key={entry.id}
                      className={`rounded-xl border p-4 space-y-2.5 ${
                        isOfficial
                          ? 'border-[#0F766E]/45 bg-teal-50/60 dark:bg-teal-950/25'
                          : isMod
                          ? 'border-amber-300 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/20'
                          : isOrganiser
                          ? 'border-[#5B1586]/35 bg-[#5B1586]/5 dark:bg-[#7E22CE]/15'
                          : 'border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC]/80 dark:bg-[#120A1C]/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                            {entry.authorDisplayName}
                          </span>
                          {(isOfficial || isMod || isOrganiser || entry.authorRoleBadge) && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${
                                isOfficial
                                  ? 'bg-[#0F766E] text-white'
                                  : isMod
                                  ? 'bg-[#2B0B42] text-white dark:bg-amber-700'
                                  : isOrganiser
                                  ? 'bg-[#5B1586] text-white dark:bg-[#7E22CE]'
                                  : 'bg-[#F2ECF8] dark:bg-[#26173A] text-[#5B506B] dark:text-[#B7A8CC]'
                              }`}
                            >
                              {isOfficial && <ShieldCheck className="w-3 h-3" aria-hidden="true" />}
                              {isMod && <Shield className="w-3 h-3" aria-hidden="true" />}
                              <span>
                                {isOfficial
                                  ? 'Official response'
                                  : isMod
                                  ? 'Council Moderator'
                                  : isOrganiser
                                  ? 'Organiser update'
                                  : entry.authorRoleBadge}
                              </span>
                            </span>
                          )}
                          {entry.triggeredStatus && (
                            <span className="text-[#5B506B] dark:text-[#B7A8CC]">
                              · Status → <strong>{entry.triggeredStatus.replace('_', ' ')}</strong>
                            </span>
                          )}
                        </div>
                        <time
                          dateTime={entry.createdAt}
                          className="font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]"
                        >
                          {new Date(entry.createdAt).toLocaleString()}
                        </time>
                      </div>

                      <p className="text-sm leading-relaxed text-[#261D33] dark:text-[#E7DFF2] whitespace-pre-line">
                        {entry.body}
                      </p>

                      {entry.media && entry.media.length > 0 && (
                        <MediaGallery media={entry.media} compact />
                      )}

                      {permissions.canComment && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToId(replyingToId === entry.id ? null : entry.id);
                              setReplyBody('');
                            }}
                            className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B506B] hover:text-[#2B0B42] dark:text-[#B7A8CC] dark:hover:text-white"
                          >
                            <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reply</span>
                          </button>
                        </div>
                      )}

                      {/* Threaded replies */}
                      {childReplies.length > 0 && (
                        <ol className="mt-2 space-y-2.5 pl-4 border-l border-[#D2C4E3] dark:border-[#372352]">
                          {childReplies.map((reply) => (
                            <li
                              key={reply.id}
                              className="rounded-lg bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-3 space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                                  {reply.authorDisplayName}
                                  {reply.authorRoleBadge ? ` · ${reply.authorRoleBadge}` : ''}
                                </span>
                                <time
                                  dateTime={reply.createdAt}
                                  className="font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]"
                                >
                                  {new Date(reply.createdAt).toLocaleString()}
                                </time>
                              </div>
                              <p className="text-sm text-[#261D33] dark:text-[#E7DFF2]">
                                {reply.body}
                              </p>
                            </li>
                          ))}
                        </ol>
                      )}

                      {replyingToId === entry.id && (
                        <div className="pt-2 space-y-2">
                          <label htmlFor={`reply-input-${entry.id}`} className="sr-only">
                            Write a reply
                          </label>
                          <textarea
                            id={`reply-input-${entry.id}`}
                            rows={2}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Write a respectful reply…"
                            className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] p-2.5 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handlePostReply(entry.id)}
                              className="min-h-[40px] rounded-lg bg-[#5B1586] dark:bg-[#7E22CE] px-3.5 py-1.5 text-xs font-semibold text-white"
                            >
                              Post reply
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyingToId(null)}
                              className="min-h-[40px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3.5 py-1.5 text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* New Comment / Update Composer */}
            {permissions.canComment ? (
              <form
                onSubmit={handlePostEntry}
                className="pt-4 border-t border-[#E2D9EC] dark:border-[#372352] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="thread-entry-body"
                    className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]"
                  >
                    Add to the public thread
                  </label>

                  {(permissions.canPublishOfficialUpdate || permissions.canModerate) && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="thread-entry-kind" className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                        Entry type
                      </label>
                      <select
                        id="thread-entry-kind"
                        value={entryKind}
                        onChange={(e) => setEntryKind(e.target.value as ActivityEntryKind)}
                        className="min-h-[38px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-2.5 py-1 text-xs"
                      >
                        <option value="comment">Student comment</option>
                        {permissions.canPublishOfficialUpdate && (
                          <option value="organiser_update">Organiser update</option>
                        )}
                        {permissions.canModerate && (
                          <option value="official_response">Official response</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                <textarea
                  id="thread-entry-body"
                  rows={3}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Share campus context, ask a question, or document an update…"
                  className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
                />

                {permissions.canAttachMediaToUpdate && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]">
                        <ImagePlus className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                        <span>{uploadingMedia ? 'Processing media…' : 'Attach photo or short video'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                          disabled={uploadingMedia}
                          onChange={handleThreadMediaUpload}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowVideoLinkBox((v) => !v)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-medium hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
                      >
                        <Link2 className="w-4 h-4" aria-hidden="true" />
                        <span>Link hosted video</span>
                      </button>
                    </div>

                    {showVideoLinkBox && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="url"
                          value={videoLinkInput}
                          onChange={(e) => setVideoLinkInput(e.target.value)}
                          placeholder="https://vimeo.com/... or https://..."
                          className="flex-1 min-h-[40px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddExternalVideo}
                          className="min-h-[40px] rounded-lg bg-[#5B1586] px-3 text-xs font-semibold text-white"
                        >
                          Add link
                        </button>
                      </div>
                    )}

                    {commentMedia.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {commentMedia.map((m) => (
                          <div
                            key={m.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-2.5 py-1 text-xs"
                          >
                            <FileVideo className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="max-w-[160px] truncate">{m.caption || m.type}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentMedia((prev) => prev.filter((x) => x.id !== m.id))
                              }
                              aria-label="Remove attachment"
                              className="text-rose-600 font-semibold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {mediaError && (
                      <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                        {mediaError}
                      </p>
                    )}
                  </div>
                )}

                {commentError && (
                  <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {commentError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={postingEntry || uploadingMedia}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{postingEntry ? 'Posting…' : 'Post to thread'}</span>
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
                  <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {me?.accountStatus === 'pending'
                      ? 'Commenting unlocks once your student account is verified.'
                      : 'Sign in with a verified student account to join the discussion.'}
                  </span>
                </div>
                {!me && (
                  <button
                    type="button"
                    onClick={() => navigate({ view: 'auth' })}
                    className="min-h-[40px] rounded-lg bg-[#5B1586] px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Sign in
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Action & Transparency Column */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          {/* Signature Action Card */}
          <section
            aria-label="Endorse this petition"
            className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
          >
            <div>
              <p
                aria-live="polite"
                className="text-3xl font-bold font-mono tabular-nums text-[#2B0B42] dark:text-[#F7F3FC]"
              >
                {displayCount.toLocaleString()}
              </p>
              <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                verified signatures toward a goal of{' '}
                <span className="font-mono tabular-nums font-semibold">
                  {petition.goalSignatures.toLocaleString()}
                </span>
              </p>
            </div>

            <ProgressBar
              current={displayCount}
              goal={petition.goalSignatures}
              tone={
                petition.status === 'achieved' || petition.status === 'responded'
                  ? 'teal'
                  : 'ember'
              }
            />

            {/* Response SLA Transparency Box */}
            <div className="rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] p-3.5 border border-[#E2D9EC] dark:border-[#372352] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                  Response window
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    sla.state === 'overdue'
                      ? 'text-[#9F1239] dark:text-[#FDA4AF]'
                      : sla.state === 'responded'
                      ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                      : 'text-[#2B0B42] dark:text-[#F7F3FC]'
                  }`}
                >
                  {sla.label}
                </span>
              </div>
              <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">{sla.detail}</p>
            </div>

            {isSignable ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleSignToggle()}
                  className={`w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors active:translate-y-px ${
                    signedByMe
                      ? 'border border-[#0F766E] bg-teal-50 dark:bg-teal-950/50 text-[#0F766E] dark:text-[#2DD4BF] hover:bg-teal-100 dark:hover:bg-teal-950'
                      : 'bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] text-white'
                  }`}
                >
                  {signedByMe ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Signed — Withdraw signature</span>
                    </>
                  ) : (
                    <>
                      <PenLine className="w-4 h-4" aria-hidden="true" />
                      <span>Sign this petition</span>
                    </>
                  )}
                </button>

                {signError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-950 dark:text-amber-200 space-y-2"
                  >
                    <p>{signError}</p>
                    {!me && (
                      <button
                        type="button"
                        onClick={() => navigate({ view: 'auth' })}
                        className="font-semibold underline"
                      >
                        Go to sign in / sign up
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] rounded-lg bg-[#F2ECF8] dark:bg-[#26173A] p-3">
                Signatures are closed because this petition is currently marked{' '}
                <strong>{petition.status.replace('_', ' ')}</strong>.
              </p>
            )}

            {/* Recent Endorsers */}
            <div className="pt-3 border-t border-[#E2D9EC] dark:border-[#372352] space-y-2.5">
              <p className="text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                Recent student endorsers
              </p>
              {signatures.length === 0 ? (
                <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                  Endorsement count includes initial verified supporters; new public signers appear here.
                </p>
              ) : (
                <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {signatures.slice(0, 12).map((sig) => (
                    <li
                      key={sig.userId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate font-medium text-[#261D33] dark:text-[#E7DFF2]">
                        {sig.displayName}
                        <span className="text-[#5B506B] dark:text-[#B7A8CC]">
                          {' '}
                          · {sig.roleBadge}
                        </span>
                      </span>
                      <time
                        dateTime={sig.signedAt}
                        className="font-mono tabular-nums text-[11px] text-[#5B506B] dark:text-[#B7A8CC] shrink-0"
                      >
                        {new Date(sig.signedAt).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Moderator Decision & Official Status Panel */}
          {permissions.canModerate && (
            <section
              aria-label="Moderator actions"
              className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                  Council stewardship
                </h2>
              </div>

              {petition.status === 'pending_review' ? (
                <div className="space-y-3">
                  <label
                    htmlFor="mod-decision-reason"
                    className="block text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC]"
                  >
                    Written reason (required &amp; visible to author)
                  </label>
                  <textarea
                    id="mod-decision-reason"
                    rows={3}
                    value={modNote}
                    onChange={(e) => setModNote(e.target.value)}
                    placeholder="Explain approval confirmation or decline guidance…"
                    className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-2.5 text-sm"
                  />
                  {modError && (
                    <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      {modError}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleModDecision('approve')}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleModDecision('decline')}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleModStatusUpdate} className="space-y-3">
                  <div>
                    <label
                      htmlFor="mod-next-status"
                      className="block text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC] mb-1"
                    >
                      Update public status
                    </label>
                    <select
                      id="mod-next-status"
                      value={modNextStatus}
                      onChange={(e) => setModNextStatus(e.target.value as PetitionStatus)}
                      className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2 text-sm"
                    >
                      <option value="live">Live (open)</option>
                      <option value="responded">Responded (official reply)</option>
                      <option value="achieved">Achieved / Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="mod-status-note"
                      className="block text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC] mb-1"
                    >
                      Official note for public record
                    </label>
                    <textarea
                      id="mod-status-note"
                      rows={3}
                      value={modNote}
                      onChange={(e) => setModNote(e.target.value)}
                      placeholder="Summarize the School Administration or Council response, outcome, or closure reason…"
                      className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-2.5 text-sm"
                    />
                  </div>

                  {modError && (
                    <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      {modError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full min-h-[44px] rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Record status &amp; official note
                  </button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
