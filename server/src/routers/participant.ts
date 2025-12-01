import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import ParticipantService from '../services/ParticipantService';
import { drizzleDb } from '../db';

const participantService = new ParticipantService(drizzleDb);

export const participantRouter = router({
  getAll: publicProcedure.query(async () => {
    return participantService.getAllParticipantsWithStatus();
  }),

  getAllWithStatus: publicProcedure.query(async () => {
    return participantService.getAllParticipantsWithStatus();
  }),

  getById: publicProcedure
    .input(z.number())
    .query(async ({ input }) => {
      return participantService.getParticipantByStravaAthleteId(input);
    }),
});
