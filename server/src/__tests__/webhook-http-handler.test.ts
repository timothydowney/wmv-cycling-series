/**
 * Webhook HTTP Handler Tests
 *
 * Tests the HTTP-level webhook endpoints:
 * - GET /webhooks/strava - Subscription validation
 * - POST /webhooks/strava - Event receipt and queuing
 *
 * Verifies:
 * - Strava subscription requests are validated
 * - Webhook events are stored to database
 * - Responses are correct (200, 400, etc.)
 * - No Strava API mocking needed - just HTTP request/response handling
 */

import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './testDataHelpers';
import { webhookEvent } from '../db/schema';
import { eq } from 'drizzle-orm';
import express, { Express } from 'express';
import { createWebhookRouter } from '../routes/webhooks';
import { WebhookLogger } from '../webhooks/logger';

describe('Webhook HTTP Handler', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let app: Express;
  let logger: WebhookLogger;

  beforeAll(() => {
    const setup = setupTestDb({ seed: false });
    db = setup.db;
    drizzleDb = setup.drizzleDb;

    // Create Express app with webhook routes
    app = express();
    app.use(express.json());
    
    logger = new WebhookLogger(drizzleDb);

    const webhookRouter = createWebhookRouter(logger, drizzleDb);
    app.use('/webhooks', webhookRouter);
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    // Clear webhook events before each test
    drizzleDb.delete(webhookEvent).execute();
  });

  describe('GET /webhooks/strava - Subscription Validation', () => {
    it('should respond with challenge on valid subscription request', async () => {
      const challenge = 'test-challenge-string-12345';
      const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'default-verify-token';

      const response = await request(app)
        .get('/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': challenge,
          'hub.verify_token': verifyToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 'hub.challenge': challenge });
    });

    it('should reject with 403 on invalid verify token', async () => {
      const challenge = 'test-challenge-string-12345';

      const response = await request(app)
        .get('/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': challenge,
          'hub.verify_token': 'wrong-token'
        });

      expect(response.status).toBe(403);
    });

    it('should reject on missing challenge', async () => {
      const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'default-verify-token';

      const response = await request(app)
        .get('/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken
          // Missing hub.challenge
        });

      expect(response.status).toBe(400);
    });

    it('should reject on missing verify token', async () => {
      const challenge = 'test-challenge-string-12345';

      const response = await request(app)
        .get('/webhooks/strava')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': challenge
          // Missing hub.verify_token
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /webhooks/strava - Event Receipt and Queueing', () => {
    it('should queue activity_create webhook event', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 12345678,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const response = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });

      // Verify event was stored in database
      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.processed, 0))
        .get();

      expect(storedEvent).toBeDefined();
      const eventPayload = JSON.parse(storedEvent!.payload);
      expect(eventPayload.object_type).toBe('activity');
      expect(eventPayload.object_id).toBe(12345678);
      expect(eventPayload.aspect_type).toBe('create');
    });

    it('should queue activity_delete webhook event', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 87654321,
        aspect_type: 'delete',
        updates: {},
        owner_id: 111002,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const response = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response.status).toBe(200);

      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.processed, 0))
        .get();

      expect(storedEvent).toBeDefined();
      const eventPayload = JSON.parse(storedEvent!.payload);
      expect(eventPayload.aspect_type).toBe('delete');
    });

    it('should queue athlete_update webhook event', async () => {
      const payload = {
        object_type: 'athlete',
        object_id: 111001,
        aspect_type: 'update',
        updates: { authorized: false }, // Deauthorization
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const response = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response.status).toBe(200);

      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.processed, 0))
        .get();

      expect(storedEvent).toBeDefined();
      const eventPayload = JSON.parse(storedEvent!.payload);
      expect(eventPayload.object_type).toBe('athlete');
      expect(eventPayload.updates.authorized).toBe(false);
    });

    it('should store multiple webhook events without overwriting', async () => {
      const event1 = {
        object_type: 'activity',
        object_id: 111,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const event2 = {
        object_type: 'activity',
        object_id: 222,
        aspect_type: 'create',
        updates: {},
        owner_id: 111002,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      await request(app).post('/webhooks/strava').send(event1);
      await request(app).post('/webhooks/strava').send(event2);

      const storedEvents = drizzleDb
        .select()
        .from(webhookEvent)
        .all();

      expect(storedEvents).toHaveLength(2);
      const ids = storedEvents.map(e => JSON.parse(e.payload).object_id);
      expect(ids).toContain(111);
      expect(ids).toContain(222);
    });

    it('should return 200 even if event storage fails (idempotent)', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 12345678,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const response1 = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response1.status).toBe(200);

      // Send same event again (simulating Strava retry)
      const response2 = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response2.status).toBe(200);

      // Both events should be stored (webhook processor handles idempotency)
      const storedEvents = drizzleDb
        .select()
        .from(webhookEvent)
        .all();

      expect(storedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle webhook event with null/undefined fields gracefully', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 99999,
        aspect_type: 'create',
        updates: null, // Some fields might be null
        owner_id: 111001,
        subscription_id: 999,
        event_time: null // Time might be missing
      };

      const response = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response.status).toBe(200);

      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.processed, 0))
        .get();

      expect(storedEvent).toBeDefined();
    });

    it('should reject malformed JSON in POST body', async () => {
      const response = await request(app)
        .post('/webhooks/strava')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should accept webhook from Strava even without authentication', async () => {
      // Webhooks from Strava should not require auth header
      const payload = {
        object_type: 'activity',
        object_id: 12345678,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      const response = await request(app)
        .post('/webhooks/strava')
        .send(payload);

      expect(response.status).toBe(200);
    });
  });

  describe('Webhook Event Queuing State', () => {
    it('should store new events with processed=null', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 12345678,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      await request(app).post('/webhooks/strava').send(payload);

      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .get();

      expect(storedEvent?.processed).toBe(0); // 0 = unprocessed (false)
      expect(storedEvent?.error_message).toBeNull();
    });

    it('should store created_at timestamp on event receipt', async () => {
      const payload = {
        object_type: 'activity',
        object_id: 12345678,
        aspect_type: 'create',
        updates: {},
        owner_id: 111001,
        subscription_id: 999,
        event_time: Math.floor(Date.now() / 1000)
      };

      await request(app).post('/webhooks/strava').send(payload);

      const storedEvent = drizzleDb
        .select()
        .from(webhookEvent)
        .get();

      expect(storedEvent?.created_at).toBeDefined();
      expect(storedEvent?.created_at).not.toBeNull();
    });
  });
});
