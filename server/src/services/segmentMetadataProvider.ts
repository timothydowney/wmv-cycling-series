import { eq } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getStravaApiMode } from '../config';
import { participantToken } from '../db/schema';
import * as stravaClientModule from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { getFixtureSegmentMetadata, type SegmentMetadataPayload } from './segmentMetadataFixtures';

interface SegmentMetadataProvider {
  fetchSegmentMetadata(
    segmentId: string,
    context: string,
    preferredAthleteId?: string
  ): Promise<SegmentMetadataPayload | null>;
}

class LiveStravaSegmentMetadataProvider implements SegmentMetadataProvider {
  constructor(private readonly db: BetterSQLite3Database) {}

  async fetchSegmentMetadata(
    segmentId: string,
    context: string,
    preferredAthleteId?: string
  ): Promise<SegmentMetadataPayload | null> {
    let tokenRecord;

    if (preferredAthleteId) {
      tokenRecord = this.db
        .select({ strava_athlete_id: participantToken.strava_athlete_id })
        .from(participantToken)
        .where(eq(participantToken.strava_athlete_id, preferredAthleteId))
        .get();
    }

    if (!tokenRecord) {
      tokenRecord = this.db
        .select({ strava_athlete_id: participantToken.strava_athlete_id })
        .from(participantToken)
        .limit(1)
        .get();
    }

    if (!tokenRecord) {
      console.log(`[${context}] No connected participants, creating placeholder segment`);
      return null;
    }

    const accessToken = await getValidAccessToken(
      this.db,
      stravaClientModule,
      tokenRecord.strava_athlete_id
    );
    console.log(`[${context}] Fetching segment ${segmentId} from Strava API`);

    const stravaSegment = await stravaClientModule.getSegment(segmentId, accessToken);
    return stravaClientModule.mapStravaSegmentToSegmentRow(stravaSegment);
  }
}

class FixtureSegmentMetadataProvider implements SegmentMetadataProvider {
  async fetchSegmentMetadata(segmentId: string): Promise<SegmentMetadataPayload | null> {
    return getFixtureSegmentMetadata(segmentId);
  }
}

function createSegmentMetadataProvider(db: BetterSQLite3Database): SegmentMetadataProvider {
  const mode = getStravaApiMode();

  if (mode === 'fixture') {
    return new FixtureSegmentMetadataProvider();
  }

  if (mode === 'mock-server') {
    throw new Error(
      'STRAVA_API_MODE=mock-server is not implemented for segment metadata yet; use fixture or live'
    );
  }

  return new LiveStravaSegmentMetadataProvider(db);
}

export { createSegmentMetadataProvider };
export type { SegmentMetadataProvider, SegmentMetadataPayload };