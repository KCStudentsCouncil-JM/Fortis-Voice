import { PRIMARY_ADMIN_EMAIL } from '@/src/config/brand';
import type { Member, Petition, UserRole } from '@/src/types/civic';
import { normalizeEmail } from '@/src/utils/storageGuard';

export interface PermissionSet {
  role: UserRole;
  isVerified: boolean;
  canBrowsePublic: boolean;
  canSign: boolean;
  canComment: boolean;
  canVotePoll: boolean;
  canRsvpEvent: boolean;
  canCreatePetition: boolean;
  canPublishOfficialUpdate: boolean;
  canAttachMediaToUpdate: boolean;
  canCreateEvent: boolean;
  canDeleteAnyEvent: boolean;
  canModerate: boolean;
  canManageDirectory: boolean;
  canViewAnalytics: boolean;
  canPostNotice: boolean;
}

export function getEffectiveRole(member: Member | null): UserRole {
  if (!member) return 'visitor';
  return member.role;
}

export function getPermissions(member: Member | null): PermissionSet {
  const role = getEffectiveRole(member);
  const isVerified = Boolean(member && member.accountStatus === 'approved');
  const isOrganiserOrMod = isVerified && (role === 'organiser' || role === 'moderator');
  const isModerator = isVerified && role === 'moderator';

  return {
    role,
    isVerified,
    canBrowsePublic: true,
    canSign: isVerified,
    canComment: isVerified,
    canVotePoll: isVerified,
    canRsvpEvent: isVerified,
    canCreatePetition: isVerified,
    canPublishOfficialUpdate: isOrganiserOrMod,
    canAttachMediaToUpdate: isOrganiserOrMod,
    canCreateEvent: isOrganiserOrMod,
    canDeleteAnyEvent: isModerator,
    canModerate: isModerator,
    canManageDirectory: isModerator,
    canViewAnalytics: isModerator,
    canPostNotice: isModerator,
  };
}

export function canViewPetition(petition: Petition, member: Member | null): boolean {
  if (
    petition.status === 'live' ||
    petition.status === 'responded' ||
    petition.status === 'achieved' ||
    petition.status === 'closed'
  ) {
    return true;
  }
  if (!member) return false;
  if (member.role === 'moderator' && member.accountStatus === 'approved') return true;
  return petition.authorId === member.uid;
}

export function canEditPetition(petition: Petition, member: Member | null): boolean {
  if (!member || member.accountStatus !== 'approved') return false;
  if (member.role === 'moderator') return true;
  return (
    petition.authorId === member.uid &&
    (petition.status === 'draft' ||
      petition.status === 'pending_review' ||
      petition.status === 'declined')
  );
}

export function isPrimaryAdmin(member: Pick<Member, 'email'> | null | undefined): boolean {
  if (!member?.email) return false;
  return normalizeEmail(member.email) === PRIMARY_ADMIN_EMAIL;
}

export function formatRoleLabel(role: UserRole, isMainAdmin = false): string {
  if (isMainAdmin) return 'Main Administrator';
  switch (role) {
    case 'moderator':
      return 'Moderator';
    case 'organiser':
      return 'Verified Organiser';
    case 'member':
      return 'Verified Member';
    default:
      return 'Visitor';
  }
}
