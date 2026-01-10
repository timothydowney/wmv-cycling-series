/**
 * config.ts
 *
 * Centralized configuration management - SINGLE SOURCE OF TRUTH.
 *
 * This module:
 * 1. Loads environment variables from .env file (via dotenv)
 * 2. Parses and validates configuration
 * 3. Derives all app URLs from base configuration
 * 4. Exports a ready-to-use config object
 *
 * No other file should access process.env directly.
 * All configuration flows through this module.
 *
 * Environment Variables:
 *
 * 1. Local Development (frontend + backend on different ports):
 *    - FRONTEND_URL: Frontend base URL (required, e.g., http://localhost:5173)
 *    - BACKEND_URL: Backend base URL (optional, defaults to http://localhost:3001)
 *    Example:
 *      FRONTEND_URL=http://localhost:5173
 *      BACKEND_URL=http://localhost:3001
 *
 * 2. Production (same domain for frontend + backend):
 *    - APP_BASE_URL: Single base URL for both (required, e.g., https://wmv-cycling.railway.app)
 *    Example:
 *      APP_BASE_URL=https://wmv-cycling.railway.app
 *
 * Derived URLs:
 *    - frontendUrl: Frontend base URL
 *    - backendUrl: Backend base URL
 *    - stravaRedirectUri: OAuth callback (backend_url/auth/strava/callback)
 *    - webhookCallbackUrl: Webhook endpoint (backend_url/webhooks/strava)
 */

import dotenv from 'dotenv';
import path from 'path';

// CRITICAL: Load .env file FIRST, before anything else
// This ensures all environment variables are available when getConfig() runs
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  frontendUrl: string;
  backendUrl: string;
  stravaRedirectUri: string;
  webhookCallbackUrl: string;
  isDevelopment: boolean;
  isSplitStack: boolean; // true if frontend and backend on different ports/domains
  port: number;
  // Strava API
  stravaClientId: string | undefined;
  stravaClientSecret: string | undefined;
  stravaWebhookApiUrl: string; // Only used for webhook subscription endpoints
  stravaClubId: string; // Strava club to track membership for
  // Database
  databasePath: string;
  maxDatabaseSize: number; // Maximum database size in MB (default: 256)
  // Session
  sessionSecret: string;
  // Encryption
  tokenEncryptionKey: string | undefined;
  // Webhooks
  webhookEnabled: boolean;
  webhookVerifyToken: string | undefined;
  webhookPersistEvents: boolean;
  // Admin
  adminAthleteIds: string[];
}

function getConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv !== 'production';

  // Parse admin athlete IDs
  const adminAthleteIds: string[] = [];
  if (process.env.ADMIN_ATHLETE_IDS) {
    adminAthleteIds.push(
      ...process.env.ADMIN_ATHLETE_IDS
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    );
  }

  // Parse max database size
  let maxDatabaseSize = 256; // default 256MB
  if (process.env.MAX_DATABASE_SIZE) {
    const parsed = parseInt(process.env.MAX_DATABASE_SIZE, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxDatabaseSize = parsed;
    }
  }

  // Determine URL config (Priority 1: split-stack, Priority 2: unified, Fallback: localhost)
  let frontendUrl: string;
  let backendUrl: string;
  let isSplitStack: boolean;

  if (process.env.FRONTEND_URL) {
    // Priority 1: Explicit split-stack config (local dev)
    frontendUrl = process.env.FRONTEND_URL;
    backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    isSplitStack = true;
  } else if (process.env.APP_BASE_URL || process.env.CLIENT_BASE_URL) {
    // Priority 2: Single app base URL (production or unified local)
    // Support CLIENT_BASE_URL for legacy configuration compatibility
    const baseUrl = (process.env.APP_BASE_URL || process.env.CLIENT_BASE_URL)!;
    frontendUrl = baseUrl;
    backendUrl = baseUrl;
    isSplitStack = false;
  } else {
    // Fallback: Default local development
    frontendUrl = 'http://localhost:5173';
    backendUrl = 'http://localhost:3001';
    isSplitStack = true;
  }

  return {
    frontendUrl,
    backendUrl,
    stravaRedirectUri: `${backendUrl}/auth/strava/callback`,
    webhookCallbackUrl: `${backendUrl}/webhooks/strava`,
    isDevelopment,
    isSplitStack,
    port: parseInt(process.env.PORT || '3001', 10),
    // Strava API
    stravaClientId: process.env.STRAVA_CLIENT_ID,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET,
    stravaWebhookApiUrl: process.env.STRAVA_WEBHOOK_API_URL || 'https://www.strava.com',
    stravaClubId: process.env.STRAVA_CLUB_ID || '1495648',
    // Database
    databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'wmv.db'),
    maxDatabaseSize,
    // Session
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    // Encryption
    // Use default key in development/test, require explicit env var in production
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 
      ((nodeEnv === 'development' || nodeEnv === 'test') ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : undefined),
    // Webhooks
    webhookEnabled: process.env.WEBHOOK_ENABLED === 'true',
    webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
    webhookPersistEvents: process.env.WEBHOOK_PERSIST_EVENTS === 'true',
    // Admin
    adminAthleteIds
  };
}

export let config = getConfig();

/**
 * Reload configuration from environment variables
 * Used primarily in tests where process.env is modified
 */
export function reloadConfig(): void {
  config = getConfig();
}

/**
 * Get the runtime mode
 */
export function getMode(): 'development' | 'test' | 'production' {
  return (process.env.NODE_ENV as any) || 'development';
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return getMode() === 'test';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getMode() === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopmentMode(): boolean {
  return getMode() === 'development';
}

/**
 * Log configuration on startup (for debugging URL issues)
 */
export function logConfigOnStartup(): void {
  console.log('========== CONFIGURATION ==========');
  console.log(`[CONFIG] Mode: ${getMode()}`);
  console.log(`[CONFIG] Split stack: ${config.isSplitStack}`);
  console.log(`[CONFIG] Frontend URL: ${config.frontendUrl}`);
  console.log(`[CONFIG] Backend URL: ${config.backendUrl}`);
  console.log(`[CONFIG] OAuth callback: ${config.stravaRedirectUri}`);
  console.log(`[CONFIG] Webhook callback: ${config.webhookCallbackUrl}`);

  // Warn about missing env vars if in production
  if (isProduction() && !process.env.APP_BASE_URL && !process.env.FRONTEND_URL) {
    console.warn(
      '[CONFIG] ⚠️  No APP_BASE_URL or FRONTEND_URL set in production. Using defaults.'
    );
  }
}

/**
 * Log environment variables on startup (for debugging config issues in Railway logs)
 */
export function logEnvironmentVariables(): void {
  const safeEnv = {
    MODE: getMode(),
    FRONTEND_URL: process.env.FRONTEND_URL || '(not set)',
    BACKEND_URL: process.env.BACKEND_URL || '(not set)',
    APP_BASE_URL: process.env.APP_BASE_URL || '(not set)',
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID ? '(set)' : '(not set)',
    DATABASE_PATH: process.env.DATABASE_PATH || '(not set)',
    TOKEN_ENCRYPTION_KEY_LENGTH: process.env.TOKEN_ENCRYPTION_KEY
      ? process.env.TOKEN_ENCRYPTION_KEY.length
      : 'missing',
    ADMIN_ATHLETE_IDS: config.adminAthleteIds.length > 0 
      ? config.adminAthleteIds.join(',')
      : '(not set)'
  };
  console.log('[ENV] Effective environment:', safeEnv);
}

/**
 * Get Strava API configuration (credentials + base URL)
 * @throws Error if client ID or secret are missing
 */
export function getStravaConfig() {
  const { stravaClientId, stravaClientSecret, stravaWebhookApiUrl } = config;

  if (!stravaClientId || !stravaClientSecret) {
    throw new Error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET environment variables');
  }

  return {
    clientId: stravaClientId,
    clientSecret: stravaClientSecret,
    apiBase: stravaWebhookApiUrl
  };
}

/**
 * Check if webhooks should be enabled and have required configuration
 */
export function canEnableWebhooks(): boolean {
  const { webhookEnabled, webhookVerifyToken } = config;
  return webhookEnabled && !!webhookVerifyToken;
}

/**
 * Get webhook configuration
 */
export function getWebhookConfig() {
  const { webhookEnabled, webhookVerifyToken, webhookCallbackUrl, webhookPersistEvents } = config;
  return {
    enabled: webhookEnabled,
    verifyToken: webhookVerifyToken,
    callbackUrl: webhookCallbackUrl,
    persistEvents: webhookPersistEvents
  };
}

/**
 * Get token encryption key from config
 * Used for encrypting/decrypting OAuth tokens at rest
 * @throws {Error} if TOKEN_ENCRYPTION_KEY not configured
 */
export function getTokenEncryptionKey(): Buffer {
  if (!config.tokenEncryptionKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable not set. Cannot encrypt tokens.');
  }
  return Buffer.from(config.tokenEncryptionKey, 'hex');
}

/**
 * Get maximum database size limit from config
 * @returns Size in MB (default: 256)
 */
export function getMaxDatabaseSize(): number {
  return config.maxDatabaseSize;
}

