import { useState } from 'react';
import './SegmentFinder.css';

interface SegmentDetails {
  id: number;
  name: string;
  activity_type: string;
  distance: number;
  average_grade: number;
  maximum_grade: number;
  elevation_high: number;
  elevation_low: number;
  climb_category: number;
  city: string;
  state: string;
  country: string;
  athlete_segment_stats?: {
    pr_elapsed_time?: number;
    pr_date?: string;
    effort_count?: number;
  };
}

function SegmentFinder() {
  const [segmentInput, setSegmentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<SegmentDetails | null>(null);

  const extractSegmentId = (input: string): string | null => {
    // Handle various input formats:
    // 1. Direct ID: "12744502"
    // 2. URL: "https://www.strava.com/segments/12744502"
    // 3. URL with extra params: "https://www.strava.com/segments/12744502?filter=overall"
    
    const urlMatch = input.match(/segments\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Check if it's just a number
    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }
    
    return null;
  };

  const handleSearch = async () => {
    const segmentId = extractSegmentId(segmentInput);
    
    if (!segmentId) {
      setError('Please enter a valid segment ID or Strava segment URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSegment(null);

    try {
      const response = await fetch(`http://localhost:3001/admin/segment/${segmentId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch segment');
      }

      const data = await response.json();
      setSegment(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatElevation = (meters: number) => {
    return `${meters.toFixed(0)} m`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getClimbCategory = (category: number) => {
    const categories = ['HC', '1', '2', '3', '4', 'Uncategorized'];
    return category >= 0 && category < categories.length ? categories[category] : 'Unknown';
  };

  return (
    <div className="segment-finder">
      <h3>Find Segment</h3>
      <p className="help-text">
        Enter a Strava segment URL (e.g., https://www.strava.com/segments/12744502) or just the segment ID
      </p>

      <div className="search-box">
        <input
          type="text"
          value={segmentInput}
          onChange={(e) => setSegmentInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Paste segment URL or ID here"
          className="segment-input"
        />
        <button 
          onClick={handleSearch}
          disabled={loading || !segmentInput.trim()}
          className="search-button"
        >
          {loading ? 'Searching...' : 'Find Segment'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {segment && (
        <div className="segment-details">
          <div className="segment-header">
            <h4>{segment.name}</h4>
            <div className="segment-id">ID: {segment.id}</div>
          </div>

          <div className="segment-stats">
            <div className="stat-row">
              <span className="stat-label">Type:</span>
              <span className="stat-value">{segment.activity_type}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Distance:</span>
              <span className="stat-value">{formatDistance(segment.distance)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Avg Grade:</span>
              <span className="stat-value">{segment.average_grade.toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Max Grade:</span>
              <span className="stat-value">{segment.maximum_grade.toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Elevation:</span>
              <span className="stat-value">
                {formatElevation(segment.elevation_low)} - {formatElevation(segment.elevation_high)}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Climb Category:</span>
              <span className="stat-value">{getClimbCategory(segment.climb_category)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Location:</span>
              <span className="stat-value">
                {segment.city}, {segment.state}, {segment.country}
              </span>
            </div>
          </div>

          {segment.athlete_segment_stats && (
            <div className="your-stats">
              <h5>Your Stats</h5>
              <div className="stat-row">
                <span className="stat-label">Attempts:</span>
                <span className="stat-value">{segment.athlete_segment_stats.effort_count || 0}</span>
              </div>
              {segment.athlete_segment_stats.pr_elapsed_time && (
                <>
                  <div className="stat-row">
                    <span className="stat-label">PR Time:</span>
                    <span className="stat-value">{formatTime(segment.athlete_segment_stats.pr_elapsed_time)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">PR Date:</span>
                    <span className="stat-value">
                      {segment.athlete_segment_stats.pr_date ? new Date(segment.athlete_segment_stats.pr_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="use-segment">
            <button 
              className="copy-button"
              onClick={() => {
                navigator.clipboard.writeText(segment.id.toString());
                alert(`Copied segment ID ${segment.id} to clipboard! Paste it into the week creation form.`);
              }}
            >
              📋 Copy Segment ID
            </button>
            <p className="copy-hint">
              Use this ID ({segment.id}) and name ("{segment.name}") when creating a week
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SegmentFinder;
