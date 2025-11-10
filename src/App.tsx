import { useState, useEffect } from 'react';
import './App.css';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import SeasonLeaderboard from './components/SeasonLeaderboard';
import WeekSelector from './components/WeekSelector';
import NavBar from './components/NavBar';
import AdminPanel from './components/AdminPanel';
import ParticipantStatus from './components/ParticipantStatus';
import ManageSegments from './components/ManageSegments';
import { getWeeks, getWeekLeaderboard, Week, LeaderboardEntry } from './api';

type ViewMode = 'leaderboard' | 'admin' | 'participants' | 'segments';

function App() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [weekLeaderboard, setWeekLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('leaderboard');

  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        setLoading(true);
        const weeksData = await getWeeks();
        setWeeks(weeksData);
        if (weeksData.length > 0) {
          setSelectedWeekId(weeksData[0].id);
        }
      } catch (err) {
        setError('Failed to load weeks. Make sure the backend server is running on port 3001.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeks();
  }, []);

  // Refresh weeks when switching back to leaderboard view
  useEffect(() => {
    const refreshWeeks = async () => {
      if (viewMode === 'leaderboard') {
        try {
          const weeksData = await getWeeks();
          setWeeks(weeksData);
          // If no week is selected but we have weeks, select the first one
          if (selectedWeekId === null && weeksData.length > 0) {
            setSelectedWeekId(weeksData[0].id);
          }
        } catch (err) {
          console.error('Failed to refresh weeks:', err);
        }
      }
    };

    refreshWeeks();
  }, [viewMode]); // Refresh when viewMode changes

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
            <WeekSelector 
              weeks={weeks} 
              selectedWeekId={selectedWeekId}
              setSelectedWeekId={setSelectedWeekId}
            />

            <WeeklyLeaderboard 
              week={selectedWeek}
              leaderboard={weekLeaderboard}
            />

            <SeasonLeaderboard />

            <footer className="app-footer">
              <img 
                src="/assets/strava/powered_by_strava.svg" 
                alt="Powered by Strava"
                className="strava-attribution"
              />
            </footer>
          </>
        )}
      </div>
    </>
  );
}

export default App;
