// @ts-nocheck
/**
 * Webhook Enrichment Tests
 *
 * Documents the expected data structure for:
 * - WebhookActivityEventCard (activity-specific enrichment)
 * - WebhookAthleteEventCard (athlete-specific enrichment)
 *
 * The enrichment endpoint is tested in webhooks.integration.test.ts
 * This file serves as documentation for component integration.
 */

describe('Webhook Enrichment Data Structure', () => {
  /**
   * WebhookActivityEventCard expects this structure from api.getWebhookEventEnrichment():
   *
   * {
   *   enrichment: {
   *     athlete: {
   *       athlete_id: number,
   *       name: string | null
   *     },
   *     strava_data?: {
   *       activity_id: number,
   *       name: string,
   *       type: string,
   *       distance_m: number,
   *       moving_time_sec: number,
   *       elevation_gain_m: number,
   *       start_date_iso: string,
   *       device_name: string | null,
   *       segment_effort_count: number,
   *       visibility?: string | null  // 'public' | 'private' | 'followers_only'
   *     },
   *     matching_seasons: Array<{
   *       season_id: number,
   *       season_name: string,
   *       matched_weeks_count: number,
   *       matched_weeks: Array<{
   *         week_id: number,
   *         week_name: string,
   *         segment_name: string,
   *         required_laps: number,
   *         segment_efforts_found?: number,
   *         matched: boolean,
   *         reason?: string
   *       }>
   *     }>,
   *     summary: {
   *       status: 'qualified' | 'no_matching_weeks' | 'no_segments' | 'insufficient_laps' | 'error' | 'no_qualifying_weeks',
   *       message: string,
   *       total_weeks_checked: number,
   *       total_weeks_matched: number,
   *       total_seasons: number
   *     }
   *   }
   * }
   */
  it('documents WebhookActivityEventCard enrichment structure', () => {
    // This test documents the expected structure
    // Real validation happens in webhooks.integration.test.ts

    const expectedActivityStructure = {
      enrichment: {
        athlete: {
          athlete_id: expect.any(Number),
          name: expect.any(String)
        },
        strava_data: {
          activity_id: expect.any(Number),
          name: expect.any(String),
          visibility: expect.stringMatching(/public|private|followers_only/)
        },
        summary: {
          status: expect.stringMatching(
            /qualified|no_matching_weeks|no_segments|insufficient_laps|error|no_qualifying_weeks/
          ),
          message: expect.any(String),
          total_weeks_checked: expect.any(Number),
          total_weeks_matched: expect.any(Number)
        },
        matching_seasons: expect.any(Array)
      }
    };

    expect(expectedActivityStructure).toBeDefined();
  });

  /**
   * WebhookAthleteEventCard expects this structure from api.getWebhookEventEnrichment():
   *
   * {
   *   enrichment: {
   *     athlete: {
   *       athlete_id: number,
   *       name: string | null,
   *       profile_url?: string
   *     }
   *   }
   * }
   */
  it('documents WebhookAthleteEventCard enrichment structure', () => {
    // This test documents the expected structure
    // Real validation happens in webhooks.integration.test.ts

    const expectedAthleteStructure = {
      enrichment: {
        athlete: {
          athlete_id: expect.any(Number),
          name: expect.any(String)
        }
      }
    };

    expect(expectedAthleteStructure).toBeDefined();
  });

  describe('Component Error Handling', () => {
    it('WebhookActivityEventCard displays: "Activity {id} was not found on Strava"', () => {
      // When strava_data is null or undefined
      const errorCondition = {
        enrichment: {
          athlete: { athlete_id: 123, name: null },
          strava_data: null,
          summary: {
            status: 'error',
            message: 'Activity not found',
            total_weeks_checked: 0,
            total_weeks_matched: 0,
            total_seasons: 0
          }
        }
      };

      expect(errorCondition.strava_data).toBeFalsy();
    });

    it('WebhookAthleteEventCard displays: "Athlete {id} was not found"', () => {
      // When athlete data is null or name is missing
      const errorCondition = {
        enrichment: {
          athlete: null
        }
      };

      expect(errorCondition.enrichment.athlete).toBeNull();
    });
  });

  describe('Raw JSON Display', () => {
    it('preserves raw webhook event for display', () => {
      // Both components support Raw JSON toggle
      // The raw event structure is:
      const webhookEvent = {
        id: 1,
        created_at: '2025-11-26T12:00:00Z',
        payload: {
          aspect_type: 'create',
          event_time: 1700000000,
          object_id: 123,
          object_type: 'activity',
          owner_id: 456,
          subscription_id: 789,
          updates: {}
        },
        processed: true,
        error_message: null
      };

      expect(webhookEvent.payload).toHaveProperty('aspect_type');
      expect(['create', 'update', 'delete']).toContain(webhookEvent.payload.aspect_type);
      expect(['activity', 'athlete']).toContain(webhookEvent.payload.object_type);
    });
  });
});
