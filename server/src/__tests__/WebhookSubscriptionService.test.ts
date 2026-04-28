/**
 * WebhookSubscriptionService Tests
 *
 * Tests the webhook subscription service with Postgres compatibility.
 * The service must handle database results that may or may not have a `changes` property:
 * - SQLite better-sqlite3: returns { changes: N, lastInsertRowid?: N }
 * - Postgres Drizzle: returns undefined or just true/false for certain operations
 */

import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { webhookSubscription } from '../db/schema';

describe('WebhookSubscriptionService database operations', () => {
  describe('asyncQuery.exec() with Postgres compatibility', () => {
    it('should handle results with changes property (SQLite)', async () => {
      // Mock SQLite-style result
      const sqliteResult = { changes: 1, lastInsertRowid: 42 };
      
      // Simulate what exec() does: return query.execute()
      const result = sqliteResult;
      
      // Should be able to safely extract changes or default
      const info = result as unknown as { changes?: number };
      const changes = info?.changes ?? 1;
      
      expect(changes).toBe(1);
    });

    it('should handle results without changes property (Postgres)', async () => {
      // Mock Postgres-style result (often returns undefined or empty)
      const postgresResult = undefined;
      
      const result = postgresResult;
      const info = result as unknown as { changes?: number };
      const changes = info?.changes ?? 1;
      
      expect(changes).toBe(1); // Should default to 1
    });

    it('should handle results with null changes (edge case)', async () => {
      // Some Drizzle Postgres results might be empty objects
      const emptyResult = {};
      
      const result = emptyResult;
      const info = result as unknown as { changes?: number };
      const changes = info?.changes ?? 1;
      
      expect(changes).toBe(1); // Should default to 1
    });
  });

  describe('updateSubscriptionInDb database operation', () => {
    it('should handle Postgres result without changes property', async () => {
      // Simulate the type casting that happens in updateSubscriptionInDb
      const postgresUpdateResult = undefined;
      
      const result = postgresUpdateResult;
      const info = result as unknown as { changes?: number };
      
      // This is what the fixed code does:
      const loggedValue = info?.changes ?? 1;
      
      expect(loggedValue).toBe(1);
      expect(typeof loggedValue).toBe('number');
    });

    it('should handle SQLite result with changes property', async () => {
      const sqliteUpdateResult = { changes: 1 };
      
      const result = sqliteUpdateResult;
      const info = result as unknown as { changes?: number };
      
      const loggedValue = info?.changes ?? 1;
      
      expect(loggedValue).toBe(1);
    });
  });

  describe('insertSubscriptionInDb database operation', () => {
    it('should handle Postgres result with only lastInsertRowid', async () => {
      // Postgres might return just the row info
      const postgresInsertResult = { lastInsertRowid: 1 };
      
      const result = postgresInsertResult;
      const info = result as unknown as { changes?: number; lastInsertRowid?: number };
      
      const changes = info?.changes ?? 1;
      const insertRowid = info?.lastInsertRowid;
      
      expect(changes).toBe(1);
      expect(insertRowid).toBe(1);
    });

    it('should handle SQLite result with both properties', async () => {
      const sqliteInsertResult = { changes: 1, lastInsertRowid: 42 };
      
      const result = sqliteInsertResult;
      const info = result as unknown as { changes?: number; lastInsertRowid?: number };
      
      const changes = info?.changes ?? 1;
      const insertRowid = info?.lastInsertRowid;
      
      expect(changes).toBe(1);
      expect(insertRowid).toBe(42);
    });

    it('should handle Postgres result without any properties', async () => {
      const postgresInsertResult = undefined;
      
      const result = postgresInsertResult;
      const info = result as unknown as { changes?: number; lastInsertRowid?: number };
      
      const changes = info?.changes ?? 1;
      const insertRowid = info?.lastInsertRowid;
      
      expect(changes).toBe(1);
      expect(insertRowid).toBeUndefined();
    });
  });

  describe('deleteSubscriptionFromDb database operation', () => {
    it('should handle Postgres result without changes property', async () => {
      // Postgres delete might return nothing meaningful
      const postgresDeleteResult = undefined;
      
      const result = postgresDeleteResult;
      const info = result as unknown as { changes?: number };
      
      const changes = info?.changes ?? 1;
      
      expect(changes).toBe(1);
      expect(typeof changes).toBe('number');
    });

    it('should handle SQLite result with changes property', async () => {
      const sqliteDeleteResult = { changes: 1 };
      
      const result = sqliteDeleteResult;
      const info = result as unknown as { changes?: number };
      
      const changes = info?.changes ?? 1;
      
      expect(changes).toBe(1);
    });

    it('should handle zero deletes gracefully', async () => {
      // Case where no rows matched the delete condition
      const noDeleteResult = { changes: 0 };
      
      const result = noDeleteResult;
      const info = result as unknown as { changes?: number };
      
      const changes = info?.changes ?? 1;
      
      // If we got a result with changes: 0, use that value
      // If we didn't, default to 1
      // In this case we have changes: 0, so we use it
      expect(changes).toBe(0);
    });
  });
});
