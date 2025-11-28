import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import { TRPCError } from '@trpc/server';
import SeasonService from '../services/SeasonService';

// We instantiate the service here using the global DB instance
// In a more complex app, we might want dependency injection via Context
import { db } from '../index';

const seasonService = new SeasonService(db);

export const seasonRouter = router({
  getAll: publicProcedure.query(() => {
    return seasonService.getAllSeasons();
  }),

  getById: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      const season = seasonService.getSeasonById(input);
      if (!season) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Season not found',
        });
      }
      return season;
    }),
  
  // Example of admin mutation
  create: adminProcedure
    .input(z.object({
      name: z.string(),
      start_at: z.number(),
      end_at: z.number(),
      is_active: z.number().optional(),
    }))
    .mutation(({ input }) => {
      const { is_active, ...rest } = input;
      return seasonService.createSeason({
        ...rest,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined
      });
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string(),
        start_at: z.number(),
        end_at: z.number(),
        is_active: z.number().optional(),
      }).partial()
    }))
    .mutation(({ input }) => {
      const { is_active, ...rest } = input.data;
      return seasonService.updateSeason(input.id, {
        ...rest,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined
      });
    }),

  delete: adminProcedure
    .input(z.number())
    .mutation(({ input }) => {
      return seasonService.deleteSeason(input);
    }),
});