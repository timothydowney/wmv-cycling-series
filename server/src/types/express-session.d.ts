import 'express-session';

declare module 'express-session' {
  interface SessionData {
    stravaAthleteId: number;
    isAdmin: boolean;
    athleteName?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
