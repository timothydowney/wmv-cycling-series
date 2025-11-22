/**
 * Webhook Subscription Manager Tests
 *
 * Tests the subscription manager using the service layer pattern:
 * - Mock SubscriptionService for HTTP calls
 * - Test all flows: create, check, delete, setup
 * - Test error handling and graceful degradation
 */

import { setupWebhookSubscription, createDefaultService, SubscriptionService } from '../webhooks/subscriptionManager';

describe('Webhook Subscription Manager', () => {
  // ============================================================================
  // Tests for createDefaultService()
  // ============================================================================

  describe('createDefaultService()', () => {
    it('should return a service with all three methods', () => {
      const service = createDefaultService();
      expect(typeof service.createSubscription).toBe('function');
      expect(typeof service.getExistingSubscription).toBe('function');
      expect(typeof service.deleteSubscription).toBe('function');
    });
  });

  // ============================================================================
  // Tests for setupWebhookSubscription()
  // ============================================================================

  describe('setupWebhookSubscription()', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let consoleSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };
      // Suppress console output during tests
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
      // Restore console
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    // ========== Feature Flag Checks ==========

    it('should skip setup if WEBHOOK_ENABLED is not "true"', async () => {
      process.env.WEBHOOK_ENABLED = 'false';
      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
      expect(mockService.createSubscription).not.toHaveBeenCalled();
    });

    it('should skip setup if WEBHOOK_ENABLED is undefined', async () => {
      delete process.env.WEBHOOK_ENABLED;
      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
    });

    // ========== Configuration Checks ==========

    it('should warn if WEBHOOK_CALLBACK_URL is missing', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      delete process.env.WEBHOOK_CALLBACK_URL;
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WEBHOOK_CALLBACK_URL is not set')
      );
      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
    });

    it('should warn if WEBHOOK_VERIFY_TOKEN is missing', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      delete process.env.WEBHOOK_VERIFY_TOKEN;
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WEBHOOK_VERIFY_TOKEN is not set')
      );
      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
    });

    it('should warn if STRAVA_CLIENT_ID is missing', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      delete process.env.STRAVA_CLIENT_ID;
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Strava credentials')
      );
      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
    });

    it('should warn if STRAVA_CLIENT_SECRET is missing', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      delete process.env.STRAVA_CLIENT_SECRET;

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Strava credentials')
      );
      expect(mockService.getExistingSubscription).not.toHaveBeenCalled();
    });

    // ========== Happy Path: Subscription Already Exists ==========

    it('should check for existing subscription when enabled and configured', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn().mockResolvedValue({
          id: 123,
          created_at: '2025-11-22T00:00:00Z',
          updated_at: '2025-11-22T00:00:00Z',
          callback_url: 'https://example.com/webhooks',
          resource_state: 2
        }),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(mockService.getExistingSubscription).toHaveBeenCalledWith('test-id', 'test-secret');
      expect(mockService.createSubscription).not.toHaveBeenCalled();
    });

    it('should use existing subscription if it exists', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn().mockResolvedValue({
          id: 456,
          created_at: '2025-11-20T00:00:00Z',
          updated_at: '2025-11-22T00:00:00Z',
          callback_url: 'https://example.com/webhooks',
          resource_state: 2
        }),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      // Check that we logged about using existing subscription
      const logCalls = (consoleSpy.mock.calls as any[])
        .map((call: any) => call[0])
        .join('\n');
      expect(logCalls).toContain('Already subscribed');
      expect(mockService.createSubscription).not.toHaveBeenCalled();
    });

    // ========== Happy Path: Create New Subscription ==========

    it('should create subscription if none exists', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn().mockResolvedValue({
          id: 789,
          created_at: '2025-11-22T10:30:00Z',
          updated_at: '2025-11-22T10:30:00Z',
          callback_url: 'https://example.com/webhooks',
          resource_state: 2
        }),
        getExistingSubscription: jest.fn().mockResolvedValue(null),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      expect(mockService.getExistingSubscription).toHaveBeenCalledWith('test-id', 'test-secret');
      expect(mockService.createSubscription).toHaveBeenCalledWith(
        'https://example.com/webhooks',
        'test-token',
        'test-id',
        'test-secret'
      );
    });

    it('should log success when subscription created', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn().mockResolvedValue({
          id: 999,
          created_at: '2025-11-22T10:30:00Z',
          updated_at: '2025-11-22T10:30:00Z',
          callback_url: 'https://example.com/webhooks',
          resource_state: 2
        }),
        getExistingSubscription: jest.fn().mockResolvedValue(null),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      const logCalls = (consoleSpy.mock.calls as any[])
        .map((call: any) => call[0])
        .join('\n');
      expect(logCalls).toContain('Subscription ready');
      expect(logCalls).toContain('https://example.com/webhooks');
    });

    // ========== Error Handling ==========

    it('should handle error from getExistingSubscription gracefully', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn().mockRejectedValue(new Error('Network error')),
        deleteSubscription: jest.fn()
      };

      // Should not throw, should log error
      await expect(setupWebhookSubscription(mockService)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle error from createSubscription gracefully', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn().mockRejectedValue(new Error('API error')),
        getExistingSubscription: jest.fn().mockResolvedValue(null),
        deleteSubscription: jest.fn()
      };

      // Should not throw, app should continue
      await expect(setupWebhookSubscription(mockService)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Setup failed'),
        expect.any(Object)
      );
    });

    // ========== Service Injection Pattern ==========

    it('should accept optional service for testing', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      process.env.WEBHOOK_CALLBACK_URL = 'https://example.com/webhooks';
      process.env.WEBHOOK_VERIFY_TOKEN = 'test-token';
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn().mockResolvedValue({
          id: 111,
          created_at: '2025-11-22T00:00:00Z',
          updated_at: '2025-11-22T00:00:00Z',
          callback_url: 'https://example.com/webhooks',
          resource_state: 2
        }),
        deleteSubscription: jest.fn()
      };

      // Pass custom service - should use it instead of creating default
      await setupWebhookSubscription(mockService);

      expect(mockService.getExistingSubscription).toHaveBeenCalled();
    });

    // ========== Multiple Configuration Errors ==========

    it('should report multiple missing config items', async () => {
      process.env.WEBHOOK_ENABLED = 'true';
      delete process.env.WEBHOOK_CALLBACK_URL;
      delete process.env.WEBHOOK_VERIFY_TOKEN;
      process.env.STRAVA_CLIENT_ID = 'test-id';
      process.env.STRAVA_CLIENT_SECRET = 'test-secret';

      const mockService: SubscriptionService = {
        createSubscription: jest.fn(),
        getExistingSubscription: jest.fn(),
        deleteSubscription: jest.fn()
      };

      await setupWebhookSubscription(mockService);

      // Should warn about both missing items
      const warnCalls = consoleWarnSpy.mock.calls
        .map(call => call[0])
        .join('\n');
      expect(warnCalls).toContain('WEBHOOK_CALLBACK_URL');
      expect(warnCalls).toContain('WEBHOOK_VERIFY_TOKEN');
    });
  });
});
