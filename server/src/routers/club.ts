import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import { ClubService } from '../services/ClubService';
import { config } from '../config';

export const clubRouter = router({
  checkMembership: publicProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      // Get the current user's athlete ID from session
      const athleteId = ctx.userId;

      if (!athleteId) {
        return { isMember: false, error: 'Not authenticated' };
      }

      try {
        const clubService = new ClubService(ctx.orm);
        const isMember = await clubService.checkMember(athleteId, config.stravaClubId);
        return { isMember };
      } catch (err: any) {
        console.error('[ClubRouter] Error checking membership:', err);
        return { isMember: false, error: err.message };
      }
    }),
});
