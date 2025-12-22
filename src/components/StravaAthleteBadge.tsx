import React from 'react';

interface Props {
  athleteId: number;
  name: string;
  profilePictureUrl?: string | null;
  showName?: boolean;
  size?: number;
  inverted?: boolean;
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
  size = 32,
  inverted = false
}) => {
  const [imageError, setImageError] = React.useState(false);

  // Reset error state if URL changes (though unlikely for same user)
  React.useEffect(() => {
    setImageError(false);
  }, [profilePictureUrl]);

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
        color: inverted ? 'white' : 'var(--wmv-purple)', // Inherit or explicit
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        // Only hover color change if NOT inverted (on highlighted card, keep white)
        if (!inverted) {
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--strava-orange, #FC5200)';
        }
      }}
      onMouseLeave={(e) => {
        if (!inverted) {
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--wmv-purple)';
        }
      }}
      title={`View ${name} on Strava`}
    >
      {/* Strava profile picture */}
      {profilePictureUrl && profilePictureUrl !== 'avatar/athlete/large.png' && !imageError ? (
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
          onError={() => setImageError(true)}
        />
      ) : (
        // Fallback: Initials if no picture OR if image failed to load
        <div style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: inverted ? 'white' : 'var(--wmv-orange, #FC5200)',
          color: inverted ? 'var(--wmv-orange, #FC5200)' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.max(10, size * 0.4)}px`, // Dynamic font size based on avatar size
          fontWeight: 600,
          textTransform: 'uppercase',
          userSelect: 'none'
        }}>
          {name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?'}
        </div>
      )}

      {/* Athlete name */}
      {showName && <span>{name}</span>}
    </a>
  );
};

export default StravaAthleteBadge;
