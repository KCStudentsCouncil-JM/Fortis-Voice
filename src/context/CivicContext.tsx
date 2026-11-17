import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isFirebaseConfigured } from '@/src/data/firebaseClient';
import { FirestoreRepository } from '@/src/data/firestoreRepository';
import { LocalDemoRepository } from '@/src/data/localRepository';
import type { ActionResult, CivicRepository, CivicStoreSnapshot } from '@/src/data/repository';
import type { AppView, FeedSortMode, ToastMessage } from '@/src/types/civic';
import { getPermissions, type PermissionSet } from '@/src/utils/permissions';

const BACKEND_MODE_KEY = 'kc_council_backend_mode_v1';

interface NavigationState {
  view: AppView;
  petitionId?: string;
  editingPetitionId?: string;
  searchQuery?: string;
  categoryFilter?: string;
  sortMode?: FeedSortMode;
}

interface CivicContextValue {
  snapshot: CivicStoreSnapshot;
  repo: CivicRepository;
  permissions: PermissionSet;
  backendMode: 'firebase' | 'local';
  firebaseAvailable: boolean;
  switchBackendMode: (mode: 'firebase' | 'local') => void;

  nav: NavigationState;
  navigate: (next: Partial<NavigationState> & { view: AppView }) => void;
  openPetition: (petitionId: string) => void;
  setSearchQuery: (q: string) => void;
  setCategoryFilter: (cat: string) => void;
  setSortMode: (mode: FeedSortMode) => void;

  // Optimistic signature overlay for instant feedback
  optimisticSignDelta: Record<string, boolean>;
  toggleSignature: (petitionId: string) => Promise<ActionResult>;
  hasSignedPetition: (petitionId: string) => boolean;
  getDisplaySignatureCount: (petitionId: string, baseCount: number) => number;

  // Toast feedback system
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  liveAnnouncement: string;
}

const CivicContext = createContext<CivicContextValue | null>(null);

function parseInitialRouteFromUrl(): NavigationState {
  if (typeof window === 'undefined') return { view: 'feed' };
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view') as AppView | null;
  const petitionId = params.get('id') || undefined;
  const searchQuery = params.get('q') || undefined;
  const categoryFilter = params.get('cat') || undefined;
  const sortParam = params.get('sort') as FeedSortMode | null;
  const validSorts: FeedSortMode[] = ['newest', 'trending', 'most_signed', 'closing_soon'];
  const sortMode = sortParam && validSorts.includes(sortParam) ? sortParam : 'newest';

  const validViews: AppView[] = [
    'feed',
    'petition',
    'create',
    'activity',
    'drafts',
    'events',
    'notices',
    'queue',
    'directory',
    'analytics',
    'profile',
    'auth',
  ];

  if (petitionId && (!viewParam || viewParam === 'petition')) {
    return { view: 'petition', petitionId, searchQuery, categoryFilter, sortMode };
  }
  if (viewParam && validViews.includes(viewParam)) {
    return { view: viewParam, petitionId, searchQuery, categoryFilter, sortMode };
  }
  return { view: 'feed', searchQuery, categoryFilter, sortMode };
}

function getInitialBackendMode(): 'firebase' | 'local' {
  if (!isFirebaseConfigured) return 'local';
  const stored = localStorage.getItem(BACKEND_MODE_KEY);
  if (stored === 'firebase' || stored === 'local') return stored;
  // Default to local demo sandbox on first visit so seed content & 4-role preview work immediately
  // without requiring Google sign-in first; users can switch to Live Firebase anytime.
  return 'local';
}

function createRepository(mode: 'firebase' | 'local'): CivicRepository {
  return mode === 'firebase' && isFirebaseConfigured
    ? new FirestoreRepository()
    : new LocalDemoRepository();
}

export const CivicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendMode, setBackendMode] = useState<'firebase' | 'local'>(getInitialBackendMode);
  const [repo, setRepo] = useState<CivicRepository>(() => createRepository(getInitialBackendMode()));
  const repoRef = useRef<CivicRepository>(repo);
  repoRef.current = repo;

  const [snapshot, setSnapshot] = useState<CivicStoreSnapshot>({
    mode: backendMode,
    ready: false,
    currentUser: null,
    members: [],
    petitions: [],
    signaturesByPetition: {},
    activityByPetition: {},
    events: [],
    rsvpsByEvent: {},
    notices: [],
    votesByNotice: {},
  });

  const [nav, setNav] = useState<NavigationState>(parseInitialRouteFromUrl);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [optimisticSignDelta, setOptimisticSignDelta] = useState<Record<string, boolean>>({});

  // Subscribe to active repository and clean up on backend switch/unmount
  useEffect(() => {
    const unsub = repo.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
    });

    return () => {
      unsub();
      repo.destroy();
    };
  }, [repo]);

  // Sync URL query parameters for shareable deep links without page reload
  useEffect(() => {
    const params = new URLSearchParams();
    if (nav.view !== 'feed') params.set('view', nav.view);
    if (nav.petitionId) params.set('id', nav.petitionId);
    if (nav.searchQuery?.trim()) params.set('q', nav.searchQuery.trim());
    if (nav.categoryFilter && nav.categoryFilter !== 'All') {
      params.set('cat', nav.categoryFilter);
    }
    if (nav.sortMode && nav.sortMode !== 'newest') {
      params.set('sort', nav.sortMode);
    }
    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [nav]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      setNav(parseInitialRouteFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Gentle presence heartbeat every 3 minutes (never on focus, so file-picker dialogs never trigger state updates)
  useEffect(() => {
    if (!snapshot.currentUser) return;
    const interval = window.setInterval(() => {
      void repoRef.current.recordPresence();
    }, 180000);
    return () => {
      window.clearInterval(interval);
    };
  }, [snapshot.currentUser?.uid]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setLiveAnnouncement(`${toast.title}${toast.description ? `. ${toast.description}` : ''}`);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4800);
    },
    []
  );

  const switchBackendMode = useCallback(
    (mode: 'firebase' | 'local') => {
      if (mode === backendMode) return;
      if (mode === 'firebase' && !isFirebaseConfigured) {
        pushToast({
          tone: 'error',
          title: 'Firebase credentials unavailable',
          description: 'Continuing in Local Demo Mode.',
        });
        return;
      }
      localStorage.setItem(BACKEND_MODE_KEY, mode);
      setOptimisticSignDelta({});
      setBackendMode(mode);
      setRepo(createRepository(mode));
      pushToast({
        tone: 'info',
        title: mode === 'firebase' ? 'Switched to Live Firebase Mode' : 'Switched to Local Demo Mode',
        description:
          mode === 'firebase'
            ? 'Authenticated writes are enforced by Firestore Security Rules.'
            : 'Data is stored locally in this browser for demonstration.',
      });
    },
    [backendMode, pushToast]
  );

  const navigate = useCallback((next: Partial<NavigationState> & { view: AppView }) => {
    setNav((prev) => ({
      ...prev,
      ...next,
      petitionId: next.view === 'petition' ? next.petitionId ?? prev.petitionId : undefined,
      editingPetitionId: next.view === 'create' ? next.editingPetitionId : undefined,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openPetition = useCallback((petitionId: string) => {
    setNav((prev) => ({ ...prev, view: 'petition', petitionId }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setNav((prev) => ({ ...prev, searchQuery: q }));
  }, []);

  const setCategoryFilter = useCallback((cat: string) => {
    setNav((prev) => ({ ...prev, categoryFilter: cat }));
  }, []);

  const setSortMode = useCallback((mode: FeedSortMode) => {
    setNav((prev) => ({ ...prev, sortMode: mode }));
  }, []);

  const permissions = useMemo(
    () => getPermissions(snapshot.currentUser),
    [snapshot.currentUser]
  );

  const hasSignedPetition = useCallback(
    (petitionId: string): boolean => {
      if (petitionId in optimisticSignDelta) {
        return optimisticSignDelta[petitionId];
      }
      const uid = snapshot.currentUser?.uid;
      if (!uid) return false;
      const sigs = snapshot.signaturesByPetition[petitionId] ?? [];
      return sigs.some((s) => s.userId === uid);
    },
    [optimisticSignDelta, snapshot.currentUser?.uid, snapshot.signaturesByPetition]
  );

  const getDisplaySignatureCount = useCallback(
    (petitionId: string, baseCount: number): number => {
      if (!(petitionId in optimisticSignDelta)) return baseCount;
      const uid = snapshot.currentUser?.uid;
      const actualSigned = Boolean(
        uid && (snapshot.signaturesByPetition[petitionId] ?? []).some((s) => s.userId === uid)
      );
      const targetSigned = optimisticSignDelta[petitionId];
      if (targetSigned === actualSigned) return baseCount;
      return Math.max(0, baseCount + (targetSigned ? 1 : -1));
    },
    [optimisticSignDelta, snapshot.currentUser?.uid, snapshot.signaturesByPetition]
  );

  const toggleSignature = useCallback(
    async (petitionId: string): Promise<ActionResult> => {
      const activeRepo = repoRef.current;
      const me = snapshot.currentUser;
      if (!me) {
        return { ok: false, error: 'Please sign in to endorse this petition.' };
      }
      if (!permissions.canSign) {
        return {
          ok: false,
          error:
            me.accountStatus === 'pending'
              ? 'Your account is awaiting moderator verification. Signing unlocks once approved.'
              : 'Your account cannot sign petitions while restricted.',
        };
      }

      const currentlySigned = hasSignedPetition(petitionId);
      const nextSigned = !currentlySigned;

      // Optimistic UI update
      setOptimisticSignDelta((prev) => ({ ...prev, [petitionId]: nextSigned }));
      setLiveAnnouncement(
        nextSigned ? 'Signature added optimistically.' : 'Signature withdrawn optimistically.'
      );

      let res: ActionResult;
      try {
        res = nextSigned
          ? await activeRepo.signPetition(petitionId)
          : await activeRepo.retractSignature(petitionId);
      } catch (err) {
        res = {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not update signature.',
        };
      } finally {
        // Clear optimistic override once repository settles
        setOptimisticSignDelta((prev) => {
          const copy = { ...prev };
          delete copy[petitionId];
          return copy;
        });
      }

      if (res.ok) {
        pushToast({
          tone: 'success',
          title: nextSigned ? 'Signature recorded' : 'Signature withdrawn',
          description: nextSigned
            ? 'Your endorsement is now part of the public petition count.'
            : 'Your signature has been removed from this petition.',
        });
      } else {
        pushToast({
          tone: 'error',
          title: 'Could not update signature',
          description: res.error,
        });
      }
      return res;
    },
    [hasSignedPetition, permissions.canSign, pushToast, snapshot.currentUser]
  );

  const value: CivicContextValue = {
    snapshot,
    repo,
    permissions,
    backendMode,
    firebaseAvailable: isFirebaseConfigured,
    switchBackendMode,
    nav,
    navigate,
    openPetition,
    setSearchQuery,
    setCategoryFilter,
    setSortMode,
    optimisticSignDelta,
    toggleSignature,
    hasSignedPetition,
    getDisplaySignatureCount,
    toasts,
    pushToast,
    dismissToast,
    liveAnnouncement,
  };

  return <CivicContext.Provider value={value}>{children}</CivicContext.Provider>;
};

export function useCivic(): CivicContextValue {
  const ctx = useContext(CivicContext);
  if (!ctx) throw new Error('useCivic must be used inside CivicProvider');
  return ctx;
}
