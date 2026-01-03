/**
 * Logger.ts
 *
 * Type definitions and implementation for structured logging across the application.
 * Provides a clean interface for logging that can be tested, mocked, and swapped
 * without coupling business logic to specific implementations.
 *
 * Usage:
 *   const logger = new StructuredLogger('BatchFetch');
 *   logger.info('Starting fetch');
 *   logger.success('Activity found', 'Alice');
 *   logger.error('Failed to parse', 'Bob');
 *   logger.section('Processing participant');
 */

/**
 * Log level enumeration
 * - info: Informational message
 * - success: Success/positive result
 * - error: Error or failure
 * - section: Section header/separator
 */
export enum LogLevel {
  Info = 'info',
  Success = 'success',
  Error = 'error',
  Section = 'section'
}

/**
 * Effort link for clickable Strava effort references
 */
export interface EffortLink {
  effortId: string;
  activityId: string;
}

/**
 * Structured log entry
 * Includes timestamp, level, message, and optional participant context
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  participant?: string;
  effortLinks?: EffortLink[];
}

/**
 * Logger callback type
 * Used for dependency injection of logging implementations
 * Allows swapping console logging, SSE streaming, file logging, etc.
 *
 * Usage in functions:
 *   async function doWork(onLog?: LoggerCallback) {
 *     onLog?.(LogLevel.Info, 'Starting work');
 *   }
 */
export type LoggerCallback = (
  level: LogLevel,
  message: string,
  participant?: string,
  effortLinks?: EffortLink[]
) => void;

/**
 * StructuredLogger class
 * Implements standard logging with a prefix for context
 * Can be extended for custom behavior (metrics, filtering, etc.)
 */
export class StructuredLogger {
  constructor(
    private prefix: string,
    private onLog?: LoggerCallback
  ) {}

  /**
   * Log an informational message
   */
  info(message: string, participant?: string, effortLinks?: EffortLink[]): void {
    this.log(LogLevel.Info, message, participant, effortLinks);
  }

  /**
   * Log a success message
   */
  success(message: string, participant?: string, effortLinks?: EffortLink[]): void {
    this.log(LogLevel.Success, message, participant, effortLinks);
  }

  /**
   * Log an error message
   */
  error(message: string, participant?: string, effortLinks?: EffortLink[]): void {
    this.log(LogLevel.Error, message, participant, effortLinks);
  }

  /**
   * Log a section header/separator
   */
  section(message: string): void {
    this.log(LogLevel.Section, message);
  }

  /**
   * Internal log method
   * Calls the callback if provided, otherwise logs to console
   */
  private log(level: LogLevel, message: string, participant?: string, effortLinks?: EffortLink[]): void {
    if (this.onLog) {
      // Use injected logger (e.g., SSE streaming)
      this.onLog(level, message, participant, effortLinks);
    } else {
      // Default to console logging
      this.logToConsole(level, message, participant);
    }
  }

  /**
   * Default console logging implementation
   * Used when no callback is provided
   */
  private logToConsole(
    level: LogLevel,
    message: string,
    participant?: string
  ): void {
    const prefix = `[${this.prefix}]`;
    const levelStr = `[${level.toUpperCase()}]`;
    const participantStr = participant ? ` (${participant})` : '';

    if (level === LogLevel.Section) {
      console.log(`\n${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${levelStr} ${message}${participantStr}`);
    }
  }
}

/**
 * Create a logger callback from console logging
 * Useful for testing or when SSE isn't available
 */
export function createConsoleLoggerCallback(prefix: string): LoggerCallback {
  return (level, message, participant) => {
    const logPrefix = `[${prefix}]`;
    const levelStr = `[${level.toUpperCase()}]`;
    const participantStr = participant ? ` (${participant})` : '';

    if (level === LogLevel.Section) {
      console.log(`\n${logPrefix} ${message}`);
    } else {
      console.log(`${logPrefix} ${levelStr} ${message}${participantStr}`);
    }
  };
}

/**
 * Create a logger callback that collects logs in an array
 * Useful for testing
 */
export function createCollectingLoggerCallback(): [
  LoggerCallback,
  () => LogEntry[]
  ] {
  const logs: LogEntry[] = [];

  const callback: LoggerCallback = (level, message, participant, effortLinks) => {
    logs.push({
      timestamp: Date.now(),
      level,
      message,
      participant,
      effortLinks
    });
  };

  return [callback, () => logs];
}

/**
 * Create a logger callback that filters based on level
 * Useful for reducing noise in tests
 */
export function createFilteredLoggerCallback(
  baseCallback: LoggerCallback,
  allowedLevels: LogLevel[]
): LoggerCallback {
  return (level, message, participant, effortLinks) => {
    if (allowedLevels.includes(level)) {
      baseCallback(level, message, participant, effortLinks);
    }
  };
}
