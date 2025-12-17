import { useState, useEffect, useMemo } from 'react';
import './App.css';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import SeasonLeaderboard from './components/SeasonLeaderboard';
import ScheduleTable from './components/ScheduleTable';
import SeasonWeekSelectors from './components/SeasonWeekSelectors';
import NavBar from './components/NavBar';
import BottomNav, { TabType } from './components/BottomNav';
import AdminPanel from './components/AdminPanel';
import ParticipantStatus from './components/ParticipantStatus';
import ManageSegments from './components/ManageSegments';
import SeasonManager from './components/SeasonManager';
import WebhookManagementPanel from './components/WebhookManagementPanel';
import StravaConnectInfoBox from './components/StravaConnectInfoBox';
import Footer from './components/Footer';
import { useCurrentUser } from './hooks/useCurrentUser';
import { UnitProvider } from './context/UnitContext';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './utils/trpc';
import { Week } from './types'; // Import shared types

type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments' | 'seasons' | 'webhooks';

function AppContent() {
  const utils = trpc.useUtils();
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('leaderboard');
  const [activeTab, setActiveTab] = useState<TabType>('weekly');
  const userAthleteId = useCurrentUser();

  // tRPC Queries
  const seasonsQuery = trpc.season.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const weeksQuery = trpc.week.getAll.useQuery(
    { seasonId: selectedSeasonId!, includeParticipantCount: true },
    { 
      enabled: !!selectedSeasonId,
      refetchOnWindowFocus: false
    }
  );

  const weekLeaderboardQuery = trpc.leaderboard.getWeekLeaderboard.useQuery(
    { weekId: selectedWeekId! },
    {
      enabled: !!selectedWeekId,
      refetchOnWindowFocus: false,
    }
  );

  const seasons = useMemo(() => seasonsQuery.data || [], [seasonsQuery.data]);
  const weeks = useMemo(() => weeksQuery.data || [], [weeksQuery.data]);
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) || null;
  
  // Extract week and leaderboard data from tRPC query result
  // We cast the week from tRPC to match our frontend Week type which might have legacy fields
  const selectedWeek = weekLeaderboardQuery.data?.week ? (weekLeaderboardQuery.data.week as unknown as Week) : null;
  const weekLeaderboard = weekLeaderboardQuery.data?.leaderboard || [];

  const isLoading = seasonsQuery.isLoading || (!!selectedSeasonId && weeksQuery.isLoading) || (!!selectedWeekId && weekLeaderboardQuery.isLoading);
  const error = seasonsQuery.error || weeksQuery.error || weekLeaderboardQuery.error;

  // Effect: Select default season when seasons load
  useEffect(() => {
    if (seasons.length > 0 && selectedSeasonId === null) {
      const now = Math.floor(Date.now() / 1000);
      const currentSeason = seasons.find(season => season.start_at <= now && now <= season.end_at);
      setSelectedSeasonId(currentSeason ? currentSeason.id : seasons[0].id);
    }
  }, [seasons, selectedSeasonId]);

  // Effect: Select default week when weeks load (or when season changes)
  useEffect(() => {
    if (weeks.length > 0) {
      // If no week selected OR the selected week is not in the current weeks list (season changed)
      const isSelectedWeekInList = selectedWeekId && weeks.some(w => w.id === selectedWeekId);
      
      if (!selectedWeekId || !isSelectedWeekInList) {
        const now = Math.floor(Date.now() / 1000);
        const today = Math.floor(now / 86400) * 86400;
        
        const sortedWeeks = [...weeks].sort((a, b) => b.start_at - a.start_at);
        const pastWeek = sortedWeeks.find(week => week.start_at <= today);
        
        setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
      }
    } else if (weeksQuery.isFetched && weeks.length === 0) {
        setSelectedWeekId(null);
    }
  }, [weeks, weeksQuery.isFetched, selectedWeekId]);

  // Handler for when results are fetched - refresh leaderboard
  const handleFetchResults = () => {
    if (selectedWeekId !== null) {
      weekLeaderboardQuery.refetch();
    }
  };

  // Handler for when seasons are changed in SeasonManager - refresh seasons list
  const handleSeasonsChanged = () => {
    utils.season.getAll.invalidate();
    setViewMode('leaderboard');
  };

  if (isLoading && !seasons.length) {
    return (
      <div className="app app-content">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app app-content">
        <div className="error">{error.message}</div>
      </div>
    );
  }

  return (
    <UnitProvider>
      <NavBar 
        onAdminPanelToggle={() => setViewMode(viewMode === 'admin' ? 'leaderboard' : 'admin')} 
        isAdminPanelOpen={viewMode === 'admin'}
        onParticipantsClick={() => setViewMode('participants')}
        onLeaderboardClick={() => setViewMode('leaderboard')}
        onManageSeasonsClick={() => setViewMode('seasons')}
        onWebhooksClick={() => setViewMode('webhooks')}
      />
      
      <div className="app app-content">
        {viewMode === 'admin' ? (
          <>
            <AdminPanel 
              onFetchResults={handleFetchResults}
              seasons={seasons}
              selectedSeasonId={selectedSeasonId}
              onSeasonChange={setSelectedSeasonId}
            />
            <Footer />
          </>
        ) : viewMode === 'participants' ? (
          <>
            <div>
              <h1 style={{ marginBottom: '2rem' }}>Participant Status</h1>
              <ParticipantStatus />
            </div>
            <Footer />
          </>
        ) : viewMode === 'segments' ? (
          <>
            <div>
              <h1 style={{ marginBottom: '1rem' }}>Manage Segments</h1>
              <p className="admin-subtitle" style={{ marginTop: 0 }}>Add new Strava segments and manage known segments</p>
              <ManageSegments />
            </div>
            <Footer />
          </>
        ) : viewMode === 'seasons' ? (
          <>
            <div>
              <h1 style={{ marginBottom: '1rem' }}>Manage Seasons</h1>
              <p className="admin-subtitle" style={{ marginTop: 0 }}>Add, edit, and remove seasons for the Zwift Hill Climb/Time Trial Series</p>
              <SeasonManager onSeasonsChanged={handleSeasonsChanged} />
            </div>
            <Footer />
          </>
        ) : viewMode === 'webhooks' ? (
          <>
            <div>
              <h1 style={{ marginBottom: '1rem' }}>Manage Webhooks</h1>
              <p className="admin-subtitle" style={{ marginTop: 0 }}>Monitor and manage real-time activity updates from Strava</p>
              <WebhookManagementPanel />
            </div>
            <Footer />
          </>
        ) : (
          <>
            <StravaConnectInfoBox show={userAthleteId === null} />
            <SeasonWeekSelectors
              seasons={seasons}
              selectedSeasonId={selectedSeasonId}
              setSelectedSeasonId={setSelectedSeasonId}
              weeks={weeks as Week[]} // Cast to compatible Week type
              selectedWeekId={selectedWeekId}
              setSelectedWeekId={setSelectedWeekId}
              showWeekSelector={activeTab === 'weekly'}
            />

            {activeTab === 'weekly' && (() => {
              // Calculate week number for display
              let weekNumber = undefined;
              if (selectedWeek && weeks.length > 0) {
                // Find the original index of the selected week in the full weeks list
                const originalWeekIndex = weeks.findIndex(w => w.id === selectedWeek.id);
                if (originalWeekIndex !== -1) {
                  // Get all weeks that have the same season_id as the selectedWeek
                  const weeksInSelectedSeason = weeks.filter(w => w.season_id === selectedWeek.season_id);
                  // Sort these weeks by start_at to determine the correct week number within the season
                  const sortedWeeksInSeason = [...weeksInSelectedSeason].sort((a, b) => a.start_at - b.start_at);
                  // Find the index of the selected week within this sorted list
                  const weekIndexInSeason = sortedWeeksInSeason.findIndex(w => w.id === selectedWeek.id);
                  if (weekIndexInSeason !== -1) {
                    weekNumber = weekIndexInSeason + 1;
                  }
                }
              }
              return (
                <WeeklyLeaderboard 
                  week={selectedWeek}
                  leaderboard={weekLeaderboard}
                  weekNumber={weekNumber}
                />
              );
            })()}

            {activeTab === 'season' && selectedSeason && (
              <SeasonLeaderboard season={selectedSeason} />
            )}

            {activeTab === 'schedule' && (
              <ScheduleTable weeks={weeks as Week[]} season={selectedSeason || undefined} />
            )}

            <Footer />
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
          </>
        )}
      </div>
    </UnitProvider>
  );
}

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: (() => {
            const baseUrl = import.meta.env.REACT_APP_BACKEND_URL || (() => {
              if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                return 'http://localhost:3001';
              }
              return '';
            })();
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBaseUrl}/trpc`;
          })(),
          fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
