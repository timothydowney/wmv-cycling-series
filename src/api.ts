// Backend API client
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Week {
  id: number;
  season_id: number;
  week_name: string;
  date: string;
  segment_id: number;
  required_laps: number;
  start_time: string;
  end_time: string;
  segment_name?: string;
  strava_segment_id?: string;
}

export interface LeaderboardEntry {
  rank: number;
  participant_id: number;
  name: string;
  total_time_seconds: number;
  time_hhmmss: string;
  points: number;
  pr_bonus_points: number;
  activity_url: string;
  activity_date: string;
}

export interface WeekLeaderboard {
  week: Week;
  leaderboard: LeaderboardEntry[];
}

export interface SeasonStanding {
  id: number;
  name: string;
  total_points: number;
  weeks_completed: number;
}

export interface Participant {
  id: number;
  name: string;
  strava_athlete_id: number;
  is_connected: number;
}

export interface AuthStatus {
  authenticated: boolean;
  participant: Participant | null;
}

export interface ActivitySubmission {
  activity_url: string;
}

export interface SubmissionResponse {
  message: string;
  activity: {
    id: number;
    strava_activity_id: string;
    date: string;
    laps: number;
    segment: string;
  };
}

export const api = {
  async getSeasons(): Promise<Season[]> {
    const response = await fetch(`${API_BASE_URL}/seasons`);
    if (!response.ok) throw new Error('Failed to fetch seasons');
    return response.json();
  },

  async getSeason(id: number): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/seasons/${id}`);
    if (!response.ok) throw new Error('Failed to fetch season');
    return response.json();
  },

  async getSeasonLeaderboard(seasonId?: number): Promise<SeasonStanding[]> {
    const url = seasonId 
      ? `${API_BASE_URL}/seasons/${seasonId}/leaderboard`
      : `${API_BASE_URL}/season/leaderboard`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch season leaderboard');
    const data = await response.json();
    // Handle both formats: direct array or {season, leaderboard}
    return Array.isArray(data) ? data : data.leaderboard;
  },

  async getWeeks(): Promise<Week[]> {
    const response = await fetch(`${API_BASE_URL}/weeks`);
    if (!response.ok) throw new Error('Failed to fetch weeks');
    return response.json();
  },

  async getWeek(id: number): Promise<Week> {
    const response = await fetch(`${API_BASE_URL}/weeks/${id}`);
    if (!response.ok) throw new Error('Failed to fetch week');
    return response.json();
  },

  async getWeekLeaderboard(id: number): Promise<WeekLeaderboard> {
    const response = await fetch(`${API_BASE_URL}/weeks/${id}/leaderboard`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    return response.json();
  },

  async getAuthStatus(): Promise<AuthStatus> {
    const response = await fetch(`${API_BASE_URL}/auth/status`, {
      credentials: 'include' // Important: include cookies for session
    });
    if (!response.ok) throw new Error('Failed to fetch auth status');
    return response.json();
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/disconnect`, {
      method: 'POST',
      credentials: 'include' // Important: include cookies for session
    });
    if (!response.ok) throw new Error('Failed to disconnect');
    return response.json();
  },

  async submitActivity(weekId: number, data: ActivitySubmission): Promise<SubmissionResponse> {
    const response = await fetch(`${API_BASE_URL}/weeks/${weekId}/submit-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: include cookies for session
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to submit activity');
    }
    
    return response.json();
  },

  getConnectUrl(): string {
    return `${API_BASE_URL}/auth/strava`;
  },
};

// Named exports for convenience (used by components)
export async function getSeasons(): Promise<Season[]> {
  return api.getSeasons();
}

export async function getSeason(id: number): Promise<Season> {
  return api.getSeason(id);
}

export async function getWeeks(): Promise<Week[]> {
  return api.getWeeks();
}

export async function getWeek(id: number): Promise<Week> {
  return api.getWeek(id);
}

export async function getWeekLeaderboard(id: number): Promise<WeekLeaderboard> {
  return api.getWeekLeaderboard(id);
}

export async function getSeasonLeaderboard(seasonId?: number): Promise<SeasonStanding[]> {
  return api.getSeasonLeaderboard(seasonId);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return api.getAuthStatus();
}

export async function disconnect(): Promise<{ success: boolean; message: string }> {
  return api.disconnect();
}

export async function submitActivity(weekId: number, data: ActivitySubmission): Promise<SubmissionResponse> {
  return api.submitActivity(weekId, data);
}

export function getConnectUrl(): string {
  return api.getConnectUrl();
}
