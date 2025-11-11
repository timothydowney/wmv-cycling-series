/**
 * Test Data Management Helpers
 * 
 * Provides reusable functions to create common test data structures.
 * Eliminates repetitive INSERT statements and makes tests easier to maintain.
 */

/**
 * Create a test participant with optional token
 * @param {Database} db - better-sqlite3 database instance
 * @param {number} stravaAthleteId - Strava athlete ID (required)
 * @param {string} name - Participant name (optional, defaults to generated)
 * @param {boolean|object} withToken - If true, creates default token. If object, uses custom token values { accessToken, refreshToken, expiresAt }
 * @returns {object} { participantId, stravaAthleteId, name }
 */
function createParticipant(db, stravaAthleteId, name = null, withToken = false) {
  const participantName = name || `Test User ${stravaAthleteId}`;
  
  db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
    .run(participantName, stravaAthleteId);
  
  if (withToken) {
    // Support both boolean and object for withToken
    let accessToken, refreshToken, expiresAt;
    
    if (typeof withToken === 'object') {
      accessToken = withToken.accessToken || `token_${stravaAthleteId}`;
      refreshToken = withToken.refreshToken || `refresh_${stravaAthleteId}`;
      expiresAt = withToken.expiresAt || (Math.floor(Date.now() / 1000) + 3600);
    } else {
      accessToken = `token_${stravaAthleteId}`;
      refreshToken = `refresh_${stravaAthleteId}`;
      expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    }
    
    db.prepare('INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
      .run(stravaAthleteId, accessToken, refreshToken, expiresAt);
  }
  
  return { stravaAthleteId, name: participantName };
}

/**
 * Create a test season
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} name - Season name (optional, defaults to 'Test Season')
 * @param {boolean} isActive - Whether season is active (default: true)
 * @param {object} options - Additional options { seasonId, ... }
 * @returns {object} { seasonId, name }
 */
function createSeason(db, name = 'Test Season', isActive = true, options = {}) {
  let result;
  if (options.seasonId) {
    result = db.prepare('INSERT INTO season (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)')
      .run(options.seasonId, name, '2025-01-01', '2025-12-31', isActive ? 1 : 0);
    return { seasonId: options.seasonId, name };
  } else {
    result = db.prepare('INSERT INTO season (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)')
      .run(name, '2025-01-01', '2025-12-31', isActive ? 1 : 0);
    return { seasonId: result.lastInsertRowid, name };
  }
}

/**
 * Create a test segment
 * @param {Database} db - better-sqlite3 database instance
 * @param {number} stravaSegmentId - Strava segment ID (required)
 * @param {string} name - Segment name (optional)
 * @param {object} options - Additional options { distance, averageGrade, city, state, country }
 * @returns {object} { stravaSegmentId, name }
 */
function createSegment(db, stravaSegmentId, name = null, options = {}) {
  const segmentName = name || `Segment ${stravaSegmentId}`;
  
  db.prepare('INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(stravaSegmentId, segmentName, options.distance || null, options.averageGrade || null, options.city || null, options.state || null, options.country || null);
  
  return { stravaSegmentId, name: segmentName };
}

/**
 * Create a test week
 * @param {Database} db - better-sqlite3 database instance
 * @param {object} options - Configuration
 *   - seasonId (required)
 *   - stravaSegmentId (required)
 *   - weekName (optional, default: 'Test Week')
 *   - date (optional, default: '2025-06-01')
 *   - requiredLaps (optional, default: 1)
 *   - startTime (optional, default: '2025-06-01T00:00:00Z')
 *   - endTime (optional, default: '2025-06-01T22:00:00Z')
 * @returns {object} { weekId, weekName, date, stravaSegmentId }
 */
function createWeek(db, options = {}) {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    date = '2025-06-01',
    requiredLaps = 1,
    startTime = '2025-06-01T00:00:00Z',
    endTime = '2025-06-01T22:00:00Z'
  } = options;
  
  if (!seasonId || !stravaSegmentId) {
    throw new Error('createWeek requires seasonId and stravaSegmentId');
  }
  
  const result = db.prepare(`
    INSERT INTO week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(seasonId, weekName, date, stravaSegmentId, requiredLaps, startTime, endTime);
  
  return { weekId: result.lastInsertRowid, weekName, date, stravaSegmentId };
}

/**
 * Create a test activity with segment efforts
 * @param {Database} db - better-sqlite3 database instance
 * @param {object} options - Configuration
 *   - weekId (required)
 *   - stravaAthleteId (required)
 *   - stravaActivityId (required)
 *   - stravaSegmentId (required - for segment_effort)
 *   - elapsedSeconds (optional, default: 1000)
 *   - prAchieved (optional, default: false)
 * @returns {object} { activityId, segmentEffortId, totalTime }
 */
function createActivity(db, options = {}) {
  const {
    weekId,
    stravaAthleteId,
    stravaActivityId,
    stravaSegmentId,
    elapsedSeconds = 1000,
    prAchieved = false
  } = options;
  
  if (!weekId || !stravaAthleteId || !stravaActivityId || !stravaSegmentId) {
    throw new Error('createActivity requires weekId, stravaAthleteId, stravaActivityId, and stravaSegmentId');
  }
  
  // Create activity
  const activityResult = db.prepare(`
    INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, validation_status)
    VALUES (?, ?, ?, ?)
  `).run(weekId, stravaAthleteId, stravaActivityId, 'valid');
  
  const activityId = activityResult.lastInsertRowid;
  
  // Create segment effort
  const effortResult = db.prepare(`
    INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, pr_achieved)
    VALUES (?, ?, ?, ?, ?)
  `).run(activityId, stravaSegmentId, 1, elapsedSeconds, prAchieved ? 1 : 0);
  
  return {
    activityId,
    segmentEffortId: effortResult.lastInsertRowid,
    totalTime: elapsedSeconds
  };
}

/**
 * Create a test result record
 * @param {Database} db - better-sqlite3 database instance
 * @param {object} options - Configuration
 *   - weekId (required)
 *   - stravaAthleteId (required)
 *   - activityId (optional)
 *   - totalTimeSeconds (optional, default: 1000)
 *   - rank (optional, default: 1)
 *   - points (optional, default: calculated from rank)
 * @returns {object} { resultId, rank, points }
 */
function createResult(db, options = {}) {
  const {
    weekId,
    stravaAthleteId,
    activityId = null,
    totalTimeSeconds = 1000,
    rank = 1,
    points = (5 - rank) + 1 // Default scoring: beat (5-rank) people + 1 for competing
  } = options;
  
  if (!weekId || !stravaAthleteId) {
    throw new Error('createResult requires weekId and stravaAthleteId');
  }
  
  const result = db.prepare(`
    INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds, rank, points, pr_bonus_points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(weekId, stravaAthleteId, activityId, totalTimeSeconds, rank, points, 0);
  
  return { resultId: result.lastInsertRowid, rank, points };
}

/**
 * Create a complete test user with all related data
 * Convenience function for common test scenario
 * @param {Database} db - better-sqlite3 database instance
 * @param {object} options - Configuration
 *   - stravaAthleteId (required)
 *   - name (optional, defaults to generated)
 *   - seasonName (optional)
 *   - weekName (optional)
 *   - stravaSegmentId (required for activity)
 *   - stravaActivityId (optional, default: auto-generated)
 * @returns {object} { participant, season, segment, week, activity, result }
 */
function createFullUserWithActivity(db, options = {}) {
  const {
    stravaAthleteId,
    name = `Test User ${stravaAthleteId}`,
    seasonName = 'Test Season',
    weekName = 'Test Week',
    stravaSegmentId = 99999,
    stravaActivityId = null
  } = options;
  
  if (!stravaAthleteId) {
    throw new Error('createFullUserWithActivity requires stravaAthleteId');
  }
  
  // Create all related records in order
  const participant = createParticipant(db, stravaAthleteId, name, true);
  const season = createSeason(db, seasonName, true);
  const segment = createSegment(db, stravaSegmentId);
  const week = createWeek(db, {
    seasonId: season.seasonId,
    stravaSegmentId,
    weekName
  });
  
  const activity = createActivity(db, {
    weekId: week.weekId,
    stravaAthleteId,
    stravaActivityId: stravaActivityId || `${stravaAthleteId}-activity-1`,
    stravaSegmentId
  });
  
  const result = createResult(db, {
    weekId: week.weekId,
    stravaAthleteId,
    activityId: activity.activityId
  });
  
  return {
    participant,
    season,
    segment,
    week,
    activity,
    result
  };
}

/**
 * Clear all test data (truncate all tables)
 * Useful for test cleanup
 * @param {Database} db - better-sqlite3 database instance
 */
function clearAllData(db) {
  db.exec(`
    DELETE FROM deletion_request;
    DELETE FROM segment_effort;
    DELETE FROM result;
    DELETE FROM activity;
    DELETE FROM participant_token;
    DELETE FROM participant;
    DELETE FROM week;
    DELETE FROM segment;
    DELETE FROM season;
  `);
}

/**
 * Create multiple participants at once
 * @param {Database} db - better-sqlite3 database instance
 * @param {number} count - Number of participants to create
 * @param {boolean} withTokens - If true, also create tokens (default: false)
 * @returns {array} Array of { stravaAthleteId, name } objects
 */
function createMultipleParticipants(db, count, withTokens = false) {
  const participants = [];
  for (let i = 1; i <= count; i++) {
    const athleteId = 1000000 + i;
    const participant = createParticipant(db, athleteId, `Test Participant ${i}`, withTokens);
    participants.push(participant);
  }
  return participants;
}

/**
 * Create a week with multiple activities and results
 * Convenience function for testing leaderboards
 * @param {Database} db - better-sqlite3 database instance
 * @param {object} options - Configuration
 *   - seasonId (required)
 *   - stravaSegmentId (required)
 *   - weekName (optional)
 *   - participantIds (optional, array of athlete IDs)
 *   - times (optional, array of times for ranking)
 * @returns {object} { weekId, activities, results }
 */
function createWeekWithResults(db, options = {}) {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    participantIds = [],
    times = []
  } = options;
  
  if (!seasonId || !stravaSegmentId) {
    throw new Error('createWeekWithResults requires seasonId and stravaSegmentId');
  }
  
  // Create the week
  const week = createWeek(db, {
    seasonId,
    stravaSegmentId,
    weekName
  });
  
  const activities = [];
  const results = [];
  
  // Create activity and result for each participant
  participantIds.forEach((athleteId, index) => {
    const totalTime = times[index] || (1000 * (index + 1)); // Default: 1000, 2000, 3000...
    
    const activity = createActivity(db, {
      weekId: week.weekId,
      stravaAthleteId: athleteId,
      stravaActivityId: `${athleteId}-week-${week.weekId}`,
      stravaSegmentId,
      elapsedSeconds: totalTime,
      prAchieved: index === 0 // First person gets PR
    });
    
    // Calculate rank based on time (lower time = better rank)
    const sortedIndex = times
      .slice(0, index + 1)
      .sort()
      .indexOf(totalTime);
    const rank = sortedIndex + 1;
    
    const result = createResult(db, {
      weekId: week.weekId,
      stravaAthleteId: athleteId,
      activityId: activity.activityId,
      totalTimeSeconds: totalTime,
      rank
    });
    
    activities.push(activity);
    results.push(result);
  });
  
  return { weekId: week.weekId, activities, results };
}

module.exports = {
  createParticipant,
  createMultipleParticipants,
  createSeason,
  createSegment,
  createWeek,
  createWeekWithResults,
  createActivity,
  createResult,
  createFullUserWithActivity,
  clearAllData
};
