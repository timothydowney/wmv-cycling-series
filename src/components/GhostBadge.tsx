import React from 'react';
import { formatDurationShort } from '../utils/dateUtils';

interface GhostBadgeProps {
    timeDiffSeconds: number;
    previousWeekName: string;
    stravaActivityId?: string;
}

export const GhostBadge: React.FC<GhostBadgeProps> = ({ timeDiffSeconds, previousWeekName, stravaActivityId }) => {
    const isFaster = timeDiffSeconds < 0;
    const color = isFaster ? '#16a34a' : '#dc2626'; // Green if faster, Red if slower
    const backgroundColor = isFaster ? '#dcfce7' : '#fee2e2';

    const style: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '8px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color,
        backgroundColor,
        padding: '2px 6px',
        borderRadius: '12px',
        whiteSpace: 'nowrap',
        textDecoration: 'none', // For the link
        cursor: stravaActivityId ? 'pointer' : 'default'
    };

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
                style={style}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </a>
        );
    }

    return (
        <div
            title={`vs ${previousWeekName}`}
            style={style}
        >
            {content}
        </div>
    );
};
