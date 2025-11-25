# Mock Strava Source Structure

```
mock-strava/src/
├── index.ts              # Main server entry point (HTTP server setup)
├── handlers.ts           # Request handlers for all endpoints
├── subscriptionStore.ts  # In-memory subscription storage and validation
├── logger.ts             # Logging utility with configurable levels
└── types.ts              # TypeScript interfaces and types
```

## File Descriptions

### `types.ts` (16 lines)
**Purpose:** Shared TypeScript types and interfaces

**Exports:**
- `Subscription` - Subscription object with ID, client ID, callback URL, verify token
- `SubscriptionRequest` - Request body for creating subscriptions (form-encoded)
- `WebhookEvent` - Webhook event payload (for future emission features)
- `ValidationRequest` - Query parameters for webhook subscription validation
- `Logger` - Logger interface with debug/info/warn/error methods

### `logger.ts` (28 lines)
**Purpose:** Logging utility with configurable log levels

**Exports:**
- `createLogger()` - Factory function returning Logger instance

**Configuration:**
- Log level controlled via `MOCK_STRAVA_LOG_LEVEL` environment variable
- Levels: debug, info, warn, error
- Timestamps in ISO format, structured logging

**Example:**
```typescript
const logger = createLogger();
logger.info('Subscription created', { id: 1, clientId: 12345 });
```

### `subscriptionStore.ts` (65 lines)
**Purpose:** In-memory subscription storage and management

**Exports:**
- `SubscriptionStore` class

**Methods:**
- `create(request)` - Create new subscription and return it
- `get(id)` - Get subscription by ID
- `getAll(clientId?)` - Get all subscriptions (optionally filtered by client ID)
- `delete(id)` - Delete subscription, returns boolean
- `clear()` - Clear all subscriptions (for testing)
- `generateChallenge()` - Generate random hex challenge for validation

**Usage:**
```typescript
const store = new SubscriptionStore(logger);
const sub = store.create({
  client_id: 12345,
  client_secret: 'secret',
  callback_url: 'https://myapp.com/webhook',
  verify_token: 'mytoken'
});
```

### `handlers.ts` (160+ lines)
**Purpose:** HTTP request handlers for all endpoints

**Exports:**
- `RequestHandlers` class

**Methods:**
- `handleCreateSubscription(req, res, body)` - Create new subscription
  - Validates callback URL via HTTP GET with challenge/verify_token
  - Returns 201 with subscription ID on success
  - Returns 400 if validation fails

- `handleListSubscriptions(req, res, query)` - List all subscriptions
  - Returns 200 with array of subscription objects (id, created_at, callback_url)

- `handleDeleteSubscription(req, res, subscriptionId)` - Delete subscription
  - Returns 204 No Content on success
  - Returns 404 if subscription not found

- `handleHealth(req, res)` - Health check endpoint
  - Returns 200 with { status: 'ok' }

**Private Methods:**
- `validateCallbackUrl(callbackUrl, verifyToken)` - Async validation
  - Generates random challenge
  - Calls app's callback URL with hub.mode, hub.challenge, hub.verify_token
  - Expects response with matching challenge echoed back
  - 2-second timeout for validation requests
  - Returns true if validation succeeds, false otherwise

### `index.ts` (120+ lines)
**Purpose:** Main server setup and HTTP request routing

**Functionality:**
- Creates HTTP server listening on MOCK_STRAVA_PORT (default 4000)
- Routes requests to appropriate handlers
- Adds CORS headers to all responses
- Graceful shutdown on SIGTERM/SIGINT
- Error handling for unhandled rejections

**Routes:**
- `GET /health` - Health check
- `POST /api/v3/push_subscriptions` - Create subscription
- `GET /api/v3/push_subscriptions` - List subscriptions
- `DELETE /api/v3/push_subscriptions/:id` - Delete subscription
- `OPTIONS *` - CORS preflight

**Helpers:**
- `getBody(req)` - Async function to read request body
- `parseQuery(queryString)` - Parse URL query string to object

## Development Workflow

### Run in development mode
```bash
cd mock-strava
npm run dev
```
Uses `tsx` for zero-config TypeScript execution with hot-reload.

### Build for production
```bash
cd mock-strava
npm run build
```
Compiles TypeScript to JavaScript in `dist/` directory.

### Run production build
```bash
cd mock-strava
npm start
```
Runs compiled JavaScript from `dist/index.js`.

## Integration with Main App

The mock Strava server runs independently on port 4000. The main app can interact with it via:

```typescript
// Example: Subscribe to webhooks during development
const subscriptionResponse = await fetch('http://localhost:4000/api/v3/push_subscriptions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '12345',
    client_secret: 'secret',
    callback_url: 'http://localhost:3001/webhooks',
    verify_token: 'mytoken'
  })
});
```

## Key Design Decisions

1. **Modular Structure** - Separation of concerns (types, logging, storage, handlers, server)
2. **Zero External Dependencies** - Pure Node.js, only dev deps for TypeScript
3. **Type-Safe** - Full TypeScript with strict mode enabled
4. **ESM Modules** - Modern module system with "type": "module" in package.json
5. **Standalone Package** - Can be developed, built, and deployed independently
6. **Configurable** - Port, log level, all configurable via environment variables

## Testing

Each module can be tested independently:

```bash
# Test type definitions compile
npm run build

# Test server starts without errors
timeout 5 npm run dev || true

# Test specific endpoint (from another terminal)
curl http://localhost:4000/health
```

See [../README.md](../README.md) for comprehensive testing guide.
