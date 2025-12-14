export interface ResultSummary {
  resultId: number;
  weekId: number;
  participantId: number;
  participantName: string;
  totalTimeSeconds: number;
  rank: number;
  basePoints: number;
  prBonusPoints: number;
  totalPoints: number;
}

export interface LeaderboardEntryWithDetails {
  rank: number;
  participant_id: number;
  name: string;
  total_time_seconds: number;
  time_hhmmss: string; // This will need to be formatted in the frontend
  points: number;
  pr_bonus_points: number;
  activity_url: string;
  activity_date: string;
  profile_picture_url?: string | null;
  effort_breakdown?: Array<{
    lap: number;
    time_seconds: number;
    time_hhmmss: string;
    is_pr?: boolean;
    strava_effort_id?: number;
  }> | null;
  strava_effort_id?: number;
  device_name?: string | null;
}
