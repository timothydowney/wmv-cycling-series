import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc/init';
import { SegmentService } from '../services/SegmentService';
import { drizzleDb } from '../db';

const segmentService = new SegmentService(drizzleDb);

export const segmentRouter = router({
  getAll: publicProcedure.query(async () => {
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
    .mutation(async ({ input }) => {
      return segmentService.createSegment(input);
    }),

  validate: adminProcedure
    .input(z.number())
    .query(async ({ input }) => {
      return segmentService.fetchAndStoreSegmentMetadata(input, 'trpc-validate');
    }),
});
