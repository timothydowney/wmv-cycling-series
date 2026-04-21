import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { participant } from '../../db/schema';
import {
  clearAllData,
  createExplorerCampaign,
  createExplorerDestination,
  createExplorerMatch,
  createExplorerPin,
  createParticipant,
  createSegment,
  setupTestDb,
  teardownTestDb,
} from '../testDataHelpers';

describe('explorerRouter', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    clearAllData(drizzleDb);
  });

  const getCaller = (athleteId?: string) => {
    const existingParticipant = athleteId
      ? drizzleDb
        .select({ stravaAthleteId: participant.strava_athlete_id })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId))
        .get()
      : null;

    if (athleteId && !existingParticipant) {
      createParticipant(drizzleDb, athleteId, 'Explorer Athlete');
    }

    return appRouter.createCaller(createContext({
      req: {
        session: {
          stravaAthleteId: athleteId,
        },
      } as any,
      res: {} as any,
      dbOverride: db,
      drizzleDbOverride: drizzleDb,
    }));
  };

  it('returns null when there is no active Explorer campaign', async () => {
    const caller = getCaller();
    await expect(caller.explorer.getActiveCampaign()).resolves.toBeNull();
  });

  it('returns the active campaign with ordered destinations and resolved labels', async () => {
    createSegment(drizzleDb, 'seg-401', 'Segment Name From DB');
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1748736000,
      endAt: 4102444799,
      displayName: 'Explorer Launch',
    });

    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-402',
      cachedName: 'Cached Name',
      displayOrder: 2,
    });
    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-401',
      displayLabel: 'Custom Label',
      displayOrder: 1,
    });

    const caller = getCaller();
    const result = await caller.explorer.getActiveCampaign();

    expect(result?.name).toBe('Explorer Launch');
    expect(result?.destinations).toHaveLength(2);
    expect(result?.destinations[0]).toMatchObject({
      stravaSegmentId: 'seg-401',
      displayLabel: 'Custom Label',
      displayOrder: 1,
    });
    expect(result?.destinations[1]).toMatchObject({
      stravaSegmentId: 'seg-402',
      displayLabel: 'Cached Name',
      displayOrder: 2,
    });
  });

  it('requires auth for getCampaignProgress', async () => {
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
    const caller = getCaller();
    await expect(caller.explorer.getCampaignProgress({ campaignId: campaign.id })).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires auth for pinning and unpinning', async () => {
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
    const destination = createExplorerDestination(drizzleDb, { explorerCampaignId: campaign.id, stravaSegmentId: 'seg-900' });
    const caller = getCaller();

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('UNAUTHORIZED');
    await expect(caller.explorer.unpinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns athlete progress for a campaign', async () => {
    createParticipant(drizzleDb, '3001', 'Progress Rider');
    createSegment(drizzleDb, 'seg-501', 'Forest Road');
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Weekless Explorer',
    });

    const completedDestination = createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-501',
      cachedName: 'Forest Road',
      displayOrder: 1,
    });
    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-502',
      cachedName: 'River Road',
      displayOrder: 2,
    });

    createExplorerMatch(drizzleDb, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: completedDestination.id,
      stravaAthleteId: '3001',
      stravaActivityId: 'activity-501',
    });

    const caller = getCaller('3001');
    const result = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });

    expect(result?.completedDestinations).toBe(1);
    expect(result?.totalDestinations).toBe(2);
    expect(result?.destinations[0]).toMatchObject({
      stravaSegmentId: 'seg-501',
      completed: true,
      pinned: false,
      stravaActivityId: 'activity-501',
      displayLabel: 'Forest Road',
    });
    expect(result?.destinations[1]).toMatchObject({
      stravaSegmentId: 'seg-502',
      completed: false,
      pinned: false,
      displayLabel: 'River Road',
    });
  });

  it('returns athlete pin state in campaign progress', async () => {
    createParticipant(drizzleDb, '3002', 'Pin Rider');
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Pinned Explorer',
    });

    const pinnedDestination = createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-601',
      cachedName: 'Pinned Road',
      displayOrder: 1,
    });
    const otherDestination = createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-602',
      cachedName: 'Other Road',
      displayOrder: 2,
    });

    createExplorerPin(drizzleDb, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: pinnedDestination.id,
      stravaAthleteId: '3002',
    });

    const caller = getCaller('3002');
    const result = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });

    expect(result?.destinations[0]).toMatchObject({ displayLabel: 'Pinned Road', pinned: true });
    expect(result?.destinations[1]).toMatchObject({ displayLabel: 'Other Road', pinned: false });
  });

  it('pins and unpins a destination for the authenticated athlete', async () => {
    const athleteId = '3003';
    createParticipant(drizzleDb, athleteId, 'Mutation Rider');
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Mutation Explorer',
    });
    const destination = createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-701',
      cachedName: 'Pin Target',
      displayOrder: 1,
    });

    const caller = getCaller(athleteId);

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).resolves.toEqual({ success: true });

    let progress = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });
    expect(progress?.destinations[0]?.pinned).toBe(true);

    await expect(caller.explorer.unpinDestination({ campaignId: campaign.id, destinationId: destination.id })).resolves.toEqual({ success: true });

    progress = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });
    expect(progress?.destinations[0]?.pinned).toBe(false);
  });

  it('rejects pinning a destination outside the campaign', async () => {
    const athleteId = '3004';
    createParticipant(drizzleDb, athleteId, 'Mismatch Rider');
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1751328000, endAt: 1751932799 });
    const otherCampaign = createExplorerCampaign(drizzleDb, { startAt: 1752000000, endAt: 1752600000 });
    const destination = createExplorerDestination(drizzleDb, { explorerCampaignId: otherCampaign.id, stravaSegmentId: 'seg-801' });

    const caller = getCaller(athleteId);

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('Destination not found for campaign');
  });
});