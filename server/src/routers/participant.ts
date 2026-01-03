import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import ParticipantService from '../services/ParticipantService';

export const participantRouter = router({
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
