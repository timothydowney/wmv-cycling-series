import React from 'react';
import { Link } from 'react-router-dom';
import StravaAthleteBadge from './StravaAthleteBadge';
import './Card.css'; // Shared card styles
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { JerseyIcon } from './JerseyIcon';
import { JerseyType } from '../utils/jerseyUtils';

interface Props {
    rank: number;
    participantName: string;
    profilePictureUrl?: string | null;
    totalPoints: number;
    weeksCompleted: number;
    isCurrentUser: boolean;
    stravaAthleteId: string;
    jerseyTypes?: JerseyType[];
}

export const SeasonCard: React.FC<Props> = ({
    rank,
    participantName,
    profilePictureUrl,
    totalPoints,
    weeksCompleted,
    isCurrentUser,
    stravaAthleteId,
    jerseyTypes = []
}) => {
    return (
        <div className={`leaderboard-card ${isCurrentUser ? 'current-user' : ''}`}>
            <div className="card-header">
                {/* Jersey Icons (on the left like weekly) */}
                <div className="card-jersey" style={{ 
                    display: 'flex', 
                    gap: '2px',
                    minWidth: jerseyTypes.length > 0 ? (jerseyTypes.length * 24) : '28px' 
                }}>
                    {jerseyTypes.map(type => (
                        <div key={type} title={
                            type === 'yellow' ? 'Overall Leader' :
                            type === 'polkadot' ? 'King of the Mountains' :
                            'Lanterne Rouge'
                        }>
                            <JerseyIcon type={type} size={28} />
                        </div>
                    ))}
                </div>

                {/* Rank */}
                <div className="card-rank">
                    {rank}
                </div>

                {/* Avatar */}
                <div className="card-avatar">
                    <StravaAthleteBadge
                        athleteId={stravaAthleteId}
                        name={participantName}
                        profilePictureUrl={profilePictureUrl}
                        showName={false}
                        size={40}
                        inverted={isCurrentUser}
                    />
                </div>

                {/* Name & Details */}
                <div className="card-main-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', overflow: 'hidden' }}>
                    <div className="card-name" style={{ fontSize: '1.0rem', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link 
                            to={`/profile/${stravaAthleteId}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                            {participantName}
                        </Link>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: isCurrentUser ? 'rgba(255, 255, 255, 0.2)' : '#f3f4f6', // Transparent white if highlighted
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        color: isCurrentUser ? 'white' : 'var(--wmv-text-light)',
                        fontWeight: 500,
                        gap: '4px'
                    }}>
                        <CalendarDaysIcon style={{ width: '12px', height: '12px' }} />
                        <span>{weeksCompleted} wks</span>
                    </div>
                </div>

                {/* Right Side: Total Points */}
                <div className="card-right-side">
                    <div className="card-points-row" style={{ 
                        marginTop: 0, 
                        color: isCurrentUser ? 'white' : 'inherit' 
                    }}>
                        <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>
                            {totalPoints}
                        </span>
                        <span style={{ fontWeight: 400, marginLeft: '2px', fontSize: '0.9rem' }}>
                            pts
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
