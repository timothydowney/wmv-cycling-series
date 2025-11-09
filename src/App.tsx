import { useState, useEffect } from 'react';
import './App.css';
import WeeklyLeaderboard from './components/WeeklyLeaderboard';
import SeasonLeaderboard from './components/SeasonLeaderboard';
import WeekSelector from './components/WeekSelector';
import StravaConnect from './components/StravaConnect';
import ActivitySubmission from './components/ActivitySubmission';
import { getWeeks, getWeekLeaderboard, Week, LeaderboardEntry, AuthStatus } from './api';

function App() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [weekLeaderboard, setWeekLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

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

  // Function to refresh the leaderboard after submission
  const refreshLeaderboard = async () => {
    if (selectedWeekId === null) return;

    try {
      const leaderboardData = await getWeekLeaderboard(selectedWeekId);
      setSelectedWeek(leaderboardData.week);
      setWeekLeaderboard(leaderboardData.leaderboard);
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <h1>Western Mass Velo - Tuesday Competition</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <h1>Western Mass Velo - Tuesday Competition</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Western Mass Velo - Tuesday Competition</h1>
        <div className="auth-status">
          <StravaConnect onAuthChange={setAuthStatus} />
        </div>
      </header>

      <WeekSelector 
        weeks={weeks} 
        selectedWeekId={selectedWeekId}
        setSelectedWeekId={setSelectedWeekId}
      />

      {authStatus?.authenticated && selectedWeek && (
        <ActivitySubmission 
          weekId={selectedWeek.id}
          weekName={selectedWeek.week_name}
          segmentName={selectedWeek.segment_name || 'Unknown Segment'} 
          requiredLaps={selectedWeek.required_laps}
          onSubmitSuccess={refreshLeaderboard}
        />
      )}

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
    </div>
  );
}

export default App;
