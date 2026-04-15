import { router, publicProcedure } from '../trpc/init';
import { seasonRouter } from './season';
import { weekRouter } from './week';
import { segmentRouter } from './segment';
import { participantRouter } from './participant';
import { leaderboardRouter } from '../trpc/leaderboardRouter'; // Import the new leaderboardRouter
import { webhookAdminRouter } from '../trpc/routers/webhookAdminRouter'; // Import the new webhookAdminRouter
import { clubRouter } from './club';
import { profileRouter } from './profile';
import { chatRouter } from './chat';
import { chainWaxRouter } from './chainWax';
import { explorerRouter } from './explorer';
import { explorerAdminRouter } from './explorerAdmin';

export const appRouter = router({
  health: publicProcedure.query(() => 'ok'),
  season: seasonRouter,
  week: weekRouter,
  segment: segmentRouter,
  participant: participantRouter,
  leaderboard: leaderboardRouter, // Add the leaderboardRouter to the appRouter
  webhookAdmin: webhookAdminRouter, // Add the webhookAdminRouter
  club: clubRouter,
  profile: profileRouter,
  chat: chatRouter,
  chainWax: chainWaxRouter,
  explorer: explorerRouter,
  explorerAdmin: explorerAdminRouter,
});

export type AppRouter = typeof appRouter;
