# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: This changelog was started at v0.9.0. For details on earlier versions (0.1.0 - 0.8.x),
> please refer to the [git commit history](https://github.com/tim-downey/strava-ncc-scrape/commits/main).

## [Unreleased]

## [0.10.0] - 2026-02-02

### Added
- **Profile Page Redesign**: Comprehensive Career Highlights grid displaying lifetime best rankings, peak power output, PRs, and win streaks.
- **Season Stats Cards**: New full-width season cards with horizontal layout for Current Season and Palmarès sections. Displays total points, weeks participated, best TT/HC weekly rankings, and win counts.
- **Season Champion Badges**: Prominent display of overall season wins and hill climb victories with large circular badge styling.
- Responsive grid improvements for Career Highlights (4 columns on desktop, 3 on tablet, 2 on mobile).

### Changed
- Profile header now centered with cleaner, less cluttered appearance.
- Consolidated all season stats under unified visual style matching Career Highlights aesthetic.
- Removed status indicators and moved participation totals into main stats grid.

## [0.9.0] - 2026-02-02

### Added
- **Watts per Kilogram (w/kg) Metric**: Display power-to-weight ratio on leaderboard cards. Captured from Strava API during activity ingestion. Only displays when both watts and weight data are available. Unit-agnostic (always shown in w/kg regardless of imperial/metric preference).

[Unreleased]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/tim-downey/strava-ncc-scrape/releases/tag/v0.9.0
