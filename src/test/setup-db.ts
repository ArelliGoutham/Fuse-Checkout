import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;
let db: Db;

/**
 * Starts an in-memory MongoDB instance for integration tests.
 * Call this in beforeAll() of test suites that need a database.
 *
 * @returns The Db instance connected to the in-memory MongoDB
 */
export async function startTestDatabase(): Promise<Db> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  db = mongoClient.db('offerforge-test');
  return db;
}

/**
 * Stops the in-memory MongoDB instance.
 * Call this in afterAll() to clean up.
 */
export async function stopTestDatabase(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Returns the current test database instance.
 * Throws if startTestDatabase() hasn't been called.
 *
 * @returns The Db instance for the in-memory MongoDB
 */
export function getTestDatabase(): Db {
  if (!db) {
    throw new Error('Test database not started. Call startTestDatabase() in beforeAll() first.');
  }
  return db;
}

/**
 * Clears all collections in the test database.
 * Call this between tests to ensure a clean state.
 */
export async function clearTestDatabase(): Promise<void> {
  if (!db) return;
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}
