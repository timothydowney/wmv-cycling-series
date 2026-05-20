import { and, asc, count, desc, eq, isNotNull } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { getMany } from '../db/asyncQuery';
import { explorerDestination, explorerDestinationMatch, participant } from '../db/schema';

interface PopularDestinationView {
  id: number;
  displayLabel: string;
  completionCount: number;
  firstCompleterName: string | null;
  firstCompleterAthleteId: string | null;
}

interface RecentFirstCompletionView {
  destinationId: number;
  destinationLabel: string;
  athleteName: string;
  athleteId: string;
  completedAt: number;
}

function resolveDestinationLabel(destination: {
  strava_segment_id: string;
  display_label: string | null;
  cached_name: string | null;
  segment_name?: string | null;
}): string {
  return (
    destination.display_label ||
    destination.cached_name ||
    destination.segment_name ||
    `Segment ${destination.strava_segment_id}`
  );
}

export class ExplorerClubTabService {
  constructor(private readonly db: AppDatabase) {}

  async getPopularDestinations(campaignId: number, limit: number = 5): Promise<PopularDestinationView[]> {
    // Get destinations with completion counts
    const destWithCounts = await getMany<{
      id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      completion_count: number;
    }>(
      this.db
        .select({
          id: explorerDestination.id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          completion_count: count(explorerDestinationMatch.id).as('completion_count'),
        })
        .from(explorerDestination)
        .leftJoin(
          explorerDestinationMatch,
          and(
            eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id),
            eq(explorerDestinationMatch.explorer_campaign_id, explorerDestination.explorer_campaign_id)
          )
        )
        .where(eq(explorerDestination.explorer_campaign_id, campaignId))
        .groupBy(explorerDestination.id, explorerDestination.display_label, explorerDestination.cached_name, explorerDestination.strava_segment_id)
        .orderBy(desc(count(explorerDestinationMatch.id)), asc(explorerDestination.display_order))
        .limit(limit)
    );

    // Get first-completer info for these destinations
    const firstCompleters = await getMany<{
      explorer_destination_id: number;
      first_completer_athlete_id: string | null;
      participant_name: string | null;
    }>(
      this.db
        .select({
          explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
          first_completer_athlete_id: explorerDestinationMatch.first_completer_athlete_id,
          participant_name: participant.name,
        })
        .from(explorerDestinationMatch)
        .leftJoin(participant, eq(participant.strava_athlete_id, explorerDestinationMatch.first_completer_athlete_id))
        .where(
          and(
            eq(explorerDestinationMatch.explorer_campaign_id, campaignId),
            isNotNull(explorerDestinationMatch.first_completer_athlete_id)
          )
        )
    );

    // Map first-completers by destination ID
    const firstCompleterMap = new Map<
      number,
      { athleteId: string; name: string | null }
    >();
    for (const fc of firstCompleters) {
      if (fc.first_completer_athlete_id && !firstCompleterMap.has(fc.explorer_destination_id)) {
        firstCompleterMap.set(fc.explorer_destination_id, {
          athleteId: fc.first_completer_athlete_id,
          name: fc.participant_name,
        });
      }
    }

    // Combine results
    return destWithCounts.map((dest) => {
      const fc = firstCompleterMap.get(dest.id);
      return {
        id: dest.id,
        displayLabel: resolveDestinationLabel({
          strava_segment_id: dest.strava_segment_id,
          display_label: dest.display_label,
          cached_name: dest.cached_name,
        }),
        completionCount: Number(dest.completion_count),
        firstCompleterName: fc?.name ?? null,
        firstCompleterAthleteId: fc?.athleteId ?? null,
      };
    });
  }

  async getLeastPopularDestinations(campaignId: number, limit: number = 5): Promise<PopularDestinationView[]> {
    // Get destinations with completion counts
    const destWithCounts = await getMany<{
      id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      completion_count: number;
    }>(
      this.db
        .select({
          id: explorerDestination.id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          completion_count: count(explorerDestinationMatch.id).as('completion_count'),
        })
        .from(explorerDestination)
        .leftJoin(
          explorerDestinationMatch,
          and(
            eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id),
            eq(explorerDestinationMatch.explorer_campaign_id, explorerDestination.explorer_campaign_id)
          )
        )
        .where(eq(explorerDestination.explorer_campaign_id, campaignId))
        .groupBy(explorerDestination.id, explorerDestination.display_label, explorerDestination.cached_name, explorerDestination.strava_segment_id)
        .orderBy(asc(count(explorerDestinationMatch.id)), asc(explorerDestination.display_order))
        .limit(limit)
    );

    // Get first-completer info for these destinations
    const firstCompleters = await getMany<{
      explorer_destination_id: number;
      first_completer_athlete_id: string | null;
      participant_name: string | null;
    }>(
      this.db
        .select({
          explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
          first_completer_athlete_id: explorerDestinationMatch.first_completer_athlete_id,
          participant_name: participant.name,
        })
        .from(explorerDestinationMatch)
        .leftJoin(participant, eq(participant.strava_athlete_id, explorerDestinationMatch.first_completer_athlete_id))
        .where(
          and(
            eq(explorerDestinationMatch.explorer_campaign_id, campaignId),
            isNotNull(explorerDestinationMatch.first_completer_athlete_id)
          )
        )
    );

    // Map first-completers by destination ID
    const firstCompleterMap = new Map<
      number,
      { athleteId: string; name: string | null }
    >();
    for (const fc of firstCompleters) {
      if (fc.first_completer_athlete_id && !firstCompleterMap.has(fc.explorer_destination_id)) {
        firstCompleterMap.set(fc.explorer_destination_id, {
          athleteId: fc.first_completer_athlete_id,
          name: fc.participant_name,
        });
      }
    }

    // Combine results
    return destWithCounts.map((dest) => {
      const fc = firstCompleterMap.get(dest.id);
      return {
        id: dest.id,
        displayLabel: resolveDestinationLabel({
          strava_segment_id: dest.strava_segment_id,
          display_label: dest.display_label,
          cached_name: dest.cached_name,
        }),
        completionCount: Number(dest.completion_count),
        firstCompleterName: fc?.name ?? null,
        firstCompleterAthleteId: fc?.athleteId ?? null,
      };
    });
  }

  async getMostRecentFirstCompletions(campaignId: number, limit: number = 5): Promise<RecentFirstCompletionView[]> {
    const results = await getMany<{
      explorer_destination_id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      first_completer_athlete_id: string | null;
      participant_name: string | null;
      first_completer_at: number | null;
    }>(
      this.db
        .select({
          explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          first_completer_athlete_id: explorerDestinationMatch.first_completer_athlete_id,
          participant_name: participant.name,
          first_completer_at: explorerDestinationMatch.first_completer_at,
        })
        .from(explorerDestinationMatch)
        .innerJoin(explorerDestination, eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id))
        .leftJoin(participant, eq(participant.strava_athlete_id, explorerDestinationMatch.first_completer_athlete_id))
        .where(
          and(
            eq(explorerDestinationMatch.explorer_campaign_id, campaignId),
            isNotNull(explorerDestinationMatch.first_completer_at),
            isNotNull(explorerDestinationMatch.first_completer_athlete_id)
          )
        )
        .orderBy(desc(explorerDestinationMatch.first_completer_at))
        .limit(limit)
    );

    return results
      .filter((result) => result.first_completer_athlete_id && result.first_completer_at && result.participant_name)
      .map((result) => ({
        destinationId: result.explorer_destination_id,
        destinationLabel: resolveDestinationLabel({
          strava_segment_id: result.strava_segment_id,
          display_label: result.display_label,
          cached_name: result.cached_name,
        }),
        athleteName: result.participant_name!,
        athleteId: result.first_completer_athlete_id!,
        completedAt: result.first_completer_at!,
      }));
  }
}

export type { PopularDestinationView, RecentFirstCompletionView };
