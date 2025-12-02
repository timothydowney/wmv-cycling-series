import { db, drizzleDb } from '../db'; // Import both for context, drizzleDb is the default
import { Request, Response } from 'express';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

interface CustomSession {
  stravaAthleteId?: number;
  isAdmin?: boolean;
}

export type Context = {
  req: Request;
  res: Response;
  // Expose both better-sqlite3 and Drizzle instances in context
  db: any; // Raw better-sqlite3 instance
  drizzleDb: BetterSQLite3Database; // Drizzle instance
  session: any;
  userId?: number;
  isAdmin: boolean;
};

export const createContext = ({
  req,
  res,
  dbOverride, // Optional better-sqlite3 db override for testing
  drizzleDbOverride, // Optional Drizzle db override for testing
}: { req: Request; res: Response; dbOverride?: any; drizzleDbOverride?: BetterSQLite3Database }): Context => {
  const sess = req.session as unknown as CustomSession | undefined;
  return {
    req,
    res,
    db: dbOverride || db, // Use injected raw db or default
    drizzleDb: drizzleDbOverride || drizzleDb, // Use injected Drizzle db or default
    session: req.session,
    userId: sess?.stravaAthleteId,
    isAdmin: sess?.isAdmin || false,
  };
};