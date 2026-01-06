import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import AboutPage from './components/AboutPage';
import { UnitProvider } from './context/UnitContext';
import { getDefaultSeason, getDefaultWeek } from './utils/defaultSelection';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './utils/trpc';
import { Season, Week } from './types'; // Import shared types

type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments' | 'seasons' | 'webhooks' | 'about';

interface LeaderboardViewProps {
  seasons: Season[];
  userAthleteId: string | null;
}

const LeaderboardView: React.FC<LeaderboardViewProps> = ({ seasons, userAthleteId }) => {
  const { seasonId: paramSeasonId, tab: paramTab, weekId: paramWeekId } = useParams();
  const navigate = useNavigate();

  const selectedSeasonId = useMemo(() => paramSeasonId ? parseInt(paramSeasonId) : null, [paramSeasonId]);
  const activeTab = useMemo(() => (paramTab as TabType) || 'weekly', [paramTab]);
  const selectedWeekId = useMemo(() => paramWeekId ? parseInt(paramWeekId) : null, [paramWeekId]);

  // tRPC Queries
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

  const weeks = useMemo(() => weeksQuery.data || [], [weeksQuery.data]);
  const selectedSeason = useMemo(() => seasons.find(s => s.id === selectedSeasonId) || null, [seasons, selectedSeasonId]);
  const selectedWeek = weekLeaderboardQuery.data?.week ? (weekLeaderboardQuery.data.week as unknown as Week) : null;
  const weekLeaderboard = weekLeaderboardQuery.data?.leaderboard || [];

  const isLoading = (!!selectedSeasonId && weeksQuery.isLoading) || (!!selectedWeekId && weekLeaderboardQuery.isLoading);

  // Effect: Select default season if none in URL
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      const now = Math.floor(Date.now() / 1000);
      const defaultSeason = getDefaultSeason(seasons, now);
      if (defaultSeason) {
        navigate(`/leaderboard/${defaultSeason.id}`, { replace: true });
      }
    }
  }, [seasons, selectedSeasonId, navigate]);

  // Effect: Select default week if none in URL
  useEffect(() => {
    if (weeks.length > 0 && selectedSeasonId && !selectedWeekId && activeTab === 'weekly') {
      const now = Math.floor(Date.now() / 1000);
      const defaultWeek = getDefaultWeek(weeks, now);
      if (defaultWeek) {
        navigate(`/leaderboard/${selectedSeasonId}/weekly/${defaultWeek.id}`, { replace: true });
      }
    }
  }, [weeks, selectedSeasonId, selectedWeekId, activeTab, navigate]);

  if (isLoading && !weeks.length) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <StravaConnectInfoBox show={userAthleteId === null} />
      <SeasonWeekSelectors
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        weeks={weeks as Week[]} 
        selectedWeekId={selectedWeekId}
        showWeekSelector={activeTab === 'weekly'}
        activeTab={activeTab}
      />

      {activeTab === 'weekly' && (() => {
        // Calculate week number for display
        let weekNumber = undefined;
        if (selectedWeek && weeks.length > 0) {
          const originalWeekIndex = weeks.findIndex(w => w.id === selectedWeek.id);
          if (originalWeekIndex !== -1) {
            const weeksInSelectedSeason = weeks.filter(w => w.season_id === selectedWeek.season_id);
            const sortedWeeksInSeason = [...weeksInSelectedSeason].sort((a, b) => a.start_at - b.start_at);
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

      <div className="bottom-nav-spacer" />
      <BottomNav activeTab={activeTab} />
    </>
  );
};

function AppContent() {
  const utils = trpc.useUtils();
  const location = useLocation();
  
  const [adminSeasonId, setAdminSeasonId] = useState<number | null>(null);
  
  // tRPC Queries
  const authStatusQuery = trpc.participant.getAuthStatus.useQuery();
  const seasonsQuery = trpc.season.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const seasons = useMemo(() => seasonsQuery.data || [], [seasonsQuery.data]);
  const isAdmin = authStatusQuery.data?.is_admin ?? false;
  const isConnected = !!authStatusQuery.data?.participant;
  const athleteInfo = authStatusQuery.data?.participant ? {
    firstname: authStatusQuery.data.participant.name.split(' ')[0] || '',
    lastname: authStatusQuery.data.participant.name.split(' ').slice(1).join(' ') || '',
    profile: authStatusQuery.data.participant.profile_picture_url || undefined
  } : null;
  const userAthleteId = authStatusQuery.data?.participant?.strava_athlete_id || null;

  // Sync default admin season
  useEffect(() => {
    if (seasons.length > 0 && adminSeasonId === null) {
      const now = Math.floor(Date.now() / 1000);
      const defaultSeason = getDefaultSeason(seasons, now);
      if (defaultSeason) {
        setAdminSeasonId(defaultSeason.id);
      }
    }
  }, [seasons, adminSeasonId]);

  // viewMode is now derived from the URL path
  const viewMode = useMemo((): ViewMode => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/participants')) return 'participants';
    if (path.startsWith('/segments')) return 'segments';
    if (path.startsWith('/seasons')) return 'seasons';
    if (path.startsWith('/webhooks')) return 'webhooks';
    if (path.startsWith('/about')) return 'about';
    return 'leaderboard';
  }, [location.pathname]);

  const handleSeasonsChanged = () => {
    utils.season.getAll.invalidate();
  };

  const getPageTitle = (mode: ViewMode) => {
    switch (mode) {
      case 'admin': return 'Manage Competition';
      case 'participants': return 'Participant Status';
      case 'segments': return 'Manage Segments';
      case 'seasons': return 'Manage Seasons';
      case 'webhooks': return 'Manage Webhooks';
      case 'about': return 'About';
      case 'leaderboard':
      default:
        return 'Leaderboard';
    }
  };

  const getPageLink = (mode: ViewMode) => {
    switch (mode) {
      case 'admin': return '/admin';
      case 'participants': return '/participants';
      case 'segments': return '/segments';
      case 'seasons': return '/seasons';
      case 'webhooks': return '/webhooks';
      case 'about': return '/about';
      case 'leaderboard':
      default:
        return '/leaderboard';
    }
  };

  if (seasonsQuery.isLoading || authStatusQuery.isLoading) {
    return (
      <div className="app app-content">
        <p>Loading...</p>
      </div>
    );
  }

  if (seasonsQuery.error) {
    return (
      <div className="app app-content">
        <div className="error">{seasonsQuery.error.message}</div>
      </div>
    );
  }

  return (
    <UnitProvider>
      <NavBar 
        title={getPageTitle(viewMode)}
        titleLink={getPageLink(viewMode)}
        isAdmin={isAdmin}
        isConnected={isConnected}
        athleteInfo={athleteInfo}
      />
      
      <div className="app app-content">
        <Routes>
          <Route path="/admin" element={
            <AdminPanel 
              onFetchResults={() => utils.leaderboard.getWeekLeaderboard.invalidate()}
              seasons={seasons}
              selectedSeasonId={adminSeasonId}
              onSeasonChange={setAdminSeasonId}
            />
          } />
          <Route path="/participants" element={<ParticipantStatus />} />
          <Route path="/segments" element={<ManageSegments />} />
          <Route path="/seasons" element={<SeasonManager onSeasonsChanged={handleSeasonsChanged} />} />
          <Route path="/webhooks" element={<WebhookManagementPanel />} />
          <Route path="/about" element={<AboutPage />} />
          
          <Route path="/leaderboard/:seasonId/weekly/:weekId" element={<LeaderboardView seasons={seasons} userAthleteId={userAthleteId} />} />
          <Route path="/leaderboard/:seasonId/:tab" element={<LeaderboardView seasons={seasons} userAthleteId={userAthleteId} />} />
          <Route path="/leaderboard/:seasonId" element={<LeaderboardView seasons={seasons} userAthleteId={userAthleteId} />} />
          <Route path="/leaderboard" element={<LeaderboardView seasons={seasons} userAthleteId={userAthleteId} />} />
          
          <Route path="/" element={<Navigate to="/leaderboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
