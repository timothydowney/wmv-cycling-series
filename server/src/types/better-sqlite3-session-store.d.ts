declare module 'better-sqlite3-session-store' {
  import type Database from 'better-sqlite3';

  interface SqliteStoreOptions {
    client?: Database.Database;
    expired?: {
      clear?: boolean;
      interval?: number;
      intervalMs?: number;
    };
  }

  interface SqliteStoreClass {
    new (options?: SqliteStoreOptions): any;
  }

  function SqliteStore(session: any): SqliteStoreClass;

  export = SqliteStore;
}
