
import React from 'react';
import { Week, LeaderboardEntry } from '../types';
import './Card.css'; // Shared card styles
import './WeeklyLeaderboard.css'; // Keeping for now if it has other needed styles, but Card styles are moved.
import StravaAthleteBadge from './StravaAthleteBadge';
import { GhostBadge } from './GhostBadge';

interface Props {
    entry: LeaderboardEntry;
    week: Week | null;
    rank: number;
    isExpanded: boolean;
    onToggle: () => void;
    isCurrentUser: boolean;
}

export const LeaderboardCard: React.FC<Props> = ({
    entry,
    week,
    rank,
    isExpanded,
    onToggle,
    isCurrentUser
}) => {
    // Logic for display
    const multiplier = week?.multiplier || 1;
    const baseTotal = entry.points / multiplier;
    const beaten = baseTotal - 1 - entry.pr_bonus_points;
    const participation = 1;
    const prBonus = entry.pr_bonus_points;
    const hasPR = prBonus > 0;

    // Extract activity ID from URL for linking
    const activityId = entry.activity_url?.match(/activities\/(\d+)/)?.[1];

    return (
        <div
            onClick={onToggle}
            className={`leaderboard-card ${isCurrentUser ? 'current-user' : ''}`}
        >
            {/* Top Row: Collapsed State */}
            <div className="card-header">

                {/* 1. Rank */}
                <div className="card-rank">
                    {rank}
                </div>

                {/* 2. Avatar (Leftmost as requested, next to rank) */}
                <div className="card-avatar">
                    <StravaAthleteBadge
                        athleteId={entry.participant_id}
                        name={entry.name}
                        profilePictureUrl={entry.profile_picture_url}
                        showName={false}
                        size={32}
                        inverted={isCurrentUser}
                    />
                </div>

                {/* 3. Name & Points */}
                <div className="card-main-info">
                    <div className="card-name">
                        {entry.name}
                    </div>
                    <div className="card-points-row">
                        <span>{entry.points} pts</span>

                        {/* PR Badge - Trophy Icon */}
                        {hasPR && (
                            <div style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }} title="Personal Record set!">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    width="14"
                                    height="14"
                                    style={{ color: isCurrentUser ? 'white' : 'var(--wmv-orange)' }}
                                >
                                    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.052.543a.5.5 0 0 0-.378.641l1.721 5.91c.273.938.927 1.655 1.71 1.991A5.797 5.797 0 0 0 9 13.917v.28c0 2.207 1.76 4.02 3.969 4.28l.204.023a8.216 8.216 0 0 1-4.706 1.1c-.815 0-1.187.975-.54 1.545 2.14 1.884 5.378 1.884 7.518 0 .647-.57-.375-1.545-.54-1.545a8.218 8.218 0 0 1-4.706-1.1l.204-.023c2.209-.26 3.969-2.073 3.969-4.28v-.28a5.795 5.795 0 0 0 3.834-1.353c.783-.336 1.437-1.052 1.71-1.991l1.721-5.91a.5.5 0 0 0-.378-.641 9.94 9.94 0 0 0-3.052-.543V2.62a.75.75 0 0 0-.75-.75h-13.5a.75.75 0 0 0-.75.75Zm12.636 1.738a8.436 8.436 0 0 1 2.502.5.501.501 0 0 1 .184.148l-1.042 3.575a4.34 4.34 0 0 1-.803.951 7.277 7.277 0 0 0 1.93-4.665 8.169 8.169 0 0 1-2.771-.51ZM5.38 5.174l-1.042 3.575a.502.502 0 0 0 .185.148 8.437 8.437 0 0 0 2.502-.5 8.17 8.17 0 0 0-2.772.509 7.278 7.278 0 0 1 1.93 4.665 4.341 4.341 0 0 0-.803-.951Z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}


                    </div>
                </div>

                {/* 4. Right Side: Time, Chevron */}
                <div className="card-right-side">
                    <div className="card-time" style={{ display: 'flex', alignItems: 'center' }}>
                        {entry.time_hhmmss}
                        {entry.ghost_comparison && (
                            <GhostBadge
                                timeDiffSeconds={entry.ghost_comparison.time_diff_seconds}
                                previousWeekName={entry.ghost_comparison.previous_week_name}
                                stravaActivityId={entry.ghost_comparison.strava_activity_id}
                            />
                        )}
                    </div>

                    <div className="card-chevron" style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer' // Explicit cursor
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width="20" height="20">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="card-expanded-details">
                    {/* Time Breakdown */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--wmv-text-light)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Time
                        </div>

                        {entry.effort_breakdown && entry.effort_breakdown.length > 1 ? (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto',
                                rowGap: '6px',
                                fontSize: '0.9rem',
                                backgroundColor: 'white',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #eee'
                            }}>
                                {entry.effort_breakdown.map((effort, i) => (
                                    <React.Fragment key={i}>
                                        <div style={{ color: 'var(--wmv-text-light)', paddingRight: '12px' }}>Lap {effort.lap}</div>
                                        <div style={{ borderBottom: '1px dotted #e0e0e0', position: 'relative', top: '-6px' }} />
                                        <div style={{
                                            textAlign: 'right',
                                            fontWeight: 500,
                                            paddingLeft: '8px',
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            {effort.is_pr && (
                                                <span title="PR on this lap" style={{ display: 'flex', alignItems: 'center' }}>
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        width="12"
                                                        height="12"
                                                        style={{ color: 'var(--wmv-orange)' }}
                                                    >
                                                        <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.052.543a.5.5 0 0 0-.378.641l1.721 5.91c.273.938.927 1.655 1.71 1.991A5.797 5.797 0 0 0 9 13.917v.28c0 2.207 1.76 4.02 3.969 4.28l.204.023a8.216 8.216 0 0 1-4.706 1.1c-.815 0-1.187.975-.54 1.545 2.14 1.884 5.378 1.884 7.518 0 .647-.57-.375-1.545-.54-1.545a8.218 8.218 0 0 1-4.706-1.1l.204-.023c2.209-.26 3.969-2.073 3.969-4.28v-.28a5.795 5.795 0 0 0 3.834-1.353c.783-.336 1.437-1.052 1.71-1.991l1.721-5.91a.5.5 0 0 0-.378-.641 9.94 9.94 0 0 0-3.052-.543V2.62a.75.75 0 0 0-.75-.75h-13.5a.75.75 0 0 0-.75.75Zm12.636 1.738a8.436 8.436 0 0 1 2.502.5.501.501 0 0 1 .184.148l-1.042 3.575a4.34 4.34 0 0 1-.803.951 7.277 7.277 0 0 0 1.93-4.665 8.169 8.169 0 0 1-2.771-.51ZM5.38 5.174l-1.042 3.575a.502.502 0 0 0 .185.148 8.437 8.437 0 0 0 2.502-.5 8.17 8.17 0 0 0-2.772.509 7.278 7.278 0 0 1 1.93 4.665 4.341 4.341 0 0 0-.803-.951Z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            )}
                                            {effort.strava_effort_id && activityId ? (
                                                <a
                                                    href={`https://www.strava.com/activities/${activityId}/segments/${effort.strava_effort_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--wmv-text-dark)', textDecoration: 'none' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {effort.time_hhmmss}
                                                </a>
                                            ) : effort.time_hhmmss}
                                        </div>
                                    </React.Fragment>
                                ))}
                                <div style={{ gridColumn: '1 / -1', height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }}></div>
                                <div style={{ fontWeight: 600 }}>Total</div>
                                <div></div>
                                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                                    {entry.time_hhmmss}
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--wmv-text-dark)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: 'white',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #eee'
                            }}>
                                <span style={{ fontWeight: 600 }}>Total</span>
                                <span style={{ fontWeight: 700 }}>
                                    {entry.time_hhmmss}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Points Logic */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--wmv-text-light)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                            Points Calculation
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--wmv-text-light)', lineHeight: 1.6, backgroundColor: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                            <div>
                                {`Beat ${beaten} + ${participation} participation`}
                                {hasPR && ` + ${prBonus} PR`}
                                {multiplier > 1 && ` * ${multiplier}X`}
                                {' = '}
                                <strong>{entry.points} points total</strong>
                            </div>
                        </div>
                    </div>

                    {/* Verification Status */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        borderTop: '1px solid #eee',
                        paddingTop: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2e7d32', fontWeight: 500 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                            </svg>
                            {entry.device_name ? `Verified via ${entry.device_name}` : 'Verified via Strava'}
                        </div>

                        {/* Strava Link Button */}
                        {activityId && (
                            <a
                                href={`https://www.strava.com/activities/${activityId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    backgroundColor: '#fc4c02',
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e34402')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fc4c02')}
                            >
                                View Activity
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
