import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Compass,
  FileText,
  Home,
  Info,
  Layers,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import { MemberAvatar, CommonGroundEmblem } from '@/src/components/ui/CivicGraphics';
import { PWAInstallButton } from '@/src/components/ui/PWAControls';
import { BRAND_CONFIG, PETITION_CATEGORIES } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import { useTheme } from '@/src/hooks/useTheme';
import type { AppView, PetitionStatus } from '@/src/types/civic';
import { formatRoleLabel, isPrimaryAdmin } from '@/src/utils/permissions';

interface AppShellProps {
  children: React.ReactNode;
  onOpenDocs: () => void;
}

const PUBLIC_STATUSES: PetitionStatus[] = ['live', 'responded', 'achieved', 'closed'];

export const AppShell: React.FC<AppShellProps> = ({ children, onOpenDocs }) => {
  const {
    snapshot,
    repo,
    permissions,
    nav,
    navigate,
    setSearchQuery,
    pushToast,
  } = useCivic();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [profileMenuOpen]);

  // Hide mobile bottom navigation while a text field is focused so the on-screen keyboard does not cover it
  useEffect(() => {
    const isTextControl = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'select') return true;
      if (tag === 'input') {
        const type = (el as HTMLInputElement).type;
        return !['checkbox', 'radio', 'button', 'submit', 'file'].includes(type);
      }
      return el.isContentEditable;
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isTextControl(e.target)) setInputFocused(true);
    };
    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!isTextControl(document.activeElement)) {
          setInputFocused(false);
        }
      }, 60);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const me = snapshot.currentUser;
  const pendingReviewCount = snapshot.petitions.filter(
    (p) => p.status === 'pending_review'
  ).length;
  const pendingMembersCount = snapshot.members.filter(
    (m) => m.accountStatus === 'pending'
  ).length;

  const { totalPublicCount, countsByCategory } = useMemo(() => {
    const publicList = snapshot.petitions.filter((p) => PUBLIC_STATUSES.includes(p.status));
    const map: Record<string, number> = {};
    for (const cat of PETITION_CATEGORIES) {
      map[cat] = 0;
    }
    for (const p of publicList) {
      map[p.category] = (map[p.category] ?? 0) + 1;
    }
    return { totalPublicCount: publicList.length, countsByCategory: map };
  }, [snapshot.petitions]);

  const handleStartPetition = () => {
    if (!me) {
      navigate({ view: 'auth' });
      pushToast({
        tone: 'info',
        title: 'Sign in to start a petition',
        description: 'Verified Kingston College students can draft and submit petitions.',
      });
      return;
    }
    if (!permissions.canCreatePetition) {
      navigate({ view: 'auth' });
      return;
    }
    navigate({ view: 'create', editingPetitionId: undefined });
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await repo.signOut();
    navigate({ view: 'feed' });
    pushToast({ tone: 'info', title: 'Signed out' });
  };

  const primaryNavItems: Array<{
    view: AppView;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    requiresAuth?: boolean;
  }> = [
    { view: 'feed', label: 'Petitions Feed', Icon: Home },
    { view: 'activity', label: 'My Activity', Icon: Compass, requiresAuth: true },
    { view: 'drafts', label: 'My Drafts', Icon: FileText, requiresAuth: true },
    { view: 'events', label: 'Campaigns & Events', Icon: CalendarDays },
    { view: 'notices', label: 'Notice Board', Icon: Megaphone },
  ];

  const moderatorNavItems: Array<{
    view: AppView;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { view: 'queue', label: 'Review Queue', Icon: CheckSquare, badge: pendingReviewCount },
    { view: 'directory', label: 'Student Directory', Icon: Users, badge: pendingMembersCount },
    { view: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ];

  const activeCategory = nav.categoryFilter ?? 'All';
  const activeSort = nav.sortMode ?? 'newest';

  const renderSidebarLinks = (compact: boolean) => (
    <nav aria-label="Primary sections" className="flex-1 px-2.5 py-4 space-y-5 overflow-y-auto">
      {/* Main Community Navigation */}
      <div className="space-y-1">
        {!compact && (
          <p className="px-3 pb-1 text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC]">
            Campus Portal
          </p>
        )}
        {primaryNavItems
          .filter((item) => !item.requiresAuth || Boolean(me))
          .map(({ view, label, Icon }) => {
            const active =
              nav.view === view &&
              (view !== 'feed' || (activeSort === 'newest' && activeCategory === 'All'));
            return (
              <button
                key={view}
                type="button"
                onClick={() => {
                  if (view === 'feed') {
                    navigate({ view: 'feed', sortMode: 'newest', categoryFilter: 'All' });
                  } else {
                    navigate({ view });
                  }
                  setMobileMenuOpen(false);
                }}
                title={compact ? label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#5B1586] text-white dark:bg-[#7E22CE] dark:text-white'
                    : 'text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
                } ${compact ? 'justify-center px-2' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {!compact && <span className="truncate">{label}</span>}
              </button>
            );
          })}
      </div>

      {/* Discover: What's New & Trending */}
      <div className="space-y-1 pt-3 border-t border-[#E2D9EC] dark:border-[#372352]">
        {!compact && (
          <p className="px-3 pb-1 text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC]">
            Discover
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            navigate({ view: 'feed', sortMode: 'newest', categoryFilter: 'All' });
            setMobileMenuOpen(false);
          }}
          title={compact ? "What's New" : undefined}
          aria-pressed={nav.view === 'feed' && activeSort === 'newest' && activeCategory === 'All'}
          className={`w-full min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            nav.view === 'feed' && activeSort === 'newest' && activeCategory === 'All'
              ? 'bg-[#5B1586]/12 text-[#460E69] dark:bg-[#7E22CE]/30 dark:text-[#E9D5FF] font-semibold'
              : 'text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
          } ${compact ? 'justify-center px-2' : ''}`}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-[#5B1586] dark:text-[#C084FC]" aria-hidden="true" />
          {!compact && <span className="truncate">What&apos;s New</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            navigate({ view: 'feed', sortMode: 'trending', categoryFilter: 'All' });
            setMobileMenuOpen(false);
          }}
          title={compact ? 'Trending' : undefined}
          aria-pressed={nav.view === 'feed' && activeSort === 'trending'}
          className={`w-full min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            nav.view === 'feed' && activeSort === 'trending'
              ? 'bg-[#5B1586] text-white dark:bg-[#7E22CE] dark:text-white'
              : 'text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
          } ${compact ? 'justify-center px-2' : ''}`}
        >
          <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!compact && <span className="truncate">Trending</span>}
        </button>
      </div>

      {/* Categories Filter */}
      <div className="space-y-1 pt-3 border-t border-[#E2D9EC] dark:border-[#372352]">
        {compact ? (
          <button
            type="button"
            onClick={() => {
              setSidebarCollapsed(false);
              navigate({ view: 'feed' });
            }}
            title="Expand to browse categories"
            aria-label="Expand sidebar to browse categories"
            className="w-full min-h-[44px] flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
          >
            <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <>
            <p className="px-3 pb-1 text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC]">
              Categories
            </p>
            <button
              type="button"
              onClick={() => {
                navigate({ view: 'feed', categoryFilter: 'All' });
                setMobileMenuOpen(false);
              }}
              className={`w-full min-h-[38px] flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                nav.view === 'feed' && activeCategory === 'All'
                  ? 'bg-[#F2ECF8] text-[#460E69] dark:bg-[#26173A] dark:text-[#E9D5FF] font-semibold'
                  : 'text-[#5B506B] dark:text-[#B7A8CC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">All Categories</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                {totalPublicCount}
              </span>
            </button>
            {PETITION_CATEGORIES.map((cat) => {
              const isCatActive = nav.view === 'feed' && activeCategory === cat;
              const catCount = countsByCategory[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    navigate({ view: 'feed', categoryFilter: cat });
                    setMobileMenuOpen(false);
                  }}
                  aria-pressed={isCatActive}
                  className={`w-full min-h-[38px] flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isCatActive
                      ? 'bg-[#5B1586] text-white dark:bg-[#7E22CE] dark:text-white'
                      : 'text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Tag className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
                    <span className="truncate">{cat}</span>
                  </span>
                  <span
                    className={`font-mono tabular-nums text-[11px] shrink-0 ${
                      isCatActive ? 'text-white/90' : 'text-[#5B506B] dark:text-[#B7A8CC]'
                    }`}
                  >
                    {catCount}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Moderation */}
      {permissions.canModerate && (
        <div className="space-y-1 pt-3 border-t border-[#E2D9EC] dark:border-[#372352]">
          {!compact && (
            <p className="px-3 pb-1 text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC]">
              Council Moderation
            </p>
          )}
          {moderatorNavItems.map(({ view, label, Icon, badge }) => {
            const active = nav.view === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => {
                  navigate({ view });
                  setMobileMenuOpen(false);
                }}
                title={compact ? label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[44px] flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#5B1586] text-white dark:bg-[#7E22CE] dark:text-white'
                    : 'text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]'
                } ${compact ? 'justify-center px-2' : ''}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!compact && <span className="truncate">{label}</span>}
                </span>
                {!compact && typeof badge === 'number' && badge > 0 && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-mono tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-[#5B1586]/15 text-[#5B1586] dark:bg-[#7E22CE]/35 dark:text-[#E9D5FF]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-[#E2D9EC] dark:border-[#372352] space-y-1">
        <button
          type="button"
          onClick={() => {
            onOpenDocs();
            setMobileMenuOpen(false);
          }}
          title={compact ? 'Governance & Rules' : undefined}
          className={`w-full min-h-[44px] flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#5B506B] dark:text-[#B7A8CC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors whitespace-nowrap ${
            compact ? 'justify-center px-2' : ''
          }`}
        >
          <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!compact && <span className="truncate">Governance &amp; Rules</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-[#F5EDFC] to-[#E2C9F8] dark:bg-none dark:bg-[#120A1C] text-[#261D33] dark:text-[#E7DFF2]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 pt-safe border-b border-[#DFD1EE] dark:border-[#372352] bg-gradient-to-r from-white/95 via-[#FAF6FE]/95 to-[#F1E4FC]/95 dark:bg-none dark:bg-[#1B1029]/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Brand & Sidebar drawer trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ view: 'feed', sortMode: 'newest', categoryFilter: 'All' })}
              className="min-h-[44px] flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 rounded-lg px-1"
            >
              <CommonGroundEmblem className="w-9 h-9 shrink-0" />
              <span className="font-['BBH_Bogle',sans-serif] text-[20px] leading-[28px] font-normal text-justify tracking-tight text-[#2B0B42] dark:text-[#F7F3FC]">
                Fortis Voice
              </span>
            </button>
          </div>

          {/* Zone 2: Full-word & reference search bar */}
          <div className="hidden md:flex flex-1 max-w-md items-center">
            <label htmlFor="global-petition-search" className="sr-only">
              Search petitions by full word or reference number
            </label>
            <div className="relative w-full">
              <Search
                className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="global-petition-search"
                type="search"
                value={nav.searchQuery ?? ''}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (nav.view !== 'feed') navigate({ view: 'feed' });
                }}
                placeholder="Search full words or ref (e.g. PET-1041)…"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] pl-9 pr-3 py-2 text-sm text-[#2B0B42] dark:text-[#F7F3FC] placeholder:text-[#5B506B] dark:placeholder:text-[#B7A8CC]"
              />
            </div>
          </div>

          {/* Zone 3: Theme, Start Petition CTA, and Profile/Sign In */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2D9EC] dark:border-[#372352] text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleStartPetition}
              className="hidden sm:inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 active:translate-y-px"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Start a petition</span>
            </button>

            {me ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu for ${me.displayName}`}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-2.5 py-1.5 hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors"
                >
                  <MemberAvatar
                    displayName={me.displayName}
                    avatarId={me.avatarId}
                    avatarDataUrl={me.avatarDataUrl}
                    size="sm"
                  />
                  <span className="hidden lg:inline text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC] max-w-[120px] truncate">
                    {me.displayName}
                  </span>
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E2D9EC] dark:border-[#372352] bg-white dark:bg-[#1B1029] shadow-xl p-2 z-50"
                  >
                    <div className="px-3 py-2 border-b border-[#E2D9EC] dark:border-[#372352]">
                      <p className="text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC] truncate">
                        {me.displayName}
                      </p>
                      <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] truncate">
                        {isPrimaryAdmin(me)
                          ? `Main Administrator${me.grade ? ` · ${me.grade}` : ''}`
                          : me.grade
                          ? `${me.grade}${me.studentClass ? ` · ${me.studentClass}` : ''}`
                          : `${formatRoleLabel(me.role)} · ${me.accountStatus}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate({ view: 'profile' });
                      }}
                      className="w-full min-h-[44px] flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] mt-1"
                    >
                      <User className="w-4 h-4" aria-hidden="true" />
                      <span>Student Profile &amp; Backup</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate({ view: 'auth' });
                      }}
                      className="w-full min-h-[44px] flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#261D33] dark:text-[#E7DFF2] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Account &amp; Verification</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleSignOut()}
                      className="w-full min-h-[44px] flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ view: 'auth' })}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#5B1586] dark:border-[#C084FC] px-3.5 py-2 text-sm font-medium text-[#5B1586] dark:text-[#E9D5FF] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout: Collapsible Desktop Sidebar + Content */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
        <aside
          aria-label="Workspace sidebar"
          className={`hidden lg:flex flex-col shrink-0 border-r border-[#DFD1EE] dark:border-[#372352] bg-gradient-to-b from-white/95 via-[#FBF8FE]/92 to-[#EFE1FB]/92 dark:bg-none dark:bg-[#1B1029]/85 backdrop-blur-sm transition-all duration-200 ${
            sidebarCollapsed ? 'w-[76px]' : 'w-68'
          }`}
        >
          {renderSidebarLinks(sidebarCollapsed)}
          <div className="p-2.5 border-t border-[#E2D9EC] dark:border-[#372352]">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
                  <span>Collapse sidebar</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Scrollable Viewport */}
        <main
          id="main-content"
          className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 civic-gradient-light"
        >
          {!snapshot.ready ? (
            <div className="space-y-4 max-w-4xl" aria-busy="true" aria-label="Loading platform data">
              <div className="h-36 rounded-2xl bg-white/70 dark:bg-[#1B1029] animate-pulse border border-[#E2D9EC] dark:border-[#372352]" />
              <div className="h-44 rounded-2xl bg-white/70 dark:bg-[#1B1029] animate-pulse border border-[#E2D9EC] dark:border-[#372352]" />
              <div className="h-44 rounded-2xl bg-white/70 dark:bg-[#1B1029] animate-pulse border border-[#E2D9EC] dark:border-[#372352]" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation drawer"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-gradient-to-b from-white via-[#FAF6FE] to-[#F1E4FC] dark:bg-none dark:bg-[#1B1029] h-full flex flex-col border-r border-[#DFD1EE] dark:border-[#372352] z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#E2D9EC] dark:border-[#372352]">
              <div className="flex items-center gap-2.5">
                <CommonGroundEmblem className="w-8 h-8" />
                <span className="font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                  {BRAND_CONFIG.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5B506B] dark:text-[#B7A8CC]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {renderSidebarLinks(false)}
            <div className="p-4 border-t border-[#E2D9EC] dark:border-[#372352]">
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation with Raised Central Action Button — hides when text field focused */}
      {!inputFocused && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#DFD1EE] dark:border-[#372352] bg-gradient-to-r from-white/95 via-[#FAF6FE]/95 to-[#F3E9FC]/95 dark:bg-none dark:bg-[#1B1029]/95 backdrop-blur-md pb-safe"
        >
          <div className="grid grid-cols-5 items-end h-16 px-1">
            <button
              type="button"
              onClick={() => navigate({ view: 'feed' })}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                nav.view === 'feed'
                  ? 'text-[#5B1586] dark:text-[#C084FC]'
                  : 'text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <Home className="w-5 h-5" aria-hidden="true" />
              <span>Feed</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ view: 'events' })}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                nav.view === 'events'
                  ? 'text-[#5B1586] dark:text-[#C084FC]'
                  : 'text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <CalendarDays className="w-5 h-5" aria-hidden="true" />
              <span>Events</span>
            </button>

            <div className="flex flex-col items-center justify-center -mt-4">
              <button
                type="button"
                onClick={handleStartPetition}
                aria-label="Start a petition"
                className="h-12 w-12 rounded-2xl bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] text-white shadow-md flex items-center justify-center transition-transform active:scale-95"
              >
                <Plus className="w-6 h-6" aria-hidden="true" />
              </button>
              <span className="text-[10px] font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mt-0.5">
                Start
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate({ view: 'notices' })}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                nav.view === 'notices'
                  ? 'text-[#5B1586] dark:text-[#C084FC]'
                  : 'text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <Megaphone className="w-5 h-5" aria-hidden="true" />
              <span>Notices</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ view: me ? 'profile' : 'auth' })}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                nav.view === 'profile' || nav.view === 'auth'
                  ? 'text-[#5B1586] dark:text-[#C084FC]'
                  : 'text-[#5B506B] dark:text-[#B7A8CC]'
              }`}
            >
              <User className="w-5 h-5" aria-hidden="true" />
              <span>{me ? 'Profile' : 'Sign in'}</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
