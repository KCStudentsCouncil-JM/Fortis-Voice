import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { MemberAvatar } from '@/src/components/ui/CivicGraphics';
import { ConfirmDialog } from '@/src/components/ui/Primitives';
import { useCivic } from '@/src/context/CivicContext';
import type { AccountStatus, Member } from '@/src/types/civic';
import { formatRoleLabel, isPrimaryAdmin } from '@/src/utils/permissions';

function formatRelativeActive(iso?: string): string {
  if (!iso) return 'No recent session';
  const diffMin = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (diffMin < 5) return 'Active recently';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Active ${diffDays}d ago`;
}

export const MemberDirectoryView: React.FC = () => {
  const { snapshot, repo, permissions, pushToast } = useCivic();
  const me = snapshot.currentUser;

  const [tab, setTab] = useState<AccountStatus>('pending');
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Member | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const counts = useMemo(
    () => ({
      pending: snapshot.members.filter((m) => m.accountStatus === 'pending').length,
      approved: snapshot.members.filter((m) => m.accountStatus === 'approved').length,
      rejected: snapshot.members.filter((m) => m.accountStatus === 'rejected').length,
    }),
    [snapshot.members]
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.members.filter((m) => {
      if (m.accountStatus !== tab) return false;
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) ||
        (m.studentName?.toLowerCase().includes(q) ?? false) ||
        (m.studentClass?.toLowerCase().includes(q) ?? false) ||
        (m.grade?.toLowerCase().includes(q) ?? false) ||
        m.email.toLowerCase().includes(q) ||
        (m.affiliation?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [search, snapshot.members, tab]);

  if (!permissions.canManageDirectory) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Moderator access required
        </h1>
      </div>
    );
  }

  const handleApprove = async (member: Member) => {
    const res = await repo.updateMemberDirectory({
      targetUid: member.uid,
      accountStatus: 'approved',
    });
    if (res.ok) {
      pushToast({
        tone: 'success',
        title: `${member.displayName} approved`,
        description: 'Student can now sign, comment, and submit petitions.',
      });
    } else {
      pushToast({ tone: 'error', title: 'Action failed', description: res.error });
    }
  };

  const handleRoleChange = async (member: Member, role: Member['role']) => {
    const res = await repo.updateMemberDirectory({
      targetUid: member.uid,
      role,
    });
    if (res.ok) {
      pushToast({
        tone: 'success',
        title: 'Role updated',
        description: `${member.displayName} is now ${formatRoleLabel(role)}.`,
      });
    } else {
      pushToast({ tone: 'error', title: 'Role update failed', description: res.error });
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    const res = await repo.updateMemberDirectory({
      targetUid: rejectTarget.uid,
      accountStatus: 'rejected',
      rejectionReason: rejectReason,
    });
    setRejectTarget(null);
    setRejectReason('');
    if (res.ok) {
      pushToast({ tone: 'info', title: 'Account verification declined' });
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    const res = await repo.removeMember(removeTarget.uid);
    setRemoveTarget(null);
    if (res.ok) {
      pushToast({ tone: 'success', title: 'Student account removed from directory' });
    } else {
      pushToast({ tone: 'error', title: 'Cannot remove account', description: res.error });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Student Directory &amp; Verification
        </h1>
        <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          Verify student form details, manage Prefect/Organiser privileges, and review appeals.
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg bg-[#F2ECF8] dark:bg-[#26173A] p-1">
          {(
            [
              { key: 'pending', label: `Pending (${counts.pending})` },
              { key: 'approved', label: `Approved (${counts.approved})` },
              { key: 'rejected', label: `Rejected (${counts.rejected})` },
            ] as Array<{ key: AccountStatus; label: string }>
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`min-h-[40px] rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                tab === item.key
                  ? 'bg-white dark:bg-[#1B1029] text-[#2B0B42] dark:text-[#F7F3FC] shadow-xs'
                  : 'text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <label htmlFor="directory-search" className="sr-only">
            Search students by name, class, grade, or email
          </label>
          <Search
            className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="directory-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, grade, class, or email…"
            className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Member Cards */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center text-sm text-[#5B506B] dark:text-[#B7A8CC]">
          No {tab} student accounts match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => {
            const isSelf = me?.uid === member.uid;
            const isMainAdmin = isPrimaryAdmin(member);
            return (
              <article
                key={member.uid}
                className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <MemberAvatar
                    displayName={member.displayName}
                    avatarId={member.avatarId}
                    avatarDataUrl={member.avatarDataUrl}
                    size="md"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                      <span className="text-base font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                        {member.displayName}
                      </span>
                      {isSelf && (
                        <span className="font-semibold text-[#5B1586] dark:text-[#C084FC]">
                          (You)
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className={isMainAdmin ? 'inline-flex items-center gap-1 font-semibold text-[#5B1586] dark:text-[#C084FC]' : ''}>
                        {isMainAdmin && <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                        {formatRoleLabel(member.role, isMainAdmin)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatRelativeActive(member.lastActiveAt)}</span>
                    </div>
                    <p className="text-xs text-[#261D33] dark:text-[#E7DFF2]">
                      <strong>Student:</strong> {member.studentName || 'Unlisted'}
                      {member.grade ? ` · ${member.grade}` : ''}
                      {member.studentClass ? ` · Class ${member.studentClass}` : ''}
                      {member.dateOfBirth ? ` · D.O.B. ${member.dateOfBirth}` : ''}
                    </p>
                    <p className="text-xs font-mono text-[#5B506B] dark:text-[#B7A8CC] truncate">
                      {member.email}
                      {member.affiliation ? ` · ${member.affiliation}` : ''}
                    </p>
                    {member.bio && (
                      <p className="text-xs text-[#261D33] dark:text-[#E7DFF2]">{member.bio}</p>
                    )}
                    {member.rejectionReason && (
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        <strong>Reason:</strong> {member.rejectionReason}
                      </p>
                    )}
                    {member.appealNote && (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        <strong>Appeal note:</strong> {member.appealNote}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {member.accountStatus === 'approved' && (
                    <select
                      aria-label={`Role for ${member.displayName}`}
                      value={member.role}
                      disabled={isSelf || isMainAdmin}
                      onChange={(e) =>
                        void handleRoleChange(member, e.target.value as Member['role'])
                      }
                      className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      <option value="member">Student Member</option>
                      <option value="organiser">Verified Organiser</option>
                      <option value="moderator">Council Moderator</option>
                    </select>
                  )}

                  {member.accountStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => void handleApprove(member)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      {member.accountStatus === 'rejected' ? (
                        <>
                          <UserCheck className="w-4 h-4" aria-hidden="true" />
                          <span>Re-approve</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>Approve</span>
                        </>
                      )}
                    </button>
                  )}

                  {member.accountStatus !== 'rejected' && !isSelf && !isMainAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(member);
                        setRejectReason('');
                      }}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <UserX className="w-4 h-4" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  )}

                  {!isSelf && !isMainAdmin && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(member)}
                      aria-label={`Remove ${member.displayName}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#E2D9EC] dark:border-[#372352] text-[#5B506B] hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <form
            onSubmit={handleConfirmReject}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4 shadow-xl"
          >
            <h2
              id="reject-modal-title"
              className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]"
            >
              Reject verification for {rejectTarget.displayName}
            </h2>
            <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
              Provide a respectful, specific reason so the student knows how to appeal if appropriate.
            </p>
            <div>
              <label htmlFor="reject-reason-input" className="block text-xs font-semibold mb-1">
                Written explanation
              </label>
              <textarea
                id="reject-reason-input"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Missing form class or date of birth does not match class roster."
                className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-2.5 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-rose-700 hover:bg-rose-800 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm rejection
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={`Remove ${removeTarget?.displayName ?? 'student'}?`}
        description="This removes the student profile from the directory. Your own moderator account can never be removed through this interface."
        confirmLabel="Remove account"
        destructive
        onConfirm={() => void handleConfirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
};
