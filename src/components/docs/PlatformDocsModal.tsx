import React from 'react';
import { X } from 'lucide-react';
import { BRAND_CONFIG } from '@/src/config/brand';

export const PlatformDocsModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#E2D9EC] dark:border-[#372352] pb-4">
          <h2
            id="docs-modal-title"
            className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]"
          >
            {BRAND_CONFIG.fullName} Governance &amp; Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close governance documentation"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5B506B] dark:text-[#B7A8CC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-[#261D33] dark:text-[#E7DFF2]">
          <section className="space-y-1.5">
            <h3 className="font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              1. Reference Number Scheme
            </h3>
            <p className="text-xs sm:text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              Every record receives a structured prefix reflecting its lifecycle state:
              <span className="font-mono"> DRF-</span> (private draft),{' '}
              <span className="font-mono">REV-</span> (awaiting Council review),{' '}
              <span className="font-mono">PET-</span> (open/responded petition),{' '}
              <span className="font-mono">CMP-</span> (school initiative),{' '}
              <span className="font-mono">RES-</span> (achieved/resolved),{' '}
              <span className="font-mono">DEC-</span> (declined), and{' '}
              <span className="font-mono">EVT-</span> (campaign event). Search accepts either full prefixed IDs or bare numbers.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              2. Target Response Windows (SLA Transparency)
            </h3>
            <p className="text-xs sm:text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              Urgent campus issues carry a 24-hour target window, standard issues 48 hours, and low-urgency initiatives 72 hours. Countdowns anchor monotonically to the session start so local clock changes cannot game remaining time.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              3. Student Anonymity &amp; Moderation Integrity
            </h3>
            <p className="text-xs sm:text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              Anonymous submissions hide the student&apos;s name, class, and affiliation from the public feed and other students while keeping an internal account reference for Council moderation and safeguarding.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              4. Live Firebase vs Local Demo Mode
            </h3>
            <p className="text-xs sm:text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              In Live Firebase Mode, student accounts and permissions are enforced server-side via Firestore Security Rules and Google Authentication. Local Demo Mode runs inside browser storage so Kingston College reviewers can explore all four roles without provisioning external accounts; it is explicitly not a secure multi-user boundary.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
