import React from 'react';

interface SegmentMetadataDisplayProps {
  distance?: number; // meters from Strava
  elevationGain?: number; // meters from Strava
  averageGrade?: number; // percentage from Strava
  climbCategory?: number | null; // climb category from Strava
}

/**
 * Display segment metadata in Strava-style vertical cards
 * Each metric (Distance, Elevation, Grade, Category) is a separate vertical card
 * with the label on top and value below, arranged horizontally.
 * 
 * Shows cached data as-is (in metric) until unit conversion is implemented.
 * Gracefully handles missing fields.
 */
export const SegmentMetadataDisplay: React.FC<SegmentMetadataDisplayProps> = ({
  distance,
  elevationGain,
  averageGrade,
  climbCategory
}) => {
  // If no data available, don't render anything
  if (!distance && !elevationGain && averageGrade === undefined && climbCategory === undefined) {
    return null;
  }

  return (
    <div className="segment-metadata-cards-container">
      {distance !== undefined && (
        <div className="metadata-card">
          <div className="metadata-label">Distance</div>
          <div className="metadata-value">{(distance / 1000).toFixed(2)} km</div>
        </div>
      )}
      
      {elevationGain !== undefined && (
        <div className="metadata-card">
          <div className="metadata-label">Elevation Gain</div>
          <div className="metadata-value">{Math.round(elevationGain)} m</div>
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
