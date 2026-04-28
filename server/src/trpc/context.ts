import { db, drizzleDb } from '../db'; // Import both for context, drizzleDb is the default
import { Request, Response } from 'express';
import type { Session } from 'express-session';
import { config } from '../config';
import { AuthorizationService } from '../services/AuthorizationService';
import type { AppDatabase, RawDatabase } from '../db/types';

interface CustomSession {
  stravaAthleteId?: string;
  isAdmin?: boolean;
}

export type Context = {
  req: Request;
  res: Response;
  db: RawDatabase;
  drizzleDb: AppDatabase;
  orm: AppDatabase;
  session: Session & Partial<CustomSession>;
  userId?: string;
  isAdmin: boolean;
};

export const createContext = async ({
  req,
  res,
  dbOverride, // Optional raw DB override for testing
  drizzleDbOverride, // Optional Drizzle db override for testing
  ormOverride, // Optional canonical orm override for testing
}: {
  req: Request;
  res: Response;
  dbOverride?: RawDatabase;
  drizzleDbOverride?: AppDatabase;
  ormOverride?: AppDatabase;
}): Promise<Context> => {
  const sess = req.session as unknown as CustomSession | undefined;
  const orm = ormOverride || drizzleDbOverride || drizzleDb;
  const userId = sess?.stravaAthleteId ? String(sess.stravaAthleteId) : undefined;
  const authorizationService = new AuthorizationService(orm, () => config.adminAthleteIds);

  return {
    req,
    res,
    db: dbOverride || db,
    drizzleDb: orm,
    orm,
    session: req.session as Session & Partial<CustomSession>,
    userId,
    isAdmin: await authorizationService.isAdmin(userId),
  };
};