import { inferAsyncReturnType } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import { db } from '../index'; // Import the singleton DB instance

interface CustomSession {
  stravaAthleteId?: number;
  isAdmin?: boolean;
}

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
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

export type Context = inferAsyncReturnType<typeof createContext>;
