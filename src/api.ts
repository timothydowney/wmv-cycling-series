// Backend API client
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Week {
  id: number;
  week_name: string;
  date: string;
  segment_id: number;
  required_laps: number;
  start_time: string;
  end_time: string;
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

export const api = {
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

  async getSeasonLeaderboard(): Promise<SeasonStanding[]> {
    const response = await fetch(`${API_BASE_URL}/season/leaderboard`);
    if (!response.ok) throw new Error('Failed to fetch season leaderboard');
    return response.json();
  },
};

// Named exports for convenience (used by components)
export async function getWeeks(): Promise<Week[]> {
  return api.getWeeks();
}

export async function getWeek(id: number): Promise<Week> {
  return api.getWeek(id);
}

export async function getWeekLeaderboard(id: number): Promise<WeekLeaderboard> {
  return api.getWeekLeaderboard(id);
}

export async function getSeasonLeaderboard(): Promise<SeasonStanding[]> {
  return api.getSeasonLeaderboard();
}
