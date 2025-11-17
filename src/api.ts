// Backend API client
// In production (Railway), frontend and backend share one domain, so use relative URLs
// In development, frontend and backend are on different ports, so use explicit URL
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || (() => {
  // If running on localhost, use explicit backend URL for development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  // Otherwise (production), use relative URLs (same domain as frontend)
  return '';
})();

export interface Season {
  id: number;
  name: string;
  start_at: number; // Unix timestamp in seconds
  end_at: number;   // Unix timestamp in seconds
  is_active: number;
}

export interface Week {
  id: number;
  season_id: number;
  week_name: string;
  segment_id: number; // This is the Strava segment ID
  required_laps: number;
  start_at: number; // Unix timestamp in seconds (UTC)
  end_at: number;   // Unix timestamp in seconds (UTC)
  segment_name?: string;
  strava_segment_id?: number; // Same as segment_id (for backwards compatibility)
}

export interface SegmentEffort {
  lap: number;
  time_seconds: number;
  time_hhmmss: string;
  is_pr?: boolean;
  strava_effort_id?: number;
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
  effort_breakdown?: SegmentEffort[] | null;
  strava_effort_id?: number;
  device_name?: string | null;
}

export interface WeekLeaderboard {
  week: Week;
  leaderboard: LeaderboardEntry[];
}

export interface SeasonStanding {
  id: number;
  strava_athlete_id: number;
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
  is_admin: boolean;
}

// Segment interfaces
export interface AdminSegment {
  id: number; // same as strava_segment_id
  strava_segment_id: number;
  name: string;
  distance?: number;
  average_grade?: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface ValidatedSegmentDetails {
  id: number;
  name: string;
  distance?: number;
  average_grade?: number;
  city?: string;
  state?: string;
  country?: string;
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

  async getSeasonLeaderboard(seasonId: number): Promise<SeasonStanding[]> {
    const url = `${API_BASE_URL}/seasons/${seasonId}/leaderboard`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch season leaderboard');
    const data = await response.json();
    // Handle both formats: direct array or {season, leaderboard}
    return Array.isArray(data) ? data : data.leaderboard;
  },

  async createSeason(data: Partial<Season>): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/admin/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create season');
    }
    return response.json();
  },

  async updateSeason(seasonId: number, data: Partial<Season>): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/admin/seasons/${seasonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update season');
    }
    return response.json();
  },

  async deleteSeason(seasonId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/admin/seasons/${seasonId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete season');
    }
    return response.json();
  },

  async getWeeks(seasonId: number): Promise<Week[]> {
    const url = `${API_BASE_URL}/weeks?season_id=${seasonId}`;
    const response = await fetch(url);
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
    console.log('[API] Fetching auth status from:', API_BASE_URL || '(relative URL)');
    const response = await fetch(`${API_BASE_URL}/auth/status`, {
      credentials: 'include' // Important: include cookies for session
    });
    console.log('[API] Auth status response:', response.status, response.statusText);
    if (!response.ok) throw new Error('Failed to fetch auth status');
    const data = await response.json();
    console.log('[API] Auth status data:', data);
    return data;
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/disconnect`, {
      method: 'POST',
      credentials: 'include' // Important: include cookies for session
    });
    if (!response.ok) throw new Error('Failed to disconnect');
    return response.json();
  },

  getConnectUrl(): string {
    return `${API_BASE_URL}/auth/strava`;
  },

  async getAdminSegments(): Promise<AdminSegment[]> {
    const response = await fetch(`${API_BASE_URL}/admin/segments`);
    if (!response.ok) throw new Error('Failed to fetch segments');
    return response.json();
  },

  async validateSegment(id: number): Promise<ValidatedSegmentDetails> {
    const response = await fetch(`${API_BASE_URL}/admin/segments/${id}/validate`, { credentials: 'include' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Segment validation failed');
    }
    return response.json();
  },

  async addSegment(strava_segment_id: number, name: string, details?: Partial<ValidatedSegmentDetails>): Promise<AdminSegment> {
    const response = await fetch(`${API_BASE_URL}/admin/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        strava_segment_id, 
        name,
        distance: details?.distance,
        average_grade: details?.average_grade,
        city: details?.city,
        state: details?.state,
        country: details?.country
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to save segment');
    }
    return response.json();
  },

  async getAdminParticipants(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/admin/participants`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch participants');
    return response.json();
  },

  async createWeek(data: Partial<Week>): Promise<Week> {
    const response = await fetch(`${API_BASE_URL}/admin/weeks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create week');
    }
    return response.json();
  },

  async updateWeek(weekId: number, data: Partial<Week>): Promise<Week> {
    const response = await fetch(`${API_BASE_URL}/admin/weeks/${weekId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update week');
    }
    return response.json();
  },

  async deleteWeek(weekId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/admin/weeks/${weekId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete week');
    return response.json();
  },

  async fetchWeekResults(weekId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/weeks/${weekId}/fetch-results`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch results');
    }
    return response.json();
  },

};

// Named exports for convenience (used by components)
export async function getSeasons(): Promise<Season[]> {
  return api.getSeasons();
}

export async function getSeason(id: number): Promise<Season> {
  return api.getSeason(id);
}

export async function createSeason(data: Partial<Season>): Promise<Season> {
  return api.createSeason(data);
}

export async function updateSeason(seasonId: number, data: Partial<Season>): Promise<Season> {
  return api.updateSeason(seasonId, data);
}

export async function deleteSeason(seasonId: number): Promise<{ message: string }> {
  return api.deleteSeason(seasonId);
}

export async function getWeeks(seasonId: number): Promise<Week[]> {
  return api.getWeeks(seasonId);
}

export async function getWeek(id: number): Promise<Week> {
  return api.getWeek(id);
}

export async function getWeekLeaderboard(id: number): Promise<WeekLeaderboard> {
  return api.getWeekLeaderboard(id);
}

export async function getSeasonLeaderboard(seasonId: number): Promise<SeasonStanding[]> {
  return api.getSeasonLeaderboard(seasonId);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return api.getAuthStatus();
}

export async function disconnect(): Promise<{ success: boolean; message: string }> {
  return api.disconnect();
}

export function getConnectUrl(): string {
  return api.getConnectUrl();
}

export async function getAdminSegments(): Promise<AdminSegment[]> {
  return api.getAdminSegments();
}

export async function validateSegment(id: number): Promise<ValidatedSegmentDetails> {
  return api.validateSegment(id);
}

export async function addSegment(strava_segment_id: number, name: string, details?: Partial<ValidatedSegmentDetails>): Promise<AdminSegment> {
  return api.addSegment(strava_segment_id, name, details);
}

export async function getAdminParticipants(): Promise<any[]> {
  return api.getAdminParticipants();
}

export async function createWeek(data: Partial<Week>): Promise<Week> {
  return api.createWeek(data);
}

export async function updateWeek(weekId: number, data: Partial<Week>): Promise<Week> {
  return api.updateWeek(weekId, data);
}

export async function deleteWeek(weekId: number): Promise<{ message: string }> {
  return api.deleteWeek(weekId);
}

export async function fetchWeekResults(weekId: number): Promise<any> {
  return api.fetchWeekResults(weekId);
}
