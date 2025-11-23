/**
 * Webhook Event Queue
 *
 * Processes webhook events sequentially (concurrency=1) to avoid race conditions
 * with scoring calculations. Events are stored with retry logic.
 */

import { Database } from 'better-sqlite3';

export interface QueuedEvent {
  id?: number;
  event_data: {
    aspect_type: string;
    object_type: string;
    object_id: number;
    owner_id: number;
    subscription_id?: number;
    event_time?: number;
  };
  payload?: string;
  retry_count: number;
  max_retries: number;
  created_at?: string;
}

export type EventProcessor = (event: QueuedEvent, db: Database) => Promise<void>;

/**
 * Simple sequential event queue with retry support
 * Uses Node.js Promise queue pattern (no external dependencies)
 */
export class WebhookEventQueue {
  private db: Database;
  private isProcessing = false;
  private queue: QueuedEvent[] = [];
  private processor: EventProcessor;

  constructor(db: Database, processor: EventProcessor) {
    this.db = db;
    this.processor = processor;
  }

  /**
   * Add an event to the queue for processing
   */
  async enqueue(event: QueuedEvent): Promise<void> {
    event.retry_count = event.retry_count || 0;
    event.max_retries = event.max_retries || 3;

    this.queue.push(event);
    console.log(`[WebhookQueue] Event queued (queue length: ${this.queue.length})`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process all queued events sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift();

      if (!event) {
        break;
      }

      try {
        console.log(`[WebhookQueue] Processing event (remaining: ${this.queue.length})`);
        await this.processor(event, this.db);
      } catch (error) {
        // Processor handles its own retries
        // If it throws, the event is already marked as failed in DB
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[WebhookQueue] Event processing failed: ${message}`);
      }
    }

    this.isProcessing = false;
    console.log('[WebhookQueue] Queue processing complete');
  }

  /**
   * Get current queue length (for monitoring)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isProcessingNow(): boolean {
    return this.isProcessing;
  }
}
