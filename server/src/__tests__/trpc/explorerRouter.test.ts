import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
import { eq } from 'drizzle-orm';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { explorerDestination, participant } from '../../db/schema';
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
  let pool: Pool;
  let orm: AppDatabase;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  beforeEach(async () => {
    await clearAllData(orm);
  });

  const getCaller = async (athleteId?: string) => {
    const existingParticipant = athleteId
      ? (await orm
        .select({ stravaAthleteId: participant.strava_athlete_id })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId)))[0]
      : null;

    if (athleteId && !existingParticipant) {
      await createParticipant(orm, athleteId, 'Explorer Athlete');
    }

    return appRouter.createCaller(() => createContext({
      req: {
        session: {
          stravaAthleteId: athleteId,
        },
      } as any,
      res: {} as any,
      dbOverride: pool,
      ormOverride: orm,
    }));
  };

  it('returns null when there is no active Explorer campaign', async () => {
    const caller = await getCaller();
    await expect(caller.explorer.getActiveCampaign()).resolves.toBeNull();
  });

  it('returns the active campaign with ordered destinations and resolved labels', async () => {
    await createSegment(orm, 'seg-401', 'Segment Name From DB');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 4102444799,
      displayName: 'Explorer Launch',
    });

    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-402',
      cachedName: 'Cached Name',
      displayOrder: 2,
    });
    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-401',
      displayLabel: 'Custom Label',
      displayOrder: 1,
    });

    const caller = await getCaller();
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
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller();
    await expect(caller.explorer.getCampaignProgress({ campaignId: campaign.id })).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires auth for pinning and unpinning', async () => {
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const destination = await createExplorerDestination(orm, { explorerCampaignId: campaign.id, stravaSegmentId: 'seg-900' });
    const caller = await getCaller();

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('UNAUTHORIZED');
    await expect(caller.explorer.unpinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns athlete progress for a campaign', async () => {
    await createParticipant(orm, '3001', 'Progress Rider');
    await createSegment(orm, 'seg-501', 'Forest Road');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Weekless Explorer',
    });

    const completedDestination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-501',
      cachedName: 'Forest Road',
      displayOrder: 1,
    });
    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-502',
      cachedName: 'River Road',
      displayOrder: 2,
    });

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: completedDestination.id,
      stravaAthleteId: '3001',
      stravaActivityId: 'activity-501',
    });

    const caller = await getCaller('3001');
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
    await createParticipant(orm, '3002', 'Pin Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Pinned Explorer',
    });

    const pinnedDestination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-601',
      cachedName: 'Pinned Road',
      displayOrder: 1,
    });
    const otherDestination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-602',
      cachedName: 'Other Road',
      displayOrder: 2,
    });

    await createExplorerPin(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: pinnedDestination.id,
      stravaAthleteId: '3002',
    });

    const caller = await getCaller('3002');
    const result = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });

    expect(result?.destinations[0]).toMatchObject({ displayLabel: 'Pinned Road', pinned: true });
    expect(result?.destinations[1]).toMatchObject({ displayLabel: 'Other Road', pinned: false });
  });

  it('pins and unpins a destination for the authenticated athlete', async () => {
    const athleteId = '3003';
    await createParticipant(orm, athleteId, 'Mutation Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Mutation Explorer',
    });
    const destination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-701',
      cachedName: 'Pin Target',
      displayOrder: 1,
    });

    const caller = await getCaller(athleteId);

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).resolves.toEqual({ success: true });

    let progress = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });
    expect(progress?.destinations[0]?.pinned).toBe(true);

    await expect(caller.explorer.unpinDestination({ campaignId: campaign.id, destinationId: destination.id })).resolves.toEqual({ success: true });

    progress = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });
    expect(progress?.destinations[0]?.pinned).toBe(false);
  });

  it('rejects pinning a destination outside the campaign', async () => {
    const athleteId = '3004';
    await createParticipant(orm, athleteId, 'Mismatch Rider');
    const campaign = await createExplorerCampaign(orm, { startAt: 1751328000, endAt: 1751932799 });
    const otherCampaign = await createExplorerCampaign(orm, { startAt: 1752000000, endAt: 1752600000 });
    const destination = await createExplorerDestination(orm, { explorerCampaignId: otherCampaign.id, stravaSegmentId: 'seg-801' });

    const caller = await getCaller(athleteId);

    await expect(caller.explorer.pinDestination({ campaignId: campaign.id, destinationId: destination.id })).rejects.toThrow('Destination not found for campaign');
  });

  it('returns popular and least-popular destinations ordered by completion_count and display_order', async () => {
    await createParticipant(orm, '4101', 'Alex');

    const campaign = await createExplorerCampaign(orm, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Club Metrics',
    });

    const destinationOne = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-910',
      cachedName: 'North Climb',
      displayOrder: 1,
    });
    const destinationTwo = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-911',
      cachedName: 'East Roll',
      displayOrder: 2,
    });
    const destinationThree = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-912',
      cachedName: 'Valley Ramp',
      displayOrder: 3,
    });

    await orm.update(explorerDestination).set({ completion_count: 8 }).where(eq(explorerDestination.id, destinationOne.id));
    await orm.update(explorerDestination).set({ completion_count: 2 }).where(eq(explorerDestination.id, destinationTwo.id));
    await orm.update(explorerDestination).set({ completion_count: 2 }).where(eq(explorerDestination.id, destinationThree.id));

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: destinationOne.id,
      stravaAthleteId: '4101',
      stravaActivityId: 'activity-910',
      matchedAt: 1751414400,
      isFirstCompleter: true,
      firstCompleterAthleteId: '4101',
      firstCompleterAthleteName: 'Alex',
      firstCompleterAt: 1751414400,
    });

    const caller = await getCaller();
    const popular = await caller.explorer.getPopularDestinations({ campaignId: campaign.id, limit: 3 });
    const leastPopular = await caller.explorer.getLeastPopularDestinations({ campaignId: campaign.id, limit: 3 });

    expect(popular.map((destination) => destination.displayLabel)).toEqual(['North Climb', 'East Roll', 'Valley Ramp']);
    expect(popular.map((destination) => destination.completionCount)).toEqual([8, 2, 2]);
    expect(popular[0]?.firstCompleterName).toBe('Alex');

    expect(leastPopular.map((destination) => destination.displayLabel)).toEqual(['East Roll', 'Valley Ramp', 'North Climb']);
    expect(leastPopular.map((destination) => destination.completionCount)).toEqual([2, 2, 8]);
  });

  it('returns most recent first completions in descending completion time order', async () => {
    await createParticipant(orm, '4201', 'Casey');
    await createParticipant(orm, '4202', 'Jordan');

    const campaign = await createExplorerCampaign(orm, {
      startAt: 1751328000,
      endAt: 1751932799,
      displayName: 'Recent Firsts',
    });

    const destinationOne = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-920',
      cachedName: 'Town Sprint',
      displayOrder: 1,
    });
    const destinationTwo = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-921',
      cachedName: 'Forest Climb',
      displayOrder: 2,
    });

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: destinationOne.id,
      stravaAthleteId: '4201',
      stravaActivityId: 'activity-920',
      matchedAt: 1751500000,
      isFirstCompleter: true,
      firstCompleterAthleteId: '4201',
      firstCompleterAthleteName: 'Casey',
      firstCompleterAt: 1751500000,
    });

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: destinationTwo.id,
      stravaAthleteId: '4202',
      stravaActivityId: 'activity-921',
      matchedAt: 1751600000,
      isFirstCompleter: true,
      firstCompleterAthleteId: '4202',
      firstCompleterAthleteName: 'Jordan',
      firstCompleterAt: 1751600000,
    });

    const caller = await getCaller();
    const recentFirstCompletions = await caller.explorer.getMostRecentFirstCompletions({ campaignId: campaign.id, limit: 5 });

    expect(recentFirstCompletions).toHaveLength(2);
    expect(recentFirstCompletions[0]).toMatchObject({
      destinationId: destinationTwo.id,
      destinationLabel: 'Forest Climb',
      athleteName: 'Jordan',
      completedAt: 1751600000,
    });
    expect(recentFirstCompletions[1]).toMatchObject({
      destinationId: destinationOne.id,
      destinationLabel: 'Town Sprint',
      athleteName: 'Casey',
      completedAt: 1751500000,
    });
  });
});