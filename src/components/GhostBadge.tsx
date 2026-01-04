import React from 'react';
import { formatDurationShort } from '../utils/dateUtils';
import './GhostBadge.css';

interface GhostBadgeProps {
    timeDiffSeconds: number;
    previousWeekName: string;
    stravaActivityId?: string;
}

export const GhostBadge: React.FC<GhostBadgeProps> = ({ timeDiffSeconds, previousWeekName, stravaActivityId }) => {
    const isFaster = timeDiffSeconds < 0;
    const className = `ghost-badge ${isFaster ? 'faster' : 'slower'} ${stravaActivityId ? 'clickable' : ''}`;

    const content = (
        <>
            {isFaster ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" width="12" height="12" style={{ marginRight: '2px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" width="12" height="12" style={{ marginRight: '2px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
            )}
            {formatDurationShort(timeDiffSeconds)}
        </>
    );

    if (stravaActivityId) {
        return (
            <a
                href={`https://www.strava.com/activities/${stravaActivityId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`vs ${previousWeekName} (Click to view activity)`}
                className={className}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </a>
        );
    }

    return (
        <div
            title={`vs ${previousWeekName}`}
            className={className}
        >
            {content}
        </div>
    );
};
