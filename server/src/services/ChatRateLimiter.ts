/**
 * ChatRateLimiter.ts
 *
 * In-memory rate limiter for AI chat requests.
 * Tracks per-user usage with sliding window for minute limits
 * and fixed window for daily limits.
 */

interface BucketEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remaining?: number;
  limit?: number;
}

export class ChatRateLimiter {
  private minuteBuckets: Map<string, BucketEntry> = new Map();
  private dayBuckets: Map<string, BucketEntry> = new Map();

  constructor(
    private perMinuteLimit: number = 10,
    private perDayLimit: number = 200
  ) {}

  /**
   * Check if a user is allowed to make a chat request.
   * Does NOT consume a request — call consume() after successful processing.
   */
  check(userId: string): RateLimitResult {
    const now = Date.now();

    // Check minute bucket
    const minuteKey = `min:${userId}`;
    const minuteBucket = this.minuteBuckets.get(minuteKey);
    if (minuteBucket) {
      if (now < minuteBucket.resetAt) {
        if (minuteBucket.count >= this.perMinuteLimit) {
          return {
            allowed: false,
            retryAfterMs: minuteBucket.resetAt - now,
            remaining: 0,
            limit: this.perMinuteLimit,
          };
        }
      } else {
        // Window expired, reset
        this.minuteBuckets.delete(minuteKey);
      }
    }

    // Check day bucket
    const dayKey = `day:${userId}`;
    const dayBucket = this.dayBuckets.get(dayKey);
    if (dayBucket) {
      if (now < dayBucket.resetAt) {
        if (dayBucket.count >= this.perDayLimit) {
          return {
            allowed: false,
            retryAfterMs: dayBucket.resetAt - now,
            remaining: 0,
            limit: this.perDayLimit,
          };
        }
      } else {
        // Day window expired, reset
        this.dayBuckets.delete(dayKey);
      }
    }

    const minuteRemaining = this.perMinuteLimit - (minuteBucket?.count ?? 0);
    const dayRemaining = this.perDayLimit - (dayBucket?.count ?? 0);

    return {
      allowed: true,
      remaining: Math.min(minuteRemaining, dayRemaining),
    };
  }

  /**
   * Consume a request for a user. Call after successful processing.
   */
  consume(userId: string): void {
    const now = Date.now();

    // Minute bucket
    const minuteKey = `min:${userId}`;
    const minuteBucket = this.minuteBuckets.get(minuteKey);
    if (minuteBucket && now < minuteBucket.resetAt) {
      minuteBucket.count++;
    } else {
      this.minuteBuckets.set(minuteKey, {
        count: 1,
        resetAt: now + 60_000, // 1 minute
      });
    }

    // Day bucket
    const dayKey = `day:${userId}`;
    const dayBucket = this.dayBuckets.get(dayKey);
    if (dayBucket && now < dayBucket.resetAt) {
      dayBucket.count++;
    } else {
      this.dayBuckets.set(dayKey, {
        count: 1,
        resetAt: now + 86_400_000, // 24 hours
      });
    }
  }

  /**
   * Get current usage stats for a user (for display in UI)
   */
  getUsage(userId: string): { minuteCount: number; dayCount: number; perMinuteLimit: number; perDayLimit: number } {
    const now = Date.now();

    const minuteKey = `min:${userId}`;
    const minuteBucket = this.minuteBuckets.get(minuteKey);
    const minuteCount = (minuteBucket && now < minuteBucket.resetAt) ? minuteBucket.count : 0;

    const dayKey = `day:${userId}`;
    const dayBucket = this.dayBuckets.get(dayKey);
    const dayCount = (dayBucket && now < dayBucket.resetAt) ? dayBucket.count : 0;

    return {
      minuteCount,
      dayCount,
      perMinuteLimit: this.perMinuteLimit,
      perDayLimit: this.perDayLimit,
    };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.minuteBuckets.clear();
    this.dayBuckets.clear();
  }
}

// Singleton instance shared across requests
let _instance: ChatRateLimiter | null = null;

export function getChatRateLimiter(perMinute?: number, perDay?: number): ChatRateLimiter {
  if (!_instance) {
    _instance = new ChatRateLimiter(perMinute, perDay);
  }
  return _instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetChatRateLimiter(): void {
  _instance = null;
}
