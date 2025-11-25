#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Local Webhook Event Emitter
 *
 * Development tool for testing webhook event processing without needing ngrok or Strava.
 * Sends realistic webhook payloads to your local webhook endpoint.
 *
 * Usage:
 *   node scripts/webhook-emitter.cjs --event create --participant 12345 --activity 987654321
 *   node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json --event create
 *   node scripts/webhook-emitter.cjs --help
 *
 * Events are sent to: http://localhost:3001/webhooks/strava (configurable via --url)
 */

const fs = require('fs');
const path = require('path');

// Load .env if it exists
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
} catch (error) {
  // Ignore if .env not found
}

// Default test events
const DEFAULT_EVENTS = {
  create: {
    name: 'Create Activity (Happy Path)',
    description: 'Participant completes an activity during event window',
    payload: {
      aspect_type: 'create',
      event_time: Math.floor(Date.now() / 1000),
      object_id: 9876543210,
      object_type: 'activity',
      owner_id: 12345,
      subscription_id: 1
    }
  },

  update: {
    name: 'Update Activity',
    description: 'Participant updates activity details (e.g., name, description)',
    payload: {
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      object_id: 9876543210,
      object_type: 'activity',
      owner_id: 12345,
      subscription_id: 1,
      updates: { title: true, description: true }
    }
  },

  delete: {
    name: 'Delete Activity',
    description: 'Participant deletes an activity',
    payload: {
      aspect_type: 'delete',
      event_time: Math.floor(Date.now() / 1000),
      object_id: 9876543210,
      object_type: 'activity',
      owner_id: 12345,
      subscription_id: 1
    }
  },

  athlete_deauth: {
    name: 'Athlete Deauthorizes App',
    description: 'Participant revokes app access in Strava settings',
    payload: {
      aspect_type: 'update',
      event_time: Math.floor(Date.now() / 1000),
      object_id: 0,
      object_type: 'athlete',
      owner_id: 12345,
      subscription_id: 1,
      updates: { authorized: false }
    }
  }
};

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--event' && args[i + 1]) {
      options.event = args[++i];
    } else if (arg === '--participant' && args[i + 1]) {
      options.participant = parseInt(args[++i], 10);
    } else if (arg === '--activity' && args[i + 1]) {
      options.activity = parseInt(args[++i], 10);
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--file' && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === '--delay' && args[i + 1]) {
      options.delay = parseInt(args[++i], 10);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Local Webhook Event Emitter - Development Tool         ║
╚════════════════════════════════════════════════════════════════╝

Send test webhook events to your local app without ngrok or Strava.

USAGE:
  npm run webhook:emit -- [options]

OPTIONS:
  --help, -h                Show this help message
  --verbose, -v             Enable verbose logging
  --event <type>            Event type: create, update, delete, athlete_deauth
  --participant <id>        Strava athlete ID (default: 12345)
  --activity <id>           Strava activity ID (default: 9876543210)
  --url <url>               Webhook endpoint URL (default: http://localhost:3001/webhooks/strava)
  --file <path>             Load events from JSON file
  --delay <ms>              Delay between multiple events (default: 0)

EXAMPLES:
  # Send a single 'create' event with default IDs
  npm run webhook:emit -- --event create

  # Send event for specific participant
  npm run webhook:emit -- --event create --participant 366880 --activity 123456789

  # Load events from file
  npm run webhook:emit -- --file scripts/webhook-test-events.json

  # List available built-in events
  npm run webhook:emit -- --list

BUILT-IN EVENTS:
`);

  Object.entries(DEFAULT_EVENTS).forEach(([key, event]) => {
    console.log(`
  ${key}
    ${event.name}
    ${event.description}
`);
  });

  console.log(`
WEBHOOK_VERIFY_TOKEN:
  Make sure WEBHOOK_VERIFY_TOKEN is set in your .env file.
  Your app uses this to validate webhook requests.

TEST EVENT FILE FORMAT:
  {
    "events": [
      {
        "name": "My Test Event",
        "description": "Event description",
        "payload": { ... webhook payload ... }
      }
    ]
  }

For more info, see docs/WEBHOOKS.md
`);
}

/**
 * Load test events from JSON file
 */
function loadEventsFromFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.events || !Array.isArray(data.events)) {
      throw new Error('File must contain "events" array');
    }

    return data.events;
  } catch (error) {
    console.error(`❌ Failed to load event file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Send webhook payload to endpoint
 */
async function sendWebhook(payload, url, verbose) {
  try {
    if (verbose) {
      console.log(`📤 Sending webhook to ${url}`);
      console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    }

    // Get verify token from environment
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
      console.warn('⚠️  WEBHOOK_VERIFY_TOKEN not set in environment. Requests will be rejected.');
      console.warn('   Make sure .env file contains: WEBHOOK_VERIFY_TOKEN=your-token');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(verifyToken && { 'x-hub-signature': verifyToken })
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Event sent successfully (${response.status} ${response.statusText})`);
      return true;
    } else {
      const text = await response.text();
      console.error(`❌ Webhook rejected: ${response.status} ${response.statusText}`);
      if (verbose && text) {
        console.error('Response:', text);
      }
      return false;
    }
  } catch (error) {
    console.error(
      `❌ Failed to send webhook: ${error instanceof Error ? error.message : String(error)}`
    );
    if (verbose && error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    return false;
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Show help
  if (options.help || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const webhookUrl = options.url || 'http://localhost:3001/webhooks/strava';
  const verbose = options.verbose || false;

  // Collect events to send
  let eventsToSend = [];

  if (options.file) {
    // Load from file
    eventsToSend = loadEventsFromFile(options.file);
    console.log(`📂 Loaded ${eventsToSend.length} event(s) from ${options.file}`);
  } else if (options.event) {
    // Get built-in event
    const event = DEFAULT_EVENTS[options.event];
    if (!event) {
      console.error(`❌ Unknown event type: ${options.event}`);
      console.error(`Available types: ${Object.keys(DEFAULT_EVENTS).join(', ')}`);
      process.exit(1);
    }
    eventsToSend = [event];
  } else {
    console.error('❌ No event specified. Use --event or --file');
    printHelp();
    process.exit(1);
  }

  // Customize events with CLI options
  if (options.participant || options.activity) {
    eventsToSend = eventsToSend.map((event) => ({
      ...event,
      payload: {
        ...event.payload,
        owner_id: options.participant ?? event.payload.owner_id,
        object_id: options.activity ?? event.payload.object_id
      }
    }));
  }

  // Send events
  console.log('\n🚀 Starting webhook event emission\n');

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < eventsToSend.length; i++) {
    const event = eventsToSend[i];

    console.log(`\n📨 Event ${i + 1}/${eventsToSend.length}: ${event.name}`);
    console.log(`   ${event.description}`);

    const success = await sendWebhook(event.payload, webhookUrl, verbose);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Delay between multiple events
    if (i < eventsToSend.length - 1 && options.delay && options.delay > 0) {
      console.log(`⏳ Waiting ${options.delay}ms before next event...`);
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
  }

  // Summary
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                         SUMMARY                                ║
╚════════════════════════════════════════════════════════════════╝

Sent:    ${eventsToSend.length} event(s)
Success: ${successCount} ✅
Failed:  ${failureCount} ❌

Webhook URL: ${webhookUrl}

💡 Tip: Check your app logs to see event processing:
   npm run dev:all

For more info, see docs/WEBHOOKS.md
`);

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
