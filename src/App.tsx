import React, { useState } from 'react';
import { OnboardingView } from '@/src/components/auth/OnboardingView';
import { PlatformDocsModal } from '@/src/components/docs/PlatformDocsModal';
import { EventsView } from '@/src/components/events/EventsView';
import { PetitionFeed } from '@/src/components/feed/PetitionFeed';
import { AppShell } from '@/src/components/layout/AppShell';
import { AnalyticsDashboardView } from '@/src/components/moderator/AnalyticsDashboardView';
import { MemberDirectoryView } from '@/src/components/moderator/MemberDirectoryView';
import { ModeratorQueueView } from '@/src/components/moderator/ModeratorQueueView';
import { NoticeBoardView } from '@/src/components/notices/NoticeBoardView';
import { PetitionDetail } from '@/src/components/petitions/PetitionDetail';
import { PetitionForm } from '@/src/components/petitions/PetitionForm';
import { ProfileView } from '@/src/components/profile/ProfileView';
import { ErrorBoundary } from '@/src/components/ui/ErrorBoundary';
import { ToastStack } from '@/src/components/ui/Primitives';
import { OfflineIndicator } from '@/src/components/ui/PWAControls';
import { CivicProvider, useCivic } from '@/src/context/CivicContext';

const ActiveViewRouter: React.FC = () => {
  const { nav, toasts, dismissToast, liveAnnouncement } = useCivic();
  const [docsOpen, setDocsOpen] = useState(false);

  const renderMainView = () => {
    switch (nav.view) {
      case 'petition':
        return nav.petitionId ? (
          <PetitionDetail petitionId={nav.petitionId} />
        ) : (
          <PetitionFeed mode="feed" />
        );
      case 'create':
        return <PetitionForm editingPetitionId={nav.editingPetitionId} />;
      case 'activity':
        return <PetitionFeed mode="activity" />;
      case 'drafts':
        return <PetitionFeed mode="drafts" />;
      case 'events':
        return <EventsView />;
      case 'notices':
        return <NoticeBoardView />;
      case 'queue':
        return <ModeratorQueueView />;
      case 'directory':
        return <MemberDirectoryView />;
      case 'analytics':
        return <AnalyticsDashboardView />;
      case 'profile':
        return <ProfileView />;
      case 'auth':
        return <OnboardingView />;
      case 'feed':
      default:
        return <PetitionFeed mode="feed" />;
    }
  };

  return (
    <>
      <AppShell onOpenDocs={() => setDocsOpen(true)}>{renderMainView()}</AppShell>
      <OfflineIndicator />
      <ToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        liveAnnouncement={liveAnnouncement}
      />
      <PlatformDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <CivicProvider>
        <ActiveViewRouter />
      </CivicProvider>
    </ErrorBoundary>
  );
}
