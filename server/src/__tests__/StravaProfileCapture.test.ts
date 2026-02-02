/**
 * StravaProfileCapture.test.ts
 * Tests for profile data capture from Strava API
 */

import { captureAthleteProfile } from '../services/StravaProfileCapture';
import { setupTestDb } from './setupTestDb';
import * as stravaClient from '../stravaClient';
import { participant } from '../db/schema';
import { eq } from 'drizzle-orm';

jest.mock('../stravaClient');

describe('StravaProfileCapture', () => {
  let db: any;
  let orm: any;

  beforeEach(() => {
    const setup = setupTestDb();
    db = setup.drizzleDb;
    orm = setup.orm;
    jest.clearAllMocks();
  });

  it('should capture and store athlete weight', async () => {
    const athleteId = '12345';
    const mockProfile = { weight: 70.5 };

    jest.spyOn(stravaClient, 'getAthleteProfile').mockResolvedValue(mockProfile as any);

    // Create participant first
    orm.insert(participant).values({
      strava_athlete_id: athleteId,
      name: 'Test Athlete'
    }).run();

    const result = await captureAthleteProfile(orm, athleteId, 'token');

    expect(result.weight).toBe(70.5);

    // Verify participant was updated
    const updated = orm.select().from(participant).where(eq(participant.strava_athlete_id, athleteId)).get();
    expect(updated.weight).toBe(70.5);
    expect(updated.weight_updated_at).toBeDefined();
  });

  it('should return null weight when athlete has no weight set (value: 0)', async () => {
    const athleteId = '12345';
    const mockProfile = { weight: 0 };

    jest.spyOn(stravaClient, 'getAthleteProfile').mockResolvedValue(mockProfile as any);

    orm.insert(participant).values({
      strava_athlete_id: athleteId,
      name: 'Test Athlete'
    }).run();

    const result = await captureAthleteProfile(orm, athleteId, 'token');

    expect(result.weight).toBeNull();
  });

  it('should return null weight and not update on API error', async () => {
    const athleteId = '12345';

    jest.spyOn(stravaClient, 'getAthleteProfile').mockRejectedValue(new Error('API Error'));

    orm.insert(participant).values({
      strava_athlete_id: athleteId,
      name: 'Test Athlete'
    }).run();

    const result = await captureAthleteProfile(orm, athleteId, 'token');

    expect(result.weight).toBeNull();

    // Verify participant was NOT updated
    const unchanged = orm.select().from(participant).where(eq(participant.strava_athlete_id, athleteId)).get();
    expect(unchanged.weight).toBeNull();
  });

  it('should handle missing weight field gracefully', async () => {
    const athleteId = '12345';
    const mockProfile = {}; // No weight field

    jest.spyOn(stravaClient, 'getAthleteProfile').mockResolvedValue(mockProfile as any);

    orm.insert(participant).values({
      strava_athlete_id: athleteId,
      name: 'Test Athlete'
    }).run();

    const result = await captureAthleteProfile(orm, athleteId, 'token');

    expect(result.weight).toBeNull();
  });
});
