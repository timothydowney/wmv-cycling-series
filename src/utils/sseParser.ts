/**
 * SSE Parser Utility
 *
 * Type-safe Server-Sent Events parser with validation and error handling.
 * Handles the low-level details of parsing SSE format (event/data pairs)
 * and provides a clean interface for consuming SSE streams.
 *
 * SSE Format:
 *   event: log
 *   data: {"message":"Hello"}
 *
 *   event: complete
 *   data: {"success":true}
 *
 * Usage:
 *   const parser = new SSEParser<LogEntry>();
 *   parser.on('log', (entry) => console.log(entry));
 *   parser.on('complete', (result) => console.log('Done!'));
 *   parser.on('error', (err) => console.error(err));
 *   await parser.parseStream(response.body);
 */

/**
 * Event handler type for SSE events
 */
export type SSEEventHandler<T> = (data: T) => void;

/**
 * Error handler type
 */
export type SSEErrorHandler = (error: Error) => void;

/**
 * SSE Event types that can be emitted
 */
export type SSEEventType = string;

/**
 * Options for SSE parser configuration
 */
export interface SSEParserOptions {
  /** Maximum buffer size before failing (prevents OOM) */
  maxBufferSize?: number;
  /** Debug logging enabled */
  debug?: boolean;
}

/**
 * Generic SSE Parser for type-safe event handling
 *
 * Supports:
 * - Multiple event types
 * - Type-safe event handlers with generics
 * - Error recovery and validation
 * - Stream cancellation
 * - Memory-safe buffering
 */
export class SSEParser<T = Record<string, unknown>> {
  private handlers: Map<SSEEventType, SSEEventHandler<any>[]> = new Map();
  private errorHandlers: SSEErrorHandler[] = [];
  private debug: boolean;
  private maxBufferSize: number;
  private cancelled = false;

  constructor(options: SSEParserOptions = {}) {
    this.debug = options.debug ?? false;
    this.maxBufferSize = options.maxBufferSize ?? 1024 * 1024; // 1MB default
  }

  /**
   * Register a handler for a specific event type
   *
   * @param eventType - The SSE event type to listen for
   * @param handler - Function to call when event is received
   * @returns Unsubscribe function
   */
  on<E extends Partial<T>>(eventType: SSEEventType, handler: SSEEventHandler<E>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register error handler for stream errors
   *
   * @param handler - Function to call on error
   * @returns Unsubscribe function
   */
  onError(handler: SSEErrorHandler): () => void {
    this.errorHandlers.push(handler);

    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Parse a ReadableStream in SSE format
   *
   * @param stream - The response body stream
   * @throws Error if stream parsing fails
   */
  async parseStream(stream: ReadableStream<Uint8Array> | null): Promise<void> {
    if (!stream) {
      throw new Error('No stream provided');
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (this.cancelled) {
          this.log('Stream parsing cancelled');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Check buffer size to prevent OOM
        if (buffer.length > this.maxBufferSize) {
          const error = new Error(`Buffer exceeded maximum size of ${this.maxBufferSize} bytes`);
          this.emitError(error);
          throw error;
        }

        // Process complete lines (SSE messages end with \n\n)
        this.processBuffer(buffer);
        buffer = this.getRemainingBuffer(buffer);
      }

      // Final flush of remaining data
      if (buffer.trim()) {
        this.processBuffer(buffer);
      }
    } catch (error) {
      if (this.cancelled) {
        this.log('Parsing interrupted by cancellation');
        return;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitError(err);
      throw err;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Cancel parsing (useful for cleanup or user interruption)
   */
  cancel(): void {
    this.cancelled = true;
    this.log('Parser cancelled');
  }

  /**
   * Process a buffer chunk for SSE events
   *
   * @param buffer - Raw buffer chunk
   */
  private processBuffer(buffer: string): void {
    const lines = buffer.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Empty line marks end of event
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Event type line: "event: log"
      if (line.startsWith('event: ')) {
        const eventType = line.substring(7).trim();

        // Next line should be data: {...}
        if (i + 1 < lines.length) {
          const dataLine = lines[i + 1];

          if (dataLine.startsWith('data: ')) {
            try {
              const jsonStr = dataLine.substring(6);
              const data = JSON.parse(jsonStr);
              this.log(`Event "${eventType}":`, data);
              this.emit(eventType, data);
              i += 2; // Skip both event and data lines
              continue;
            } catch (error) {
              const parseError = new Error(
                `Failed to parse SSE data for event "${eventType}": ${error instanceof Error ? error.message : String(error)}`
              );
              this.emitError(parseError);
              // Continue processing despite parse error
              i++;
              continue;
            }
          }
        }
      }

      // Comments (lines starting with :) are ignored
      if (line.startsWith(':')) {
        i++;
        continue;
      }

      // Unknown line format, skip
      this.log(`Skipping unknown line: ${line.substring(0, 50)}...`);
      i++;
    }
  }

  /**
   * Get the remaining incomplete line from buffer
   * (data that hasn't formed a complete message yet)
   *
   * @param buffer - Current buffer
   * @returns Remaining incomplete data
   */
  private getRemainingBuffer(buffer: string): string {
    // Find the last complete message (ends with \n\n)
    const lastCompleteIndex = buffer.lastIndexOf('\n\n');
    if (lastCompleteIndex === -1) {
      return buffer; // No complete message, keep everything
    }

    // Return everything after the last complete message
    return buffer.substring(lastCompleteIndex + 2);
  }

  /**
   * Emit an event to all registered handlers
   *
   * @param eventType - The event type
   * @param data - The event data
   */
  private emit(eventType: SSEEventType, data: any): void {
    const handlers = this.handlers.get(eventType);
    if (handlers && handlers.length > 0) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          const err = new Error(
            `Error in ${eventType} handler: ${error instanceof Error ? error.message : String(error)}`
          );
          this.emitError(err);
        }
      }
    }
  }

  /**
   * Emit error to all error handlers
   *
   * @param error - The error that occurred
   */
  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    }
  }

  /**
   * Debug logging (only if enabled)
   *
   * @param args - Arguments to log
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[SSEParser]', ...args);
    }
  }
}

/**
 * Helper function to parse SSE stream with event listeners
 *
 * Usage:
 *   parseSSE(response.body, {
 *     onLog: (entry) => console.log(entry),
 *     onComplete: (result) => console.log('Done!'),
 *     onError: (err) => console.error(err)
 *   });
 */
export async function parseSSE<T extends Record<string, any>>(
  stream: ReadableStream<Uint8Array> | null,
  listeners: {
    [key: string]: (data: any) => void;
  },
  options?: SSEParserOptions
): Promise<void> {
  const parser = new SSEParser<T>(options);

  // Register all listeners
  for (const [eventType, handler] of Object.entries(listeners)) {
    parser.on(eventType, handler);
  }

  // Register error handler
  parser.onError((error) => {
    if (listeners['error']) {
      listeners['error'](error);
    } else {
      console.error('[SSE Error]', error);
    }
  });

  await parser.parseStream(stream);
}

/**
 * Helper to wait for a specific SSE event with timeout
 *
 * Usage:
 *   const result = await waitForSSEEvent(
 *     response.body,
 *     'complete',
 *     5000 // 5 second timeout
 *   );
 */
export function waitForSSEEvent<T = any>(
  stream: ReadableStream<Uint8Array> | null,
  eventType: string,
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const parser = new SSEParser();
    const timeoutHandle = setTimeout(() => {
      parser.cancel();
      reject(new Error(`Timeout waiting for '${eventType}' event after ${timeoutMs}ms`));
    }, timeoutMs);

    parser.on(eventType, (data) => {
      clearTimeout(timeoutHandle);
      parser.cancel();
      resolve(data as T);
    });

    parser.onError((error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    parser.parseStream(stream).catch((error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

/**
 * Validate that parsed SSE data matches expected schema
 *
 * Usage:
 *   const validated = validateSSEData(data, {
 *     timestamp: 'number',
 *     message: 'string',
 *     level: 'string'
 *   });
 */
export function validateSSEData(
  data: unknown,
  schema: Record<string, string>
): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Expected object, got ${typeof data}`);
  }

  const obj = data as Record<string, unknown>;
  const validated: Record<string, unknown> = {};

  for (const [key, expectedType] of Object.entries(schema)) {
    const value = obj[key];
    const actualType = typeof value;

    if (actualType !== expectedType && !(expectedType === 'any')) {
      throw new Error(
        `Field '${key}' has type '${actualType}', expected '${expectedType}'`
      );
    }

    validated[key] = value;
  }

  return validated;
}
