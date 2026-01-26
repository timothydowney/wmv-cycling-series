import React, { useMemo } from 'react';
import { Week } from '../types';
import { ArrowsRightLeftIcon, ArrowTrendingUpIcon, ChartBarIcon, UsersIcon, ChevronDownIcon, ClockIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { formatUnixDate, formatUnixTime } from '../utils/dateUtils';
import { formatLapCount } from '../utils/lapFormatter';
import { useUnits } from '../context/UnitContext';
import { formatDistance, formatElevation } from '../utils/unitConversion';

interface Props {
    week: Week;
    weekNumber?: number;
    participantCount?: number;
    onClick?: () => void;
    isExpanded?: boolean;
}

export const WeeklyHeader: React.FC<Props> = ({
    week,
    weekNumber,
    participantCount,
    onClick,
    isExpanded = false
}) => {
    const { formattedDate, timeWindow } = useMemo(() => {
        return {
            formattedDate: formatUnixDate(week.start_at),
            timeWindow: `${formatUnixTime(week.start_at)} - ${formatUnixTime(week.end_at)}`
        };
    }, [week.start_at, week.end_at]);

    const { units } = useUnits();

    return (
        <div
            onClick={onClick}
            style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '16px', // Reduced from 24px for better list density
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative',
                zIndex: 20, // Ensure header stays above expanded notes
                border: onClick && isExpanded ? '1px solid var(--wmv-orange)' : '1px solid transparent'
            }}
            className={onClick ? "hover:shadow-md" : ""}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                }
            }}
            onMouseLeave={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                }
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}> {/* Allow flex grow for main content */}
                    {/* Week Name - Clickable Strava Link */}
                    <h2 style={{
                        margin: 0,
                        fontSize: 'var(--font-2xl)',
                        lineHeight: 1.2,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        <a
                            href={`https://www.strava.com/segments/${week.strava_segment_id || week.segment_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                color: 'var(--wmv-orange)',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            className="week-title-link hover:underline"
                        >
                            {week.week_name}
                            <ArrowTopRightOnSquareIcon width={20} height={20} />
                        </a>

                        {week.multiplier > 1 && (
                            <span style={{
                                backgroundColor: 'var(--wmv-orange)',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.5em',
                                fontWeight: 700,
                                lineHeight: 1,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                marginTop: '3px'
                            }}>
                                {week.multiplier}X Pts
                            </span>
                        )}
                    </h2>
                    <div style={{
                        color: 'var(--wmv-text-light)',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap'
                    }}>
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span>Week {weekNumber}</span>
                        <span>•</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Local Time Window">
                            <ClockIcon width={14} height={14} />
                            {timeWindow}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Expand/Collapse Toggle Button (Always visible for consistency) */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClick) onClick();
                        }}
                        disabled={!onClick}
                        title={onClick ? (isExpanded ? "Collapse notes" : "Expand notes") : "No notes available"}
                        aria-label={isExpanded ? "Collapse notes" : "Expand notes"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: onClick ? 'pointer' : 'default',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: onClick ? 'var(--wmv-text-light)' : 'var(--wmv-gray-300)',
                            transition: 'transform 0.2s ease, color 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            opacity: onClick ? 1 : 0.5
                        }}
                        className="week-expand-toggle"
                    >
                        <ChevronDownIcon width={24} height={24} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>


                <div style={{
                    backgroundColor: 'var(--wmv-bg-light)',
                    color: 'var(--wmv-text-light)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    display: 'inline-block'
                }}>
                    {formatLapCount(week.required_laps)}
                </div>

                {/* Participant Count: Always show if count exists */}
                {participantCount !== undefined && (
                    <div className="week-header-chip" title="Participants">
                        <UsersIcon className="week-header-chip-icon" />
                        {participantCount}
                    </div>
                )}

                {/* Segment Stats */}
                {week.segment_distance && (
                    <div className="week-header-chip" title="Distance" data-testid="segment-distance-chip">
                        <ArrowsRightLeftIcon className="week-header-chip-icon" />
                        {formatDistance(week.segment_distance, units)}
                    </div>
                )}

                {week.segment_total_elevation_gain && (
                    <div className="week-header-chip" title="Elevation Gain" data-testid="segment-elevation-chip">
                        <ArrowTrendingUpIcon className="week-header-chip-icon" />
                        {formatElevation(week.segment_total_elevation_gain, units)}
                    </div>
                )}

                {week.segment_average_grade !== undefined && week.segment_average_grade !== null && (
                    <div className="week-header-chip" title="Average Grade" data-testid="segment-grade-chip">
                        <ChartBarIcon className="week-header-chip-icon" />
                        {week.segment_average_grade}%
                    </div>
                )}


            </div>
        </div>
    );
};
