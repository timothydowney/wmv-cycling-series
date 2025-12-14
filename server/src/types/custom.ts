import { Week, Segment } from '../db/schema';

// Define a type for the joined Week with Segment details and aggregated participant count
export type WeekWithDetails = Week &
  Partial<{
    segment_name: Segment['name'];
    segment_distance: Segment['distance'];
    segment_total_elevation_gain: Segment['total_elevation_gain'];
    segment_average_grade: Segment['average_grade'];
    segment_climb_category: Segment['climb_category'];
    segment_city: Segment['city'];
    segment_state: Segment['state'];
    segment_country: Segment['country'];
    participants_count: number;
  }>;
