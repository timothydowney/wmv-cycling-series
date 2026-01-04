// Shared types for frontend
// Ideally these should be imported from server schema, but for now defining them here to unbreak build

export interface Season {
  id: number;
  name: string;
  start_at: number;
  end_at: number;
  is_active: number | null;
}

export interface Week {
  id: number;
  season_id: number;
  week_name: string;
  strava_segment_id: string;
  segment_id?: number; // Legacy alias
  required_laps: number;
  multiplier: number;
  start_at: number;
  end_at: number;
  notes?: string | null;
  
  // Joined fields
  segment_name?: string | null;
  segment_distance?: number | null;
  segment_total_elevation_gain?: number | null;
  segment_average_grade?: number | null;
  segment_climb_category?: number | null;
  segment_city?: string | null;
  segment_state?: string | null;
  segment_country?: string | null;
  participants_count?: number;
}

export interface Participant {
  id: number;
  name: string;
  strava_athlete_id: string;
  is_connected: number; // 0 or 1
  profile_picture_url?: string | null;
}

export interface AuthStatus {
  authenticated: boolean;
  participant: Participant | null;
  is_admin: boolean;
}

export interface AdminSegment {
  strava_segment_id: string;
  name: string;
  distance?: number | null;
  average_grade?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  total_elevation_gain?: number | null;
  climb_category?: number | null;
}

export interface ValidatedSegmentDetails {
  strava_segment_id: string;
  name: string;
  distance?: number | null;
  average_grade?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  participant_id: string;
  name: string;
  total_time_seconds: number;
  time_hhmmss: string;
  points: number;
  pr_bonus_points: number;
  activity_url: string;
  activity_date: string;
  profile_picture_url?: string | null;
  effort_breakdown?: any[] | null;
  strava_effort_id?: string;
  device_name?: string | null;
  ghost_comparison?: {
    previous_time_seconds: number;
    previous_week_name: string;
    time_diff_seconds: number;
    strava_activity_id?: string;
  } | null;
}
