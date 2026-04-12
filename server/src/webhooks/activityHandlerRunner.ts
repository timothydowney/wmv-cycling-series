import { type ActivityIngestionContext } from './activityContext';

export interface ActivityWebhookHandler {
  name: string;
  isolateErrors?: boolean;
  handle: (context: ActivityIngestionContext) => Promise<void>;
}

export async function runActivityHandlers(
  context: ActivityIngestionContext,
  handlers: ActivityWebhookHandler[]
): Promise<void> {
  for (const handler of handlers) {
    try {
      await handler.handle(context);
    } catch (error) {
      if (handler.isolateErrors) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[Webhook:Processor] Handler ${handler.name} failed for activity ${context.activityId}: ${message}`
        );
        continue;
      }

      throw error;
    }
  }
}