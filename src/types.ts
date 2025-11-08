export interface Participant {
  id: number;
  name: string;
}

export interface Segment {
  id: number;
  name: string;
  strava_segment_id: string;
}

export interface Result {
  participant_id: number;
  time: string;
}

export interface Week {
  week_name: string;
  date: string;
  segment_id: number;
  laps: number;
  results: Result[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  time: string;
  points: number;
  participant_id: number | null;
}
