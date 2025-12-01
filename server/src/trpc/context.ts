import { db } from '../db';
import { Request, Response } from 'express';


interface CustomSession {
  stravaAthleteId?: number;
  isAdmin?: boolean;
}

export type Context = {
  req: Request;
  res: Response;
  db: any;
  session: any;
  userId?: number;
  isAdmin: boolean;
};

export const createContext = ({
  req,
  res,
  db: dbOverride,
}: { req: Request; res: Response; db?: any }): Context => {
  const sess = req.session as unknown as CustomSession | undefined;
  return {
    req,
    res,
    db: dbOverride || db, // Use injected db or default
    session: req.session,
    userId: sess?.stravaAthleteId,
    isAdmin: sess?.isAdmin || false,
  };
};
