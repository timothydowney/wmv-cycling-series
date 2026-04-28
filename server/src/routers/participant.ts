import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
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

  getAdminCandidates: adminProcedure.query(async ({ ctx }) => {
    const participantService = new ParticipantService(ctx.orm);
    const participants = await participantService.getAllParticipantsWithStatus();
    const envAdminIds = new Set(config.adminAthleteIds);

    return participants.map(participant => {
      const isEnvAdmin = envAdminIds.has(participant.strava_athlete_id);
      const isDbAdmin = Boolean(participant.is_admin);

      return {
        ...participant,
        is_env_admin: isEnvAdmin,
        is_db_admin: isDbAdmin,
        effective_is_admin: isEnvAdmin || isDbAdmin,
      };
    });
  }),

  setAdminStatus: adminProcedure
    .input(z.object({
      stravaAthleteId: z.string(),
      isAdmin: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const participantService = new ParticipantService(ctx.orm);
      await participantService.setParticipantAdminStatus(input.stravaAthleteId, input.isAdmin);

      const updatedParticipant = await participantService.getParticipantByStravaAthleteId(input.stravaAthleteId);
      const isEnvAdmin = config.adminAthleteIds.includes(input.stravaAthleteId);

      return {
        strava_athlete_id: input.stravaAthleteId,
        is_db_admin: Boolean(updatedParticipant?.is_admin),
        is_env_admin: isEnvAdmin,
        effective_is_admin: Boolean(updatedParticipant?.is_admin) || isEnvAdmin,
      };
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const participantService = new ParticipantService(ctx.orm);
      return participantService.getParticipantByStravaAthleteId(input);
    }),
});
