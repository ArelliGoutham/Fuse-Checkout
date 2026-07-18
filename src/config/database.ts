import { MongoClient, type Db } from 'mongodb';

export type { Db };

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Connects to MongoDB and stores the Db instance.
 * Call this once at server startup.
 *
 * @param uri - MongoDB connection URI
 * @param dbName - Database name to use
 * @returns The connected Db instance
 */
export async function connectDatabase(uri: string, dbName: string): Promise<Db> {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

/**
 * Returns the current database instance.
 * Throws if connectDatabase() hasn't been called or connection was closed.
 *
 * @returns The connected Db instance
 * @throws Error if database is not connected
 */
export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

/**
 * Closes the MongoDB connection gracefully.
 * Call this on server shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
