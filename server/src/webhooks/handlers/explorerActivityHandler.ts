import { ExplorerMatchingService } from '../../services/ExplorerMatchingService';
import { type ActivityWebhookHandler } from '../activityHandlerRunner';

export function createExplorerActivityHandler(): ActivityWebhookHandler {
  return {
    name: 'explorer',
    isolateErrors: true,
    async handle(context) {
      const activityData = await context.getActivityWithSegmentEfforts();
      if (!activityData) {
        return;
      }

      const explorerMatchingService = new ExplorerMatchingService(context.db);
      const result = await explorerMatchingService.matchActivity(activityData, context.athleteId);

      if (result.newMatches > 0) {
        console.log(
          `[Webhook:Explorer] Recorded ${result.newMatches} new Explorer destination matches for athlete ${context.athleteId}`
        );
      }
    },
  };
}