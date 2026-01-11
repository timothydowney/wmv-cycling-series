import { z } from 'zod';
import { adminProcedure, router } from '../init';
import { WebhookAdminService } from '../../services/WebhookAdminService';

export const webhookAdminRouter = router({
  getStatus: adminProcedure
    .query(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.getStatus();
    }),

  getStorageStatus: adminProcedure
    .query(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.getStorageStatus();
    }),

  getEvents: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(50),
      offset: z.number().int().min(0).default(0),
      since: z.number().int().default(Math.floor(Date.now() / 1000) - 604800), // 7 days ago
      status: z.enum(['all', 'success', 'failed']).default('all')
    }))
    .query(async ({ ctx, input }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.getEvents(input.limit, input.offset, input.since, input.status);
    }),

  enable: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.enable();
    }),

  disable: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.disable();
    }),

  renew: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.renew();
    }),

  retryEvent: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.retryEvent(input.id);
    }),

  getEnrichedEventDetails: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.getEnrichedEventDetails(input.id);
    }),

  replayEvent: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.replayEvent(input.id);
    }),

  clearEvents: adminProcedure
    .input(z.object({ confirm: z.literal('yes') }))
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const adminService = new WebhookAdminService(orm);
      return adminService.clearEvents();
    }),
});
