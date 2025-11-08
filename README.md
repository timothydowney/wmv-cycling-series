# Strava NCC Scrape

This project is a web application to track participants and points for **Western Mass Velo**'s weekly cycling competition. It calculates scores, displays weekly and season-long leaderboards, and integrates with the Strava API to validate activity submissions.

## Competition Overview

### Weekly Format
- **When:** Every Tuesday (configurable time window, typically midnight-10pm)
- **What:** Complete a designated Strava segment a specified number of times
- **How:** Participants submit their Strava activity URL for that Tuesday
- **Scoring:**
  - **Base points:** Earn 1 point for every participant you beat (based on total time)
  - **PR Bonus:** Earn +1 bonus point if you set a Personal Record on the segment

### Scoring Example
If 4 participants complete Week 1's objective:
- **1st place** (fastest time): beats 3 others = **3 base points**
  - If they set a PR: **4 total points** (3 base + 1 PR bonus)
- **2nd place**: beats 2 others = **2 base points** 
  - If they set a PR: **3 total points** (2 base + 1 PR bonus)
- **3rd place**: beats 1 other = **1 base point**
- **4th place** (slowest): beats 0 = **0 base points**
  - Even last place can earn **1 point** if they set a PR!

Season winner = most total points across all weeks.

## Tech Stack

### Frontend
- **Framework:** React
- **Language:** TypeScript
- **Build Tool:** Vite
- **Package Manager:** npm
- **Styling:** CSS Modules (or a library like Tailwind CSS TBD)

### Backend
- **Runtime:** Node.js (v20 LTS required for native modules)
- **Framework:** Express
- **Database:** SQLite (via better-sqlite3)
- **API:** REST

## Getting Started

### Prerequisites

- **Node.js v20-24** (required for better-sqlite3 native module)
  - **Recommended:** Node.js v20 LTS
  - See `.nvmrc` in the project root
  
**IMPORTANT: Using the correct Node.js version**

This project requires Node.js 20-24. If you have Node.js 25+ installed, you have several options:

1. **Using nvm (Node Version Manager)** - Recommended if you already have it:
   ```bash
   nvm install 20
   nvm use 20
   ```

2. **Using npx with a specific Node version** - Works with any Node.js installation:
   ```bash
   # Use npx to run commands with Node 20
   npx -p node@20 npm install
   npx -p node@20 npm run dev:server
   npx -p node@20 npm test
   ```

3. **Install Node.js 20 LTS** from [nodejs.org](https://nodejs.org/)

After ensuring you're on the correct Node version, proceed with the installation steps below.

- npm (comes with Node.js)

### Installation and Setup

#### Install all dependencies (frontend + backend)
```bash
npm install
```
This automatically installs both frontend and backend dependencies via `postinstall` hook.

#### Set up Strava Credentials (optional for now)
- Create a file named `strava-credentials.json` in the `public` directory.
- This file should contain your Strava application's Client ID and Client Secret:
  ```json
  {
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET"
  }
  ```
- **Note:** This file is ignored by git to prevent credentials from being committed.

#### Configure backend environment (optional)
- Copy `server/.env.example` to `server/.env` if you want to customize settings
- Default values work for local development

### Running the Application

#### Recommended: Run both frontend and backend together
```bash
npm run dev:all
```

This single command starts both the backend (port 3001) and frontend (port 5173) servers. The frontend will be available at `http://localhost:5173`.

**Note:** The `dev:all` command runs both servers in the same terminal. If you need to stop them, press `Ctrl+C` once to stop both.

#### Alternative: Run separately in different terminals

If you prefer to run them separately (for better log visibility):

**Terminal 1 - Backend:**
```bash
npm run dev:server
# or: cd server && npm start
```
The backend will run on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
The frontend will run on `http://localhost:5173`

### Building for Production

```bash
npm run build
```
This builds both the backend (installs dependencies) and frontend (creates optimized production build).

### Running Tests

The backend includes a comprehensive test suite with 94% code coverage.

#### Run from project root:
```bash
npm test
```

#### Run tests in watch mode (during development):
```bash
npm run test:watch
```

#### Or run directly in server directory:
```bash
cd server
npm test
```

**Test Coverage:**
- 59 test cases covering all API endpoints
- Time window validation edge cases
- Admin week management operations
- Scoring logic verification
- Data integrity and cascade deletes
- Boundary value testing

### Available Backend Endpoints

#### Public Endpoints
- `GET /health` - Health check
- `GET /participants` - List all participants
- `GET /segments` - List all segments
- `GET /weeks` - List all weekly competitions (includes time windows)
- `GET /weeks/:id` - Get details for a specific week
- `GET /weeks/:id/leaderboard` - Get leaderboard for a specific week
- `GET /weeks/:id/activities` - List all activities submitted for a week
- `GET /activities/:id/efforts` - Get individual segment efforts for an activity
- `GET /season/leaderboard` - Get season-long standings across all weeks
- `POST /weeks/:id/submit-activity` - Submit a Strava activity for validation (validates time window)

#### Admin Endpoints (Week Management)
- `POST /admin/weeks` - Create a new weekly competition
  - Required: `week_name`, `date`, `segment_id`, `required_laps`
  - Optional: `start_time`, `end_time` (defaults to midnight-10pm on event date)
- `PUT /admin/weeks/:id` - Update an existing week
  - All fields optional, updates only provided fields
- `DELETE /admin/weeks/:id` - Delete a week (cascades to activities, efforts, results)