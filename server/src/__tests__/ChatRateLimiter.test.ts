/**
 * ChatRateLimiter.test.ts
 *
 * Tests for the in-memory rate limiter used by AI Chat.
 */

import { ChatRateLimiter, resetChatRateLimiter, getChatRateLimiter } from '../services/ChatRateLimiter';

describe('ChatRateLimiter', () => {
  let limiter: ChatRateLimiter;

  beforeEach(() => {
    limiter = new ChatRateLimiter(3, 10); // 3/min, 10/day for testing
  });

  describe('check()', () => {
    it('should allow requests under the limit', () => {
      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block after per-minute limit is reached', () => {
      // Consume 3 requests
      limiter.consume('user1');
      limiter.consume('user1');
      limiter.consume('user1');

      const result = limiter.check('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should track users independently', () => {
      limiter.consume('user1');
      limiter.consume('user1');
      limiter.consume('user1');

      // user1 is blocked
      expect(limiter.check('user1').allowed).toBe(false);

      // user2 still has requests
      expect(limiter.check('user2').allowed).toBe(true);
    });

    it('should block after per-day limit is reached', () => {
      // Use a limiter with low daily limit
      const dayLimiter = new ChatRateLimiter(100, 2); // 100/min, 2/day
      dayLimiter.consume('user1');
      dayLimiter.consume('user1');

      const result = dayLimiter.check('user1');
      expect(result.allowed).toBe(false);
    });
  });

  describe('consume()', () => {
    it('should increment usage counts', () => {
      const before = limiter.getUsage('user1');
      expect(before.minuteCount).toBe(0);
      expect(before.dayCount).toBe(0);

      limiter.consume('user1');

      const after = limiter.getUsage('user1');
      expect(after.minuteCount).toBe(1);
      expect(after.dayCount).toBe(1);
    });
  });

  describe('getUsage()', () => {
    it('should return zero counts for unknown users', () => {
      const usage = limiter.getUsage('unknown');
      expect(usage.minuteCount).toBe(0);
      expect(usage.dayCount).toBe(0);
      expect(usage.perMinuteLimit).toBe(3);
      expect(usage.perDayLimit).toBe(10);
    });

    it('should track cumulative usage', () => {
      limiter.consume('user1');
      limiter.consume('user1');

      const usage = limiter.getUsage('user1');
      expect(usage.minuteCount).toBe(2);
      expect(usage.dayCount).toBe(2);
    });
  });

  describe('clear()', () => {
    it('should reset all rate limit data', () => {
      limiter.consume('user1');
      limiter.consume('user2');
      expect(limiter.getUsage('user1').minuteCount).toBe(1);

      limiter.clear();

      expect(limiter.getUsage('user1').minuteCount).toBe(0);
      expect(limiter.getUsage('user2').minuteCount).toBe(0);
    });
  });
});

describe('getChatRateLimiter (singleton)', () => {
  beforeEach(() => {
    resetChatRateLimiter();
  });

  it('should return the same instance on multiple calls', () => {
    const a = getChatRateLimiter();
    const b = getChatRateLimiter();
    expect(a).toBe(b);
  });

  it('should create a fresh instance after reset', () => {
    const a = getChatRateLimiter();
    a.consume('test');
    expect(a.getUsage('test').minuteCount).toBe(1);

    resetChatRateLimiter();
    const b = getChatRateLimiter();
    expect(b.getUsage('test').minuteCount).toBe(0);
  });
});
