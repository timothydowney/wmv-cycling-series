import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc/init';
import { ExplorerQueryService } from '../services/ExplorerQueryService';
import { explorerDestination, explorerDestinationPin } from '../db/schema';
import { getOne, exec } from '../db/asyncQuery';

export const explorerRouter = router({
  getActiveCampaign: publicProcedure.query(async ({ ctx }) => {
    const service = new ExplorerQueryService(ctx.orm);
    return await service.getActiveCampaign();
  }),

  getCampaignProgress: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const service = new ExplorerQueryService(ctx.orm);
      return await service.getCampaignProgress(input.campaignId, ctx.userId);
    }),

  pinDestination: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive(), destinationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const destination = await getOne<{ id: number }>(
        ctx.orm
          .select({ id: explorerDestination.id })
          .from(explorerDestination)
          .where(
            and(
              eq(explorerDestination.id, input.destinationId),
              eq(explorerDestination.explorer_campaign_id, input.campaignId)
            )
          )
      );

      if (!destination) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Destination not found for campaign' });
      }

      await exec(
        ctx.orm
          .insert(explorerDestinationPin)
          .values({
            explorer_campaign_id: input.campaignId,
            explorer_destination_id: input.destinationId,
            strava_athlete_id: ctx.userId,
          })
          .onConflictDoNothing()
      );

      return { success: true };
    }),

  unpinDestination: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive(), destinationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      await exec(
        ctx.orm
          .delete(explorerDestinationPin)
          .where(
            and(
              eq(explorerDestinationPin.explorer_campaign_id, input.campaignId),
              eq(explorerDestinationPin.explorer_destination_id, input.destinationId),
              eq(explorerDestinationPin.strava_athlete_id, ctx.userId)
            )
          )
      );

      return { success: true };
    }),
});