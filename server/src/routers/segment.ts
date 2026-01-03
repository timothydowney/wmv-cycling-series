import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import { SegmentService } from '../services/SegmentService';

export const segmentRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const segmentService = new SegmentService(ctx.orm);
    return segmentService.getAllSegments();
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string(),
      strava_segment_id: z.string(),
      distance: z.number().optional(),
      average_grade: z.number().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const segmentService = new SegmentService(ctx.orm);
      return segmentService.createSegment(input);
    }),

  validate: adminProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const segmentService = new SegmentService(ctx.orm);
      return segmentService.fetchAndStoreSegmentMetadata(input, 'trpc-validate', undefined, ctx.userId);
    }),
});
