import type { AppBackupSnapshot, CampaignEvent } from '@/src/types/civic';

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeCsvCell(value: string | number | boolean | undefined): string {
  const str = value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateAnalyticsCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
  ];
  return lines.join('\r\n');
}

function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function nextDayIcsDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function generateEventIcs(event: CampaignEvent): string {
  const dtStart = toIcsDate(event.startDate);
  const dtEnd = nextDayIcsDate(event.endDate || event.startDate);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const cleanDesc = `${event.description}\\nSchedule: ${event.timeLabel}\\nOrganiser: ${event.organiserName}`.replace(/\r?\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kingston College Students Council//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@kccouncil.edu.jm`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${event.title.replace(/[\r\n]/g, ' ')}`,
    `LOCATION:${event.location.replace(/[\r\n]/g, ' ')}`,
    `DESCRIPTION:${cleanDesc}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function validateBackupSnapshot(raw: unknown): { ok: true; snapshot: AppBackupSnapshot } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Backup file is not a valid JSON object.' };
  }
  const obj = raw as Partial<AppBackupSnapshot>;
  if (obj.schemaVersion !== 1 || !obj.member || typeof obj.member.uid !== 'string' || typeof obj.member.email !== 'string') {
    return { ok: false, error: 'Unrecognized backup file format or missing member identity.' };
  }
  if (!Array.isArray(obj.authoredPetitions) || !Array.isArray(obj.signedPetitionIds) || !Array.isArray(obj.comments)) {
    return { ok: false, error: 'Backup snapshot is missing petition or contribution arrays.' };
  }
  return { ok: true, snapshot: obj as AppBackupSnapshot };
}
