import type { Logger } from './types.js';

const LOG_LEVEL = process.env.MOCK_STRAVA_LOG_LEVEL || 'info';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL as keyof typeof LEVELS] || LEVELS.info;

export const createLogger = (): Logger => {
  const log = (level: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Mock:Strava] [${level.toUpperCase()}]`;
    
    if (meta) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  return {
    debug: (message, meta) => {
      if (currentLevel <= LEVELS.debug) log('debug', message, meta);
    },
    info: (message, meta) => {
      if (currentLevel <= LEVELS.info) log('info', message, meta);
    },
    warn: (message, meta) => {
      if (currentLevel <= LEVELS.warn) log('warn', message, meta);
    },
    error: (message, meta) => {
      if (currentLevel <= LEVELS.error) log('error', message, meta);
    },
  };
};
