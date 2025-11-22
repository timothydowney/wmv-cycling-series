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
    
    // Initialize schema (minimal schema needed for logger)
    db.exec(`
      CREATE TABLE webhook_event (
        id INTEGER PRIMARY KEY,
        subscription_id INTEGER,
        aspect_type TEXT,
        object_type TEXT,
        object_id INTEGER,
        owner_id INTEGER,
        processed INTEGER DEFAULT 0,
        processed_at TEXT,
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
    
    // Enable logging for tests
    process.env.WEBHOOK_LOG_EVENTS = 'true';
  });

  afterAll(() => {
    db.close();
  });

  describe('logEvent', () => {
    it('should insert webhook event when logging enabled', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const entry = {
        subscriptionId: 1,
        aspectType: 'delete',
        objectType: 'activity',
        objectId: 123456789,
        ownerId: 12345,
        processed: false,
        processedAt: null,
        errorMessage: null
      };

      // Act
      logger.logEvent(entry);

      // Assert
      const record = db.prepare('SELECT * FROM webhook_event WHERE object_id = ?').get(123456789);
      expect(record).toBeDefined();
      expect(record.aspect_type).toBe('delete');
      expect(record.object_type).toBe('activity');
      expect(record.processed).toBe(0);
    });

    it('should not insert webhook event when logging disabled', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'false';
      const entry = {
        subscriptionId: 1,
        aspectType: 'create',
        objectType: 'activity',
        objectId: 987654321,
        ownerId: 12345,
        processed: false,
        processedAt: null,
        errorMessage: null
      };

      // Act
      logger.logEvent(entry);

      // Assert
      const record = db.prepare('SELECT * FROM webhook_event WHERE object_id = ?').get(987654321);
      expect(record).toBeUndefined();
    });

    it('should insert with error message', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const entry = {
        subscriptionId: 1,
        aspectType: 'create',
        objectType: 'activity',
        objectId: 555555555,
        ownerId: 12345,
        processed: false,
        processedAt: null,
        errorMessage: 'Failed to fetch activity'
      };

      // Act
      logger.logEvent(entry);

      // Assert
      const record = db.prepare('SELECT * FROM webhook_event WHERE object_id = ?').get(555555555);
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
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const objectId = 222222222;
      const entry = {
        subscriptionId: 1,
        aspectType: 'delete',
        objectType: 'activity',
        objectId,
        ownerId: 12345,
        processed: false,
        processedAt: null,
        errorMessage: null
      };
      logger.logEvent(entry);

      // Verify initial state
      let record = db.prepare('SELECT processed FROM webhook_event WHERE object_id = ?').get(objectId);
      expect(record.processed).toBe(0);

      // Act
      const now = new Date().toISOString();
      logger.markProcessed(objectId, now);

      // Assert
      record = db.prepare('SELECT processed, processed_at FROM webhook_event WHERE object_id = ?').get(objectId);
      expect(record.processed).toBe(1);
      expect(record.processed_at).toBe(now);
    });

    it('should not update when logging disabled', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'false';
      const objectId = 333333333;

      // Act
      logger.markProcessed(objectId, new Date().toISOString());

      // Assert - should not throw, should do nothing
      const record = db.prepare('SELECT * FROM webhook_event WHERE object_id = ?').get(objectId);
      expect(record).toBeUndefined();
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const badLogger = new WebhookLogger(null);

      // Act & Assert - should not throw
      expect(() => badLogger.markProcessed(444444444, new Date().toISOString())).not.toThrow();
    });
  });

  describe('markFailed', () => {
    it('should update event with error message', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const objectId = 555555556;
      const entry = {
        subscriptionId: 1,
        aspectType: 'delete',
        objectType: 'activity',
        objectId,
        ownerId: 12345,
        processed: false,
        processedAt: null,
        errorMessage: null
      };
      logger.logEvent(entry);

      // Act
      const errorMsg = 'Activity not found in database';
      logger.markFailed(objectId, errorMsg);

      // Assert
      const record = db.prepare('SELECT error_message, processed_at FROM webhook_event WHERE object_id = ?').get(objectId);
      expect(record).toBeDefined();
      expect(record.error_message).toBe(errorMsg);
      expect(record.processed_at).toBeDefined();
    });

    it('should not update when logging disabled', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'false';
      const objectId = 666666666;

      // Act
      logger.markFailed(objectId, 'Some error');

      // Assert - should not throw, should do nothing
      const record = db.prepare('SELECT * FROM webhook_event WHERE object_id = ?').get(objectId);
      expect(record).toBeUndefined();
    });

    it('should handle database errors gracefully', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const badLogger = new WebhookLogger(null);

      // Act & Assert - should not throw
      expect(() => badLogger.markFailed(777777777, 'Error')).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return stats for empty database', () => {
      // Arrange
      process.env.WEBHOOK_LOG_EVENTS = 'true';

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
      process.env.WEBHOOK_LOG_EVENTS = 'true';

      // Insert several events
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO webhook_event 
        (subscription_id, aspect_type, object_type, object_id, owner_id, processed, processed_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'delete', 'activity', 1, 100, 1, now, null, now); // processed

      db.prepare(`
        INSERT INTO webhook_event 
        (subscription_id, aspect_type, object_type, object_id, owner_id, processed, processed_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'delete', 'activity', 2, 100, 0, null, 'Error: API timeout', now); // failed

      db.prepare(`
        INSERT INTO webhook_event 
        (subscription_id, aspect_type, object_type, object_id, owner_id, processed, processed_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'create', 'activity', 3, 100, 0, null, null, now); // pending

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
      process.env.WEBHOOK_LOG_EVENTS = 'true';
      const now = new Date().toISOString();

      // Event with error
      db.prepare(`
        INSERT INTO webhook_event 
        (subscription_id, aspect_type, object_type, object_id, owner_id, processed, processed_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'delete', 'activity', 1, 100, 0, null, 'Error: timeout', now);

      // Event pending (no error)
      db.prepare(`
        INSERT INTO webhook_event 
        (subscription_id, aspect_type, object_type, object_id, owner_id, processed, processed_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'delete', 'activity', 2, 100, 0, null, null, now);

      // Act
      const status = logger.getStatus();

      // Assert
      expect(status.totalEvents).toBe(2);
      expect(status.failedCount).toBe(1); // Only the one with error_message
      expect(status.processedCount).toBe(0); // None processed
    });
  });
});
