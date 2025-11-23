/**
 * Unit Preference Context
 *
 * Provides global access to the user's unit preference (metric or imperial)
 * backed by localStorage for persistence across browser sessions.
 *
 * Usage:
 *   const { units, setUnits } = useUnits();
 *   <button onClick={() => setUnits('imperial')}>Imperial</button>
 */

import React, { createContext, useState, useCallback, ReactNode } from 'react';

export type UnitSystem = 'metric' | 'imperial';

interface UnitContextType {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
}

/**
 * Context object - internal, use useUnits() hook instead
 */
export const UnitContext = createContext<UnitContextType | undefined>(undefined);

interface UnitProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the entire app
 * Loads preference from localStorage on mount, persists on change
 */
export const UnitProvider: React.FC<UnitProviderProps> = ({ children }) => {
  // Initialize from localStorage with imperial as default
  const [units, setUnitsState] = useState<UnitSystem>(() => {
    if (typeof window === 'undefined') {
      return 'imperial'; // SSR safety
    }
    const saved = localStorage.getItem('wmv_unit_preference');
    return (saved as UnitSystem) || 'imperial';
  });

  /**
   * Update units and persist to localStorage
   */
  const setUnits = useCallback((newUnits: UnitSystem) => {
    setUnitsState(newUnits);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wmv_unit_preference', newUnits);
    }
  }, []);

  return (
    <UnitContext.Provider value={{ units, setUnits }}>
      {children}
    </UnitContext.Provider>
  );
};

/**
 * Hook to access unit preference anywhere in the app
 * Must be used within a UnitProvider wrapper
 * @throws Error if used outside of UnitProvider
 */
export const useUnits = (): UnitContextType => {
  const context = React.useContext(UnitContext);
  if (!context) {
    throw new Error(
      'useUnits must be used within a UnitProvider. ' +
      'Make sure your component is wrapped with <UnitProvider>.'
    );
  }
  return context;
};

/**
 * Hook to safely access unit preference (for cases where wrapping isn't guaranteed)
 * Returns the current unit preference or undefined if outside provider
 * @returns UnitContextType | undefined
 */
export const useUnitsOptional = (): UnitContextType | undefined => {
  return React.useContext(UnitContext);
};
