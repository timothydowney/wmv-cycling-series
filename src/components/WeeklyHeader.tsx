import React from 'react';
import { Week } from '../types';
import { ArrowsRightLeftIcon, ArrowTrendingUpIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { formatUnixDate } from '../utils/dateUtils';
import { formatLapCount } from '../utils/lapFormatter';
import { useUnits } from '../context/UnitContext';
import { formatDistance, formatElevation } from '../utils/unitConversion';

interface Props {
    week: Week;
    weekNumber?: number;
}

export const WeeklyHeader: React.FC<Props> = ({ week, weekNumber }) => {
    const formattedDate = formatUnixDate(week.start_at);
    const { units } = useUnits();

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{
                        margin: 0,
                        fontSize: 'var(--font-2xl)',
                        color: 'var(--wmv-text-dark)',
                        lineHeight: 1.2,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        {week.week_name}
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
                        fontWeight: 500
                    }}>
                        {formattedDate} • Week {weekNumber}
                    </div>
                </div>

                {/* Strava Segment Link Icon */}
                <a
                    href={`https://www.strava.com/segments/${week.segment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View Segment on Strava"
                    style={{
                        color: 'var(--wmv-orange)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--wmv-orange-light)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        flexShrink: 0
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12 0L6 12h4l2-4 2 4h4L12 0z" />
                        <path d="M14 14l-2 4-2-4h-3l5 10 5-10h-3z" />
                    </svg>
                </a>
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

                {/* Segment Stats */}
                {week.segment_distance && (
                    <div className="week-header-chip" title="Distance">
                        <ArrowsRightLeftIcon className="week-header-chip-icon" />
                        {formatDistance(week.segment_distance, units)}
                    </div>
                )}

                {week.segment_total_elevation_gain && (
                    <div className="week-header-chip" title="Elevation Gain">
                        <ArrowTrendingUpIcon className="week-header-chip-icon" />
                        {formatElevation(week.segment_total_elevation_gain, units)}
                    </div>
                )}

                {week.segment_average_grade !== undefined && week.segment_average_grade !== null && (
                    <div className="week-header-chip" title="Average Grade">
                        <ChartBarIcon className="week-header-chip-icon" />
                        {week.segment_average_grade}%
                    </div>
                )}
            </div>

            {/* Debugging: Remove after Verification */}
        </div>
    );
};
