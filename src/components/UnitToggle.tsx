/**
 * Unit Preference Toggle Switch
 *
 * iOS-style toggle switch for switching between metric and imperial units.
 * Smooth animation, fully accessible with keyboard support and ARIA labels.
 * Uses universally recognizable unit abbreviations: mi (miles/imperial) and km (kilometers/metric)
 *
 * Usage:
 *   const { units, setUnits } = useUnits();
 *   <UnitToggle units={units} setUnits={setUnits} />
 */

import React from 'react';
import './UnitToggle.css';
import { UnitSystem } from '../context/UnitContext';

interface UnitToggleProps {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
}

/**
 * Toggle switch component for unit preference
 * Displays as a sliding switch with "mi" and "km" labels
 * Click to toggle, keyboard accessible (Enter/Space)
 */
export const UnitToggle: React.FC<UnitToggleProps> = ({ units, setUnits }) => {
  const handleToggle = () => {
    setUnits(units === 'imperial' ? 'metric' : 'imperial');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Toggle on Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      data-testid="unit-toggle"
      className={`unit-toggle-switch ${units}`}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={units === 'metric'}
      aria-label="Toggle between metric (km) and imperial (mi) units"
      tabIndex={0}
      title="Click to toggle between metric and imperial units"
    >
      {/* Sliding button showing current active unit */}
      <div className="unit-toggle-button" data-testid="unit-toggle-button">
        {units === 'imperial' ? 'mi' : 'km'}
      </div>
    </div>
  );
};

export default UnitToggle;
