// @ts-nocheck
/**
 * Storage Monitor Tests
 * Tests for webhook database storage monitoring and auto-disable threshold
 */

import fs from 'fs';
import { StorageMonitor, StorageStatus } from '../webhooks/storageMonitor';

// Mock fs module
jest.mock('fs');

describe('StorageMonitor', () => {
  let mockDb;
  let mockStat;
  const dbPath = '/data/wmv.db';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      prepare: jest.fn()
    };

    // Default stat mock (50MB database)
    mockStat = {
      size: 50 * 1024 * 1024 // 50MB
    };
    (fs.statSync as jest.Mock).mockReturnValue(mockStat);

    // Reset environment variable
    delete process.env.MAX_DATABASE_SIZE;
  });

  describe('parseMaxSize', () => {
    it('should use default 256MB when MAX_DATABASE_SIZE is not set', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const monitor = new StorageMonitor(mockDb, dbPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[StorageMonitor] MAX_DATABASE_SIZE not set, using default 256MB'
      );
      
      consoleSpy.mockRestore();
    });

    it('should parse and use MAX_DATABASE_SIZE from environment variable', () => {
      process.env.MAX_DATABASE_SIZE = '512';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[StorageMonitor] Using MAX_DATABASE_SIZE=512MB'
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid MAX_DATABASE_SIZE and use default', () => {
      process.env.MAX_DATABASE_SIZE = 'invalid';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid MAX_DATABASE_SIZE="invalid"')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should reject negative or zero values and use default', () => {
      process.env.MAX_DATABASE_SIZE = '-256';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid MAX_DATABASE_SIZE')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      // Mock database.prepare to check which SQL was passed and return appropriate statement
      mockDb.prepare.mockImplementation((sql: string) => {
        return {
          get: jest.fn(() => {
            // Based on the SQL query, return appropriate data
            if (sql.includes('-7 days')) {
              return { count: 14 }; // 14 events in last 7 days = 2/day
            }
            return { count: 100 }; // Total events count
          }),
          run: jest.fn()
        };
      });
    });

    it('should return storage status with correct usage percentage', () => {
      mockStat.size = 50 * 1024 * 1024; // 50MB
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.database_size_mb).toBeCloseTo(50, 1);
      expect(status.max_size_mb).toBe(256);
      expect(status.usage_percentage).toBeCloseTo((50 / 256) * 100, 1); // ~19.5%
    });

    it('should calculate correct usage percentage with custom MAX_DATABASE_SIZE', () => {
      mockStat.size = 128 * 1024 * 1024; // 128MB
      process.env.MAX_DATABASE_SIZE = '200';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.database_size_mb).toBeCloseTo(128, 1);
      expect(status.max_size_mb).toBe(200);
      expect(status.usage_percentage).toBeCloseTo((128 / 200) * 100, 1); // 64%
    });

    it('should not auto-disable when below 95% threshold', () => {
      mockStat.size = 240 * 1024 * 1024; // 240MB
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.should_auto_disable).toBe(false);
      expect(status.usage_percentage).toBeCloseTo((240 / 256) * 100, 1); // ~93.75%
    });

    it('should auto-disable when at or above 95% threshold', () => {
      // Set to slightly above 95% to account for floating point precision
      mockStat.size = Math.floor(256 * 0.951 * 1024 * 1024);
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.should_auto_disable).toBe(true);
    });

    it('should return correct event metrics', () => {
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => {
          if (sql.includes('-7 days')) {
            return { count: 14 }; // 2 events per day
          }
          return { count: 100 }; // Total events
        }),
        run: jest.fn()
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.events_count).toBe(100);
      expect(status.events_per_day).toBe(2);
    });

    it('should handle zero events per day gracefully', () => {
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => {
          if (sql.includes('-7 days')) {
            return { count: 0 };
          }
          return { count: 100 };
        }),
        run: jest.fn()
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.events_per_day).toBe(0);
      expect(status.estimated_weeks_remaining).toBe(0);
    });

    it('should estimate weeks remaining correctly', () => {
      mockStat.size = 50 * 1024 * 1024; // 50MB of 256MB
      process.env.MAX_DATABASE_SIZE = '256';

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => {
          if (sql.includes('-7 days')) {
            return { count: 7 }; // 1 event per day, ~1KB each
          }
          return { count: 100 };
        }),
        run: jest.fn()
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      // Available: 256 - 50 = 206MB = 210,731,776 bytes
      // Growth rate: 1 event/day * 1000 bytes = 1000 bytes/day
      // Days remaining: 210,731,776 / 1000 = ~210,731 days
      // Weeks remaining: ~30,104 weeks
      expect(status.estimated_weeks_remaining).toBeGreaterThan(1000);
    });

    it('should include timestamp in response', () => {
      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.last_calculated_at).toBeDefined();
      expect(new Date(status.last_calculated_at)).toBeInstanceOf(Date);
    });

    it('should set warning message at 90% usage', () => {
      mockStat.size = Math.floor(256 * 0.901 * 1024 * 1024); // Slightly above 90% of 256MB
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.warning_message).toBeTruthy();
      expect(status.warning_message).toContain('90');
      expect(status.warning_message).toContain('95');
    });

    it('should not set warning message below 90% usage', () => {
      mockStat.size = 200 * 1024 * 1024; // ~78% of 256MB
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.warning_message).toBeNull();
    });

    it('should include auto_disable_threshold in response', () => {
      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.auto_disable_threshold).toBe(95);
    });
  });

  describe('checkAndAutoDisable', () => {
    beforeEach(() => {
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => ({ count: 100 })),
        run: jest.fn()
      }));
    });

    it('should return false when storage below threshold', async () => {
      mockStat.size = 50 * 1024 * 1024;
      process.env.MAX_DATABASE_SIZE = '256';

      const monitor = new StorageMonitor(mockDb, dbPath);
      const result = await monitor.checkAndAutoDisable();

      expect(result).toBe(false);
    });

    it('should disable webhooks when threshold exceeded', async () => {
      mockStat.size = Math.floor(256 * 0.951 * 1024 * 1024); // Slightly above 95%
      process.env.MAX_DATABASE_SIZE = '256';

      // Setup mock for this test
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => ({ count: 100 })),
        run: jest.fn()
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      const result = await monitor.checkAndAutoDisable();

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webhook_subscription')
      );
    });

    it('should log warning when auto-disabling', async () => {
      mockStat.size = Math.floor(256 * 0.951 * 1024 * 1024); // Slightly above 95%
      process.env.MAX_DATABASE_SIZE = '256';

      // Setup mock for this test
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => ({ count: 100 })),
        run: jest.fn()
      }));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      await monitor.checkAndAutoDisable();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage at')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should set inactive status when disabling webhooks', async () => {
      mockStat.size = Math.floor(256 * 0.951 * 1024 * 1024); // Slightly above 95%
      process.env.MAX_DATABASE_SIZE = '256';

      const mockRun = jest.fn();
      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => ({ count: 100 })),
        run: mockRun
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      await monitor.checkAndAutoDisable();

      expect(mockRun).toHaveBeenCalled();
      // Find the UPDATE call among all prepare calls
      const updateCall = mockDb.prepare.mock.calls.find(
        (call: any[]) => call[0].includes('UPDATE webhook_subscription')
      );
      expect(updateCall).toBeDefined();
      const updateQuery = updateCall![0];
      expect(updateQuery).toContain('enabled = 0');
      expect(updateQuery).toContain("status = 'inactive'");
      expect(updateQuery).toContain('Storage threshold exceeded');
    });
  });

  describe('clearOldEvents', () => {
    it('should delete events older than specified days', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 150 });
      mockDb.prepare.mockReturnValue({
        run: mockRun
      });

      const monitor = new StorageMonitor(mockDb, dbPath);
      const deleted = monitor.clearOldEvents(30);

      expect(deleted).toBe(150);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM webhook_event')
      );
      expect(mockRun).toHaveBeenCalledWith('-30');
    });

    it('should use custom minDaysOld parameter', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 50 });
      mockDb.prepare.mockReturnValue({
        run: mockRun
      });

      const monitor = new StorageMonitor(mockDb, dbPath);
      monitor.clearOldEvents(7);

      expect(mockRun).toHaveBeenCalledWith('-7');
    });

    it('should log deletion result', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 100 })
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      monitor.clearOldEvents(30);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 100 events')
      );

      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully', () => {
      const testError = new Error('Database error');
      mockDb.prepare.mockImplementation(() => {
        throw testError;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      expect(() => monitor.clearOldEvents(30)).toThrow('Database error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StorageMonitor] Failed to clear old events:',
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getGrowthRate', () => {
    it('should calculate growth rate based on last 7 days', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({ count: 14 })) // 14 events in 7 days
      });

      const monitor = new StorageMonitor(mockDb, dbPath);
      const growthRate = monitor.getGrowthRate();

      // 14 events / 7 days * 1000 bytes per event = 2000 bytes/day
      expect(growthRate).toBe(2000);
    });

    it('should estimate 1KB per event', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({ count: 7 })) // 7 events in 7 days = 1/day
      });

      const monitor = new StorageMonitor(mockDb, dbPath);
      const growthRate = monitor.getGrowthRate();

      // 1 event/day * 1000 bytes = 1000 bytes/day
      expect(growthRate).toBe(1000);
    });

    it('should return 0 for zero events', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({ count: 0 }))
      });

      const monitor = new StorageMonitor(mockDb, dbPath);
      const growthRate = monitor.getGrowthRate();

      expect(growthRate).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle fs.statSync errors', () => {
      (fs.statSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      expect(() => monitor.getStatus()).toThrow('File not found');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StorageMonitor] Failed to get status:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle database query errors in getStatus', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      expect(() => monitor.getStatus()).toThrow('Database error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StorageMonitor] Failed to get status:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in checkAndAutoDisable', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const monitor = new StorageMonitor(mockDb, dbPath);
      expect(async () => await monitor.checkAndAutoDisable()).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StorageMonitor] Auto-disable check failed:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic storage growth scenario', () => {
      // Start with small database
      mockStat.size = 10 * 1024 * 1024; // 10MB
      process.env.MAX_DATABASE_SIZE = '256';

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: jest.fn(() => {
          if (sql.includes('-7 days')) {
            return { count: 70 }; // 10 events/day average
          }
          return { count: 500 };
        }),
        run: jest.fn()
      }));

      const monitor = new StorageMonitor(mockDb, dbPath);
      const status = monitor.getStatus();

      expect(status.database_size_mb).toBeCloseTo(10, 1);
      expect(status.usage_percentage).toBeCloseTo((10 / 256) * 100, 1);
      expect(status.events_per_day).toBe(10);
      expect(status.should_auto_disable).toBe(false);
      expect(status.warning_message).toBeNull();

      // Simulate growing to 240MB
      mockStat.size = 240 * 1024 * 1024;
      const highStatus = monitor.getStatus();

      expect(highStatus.database_size_mb).toBeCloseTo(240, 1);
      expect(highStatus.usage_percentage).toBeCloseTo((240 / 256) * 100, 1);
      expect(highStatus.warning_message).toBeTruthy();
      expect(highStatus.should_auto_disable).toBe(false);
    });

    it('should work with various MAX_DATABASE_SIZE values', () => {
      const sizes = [100, 256, 512, 1024];

      sizes.forEach(maxSize => {
        process.env.MAX_DATABASE_SIZE = String(maxSize);
        mockStat.size = Math.floor(maxSize * 0.5 * 1024 * 1024); // 50% full

        mockDb.prepare.mockImplementation((sql: string) => ({
          get: jest.fn(() => ({ count: 100 })),
          run: jest.fn()
        }));

        const monitor = new StorageMonitor(mockDb, dbPath);
        const status = monitor.getStatus();

        expect(status.max_size_mb).toBe(maxSize);
        expect(status.usage_percentage).toBeCloseTo(50, 1);
      });
    });
  });
});
