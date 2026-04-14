export {
  createActivityIngestionContext,
  type ActivityIngestionContext
} from './activityContext';
export {
  runActivityHandlers,
  type ActivityWebhookHandler
} from './activityHandlerRunner';
export { createChainWaxActivityHandler } from './handlers/chainWaxActivityHandler';
export { createCompetitionActivityHandler } from './handlers/competitionActivityHandler';
export { createExplorerActivityHandler } from './handlers/explorerActivityHandler';

import { type ActivityWebhookHandler } from './activityHandlerRunner';
import { createChainWaxActivityHandler } from './handlers/chainWaxActivityHandler';
import { createCompetitionActivityHandler } from './handlers/competitionActivityHandler';
import { createExplorerActivityHandler } from './handlers/explorerActivityHandler';

export function createDefaultActivityHandlers(): ActivityWebhookHandler[] {
  return [
    createChainWaxActivityHandler(),
    createCompetitionActivityHandler(),
    createExplorerActivityHandler(),
  ];
}