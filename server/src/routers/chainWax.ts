/**
 * Chain Wax tRPC Router
 *
 * Admin-only procedures for chain wax tracking:
 * - Get current status (distance, puck, color zone)
 * - Record a wax event
 * - Start a new puck
 * - Resync activities from Strava
 * - Get wax history
 */

import { router, adminProcedure } from '../trpc/init';
import { z } from 'zod';
import { ChainWaxService } from '../services/ChainWaxService';

export const chainWaxRouter = router({
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const service = new ChainWaxService(ctx.orm);
    return service.getCurrentStatus();
  }),

  waxChain: adminProcedure
    .input(z.object({ waxedAt: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ChainWaxService(ctx.orm);
      service.waxChain(input.waxedAt);
      return service.getCurrentStatus();
    }),

  newPuck: adminProcedure.mutation(async ({ ctx }) => {
    const service = new ChainWaxService(ctx.orm);
    service.newPuck();
    return service.getCurrentStatus();
  }),

  resync: adminProcedure.mutation(async ({ ctx }) => {
    const service = new ChainWaxService(ctx.orm);
    const result = await service.resync();
    const status = service.getCurrentStatus();
    return { ...status, resync: result };
  }),

  getHistory: adminProcedure.query(async ({ ctx }) => {
    const service = new ChainWaxService(ctx.orm);
    return service.getHistory();
  }),
});
