import React, { useState } from 'react';
import { BRAND_CONFIG, PRESET_AVATARS } from '@/src/config/brand';

export const CommonGroundEmblem: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="30" fill="#5B1586" stroke="#FFFFFF" strokeWidth="3" />
        <path
          d="M19 20H45V34C45 43.5 32 50 32 50C32 50 19 43.5 19 34V20Z"
          fill="#FFFFFF"
          stroke="#460E69"
          strokeWidth="2.5"
        />
        <path d="M22 24L42 42" stroke="#5B1586" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <img
      src={BRAND_CONFIG.logoUrl}
      alt="Kingston College Students' Council Crest"
      onError={() => setImgFailed(true)}
      className={`${className} rounded-full object-cover bg-white border border-[#E2D9EC] dark:border-[#372352] shadow-xs`}
    />
  );
};

export const MemberAvatar: React.FC<{
  displayName: string;
  avatarId?: string;
  avatarDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ displayName, avatarId, avatarDataUrl, size = 'md' }) => {
  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-16 h-16 text-lg'
      : 'w-10 h-10 text-sm';

  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt={`${displayName} avatar`}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-xl object-cover border border-[#E2D9EC] dark:border-[#372352] shrink-0`}
      />
    );
  }

  const preset =
    PRESET_AVATARS.find((p) => p.id === avatarId) ?? PRESET_AVATARS[0];
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center font-semibold shrink-0 relative overflow-hidden border border-black/10 dark:border-white/10`}
      style={{ backgroundColor: preset.bgHex, color: preset.fgHex }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 w-full h-full opacity-25"
        fill="none"
      >
        <circle cx="32" cy="8" r="14" fill={preset.accentHex} />
        <path
          d="M4 34C10 24 30 24 36 34"
          stroke={preset.fgHex}
          strokeWidth="2"
        />
      </svg>
      <span className="relative z-10">{initials || 'KC'}</span>
    </div>
  );
};

export const CivicHeroIllustration: React.FC<{ className?: string }> = ({
  className = 'w-full max-w-[260px] h-auto',
}) => (
  <svg
    viewBox="0 0 320 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="kcGlow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#5B1586" stopOpacity="0.28" />
        <stop offset="60%" stopColor="#9F5FE0" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#2B0B42" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="160" cy="100" rx="140" ry="84" fill="url(#kcGlow)" />
    <rect
      x="36"
      y="42"
      width="178"
      height="112"
      rx="14"
      className="fill-white dark:fill-[#26173A] stroke-[#E2D9EC] dark:stroke-[#372352]"
      strokeWidth="1.5"
    />
    <rect x="54" y="60" width="66" height="9" rx="4.5" fill="#5B1586" fillOpacity="0.92" />
    <rect x="54" y="80" width="136" height="8" rx="4" className="fill-[#2B0B42]/15 dark:fill-white/20" />
    <rect x="54" y="96" width="112" height="8" rx="4" className="fill-[#2B0B42]/10 dark:fill-white/15" />
    <rect x="54" y="122" width="142" height="10" rx="5" className="fill-[#F2ECF8] dark:fill-[#120A1C]" />
    <rect x="54" y="122" width="104" height="10" rx="5" fill="#0F766E" />
    <rect
      x="184"
      y="76"
      width="102"
      height="88"
      rx="12"
      className="fill-[#5B1586] dark:fill-[#7E22CE]"
    />
    <path
      d="M214 118L228 132L256 102"
      stroke="#FFFFFF"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="268" cy="52" r="14" fill="#9F5FE0" fillOpacity="0.22" />
    <circle cx="268" cy="52" r="6" fill="#5B1586" />
  </svg>
);

export const EmptyStateGraphic: React.FC<{ className?: string }> = ({
  className = 'w-28 h-24',
}) => (
  <svg
    viewBox="0 0 120 96"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="60" cy="48" r="38" className="fill-[#F2ECF8] dark:fill-[#26173A]" />
    <rect
      x="30"
      y="24"
      width="60"
      height="48"
      rx="10"
      className="fill-white dark:fill-[#1B1029] stroke-[#D2C4E3] dark:stroke-[#372352]"
      strokeWidth="1.5"
    />
    <path d="M42 40H78" stroke="#5B1586" strokeWidth="3" strokeLinecap="round" />
    <path d="M42 51H70" className="stroke-[#9F5FE0]" strokeWidth="3" strokeLinecap="round" />
    <path d="M42 61H60" className="stroke-[#D2C4E3] dark:stroke-[#4C356E]" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
