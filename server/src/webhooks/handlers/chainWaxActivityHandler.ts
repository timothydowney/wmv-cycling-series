import { ChainWaxService } from '../../services/ChainWaxService';
import { type ActivityWebhookHandler } from '../activityHandlerRunner';

export function createChainWaxActivityHandler(): ActivityWebhookHandler {
  return {
    name: 'chain-wax',
    isolateErrors: true,
    async handle(context) {
      const { athleteId, activityId, activityData, db } = context;

      if (!ChainWaxService.isTrackedAthlete(athleteId) || activityData.type !== 'VirtualRide') {
        return;
      }

      const chainWaxService = new ChainWaxService(db);
      const activityStartUnix = activityData.start_date
        ? Math.floor(new Date(activityData.start_date).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      const recorded = chainWaxService.recordActivity(
        activityId,
        athleteId,
        activityData.distance || 0,
        activityStartUnix
      );

      if (recorded) {
        console.log(
          `[Webhook:Processor] ✓ Chain wax: recorded VirtualRide ${activityId} (${((activityData.distance || 0) / 1000).toFixed(1)}km) for athlete ${athleteId}`
        );
      } else {
        console.log(
          `[Webhook:Processor] Chain wax: VirtualRide ${activityId} already tracked or outside current period`
        );
      }
    }
  };
}