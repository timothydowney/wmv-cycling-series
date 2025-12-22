import React from 'react';

interface Props {
  athleteId: number;
  name: string;
  profilePictureUrl?: string | null;
  showName?: boolean;
  size?: number;
}

/**
 * StravaAthleteBadge
 * 
 * Displays athlete profile picture and name, linked to their Strava profile.
 * Shows their actual Strava badge/avatar image to the left of their name.
 */
const StravaAthleteBadge: React.FC<Props> = ({
  athleteId,
  name,
  profilePictureUrl,
  showName = true,
  size = 32
}) => {
  return (
    <a
      href={`https://www.strava.com/athletes/${athleteId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showName ? '8px' : '0',
        margin: 0,
        padding: 0,
        lineHeight: 0, // Kill ghost spacing
        color: 'var(--wmv-purple)',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--strava-orange, #FC5200)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--wmv-purple)';
      }}
      title={`View ${name} on Strava`}
    >
      {/* Strava profile picture */}
      {profilePictureUrl ? (
        <img
          src={profilePictureUrl}
          alt={name}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            flexShrink: 0,
            objectFit: 'cover'
          }}
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        // Fallback: Strava logo if no picture
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="12" fill="var(--strava-orange, #FC5200)" opacity="0.2" />
          <path
            d="M15.7 8.2L9.3 21.5H12.7L19.1 8.2M9 15.2L3.3 27.8H6.7L12.4 15.2"
            fill="var(--strava-orange, #FC5200)"
            transform="translate(-3, -8)"
          />
        </svg>
      )}

      {/* Athlete name */}
      {showName && <span>{name}</span>}
    </a>
  );
};

export default StravaAthleteBadge;
