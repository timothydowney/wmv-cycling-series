import { and, asc, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { getMany } from '../db/asyncQuery';
import { explorerDestination, explorerDestinationMatch } from '../db/schema';

interface PopularDestinationView {
  id: number;
  displayLabel: string;
  completionCount: number;
  firstCompleterName: string | null;
}

interface RecentFirstCompletionView {
  destinationId: number;
  destinationLabel: string;
  athleteName: string;
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
    const results = await getMany<{
      id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      completion_count: number;
      first_completer_athlete_name: string | null;
    }>(
      this.db
        .select({
          id: explorerDestination.id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          completion_count: explorerDestination.completion_count,
          first_completer_athlete_name: explorerDestinationMatch.first_completer_athlete_name,
        })
        .from(explorerDestination)
        .leftJoin(
          explorerDestinationMatch,
          and(
            eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id),
            eq(explorerDestinationMatch.is_first_completer, true)
          )
        )
        .where(eq(explorerDestination.explorer_campaign_id, campaignId))
        .orderBy(desc(explorerDestination.completion_count), asc(explorerDestination.display_order))
        .limit(limit)
    );

    return results.map((result) => ({
      id: result.id,
      displayLabel: resolveDestinationLabel({
        strava_segment_id: result.strava_segment_id,
        display_label: result.display_label,
        cached_name: result.cached_name,
      }),
      completionCount: result.completion_count,
      firstCompleterName: result.first_completer_athlete_name,
    }));
  }

  async getLeastPopularDestinations(campaignId: number, limit: number = 5): Promise<PopularDestinationView[]> {
    const results = await getMany<{
      id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      completion_count: number;
      first_completer_athlete_name: string | null;
    }>(
      this.db
        .select({
          id: explorerDestination.id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          completion_count: explorerDestination.completion_count,
          first_completer_athlete_name: explorerDestinationMatch.first_completer_athlete_name,
        })
        .from(explorerDestination)
        .leftJoin(
          explorerDestinationMatch,
          and(
            eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id),
            eq(explorerDestinationMatch.is_first_completer, true)
          )
        )
        .where(eq(explorerDestination.explorer_campaign_id, campaignId))
        .orderBy(asc(explorerDestination.completion_count), asc(explorerDestination.display_order))
        .limit(limit)
    );

    return results.map((result) => ({
      id: result.id,
      displayLabel: resolveDestinationLabel({
        strava_segment_id: result.strava_segment_id,
        display_label: result.display_label,
        cached_name: result.cached_name,
      }),
      completionCount: result.completion_count,
      firstCompleterName: result.first_completer_athlete_name,
    }));
  }

  async getMostRecentFirstCompletions(campaignId: number, limit: number = 5): Promise<RecentFirstCompletionView[]> {
    const results = await getMany<{
      explorer_destination_id: number;
      display_label: string | null;
      cached_name: string | null;
      strava_segment_id: string;
      first_completer_athlete_name: string;
      first_completer_at: number;
    }>(
      this.db
        .select({
          explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          strava_segment_id: explorerDestination.strava_segment_id,
          first_completer_athlete_name: explorerDestinationMatch.first_completer_athlete_name,
          first_completer_at: explorerDestinationMatch.first_completer_at,
        })
        .from(explorerDestinationMatch)
        .innerJoin(explorerDestination, eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id))
        .where(
          and(
            eq(explorerDestinationMatch.explorer_campaign_id, campaignId),
            eq(explorerDestinationMatch.is_first_completer, true)
          )
        )
        .orderBy(desc(explorerDestinationMatch.first_completer_at))
        .limit(limit)
    );

    return results
      .filter((result) => result.first_completer_athlete_name)
      .map((result) => ({
        destinationId: result.explorer_destination_id,
        destinationLabel: resolveDestinationLabel({
          strava_segment_id: result.strava_segment_id,
          display_label: result.display_label,
          cached_name: result.cached_name,
        }),
        athleteName: result.first_completer_athlete_name!,
        completedAt: result.first_completer_at!,
      }));
  }
}

export type { PopularDestinationView, RecentFirstCompletionView };
