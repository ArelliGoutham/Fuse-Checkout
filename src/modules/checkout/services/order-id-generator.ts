import type { Db } from 'mongodb';

/**
 * Generates incremental, human-readable, partitionable order IDs.
 * Format: OF-YYMMDD-NNNNNN
 * - OF = configurable prefix (env var ORDER_ID_PREFIX, default "OF")
 * - YYMMDD = date
 * - NNNNNN = 6-digit daily sequence (atomic increment via MongoDB counter)
 */
export class OrderIdGenerator {
  /**
   * Initializes the generator with a MongoDB database instance.
   * @param db - MongoDB database instance for the counter collection
   */
  constructor(private db: Db) {}

  /**
   * Generates the next order ID for the current date.
   * Uses an atomic MongoDB counter (findOneAndUpdate with $inc) to ensure
   * sequential IDs are unique even under concurrent calls.
   * @returns A new order ID in the format PREFIX-YYMMDD-NNNNNN
   */
  async generateId(): Promise<string> {
    const now = new Date();
    const datePart = this.formatDate(now);
    const prefix = process.env.ORDER_ID_PREFIX || 'OF';

    const counter = await this.db
      .collection('order_counters')
      .findOneAndUpdate(
        { _id: `order_${datePart}` as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );

    const seq = counter?.seq ?? 1;
    const seqPart = String(seq).padStart(6, '0');
    return `${prefix}-${datePart}-${seqPart}`;
  }

  /**
   * Formats a date as YYMMDD.
   * @param d - The date to format
   * @returns A 6-digit string in YYMMDD format
   */
  private formatDate(d: Date): string {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
}
