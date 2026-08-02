import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const PeriodSchema = z.enum(['7d', '30d', '90d']).default('30d');

type OverviewQuery = { period?: string };

interface GatewayPerformance {
  _id: string;
  attempts_1h: number;
  successful_1h: number;
  completed_attempts_1h: number;
  avg_latency_ms_1h: number | null;
}

interface RecentTransaction {
  _id: string;
  payment_status: string;
  amount: number;
  initiated_at: string;
}

interface DailyGMV {
  _id: string;
  gross_payment_volume: number;
  paid_orders: number;
}

interface PaymentBreakdown {
  _id: string | null;
  successful_payments: number;
  payment_volume: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPeriod(period: z.infer<typeof PeriodSchema>) {
  const now = new Date();
  const days = Number.parseInt(period, 10);
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  return { key: period, from: from.toISOString(), to: now.toISOString() };
}

function dailyBuckets(period: z.infer<typeof PeriodSchema>): string[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = Number.parseInt(period, 10);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

export function registerDashboardRoutes(server: FastifyInstance): void {
  server.get<{ Querystring: OverviewQuery }>(
    '/api/dashboard/overview',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const parsedPeriod = PeriodSchema.safeParse((request.query as OverviewQuery).period);
      if (!parsedPeriod.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'period must be 7d, 30d, or 90d' },
        });
      }

      const period = getPeriod(parsedPeriod.data);
      const db = server.db;
      if (!db) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Database not available' },
        });
      }
      const periodFilter = { $gte: period.from, $lte: period.to };
      const merchantFilter = { merchant_id: merchantId };
      const paymentAttemptFilter = { ...merchantFilter, payment_method: { $ne: 'refund' } };
      const paidOrderFilter = {
        ...merchantFilter,
        order_status: 'paid',
        $or: [
          { paid_at: periodFilter },
          { paid_at: { $exists: false }, created_at: periodFilter },
        ],
      };

      try {
        const [orders, sessions, transactions, gatewayPerformance, alerts, activeOffers, redemptions, subsidies, recentTransactions, dailyGMV, paymentMethods, paymentGateways] = await Promise.all([
          db.collection('orders').aggregate([
            { $match: paidOrderFilter },
            { $group: { _id: null, paid_orders: { $sum: 1 }, gross_payment_volume: { $sum: '$final_amount' } } },
          ]).toArray(),
          db.collection('checkout_sessions').aggregate([
            { $match: { ...merchantFilter, created_at: periodFilter } },
            {
              $group: {
                _id: null,
                sessions_created: { $sum: 1 },
                failed: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
                expired: { $sum: { $cond: [{ $eq: ['$payment_status', 'expired'] }, 1, 0] } },
              },
            },
          ]).toArray(),
          db.collection('transaction_logs').aggregate([
            { $match: { ...paymentAttemptFilter, initiated_at: periodFilter } },
            {
              $group: {
                _id: null,
                payment_attempts: { $sum: 1 },
                successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
              },
            },
          ]).toArray(),
          db.collection('transaction_logs').aggregate<GatewayPerformance>([
            {
              $match: {
                ...paymentAttemptFilter,
                initiated_at: { $gte: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
              },
            },
            {
              $group: {
                _id: '$pg_name',
                attempts_1h: { $sum: 1 },
                successful_1h: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
                completed_attempts_1h: {
                  $sum: { $cond: [{ $in: ['$payment_status', ['success', 'failed']] }, 1, 0] },
                },
                avg_latency_ms_1h: { $avg: '$latency_ms' },
              },
            },
          ]).toArray(),
          db.collection('pg_alerts').aggregate([
            { $match: { ...merchantFilter, status: 'active' } },
            {
              $group: {
                _id: null,
                active_alerts: { $sum: 1 },
                critical_alerts: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
              },
            },
          ]).toArray(),
          db.collection('offers').countDocuments({ ...merchantFilter, status: 'active' }),
          db.collection('redemptions').aggregate([
            { $match: { ...merchantFilter, applied_at: periodFilter } },
            {
              $group: {
                _id: null,
                redemptions: { $sum: 1 },
                paid_redemptions: { $sum: { $cond: [{ $eq: ['$order_status', 'paid'] }, 1, 0] } },
                discounts_granted: { $sum: '$discount_applied' },
              },
            },
          ]).toArray(),
          db.collection('subsidy_ledger').aggregate([
            { $match: { ...merchantFilter, settlement_status: { $in: ['pending', 'imei_blocked'] } } },
            {
              $group: {
                _id: null,
                pending_subsidy_amount: { $sum: '$amount' },
                pending_subsidy_entries: { $sum: 1 },
                brands: { $addToSet: '$brand' },
                imei_actions_required: { $sum: { $cond: [{ $eq: ['$settlement_status', 'imei_blocked'] }, 1, 0] } },
              },
            },
          ]).toArray(),
          db.collection<RecentTransaction>('transaction_logs')
            .find({ ...paymentAttemptFilter, initiated_at: periodFilter }, { projection: { _id: 1, order_id: 1, payment_status: 1, amount: 1, initiated_at: 1 } })
            .sort({ initiated_at: -1 })
            .limit(8)
            .toArray(),
          db.collection('orders').aggregate<DailyGMV>([
            { $match: paidOrderFilter },
            { $project: { final_amount: 1, paid_date: { $ifNull: ['$paid_at', '$created_at'] } } },
            {
              $group: {
                _id: { $substrBytes: ['$paid_date', 0, 10] },
                gross_payment_volume: { $sum: '$final_amount' },
                paid_orders: { $sum: 1 },
              },
            },
          ]).toArray(),
          db.collection('transaction_logs').aggregate<PaymentBreakdown>([
            { $match: { ...paymentAttemptFilter, initiated_at: periodFilter, payment_status: 'success' } },
            { $group: { _id: '$payment_method', successful_payments: { $sum: 1 }, payment_volume: { $sum: '$amount' } } },
            { $sort: { payment_volume: -1 } },
          ]).toArray(),
          db.collection('transaction_logs').aggregate<PaymentBreakdown>([
            { $match: { ...paymentAttemptFilter, initiated_at: periodFilter, payment_status: 'success' } },
            { $group: { _id: '$pg_name', successful_payments: { $sum: 1 }, payment_volume: { $sum: '$amount' } } },
            { $sort: { payment_volume: -1 } },
          ]).toArray(),
        ]);

        const orderStats = orders[0] || { paid_orders: 0, gross_payment_volume: 0 };
        const sessionStats = sessions[0] || { sessions_created: 0, failed: 0, expired: 0 };
        const transactionStats = transactions[0] || { payment_attempts: 0, successful: 0, failed: 0 };
        const alertStats = alerts[0] || { active_alerts: 0, critical_alerts: 0 };
        const offerStats = redemptions[0] || { redemptions: 0, paid_redemptions: 0, discounts_granted: 0 };
        const subsidyStats = subsidies[0] || { pending_subsidy_amount: 0, pending_subsidy_entries: 0, brands: [], imei_actions_required: 0 };
        const completedAttempts = transactionStats.successful + transactionStats.failed;
        const dailyGMVByDate = new Map(dailyGMV.map((day) => [day._id, day]));

        return reply.send({
          period,
          performance: {
            gross_payment_volume: orderStats.gross_payment_volume,
            paid_orders: orderStats.paid_orders,
            average_order_value: orderStats.paid_orders > 0 ? round(orderStats.gross_payment_volume / orderStats.paid_orders) : 0,
            checkout_sessions: sessionStats.sessions_created,
            session_to_paid_conversion_rate: sessionStats.sessions_created > 0
              ? round((orderStats.paid_orders / sessionStats.sessions_created) * 100)
              : 0,
            payment_attempt_success_rate: completedAttempts > 0
              ? round((transactionStats.successful / completedAttempts) * 100)
              : 0,
          },
          funnel: {
            sessions_created: sessionStats.sessions_created,
            payment_attempts: transactionStats.payment_attempts,
            paid: orderStats.paid_orders,
            failed: transactionStats.failed,
            expired: sessionStats.expired,
          },
          gateways: gatewayPerformance.map((gateway) => {
            const successRate = gateway.completed_attempts_1h > 0
              ? round((gateway.successful_1h / gateway.completed_attempts_1h) * 100)
              : 0;
            return {
              pg_name: gateway._id,
              status: gateway.completed_attempts_1h === 0 ? 'no_data' : successRate >= 90 ? 'healthy' : successRate >= 70 ? 'degraded' : 'critical',
              attempts_1h: gateway.attempts_1h,
              success_rate_1h: successRate,
              avg_latency_ms_1h: Math.round(gateway.avg_latency_ms_1h || 0),
            };
          }),
          attention: {
            active_alerts: alertStats.active_alerts,
            critical_alerts: alertStats.critical_alerts,
            failed_payments: transactionStats.failed,
            expired_sessions: sessionStats.expired,
            pending_subsidy_entries: subsidyStats.pending_subsidy_entries,
            imei_actions_required: subsidyStats.imei_actions_required,
          },
          offers: {
            active_offers: activeOffers,
            redemptions: offerStats.redemptions,
            paid_redemptions: offerStats.paid_redemptions,
            conversion_rate: offerStats.redemptions > 0 ? round((offerStats.paid_redemptions / offerStats.redemptions) * 100) : 0,
            discounts_granted: offerStats.discounts_granted,
          },
          finance: {
            pending_subsidy_amount: subsidyStats.pending_subsidy_amount,
            pending_subsidy_entries: subsidyStats.pending_subsidy_entries,
            brands_with_open_subsidy: subsidyStats.brands.filter(Boolean).length,
          },
          daily_gmv: dailyBuckets(parsedPeriod.data).map((date) => {
            const day = dailyGMVByDate.get(date);
            return {
              date,
              gross_payment_volume: day?.gross_payment_volume || 0,
              paid_orders: day?.paid_orders || 0,
            };
          }),
          payment_methods: paymentMethods.map((method) => ({
            payment_method: method._id || 'unknown',
            successful_payments: method.successful_payments,
            payment_volume: method.payment_volume,
          })),
          payment_gateways: paymentGateways.map((gateway) => ({
            pg_name: gateway._id || 'unknown',
            successful_payments: gateway.successful_payments,
            payment_volume: gateway.payment_volume,
          })),
          recent_activity: recentTransactions.map((transaction) => ({
            type: 'payment',
            id: transaction._id,
            status: transaction.payment_status,
            amount: transaction.amount,
            occurred_at: transaction.initiated_at,
            destination: '/transactions',
          })),
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to build dashboard overview' },
        });
      }
    }
  );
}
