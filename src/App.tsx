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
import Footer from './components/Footer';
import { api, getWeekLeaderboard, Week, Season, LeaderboardEntry } from './api';

type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments';

function App() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentSeason = seasonsData.find(season => {
          const startDate = new Date(season.start_date);
          const endDate = new Date(season.end_date);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return startDate <= today && today <= endDate;
        });
        
        // If no current season, use the most recent one
        const selectedSeason = currentSeason || seasonsData[0];
        setSelectedSeasonId(selectedSeason.id);
        
        // Fetch weeks for the selected season
        const weeksData = await api.getWeeks(selectedSeason.id);
        setWeeks(weeksData);
        
        if (weeksData.length > 0) {
          // Select the most recent week (closest to today, preferring past/current weeks)
          const sortedWeeks = [...weeksData].sort((a, b) => {
            const dateA = new Date(a.date || a.start_time);
            const dateB = new Date(b.date || b.start_time);
            return dateB.getTime() - dateA.getTime();
          });
          
          // Find most recent week that is today or in the past
          const pastWeek = sortedWeeks.find(week => {
            const weekDate = new Date(week.date || week.start_time);
            weekDate.setHours(0, 0, 0, 0);
            return weekDate <= today;
          });
          
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
        const weeksData = await api.getWeeks(selectedSeasonId);
        setWeeks(weeksData);
        
        // Reset week selection
        setSelectedWeekId(null);
        
        if (weeksData.length > 0) {
          // Select the most recent week
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const sortedWeeks = [...weeksData].sort((a, b) => {
            const dateA = new Date(a.date || a.start_time);
            const dateB = new Date(b.date || b.start_time);
            return dateB.getTime() - dateA.getTime();
          });
          
          const pastWeek = sortedWeeks.find(week => {
            const weekDate = new Date(week.date || week.start_time);
            weekDate.setHours(0, 0, 0, 0);
            return weekDate <= today;
          });
          
          setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch weeks for season:', err);
      }
    };

    fetchWeeksForSeason();
  }, [selectedSeasonId]);

  // Refresh weeks when switching back to leaderboard view
  useEffect(() => {
    const refreshWeeks = async () => {
      if (viewMode === 'leaderboard' && selectedSeasonId) {
        try {
          const weeksData = await api.getWeeks(selectedSeasonId);
          setWeeks(weeksData);
          // If no week is selected but we have weeks, select the most recent past/current week
          if (selectedWeekId === null && weeksData.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Sort weeks by date (descending - most recent first)
            const sortedWeeks = [...weeksData].sort((a, b) => {
              const dateA = new Date(a.date || a.start_time);
              const dateB = new Date(b.date || b.start_time);
              return dateB.getTime() - dateA.getTime();
            });
            
            // Find most recent week that is today or in the past
            const pastWeek = sortedWeeks.find(week => {
              const weekDate = new Date(week.date || week.start_time);
              weekDate.setHours(0, 0, 0, 0);
              return weekDate <= today;
            });
            
            setSelectedWeekId(pastWeek ? pastWeek.id : sortedWeeks[0].id);
          }
        } catch (err) {
          console.error('Failed to refresh weeks:', err);
        }
      }
    };

    refreshWeeks();
  }, [viewMode, selectedSeasonId]); // Refresh when viewMode or season changes

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (selectedWeekId === null) return;

      try {
        const leaderboardData = await getWeekLeaderboard(selectedWeekId);
        setSelectedWeek(leaderboardData.week);
        setWeekLeaderboard(leaderboardData.leaderboard);
      } catch (err) {
        setError('Failed to load leaderboard');
        console.error(err);
      }
    };

    fetchLeaderboard();
  }, [selectedWeekId]);

  if (loading) {
    return (
      <>
        <NavBar 
          onAdminPanelToggle={() => setViewMode(viewMode === 'admin' ? 'leaderboard' : 'admin')} 
          isAdminPanelOpen={viewMode === 'admin'}
          onParticipantsClick={() => setViewMode('participants')}
          onLeaderboardClick={() => setViewMode('leaderboard')}
          onManageSegmentsClick={() => setViewMode('segments')}
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
      />
      
      <div className="app app-content">
        {viewMode === 'admin' ? (
          <AdminPanel />
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

            <SeasonLeaderboard />

            <ScheduleTable weeks={weeks} />

            <Footer />
          </>
        )}
      </div>
    </>
  );
}

export default App;
