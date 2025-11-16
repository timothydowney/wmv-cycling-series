import { useState, useEffect } from 'react';
import './App.css';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import SeasonLeaderboard from './components/SeasonLeaderboard';
import ScheduleTable from './components/ScheduleTable';
import SeasonWeekSelectors from './components/SeasonWeekSelectors';
import NavBar from './components/NavBar';
import AdminPanel from './components/AdminPanel';
import ParticipantStatus from './components/ParticipantStatus';
import ManageSegments from './components/ManageSegments';
import SeasonManager from './components/SeasonManager';
import Footer from './components/Footer';
import { api, getWeekLeaderboard, Week, Season, LeaderboardEntry } from './api';

type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments' | 'seasons';

function App() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [weekLeaderboard, setWeekLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('leaderboard');

  useEffect(() => {
    const fetchSeasonsAndWeeks = async () => {
      try {
        setLoading(true);
        
        // Fetch all seasons
        const seasonsData = await api.getSeasons();
        setSeasons(seasonsData);
        
        if (seasonsData.length === 0) {
          setLoading(false);
          return;
        }
        
        // Find the current season (season that contains today's date)
        const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
        
        const currentSeason = seasonsData.find(season => {
          return season.start_at <= now && now <= season.end_at;
        });
        
        // If no current season, use the most recent one
        const selectedSeasonObj = currentSeason || seasonsData[0];
        setSelectedSeasonId(selectedSeasonObj.id);
        setSelectedSeason(selectedSeasonObj);
        
        // Fetch weeks for the selected season
        const weeksData = await api.getWeeks(selectedSeasonObj.id);
        setWeeks(weeksData);
        
        if (weeksData.length > 0) {
          // Select the most recent week (closest to today, preferring past/current weeks)
          const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
          const today = Math.floor(now / 86400) * 86400; // Midnight today in Unix seconds
          
          const sortedWeeks = [...weeksData].sort((a, b) => b.start_at - a.start_at);
          
          // Find most recent week that is today or in the past
          const pastWeek = sortedWeeks.find(week => week.start_at <= today);
          
          setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
        }
      } catch (err) {
        setError('Failed to load seasons and weeks. Make sure the backend server is running on port 3001.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonsAndWeeks();
  }, []);

  // When season changes, refresh weeks and reset week selection
  useEffect(() => {
    const fetchWeeksForSeason = async () => {
      if (selectedSeasonId === null) return;
      try {
        // Find the season object to get its dates
        const seasonObj = seasons.find(s => s.id === selectedSeasonId);
        if (seasonObj) {
          setSelectedSeason(seasonObj);
        }
        
        const weeksData = await api.getWeeks(selectedSeasonId);
        setWeeks(weeksData);
        
        // Reset week selection
        setSelectedWeekId(null);
        
        if (weeksData.length > 0) {
          // Select the most recent week
          const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
          const today = Math.floor(now / 86400) * 86400; // Midnight today in Unix seconds
          
          const sortedWeeks = [...weeksData].sort((a, b) => b.start_at - a.start_at);
          
          const pastWeek = sortedWeeks.find(week => week.start_at <= today);
          
          setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch weeks for season:', err);
      }
    };

    fetchWeeksForSeason();
  }, [selectedSeasonId, seasons]);

  // Refresh weeks when switching back to leaderboard view
  useEffect(() => {
    const refreshWeeks = async () => {
      if (viewMode === 'leaderboard' && selectedSeasonId) {
        try {
          const weeksData = await api.getWeeks(selectedSeasonId);
          setWeeks(weeksData);
          // If no week is selected but we have weeks, select the most recent past/current week
          if (selectedWeekId === null && weeksData.length > 0) {
            const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
            const todayMidnight = Math.floor(now / 86400) * 86400; // Midnight today in Unix seconds
            
            // Sort weeks by date (descending - most recent first)
            const sortedWeeks = [...weeksData].sort((a, b) => b.start_at - a.start_at);
            
            // Find most recent week that is today or in the past
            const pastWeek = sortedWeeks.find(week => week.start_at <= todayMidnight);
            
            setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
          }
        } catch (err) {
          console.error('Failed to refresh weeks:', err);
        }
      }
    };

    refreshWeeks();
  }, [viewMode, selectedSeasonId, selectedWeekId]);

  // Function to fetch/refresh leaderboard
  const fetchLeaderboard = async (weekId: number) => {
    try {
      const leaderboardData = await getWeekLeaderboard(weekId);
      setSelectedWeek(leaderboardData.week);
      setWeekLeaderboard(leaderboardData.leaderboard);
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error(err);
    }
  };

  // Refresh leaderboard when week changes
  useEffect(() => {
    if (selectedWeekId === null) {
      setSelectedWeek(null);
      setWeekLeaderboard([]);
      return;
    }
    fetchLeaderboard(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  // Handler for when results are fetched - refresh leaderboard
  const handleFetchResults = () => {
    if (selectedWeekId !== null) {
      fetchLeaderboard(selectedWeekId);
    }
  };

  // Handler for when seasons are changed in SeasonManager - refresh seasons list
  const handleSeasonsChanged = async () => {
    try {
      const seasonsData = await api.getSeasons();
      setSeasons(seasonsData);
      
      // Return to leaderboard to show updated season selector
      setViewMode('leaderboard');
    } catch (err) {
      console.error('Failed to refresh seasons:', err);
    }
  };

  if (loading) {
    return (
      <>
        <NavBar 
          onAdminPanelToggle={() => setViewMode(viewMode === 'admin' ? 'leaderboard' : 'admin')} 
          isAdminPanelOpen={viewMode === 'admin'}
          onParticipantsClick={() => setViewMode('participants')}
          onLeaderboardClick={() => setViewMode('leaderboard')}
          onManageSegmentsClick={() => setViewMode('segments')}
          onManageSeasonsClick={() => setViewMode('seasons')}
        />
        <div className="app app-content">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar 
          onAdminPanelToggle={() => setViewMode(viewMode === 'admin' ? 'leaderboard' : 'admin')} 
          isAdminPanelOpen={viewMode === 'admin'}
          onParticipantsClick={() => setViewMode('participants')}
          onLeaderboardClick={() => setViewMode('leaderboard')}
          onManageSegmentsClick={() => setViewMode('segments')}
          onManageSeasonsClick={() => setViewMode('seasons')}
        />
        <div className="app app-content">
          <div className="error">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar 
        onAdminPanelToggle={() => setViewMode(viewMode === 'admin' ? 'leaderboard' : 'admin')} 
        isAdminPanelOpen={viewMode === 'admin'}
        onParticipantsClick={() => setViewMode('participants')}
        onLeaderboardClick={() => setViewMode('leaderboard')}
        onManageSegmentsClick={() => setViewMode('segments')}
        onManageSeasonsClick={() => setViewMode('seasons')}
      />
      
      <div className="app app-content">
        {viewMode === 'admin' ? (
          <AdminPanel 
            onFetchResults={handleFetchResults}
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            onSeasonChange={setSelectedSeasonId}
          />
        ) : viewMode === 'participants' ? (
          <div>
            <h1 style={{ marginBottom: '2rem' }}>Participant Status</h1>
            <ParticipantStatus />
          </div>
        ) : viewMode === 'segments' ? (
          <div>
            <h1 style={{ marginBottom: '1rem' }}>Manage Segments</h1>
            <p className="admin-subtitle" style={{ marginTop: 0 }}>Add new Strava segments and manage known segments</p>
            <ManageSegments />
          </div>
        ) : viewMode === 'seasons' ? (
          <div>
            <h1 style={{ marginBottom: '1rem' }}>Manage Seasons</h1>
            <p className="admin-subtitle" style={{ marginTop: 0 }}>Add, edit, and remove seasons for the Zwift Hill Climb/Time Trial Series</p>
            <SeasonManager onSeasonsChanged={handleSeasonsChanged} />
          </div>
        ) : (
          <>
            <SeasonWeekSelectors
              seasons={seasons}
              selectedSeasonId={selectedSeasonId}
              setSelectedSeasonId={setSelectedSeasonId}
              weeks={weeks}
              selectedWeekId={selectedWeekId}
              setSelectedWeekId={setSelectedWeekId}
            />

            <WeeklyLeaderboard 
              week={selectedWeek}
              leaderboard={weekLeaderboard}
            />

            {selectedSeasonId && <SeasonLeaderboard seasonId={selectedSeasonId} />}

            <ScheduleTable weeks={weeks} season={selectedSeason || undefined} />

            <Footer />
          </>
        )}
      </div>
    </>
  );
}

export default App;
