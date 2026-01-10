/**
 * useClubMembership.ts
 *
 * Custom hook for managing club membership UI state.
 *
 * Handles:
 * - Checking membership via tRPC endpoint
 * - Managing "Not Interested" (30-day localStorage cookie)
 * - Managing "Remind Later" (session-only dismiss)
 * - Loading/error states
 *
 * Simple, no configuration needed - club ID is hardcoded in router context
 */

import { useState } from 'react';
import { trpc } from '../utils/trpc';

const DECLINE_COOKIE_NAME = 'wmv_club_decline';
const DECLINE_COOKIE_DURATION_DAYS = 30;

interface UseClubMembershipOptions {
  athleteId?: string;
}

export const useClubMembership = (options: UseClubMembershipOptions = {}) => {
  const { athleteId } = options;
  const [isSessionDismissed, setIsSessionDismissed] = useState(false);

  // Check if user has permanently declined invitation (30-day cookie)
  const hasDeclinedPermanently = (): boolean => {
    if (typeof window === 'undefined') return false;
    const cookie = localStorage.getItem(DECLINE_COOKIE_NAME);
    return cookie === 'true';
  };

  // Query membership status via tRPC
  // Router will check current logged-in user against hardcoded club ID
  const { data: membershipData, isLoading, error } = trpc.club.checkMembership.useQuery(
    {},
    {
      enabled: !!athleteId && !isSessionDismissed && !hasDeclinedPermanently(),
    }
  );

  const isMember = membershipData?.isMember || false;

  // Set permanent decline (30 days)
  const notInterested = () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + DECLINE_COOKIE_DURATION_DAYS);
    localStorage.setItem(DECLINE_COOKIE_NAME, 'true');
    localStorage.setItem(`${DECLINE_COOKIE_NAME}_expiry`, expiryDate.toISOString());
  };

  // Set session-only dismiss
  const remindMeLater = () => {
    setIsSessionDismissed(true);
  };

  // Clear the "Not Interested" cookie (for testing or admin reset)
  const clearDecline = () => {
    localStorage.removeItem(DECLINE_COOKIE_NAME);
    localStorage.removeItem(`${DECLINE_COOKIE_NAME}_expiry`);
  };

  return {
    isMember,
    isLoading,
    error: error?.message,
    isSessionDismissed,
    hasDeclinedPermanently: hasDeclinedPermanently(),
    shouldShow: !!athleteId && !isMember && !isSessionDismissed && !hasDeclinedPermanently() && !isLoading,
    notInterested,
    remindMeLater,
    clearDecline, // for testing
  };
};
