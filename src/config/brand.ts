import heroCommonsImg from '@/src/assets/images/hero_civic_commons_1794875782385.jpg';
import streetLightingImg from '@/src/assets/images/campaign_street_lighting_1794875782134.jpg';
import communityGardenImg from '@/src/assets/images/campaign_community_garden_1794875782663.jpg';
import accessibleTransitImg from '@/src/assets/images/campaign_accessible_transit_1794875782912.jpg';
import townHallImg from '@/src/assets/images/event_town_hall_1794875783469.jpg';

/**
 * Resolves app-local asset paths (such as /kc-council-logo.png or legacy /src/assets/...)
 * against Vite's configured BASE_URL so subpath hosting (e.g. GitHub Pages) works seamlessly.
 */
export function resolveAssetUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  if (url.startsWith('./')) {
    return `${normalizedBase}${url.slice(2)}`;
  }

  if (
    url.startsWith('/src/assets/') ||
    url.startsWith('/kc-council-logo') ||
    url.startsWith('/assets/') ||
    url.startsWith('/pwa-') ||
    url.startsWith('/icon') ||
    url.startsWith('/apple-touch-icon')
  ) {
    return `${normalizedBase}${url.slice(1)}`;
  }

  return url;
}

/**
 * Central brand configuration for Kingston College Students' Council.
 * Rename or re-configure platform identity strings in this single file.
 */
export const PRIMARY_ADMIN_EMAIL = 'kc.studentscouncil1@gmail.com' as const;

export const BRAND_CONFIG = {
  name: "KC Students' Council",
  fullName: "Kingston College Students' Council",
  schoolName: 'Kingston College, Jamaica',
  motto: 'Fortis Cadere Cedere Non Potest',
  logoUrl: resolveAssetUrl('kc-council-logo.png'),
  tagline: 'Student petitions, verified Fortis voices, and accountable council action.',
  mission:
    "The official student issues and petitions portal for Kingston College (North Street, Kingston, Jamaica). Raise school concerns, gather verified support, and track Council and Administration responses on the record.",
  supportEmail: PRIMARY_ADMIN_EMAIL,
} as const;

export const KC_GRADES = [
  'Grade 7 (1st Form)',
  'Grade 8 (2nd Form)',
  'Grade 9 (3rd Form)',
  'Grade 10 (4th Form)',
  'Grade 11 (5th Form)',
  'Grade 12 (Lower 6th)',
  'Grade 13 (Upper 6th)',
] as const;

export const KC_CLASSES = [
  'Macdonald',
  'Gibson',
  'Hardie',
  'Holding',
  'Forrest',
  'Science',
  'Arts',
  'Business',
  'Technical',
] as const;

export const PETITION_CATEGORIES = [
  'Campus Facilities & Grounds',
  'Academics & Library',
  'Sports & Athletics',
  'Canteen & Nutrition',
  'Clubs, Societies & Arts',
  'Student Welfare & Safety',
  'School Policies & Events',
] as const;

export type PetitionCategory = (typeof PETITION_CATEGORIES)[number];

/**
 * Generated editorial imagery stored locally in /src/assets/images/.
 * Bundled via static ES imports so Vite applies the configured base path automatically.
 */
export const CIVIC_IMAGES = {
  heroCommons: heroCommonsImg,
  streetLighting: streetLightingImg,
  communityGarden: communityGardenImg,
  accessibleTransit: accessibleTransitImg,
  townHall: townHallImg,
} as const;

export interface PresetAvatar {
  id: string;
  label: string;
  bgHex: string;
  fgHex: string;
  accentHex: string;
}

/** Kingston College purple, white, and civic geometric avatar presets. */
export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'fortis-purple', label: 'Fortis Purple', bgHex: '#5B1586', fgHex: '#FFFFFF', accentHex: '#D8B4FE' },
  { id: 'royal-plum', label: 'Royal Plum', bgHex: '#3B0D5C', fgHex: '#FAF8FC', accentHex: '#FCD34D' },
  { id: 'lavender-white', label: 'White & Purple', bgHex: '#F3ECF8', fgHex: '#4A0E73', accentHex: '#7E22CE' },
  { id: 'harbor-teal', label: 'Civic Teal', bgHex: '#0F766E', fgHex: '#FFFFFF', accentHex: '#99F6E4' },
  { id: 'slate-ridge', label: 'Slate Violet', bgHex: '#3B3355', fgHex: '#F8FAFC', accentHex: '#C084FC' },
  { id: 'gold-crest', label: 'Fortis Gold', bgHex: '#78350F', fgHex: '#FFFBEB', accentHex: '#FDE68A' },
];
