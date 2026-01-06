import React from 'react';
import { useUnits } from '../context/UnitContext';

interface SegmentEmbedProps {
  segmentId: string | number;
  showMap?: boolean;
  height?: number;
}

/**
 * Renders a VeloViewer embed for a Strava segment.
 * embed1 = overview (elevation profile + stats) - 450px default
 * embed2 = overview + map - 600px default
 */
export const SegmentEmbed: React.FC<SegmentEmbedProps> = ({ 
  segmentId, 
  showMap = true, 
  height 
}) => {
  const { units } = useUnits();
  const mode = showMap ? 'embed2' : 'embed';
  const defaultHeight = showMap ? 600 : 450;
  const actualHeight = height || defaultHeight;
  
  // Veloviewer units: i = imperial, m = metric
  const unitParam = units === 'imperial' ? 'i' : 'm';
  const src = `https://veloviewer.com/segments/${segmentId}/${mode}?units=${unitParam}`;

  return (
    <div className="segment-embed-container" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
      <iframe 
        style={{ width: '100%', height: `${actualHeight}px`, display: 'block' }} 
        src={src} 
        frameBorder="0" 
        scrolling="no"
        title={`VeloViewer Segment ${segmentId}`}
      />
    </div>
  );
};
