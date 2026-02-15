/**
 * ChatToolDefinitions.ts
 *
 * Defines the function declarations (tools) that Gemini can call
 * via its function calling API. Each tool has a name, description,
 * and parameter schema in the Gemini format.
 *
 * These definitions tell the AI what it can do — the actual execution
 * happens in ChatToolRunner.ts.
 */

import { FunctionDeclaration, Type } from '@google/genai';

/**
 * Get all tool definitions for the Gemini model
 */
export function getAllToolDefinitions(): FunctionDeclaration[] {
  return [
    // ── Season & Week Tools ──
    {
      name: 'list_seasons',
      description: 'List all competition seasons with their date ranges. Use this to find season IDs and names.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'get_current_season',
      description: 'Get the currently active season based on the current date. Returns the season that is currently running.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'get_season_weeks',
      description: 'Get all weeks in a season with segment details. Shows which segment was raced each week, whether it was a hill climb or time trial, dates, and required laps.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          season_id: {
            type: Type.NUMBER,
            description: 'The season ID to get weeks for',
          },
        },
        required: ['season_id'],
      },
    },
    {
      name: 'get_week_by_name_and_season',
      description: 'Find a specific week by segment name and optional season name using fuzzy matching. Use when the user refers to a week by its segment name like "Box Hill" or "Alpe du Zwift".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          week_name: {
            type: Type.STRING,
            description: 'The segment/week name to search for (fuzzy matched), e.g. "Box Hill", "Alpe du Zwift", "volcano"',
          },
          season_name: {
            type: Type.STRING,
            description: 'Optional season name to filter by, e.g. "Winter 2026", "Fall 2025"',
          },
        },
        required: ['week_name'],
      },
    },

    // ── Leaderboard & Scoring Tools ──
    {
      name: 'get_week_leaderboard',
      description: 'Get the full scored leaderboard for a specific week. Includes rank, name, total time, points breakdown (base, participation, PR bonus), multiplier, segment effort details like watts and heart rate, and activity date. This is the most detailed view of a single week\'s competition results.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          week_id: {
            type: Type.NUMBER,
            description: 'The week ID to get the leaderboard for',
          },
        },
        required: ['week_id'],
      },
    },
    {
      name: 'get_season_standings',
      description: 'Get the overall season standings from the LOCAL database showing cumulative points, weeks completed, and polka dot wins for each participant across the entire season. This is the primary tool for answering "who is leading" or "current standings" questions.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          season_id: {
            type: Type.NUMBER,
            description: 'The season ID to get standings for',
          },
        },
        required: ['season_id'],
      },
    },

    // ── Participant Tools ──
    {
      name: 'list_participants',
      description: 'List all participants in the competition with their weight and active status.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'get_participant_profile',
      description: 'Get detailed LOCAL profile for a participant from our database — includes career stats, season-by-season stats, best rankings, PRs, win streaks, and jersey wins. This is the primary tool for individual athlete information. Use fuzzy name matching.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          athlete_name: {
            type: Type.STRING,
            description: 'The participant name to look up (fuzzy matched). E.g. "Tim", "Tim Downey", "Ava"',
          },
        },
        required: ['athlete_name'],
      },
    },
    {
      name: 'get_participant_history',
      description: 'Get a participant\'s week-by-week results including rank, time, points, and PR status. Can be filtered to a specific season.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          athlete_name: {
            type: Type.STRING,
            description: 'The participant name (fuzzy matched)',
          },
          season_id: {
            type: Type.NUMBER,
            description: 'Optional season ID to filter results to a specific season',
          },
        },
        required: ['athlete_name'],
      },
    },

    // ── Effort & Performance Tools ──
    {
      name: 'get_effort_details',
      description: 'Get lap-by-lap effort breakdown for a specific participant in a specific week. Shows elapsed time, average watts, heart rate, cadence, and PR status for each lap.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          week_id: {
            type: Type.NUMBER,
            description: 'The week ID',
          },
          athlete_name: {
            type: Type.STRING,
            description: 'The participant name (fuzzy matched)',
          },
        },
        required: ['week_id', 'athlete_name'],
      },
    },
    {
      name: 'compare_athletes',
      description: 'Compare two or more athletes side by side. If a week_id is provided, compares their performance for that specific week. Otherwise compares their overall season stats.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          athlete_names: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Array of participant names to compare (fuzzy matched)',
          },
          week_id: {
            type: Type.NUMBER,
            description: 'Optional week ID to compare performance for a specific week',
          },
          season_id: {
            type: Type.NUMBER,
            description: 'Optional season ID for season-level comparison',
          },
        },
        required: ['athlete_names'],
      },
    },
    {
      name: 'get_watts_per_kg_ranking',
      description: 'Get watts/kg ranking for a specific week. Calculates average watts divided by athlete weight for each participant. Only includes participants with both power data and weight data available.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          week_id: {
            type: Type.NUMBER,
            description: 'The week ID to calculate watts/kg for',
          },
        },
        required: ['week_id'],
      },
    },

    // ── Analysis & Trends Tools ──
    {
      name: 'get_improvement_report',
      description: 'Analyze which participants improved the most recently. Compares times on the same segment across appearances to identify who is getting faster. Optionally filter to the last N weeks.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          season_id: {
            type: Type.NUMBER,
            description: 'The season ID to analyze',
          },
          last_n_weeks: {
            type: Type.NUMBER,
            description: 'Number of most recent weeks to analyze (default: all weeks in season)',
          },
        },
        required: ['season_id'],
      },
    },
    {
      name: 'get_segment_records',
      description: 'Get all-time best times on a specific segment across all seasons. Shows who holds the fastest time on that segment.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          segment_name: {
            type: Type.STRING,
            description: 'Segment name to search for (fuzzy matched), e.g. "Box Hill", "Alpe du Zwift"',
          },
        },
        required: ['segment_name'],
      },
    },
    {
      name: 'get_jersey_winners',
      description: 'Get the jersey award winners for a season. Yellow jersey goes to the rider with the most total points. Polka dot jersey goes to the rider with the most hill climb week wins.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          season_id: {
            type: Type.NUMBER,
            description: 'The season ID',
          },
        },
        required: ['season_id'],
      },
    },

    // ── Live Strava Tools (EXTERNAL API - rarely needed) ──
    {
      name: 'get_strava_recent_activities',
      description: 'Fetch recent Strava activities for a participant from the Strava API. Use this ONLY when the user explicitly asks about activities outside the competition scope (e.g., "what other rides has Tim done recently?" or "what did Sarah ride last week outside the race?"). For competition data (results, leaderboards, standings), use local database tools (get_week_leaderboard, get_season_standings, get_participant_profile, get_participant_history) which are faster and more complete.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          athlete_name: {
            type: Type.STRING,
            description: 'The participant name (fuzzy matched)',
          },
          days_back: {
            type: Type.NUMBER,
            description: 'Number of days to look back (default: 7, max: 30)',
          },
        },
        required: ['athlete_name'],
      },
    },
    {
      name: 'get_strava_athlete_profile',
      description: 'Fetch a participant profile from the Strava API for details like city, state, location, or FTP. Use this ONLY when the user explicitly asks about these specific Strava profile details. For competition stats (names, weights, performance data, season stats, rankings), use get_participant_profile or list_participants which have complete local data.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          athlete_name: {
            type: Type.STRING,
            description: 'The participant name (fuzzy matched)',
          },
        },
        required: ['athlete_name'],
      },
    },
  ];
}
