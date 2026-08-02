import type { FastifyInstance } from 'fastify';
import { createServer } from '../../../app';
import { createAuthMiddleware } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/error-handler';
import type { Db } from '../../../config/database';
import { clearTestDatabase, getTestDatabase, startTestDatabase, stopTestDatabase } from '../../../test/setup-db';
import { registerDashboardRoutes } from './dashboard-routes';

type TestDocument = { _id: string; [key: string]: unknown };

describe('Dashboard overview routes', () => {
  let server: FastifyInstance;
  let testDb: Db;
  let now: Date;

  beforeAll(async () => {
    await startTestDatabase();
    testDb = getTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    now = new Date();

    server = createServer();
    server.setErrorHandler(errorHandler);
    server.decorate('db', testDb);
    server.addHook('preHandler', createAuthMiddleware(testDb));
    registerDashboardRoutes(server);

    await testCollection('merchants').insertMany([
      { _id: 'merchant-one', api_key_hash: 'merchant-one-key', name: 'Merchant One' },
      { _id: 'merchant-two', api_key_hash: 'merchant-two-key', name: 'Merchant Two' },
    ]);
  });

  afterEach(async () => {
    await server.close();
  });

  function isoDaysAgo(days: number): string {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function testCollection(name: string) {
    return testDb.collection<TestDocument>(name);
  }

  it('returns merchant-isolated business performance for the selected period', async () => {
    await testCollection('orders').insertMany([
      { _id: 'order-1', merchant_id: 'merchant-one', final_amount: 500, order_status: 'paid', created_at: isoDaysAgo(1) },
      { _id: 'order-2', merchant_id: 'merchant-one', final_amount: 1000, order_status: 'paid', created_at: isoDaysAgo(2) },
      { _id: 'order-paid-late', merchant_id: 'merchant-one', final_amount: 200, order_status: 'paid', created_at: isoDaysAgo(8), paid_at: isoDaysAgo(1) },
      { _id: 'order-partially-refunded', merchant_id: 'merchant-one', final_amount: 400, order_status: 'paid', created_at: isoDaysAgo(8), paid_at: isoDaysAgo(8), updated_at: isoDaysAgo(1) },
      { _id: 'order-failed', merchant_id: 'merchant-one', final_amount: 750, order_status: 'failed', created_at: isoDaysAgo(1) },
      { _id: 'other-order', merchant_id: 'merchant-two', final_amount: 99999, order_status: 'paid', created_at: isoDaysAgo(1) },
    ]);

    await testCollection('checkout_sessions').insertMany([
      { _id: 'session-1', merchant_id: 'merchant-one', payment_status: 'success', created_at: isoDaysAgo(1) },
      { _id: 'session-2', merchant_id: 'merchant-one', payment_status: 'success', created_at: isoDaysAgo(2) },
      { _id: 'session-3', merchant_id: 'merchant-one', payment_status: 'failed', created_at: isoDaysAgo(2) },
      { _id: 'session-4', merchant_id: 'merchant-one', payment_status: 'expired', created_at: isoDaysAgo(3) },
      { _id: 'old-session', merchant_id: 'merchant-one', payment_status: 'success', created_at: isoDaysAgo(8) },
    ]);

    await testCollection('transaction_logs').insertMany([
      { _id: 'tx-1', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_status: 'success', initiated_at: isoDaysAgo(1), latency_ms: 100 },
      { _id: 'tx-2', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 1000, payment_status: 'success', initiated_at: isoDaysAgo(2), latency_ms: 200 },
      { _id: 'tx-3', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 750, payment_status: 'failed', initiated_at: isoDaysAgo(2), latency_ms: 300 },
      { _id: 'tx-pending', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 1200, payment_status: 'pending', initiated_at: isoDaysAgo(1), latency_ms: null },
      { _id: 'other-tx', merchant_id: 'merchant-two', pg_name: 'other', amount: 99999, payment_status: 'success', initiated_at: isoDaysAgo(1), latency_ms: 5 },
    ]);

    await testCollection('offers').insertMany([
      { _id: 'offer-active', merchant_id: 'merchant-one', status: 'active' },
      { _id: 'offer-other', merchant_id: 'merchant-two', status: 'active' },
    ]);

    await testCollection('redemptions').insertMany([
      { _id: 'redemption-1', merchant_id: 'merchant-one', order_status: 'paid', discount_applied: 40, applied_at: isoDaysAgo(1) },
      { _id: 'redemption-2', merchant_id: 'merchant-one', order_status: 'abandoned', discount_applied: 60, applied_at: isoDaysAgo(2) },
      { _id: 'other-redemption', merchant_id: 'merchant-two', order_status: 'paid', discount_applied: 9000, applied_at: isoDaysAgo(1) },
    ]);

    await testCollection('pg_alerts').insertMany([
      { _id: 'alert-critical', merchant_id: 'merchant-one', status: 'active', severity: 'critical', created_at: isoDaysAgo(1) },
      { _id: 'other-alert', merchant_id: 'merchant-two', status: 'active', severity: 'critical', created_at: isoDaysAgo(1) },
    ]);

    await testCollection('subsidy_ledger').insertMany([
      { _id: 'subsidy-pending', merchant_id: 'merchant-one', brand: 'Samsung', amount: 250, settlement_status: 'pending', imei_blocked: false },
      { _id: 'subsidy-imei', merchant_id: 'merchant-one', brand: 'Samsung', amount: 100, settlement_status: 'imei_blocked', imei_blocked: false },
      { _id: 'other-subsidy', merchant_id: 'merchant-two', brand: 'Other', amount: 10000, settlement_status: 'pending', imei_blocked: false },
    ]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/dashboard/overview?period=7d',
      headers: { 'x-api-key': 'merchant-one-key' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.performance).toMatchObject({
      gross_payment_volume: 1700,
      paid_orders: 3,
      average_order_value: 566.67,
      checkout_sessions: 4,
      session_to_paid_conversion_rate: 75,
      payment_attempt_success_rate: 66.67,
    });
    expect(body.funnel).toMatchObject({
      sessions_created: 4,
      payment_attempts: 4,
      paid: 3,
      failed: 1,
      expired: 1,
    });
    expect(body.offers).toMatchObject({
      active_offers: 1,
      redemptions: 2,
      paid_redemptions: 1,
      discounts_granted: 100,
    });
    expect(body.attention).toMatchObject({
      active_alerts: 1,
      critical_alerts: 1,
      failed_payments: 1,
      expired_sessions: 1,
      pending_subsidy_entries: 2,
      imei_actions_required: 1,
    });
    expect(body.finance).toMatchObject({
      pending_subsidy_amount: 350,
      pending_subsidy_entries: 2,
      brands_with_open_subsidy: 1,
    });
  });

  it('rejects an unsupported period', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/dashboard/overview?period=14d',
      headers: { 'x-api-key': 'merchant-one-key' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns complete zero-value sections for a merchant with no activity', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/dashboard/overview',
      headers: { 'x-api-key': 'merchant-one-key' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.performance).toMatchObject({ gross_payment_volume: 0, paid_orders: 0 });
    expect(body.funnel).toMatchObject({ sessions_created: 0, payment_attempts: 0 });
    expect(body.gateways).toEqual([]);
    expect(body.recent_activity).toEqual([]);
  });

  it('excludes refunds and pending attempts from payment success-rate calculations', async () => {
    await testCollection('transaction_logs').insertMany([
      { _id: 'live-success', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_method: 'upi', payment_status: 'success', initiated_at: isoDaysAgo(0), latency_ms: 100 },
      { _id: 'live-failed', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_method: 'upi', payment_status: 'failed', initiated_at: isoDaysAgo(0), latency_ms: 100 },
      { _id: 'live-pending-one', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_method: 'upi', payment_status: 'pending', initiated_at: isoDaysAgo(0), latency_ms: null },
      { _id: 'live-pending-two', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_method: 'upi', payment_status: 'pending', initiated_at: isoDaysAgo(0), latency_ms: null },
      { _id: 'live-refund', merchant_id: 'merchant-one', pg_name: 'razorpay', amount: 500, payment_method: 'refund', payment_status: 'success', initiated_at: isoDaysAgo(0), latency_ms: 0 },
    ]);

    const response = await server.inject({
      method: 'GET',
      url: '/api/dashboard/overview?period=7d',
      headers: { 'x-api-key': 'merchant-one-key' },
    });

    const body = JSON.parse(response.body);
    expect(body.performance.payment_attempt_success_rate).toBe(50);
    expect(body.funnel.payment_attempts).toBe(4);
    expect(body.gateways).toContainEqual(expect.objectContaining({
      pg_name: 'razorpay',
      attempts_1h: 4,
      success_rate_1h: 50,
      status: 'critical',
    }));
    expect(body.recent_activity.map((activity: { id: string }) => activity.id)).not.toContain('live-refund');
  });
});
