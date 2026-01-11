import { router, publicProcedure } from '../trpc/init';
import { z } from 'zod';
import { ProfileService } from '../services/ProfileService';

export const profileRouter = router({
  getMyProfile: publicProcedure
    .input(z.object({ athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orm: drizzleDb } = ctx;
      const profileService = new ProfileService(drizzleDb);
      return await profileService.getAthleteProfile(input.athleteId);
    }),
});
