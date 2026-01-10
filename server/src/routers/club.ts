import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import { TRPCError } from '@trpc/server';
import { clubService } from '../services/ClubService';
import { getValidAccessToken } from '../tokenManager';
import * as stravaClient from '../stravaClient';
import { config } from '../config';

export const clubRouter = router({
  checkMembership: publicProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      try {
        // Get the current user's athlete ID from session
        const athleteId = ctx.userId;

        if (!athleteId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Must be logged in to check club membership',
          });
        }

        // Get the current user's access token
        const accessToken = await getValidAccessToken(ctx.orm, stravaClient, athleteId);

        if (!accessToken) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not obtain access token for club membership check',
          });
        }

        // Check if the logged-in athlete is a member of the club
        const isMember = await clubService.isMemberOfClub(
          config.stravaClubId,
          accessToken
        );

        return { isMember };
      } catch (error: any) {
        // Graceful error handling - log but don't fail
        console.error('[Club Router] Error checking membership:', error);
        
        // Return false if we can't determine membership (conservative approach)
        return { isMember: false };
      }
    }),
});
