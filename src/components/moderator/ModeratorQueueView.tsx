import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Layers, XCircle } from 'lucide-react';
import { EmptyStateGraphic } from '@/src/components/ui/CivicGraphics';
import { ConfirmDialog, StatusBadge, UrgencyIndicator } from '@/src/components/ui/Primitives';
import { useCivic } from '@/src/context/CivicContext';
import type { PetitionStatus } from '@/src/types/civic';

export const ModeratorQueueView: React.FC = () => {
  const { snapshot, repo, permissions, openPetition, pushToast } = useCivic();

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [queueError, setQueueError] = useState<Record<string, string>>({});

  // Bulk status update state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<PetitionStatus>('responded');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const pendingQueue = useMemo(
    () => snapshot.petitions.filter((p) => p.status === 'pending_review'),
    [snapshot.petitions]
  );

  const manageablePetitions = useMemo(
    () =>
      snapshot.petitions.filter(
        (p) => p.status === 'live' || p.status === 'responded' || p.status === 'closed'
      ),
    [snapshot.petitions]
  );

  if (!permissions.canModerate) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Council Moderator access required
        </h1>
        <p className="mt-2 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          Only verified Students&apos; Council moderators can review submissions and update public petition statuses.
        </p>
      </div>
    );
  }

  const handleDecision = async (petitionId: string, decision: 'approve' | 'decline') => {
    const reason = (reasons[petitionId] ?? '').trim();
    if (reason.length < 5) {
      setQueueError((prev) => ({
        ...prev,
        [petitionId]: 'Please enter a written reason (at least 5 characters) before deciding.',
      }));
      return;
    }
    setQueueError((prev) => ({ ...prev, [petitionId]: '' }));
    const res = await repo.moderatePetitionDecision({ petitionId, decision, reason });
    if (res.ok) {
      pushToast({
        tone: 'success',
        title: decision === 'approve' ? 'Petition approved & published' : 'Petition declined',
      });
    } else {
      setQueueError((prev) => ({ ...prev, [petitionId]: res.error || 'Action failed.' }));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkConfirm = async () => {
    setBulkConfirmOpen(false);
    const res = await repo.bulkUpdatePetitionStatus({
      petitionIds: selectedIds,
      status: bulkStatus,
      note: bulkNote,
    });
    if (res.ok) {
      pushToast({
        tone: 'success',
        title: `Updated ${selectedIds.length} petition(s)`,
        description: `Recorded status "${bulkStatus.replace('_', ' ')}" on the public record.`,
      });
      setSelectedIds([]);
      setBulkNote('');
    } else {
      pushToast({ tone: 'error', title: 'Bulk update failed', description: res.error });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Council Review Queue
        </h1>
        <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          Every approval or decline requires a written reason stored in the petition&apos;s activity log.
        </p>
      </div>

      {/* Pending Submissions */}
      <section aria-label="Pending review submissions" className="space-y-4">
        <h2 className="text-base font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Awaiting review ({pendingQueue.length})
        </h2>

        {pendingQueue.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center flex flex-col items-center">
            <EmptyStateGraphic />
            <p className="mt-3 text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
              Review queue is clear
            </p>
            <p className="mt-1 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
              New student submissions will appear here before entering the campus feed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingQueue.map((petition) => (
              <article
                key={petition.id}
                className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                      <span className="font-mono font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                        {petition.referenceNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{petition.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{petition.location}</span>
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                      {petition.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
                      {petition.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <UrgencyIndicator urgency={petition.urgency} />
                    <StatusBadge status={petition.status} />
                  </div>
                </div>

                <div className="rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] p-4 text-sm text-[#261D33] dark:text-[#E7DFF2] whitespace-pre-line max-h-48 overflow-y-auto border border-[#E2D9EC] dark:border-[#372352]">
                  {petition.body}
                </div>

                <div className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                  Author display: <strong>{petition.authorDisplayName}</strong>
                  {petition.isAnonymous && ` (internal UID: ${petition.authorId})`}
                </div>

                <div className="space-y-2 pt-2 border-t border-[#E2D9EC] dark:border-[#372352]">
                  <label
                    htmlFor={`reason-${petition.id}`}
                    className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC]"
                  >
                    Decision reason (required — visible to the author)
                  </label>
                  <textarea
                    id={`reason-${petition.id}`}
                    rows={2}
                    value={reasons[petition.id] ?? ''}
                    onChange={(e) =>
                      setReasons((prev) => ({ ...prev, [petition.id]: e.target.value }))
                    }
                    placeholder="e.g. Approved: meets student council criteria and specifies clear campus scope."
                    className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-2.5 text-sm"
                  />
                  {queueError[petition.id] && (
                    <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      {queueError[petition.id]}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => openPetition(petition.id)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3.5 py-2 text-xs font-semibold"
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      <span>Inspect full detail</span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDecision(petition.id, 'decline')}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 px-4 py-2 text-xs font-semibold text-white"
                      >
                        <XCircle className="w-4 h-4" aria-hidden="true" />
                        <span>Decline</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(petition.id, 'approve')}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 px-4 py-2 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>Approve &amp; publish</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Bulk Status Update Tool */}
      <section
        aria-label="Bulk status update"
        className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Bulk status updates
          </h2>
        </div>
        <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
          Select multiple petitions to record a coordinated official Council status and public note together.
        </p>

        <div className="divide-y divide-[#E2D9EC] dark:divide-[#372352] border border-[#E2D9EC] dark:border-[#372352] rounded-xl overflow-hidden">
          {manageablePetitions.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(p.id)}
                    className="h-4 w-4 rounded accent-[#5B1586] shrink-0"
                  />
                  <span className="font-mono text-xs font-semibold shrink-0">
                    {p.referenceNumber}
                  </span>
                  <span className="truncate text-[#2B0B42] dark:text-[#F7F3FC] font-medium">
                    {p.title}
                  </span>
                </span>
                <StatusBadge status={p.status} />
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="bulk-status" className="block text-xs font-semibold mb-1">
              Target status
            </label>
            <select
              id="bulk-status"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as PetitionStatus)}
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2 text-sm"
            >
              <option value="responded">Responded</option>
              <option value="achieved">Achieved</option>
              <option value="closed">Closed</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bulk-note" className="block text-xs font-semibold mb-1">
              Official public note for all selected petitions
            </label>
            <input
              id="bulk-note"
              type="text"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="e.g. Tabled at the Kingston College Term 2 Council & Administration Review."
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={selectedIds.length === 0 || bulkNote.trim().length < 4}
          onClick={() => setBulkConfirmOpen(true)}
          className="min-h-[44px] rounded-lg bg-[#5B1586] disabled:opacity-45 dark:bg-[#7E22CE] px-5 py-2 text-sm font-semibold text-white"
        >
          Apply to {selectedIds.length} selected petition(s)
        </button>
      </section>

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={`Update ${selectedIds.length} petition(s) to "${bulkStatus.replace('_', ' ')}"?`}
        description="This will update each selected petition's status and append your official note to its chronological public record."
        confirmLabel="Confirm bulk update"
        onConfirm={() => void handleBulkConfirm()}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
};
