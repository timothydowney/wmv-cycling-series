# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: This changelog was started at v0.9.0. For details on earlier versions (0.1.0 - 0.8.x),
> please refer to the [git commit history](https://github.com/tim-downey/strava-ncc-scrape/commits/main).

## [Unreleased]

## [0.9.0] - 2026-02-02

### Added
- **Watts per Kilogram (w/kg) Metric**: Display power-to-weight ratio on leaderboard cards for individual efforts and aggregated performance metrics
- **StravaProfileCapture Service**: Generic athlete profile data capture service from Strava API, designed for future extensibility
- Database schema migration to track athlete weight (participant table) and activity-level athlete weight (activity table)
- Unit tests for StravaProfileCapture service covering successful capture, missing weight, API errors, and graceful degradation
- Unit tests for activity storage with weight handling
- Weight data captured during both webhook-triggered and batch fetch activity ingestion
- Automatic weight update on participant table from Strava profile API

### Changed
- LeaderboardCard component now displays w/kg metric in expanded details when watts and weight data available
- ScoringService now includes athlete weight in scoring results
- LeaderboardService maps athlete weight to effort breakdown data
- ActivityToStore interface extended with optional athleteWeight field
- Activity validation response includes athlete weight for w/kg calculation

### Technical Details
- w/kg metric calculation: `average_watts / athlete_weight` (always metric, never converted by unit toggle)
- Weight captured from Strava API `/athlete` endpoint (`weight` field in kg)
- Only displays w/kg when `average_watts > 0` AND `athlete_weight > 0`
- Gracefully handles missing weight data (displays other metrics normally)
- All 567 unit tests passing, zero regressions

[Unreleased]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/tim-downey/strava-ncc-scrape/releases/tag/v0.9.0
