import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  Flame,
  Info,
  Lock,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import type { MediaAttachment, PetitionStatus, PetitionUrgency, ToastMessage } from '@/src/types/civic';

/** Always pairs semantic color with an icon and clear text label (never hue-only). */
export const StatusBadge: React.FC<{ status: PetitionStatus }> = ({ status }) => {
  const config: Record<
    PetitionStatus,
    { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    live: {
      label: 'Live',
      classes:
        'bg-[#5B1586]/10 text-[#460E69] border-[#5B1586]/25 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-700/60',
      Icon: Flame,
    },
    pending_review: {
      label: 'Under Review',
      classes:
        'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60',
      Icon: Clock,
    },
    responded: {
      label: 'Responded',
      classes:
        'bg-teal-50 text-[#0F766E] border-[#0F766E]/30 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800/60',
      Icon: MessageSquare,
    },
    achieved: {
      label: 'Achieved',
      classes:
        'bg-teal-600/12 text-[#0F766E] border-[#0F766E]/35 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-700/60',
      Icon: CheckCircle2,
    },
    closed: {
      label: 'Closed',
      classes:
        'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      Icon: Lock,
    },
    draft: {
      label: 'Draft',
      classes:
        'bg-[#F2ECF8] text-[#5B506B] border-[#E2D9EC] dark:bg-[#26173A] dark:text-[#B7A8CC] dark:border-[#372352]',
      Icon: FileEdit,
    },
    declined: {
      label: 'Declined',
      classes:
        'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800/60',
      Icon: XCircle,
    },
  };

  const { label, classes, Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export const UrgencyIndicator: React.FC<{ urgency: PetitionUrgency }> = ({ urgency }) => {
  if (urgency === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9F1239] dark:text-[#FDA4AF] whitespace-nowrap">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Urgent (24h target)
      </span>
    );
  }
  if (urgency === 'standard') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC] whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Standard (48h target)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC] whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Low (72h target)
    </span>
  );
};

/** Progress bar that animates once on mount while respecting reduced-motion preferences. */
export const ProgressBar: React.FC<{
  current: number;
  goal: number;
  tone?: 'ember' | 'teal' | 'navy';
  label?: string;
}> = ({ current, goal, tone = 'ember', label }) => {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const [renderedPct, setRenderedPct] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRenderedPct(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const fillClass =
    tone === 'teal'
      ? 'bg-[#0F766E] dark:bg-[#2DD4BF]'
      : tone === 'navy'
      ? 'bg-[#2B0B42] dark:bg-[#C084FC]'
      : 'bg-[#5B1586] dark:bg-[#9F5FE0]';

  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label={label || `${current} of ${goal} signatures`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[#F2ECF8] dark:bg-[#26173A]"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${fillClass}`}
          style={{ width: `${renderedPct}%` }}
        />
      </div>
    </div>
  );
};

export const ToastStack: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  liveAnnouncement: string;
}> = ({ toasts, onDismiss, liveAnnouncement }) => (
  <>
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {liveAnnouncement}
    </div>
    <div className="fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto z-50 flex flex-col gap-2.5 md:w-96 pointer-events-none">
      {toasts.map((toast) => {
        const toneStyles =
          toast.tone === 'error'
            ? 'border-rose-300 dark:border-rose-800 bg-white dark:bg-[#1B1029] text-rose-900 dark:text-rose-200'
            : toast.tone === 'success'
            ? 'border-[#0F766E]/40 dark:border-teal-800 bg-white dark:bg-[#1B1029] text-[#2B0B42] dark:text-[#F7F3FC]'
            : 'border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] text-[#2B0B42] dark:text-[#F7F3FC]';

        const Icon =
          toast.tone === 'error'
            ? AlertCircle
            : toast.tone === 'success'
            ? CheckCircle2
            : Info;

        const iconColor =
          toast.tone === 'error'
            ? 'text-rose-600 dark:text-rose-400'
            : toast.tone === 'success'
            ? 'text-[#0F766E] dark:text-[#2DD4BF]'
            : 'text-[#5B1586] dark:text-[#C084FC]';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-transform duration-200 ${toneStyles}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[44px] min-w-[44px] -m-2 flex items-center justify-center rounded-lg text-[#5B506B] hover:text-[#2B0B42] dark:text-[#B7A8CC] dark:hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  </>
);

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 shadow-xl">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[#2B0B42] dark:text-[#F7F3FC]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              destructive
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ResilientImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}> = ({ src, alt, className = 'w-full h-48 object-cover', onClick }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center bg-gradient-to-br from-[#F2ECF8] to-[#E2D9EC] dark:from-[#26173A] dark:to-[#1B1029] text-[#5B506B] dark:text-[#B7A8CC] p-4 text-center`}
      >
        <Sparkles className="w-5 h-5 mb-1.5 opacity-60" aria-hidden="true" />
        <span className="text-xs">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onClick={onClick}
      className={className}
    />
  );
};

export const MediaGallery: React.FC<{
  media?: MediaAttachment[];
  compact?: boolean;
}> = ({ media, compact = false }) => {
  const [lightboxItem, setLightboxItem] = useState<MediaAttachment | null>(null);

  if (!media || media.length === 0) return null;

  return (
    <>
      <div
        className={`grid gap-3 ${
          media.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {media.map((item) => {
          if (item.type === 'image') {
            return (
              <figure
                key={item.id}
                className="overflow-hidden rounded-xl border border-[#E2D9EC] dark:border-[#372352] bg-[#F2ECF8]/50 dark:bg-[#26173A]/50"
              >
                <button
                  type="button"
                  onClick={() => setLightboxItem(item)}
                  className="block w-full text-left focus-visible:outline-none"
                  aria-label={`View larger image: ${item.caption || 'Attached photo'}`}
                >
                  <ResilientImage
                    src={item.url}
                    alt={item.caption || 'Supporting campaign photo'}
                    className={`w-full object-cover transition-transform duration-200 hover:scale-[1.01] ${
                      compact ? 'h-40' : 'h-56 sm:h-64'
                    }`}
                  />
                </button>
                {item.caption && (
                  <figcaption className="px-3 py-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          if (item.type === 'video') {
            return (
              <figure
                key={item.id}
                className="overflow-hidden rounded-xl border border-[#E2D9EC] dark:border-[#372352] bg-black"
              >
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-72"
                />
                {item.caption && (
                  <figcaption className="bg-white dark:bg-[#1B1029] px-3 py-2 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          return (
            <div
              key={item.id}
              className="rounded-xl border border-[#E2D9EC] dark:border-[#372352] bg-[#F2ECF8]/60 dark:bg-[#26173A] p-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                  External hosted video
                </p>
                <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] truncate">
                  {item.caption || item.url}
                </p>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center rounded-lg bg-[#5B1586] dark:bg-[#F7F3FC] px-3.5 py-2 text-xs font-medium text-white dark:text-[#2B0B42] whitespace-nowrap shrink-0"
              >
                Watch video
              </a>
            </div>
          );
        })}
      </div>

      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-2xl overflow-hidden bg-[#1B1029] border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              aria-label="Close image preview"
              className="absolute top-3 right-3 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-black/70 text-white hover:bg-black"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <img
              src={lightboxItem.url}
              alt={lightboxItem.caption || 'Full-size preview'}
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain bg-black"
            />
            {lightboxItem.caption && (
              <p className="p-4 text-sm text-purple-100">{lightboxItem.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};
