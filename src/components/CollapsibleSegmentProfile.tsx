import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { SegmentEmbed } from './SegmentEmbed';

interface CollapsibleSegmentProfileProps {
  segmentId: string | number;
  defaultExpanded?: boolean;
}

/**
 * A collapsible wrapper for the SegmentEmbed profile.
 * Collapsed by default to reduce UI clutter.
 */
export const CollapsibleSegmentProfile: React.FC<CollapsibleSegmentProfileProps> = ({ 
  segmentId,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-segment-profile">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: '0',
          cursor: 'pointer',
          width: 'fit-content'
        }}
        className="profile-toggle-btn"
      >
        <h4 style={{
          margin: '0 0 12px 0',
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          color: 'var(--wmv-text-light)',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          Segment Profile
          {isExpanded ? (
            <ChevronUpIcon style={{ width: '16px', height: '16px', opacity: 0.7 }} />
          ) : (
            <ChevronDownIcon style={{ width: '16px', height: '16px', opacity: 0.7 }} />
          )}
        </h4>
      </button>

      {isExpanded && (
        <div style={{ marginTop: '12px', animation: 'slideDown 0.2s ease-out' }}>
          <SegmentEmbed segmentId={segmentId} showMap={false} />
        </div>
      )}
    </div>
  );
};
