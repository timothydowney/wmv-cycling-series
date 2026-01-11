import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import { WebhookAdminService } from '../services/WebhookAdminService';

// Define the mock object with any to bypass strict type checking in tests
const mockAdminService: any = {
  getStatus: jest.fn(),
  getStorageStatus: jest.fn(),
  getEvents: jest.fn(),
  enable: jest.fn(),
  disable: jest.fn(),
  renew: jest.fn(),
  retryEvent: jest.fn(),
  getEnrichedEventDetails: jest.fn(),
  replayEvent: jest.fn(),
  clearEvents: jest.fn(),
};

// Mock the WebhookAdminService class
jest.mock('../services/WebhookAdminService', () => {
  return {
    WebhookAdminService: jest.fn().mockImplementation(() => mockAdminService),
  };
});

describe('webhookAdminRouter', () => {
  const mockOrm = {} as any;
  const mockDb = {} as any;
  
  // Helper to create an admin caller
  const createAdminCaller = () => {
    return appRouter.createCaller(createContext({
      req: { session: { isAdmin: true, stravaAthleteId: '123' } } as any,
      res: {} as any,
      ormOverride: mockOrm,
      dbOverride: mockDb
    }));
  };

  // Helper to create a regular user caller
  const createUserCaller = () => {
    return appRouter.createCaller(createContext({
      req: { session: { isAdmin: false, stravaAthleteId: '456' } } as any,
      res: {} as any,
      ormOverride: mockOrm,
      dbOverride: mockDb
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should block non-admin users', async () => {
      const caller = createUserCaller();
      await expect(caller.webhookAdmin.getStatus()).rejects.toThrow('UNAUTHORIZED');
    });

    it('should allow admin users', async () => {
      const caller = createAdminCaller();
      mockAdminService.getStatus.mockResolvedValue({ enabled: true });
      
      const result = await caller.webhookAdmin.getStatus();
      expect(result).toEqual({ enabled: true });
    });
  });

  describe('getStatus', () => {
    it('should call adminService.getStatus()', async () => {
      const caller = createAdminCaller();
      const mockStatus = { enabled: true, subscription: null };
      mockAdminService.getStatus.mockResolvedValue(mockStatus);

      const result = await caller.webhookAdmin.getStatus();

      expect(mockAdminService.getStatus).toHaveBeenCalled();
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getEvents', () => {
    it('should call getEvents with default values', async () => {
      const caller = createAdminCaller();
      mockAdminService.getEvents.mockResolvedValue([]);

      await caller.webhookAdmin.getEvents({});

      expect(mockAdminService.getEvents).toHaveBeenCalledWith(
        50, // default limit
        0,  // default offset
        expect.any(Number), // default since (7 days ago)
        'all' // default status
      );
    });

    it('should call getEvents with custom values', async () => {
      const caller = createAdminCaller();
      mockAdminService.getEvents.mockResolvedValue([]);

      await caller.webhookAdmin.getEvents({
        limit: 10,
        offset: 5,
        since: 1000,
        status: 'success'
      });

      expect(mockAdminService.getEvents).toHaveBeenCalledWith(10, 5, 1000, 'success');
    });
  });

  describe('getEnrichedEventDetails', () => {
    it('should call getEnrichedEventDetails with id', async () => {
      const caller = createAdminCaller();
      mockAdminService.getEnrichedEventDetails.mockResolvedValue({ id: 1 });

      await caller.webhookAdmin.getEnrichedEventDetails({ id: 123 });

      expect(mockAdminService.getEnrichedEventDetails).toHaveBeenCalledWith(123);
    });

    it('should fail with invalid id', async () => {
      const caller = createAdminCaller();
      await expect(caller.webhookAdmin.getEnrichedEventDetails({ id: -1 } as any)).rejects.toThrow();
    });
  });

  describe('clearEvents', () => {
    it('should call clearEvents only if confirmed', async () => {
      const caller = createAdminCaller();
      mockAdminService.clearEvents.mockResolvedValue({ count: 10 });

      await caller.webhookAdmin.clearEvents({ confirm: 'yes' });

      expect(mockAdminService.clearEvents).toHaveBeenCalled();
    });

    it('should fail if confirm is wrong', async () => {
      const caller = createAdminCaller();
      await expect(caller.webhookAdmin.clearEvents({ confirm: 'no' } as any)).rejects.toThrow();
    });
  });
});
