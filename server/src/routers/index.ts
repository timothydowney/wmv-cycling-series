import { router, publicProcedure } from '../trpc/init';
import { seasonRouter } from './season';
import { weekRouter } from './week';
import { segmentRouter } from './segment';
import { participantRouter } from './participant';
import { leaderboardRouter } from '../trpc/leaderboardRouter'; // Import the new leaderboardRouter
import { webhookAdminRouter } from '../trpc/routers/webhookAdminRouter'; // Import the new webhookAdminRouter

export const appRouter = router({
  health: publicProcedure.query(() => 'ok'),
  season: seasonRouter,
  week: weekRouter,
  segment: segmentRouter,
  participant: participantRouter,
  leaderboard: leaderboardRouter, // Add the leaderboardRouter to the appRouter
  webhookAdmin: webhookAdminRouter, // Add the webhookAdminRouter
});

export type AppRouter = typeof appRouter;
