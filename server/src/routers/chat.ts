/**
 * chatRouter.ts
 *
 * tRPC router for AI Chat functionality.
 * Admin-only: requires authenticated admin session.
 */

import { z } from 'zod';
import { router, adminProcedure } from '../trpc/init';
import { ChatService, type ChatMessage } from '../services/ChatService';
import { getChatRateLimiter } from '../services/ChatRateLimiter';
import { config } from '../config';
import { TRPCError } from '@trpc/server';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const chatRouter = router({
  /**
   * Send a chat message and get an AI response.
   */
  sendMessage: adminProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      history: z.array(chatMessageSchema).max(50).default([]),
    }))
    .mutation(async ({ ctx, input }) => {

      if (!config.chatEnabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'AI Chat is currently disabled',
        });
      }

      if (!config.geminiApiKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI Chat is not configured (missing API key)',
        });
      }

      const chatService = new ChatService(ctx.drizzleDb);
      const userId = ctx.userId!;

      const response = await chatService.chat(
        userId,
        input.message,
        input.history as ChatMessage[]
      );

      return response;
    }),

  /**
   * Get the current rate limit status for the authenticated user.
   */
  getRateLimitStatus: adminProcedure
    .query(({ ctx }) => {
      const rateLimiter = getChatRateLimiter();
      const userId = ctx.userId!;
      return rateLimiter.getUsage(userId);
    }),

  /**
   * Check if chat is enabled and configured.
   */
  getStatus: adminProcedure
    .query(() => {
      return {
        enabled: config.chatEnabled,
        configured: !!config.geminiApiKey,
      };
    }),
});
