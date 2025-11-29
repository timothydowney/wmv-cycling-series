import * as trpcExpress from '@trpc/server/adapters/express';
import { db } from '../db'; // Import the singleton DB instance
import type { Database } from 'better-sqlite3';

interface CustomSession {
  stravaAthleteId?: number;
  isAdmin?: boolean;
}

export type Context = {
  req: trpcExpress.CreateExpressContextOptions['req'];
  res: trpcExpress.CreateExpressContextOptions['res'];
  db: Database;
  session: any; // express-session type is complex, any is practical here or explicit Session type
  userId?: number;
  isAdmin: boolean;
};

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => {
  const sess = req.session as unknown as CustomSession;
  return {
    req,
    res,
    db,
    // Helper to get current user ID from session
    session: req.session,
    userId: sess.stravaAthleteId,
    isAdmin: sess.isAdmin || false,
  };
};
