/**
 * Unit Conversion Utilities
 *
 * Pure functions for converting metric to imperial units.
 * No dependencies on React, context, or state.
 * Fully testable and reusable throughout the app.
 */

export type UnitSystem = 'metric' | 'imperial';

/**
 * Convert kilometers to miles
 * @param km Kilometers
 * @returns Miles
 */
export const kmToMiles = (km: number): number => km * 0.621371;

/**
 * Convert meters to feet
 * @param meters Meters
 * @returns Feet
 */
export const metersToFeet = (meters: number): number => meters * 3.28084;

/**
 * Format distance with appropriate units and precision
 * @param meters Distance in meters (from Strava API)
 * @param units Unit system preference ('metric' or 'imperial')
 * @returns Formatted string (e.g., "2.50 mi" or "4.02 km")
 */
export const formatDistance = (meters: number, units: UnitSystem): string => {
  const km = meters / 1000;
  if (units === 'metric') {
    return `${km.toFixed(2)} km`;
  } else {
    return `${kmToMiles(km).toFixed(2)} mi`;
  }
};

/**
 * Format elevation gain with appropriate units and precision
 * @param meters Elevation in meters (from Strava API)
 * @param units Unit system preference ('metric' or 'imperial')
 * @returns Formatted string (e.g., "800 ft" or "244 m")
 */
export const formatElevation = (meters: number, units: UnitSystem): string => {
  if (units === 'metric') {
    return `${Math.round(meters)} m`;
  } else {
    return `${Math.round(metersToFeet(meters))} ft`;
  }
};

/**
 * Format time in seconds to HH:MM:SS format
 * Useful for effort breakdown times (doesn't change with unit preference)
 * @param seconds Total seconds
 * @returns Formatted string (e.g., "00:15:30")
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(val => String(val).padStart(2, '0'))
    .join(':');
};
