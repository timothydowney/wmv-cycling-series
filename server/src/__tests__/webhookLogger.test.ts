// @ts-nocheck
/**
 * Webhook Logger Tests
 *
 * Tests the WebhookLogger class with real database operations.
 * Uses in-memory SQLite for fast, isolated tests.
 */

import Database from 'better-sqlite3';
import { WebhookLogger } from '../webhooks/logger';

describe('Webhook Logger', () => {
  let db;
  let logger;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Initialize schema (match actual schema from server/src/schema.ts)
    db.exec(`
      CREATE TABLE webhook_event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        processed BOOLEAN DEFAULT 0,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  beforeEach(() => {
    // Create fresh logger instance for each test
    logger = new WebhookLogger(db);
    
    // Clear table
    db.prepare('DELETE FROM webhook_event').run();
  });

  afterAll(() => {
    db.close();
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
      const record = db.prepare('SELECT * FROM webhook_event WHERE payload LIKE ?').get('%123456789%');
      expect(record).toBeDefined();
      const parsedPayload = JSON.parse(record.payload);
      expect(parsedPayload.aspect_type).toBe('delete');
      expect(parsedPayload.object_type).toBe('activity');
      expect(record.processed).toBe(0);
    });

    it('should always insert webhook events (always enabled)', () => {
      // Arrange - webhook events are ALWAYS logged, no opt-out via env var
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
      const record = db.prepare('SELECT * FROM webhook_event WHERE payload LIKE ?').get('%987654321%');
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
      const record = db.prepare('SELECT * FROM webhook_event WHERE payload LIKE ?').get('%555555555%');
      expect(record).toBeDefined();
      expect(record.error_message).toBe('Failed to fetch activity');
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const badLogger = new WebhookLogger(null); // Invalid db
      const entry = {
        subscriptionId: 1,
        aspectType: 'delete',
        objectType: 'activity',
        objectId: 111111111,
        ownerId: 12345,
        processed: false,
        processedAt: null,
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
      let record = db.prepare('SELECT processed FROM webhook_event WHERE payload LIKE ?').get('%222222222%');
      expect(record.processed).toBe(0);

      // Act
      logger.markProcessed(payload);

      // Assert
      record = db.prepare('SELECT processed FROM webhook_event WHERE payload LIKE ?').get('%222222222%');
      expect(record.processed).toBe(1);
    });

    it('should update event status when called', () => {
      // Arrange - webhook events are ALWAYS logged, always updateable
      const payload = {
        object_id: 333333333,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      // First log an event
      const entry = { payload, processed: false, errorMessage: null };
      logger.logEvent(entry);

      // Act
      logger.markProcessed(payload);

      // Assert - should mark it as processed
      const record = db.prepare('SELECT processed FROM webhook_event WHERE payload LIKE ?').get('%333333333%');
      expect(record).toBeDefined();
      expect(record.processed).toBe(1);
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      const badLogger = new WebhookLogger(null);
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
      const record = db.prepare('SELECT error_message FROM webhook_event WHERE payload LIKE ?').get('%555555556%');
      expect(record).toBeDefined();
      expect(record.error_message).toBe(errorMsg);
    });

    it('should update failed when called', () => {
      // Arrange
      const payload = {
        object_id: 666666666,
        aspect_type: 'delete',
        object_type: 'activity',
        owner_id: 12345
      };

      // First log an event
      const entry = { payload, processed: false, errorMessage: null };
      logger.logEvent(entry);

      // Act
      logger.markFailed(payload, 'Some error');

      // Assert - should mark it as failed
      const record = db.prepare('SELECT error_message FROM webhook_event WHERE payload LIKE ?').get('%666666666%');
      expect(record).toBeDefined();
      expect(record.error_message).toBe('Some error');
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      const badLogger = new WebhookLogger(null);
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
      // Arrange
      // Insert several events
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO webhook_event 
        (payload, processed, error_message, created_at)
        VALUES (?, ?, ?, ?)
      `).run(JSON.stringify({ object_id: 1, aspect_type: 'delete' }), 1, null, now); // processed

      db.prepare(`
        INSERT INTO webhook_event 
        (payload, processed, error_message, created_at)
        VALUES (?, ?, ?, ?)
      `).run(JSON.stringify({ object_id: 2, aspect_type: 'delete' }), 0, 'Error: API timeout', now); // failed

      db.prepare(`
        INSERT INTO webhook_event 
        (payload, processed, error_message, created_at)
        VALUES (?, ?, ?, ?)
      `).run(JSON.stringify({ object_id: 3, aspect_type: 'create' }), 0, null, now); // pending

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
      const badLogger = new WebhookLogger(null);

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
      db.prepare(`
        INSERT INTO webhook_event 
        (payload, processed, error_message, created_at)
        VALUES (?, ?, ?, ?)
      `).run(JSON.stringify({ object_id: 1, aspect_type: 'delete' }), 0, 'Error: timeout', now);

      // Event pending (no error)
      db.prepare(`
        INSERT INTO webhook_event 
        (payload, processed, error_message, created_at)
        VALUES (?, ?, ?, ?)
      `).run(JSON.stringify({ object_id: 2, aspect_type: 'delete' }), 0, null, now);

      // Act
      const status = logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(2);
      expect(status.failedCount).toBe(1); // Only the one with error_message
      expect(status.processedCount).toBe(0); // None processed
    });
  });
});
