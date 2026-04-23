import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { participant } from '../db/schema';
import { type ActivityWebhookEvent, type StravaActivity } from './types';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { captureAthleteProfile } from '../services/StravaProfileCapture';
import ActivityValidationService from '../services/ActivityValidationService';
import {
  fetchWebhookActivity,
  hasWebhookActivityFixture,
  usesDeterministicWebhookActivityProvider,
} from '../services/webhookActivityProvider';

const MAX_ACTIVITY_FETCH_ATTEMPTS = 4;
const SEGMENT_EFFORT_BACKOFF_MS = [15000, 45000, 90000];

type ParticipantRecord = {
  strava_athlete_id: string;
  name: string | null;
};

export interface ActivityIngestionContext {
  db: BetterSQLite3Database;
  event: ActivityWebhookEvent;
  activityId: string;
  athleteId: string;
  participantRecord: ParticipantRecord;
  accessToken: string;
  athleteWeight: number | null;
  initialActivityData: StravaActivity;
  validationService: ActivityValidationService;
  getActivityWithSegmentEfforts: () => Promise<StravaActivity | null>;
}

function getSegmentEffortCount(activityData: StravaActivity | null | undefined): number {
  return Array.isArray(activityData?.segment_efforts) ? activityData.segment_efforts.length : 0;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchActivityWithSegmentEfforts(
  activityId: string,
  accessToken: string,
  initialActivityData: StravaActivity
): Promise<StravaActivity | null> {
  if (getSegmentEffortCount(initialActivityData) > 0) {
    console.log(
      `[Webhook:Processor] ✓ Found ${getSegmentEffortCount(initialActivityData)} segment efforts for activity ${activityId}`
    );
    return initialActivityData;
  }

  let activityData: StravaActivity = initialActivityData;
  let attempts = 1;

  while (attempts < MAX_ACTIVITY_FETCH_ATTEMPTS) {
    const waitTime = SEGMENT_EFFORT_BACKOFF_MS[attempts - 1];
    console.log(
      `[Webhook:Processor] Activity ${activityId} has no segment efforts yet, retrying in ${waitTime / 1000}s...`
    );
    await sleep(waitTime);

    console.log(
      `[Webhook:Processor] Fetching activity details for ID: ${activityId} (attempt ${attempts + 1}/${MAX_ACTIVITY_FETCH_ATTEMPTS})`
    );
    activityData = await fetchWebhookActivity(activityId, accessToken);

    if (getSegmentEffortCount(activityData) > 0) {
      console.log(
        `[Webhook:Processor] ✓ Found ${getSegmentEffortCount(activityData)} segment efforts for activity ${activityId}`
      );
      return activityData;
    }

    attempts++;
  }

  console.log(
    `[Webhook:Processor] Activity ${activityId} has no segment efforts after ${MAX_ACTIVITY_FETCH_ATTEMPTS} attempts, skipping`
  );

  return null;
}

export async function createActivityIngestionContext(
  event: ActivityWebhookEvent,
  db: BetterSQLite3Database,
  validationService: ActivityValidationService
): Promise<ActivityIngestionContext | null> {
  const activityId = String(event.object_id);
  const athleteId = String(event.owner_id);

  console.log('[Webhook:Processor] Activity event', {
    activityId,
    athleteId,
    aspect: event.aspect_type
  });

  const participantRecord = db
    .select({ strava_athlete_id: participant.strava_athlete_id, name: participant.name })
    .from(participant)
    .where(eq(participant.strava_athlete_id, athleteId))
    .get();

  if (!participantRecord) {
    console.log(`[Webhook:Processor] Participant ${athleteId} not found, skipping`);
    return null;
  }

  console.log(
    `[Webhook:Processor] Processing for ${participantRecord.name} (athlete ID: ${athleteId})`
  );

  const deterministicMode = usesDeterministicWebhookActivityProvider() || hasWebhookActivityFixture(activityId);
  const accessToken = deterministicMode
    ? 'fixture-token'
    : await getValidAccessToken(db, stravaClient, athleteId);
  const profileData = deterministicMode
    ? { weight: null }
    : await captureAthleteProfile(db, athleteId, accessToken);

  console.log(
    `[Webhook:Processor] Fetching activity details for ID: ${activityId} (attempt 1/${MAX_ACTIVITY_FETCH_ATTEMPTS})`
  );
  const initialActivityData = await fetchWebhookActivity(activityId, accessToken);

  let competitionActivityPromise: Promise<StravaActivity | null> | null = null;

  return {
    db,
    event,
    activityId,
    athleteId,
    participantRecord,
    accessToken,
    athleteWeight: profileData.weight,
    initialActivityData,
    validationService,
    getActivityWithSegmentEfforts: () => {
      if (!competitionActivityPromise) {
        competitionActivityPromise = fetchActivityWithSegmentEfforts(
          activityId,
          accessToken,
          initialActivityData
        );
      }

      return competitionActivityPromise;
    }
  };
}