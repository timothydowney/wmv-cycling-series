# Admin Guide

## Managing Weekly Competitions

This guide covers how to manage the weekly competition schedule using the admin API endpoints.

## Competition Time Windows

Each weekly competition has a configurable time window during which activities must be completed. By default, this is:
- **Start:** Midnight (00:00:00 UTC) on the event date
- **End:** 10:00 PM (22:00:00 UTC) on the event date

This window can be customized per week to accommodate special events or different time zones.

## Creating a New Week

### Basic Example (Using Defaults)
Creates a week with midnight-to-10pm time window:

```bash
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 3: Lookout Mountain Triple",
    "date": "2025-11-19",
    "segment_id": 1,
    "required_laps": 3
  }'
```

**Response:**
```json
{
  "id": 3,
  "week_name": "Week 3: Lookout Mountain Triple",
  "date": "2025-11-19",
  "segment_id": 1,
  "required_laps": 3,
  "start_time": "2025-11-19T00:00:00Z",
  "end_time": "2025-11-19T22:00:00Z"
}
```

### Custom Time Window
For events with specific time requirements:

```bash
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 4: Sunrise Challenge",
    "date": "2025-11-26",
    "segment_id": 2,
    "required_laps": 1,
    "start_time": "2025-11-26T06:00:00Z",
    "end_time": "2025-11-26T12:00:00Z"
  }'
```

## Updating a Week

You can update any aspect of a week, including the time window:

```bash
curl -X PUT http://localhost:3001/admin/weeks/3 \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-11-19T07:00:00Z",
    "end_time": "2025-11-19T21:00:00Z",
    "required_laps": 5
  }'
```

Only the fields you provide will be updated. All fields are optional.

## Deleting a Week

**Warning:** This cascades and deletes all associated activities, segment efforts, and results.

```bash
curl -X DELETE http://localhost:3001/admin/weeks/3
```

**Response:**
```json
{
  "message": "Week deleted successfully",
  "weekId": 3
}
```

## Planning a Season Schedule

Since the competition doesn't run year-round, you can build out the entire schedule in advance:

### Example: Creating Multiple Weeks

```bash
# Week 1
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 1: Season Opener - Lookout Mountain",
    "date": "2025-11-05",
    "segment_id": 1,
    "required_laps": 1
  }'

# Week 2
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 2: Champs-Élysées Double",
    "date": "2025-11-12",
    "segment_id": 2,
    "required_laps": 2
  }'

# Week 3
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 3: Turkey Day Hill Repeats",
    "date": "2025-11-26",
    "segment_id": 1,
    "required_laps": 5
  }'
```

## Time Window Validation

When participants submit activities via `POST /weeks/:id/submit-activity`, the system automatically validates:

1. **Activity date is within the time window** - Must be between `start_time` and `end_time`
2. **Returns clear error messages** - Tells participants exactly when they can submit

### Example Validation

**Valid submission (within window):**
```bash
curl -X POST http://localhost:3001/weeks/1/submit-activity \
  -H "Content-Type: application/json" \
  -d '{
    "participant_id": 1,
    "strava_activity_id": 12345678,
    "activity_url": "https://www.strava.com/activities/12345678",
    "activity_date": "2025-11-05T10:00:00Z"
  }'
```

**Invalid submission (outside window):**
```bash
curl -X POST http://localhost:3001/weeks/1/submit-activity \
  -H "Content-Type: application/json" \
  -d '{
    "participant_id": 1,
    "strava_activity_id": 12345678,
    "activity_url": "https://www.strava.com/activities/12345678",
    "activity_date": "2025-11-05T23:00:00Z"
  }'
```

**Error response:**
```json
{
  "error": "Activity outside time window",
  "details": "Activity must be completed between 2025-11-05T00:00:00.000Z and 2025-11-05T22:00:00.000Z. Your activity was at 2025-11-05T23:00:00.000Z."
}
```

## Viewing the Schedule

List all weeks (most recent first):
```bash
curl http://localhost:3001/weeks
```

Get details for a specific week:
```bash
curl http://localhost:3001/weeks/1
```

## Best Practices

1. **Create weeks in advance** - Set up the entire season schedule so participants can plan ahead
2. **Use consistent time windows** - Stick to midnight-10pm unless there's a specific reason to change
3. **Clear naming** - Include the segment and lap requirement in the week name
4. **Time zone awareness** - All times are in UTC; make sure participants know their local time conversion
5. **Test before deleting** - Deleting a week removes all participant data for that week permanently

## Common Scenarios

### Extending the deadline
If you need to give participants more time:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"end_time": "2025-11-06T02:00:00Z"}'
```

### Changing the segment mid-week
If weather or conditions require switching segments:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"segment_id": 2}'
```

### Adding bonus laps
Make a week more challenging:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"required_laps": 3}'
```
