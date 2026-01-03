import './SegmentCard.css';

interface SegmentCardProps {
  id: string;
  name: string;
  distance?: number;
  average_grade?: number;
  city?: string;
  state?: string;
  country?: string;
}

function SegmentCard({ id, name, distance, average_grade, city, state, country }: SegmentCardProps) {
  const stravaUrl = `https://www.strava.com/segments/${id}`;
  
  const locationParts = [city, state, country].filter(Boolean);
  const hasStats = (distance !== undefined && distance !== null) || 
                   (average_grade !== undefined && average_grade !== null) || 
                   locationParts.length > 0;

  return (
    <div className="segment-card">
      <h4 className="segment-card-title">
        <a href={stravaUrl} target="_blank" rel="noopener noreferrer" className="segment-link">
          {name}
        </a>
        <span className="segment-id-pill">ID: {id}</span>
      </h4>
      {hasStats && (
        <div className="segment-card-stats">
          {(distance !== undefined && distance !== null) && <span>{(distance / 1000).toFixed(2)} km</span>}
          {(average_grade !== undefined && average_grade !== null) && <span>{average_grade.toFixed(1)}% avg grade</span>}
          {locationParts.length > 0 && <span>{locationParts.join(', ')}</span>}
        </div>
      )}
    </div>
  );
}

export default SegmentCard;
