import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

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
