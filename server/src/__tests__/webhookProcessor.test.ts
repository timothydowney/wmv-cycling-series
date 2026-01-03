// @ts-nocheck
/**
 * Webhook Processor Tests
 *
 * Tests the webhook processor using dependency injection for the service layer.
 * This makes tests focused, fast, and easy to understand.
 */

describe('Webhook Processor', () => {
  let createWebhookProcessor;
  let mockLogger;
  let mockService;

  beforeAll(() => {
    // Import processor after all mocking is set up
    const { createWebhookProcessor: cwp } = require('../webhooks/processor');
    createWebhookProcessor = cwp;
  });

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      logEvent: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      getLog: jest.fn(),
      getFailedEvents: jest.fn()
    };

    // Setup mock service
    mockService = {
      deleteActivity: jest.fn(),
      deleteAthleteTokens: jest.fn(),
      findParticipantByAthleteId: jest.fn()
    };
  });

  describe('Activity Deletion', () => {
    it('should delete activity by calling service.deleteActivity', async () => {
      // Arrange
      mockService.deleteActivity.mockReturnValue({ deleted: true, changes: 3 });
      
      const processor = createWebhookProcessor(null, mockService);
      const event = {
        object_id: '123456789',
        object_type: 'activity',
        aspect_type: 'delete',
        owner_id: '12345',
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1
      };

      // Act
      await processor(event, mockLogger);

      // Assert
      expect(mockService.deleteActivity).toHaveBeenCalledWith('123456789');
      expect(mockService.deleteActivity).toHaveBeenCalledTimes(1);
    });
  });

  describe('Athlete Deauthorization', () => {
    it('should delete tokens when athlete deauthorizes', async () => {
      // Arrange
      mockService.findParticipantByAthleteId.mockReturnValue({ name: 'Alice' });
      mockService.deleteAthleteTokens.mockReturnValue({ deleted: true, changes: 1 });
      
      const processor = createWebhookProcessor(null, mockService);
      const event = {
        object_id: '12345',
        object_type: 'athlete',
        aspect_type: 'update',
        owner_id: '12345',
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1,
        updates: {
          authorized: false
        }
      };

      // Act
      await processor(event, mockLogger);

      // Assert
      expect(mockService.findParticipantByAthleteId).toHaveBeenCalledWith('12345');
      expect(mockService.deleteAthleteTokens).toHaveBeenCalledWith('12345');
    });
  });
});
