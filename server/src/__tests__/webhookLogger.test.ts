import type { AppDatabase } from '../db/types';
/**
 * Webhook Logger Tests
 *
 * Tests the WebhookLogger class with Drizzle ORM.
 * Uses in-memory SQLite for fast, isolated tests.
 */

import { WebhookLogger } from '../webhooks/logger';
import { setupTestDb } from './setupTestDb';
import { webhookEvent } from '../db/schema';
import { eq } from 'drizzle-orm';

async function firstRow<T>(query: any): Promise<T | undefined> {
  const rows = await query.limit(1).execute();
  return rows[0] as T | undefined;
}

describe('Webhook Logger', () => {
  let orm: AppDatabase;
  let logger: WebhookLogger;

  beforeEach(async () => {
    const { orm: testDb } = setupTestDb({ seed: false });
    orm = testDb;
    logger = new WebhookLogger(orm);
  });

  describe('logEvent', () => {
    it('should insert webhook event', async () => {
      // Arrange
      const payload = {
        object_id: 123456789,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };
      const entry = {
        payload,
        processed: false,
        errorMessage: null
      };

      // Act
      await logger.logEvent(entry);

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
      const parsedPayload = JSON.parse(record!.payload);
      expect(parsedPayload.aspect_type).toBe('delete');
      expect(parsedPayload.object_type).toBe('activity');
      expect(record!.processed).toBe(0);
    });

    it('should always insert webhook events (always enabled)', async () => {
      // Arrange
      const payload = {
        object_id: 987654321,
        aspect_type: 'create',
        object_type: 'activity',
        owner_id: 12345
      };
      const entry = {
        payload,
        processed: false,
        errorMessage: null
      };

      // Act
      await logger.logEvent(entry);

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
    });

    it('should insert with error message', async () => {
      // Arrange
      const payload = {
        object_id: 555555555,
        aspect_type: 'create',
        object_type: 'activity',
        owner_id: 12345
      };
      const entry = {
        payload,
        processed: false,
        errorMessage: 'Failed to fetch activity'
      };

      // Act
      await logger.logEvent(entry);

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
      expect(record!.error_message).toBe('Failed to fetch activity');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange - null db should be handled gracefully
      const badLogger = new WebhookLogger(null as any);
      const entry = {
        payload: { object_id: 111111111 },
        processed: false,
        errorMessage: null
      };

      // Act & Assert - should not throw
      await expect(badLogger.logEvent(entry)).resolves.toBeUndefined();
    });
  });

  describe('markProcessed', () => {
    it('should update event status to processed', async () => {
      // Arrange
      const payload = {
        object_id: 222222222,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };
      const entry = {
        payload,
        processed: false,
        errorMessage: null
      };
      await logger.logEvent(entry);

      // Verify initial state
      let record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );
      expect(record!.processed).toBe(0);

      // Act
      await logger.markProcessed(payload);

      // Assert
      record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );
      expect(record!.processed).toBe(1);
    });

    it('should update event status when called', async () => {
      // Arrange
      const payload = {
        object_id: 333333333,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      const entry = { payload, processed: false, errorMessage: null };
      await logger.logEvent(entry);

      // Act
      await logger.markProcessed(payload);

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
      expect(record!.processed).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);
      const payload = { object_id: 111111111 };

      // Act & Assert - should not throw
      await expect(badLogger.markProcessed(payload)).resolves.toBeUndefined();
    });
  });

  describe('markFailed', () => {
    it('should update event with error message', async () => {
      // Arrange
      const payload = {
        object_id: 555555556,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };
      const entry = {
        payload,
        processed: false,
        errorMessage: null
      };
      await logger.logEvent(entry);

      // Act
      const errorMsg = 'Activity not found in database';
      await logger.markFailed(payload, errorMsg);

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
      expect(record!.error_message).toBe(errorMsg);
    });

    it('should update failed when called', async () => {
      // Arrange
      const payload = {
        object_id: 666666666,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      const entry = { payload, processed: false, errorMessage: null };
      await logger.logEvent(entry);

      // Act
      await logger.markFailed(payload, 'Some error');

      // Assert
      const record = await firstRow<any>(
        orm
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.payload, JSON.stringify(payload)))
      );

      expect(record).toBeDefined();
      expect(record!.error_message).toBe('Some error');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);
      const payload = { object_id: 444444444 };

      // Act & Assert - should not throw
      await expect(badLogger.markFailed(payload, 'Error')).resolves.toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return stats for empty database', async () => {
      // Arrange

      // Act
      const status = await logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(0);
      expect(status.processedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.lastEventTime).toBeNull();
    });

    it('should calculate correct stats with mixed events', async () => {
      // Arrange - Insert several events
      const now = new Date().toISOString();

      // Processed event
      await orm.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 1, aspect_type: 'delete' }),
        processed: 1,
        error_message: null,
        created_at: now
      }).execute();

      // Failed event
      await orm.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 2, aspect_type: 'delete' }),
        processed: 0,
        error_message: 'Error: API timeout',
        created_at: now
      }).execute();

      // Pending event
      await orm.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 3, aspect_type: 'create' }),
        processed: 0,
        error_message: null,
        created_at: now
      }).execute();

      // Act
      const status = await logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(3);
      expect(status.processedCount).toBe(1);
      expect(status.failedCount).toBe(1);
      expect(status.lastEventTime).toBe(now);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);

      // Act
      const status = await badLogger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(0);
      expect(status.processedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.lastEventTime).toBeNull();
    });

    it('should count only error_message field as failed, not processed=0', async () => {
      // Arrange
      const now = new Date().toISOString();

      // Event with error
      await orm.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 1, aspect_type: 'delete' }),
        processed: 0,
        error_message: 'Error: timeout',
        created_at: now
      }).execute();

      // Event pending (no error)
      await orm.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 2, aspect_type: 'delete' }),
        processed: 0,
        error_message: null,
        created_at: now
      }).execute();

      // Act
      const status = await logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(2);
      expect(status.failedCount).toBe(1); // Only the one with error_message
      expect(status.processedCount).toBe(0); // None processed
    });
  });
});
