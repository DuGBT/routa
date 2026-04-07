/**
 * SQLite module stub — desktop-only, not available in web deployment.
 *
 * This module provided SQLite database access for the Tauri desktop app.
 * Since desktop support has been removed, this stub throws clear errors
 * if any code accidentally tries to use SQLite in the web environment.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteDb = any;

export type SqliteDatabase = SqliteDb;

export function getSqliteDatabase(_dbPath?: string): SqliteDatabase {
  throw new Error("SQLite is not available in web deployment. Use PostgreSQL instead.");
}

export function isSqliteDatabase(db: unknown): db is SqliteDatabase {
  return false;
}

export function closeSqliteDatabase(): void {
  // no-op in web deployment
}

export function ensureSqliteDefaultWorkspace(_db: SqliteDatabase, _workspaceId: string): Promise<void> {
  return Promise.resolve();
}
