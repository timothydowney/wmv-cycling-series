import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import { SegmentService } from '../services/SegmentService';

export const segmentRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const segmentService = new SegmentService(ctx.drizzleDb);
    return segmentService.getAllSegments();
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string(),
      strava_segment_id: z.number(),
      distance: z.number().optional(),
      average_grade: z.number().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const segmentService = new SegmentService(ctx.drizzleDb);
      return segmentService.createSegment(input);
    }),

  validate: adminProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const segmentService = new SegmentService(ctx.drizzleDb);
      return segmentService.fetchAndStoreSegmentMetadata(input, 'trpc-validate', undefined, ctx.userId);
    }),
});
