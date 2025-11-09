# Season Data Management Scripts

These scripts allow you to export and import season and week configuration data, preserving your event setup without including participants or results.

## Export Season Data

Export current season, weeks, and segments to a JSON file:

```bash
# Export to default location (data/season-export.json)
npm run export:season

# Export to custom location
node scripts/export-season-data.js /path/to/output.json
```

**What gets exported:**
- Seasons (name, dates, active status)
- Weeks (name, date, segment, laps, time window)
- Segments (Strava segment IDs and names)

**What does NOT get exported:**
- Participants
- Activities
- Results
- OAuth tokens

## Import Season Data

Import season data from a JSON file (WARNING: This will DELETE existing weeks and seasons):

```bash
# Import from default location (data/season-export.json)
npm run import:season

# Import from custom location
node scripts/import-season-data.js /path/to/import.json
```

**What happens during import:**
1. Existing weeks, seasons, and segments are DELETED
2. Imported seasons, weeks, and segments are inserted
3. Participants and their results are PRESERVED

## Use Cases

### Backup Current Configuration
```bash
cd server
npm run export:season
cp data/season-export.json ../backups/season-backup-$(date +%Y%m%d).json
```

### Reset to Fresh Season
```bash
cd server
# Keep a backup first
npm run export:season
cp data/season-export.json data/season-backup.json

# Make your changes in the admin UI, then export again
npm run export:season

# To restore backup if needed
node scripts/import-season-data.js data/season-backup.json
```

### Share Configuration Between Environments
```bash
# On development machine
cd server
npm run export:season

# Commit the export file
git add data/season-export.json
git commit -m "chore: export production season configuration"

# On production server
git pull
cd server
npm run import:season
```

## File Format

The exported JSON file has this structure:

```json
{
  "exported_at": "2025-11-09T19:00:00.000Z",
  "seasons": [
    {
      "id": 1,
      "name": "Fall 2025",
      "start_date": "2025-11-01",
      "end_date": "2025-12-31",
      "is_active": 1
    }
  ],
  "weeks": [
    {
      "id": 1,
      "season_id": 1,
      "week_name": "Week 1: Box Hill KOM",
      "date": "2025-10-28",
      "required_laps": 1,
      "start_time": "2025-10-28T00:00",
      "end_time": "2025-10-28T22:00",
      "strava_segment_id": 16359964,
      "segment_name": "Box Hill KOM"
    }
  ],
  "segments": [
    {
      "id": 1,
      "strava_segment_id": 16359964,
      "name": "Box Hill KOM"
    }
  ]
}
```

## Safety Notes

- **Always backup before importing** - Import operations DELETE existing data
- The import preserves participants and their results
- You can manually edit the JSON file if needed
- Segment IDs are preserved to maintain consistency
