import { db, drizzleDb } from '../db'; // Import both for context, drizzleDb is the default
import { Request, Response } from 'express';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type Database as DatabaseType } from 'better-sqlite3';
import type { Session } from 'express-session';
import { config } from '../config';
import { AuthorizationService } from '../services/AuthorizationService';

interface CustomSession {
  stravaAthleteId?: string;
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
  userId?: string;
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
  const orm = ormOverride || drizzleDbOverride || drizzleDb;
  const userId = sess?.stravaAthleteId ? String(sess.stravaAthleteId) : undefined;
  const authorizationService = new AuthorizationService(orm, () => config.adminAthleteIds);

  return {
    req,
    res,
    db: (dbOverride || db) as DatabaseType, // Use injected raw db or default
    drizzleDb: orm, // Use injected Drizzle db or default
    orm, // Canonical alias for Drizzle (same instance)
    session: req.session as Session & Partial<CustomSession>,
    userId,
    isAdmin: authorizationService.isAdmin(userId),
  };
};