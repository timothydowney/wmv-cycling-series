import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import WeekService from '../services/WeekService';

export const weekRouter = router({
  getAll: publicProcedure
    .input(z.object({ seasonId: z.number(), includeParticipantCount: z.boolean().optional().default(false) }))
    .query(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      // Use full version with participant count if requested, otherwise lightweight summary for speed
      if (input.includeParticipantCount) {
        return weekService.getAllWeeks(input.seasonId);
      }
      return weekService.getAllWeeksSummary(input.seasonId);
    }),

  getById: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      return weekService.getWeekById(input);
    }),

  getLeaderboard: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      return weekService.getWeekLeaderboard(input);
    }),

  create: adminProcedure
    .input(z.object({
      season_id: z.number().optional(),
      week_name: z.string(),
      segment_id: z.string(),
      segment_name: z.string().optional(),
      required_laps: z.number(),
      start_at: z.number().optional(),
      end_at: z.number().optional(),
      multiplier: z.number().int().min(1).default(1).optional(), // NEW: Scoring multiplier
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      return weekService.createWeek(input);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        season_id: z.number().optional(),
        week_name: z.string().optional(),
        date: z.string().optional(),
        segment_id: z.string().optional(),
        required_laps: z.number().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        start_at: z.number().optional(),
        end_at: z.number().optional(),
        multiplier: z.number().int().min(1).optional(), // NEW: Scoring multiplier
        segment_name: z.string().optional(),
        notes: z.string().optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      return weekService.updateWeek(input.id, input.data);
    }),

  delete: adminProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const weekService = new WeekService(ctx.orm);
      return weekService.deleteWeek(input);
    })
});
