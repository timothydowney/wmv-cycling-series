import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, adminProcedure } from '../trpc/init';
import { ExplorerAdminService } from '../services/ExplorerAdminService';

function mapExplorerAdminError(error: unknown): TRPCError {
  const message = error instanceof Error ? error.message : 'Explorer admin operation failed';

  if (message.includes('already exists')) {
    return new TRPCError({ code: 'CONFLICT', message });
  }

  if (message.includes('not found') || message.includes('valid Strava segment URL')) {
    return new TRPCError({ code: 'BAD_REQUEST', message });
  }

  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}

export const explorerAdminRouter = router({
  createCampaign: adminProcedure
    .input(z.object({
      seasonId: z.number().int().positive(),
      displayName: z.string().trim().max(255).nullable().optional(),
      rulesBlurb: z.string().trim().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ExplorerAdminService(ctx.orm);

      try {
        return service.createCampaign(input);
      } catch (error) {
        throw mapExplorerAdminError(error);
      }
    }),

  addDestination: adminProcedure
    .input(z.object({
      explorerCampaignId: z.number().int().positive(),
      sourceUrl: z.string().trim().min(1),
      displayLabel: z.string().trim().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ExplorerAdminService(ctx.orm);

      try {
        return await service.addDestination({
          ...input,
          preferredAthleteId: ctx.userId,
        });
      } catch (error) {
        throw mapExplorerAdminError(error);
      }
    }),
});