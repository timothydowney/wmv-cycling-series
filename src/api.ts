import { parseSSE } from './utils/sseParser';
import { Season, Week, AuthStatus, AdminSegment, ValidatedSegmentDetails, LeaderboardEntry } from './types';

export type { Season, Week, AuthStatus, AdminSegment, ValidatedSegmentDetails, LeaderboardEntry };

// Backend API client
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || (() => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return '';
})();

export const api = {
  // AUTH (Express routes)
  async getAuthStatus(): Promise<AuthStatus> {
    const response = await fetch(`${API_BASE_URL}/auth/status`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch auth status');
    return response.json();
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/disconnect`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to disconnect');
    return response.json();
  },

  getConnectUrl(): string {
    return `${API_BASE_URL}/auth/strava`;
  },

  async fetchWeekResults(weekId: number, onLog?: (log: any) => void): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/admin/weeks/${weekId}/fetch-results`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Fetch failed with status ${response.status}:`, errorText);
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    return new Promise<any>((resolve, reject) => {
      let result: any = null;
      let hasError = false;

      parseSSE(
        response.body,
        {
          log: (logData: any) => {
            console.log('[API] Received log event:', logData);
            if (onLog) {
              onLog(logData);
            }
          },
          complete: (completeData: any) => {
            console.log('[API] Fetch completed:', completeData);
            result = completeData;
          },
          error: (errorData: any) => {
            console.error('[API] Server error:', errorData);
            hasError = true;
            const errorMsg = errorData?.error || errorData?.message || 'Unknown server error';
            reject(new Error(errorMsg));
          }
        }
      )
        .then(() => {
          if (!hasError) {
            if (!result) {
              reject(new Error('Stream ended without completion event'));
            } else {
              resolve(result);
            }
          }
        })
        .catch((parseError: Error) => {
          console.error('[API] Stream parsing error:', parseError);
          reject(parseError);
        });
    });
  },
};

// Named exports for compatibility
export const getAuthStatus = api.getAuthStatus;
export const disconnect = api.disconnect;
export const getConnectUrl = api.getConnectUrl;
export const fetchWeekResults = api.fetchWeekResults;
// Webhook exports could be added if needed individually, but usually used via api object
