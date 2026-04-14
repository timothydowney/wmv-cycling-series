import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init';
import { ExplorerQueryService } from '../services/ExplorerQueryService';

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
});