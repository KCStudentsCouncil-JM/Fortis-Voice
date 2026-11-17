import type { Petition, PetitionUrgency } from '@/src/types/civic';

export const SLA_HOURS_BY_URGENCY: Record<PetitionUrgency, number> = {
  urgent: 24,
  standard: 48,
  low: 72,
};

/**
 * Monotonic, session-anchored clock.
 * Anchors to initial wall-clock timestamp + high-resolution performance.now() delta
 * so changing the device clock mid-session cannot manipulate SLA countdowns.
 */
const SESSION_WALL_ANCHOR_MS = Date.now();
const SESSION_PERF_ANCHOR_MS = typeof performance !== 'undefined' ? performance.now() : 0;

export function getMonotonicNowMs(): number {
  if (typeof performance === 'undefined') return Date.now();
  const perfElapsed = performance.now() - SESSION_PERF_ANCHOR_MS;
  return SESSION_WALL_ANCHOR_MS + Math.max(0, perfElapsed);
}

export function computeSlaDeadlineIso(createdAtIso: string, urgency: PetitionUrgency): {
  slaHours: number;
  slaDeadlineAt: string;
} {
  const slaHours = SLA_HOURS_BY_URGENCY[urgency];
  const baseMs = Date.parse(createdAtIso) || getMonotonicNowMs();
  const deadlineMs = baseMs + slaHours * 60 * 60 * 1000;
  return {
    slaHours,
    slaDeadlineAt: new Date(deadlineMs).toISOString(),
  };
}

export type SlaHealthState = 'responded' | 'overdue' | 'due_soon' | 'on_track' | 'inactive';

export interface SlaStatusSummary {
  state: SlaHealthState;
  label: string;
  detail: string;
  remainingMs: number;
}

function formatDuration(ms: number): string {
  const absMinutes = Math.max(1, Math.round(Math.abs(ms) / 60000));
  const days = Math.floor(absMinutes / (60 * 24));
  const hours = Math.floor((absMinutes % (60 * 24)) / 60);
  const mins = absMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function evaluatePetitionSla(
  petition: Pick<Petition, 'status' | 'slaHours' | 'slaDeadlineAt' | 'respondedAt'>,
  nowMs: number = getMonotonicNowMs()
): SlaStatusSummary {
  if (petition.status === 'responded' || petition.status === 'achieved' || petition.respondedAt) {
    return {
      state: 'responded',
      label: 'Responded',
      detail: petition.respondedAt
        ? `Official response recorded ${new Date(petition.respondedAt).toLocaleDateString()}`
        : 'Official response recorded',
      remainingMs: 0,
    };
  }

  if (petition.status === 'draft' || petition.status === 'declined' || petition.status === 'closed') {
    return {
      state: 'inactive',
      label: 'Closed window',
      detail: 'Response clock paused',
      remainingMs: 0,
    };
  }

  const deadlineMs = Date.parse(petition.slaDeadlineAt);
  if (Number.isNaN(deadlineMs)) {
    return {
      state: 'on_track',
      label: `${petition.slaHours}h target`,
      detail: 'Response window active',
      remainingMs: petition.slaHours * 3600000,
    };
  }

  const remainingMs = deadlineMs - nowMs;
  const totalWindowMs = petition.slaHours * 3600000;

  if (remainingMs < 0) {
    return {
      state: 'overdue',
      label: `Overdue by ${formatDuration(remainingMs)}`,
      detail: `Exceeded ${petition.slaHours}h target response window`,
      remainingMs,
    };
  }

  if (remainingMs <= totalWindowMs * 0.25) {
    return {
      state: 'due_soon',
      label: `${formatDuration(remainingMs)} remaining`,
      detail: `${petition.slaHours}h target response window`,
      remainingMs,
    };
  }

  return {
    state: 'on_track',
    label: `${formatDuration(remainingMs)} remaining`,
    detail: `${petition.slaHours}h target response window`,
    remainingMs,
  };
}
