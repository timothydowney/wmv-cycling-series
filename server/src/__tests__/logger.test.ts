/**
 * Tests for Logger type utilities
 *
 * Validates structured logging, log level enum, and utility creators
 */

import {
  LogLevel,
  StructuredLogger,
  createConsoleLoggerCallback,
  createCollectingLoggerCallback,
  createFilteredLoggerCallback
} from '../types/Logger';

describe('Logger Types & Utilities', () => {
  describe('LogLevel enum', () => {
    it('should define all expected log levels', () => {
      expect(LogLevel.Info).toBe('info');
      expect(LogLevel.Success).toBe('success');
      expect(LogLevel.Error).toBe('error');
      expect(LogLevel.Section).toBe('section');
    });

    it('should have correct number of levels', () => {
      const levels = Object.values(LogLevel);
      expect(levels.length).toBe(4);
    });
  });

  describe('StructuredLogger class', () => {
    it('should create logger with prefix', () => {
      const logger = new StructuredLogger('TestPrefix');
      expect(logger).toBeDefined();
    });

    it('should log info messages via callback', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.info('test message');

      expect(logged).toHaveLength(1);
      expect(logged[0].level).toBe(LogLevel.Info);
      expect(logged[0].message).toBe('test message');
    });

    it('should log info with participant context', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.info('message', 'Alice');

      expect(logged[0].participant).toBe('Alice');
    });

    it('should log success messages', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.success('operation succeeded', 'Bob');

      expect(logged[0].level).toBe(LogLevel.Success);
      expect(logged[0].message).toBe('operation succeeded');
    });

    it('should log error messages', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.error('something failed', 'Charlie');

      expect(logged[0].level).toBe(LogLevel.Error);
      expect(logged[0].message).toBe('something failed');
    });

    it('should log section headers', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.section('Section Header');

      expect(logged[0].level).toBe(LogLevel.Section);
      expect(logged[0].message).toBe('Section Header');
      expect(logged[0].participant).toBeUndefined();
    });

    it('should fall back to console logging without callback', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const logger = new StructuredLogger('Test');
      logger.info('console message');

      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should handle multiple log calls', () => {
      const logged: any[] = [];
      const callback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const logger = new StructuredLogger('Test', callback);
      logger.info('first');
      logger.success('second', 'Alice');
      logger.error('third');

      expect(logged).toHaveLength(3);
      expect(logged[0].message).toBe('first');
      expect(logged[1].message).toBe('second');
      expect(logged[2].message).toBe('third');
    });
  });

  describe('createConsoleLoggerCallback', () => {
    it('should create a callback that logs to console', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const callback = createConsoleLoggerCallback('TestPrefix');
      callback(LogLevel.Info, 'test message');

      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should include prefix in output', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const callback = createConsoleLoggerCallback('MyApp');
      callback(LogLevel.Info, 'test message');

      expect(consoleLogSpy.mock.calls[0][0]).toContain('MyApp');

      consoleLogSpy.mockRestore();
    });

    it('should include level in output', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const callback = createConsoleLoggerCallback('Test');
      callback(LogLevel.Error, 'error message');

      expect(consoleLogSpy.mock.calls[0][0]).toContain('ERROR');

      consoleLogSpy.mockRestore();
    });

    it('should include participant when provided', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const callback = createConsoleLoggerCallback('Test');
      callback(LogLevel.Info, 'message', 'Alice');

      expect(consoleLogSpy.mock.calls[0][0]).toContain('Alice');

      consoleLogSpy.mockRestore();
    });
  });

  describe('createCollectingLoggerCallback', () => {
    it('should create callback that collects logs in array', () => {
      const [callback, getLogs] = createCollectingLoggerCallback();

      callback(LogLevel.Info, 'test message');

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
    });

    it('should include timestamp in collected logs', () => {
      const [callback, getLogs] = createCollectingLoggerCallback();

      const beforeTime = Date.now();
      callback(LogLevel.Info, 'test');
      const afterTime = Date.now();

      const logs = getLogs();
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(logs[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should collect multiple logs', () => {
      const [callback, getLogs] = createCollectingLoggerCallback();

      callback(LogLevel.Info, 'first');
      callback(LogLevel.Success, 'second', 'Alice');
      callback(LogLevel.Error, 'third');

      const logs = getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe(LogLevel.Info);
      expect(logs[1].level).toBe(LogLevel.Success);
      expect(logs[1].participant).toBe('Alice');
      expect(logs[2].level).toBe(LogLevel.Error);
    });

    it('should return same array instance across calls', () => {
      const [callback, getLogs] = createCollectingLoggerCallback();

      callback(LogLevel.Info, 'test');
      const logs1 = getLogs();

      callback(LogLevel.Info, 'another');
      const logs2 = getLogs();

      expect(logs1).toBe(logs2);
      expect(logs2).toHaveLength(2);
    });
  });

  describe('createFilteredLoggerCallback', () => {
    it('should filter logs by allowed levels', () => {
      const logged: any[] = [];
      const baseCallback = (level: LogLevel, message: string) => {
        logged.push({ level, message });
      };

      const filtered = createFilteredLoggerCallback(baseCallback, [LogLevel.Error]);

      filtered(LogLevel.Info, 'info message');
      filtered(LogLevel.Error, 'error message');
      filtered(LogLevel.Success, 'success message');

      expect(logged).toHaveLength(1);
      expect(logged[0].level).toBe(LogLevel.Error);
    });

    it('should allow multiple levels', () => {
      const logged: any[] = [];
      const baseCallback = (level: LogLevel, message: string) => {
        logged.push({ level, message });
      };

      const filtered = createFilteredLoggerCallback(baseCallback, [LogLevel.Error, LogLevel.Success]);

      filtered(LogLevel.Info, 'info');
      filtered(LogLevel.Error, 'error');
      filtered(LogLevel.Success, 'success');
      filtered(LogLevel.Section, 'section');

      expect(logged).toHaveLength(2);
      expect(logged.map(l => l.level)).toEqual([LogLevel.Error, LogLevel.Success]);
    });

    it('should allow empty filter list', () => {
      const logged: any[] = [];
      const baseCallback = (level: LogLevel, message: string) => {
        logged.push({ level, message });
      };

      const filtered = createFilteredLoggerCallback(baseCallback, []);

      filtered(LogLevel.Info, 'info');
      filtered(LogLevel.Error, 'error');

      expect(logged).toHaveLength(0);
    });

    it('should pass through participant context', () => {
      const logged: any[] = [];
      const baseCallback = (level: LogLevel, message: string, participant?: string) => {
        logged.push({ level, message, participant });
      };

      const filtered = createFilteredLoggerCallback(baseCallback, [LogLevel.Error]);

      filtered(LogLevel.Error, 'error', 'Alice');

      expect(logged[0].participant).toBe('Alice');
    });
  });
});
