import { connectDatabase, closeDatabase, getDatabase } from './database';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('database connection', () => {
  let memServer: MongoMemoryServer | null = null;

  beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
  }, 60000); // 60s timeout for MongoMemoryServer startup

  afterAll(async () => {
    if (memServer) {
      await memServer.stop();
    }
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('connects to MongoDB and returns a Db instance', async () => {
    const uri = memServer?.getUri();
    if (!uri) throw new Error('MongoMemoryServer URI not available');
    const db = await connectDatabase(uri, 'offerforge-test');
    expect(db).toBeDefined();
    expect(db.databaseName).toBe('offerforge-test');
  }, 30000);

  it('getDatabase returns the connected Db instance', async () => {
    const uri = memServer?.getUri();
    if (!uri) throw new Error('MongoMemoryServer URI not available');
    await connectDatabase(uri, 'offerforge-test');
    const db = getDatabase();
    expect(db.databaseName).toBe('offerforge-test');
  }, 30000);

  it('throws when getDatabase called before connect', () => {
    expect(() => getDatabase()).toThrow(/not connected/i);
  });
});
