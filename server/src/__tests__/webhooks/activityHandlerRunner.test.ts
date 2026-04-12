import {
  type ActivityIngestionContext,
  type ActivityWebhookHandler,
  runActivityHandlers
} from '../../webhooks/activityHandlers';

function createContext(): ActivityIngestionContext {
  return {
    db: {} as any,
    event: {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 123,
      owner_id: 456,
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 1
    },
    activityId: '123',
    athleteId: '456',
    participantRecord: { strava_athlete_id: '456', name: 'Test Rider' },
    accessToken: 'token',
    athleteWeight: null,
    initialActivityData: {
      id: '123',
      name: 'Test Activity',
      start_date: new Date().toISOString(),
      segment_efforts: []
    },
    validationService: {} as any,
    getActivityWithSegmentEfforts: async () => null
  };
}

describe('activityHandlerRunner', () => {
  it('runs handlers sequentially in registration order', async () => {
    const order: string[] = [];
    const context = createContext();
    const handlers: ActivityWebhookHandler[] = [
      {
        name: 'first',
        async handle() {
          order.push('first');
        }
      },
      {
        name: 'second',
        async handle() {
          order.push('second');
        }
      }
    ];

    await runActivityHandlers(context, handlers);

    expect(order).toEqual(['first', 'second']);
  });

  it('isolates handler errors when configured', async () => {
    const order: string[] = [];
    const context = createContext();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handlers: ActivityWebhookHandler[] = [
      {
        name: 'isolated',
        isolateErrors: true,
        async handle() {
          order.push('isolated');
          throw new Error('boom');
        }
      },
      {
        name: 'next',
        async handle() {
          order.push('next');
        }
      }
    ];

    await expect(runActivityHandlers(context, handlers)).resolves.toBeUndefined();
    expect(order).toEqual(['isolated', 'next']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Webhook:Processor] Handler isolated failed for activity 123',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('stops processing on non-isolated handler failures', async () => {
    const order: string[] = [];
    const context = createContext();
    const handlers: ActivityWebhookHandler[] = [
      {
        name: 'fatal',
        async handle() {
          order.push('fatal');
          throw new Error('fatal');
        }
      },
      {
        name: 'never-runs',
        async handle() {
          order.push('never-runs');
        }
      }
    ];

    await expect(runActivityHandlers(context, handlers)).rejects.toThrow('fatal');
    expect(order).toEqual(['fatal']);
  });
});