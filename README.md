# Strava NCC Scrape

Western Mass Velo's weekly cycling competition tracker. Calculates scores based on segment times, displays weekly and season leaderboards, and will integrate with Strava API for automatic activity tracking.

**Club Scale:** Designed for <100 participants - uses SQLite and simple architecture. No need for complex infrastructure!

## Competition Overview

### Weekly Format
- **When:** Every Tuesday (configurable time window, typically midnight-10pm)
- **What:** Complete a designated Strava segment a specified number of times
- **How:** Participants submit their Strava activity URL for that Tuesday
- **Scoring:**
  - **Base points:** Earn 1 point for every participant you beat (based on total time) **PLUS 1 point for competing**
  - **PR Bonus:** Earn +1 bonus point if you set a Personal Record on the segment

### Scoring Example
If 4 participants complete Week 1's objective:
- **1st place** (fastest time): beats 3 others + competed = **4 base points**
  - If they set a PR: **5 total points** (4 base + 1 PR bonus)
- **2nd place**: beats 2 others + competed = **3 base points** 
  - If they set a PR: **4 total points** (3 base + 1 PR bonus)
- **3rd place**: beats 1 other + competed = **2 base points**
- **4th place** (slowest): beats 0 + competed = **1 base point**
  - Even last place can earn **2 points** if they set a PR!
- **Did not compete**: **0 points** (rewards participation)

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

- **Node.js v20-25** (required for better-sqlite3 native module)
  - **Recommended:** Node.js v24 LTS
  - See `.nvmrc` in the project root
  
**⚠️ IMPORTANT: Using the correct Node.js version**

This project requires Node.js 20-25. The app will check your version automatically and show an error if incorrect.

**Check your current version:**
```bash
node --version
```

**If you need Node 24 (recommended), use nvm:**
```bash
nvm use 24
# OR if you don't have Node 24 installed yet:
nvm install 24 && nvm use 24
```

**Don't have nvm? Install it or use npx:**
```bash
# Install nvm: https://github.com/nvm-sh/nvm#installing-and-updating
# OR use npx to run with Node 24:
npx -p node@24 npm install
npx -p node@24 npm run dev:all
```

**To make nvm automatic in this project directory:**
```bash
# Add this to your ~/.bashrc or ~/.zshrc
# It will auto-switch to Node 24 when you cd into this project
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
echo 'nvm use 2>/dev/null' >> ~/.bashrc
```

- npm (comes with Node.js)

### Installation and Setup

#### Install all dependencies (frontend + backend)
```bash
npm install
```
This automatically installs both frontend and backend dependencies via `postinstall` hook.

#### Configure backend environment
**Required for Strava OAuth integration:**

1. Copy the example environment file:
   ```bash
   cp server/.env.example server/.env
   ```

2. Edit `server/.env` and add your Strava credentials:
   ```bash
   STRAVA_CLIENT_ID=170916
   STRAVA_CLIENT_SECRET=your_secret_here
   ```

3. Get credentials from [Strava API Settings](https://www.strava.com/settings/api) if needed

**Note:** `.env` files are automatically excluded from git to keep secrets safe.

### Running the Application

#### Start both servers (recommended)
```bash
npm run dev:all
```

This single command starts both the backend (port 3001) and frontend (port 5173) servers using `concurrently`. 
- Color-coded output: backend in blue, frontend in green
- Both servers run in the same terminal
- Frontend will be available at `http://localhost:5173`

**To stop both servers:**
- Press `Ctrl+C` once to stop both processes
- Or run: `npm run stop` (or `npm run cleanup`) to kill any lingering processes

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

#### Clean up processes
If processes get stuck or you need to kill everything:
```bash
npm run stop
# This kills nodemon, vite, and anything on ports 3001/5173
```

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