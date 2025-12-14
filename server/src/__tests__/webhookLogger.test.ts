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
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

describe('Webhook Logger', () => {
  let drizzleDb: BetterSQLite3Database;
  let logger: WebhookLogger;

  beforeEach(() => {
    const { drizzleDb: testDb } = setupTestDb({ seed: false });
    drizzleDb = testDb;
    logger = new WebhookLogger(drizzleDb);
  });

  describe('logEvent', () => {
    it('should insert webhook event', () => {
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
      logger.logEvent(entry);

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
      const parsedPayload = JSON.parse(record!.payload);
      expect(parsedPayload.aspect_type).toBe('delete');
      expect(parsedPayload.object_type).toBe('activity');
      expect(record!.processed).toBe(0);
    });

    it('should always insert webhook events (always enabled)', () => {
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
      logger.logEvent(entry);

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
    });

    it('should insert with error message', () => {
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
      logger.logEvent(entry);

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
      expect(record!.error_message).toBe('Failed to fetch activity');
    });

    it('should handle database errors gracefully', () => {
      // Arrange - null db should be handled gracefully
      const badLogger = new WebhookLogger(null as any);
      const entry = {
        payload: { object_id: 111111111 },
        processed: false,
        errorMessage: null
      };

      // Act & Assert - should not throw
      expect(() => badLogger.logEvent(entry)).not.toThrow();
    });
  });

  describe('markProcessed', () => {
    it('should update event status to processed', () => {
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
      logger.logEvent(entry);

      // Verify initial state
      let record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();
      expect(record!.processed).toBe(0);

      // Act
      logger.markProcessed(payload);

      // Assert
      record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();
      expect(record!.processed).toBe(1);
    });

    it('should update event status when called', () => {
      // Arrange
      const payload = {
        object_id: 333333333,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      const entry = { payload, processed: false, errorMessage: null };
      logger.logEvent(entry);

      // Act
      logger.markProcessed(payload);

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
      expect(record!.processed).toBe(1);
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);
      const payload = { object_id: 111111111 };

      // Act & Assert - should not throw
      expect(() => badLogger.markProcessed(payload)).not.toThrow();
    });
  });

  describe('markFailed', () => {
    it('should update event with error message', () => {
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
      logger.logEvent(entry);

      // Act
      const errorMsg = 'Activity not found in database';
      logger.markFailed(payload, errorMsg);

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
      expect(record!.error_message).toBe(errorMsg);
    });

    it('should update failed when called', () => {
      // Arrange
      const payload = {
        object_id: 666666666,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      const entry = { payload, processed: false, errorMessage: null };
      logger.logEvent(entry);

      // Act
      logger.markFailed(payload, 'Some error');

      // Assert
      const record = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.payload, JSON.stringify(payload)))
        .get();

      expect(record).toBeDefined();
      expect(record!.error_message).toBe('Some error');
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);
      const payload = { object_id: 444444444 };

      // Act & Assert - should not throw
      expect(() => badLogger.markFailed(payload, 'Error')).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return stats for empty database', () => {
      // Arrange

      // Act
      const status = logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(0);
      expect(status.processedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.lastEventTime).toBeNull();
    });

    it('should calculate correct stats with mixed events', () => {
      // Arrange - Insert several events
      const now = new Date().toISOString();

      // Processed event
      drizzleDb.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 1, aspect_type: 'delete' }),
        processed: 1,
        error_message: null,
        created_at: now
      }).execute();

      // Failed event
      drizzleDb.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 2, aspect_type: 'delete' }),
        processed: 0,
        error_message: 'Error: API timeout',
        created_at: now
      }).execute();

      // Pending event
      drizzleDb.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 3, aspect_type: 'create' }),
        processed: 0,
        error_message: null,
        created_at: now
      }).execute();

      // Act
      const status = logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(3);
      expect(status.processedCount).toBe(1);
      expect(status.failedCount).toBe(1);
      expect(status.lastEventTime).toBe(now);
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      const badLogger = new WebhookLogger(null as any);

      // Act
      const status = badLogger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(0);
      expect(status.processedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.lastEventTime).toBeNull();
    });

    it('should count only error_message field as failed, not processed=0', () => {
      // Arrange
      const now = new Date().toISOString();

      // Event with error
      drizzleDb.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 1, aspect_type: 'delete' }),
        processed: 0,
        error_message: 'Error: timeout',
        created_at: now
      }).execute();

      // Event pending (no error)
      drizzleDb.insert(webhookEvent).values({
        payload: JSON.stringify({ object_id: 2, aspect_type: 'delete' }),
        processed: 0,
        error_message: null,
        created_at: now
      }).execute();

      // Act
      const status = logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(2);
      expect(status.failedCount).toBe(1); // Only the one with error_message
      expect(status.processedCount).toBe(0); // None processed
    });
  });
});
