import { SmartRouter } from './smart-router';
import { PGAdapter, PGPaymentResult } from '../../pg-adapters/types';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';

class MockPG implements PGAdapter {
  constructor(private name: string, private shouldFail: boolean = false) {}
  getName() { return this.name; }
  async createOrder() { return { order_id: `ord_${this.name}`, amount: 1000, currency: 'INR', status: 'created' as const }; }
  async processPayment(): Promise<PGPaymentResult> {
    if (this.shouldFail) return { status: 'failed', transaction_id: '', error_message: 'Simulated failure' };
    return { status: 'success', transaction_id: `txn_${this.name}` };
  }
  async verifyPayment() { return { verified: true, amount: 1000, status: 'success' }; }
}

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  client = new MongoClient(mongoServer.getUri());
  await client.connect();
  db = client.db('testdb');
});

afterAll(async () => {
  await client.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await db.collection('pg_stats').deleteMany({});
});

describe('SmartRouter', () => {
  it('returns the only adapter as primary when there is one PG', async () => {
    const razorpay = new MockPG('razorpay');
    const router = new SmartRouter([razorpay], db);
    const decision = await router.route('merch_test', 5000);
    expect(decision.primary.getName()).toBe('razorpay');
    expect(decision.fallback).toHaveLength(0);
  });

  it('ranks PGs by success rate (higher first)', async () => {
    await db.collection('pg_stats').insertMany([
      { _id: '1' as any, pg_name: 'razorpay', merchant_id: 'merch_test', date: '2026-07-30', total_attempts: 100, successful: 96, failed: 4, pending: 0, success_rate: 96, avg_latency_ms: 1800, p95_latency_ms: 3500, total_volume: 500000, avg_order_value: 5208, failures_by_reason: {}, updated_at: new Date().toISOString() },
      { _id: '2' as any, pg_name: 'cashfree', merchant_id: 'merch_test', date: '2026-07-30', total_attempts: 100, successful: 90, failed: 10, pending: 0, success_rate: 90, avg_latency_ms: 2300, p95_latency_ms: 4100, total_volume: 450000, avg_order_value: 5000, failures_by_reason: {}, updated_at: new Date().toISOString() },
    ]);

    const razorpay = new MockPG('razorpay');
    const cashfree = new MockPG('cashfree');
    const router = new SmartRouter([cashfree, razorpay], db);
    const decision = await router.route('merch_test', 5000);
    expect(decision.primary.getName()).toBe('razorpay');
    expect(decision.fallback[0].getName()).toBe('cashfree');
  });

  it('assigns 100% success rate to PGs with no data (new PGs)', async () => {
    const razorpay = new MockPG('razorpay');
    const newPg = new MockPG('newpg');
    const router = new SmartRouter([razorpay, newPg], db);
    const decision = await router.route('merch_test', 5000);
    // Both have no data, both get 100%, first in list wins
    expect(decision.primary.getName()).toBe('razorpay');
  });

  it('includes routing reason in decision', async () => {
    const razorpay = new MockPG('razorpay');
    const router = new SmartRouter([razorpay], db);
    const decision = await router.route('merch_test', 5000);
    expect(decision.reason).toContain('razorpay');
    expect(decision.reason).toContain('%');
  });

  it('falls back to next PG when primary fails', async () => {
    const failPg = new MockPG('failpg', true);
    const successPg = new MockPG('successpg', false);
    const router = new SmartRouter([failPg, successPg], db);
    const decision = await router.route('merch_test', 5000);

    // Try primary, it fails, try fallback
    const primaryResult = await decision.primary.processPayment({ order_id: 'test', payment_data: {} });
    expect(primaryResult.status).toBe('failed');

    const fallbackResult = await decision.fallback[0].processPayment({ order_id: 'test', payment_data: {} });
    expect(fallbackResult.status).toBe('success');
  });

  it('calculates rolling success rate from multiple days', async () => {
    await db.collection('pg_stats').insertMany([
      { _id: '1' as any, pg_name: 'razorpay', merchant_id: 'merch_test', date: '2026-07-28', total_attempts: 50, successful: 48, failed: 2, pending: 0, success_rate: 96, avg_latency_ms: 1800, p95_latency_ms: 3500, total_volume: 250000, avg_order_value: 5208, failures_by_reason: {}, updated_at: new Date().toISOString() },
      { _id: '2' as any, pg_name: 'razorpay', merchant_id: 'merch_test', date: '2026-07-29', total_attempts: 50, successful: 45, failed: 5, pending: 0, success_rate: 90, avg_latency_ms: 1800, p95_latency_ms: 3500, total_volume: 225000, avg_order_value: 5000, failures_by_reason: {}, updated_at: new Date().toISOString() },
      { _id: '3' as any, pg_name: 'cashfree', merchant_id: 'merch_test', date: '2026-07-29', total_attempts: 100, successful: 95, failed: 5, pending: 0, success_rate: 95, avg_latency_ms: 2300, p95_latency_ms: 4100, total_volume: 475000, avg_order_value: 5000, failures_by_reason: {}, updated_at: new Date().toISOString() },
    ]);

    // Razorpay: (48+45)/(50+50) = 93%, Cashfree: 95/100 = 95%
    // Cashfree should win
    const razorpay = new MockPG('razorpay');
    const cashfree = new MockPG('cashfree');
    const router = new SmartRouter([razorpay, cashfree], db);
    const decision = await router.route('merch_test', 5000);
    expect(decision.primary.getName()).toBe('cashfree');
  });
});
