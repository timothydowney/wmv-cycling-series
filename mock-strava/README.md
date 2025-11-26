# Mock Strava API Server

A complete mock implementation of Strava's webhook subscription API for development and testing.

## Features

- ✅ Full Strava webhook subscription API simulation
- ✅ Exact challenge/response verification matching Strava's flow
- ✅ In-memory subscription storage
- ✅ Standalone, zero external dependencies
- ✅ TypeScript support
- ✅ Development and production modes

## Quick Start

### Development

```bash
npm install
npm run dev
```

Server runs on `http://localhost:4000` by default.

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

```bash
MOCK_STRAVA_PORT=4000          # Server port (default: 4000)
MOCK_STRAVA_CALLBACK_URL=http://localhost:3001/webhooks/strava  # Where to send verification requests
MOCK_STRAVA_LOG_LEVEL=debug    # Log level: debug, info, warn, error
```

## API Endpoints

### Create Subscription

```bash
POST /api/v3/push_subscriptions
Content-Type: application/x-www-form-urlencoded

client_id=170916&\
client_secret=your-secret&\
callback_url=http://localhost:3001/webhooks/strava&\
verify_token=your-verify-token
```

Response: `{ "id": 1 }`

### List Subscriptions

```bash
GET /api/v3/push_subscriptions?client_id=170916&client_secret=your-secret
```

Response: Array of subscription objects

### Delete Subscription

```bash
DELETE /api/v3/push_subscriptions/1?client_id=170916&client_secret=your-secret
```

### Health Check

```bash
GET /health
```

Response: `{ "status": "ok" }`

## How It Works

### Subscription Flow

1. App makes POST to `/api/v3/push_subscriptions` with callback URL and verify token
2. Mock server makes GET request to callback URL with `hub.challenge` parameter
3. App's webhook handler echoes back the challenge
4. Mock server validates the response and creates the subscription
5. App receives subscription ID

### Webhook Emission (Manual Testing)

Use the webhook emitter to send test events:

```bash
npm run webhook:emit -- --event create --activity-id 123456789
```

## Testing

```bash
npm test
```

## Integration with Main App

When `WEBHOOK_ENABLED=true` in dev mode, the main app should point to this mock server:

```bash
STRAVA_WEBHOOK_API_URL=http://localhost:4000
```

## Development Workflow

### Three-Terminal Setup

**Terminal 1: Mock Strava**
```bash
cd mock-strava
npm run dev
```

**Terminal 2: Main App**
```bash
cd ..
npm run dev:all
```

**Terminal 3: Test Events**
```bash
npm run webhook:emit -- --event create
```

## Architecture

```
mock-strava/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── handlers.ts           # Endpoint handlers
│   ├── subscriptionStore.ts  # In-memory subscription storage
│   ├── logger.ts             # Logging utility
│   └── types.ts              # TypeScript types
├── dist/                     # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Subscription creation fails with "Callback URL validation failed"

- Check that your app's webhook handler is running on the URL you specified
- Verify it responds to GET requests with `hub.challenge` parameter
- Ensure response includes `200` status code

### Not receiving webhook events

- Verify subscription was created successfully: `GET /api/v3/push_subscriptions`
- Check app logs for webhook handler errors
- Manually test webhook endpoint: `curl -X POST http://localhost:3001/webhooks/strava -H 'Content-Type: application/json' -d '{...}'`

## Security Notes

This is a development tool only. Do not use in production. It:
- Stores subscriptions in memory (lost on restart)
- Has no authentication/authorization (all requests accepted)
- Does not validate client credentials
- Is intended for localhost-only use

For production webhook testing, use Strava's staging environment or WireMock Cloud.

## License

MIT
