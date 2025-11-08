# Development Plan

This plan outlines the steps to build the Strava Competition Tracker application using React and TypeScript.

## Competition Rules & Scoring

### Weekly Competition Format
- **Frequency:** Every Tuesday
- **Objective:** Each week defines a specific Strava segment and required number of laps
- **Completion Requirement:** Participants must complete the objective on the designated Tuesday
- **Activity Tracking:** Each participant submits their Strava activity URL for validation

### Scoring System
1. **Completion:** Participant must ride the designated segment the required number of times within a single activity on the correct Tuesday
2. **Time Calculation:** Total time = sum of all segment efforts for that activity (e.g., if 2 laps required, sum both lap times)
3. **Ranking:** Participants are sorted by total time (fastest to slowest)
4. **Base Points:** Each participant receives **1 point for every other participant they beat**
   - Example: If 4 participants complete the objective and you finish 2nd, you beat 2 people = 2 base points
   - First place beats everyone else, last place beats no one (0 base points)
5. **PR Bonus:** If a participant sets a Personal Record (PR) on any segment effort during the week's activity, they receive **+1 bonus point**
   - Determined from Strava API response (pr_rank field)
   - Applies even if you finish last in the competition
6. **Total Points:** Base points + PR bonus points
7. **Season Leaderboard:** Sum of total points across all weeks

### Data Requirements
- **Week Definition:** Segment ID, date (Tuesday), number of required laps
- **Activity Submission:** Strava activity URL from each participant
- **Validation:**
  - Activity date matches week's Tuesday
  - Activity contains the required segment
  - Segment was completed the required number of times
  - Extract and sum segment effort times

## Credential Management

For local development, Strava API credentials (Client ID and Client Secret) are stored in `public/strava-credentials.json`. This file is included in `.gitignore` to prevent it from being committed to the repository. In a production environment, these credentials should be managed through environment variables or a secure secret management system.

## Milestones

1.  **Project Initialization (Done):**
    *   Clean up the old plain HTML/JS project.
    *   Initialize a new React + TypeScript project using Vite.
    *   Create a `README.md` and this `PLAN.md`.

2.  **Component Scaffolding and Data Migration (Done):**
    *   Install `strava-api-client`.
    *   Move the `data` directory to the `public` folder.
    *   Create the component file structure.
    *   Define data types/interfaces for our models.

3.  **Local Data Implementation (Done):**
    *   Refactor the application to lift state to the `App` component.
    *   Implement "dumb" components for rendering leaderboards and selectors.

4.  **Backend API (Done):**
    *   Set up Node 20 LTS environment with nvm.
    *   Create Express + SQLite backend in `server/`.
    *   Implement database schema (participants, segments, weeks, results).
    *   Auto-seed from existing JSON files.
    *   Create REST endpoints: `/participants`, `/segments`, `/weeks`, `/weeks/:id/leaderboard`.
    *   Update README with backend setup instructions.

5.  **Refined Data Model & Scoring (In Progress):**
    *   **Update schema** to track Strava activity URLs per participant per week.
    *   **Revise results table** to store individual segment efforts, not just aggregate time.
    *   **Implement correct scoring**: points = number of participants beaten.
    *   **Add validation** for activity date (must be on designated Tuesday).
    *   **Support multi-lap activities**: extract and sum segment efforts from single activity.

6.  **Strava Integration - Activity Validation (Next):**
    *   Implement OAuth2 flow in backend (secure token storage).
    *   Create endpoint to accept Strava activity URL submission.
    *   Fetch activity details via Strava API.
    *   Validate activity date matches week's Tuesday.
    *   Extract segment efforts for the designated segment.
    *   Calculate total time (sum of required laps).
    *   Store validated results in database.

7.  **Frontend - Activity Submission & Display:**
    *   Wire frontend to backend API endpoints.
    *   Create UI for admin to define weekly objectives.
    *   Create UI for participants to submit Strava activity URLs.
    *   Display validation status and errors.
    *   Show weekly and season leaderboards with correct scoring.

8.  **Data Management & Admin Tools:**
    *   Create forms for adding/editing participants.
    *   Create forms for adding/editing segments.
    *   Create form to set up new week (segment, date, laps).
    *   Allow admin to manually validate/reject submissions.
    *   Export/import functionality for backup.

