import React, { useState } from 'react';
import './SegmentSearch.css';

interface SegmentSearchProps {
  onSegmentSelect?: (segmentId: number, segmentName: string) => void;
}

interface SegmentResult {
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
  private: boolean;
  starred: boolean;
}

const SegmentSearch: React.FC<SegmentSearchProps> = ({ onSegmentSelect }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SegmentResult[]>([]);
  const [error, setError] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SegmentResult | null>(null);

  const handleFetchStarred = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setSelectedSegment(null);

    try {
      const response = await fetch(`http://localhost:3001/admin/segments/starred`, {
        credentials: 'include'
      });

      if (!response.ok) {
        let errorMessage = 'Failed to fetch starred segments';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Response wasn't JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResults(data.segments || []);
      
      if (!data.segments || data.segments.length === 0) {
        setError('No starred segments found. Star segments on Strava.com first!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch starred segments');
      console.error('Starred segments error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSegment = (segment: SegmentResult) => {
    setSelectedSegment(segment);
    if (onSegmentSelect) {
      onSegmentSelect(segment.id, segment.name);
    }
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const formatElevation = (high: number, low: number) => {
    const gain = high - low;
    return `${gain.toFixed(0)} m`;
  };

  const getClimbCategoryLabel = (category: number) => {
    if (category === 0) return 'No category';
    if (category === 1) return 'Category 4';
    if (category === 2) return 'Category 3';
    if (category === 3) return 'Category 2';
    if (category === 4) return 'Category 1';
    if (category === 5) return 'HC (Hors Catégorie)';
    return `Category ${category}`;
  };

  return (
    <div className="segment-search">
      <h3>Find Starred Segments</h3>
      <p className="segment-search-help">
        Load segments you've starred on Strava. Star segments on Strava.com first, then click below.
      </p>

      <button 
        onClick={handleFetchStarred}
        disabled={loading}
        className="segment-search-button"
      >
        {loading ? 'Loading...' : 'Load My Starred Segments'}
      </button>

      {error && (
        <div className="segment-search-error">{error}</div>
      )}

      {results.length > 0 && (
        <div className="segment-results">
          <h4>Search Results ({results.length})</h4>
          <div className="segment-results-list">
            {results.map((segment) => (
              <div 
                key={segment.id}
                className={`segment-result-card ${selectedSegment?.id === segment.id ? 'selected' : ''}`}
                onClick={() => handleSelectSegment(segment)}
              >
                <div className="segment-result-header">
                  <h5>{segment.name}</h5>
                  <span className="segment-result-id">ID: {segment.id}</span>
                </div>
                <div className="segment-result-details">
                  <div className="segment-result-stat">
                    <span className="stat-label">Distance:</span>
                    <span className="stat-value">{formatDistance(segment.distance)}</span>
                  </div>
                  <div className="segment-result-stat">
                    <span className="stat-label">Avg Grade:</span>
                    <span className="stat-value">{segment.average_grade.toFixed(1)}%</span>
                  </div>
                  <div className="segment-result-stat">
                    <span className="stat-label">Elev Gain:</span>
                    <span className="stat-value">{formatElevation(segment.elevation_high, segment.elevation_low)}</span>
                  </div>
                  <div className="segment-result-stat">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">
                      {getClimbCategoryLabel(segment.climb_category)}
                    </span>
                  </div>
                </div>
                {selectedSegment?.id === segment.id && (
                  <div className="segment-selected-badge">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSegment && (
        <div className="segment-selected-info">
          <strong>Selected:</strong> {selectedSegment.name} (ID: {selectedSegment.id})
        </div>
      )}
    </div>
  );
};

export default SegmentSearch;
