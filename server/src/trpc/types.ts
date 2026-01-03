export interface ResultSummary {
  resultId: number;
  weekId: number;
  participantId: string;
  participantName: string;
  totalTimeSeconds: number;
  rank: number;
  basePoints: number;
  prBonusPoints: number;
  totalPoints: number;
}

export interface LeaderboardEntryWithDetails {
  rank: number;
  participant_id: string;
  name: string;
  total_time_seconds: number;
  time_hhmmss: string; // This will need to be formatted in the frontend
  base_points: number; // NEW: Base points breakdown
  participation_bonus: number; // NEW: Participation bonus breakdown
  pr_bonus_points: number;
  multiplier: number; // NEW: Week multiplier
  points: number;
  activity_url: string;
  activity_date: string;
  profile_picture_url?: string | null;
  effort_breakdown?: Array<{
    lap: number;
    time_seconds: number;
    time_hhmmss: string;
    is_pr?: boolean;
    strava_effort_id?: string;
  }> | null;
  strava_effort_id?: string;
  device_name?: string | null;
}
