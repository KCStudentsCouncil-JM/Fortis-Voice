import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Edit3,
  FilePlus2,
  MapPin,
  Pin,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CommonGroundEmblem, EmptyStateGraphic } from '@/src/components/ui/CivicGraphics';
import {
  ProgressBar,
  ResilientImage,
  StatusBadge,
  UrgencyIndicator,
} from '@/src/components/ui/Primitives';
import { BRAND_CONFIG, CIVIC_IMAGES, PETITION_CATEGORIES } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import type { FeedSortMode, Petition, PetitionStatus } from '@/src/types/civic';
import { matchesPetitionSearch } from '@/src/utils/search';
import { evaluatePetitionSla } from '@/src/utils/sla';

interface PetitionFeedProps {
  mode: 'feed' | 'activity' | 'drafts';
}

const PUBLIC_STATUSES: PetitionStatus[] = ['live', 'responded', 'achieved', 'closed'];

export const PetitionFeed: React.FC<PetitionFeedProps> = ({ mode }) => {
  const {
    snapshot,
    nav,
    navigate,
    openPetition,
    setSearchQuery,
    setCategoryFilter,
    setSortMode,
    getDisplaySignatureCount,
  } = useCivic();

  const [statusFilter, setStatusFilter] = useState<'all' | PetitionStatus>('all');
  const me = snapshot.currentUser;
  const searchQuery = nav.searchQuery ?? '';
  const categoryFilter = nav.categoryFilter ?? 'All';
  const sortMode: FeedSortMode = nav.sortMode ?? 'newest';

  const visiblePetitions = useMemo(() => {
    let base: Petition[] = [];

    if (mode === 'feed') {
      // Strictly never surface drafts, pending_review, or declined petitions in the public feed
      base = snapshot.petitions.filter((p) => PUBLIC_STATUSES.includes(p.status));
    } else if (mode === 'drafts') {
      base = me
        ? snapshot.petitions.filter(
            (p) =>
              p.authorId === me.uid &&
              (p.status === 'draft' || p.status === 'pending_review' || p.status === 'declined')
          )
        : [];
    } else {
      // My Activity: petitions signed, created, or commented on by the current student
      if (!me) {
        base = [];
      } else {
        base = snapshot.petitions.filter((p) => {
          const authored = p.authorId === me.uid;
          const signed = (snapshot.signaturesByPetition[p.id] ?? []).some(
            (s) => s.userId === me.uid
          );
          const commented = (snapshot.activityByPetition[p.id] ?? []).some(
            (a) => a.authorId === me.uid
          );
          return authored || signed || commented;
        });
      }
    }

    if (categoryFilter !== 'All') {
      base = base.filter((p) => p.category === categoryFilter);
    }

    if (mode === 'feed' && statusFilter !== 'all') {
      base = base.filter((p) => p.status === statusFilter);
    }

    if (searchQuery.trim()) {
      base = base.filter((p) => matchesPetitionSearch(p, searchQuery));
    }

    const computeTrendingScore = (p: Petition): number => {
      const sigs = getDisplaySignatureCount(p.id, p.signatureCount);
      const goalRatio = p.goalSignatures > 0 ? sigs / p.goalSignatures : 0;
      const threadCount = (snapshot.activityByPetition[p.id] ?? []).length;
      const hoursSinceUpdate = Math.max(
        1,
        (Date.now() - Date.parse(p.updatedAt || p.createdAt)) / 3600000
      );
      const recencyBoost = Math.max(0, 72 - hoursSinceUpdate) * 1.5;
      const openBoost = p.status === 'live' ? 40 : 0;
      return sigs * 0.4 + goalRatio * 120 + threadCount * 15 + recencyBoost + openBoost;
    };

    const sorted = [...base].sort((a, b) => {
      // Pinned petitions lead the public feed unless explicitly sorting by Trending
      if (mode === 'feed' && sortMode !== 'trending' && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      if (sortMode === 'trending') {
        return computeTrendingScore(b) - computeTrendingScore(a);
      }
      if (sortMode === 'most_signed') {
        return (
          getDisplaySignatureCount(b.id, b.signatureCount) -
          getDisplaySignatureCount(a.id, a.signatureCount)
        );
      }
      if (sortMode === 'closing_soon') {
        const aTime = Date.parse(a.slaDeadlineAt) || Number.MAX_SAFE_INTEGER;
        const bTime = Date.parse(b.slaDeadlineAt) || Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });

    return sorted;
  }, [
    categoryFilter,
    getDisplaySignatureCount,
    me,
    mode,
    searchQuery,
    snapshot.activityByPetition,
    snapshot.petitions,
    snapshot.signaturesByPetition,
    sortMode,
    statusFilter,
  ]);

  const publicMetrics = useMemo(() => {
    const publicList = snapshot.petitions.filter((p) => PUBLIC_STATUSES.includes(p.status));
    const totalSigs = publicList.reduce(
      (sum, p) => sum + getDisplaySignatureCount(p.id, p.signatureCount),
      0
    );
    const respondedOrAchieved = publicList.filter(
      (p) => p.status === 'responded' || p.status === 'achieved'
    ).length;
    return {
      openCount: publicList.filter((p) => p.status === 'live').length,
      totalSigs,
      respondedOrAchieved,
    };
  }, [getDisplaySignatureCount, snapshot.petitions]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Public Portal Hero (shown on main feed) */}
      {mode === 'feed' && (
        <section className="rounded-2xl overflow-hidden border border-[#DFD1EE] dark:border-[#372352] bg-gradient-to-br from-white via-[#FAF6FE] to-[#EFE2FC] dark:bg-none dark:bg-[#1B1029] shadow-xs grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <CommonGroundEmblem className="w-11 h-11 shrink-0" />
                <p className="text-xs font-semibold text-[#5B1586] dark:text-[#C084FC]">
                  Kingston College · North Street, Kingston · {BRAND_CONFIG.motto}
                </p>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#2B0B42] dark:text-[#F7F3FC] [text-wrap:balance]">
                {BRAND_CONFIG.tagline}
              </h1>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#5B506B] dark:text-[#B7A8CC] max-w-2xl">
                {BRAND_CONFIG.mission}
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate({ view: me ? 'create' : 'auth' })}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                  <span>Start a petition</span>
                </button>
                {!me && (
                  <button
                    type="button"
                    onClick={() => navigate({ view: 'auth' })}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#5B1586] dark:border-[#C084FC] px-5 py-2.5 text-sm font-semibold text-[#5B1586] dark:text-[#E9D5FF] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A] transition-colors"
                  >
                    <span>Student Sign up / Sign in</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-[#E2D9EC] dark:border-[#372352] grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#2B0B42] dark:text-[#F7F3FC]">
                    {publicMetrics.openCount}
                  </p>
                  <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">Live petitions</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#5B1586] dark:text-[#C084FC]">
                    {publicMetrics.totalSigs.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">Student endorsements</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#0F766E] dark:text-[#2DD4BF]">
                    {publicMetrics.respondedOrAchieved}
                  </p>
                  <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">Responded / Achieved</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[200px] lg:min-h-full">
            <ResilientImage
              src={CIVIC_IMAGES.heroCommons}
              alt="Kingston College campus walkway and student commons"
              className="w-full h-full object-cover lg:h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2B0B42]/85 via-[#460E69]/30 to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xs font-medium text-white/95">
                Every signature is verified once per student. Every Council &amp; Administration response stays on the record.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Sub-view Headers for My Activity and My Drafts */}
      {mode !== 'feed' && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              {mode === 'activity' ? 'My Student Activity' : 'My Drafts & Submissions'}
            </h1>
            <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
              {mode === 'activity'
                ? 'Petitions you have authored, endorsed, or discussed.'
                : 'Private drafts, pending submissions, and declined proposals awaiting edits.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ view: 'create', editingPetitionId: undefined })}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
          >
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            <span>New petition</span>
          </button>
        </div>
      )}

      {/* Quick Feed Mode Banner when viewing Trending or a Specific Category */}
      {mode === 'feed' && (sortMode === 'trending' || categoryFilter !== 'All') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5B1586]/25 dark:border-[#7E22CE]/50 bg-[#F2ECF8]/80 dark:bg-[#26173A] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#460E69] dark:text-[#E9D5FF]">
            {sortMode === 'trending' ? (
              <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              Viewing:{' '}
              {sortMode === 'trending' ? 'Trending Across Campus' : "What's New"}
              {categoryFilter !== 'All' ? ` · ${categoryFilter}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSortMode('newest');
              setCategoryFilter('All');
              setStatusFilter('all');
            }}
            className="font-semibold text-[#5B1586] dark:text-[#C084FC] underline hover:opacity-80"
          >
            Reset view
          </button>
        </div>
      )}

      {/* Search (mobile-accessible) + Category + Status + Sort Bar */}
      <section
        aria-label="Filter and sort petitions"
        className="rounded-2xl bg-white/92 dark:bg-[#1B1029] backdrop-blur-xs border border-[#DFD1EE] dark:border-[#372352] shadow-xs p-4 space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label
              htmlFor="feed-search-input"
              className="block text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC] mb-1"
            >
              Full-word or reference search
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="feed-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. canteen, library, PET-1041, or 1041"
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] pl-9 pr-3 py-2"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="feed-category-select"
              className="block text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC] mb-1"
            >
              Category
            </label>
            <select
              id="feed-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
            >
              <option value="All">All categories</option>
              {PETITION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {mode === 'feed' && (
            <div className="md:col-span-2">
              <label
                htmlFor="feed-status-select"
                className="block text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC] mb-1"
              >
                Status
              </label>
              <select
                id="feed-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | PetitionStatus)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="responded">Responded</option>
                <option value="achieved">Achieved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}

          <div className={mode === 'feed' ? 'md:col-span-2' : 'md:col-span-4'}>
            <label
              htmlFor="feed-sort-select"
              className="block text-xs font-semibold text-[#5B506B] dark:text-[#B7A8CC] mb-1"
            >
              Sort order
            </label>
            <div className="relative">
              <SlidersHorizontal
                className="w-4 h-4 text-[#5B506B] dark:text-[#B7A8CC] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <select
                id="feed-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as FeedSortMode)}
                className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] pl-9 pr-3 py-2"
              >
                <option value="newest">What&apos;s New</option>
                <option value="trending">Trending</option>
                <option value="most_signed">Most signed</option>
                <option value="closing_soon">Closing soon</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Petition Cards Grid */}
      {visiblePetitions.length === 0 ? (
        <div className="rounded-2xl bg-white/92 dark:bg-[#1B1029] backdrop-blur-xs border border-[#DFD1EE] dark:border-[#372352] shadow-xs p-10 text-center flex flex-col items-center">
          <EmptyStateGraphic />
          <h2 className="mt-4 text-lg font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
            {mode === 'drafts'
              ? 'No drafts or pending submissions yet'
              : mode === 'activity'
              ? 'No activity recorded yet'
              : 'No matching petitions found'}
          </h2>
          <p className="mt-1.5 text-sm text-[#5B506B] dark:text-[#B7A8CC] max-w-md">
            {searchQuery
              ? 'Remember that search matches full words (for example, "park" will not match "parking") or exact reference numbers.'
              : 'Start a new petition or adjust your category and status filters.'}
          </p>
          {(searchQuery || categoryFilter !== 'All' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('All');
                setStatusFilter('all');
              }}
              className="mt-4 min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visiblePetitions.map((petition) => {
            const count = getDisplaySignatureCount(petition.id, petition.signatureCount);
            const sla = evaluatePetitionSla(petition);
            const leadPhoto = petition.media?.find((m) => m.type === 'image');
            const pct =
              petition.goalSignatures > 0
                ? Math.min(100, Math.round((count / petition.goalSignatures) * 100))
                : 0;

            return (
              <article
                key={petition.id}
                className="group rounded-2xl bg-white/92 dark:bg-[#1B1029] backdrop-blur-xs border border-[#DFD1EE] dark:border-[#372352] shadow-xs overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
              >
                <div>
                  {leadPhoto && (
                    <button
                      type="button"
                      onClick={() => openPetition(petition.id)}
                      className="block w-full text-left"
                      aria-label={`Open ${petition.title}`}
                    >
                      <ResilientImage
                        src={leadPhoto.url}
                        alt={leadPhoto.caption || petition.title}
                        className="w-full h-44 object-cover"
                      />
                    </button>
                  )}

                  <div className="p-5 sm:p-6 space-y-3">
                    {/* Clean unboxed metadata row + semantic status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                        <span className="font-mono font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                          {petition.referenceNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{petition.category}</span>
                        {petition.pinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-[#5B1586] dark:text-[#C084FC]">
                              <Pin className="w-3 h-3" aria-hidden="true" />
                              Pinned
                            </span>
                          </>
                        )}
                      </div>
                      <StatusBadge status={petition.status} />
                    </div>

                    <h2 className="text-lg font-semibold leading-snug text-[#2B0B42] dark:text-[#F7F3FC]">
                      <button
                        type="button"
                        onClick={() => openPetition(petition.id)}
                        className="text-left hover:text-[#5B1586] dark:hover:text-[#C084FC] transition-colors"
                      >
                        {petition.title}
                      </button>
                    </h2>

                    <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC] line-clamp-2">
                      {petition.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B506B] dark:text-[#B7A8CC]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{petition.location}</span>
                      </span>
                      <UrgencyIndicator urgency={petition.urgency} />
                    </div>

                    {petition.status === 'declined' && petition.moderationReason && (
                      <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-900 dark:text-rose-200">
                        <strong>Moderator reason:</strong> {petition.moderationReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 sm:px-6 pb-5 pt-2 space-y-3 border-t border-[#E2D9EC]/80 dark:border-[#372352]/80">
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-mono tabular-nums font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                        {count.toLocaleString()} of {petition.goalSignatures.toLocaleString()} signatures ({pct}%)
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          sla.state === 'overdue'
                            ? 'text-[#9F1239] dark:text-[#FDA4AF] font-semibold'
                            : sla.state === 'responded'
                            ? 'text-[#0F766E] dark:text-[#2DD4BF] font-semibold'
                            : 'text-[#5B506B] dark:text-[#B7A8CC]'
                        }`}
                      >
                        {sla.label}
                      </span>
                    </div>
                    <ProgressBar
                      current={count}
                      goal={petition.goalSignatures}
                      tone={
                        petition.status === 'achieved' || petition.status === 'responded'
                          ? 'teal'
                          : 'ember'
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] truncate">
                      {petition.lastActivityNote || `By ${petition.authorDisplayName}`}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {mode === 'drafts' && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ view: 'create', editingPetitionId: petition.id })
                          }
                          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-3 py-1.5 text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] hover:bg-[#F2ECF8] dark:hover:bg-[#26173A]"
                        >
                          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openPetition(petition.id)}
                        className="min-h-[44px] inline-flex items-center gap-1 rounded-lg bg-[#F2ECF8] dark:bg-[#26173A] px-3.5 py-1.5 text-xs font-semibold text-[#460E69] dark:text-[#E9D5FF] hover:bg-[#E4D5F3] dark:hover:bg-[#372352] transition-colors"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
