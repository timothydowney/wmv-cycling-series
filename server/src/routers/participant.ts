import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import ParticipantService from '../services/ParticipantService';
import LoginService from '../services/LoginService';
import { config } from '../config';

export const participantRouter = router({
  getAuthStatus: publicProcedure.query(async ({ ctx }) => {
    const athleteId = ctx.userId;
    const loginService = new LoginService(ctx.orm, () => config.adminAthleteIds);
    return loginService.getAuthStatus(athleteId);
  }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const participantService = new ParticipantService(ctx.orm);
    return participantService.getAllParticipantsWithStatus();
  }),

  getAllWithStatus: publicProcedure.query(async ({ ctx }) => {
    const participantService = new ParticipantService(ctx.orm);
    return participantService.getAllParticipantsWithStatus();
  }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const participantService = new ParticipantService(ctx.orm);
      return participantService.getParticipantByStravaAthleteId(input);
    }),
});
