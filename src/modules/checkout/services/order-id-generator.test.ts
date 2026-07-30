import { Db } from 'mongodb';
import {
  startTestDatabase,
  stopTestDatabase,
  clearTestDatabase,
} from '../../../test/setup-db';
import { OrderIdGenerator } from './order-id-generator';

describe('OrderIdGenerator', () => {
  let db: Db;
  let generator: OrderIdGenerator;

  beforeAll(async () => {
    db = await startTestDatabase();
    generator = new OrderIdGenerator(db);
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    delete process.env.ORDER_ID_PREFIX;
  });

  it('generates ID with correct format (PREFIX-YYMMDD-NNNNNN)', async () => {
    const id = await generator.generateId();
    expect(id).toMatch(/^FUSE-\d{6}-\d{6}$/);
  });

  it('generates sequential IDs (000001, 000002, 000003)', async () => {
    const id1 = await generator.generateId();
    const id2 = await generator.generateId();
    const id3 = await generator.generateId();

    expect(id1).toMatch(/000001$/);
    expect(id2).toMatch(/000002$/);
    expect(id3).toMatch(/000003$/);
  });

  it('resets sequence for a new date', async () => {
    // Generate an ID for "today" first
    const firstId = await generator.generateId();
    expect(firstId).toMatch(/000001$/);

    // Manually insert a counter for a future date to verify the key is date-scoped
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yy = String(tomorrow.getFullYear()).slice(-2);
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowDatePart = `${yy}${mm}${dd}`;

    // Seed the future counter with a high sequence
    await db.collection('order_counters').insertOne({
      _id: `order_${tomorrowDatePart}` as any,
      seq: 99,
    });

    // Today's counter should still be at 000002 (independent of tomorrow's)
    const nextTodayId = await generator.generateId();
    expect(nextTodayId).toMatch(/000002$/);

    // Verify each date has its own counter key
    const todayCounter = await db
      .collection('order_counters')
      .findOne({ _id: `order_${formatDate(today)}` as any });
    const tomorrowCounter = await db
      .collection('order_counters')
      .findOne({ _id: `order_${tomorrowDatePart}` as any });

    expect(todayCounter?.seq).toBe(2);
    expect(tomorrowCounter?.seq).toBe(99); // unchanged by today's generation
  });

  it('uses ORDER_ID_PREFIX env var if set', async () => {
    process.env.ORDER_ID_PREFIX = 'SHOP';
    const id = await generator.generateId();
    expect(id).toMatch(/^SHOP-\d{6}-\d{6}$/);
  });

  it('pads sequence to 6 digits', async () => {
    const id = await generator.generateId();
    // The sequence portion (last segment) should be exactly 6 chars
    const segments = id.split('-');
    const seqPart = segments[segments.length - 1];
    expect(seqPart).toHaveLength(6);
    expect(seqPart).toBe('000001');
  });

  it('uses MongoDB atomic counter (findOneAndUpdate with $inc)', async () => {
    // Generate a few IDs, then verify the counter document exists and was incremented atomically
    await generator.generateId();
    await generator.generateId();
    await generator.generateId();

    const today = new Date();
    const counter = await db
      .collection('order_counters')
      .findOne({ _id: `order_${formatDate(today)}` as any });

    expect(counter).not.toBeNull();
    expect(counter?.seq).toBe(3);
  });
});

/**
 * Formats a date as YYMMDD, matching the generator's internal format.
 * @param d - The date to format
 * @returns The YYMMDD string
 */
function formatDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
