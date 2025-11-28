import { router } from '../trpc/init';
import { seasonRouter } from './season';

export const appRouter = router({
  season: seasonRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
