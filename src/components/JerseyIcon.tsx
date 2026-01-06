import React from 'react';

/**
 * Custom SVG icons for cycling leader jerseys.
 * 
 * Yellow (TdF): Overall leader on flat/rolling tracks (Avg Gradient <= 2%)
 * Polkadot (TdF): King of the Mountains leader (Avg Gradient > 2%)
 * Lantern Rouge: Symbolic last rider (Red lantern jersey)
 */

interface JerseyIconProps {
  type: 'yellow' | 'polkadot' | 'lantern';
  className?: string;
  size?: number | string;
}

export const JerseyIcon: React.FC<JerseyIconProps> = ({ type, className, size = 20 }) => {
  // Base jersey path (simplified vector shape for cycling jersey)
  const jerseyPath = "m10,47 15,40 40-25 10,125h100l10-125 40,25 15-40-50-35H162a64,64 0 0,1-74,0H60z";
  
  // Style for the container to maintain aspect ratio
  const style = {
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0
  };

  if (type === 'yellow') {
    return (
      <svg width={size} height={size} viewBox="0 0 250 200" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
        <title>Yellow Jersey - Leader</title>
        <path fill="#FFD700" stroke="#000" d={jerseyPath} strokeWidth="3"/>
      </svg>
    );
  }

  if (type === 'polkadot') {
    return (
      <svg width={size} height={size} viewBox="0 0 250 200" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
        <title>Polkadot Jersey - King of the Mountains</title>
        <defs>
          <pattern id="polkadots" patternUnits="userSpaceOnUse" width="40" height="40">
            <circle cx="20" cy="20" r="10" fill="#e11d48" />
          </pattern>
        </defs>
        <path fill="#fff" stroke="#000" d={jerseyPath} strokeWidth="3"/>
        <path fill="url(#polkadots)" d={jerseyPath} />
        <path fill="none" stroke="#000" d={jerseyPath} strokeWidth="3"/>
      </svg>
    );
  }

  if (type === 'lantern') {
    return (
      <svg width={size} height={size} viewBox="0 0 250 200" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
        <title>Lanterne Rouge - Final Rider</title>
        {/* Red Jersey Body */}
        <path fill="#dc2626" stroke="#000" d={jerseyPath} strokeWidth="3"/>
        
        {/* Simple Lantern Icon in the middle */}
        <g transform="translate(100, 50) scale(1.6)">
            {/* The Lantern handle/top */}
            <path d="M12 2L8 6H16L12 2Z" fill="#78350f" stroke="#000" strokeWidth="1"/>
            {/* Lantern frame */}
            <path d="M6 7H18V18C18 19.1 17.1 20 16 20H8C6.9 20 6 19.1 6 18V7Z" fill="#fbbf24" stroke="#000" strokeWidth="1"/>
            {/* Glass/Light area */}
            <rect x="9" y="10" width="6" height="7" fill="#f59e0b" />
            {/* Inner flame/glow */}
            <circle cx="12" cy="13.5" r="2" fill="#ef4444" />
        </g>
      </svg>
    );
  }

  return null;
};
