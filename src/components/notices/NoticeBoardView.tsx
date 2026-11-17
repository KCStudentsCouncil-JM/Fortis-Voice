import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Check,
  Info,
  Megaphone,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog, ProgressBar } from '@/src/components/ui/Primitives';
import { useCivic } from '@/src/context/CivicContext';
import type { NoticeKind } from '@/src/types/civic';

export const NoticeBoardView: React.FC = () => {
  const { snapshot, repo, permissions, navigate, pushToast } = useCivic();
  const me = snapshot.currentUser;

  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<NoticeKind>('notice');
  const [pinned, setPinned] = useState(false);
  const [pollOptionsText, setPollOptionsText] = useState('Option A\nOption B');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);

  const sortedNotices = useMemo(() => {
    return [...snapshot.notices].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [snapshot.notices]);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const pollOptions =
      kind === 'poll'
        ? pollOptionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    setBusy(true);
    try {
      const res = await repo.createNotice({
        title,
        body,
        kind,
        pinned,
        pollOptions,
      });
      if (!res.ok) {
        setFormError(res.error || 'Could not publish notice.');
        return;
      }

      setShowComposer(false);
      setTitle('');
      setBody('');
      setPinned(false);
      pushToast({ tone: 'success', title: 'Notice published to board' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not publish notice.');
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (noticeId: string, optionId: string) => {
    if (!me) {
      navigate({ view: 'auth' });
      pushToast({ tone: 'info', title: 'Sign in to vote in student polls' });
      return;
    }
    const res = await repo.votePoll(noticeId, optionId);
    if (res.ok) {
      pushToast({ tone: 'success', title: 'Poll vote recorded' });
    } else {
      pushToast({ tone: 'error', title: 'Vote not recorded', description: res.error });
    }
  };

  const handleDelete = async () => {
    if (!deleteNoticeId) return;
    const res = await repo.deleteNotice(deleteNoticeId);
    setDeleteNoticeId(null);
    if (res.ok) {
      pushToast({ tone: 'success', title: 'Notice removed' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Students&apos; Council Notice Board
          </h1>
          <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
            Official Council updates, campus alerts, and student roundtable polls.
          </p>
        </div>

        {permissions.canPostNotice && (
          <button
            type="button"
            onClick={() => setShowComposer((v) => !v)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showComposer ? 'Close form' : 'Post notice or poll'}</span>
          </button>
        )}
      </div>

      {showComposer && permissions.canPostNotice && (
        <form
          onSubmit={handleCreateNotice}
          className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Publish to notice board
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="notice-kind" className="block text-xs font-semibold mb-1">
                Notice type
              </label>
              <select
                id="notice-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as NoticeKind)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              >
                <option value="notice">General Notice</option>
                <option value="update">Council Update</option>
                <option value="alert">Urgent Campus Alert</option>
                <option value="poll">Student Poll</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="min-h-[44px] flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#5B1586]"
                />
                <span>Pin to top of notice board</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="notice-title" className="block text-xs font-semibold mb-1">
              Headline
            </label>
            <input
              id="notice-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clear announcement or poll question"
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3.5 py-2"
            />
          </div>

          <div>
            <label htmlFor="notice-body" className="block text-xs font-semibold mb-1">
              Details
            </label>
            <textarea
              id="notice-body"
              rows={3}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Explain what Kingston College students should know…"
              className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
            />
          </div>

          {kind === 'poll' && (
            <div>
              <label htmlFor="poll-options" className="block text-xs font-semibold mb-1">
                Poll choices (one per line, up to 6)
              </label>
              <textarea
                id="poll-options"
                rows={4}
                value={pollOptionsText}
                onChange={(e) => setPollOptionsText(e.target.value)}
                className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
              />
            </div>
          )}

          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowComposer(false)}
              className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-[#5B1586] dark:bg-[#7E22CE] disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white"
            >
              {busy ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {sortedNotices.map((notice) => {
          const userVote = me
            ? (snapshot.votesByNotice[notice.id] ?? []).find((v) => v.userId === me.uid)
            : undefined;

          const KindIcon =
            notice.kind === 'alert'
              ? AlertTriangle
              : notice.kind === 'poll'
              ? BarChart2
              : notice.kind === 'update'
              ? Info
              : Megaphone;

          return (
            <article
              key={notice.id}
              className={`rounded-2xl bg-white dark:bg-[#1B1029] border p-6 space-y-4 ${
                notice.kind === 'alert'
                  ? 'border-amber-300 dark:border-amber-800/70'
                  : 'border-[#E2D9EC] dark:border-[#372352]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                      <KindIcon className="w-3.5 h-3.5 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                      <span className="capitalize">{notice.kind}</span>
                    </span>
                    {notice.pinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[#5B1586] dark:text-[#C084FC]">
                          <Pin className="w-3 h-3" aria-hidden="true" />
                          Pinned
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{notice.authorDisplayName}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={notice.createdAt} className="font-mono tabular-nums">
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                  <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                    {notice.title}
                  </h2>
                </div>

                {permissions.canPostNotice && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void repo.togglePinNotice(notice.id)}
                      className="min-h-[40px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-medium"
                    >
                      {notice.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteNoticeId(notice.id)}
                      aria-label={`Delete notice ${notice.title}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-[#E2D9EC] dark:border-[#372352] text-rose-700 dark:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-[#261D33] dark:text-[#E7DFF2]">
                {notice.body}
              </p>

              {notice.kind === 'poll' && notice.pollOptions && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2.5">
                    {notice.pollOptions.map((opt) => {
                      const isSelected = userVote?.optionId === opt.id;
                      const pct =
                        notice.totalVotes > 0
                          ? Math.round((opt.voteCount / notice.totalVotes) * 100)
                          : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => void handleVote(notice.id, opt.id)}
                          aria-pressed={isSelected}
                          className={`w-full text-left rounded-xl border p-3.5 space-y-2 transition-colors ${
                            isSelected
                              ? 'border-[#0F766E] bg-teal-50/70 dark:bg-teal-950/35'
                              : 'border-[#E2D9EC] dark:border-[#372352] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-[#2B0B42] dark:text-[#F7F3FC] inline-flex items-center gap-2">
                              {isSelected && (
                                <Check
                                  className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{opt.label}</span>
                            </span>
                            <span className="font-mono tabular-nums text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC]">
                              {opt.voteCount} ({pct}%)
                            </span>
                          </div>
                          <ProgressBar
                            current={opt.voteCount}
                            goal={Math.max(1, notice.totalVotes)}
                            tone={isSelected ? 'teal' : 'navy'}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]">
                    {notice.totalVotes} total votes ·{' '}
                    {me
                      ? userVote
                        ? 'Click another option at any time to change your vote.'
                        : 'Select an option to cast your vote.'
                      : 'Sign in with a verified student account to vote.'}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteNoticeId)}
        title="Delete notice?"
        description="This removes the announcement or poll from the Council notice board."
        confirmLabel="Delete notice"
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteNoticeId(null)}
      />
    </div>
  );
};
