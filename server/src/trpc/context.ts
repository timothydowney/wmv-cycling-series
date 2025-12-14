import { db, drizzleDb } from '../db'; // Import both for context, drizzleDb is the default
import { Request, Response } from 'express';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type Database as DatabaseType } from 'better-sqlite3';
import type { Session } from 'express-session';

interface CustomSession {
  stravaAthleteId?: number;
  isAdmin?: boolean;
}

export type Context = {
  req: Request;
  res: Response;
  // Expose both better-sqlite3 and Drizzle instances in context
  db: DatabaseType; // Raw better-sqlite3 instance
  drizzleDb: BetterSQLite3Database; // Drizzle instance
  orm: BetterSQLite3Database; // Canonical alias for Drizzle instance
  session: Session & Partial<CustomSession>;
  userId?: number;
  isAdmin: boolean;
};

export const createContext = ({
  req,
  res,
  dbOverride, // Optional better-sqlite3 db override for testing
  drizzleDbOverride, // Optional Drizzle db override for testing
  ormOverride, // Optional canonical orm override for testing
}: {
  req: Request;
  res: Response;
  dbOverride?: DatabaseType;
  drizzleDbOverride?: BetterSQLite3Database;
  ormOverride?: BetterSQLite3Database;
}): Context => {
  const sess = req.session as unknown as CustomSession | undefined;
  return {
    req,
    res,
    db: (dbOverride || db) as DatabaseType, // Use injected raw db or default
    drizzleDb: drizzleDbOverride || ormOverride || drizzleDb, // Use injected Drizzle db or default
    orm: ormOverride || drizzleDbOverride || drizzleDb, // Canonical alias for Drizzle (same instance)
    session: req.session as Session & Partial<CustomSession>,
    userId: sess?.stravaAthleteId,
    isAdmin: sess?.isAdmin || false,
  };
};