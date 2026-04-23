# Webhook Admin Local Review

Use this workflow when your goal is to inspect the webhook admin UI with realistic data, not to simulate webhook behavior from scratch.

This is the preferred path for judging the Webhooks admin screens because it uses a refreshed local copy of the production database instead of synthetic local harness data.

The event-history card design is intentionally optimized for two different review questions:
- collapsed rows are for quick scanning of webhook type, match outcome, and specific competition or Explorer matches when they exist
- expanded rows are for checking fetched Strava detail, private or unavailable guidance, and raw event context without leaving the admin page

## What This Workflow Gives You

- real webhook event-history rows from production data
- realistic event volume, statuses, and enrichment shape
- the normal local app shell on `http://localhost:5173`
- backend access to the production-copy database at `server/data/wmv_prod.db`

## What This Workflow Is Not For

- deterministic webhook-path testing for CI: use `npm run test:e2e`
- raw local webhook POST testing: use [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md)
- production access from your local app: you are reviewing a local copy, not talking to the live deployed app

## Prerequisites

- Railway CLI installed and authenticated
- access to the production Railway project
- Node 24 available locally

## Refresh The Local Production Copy

Run:

```bash
npm run db:fetch-prod
```

That script:
- downloads `/data/wmv.db` from Railway into `server/data/wmv_prod.db`
- verifies the checksum
- generates `.env.prod` with the production secrets needed to read and decrypt that database locally

If the command fails, confirm you are logged in to Railway first.

## Start The App Against The Production Copy

Run:

```bash
npm run dev:prod-data
```

This starts the normal local frontend and backend, but tells the backend to load `.env.prod` through `ENV_FILE=.env.prod`.

Expected local endpoints:
- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

## Sign In And Review The UI

1. Open `http://localhost:5173`.
2. Sign in through the normal local flow if needed.
3. Open the Webhooks admin screen.
4. Review the Event History and Storage Usage tabs against the refreshed production-like data.

This is the right workflow when you want to judge:
- event card density and readability
- whether the row title hierarchy feels right for athlete and activity identity
- whether collapsed badges make specific week and Explorer destination matches easy to spot
- error and success distribution
- enrichment usefulness
- empty, loading, and overflow states
- whether the admin UI feels credible with realistic data volume

## When To Refresh Again

Run `npm run db:fetch-prod` again when:
- you want newer event history
- production data shape has materially changed
- you want to re-check the UI after backend webhook changes

## Safety Notes

- The local app is reading a local database copy. It is not editing the live Railway database.
- `.env.prod` is generated locally and stays ignored by git.
- This workflow is for local review only. Do not treat it as production validation.

## Recommended Decision Rule

Use the workflow that matches the question you are trying to answer:

- “Does the webhook admin UI look good with real data?”
  Use `npm run db:fetch-prod` then `npm run dev:prod-data`.

- “Does the webhook processing code path still work?”
  Use `npm run test:e2e` or focused backend tests.

- “Can I POST a raw webhook payload to my local backend and inspect logs?”
  Use [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md).