import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Admin middleware
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.isAdmin) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: ctx.session,
      userId: ctx.userId,
    },
  });
});

export const adminProcedure = publicProcedure.use(isAdmin);
