import React from 'react';

/**
 * Custom SVG icons for cycling leader jerseys.
 * 
 * Yellow (TdF): Overall leader on flat/rolling tracks (Avg Gradient <= 2%)
 * Polkadot (TdF): King of the Mountains leader (Avg Gradient > 2%)
 * Lantern Rouge: Symbolic last rider (Red lantern icon - from historic race tradition)
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
    // Select appropriate resolution based on requested size
    let imageSrc = '/assets/lanternerouge-64.png';
    if (typeof size === 'number' && size > 64) {
      imageSrc = '/assets/lanternerouge-128.png';
    }
    if (typeof size === 'number' && size > 128) {
      imageSrc = '/assets/lanternerouge-256.png';
    }
    
    // Adjust height to match jersey aspect ratio (1.25:1 = size : size*0.8)
    const adjustedHeight = typeof size === 'number' ? size * 0.8 : size;
    
    return (
      <img
        src={imageSrc}
        alt="Lanterne Rouge - Final Rider"
        title="Lanterne Rouge - Final Rider"
        width={size}
        height={adjustedHeight}
        className={className}
        style={style}
      />
    );
  }

  return null;
};
