import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  explorerDestination,
  explorerDestinationMatch,
  explorerWeek,
  segment,
} from '../db/schema';

interface ExplorerDestinationView {
  id: number;
  stravaSegmentId: string;
  displayLabel: string;
  sourceUrl: string | null;
  surfaceType: string | null;
  category: string | null;
  displayOrder: number;
}

interface ActiveExplorerWeekView {
  id: number;
  name: string;
  startAt: number;
  endAt: number;
  status: string;
  destinations: ExplorerDestinationView[];
}

interface ExplorerProgressDestinationView extends ExplorerDestinationView {
  completed: boolean;
  matchedAt: number | null;
  stravaActivityId: string | null;
}

interface ExplorerWeekProgressView {
  week: {
    id: number;
    name: string;
    startAt: number;
    endAt: number;
    status: string;
  };
  completedDestinations: number;
  totalDestinations: number;
  destinations: ExplorerProgressDestinationView[];
}

function resolveDestinationLabel(destination: {
  strava_segment_id: string;
  display_label: string | null;
  cached_segment_name: string | null;
  segment_name: string | null;
}): string {
  return (
    destination.display_label ||
    destination.cached_segment_name ||
    destination.segment_name ||
    `Segment ${destination.strava_segment_id}`
  );
}

export class ExplorerQueryService {
  constructor(private readonly db: BetterSQLite3Database) {}

  async getActiveWeek(nowTimestamp: number = Math.floor(Date.now() / 1000)): Promise<ActiveExplorerWeekView | null> {
    const weekRecord = this.db
      .select()
      .from(explorerWeek)
      .where(
        and(
          eq(explorerWeek.status, 'active'),
          lte(explorerWeek.start_at, nowTimestamp),
          gte(explorerWeek.end_at, nowTimestamp)
        )
      )
      .orderBy(desc(explorerWeek.start_at))
      .get();

    if (!weekRecord) {
      return null;
    }

    const destinations = this.db
      .select({
        id: explorerDestination.id,
        strava_segment_id: explorerDestination.strava_segment_id,
        display_label: explorerDestination.display_label,
        cached_segment_name: explorerDestination.cached_segment_name,
        source_url: explorerDestination.source_url,
        surface_type: explorerDestination.surface_type,
        category: explorerDestination.category,
        display_order: explorerDestination.display_order,
        segment_name: segment.name,
      })
      .from(explorerDestination)
      .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
      .where(eq(explorerDestination.explorer_week_id, weekRecord.id))
      .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
      .all();

    return {
      id: weekRecord.id,
      name: weekRecord.name,
      startAt: weekRecord.start_at,
      endAt: weekRecord.end_at,
      status: weekRecord.status,
      destinations: destinations.map((destination) => ({
        id: destination.id,
        stravaSegmentId: destination.strava_segment_id,
        displayLabel: resolveDestinationLabel(destination),
        sourceUrl: destination.source_url,
        surfaceType: destination.surface_type,
        category: destination.category,
        displayOrder: destination.display_order,
      })),
    };
  }

  async getWeekProgress(
    explorerWeekId: number,
    athleteId: string
  ): Promise<ExplorerWeekProgressView | null> {
    const weekRecord = this.db
      .select()
      .from(explorerWeek)
      .where(eq(explorerWeek.id, explorerWeekId))
      .get();

    if (!weekRecord) {
      return null;
    }

    const destinations = this.db
      .select({
        id: explorerDestination.id,
        strava_segment_id: explorerDestination.strava_segment_id,
        display_label: explorerDestination.display_label,
        cached_segment_name: explorerDestination.cached_segment_name,
        source_url: explorerDestination.source_url,
        surface_type: explorerDestination.surface_type,
        category: explorerDestination.category,
        display_order: explorerDestination.display_order,
        segment_name: segment.name,
      })
      .from(explorerDestination)
      .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
      .where(eq(explorerDestination.explorer_week_id, explorerWeekId))
      .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
      .all();

    const matches = this.db
      .select({
        explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
        matched_at: explorerDestinationMatch.matched_at,
        strava_activity_id: explorerDestinationMatch.strava_activity_id,
      })
      .from(explorerDestinationMatch)
      .where(
        and(
          eq(explorerDestinationMatch.explorer_week_id, explorerWeekId),
          eq(explorerDestinationMatch.strava_athlete_id, athleteId)
        )
      )
      .all();

    const matchesByDestinationId = new Map(matches.map((match) => [match.explorer_destination_id, match]));

    const progressDestinations = destinations.map((destination) => {
      const match = matchesByDestinationId.get(destination.id);

      return {
        id: destination.id,
        stravaSegmentId: destination.strava_segment_id,
        displayLabel: resolveDestinationLabel(destination),
        sourceUrl: destination.source_url,
        surfaceType: destination.surface_type,
        category: destination.category,
        displayOrder: destination.display_order,
        completed: Boolean(match),
        matchedAt: match?.matched_at || null,
        stravaActivityId: match?.strava_activity_id || null,
      };
    });

    return {
      week: {
        id: weekRecord.id,
        name: weekRecord.name,
        startAt: weekRecord.start_at,
        endAt: weekRecord.end_at,
        status: weekRecord.status,
      },
      completedDestinations: progressDestinations.filter((destination) => destination.completed).length,
      totalDestinations: progressDestinations.length,
      destinations: progressDestinations,
    };
  }
}

export type { ActiveExplorerWeekView, ExplorerWeekProgressView };