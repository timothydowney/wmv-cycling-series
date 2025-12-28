import React from 'react';
import { useUnits } from '../context/UnitContext';
import { formatDistance, formatElevation } from '../utils/unitConversion';
import './SegmentMetadataDisplay.css';

/**
 * Segment metadata type - self-contained with all segment display fields.
 * Supports both database schema (snake_case) and display-friendly naming.
 */
export interface Segment {
  distance?: number; // meters from Strava
  total_elevation_gain?: number; // meters from Strava
  elevation_gain?: number; // alternative field name
  average_grade?: number; // percentage from Strava
  segment_average_grade?: number; // alternative field name
  climb_category?: number | null; // climb category from Strava
  climbCategory?: number | null; // alternative field name
}

interface SegmentMetadataDisplayProps {
  segment: Segment; // Pass the entire segment object
}

/**
 * Display segment metadata in Strava-style vertical cards
 * Each metric (Distance, Elevation, Grade, Category) is a separate vertical card
 * with the label on top and value below, arranged horizontally.
 * 
 * Accepts a Segment object with metadata fields. Gracefully handles missing fields.
 * Self-contained: handles field name variations (snake_case and camelCase).
 */
export const SegmentMetadataDisplay: React.FC<SegmentMetadataDisplayProps> = ({
  segment
}) => {
  const { units } = useUnits();

  // Extract fields, supporting both naming conventions
  const distance = segment.distance;
  const elevationGain = segment.total_elevation_gain ?? segment.elevation_gain;
  const averageGrade = segment.segment_average_grade ?? segment.average_grade;
  const climbCategory = segment.climb_category ?? segment.climbCategory;

  // If no data available, don't render anything
  if (!distance && !elevationGain && averageGrade === undefined && climbCategory === undefined) {
    return null;
  }

  return (
    <div className="segment-metadata-cards-container">
      {distance !== undefined && (
        <div className="metadata-card">
          <div className="metadata-label">Distance</div>
          <div className="metadata-value">{formatDistance(distance, units)}</div>
        </div>
      )}

      {elevationGain !== undefined && (
        <div className="metadata-card">
          <div className="metadata-label">Elevation Gain</div>
          <div className="metadata-value">{formatElevation(elevationGain, units)}</div>
        </div>
      )}

      {averageGrade !== undefined && (
        <div className="metadata-card">
          <div className="metadata-label">Avg Grade</div>
          <div className="metadata-value">{averageGrade.toFixed(1)}%</div>
        </div>
      )}

      {climbCategory !== undefined && climbCategory !== null && (
        <div className="metadata-card">
          <div className="metadata-label">Category</div>
          <div className="metadata-value">Cat {climbCategory}</div>
        </div>
      )}
    </div>
  );
};

export default SegmentMetadataDisplay;
