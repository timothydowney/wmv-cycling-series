import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import { TRPCError } from '@trpc/server';
import SeasonService from '../services/SeasonService';
import { drizzleDb } from '../db';

const seasonService = new SeasonService(drizzleDb);

export const seasonRouter = router({
  getAll: publicProcedure.query(() => {
    return seasonService.getAllSeasons();
  }),

  getById: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      try {
        return seasonService.getSeasonById(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
    }),
  
  create: adminProcedure
    .input(z.object({
      name: z.string(),
      start_at: z.number(),
      end_at: z.number(),
      is_active: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      return seasonService.createSeason(input);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        start_at: z.number().optional(),
        end_at: z.number().optional(),
        is_active: z.boolean().optional(),
      }),
    }))
    .mutation(({ input }) => {
      return seasonService.updateSeason(input.id, input.data);
    }),

  delete: adminProcedure
    .input(z.number())
    .mutation(({ input }) => {
      try {
        return seasonService.deleteSeason(input);
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),
});
