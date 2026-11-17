import React, { useState } from 'react';
import {
  CalendarCheck,
  CalendarPlus,
  Download,
  ImagePlus,
  MapPin,
  Plus,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import {
  ConfirmDialog,
  MediaGallery,
  ProgressBar,
} from '@/src/components/ui/Primitives';
import { PETITION_CATEGORIES } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import type { MediaAttachment } from '@/src/types/civic';
import { downloadTextFile, generateEventIcs } from '@/src/utils/export';
import { processMediaFile, validateExternalVideoUrl } from '@/src/utils/media';

export const EventsView: React.FC = () => {
  const { snapshot, repo, permissions, navigate, pushToast } = useCivic();
  const me = snapshot.currentUser;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(PETITION_CATEGORIES[0]);
  const [tagsRaw, setTagsRaw] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeLabel, setTimeLabel] = useState('3:00 PM – 4:30 PM');
  const [capacity, setCapacity] = useState<string>('50');
  const [promoVideoUrl, setPromoVideoUrl] = useState('');
  const [gallery, setGallery] = useState<MediaAttachment[]>([]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (gallery.length >= 6) {
      setFormError('Maximum 6 gallery photos per event.');
      return;
    }
    setUploadingGallery(true);
    try {
      const res = await processMediaFile(file);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setGallery((prev) => [...prev, res.attachment]);
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    if (title.trim().length < 4 || description.trim().length < 10) {
      setFormError('Please provide an event title and clear description.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }
    if (promoVideoUrl.trim()) {
      const valid = validateExternalVideoUrl(promoVideoUrl);
      if (!valid.ok) {
        setFormError(valid.error);
        return;
      }
    }

    const capNum = capacity.trim() ? Number(capacity) : undefined;
    setBusy(true);
    try {
      const res = await repo.createEvent({
        title,
        description,
        category,
        tags: tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        location,
        startDate,
        endDate,
        timeLabel,
        capacity: capNum && capNum > 0 ? capNum : undefined,
        promoVideoUrl: promoVideoUrl.trim() || undefined,
        gallery,
      });

      if (!res.ok) {
        setFormError(res.error || 'Could not publish event.');
        return;
      }

      setShowCreate(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setTagsRaw('');
      setPromoVideoUrl('');
      setGallery([]);
      pushToast({ tone: 'success', title: 'Campaign event published' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not publish event.');
    } finally {
      setBusy(false);
    }
  };

  const handleRsvpToggle = async (eventId: string, isGoing: boolean) => {
    if (!me) {
      navigate({ view: 'auth' });
      pushToast({ tone: 'info', title: 'Sign in to RSVP for school events' });
      return;
    }
    const res = isGoing
      ? await repo.cancelEventRsvp(eventId)
      : await repo.rsvpEvent(eventId);
    if (res.ok) {
      pushToast({
        tone: 'success',
        title: isGoing ? 'RSVP cancelled' : 'RSVP confirmed',
      });
    } else {
      pushToast({
        tone: 'error',
        title: 'RSVP could not be updated',
        description: res.error,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const res = await repo.deleteEvent(deleteTargetId);
    setDeleteTargetId(null);
    if (res.ok) {
      pushToast({ tone: 'success', title: 'Campaign event removed' });
    } else {
      pushToast({ tone: 'error', title: 'Delete failed', description: res.error });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Campaigns &amp; School Events
          </h1>
          <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
            Council town halls, campus walk-audits, volunteer days, and student briefings.
          </p>
        </div>

        {permissions.canCreateEvent && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showCreate ? 'Close event form' : 'Publish event'}</span>
          </button>
        )}
      </div>

      {/* Create Event Drawer */}
      {showCreate && permissions.canCreateEvent && (
        <form
          onSubmit={handleCreateEvent}
          className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Create campus event
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="evt-title" className="block text-xs font-semibold mb-1">
                Event title
              </label>
              <input
                id="evt-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upper & Lower School Council Town Hall"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="evt-category" className="block text-xs font-semibold mb-1">
                Category
              </label>
              <select
                id="evt-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              >
                {PETITION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="evt-start" className="block text-xs font-semibold mb-1">
                Start date
              </label>
              <input
                id="evt-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="evt-end" className="block text-xs font-semibold mb-1">
                End date (multi-day supported)
              </label>
              <input
                id="evt-end"
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="evt-time" className="block text-xs font-semibold mb-1">
                Time schedule
              </label>
              <input
                id="evt-time"
                type="text"
                required
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder="e.g. 3:00 PM – 4:30 PM"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="evt-location" className="block text-xs font-semibold mb-1">
                Venue or campus location
              </label>
              <input
                id="evt-location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. North Street Assembly Hall"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="evt-capacity" className="block text-xs font-semibold mb-1">
                Capacity (optional)
              </label>
              <input
                id="evt-capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="evt-desc" className="block text-xs font-semibold mb-1">
              Event details
            </label>
            <textarea
              id="evt-desc"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What students can expect, dress code or House notes, and items to bring…"
              className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="evt-tags" className="block text-xs font-semibold mb-1">
                Tags (comma-separated)
              </label>
              <input
                id="evt-tags"
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="town-hall, fortis, campus-life"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="evt-video" className="block text-xs font-semibold mb-1">
                Promo video link (optional)
              </label>
              <input
                id="evt-video"
                type="url"
                value={promoVideoUrl}
                onChange={(e) => setPromoVideoUrl(e.target.value)}
                placeholder="https://vimeo.com/..."
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3.5 py-2 text-xs font-semibold cursor-pointer">
              <ImagePlus className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
              <span>{uploadingGallery ? 'Processing photo…' : `Add gallery photo (${gallery.length}/6)`}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingGallery}
                onChange={handleGalleryUpload}
                className="sr-only"
              />
            </label>
          </div>

          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCreate(false)}
              className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || uploadingGallery}
              className="min-h-[44px] rounded-lg bg-[#5B1586] dark:bg-[#7E22CE] disabled:opacity-60 px-5 py-2 text-sm font-semibold text-white"
            >
              {busy ? 'Publishing…' : 'Publish event'}
            </button>
          </div>
        </form>
      )}

      {/* Event Cards */}
      <div className="space-y-5">
        {snapshot.events.map((event) => {
          const rsvps = snapshot.rsvpsByEvent[event.id] ?? [];
          const isGoing = Boolean(me && rsvps.some((r) => r.userId === me.uid));
          const isFull = Boolean(event.capacity && event.rsvpCount >= event.capacity);
          const isMultiDay = event.endDate && event.endDate !== event.startDate;
          const canDelete =
            permissions.canDeleteAnyEvent ||
            Boolean(me && permissions.canCreateEvent && event.organiserId === me.uid);

          return (
            <article
              key={event.id}
              className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    <span className="font-mono font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                      {event.referenceNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{event.category}</span>
                    {isMultiDay && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#5B1586] dark:text-[#C084FC]">
                          Multi-day event
                        </span>
                      </>
                    )}
                    {event.tags && event.tags.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{event.tags.join(' · ')}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                    {event.title}
                  </h2>
                  <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    Organised by <strong className="text-[#2B0B42] dark:text-[#F7F3FC]">{event.organiserName}</strong>
                  </p>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(event.id)}
                    aria-label={`Delete event ${event.title}`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#E2D9EC] dark:border-[#372352] text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] p-4 border border-[#E2D9EC] dark:border-[#372352] text-xs">
                <div>
                  <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Dates</p>
                  <p className="mt-0.5 font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]">
                    {isMultiDay ? `${event.startDate} → ${event.endDate}` : event.startDate}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Hours</p>
                  <p className="mt-0.5 text-[#5B506B] dark:text-[#B7A8CC]">{event.timeLabel}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Location</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[#5B506B] dark:text-[#B7A8CC]">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{event.location}</span>
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-[#261D33] dark:text-[#E7DFF2]">
                {event.description}
              </p>

              {event.gallery && event.gallery.length > 0 && (
                <MediaGallery media={event.gallery} compact />
              )}

              {event.promoVideoUrl && (
                <div className="rounded-xl border border-[#E2D9EC] dark:border-[#372352] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                    <Video className="w-4 h-4 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
                    Campaign briefing video attached
                  </span>
                  <a
                    href={event.promoVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] inline-flex items-center rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-semibold hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
                  >
                    Open briefing video
                  </a>
                </div>
              )}

              <div className="pt-3 border-t border-[#E2D9EC] dark:border-[#372352] flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#2B0B42] dark:text-[#F7F3FC] font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {event.rsvpCount} {event.capacity ? `/ ${event.capacity}` : ''} attending
                    </span>
                    {isFull && !isGoing && (
                      <span className="text-xs font-semibold text-[#9F1239] dark:text-[#FDA4AF]">
                        At capacity
                      </span>
                    )}
                  </div>
                  {event.capacity && (
                    <ProgressBar
                      current={event.rsvpCount}
                      goal={event.capacity}
                      tone={isFull ? 'navy' : 'teal'}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${event.referenceNumber.toLowerCase()}.ics`,
                        generateEventIcs(event),
                        'text/calendar;charset=utf-8'
                      )
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3.5 py-2 text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Add to calendar (.ics)</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isGoing && isFull}
                    onClick={() => void handleRsvpToggle(event.id, isGoing)}
                    className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                      isGoing
                        ? 'border border-[#0F766E] bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#2DD4BF]'
                        : isFull
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] text-white'
                    }`}
                  >
                    {isGoing ? (
                      <>
                        <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Going — Cancel RSVP</span>
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                        <span>{isFull ? 'Event full' : 'RSVP to attend'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Delete campaign event?"
        description="This removes the event listing and its RSVP roster. This action cannot be undone."
        confirmLabel="Delete event"
        destructive
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
