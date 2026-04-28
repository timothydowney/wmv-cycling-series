import { eq, desc } from 'drizzle-orm';
import { segment, week, Week } from '../../db/schema';
import { isoToUnix } from '../../dateUtils';
import { findBestQualifyingActivity } from '../../activityProcessor';
import { storeActivityAndEfforts } from '../../activityStorage';
import { type ActivityWebhookHandler } from '../activityHandlerRunner';
import { getMany } from '../../db/asyncQuery';

export function createCompetitionActivityHandler(): ActivityWebhookHandler {
  return {
    name: 'competition',
    async handle(context) {
      const activityData = await context.getActivityWithSegmentEfforts();

      if (!activityData) {
        return;
      }

      const activityUnix = isoToUnix(activityData.start_date);

      if (!activityUnix) {
        console.log(
          `[Webhook:Processor] Activity ${context.activityId} has invalid start date "${activityData.start_date}", skipping`
        );
        return;
      }

      const seasons = await context.validationService.getAllActiveSeasonsContainingTimestamp(activityUnix);

      if (seasons.length === 0) {
        console.log(
          `[Webhook:Processor] Activity ${context.activityId} timestamp ${activityUnix} not in any active season, skipping`
        );
        return;
      }

      console.log(
        `[Webhook:Processor] Activity ${context.activityId} matches ${seasons.length} season(s)`
      );

      let totalProcessedWeeks = 0;
      let totalMatchedWeeks = 0;

      for (const seasonRecord of seasons) {
        console.log(
          `[Webhook:Processor] Processing activity for season "${seasonRecord.name}" (ID: ${seasonRecord.id})`
        );

        const seasonStatus = context.validationService.isSeasonClosed(seasonRecord);
        if (seasonStatus.isClosed) {
          console.log(
            `[Webhook:Processor] Season "${seasonRecord.name}" is closed (ended ${new Date(seasonRecord.end_at * 1000).toISOString()}), skipping`
          );
          continue;
        }

        const weeks = await getMany<{
          id: number;
          week_name: string;
          strava_segment_id: string;
          required_laps: number;
          start_at: number;
          end_at: number;
          segment_name: string;
        }>(
          context.db
            .select({
              id: week.id,
              week_name: week.week_name,
              strava_segment_id: week.strava_segment_id,
              required_laps: week.required_laps,
              start_at: week.start_at,
              end_at: week.end_at,
              segment_name: segment.name
            })
            .from(week)
            .innerJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
            .where(eq(week.season_id, seasonRecord.id))
            .orderBy(desc(week.start_at))
        );

        let processedWeeks = 0;
        let matchedWeeks = 0;

        for (const weekRecord of weeks) {
          if (activityUnix < weekRecord.start_at || activityUnix > weekRecord.end_at) {
            continue;
          }

          processedWeeks++;
          console.log(
            `[Webhook:Processor] Checking week ${weekRecord.id} (${weekRecord.week_name}, segment: ${weekRecord.strava_segment_id})`
          );

          try {
            const bestActivity = await findBestQualifyingActivity(
              [activityData] as any,
              weekRecord.strava_segment_id,
              weekRecord.required_laps,
              context.accessToken,
              {
                start_at: weekRecord.start_at,
                end_at: weekRecord.end_at
              } as Pick<Week, 'start_at' | 'end_at'>
            );

            if (!bestActivity) {
              continue;
            }

            matchedWeeks++;
            console.log(
              `[Webhook:Processor] Activity ${context.activityId} qualifies for week ${weekRecord.id}`
            );

            await storeActivityAndEfforts(
              context.db,
              context.athleteId,
              weekRecord.id,
              {
                id: bestActivity.id,
                start_date: bestActivity.start_date,
                device_name: bestActivity.device_name || undefined,
                segmentEfforts: bestActivity.segmentEfforts as any,
                totalTime: bestActivity.totalTime,
                athleteWeight: context.athleteWeight
              },
              weekRecord.strava_segment_id
            );

            console.log(
              `[Webhook:Processor] ✓ Activity stored for week ${weekRecord.id}, time: ${Math.round(bestActivity.totalTime / 60)} min`
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(
              `[Webhook:Processor] Failed to process week ${weekRecord.id}: ${message}`
            );
          }
        }

        totalProcessedWeeks += processedWeeks;
        totalMatchedWeeks += matchedWeeks;

        console.log(
          `[Webhook:Processor] Season "${seasonRecord.name}": checked ${processedWeeks} weeks, matched ${matchedWeeks}`
        );
      }

      console.log(
        `[Webhook:Processor] ✓ Finished activity ${context.activityId}: checked ${totalProcessedWeeks} weeks across ${seasons.length} season(s), matched ${totalMatchedWeeks}`
      );
    }
  };
}