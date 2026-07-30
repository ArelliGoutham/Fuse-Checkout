import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateSessionSchema } from '../schemas/checkout-session';
import { MongoSessionRepository } from '../repositories/mongo-session-repository';
import { MongoOrderRepository } from '../repositories/mongo-order-repository';
import { MongoPGCredentialsRepository } from '../repositories/mongo-pg-credentials-repository';
import { calculateEMI } from '../services/emi-engine';
import { identifyBankFromBIN } from '../services/bin-lookup';
import { IINLookupService } from '../services/iin-database';
import { validateCampaignEligibility } from '../services/emi-campaign-engine';
import { SmartRouter } from '../services/smart-router';
import { MockPGAdapter } from '../../pg-adapters/mock-adapter';
import { RazorpayAdapter } from '../../pg-adapters/razorpay-adapter';
import type { PGAdapter } from '../../pg-adapters/types';
import type { Order } from '../schemas/order';
import type { IINRange } from '../schemas/iin-range';
import type { EMICampaign } from '../schemas/emi-campaign';
import type { SessionAuditLog } from '../schemas/session-audit-log';
import type { TransactionLog } from '../schemas/transaction-log';
import { decrypt } from '../../../lib/encryption';
import { OrderIdGenerator } from '../services/order-id-generator';

/**
 * Registers checkout session and payment processing routes for a Fastify instance.
 * Merchant API endpoints (create session, get session) require auth.
 * Checkout page endpoints (cart, customer, payment) use session_id for auth.
 *
 * @param server - Fastify instance (must have db decorator)
 */
export function registerCheckoutRoutes(server: FastifyInstance): void {
  /**
   * POST /api/checkout/sessions - Create a new checkout session (Merchant API)
   */
  server.post<{ Body: z.infer<typeof CreateSessionSchema> }>(
    '/api/checkout/sessions',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const parseResult = CreateSessionSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.create(parseResult.data, merchantId);
        return reply.code(201).send({
          session_id: session._id,
          checkout_url: `https://checkout.fuse.io/${session._id}`,
          expires_at: session.expires_at,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create session' },
        });
      }
    }
  );

  /**
   * GET /api/checkout/sessions/:id - Get session for merchant (Merchant API)
   */
  server.get<{ Params: { id: string } }>(
    '/api/checkout/sessions/:id',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findById(id, merchantId);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }
        return reply.send(session);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve session' },
        });
      }
    }
  );

  /**
   * GET /api/checkout/:session_id/cart - Load cart for checkout page (No auth)
   */
  server.get<{ Params: { session_id: string } }>(
    '/api/checkout/:session_id/cart',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { session_id } = request.params as { session_id: string };
      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findByIdPublic(session_id);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        return reply.send({
          cart: session.cart,
          merchant_id: session.merchant_id,
          customer: session.customer,
          applied_offers: session.applied_offers,
          payment_status: session.payment_status,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to load cart' },
        });
      }
    }
  );

  /**
   * POST /api/checkout/:session_id/customer - Save customer info (No auth)
   */
  server.post<{
    Params: { session_id: string };
    Body: {
      name: string;
      email: string;
      phone: string;
      address: { line1: string; city: string; state: string; pincode: string };
    };
  }>(
    '/api/checkout/:session_id/customer',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { session_id } = request.params as { session_id: string };

      const CustomerSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(10),
        address: z.object({
          line1: z.string().min(1),
          city: z.string().min(1),
          state: z.string().min(1),
          pincode: z.string().regex(/^\d{6}$/),
        }),
      });

      const parseResult = CustomerSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findByIdPublic(session_id);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        await repository.updateCustomer(session_id, session.merchant_id, parseResult.data);
        return reply.send({ saved: true });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to save customer info' },
        });
      }
    }
  );

  /**
   * POST /api/checkout/:session_id/select-payment - Select payment method and get EMI options (No auth)
   */
  server.post<{
    Params: { session_id: string };
    Body: { method: string; bank?: string; bin?: string; tenure?: number };
  }>(
    '/api/checkout/:session_id/select-payment',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { session_id } = request.params as { session_id: string };

      const SelectPaymentSchema = z.object({
        method: z.enum(['card', 'bank_transfer', 'upi']),
        bank: z.string().optional(),
        bin: z.string().optional(),
        tenure: z.number().int().positive().optional(),
      });

      const parseResult = SelectPaymentSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const db = server.db!;
      const sessionRepository = new MongoSessionRepository(db);

      try {
        const session = await sessionRepository.findByIdPublic(session_id);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        const { method, bin, tenure } = parseResult.data;

        let bankCode = parseResult.data.bank;
        if (method === 'card' && bin && !bankCode) {
          const identifiedBank = identifyBankFromBIN(bin);
          if (!identifiedBank) {
            return reply.code(400).send({
              error: { code: 'INVALID_BIN', message: 'Bank not found for this BIN' },
            });
          }
          bankCode = identifiedBank;
        }

        // Fetch bank rates (MongoDB returns generic Documents; cast to typed shape)
        let bankRates: Array<{
          bank_name: string;
          interest_rate: number;
          processing_fee: number | null;
          tenures: number[];
        }> = [];
        if (bankCode) {
          bankRates = (await db
            .collection('bank_rates')
            .find({ bank_code: bankCode, status: 'active' })
            .toArray()) as unknown as Array<{
            bank_name: string;
            interest_rate: number;
            processing_fee: number | null;
            tenures: number[];
          }>;
        }

        // Calculate EMI options for each tenure
        const emiOptions = [];
        if (bankRates.length > 0 && tenure) {
          const bankRate = bankRates[0];
          if (bankRate.tenures.includes(tenure)) {
            const emi = calculateEMI({
              principal: session.cart.amount,
              bankRate: {
                bank_name: bankRate.bank_name,
                interest_rate: bankRate.interest_rate,
                processing_fee: bankRate.processing_fee,
              },
              tenure,
              emiType: 'standard',
              subsidyAmount: null,
            });
            emiOptions.push({
              tenure,
              monthly_emi: emi.monthly_emi,
              total_payment: emi.total_payment,
              total_interest: emi.total_interest,
              processing_fee: emi.processing_fee,
            });
          }
        } else if (bankRates.length > 0) {
          // Calculate EMI for each available tenure
          const bankRate = bankRates[0];
          for (const t of bankRate.tenures) {
            const emi = calculateEMI({
              principal: session.cart.amount,
              bankRate: {
                bank_name: bankRate.bank_name,
                interest_rate: bankRate.interest_rate,
                processing_fee: bankRate.processing_fee,
              },
              tenure: t,
              emiType: 'standard',
              subsidyAmount: null,
            });
            emiOptions.push({
              tenure: t,
              monthly_emi: emi.monthly_emi,
              total_payment: emi.total_payment,
              total_interest: emi.total_interest,
              processing_fee: emi.processing_fee,
            });
          }
        }

        // Campaign EMI options
        let iinInfo: IINRange | null = null;
        const campaignEmiOptions: Array<{
          tenure: number;
          monthly_emi: number;
          customer_emi: number;
          total_payment: number;
          total_interest: number;
          customer_interest: number;
          subsidy_amount: number;
          processing_fee: number | null;
          emi_type: string;
          campaign_code: string;
          campaign_title: string;
        }> = [];

        if (method === 'card' && bin) {
          const iinRanges = (await db
            .collection('iin_ranges')
            .find({ status: 'active' })
            .toArray()) as unknown as IINRange[];

          const iinService = new IINLookupService();
          iinService.loadRanges(iinRanges);
          iinInfo = iinService.lookup(bin);

          if (iinInfo && session.cart.items.length > 0 && bankCode) {
            const campaigns = (await db
              .collection('emi_campaigns')
              .find({ status: 'active', bank: bankCode })
              .toArray()) as unknown as EMICampaign[];

            for (const campaign of campaigns) {
              const totalRedemptions = await db
                .collection('emi_redemptions')
                .countDocuments({ campaign_id: campaign._id });
              const merchantRedemptions = await db
                .collection('emi_redemptions')
                .countDocuments({
                  campaign_id: campaign._id,
                  merchant_id: session.merchant_id,
                });
              const cardRedemptions = await db
                .collection('emi_redemptions')
                .countDocuments({
                  campaign_id: campaign._id,
                  card_token: bin,
                });

              const productSkus = session.cart.items.map(i => i.sku_id);

              const campaignResult = validateCampaignEligibility({
                campaign,
                cardInfo: iinInfo,
                cartAmount: session.cart.amount,
                productSkus,
                merchantId: session.merchant_id,
                redemptionCounts: {
                  total_redemptions: totalRedemptions,
                  merchant_redemptions: merchantRedemptions,
                  card_redemptions: cardRedemptions,
                },
                now: new Date(),
              });

              if (campaignResult.eligible && bankRates.length > 0) {
                const bankRate = bankRates[0];
                for (const t of bankRate.tenures) {
                  const campaignEmi = calculateEMI({
                    principal: session.cart.amount,
                    bankRate: {
                      bank_name: bankRate.bank_name,
                      interest_rate: bankRate.interest_rate,
                      processing_fee: bankRate.processing_fee,
                    },
                    tenure: t,
                    emiType: campaign.emi_type,
                    subsidyAmount: campaign.subsidy_amount || 'full',
                  });
                  campaignEmiOptions.push({
                    tenure: t,
                    monthly_emi: campaignEmi.monthly_emi,
                    customer_emi: campaignEmi.customer_emi,
                    total_payment: campaignEmi.total_payment,
                    total_interest: campaignEmi.total_interest,
                    customer_interest: campaignEmi.customer_interest,
                    subsidy_amount: campaignEmi.subsidy_amount,
                    processing_fee: campaignEmi.processing_fee,
                    emi_type: campaign.emi_type,
                    campaign_code: campaign.code,
                    campaign_title: campaign.title,
                  });
                }
              }
            }
          }
        }

        return reply.send({
          method,
          bank: bankCode || null,
          emi_options: emiOptions,
          final_amount: session.cart.amount,
          iin_info: iinInfo,
          campaign_emi_options: campaignEmiOptions,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to select payment method' },
        });
      }
    }
  );

  /**
   * POST /api/checkout/:session_id/process-payment - Process payment via PG (No auth)
   */
  server.post<{
    Params: { session_id: string };
    Body: { method: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  }>(
    '/api/checkout/:session_id/process-payment',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { session_id } = request.params as { session_id: string };

      const ProcessPaymentSchema = z.object({
        method: z.string(),
        razorpay_order_id: z.string().optional(),
        razorpay_payment_id: z.string().optional(),
        razorpay_signature: z.string().optional(),
      });

      const parseResult = ProcessPaymentSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const db = server.db!;
      const sessionRepository = new MongoSessionRepository(db);
      const orderRepository = new MongoOrderRepository(db);
      const pgCredsRepo = new MongoPGCredentialsRepository(db);
      const orderIdGenerator = new OrderIdGenerator(db);
      const encryptionKey = process.env.ENCRYPTION_KEY || 'fuse-encryption-key-change-me-32';

      try {
        const session = await sessionRepository.findByIdPublic(session_id);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        // Load merchant's PG credentials
        const pgCreds = await pgCredsRepo.findActive(session.merchant_id, 'razorpay');
        const pgAdapters: PGAdapter[] = [];

        if (pgCreds) {
          const apiKey = decrypt(pgCreds.api_key_encrypted, encryptionKey);
          const apiSecret = decrypt(pgCreds.api_secret_encrypted, encryptionKey);
          pgAdapters.push(new RazorpayAdapter(apiKey, apiSecret));
        }
        // Always include mock as fallback for development
        pgAdapters.push(new MockPGAdapter());

        // Smart router selects best PG
        const router = new SmartRouter(pgAdapters, db);
        const routingDecision = await router.route(session.merchant_id, session.cart.amount);

        // Generate order ID using new FUSE-YYMMDD-NNNNNN format
        const orderId = await orderIdGenerator.generateId();
        const now = new Date().toISOString();
        const initiatedAt = new Date();

        // Try primary PG, fall back on failure
        let paymentResult = null;
        let usedAdapter: PGAdapter = routingDecision.primary;
        let pgOrder = null;
        let attemptNumber = 1;

        for (const adapter of [routingDecision.primary, ...routingDecision.fallback]) {
          usedAdapter = adapter;
          try {
            // Create PG order
            pgOrder = await adapter.createOrder({
              amount: session.cart.amount,
              payment_method: parseResult.data.method,
              options: {
                customer_email: session.customer_info?.email,
                customer_phone: session.customer_info?.phone,
              },
            });

            // For Razorpay, payment is captured client-side — verify signature server-side
            if (adapter.getName() === 'razorpay' && parseResult.data.razorpay_payment_id) {
              paymentResult = await adapter.processPayment({
                order_id: pgOrder.order_id,
                payment_data: {
                  razorpay_order_id: parseResult.data.razorpay_order_id,
                  razorpay_payment_id: parseResult.data.razorpay_payment_id,
                  razorpay_signature: parseResult.data.razorpay_signature,
                },
              });
            } else {
              // Mock adapter — process directly
              paymentResult = await adapter.processPayment({
                order_id: pgOrder.order_id,
                payment_data: { method: parseResult.data.method },
              });
            }

            if (paymentResult.status === 'success') {
              break; // Payment succeeded, stop trying
            }

            // Log failed attempt to transaction_logs
            const completedAt = new Date();
            const txLog: TransactionLog = {
              _id: `txl_${orderId}_${attemptNumber}`,
              order_id: orderId,
              session_id,
              merchant_id: session.merchant_id,
              merchant_order_id: session.merchant_order_id ?? null,
              attempt_number: attemptNumber,
              pg_name: adapter.getName(),
              pg_order_id: pgOrder?.order_id ?? null,
              pg_payment_id: paymentResult.transaction_id || null,
              pg_status: paymentResult.status,
              pg_error_code: null,
              pg_error_message: paymentResult.error_message ?? null,
              pg_raw_request: { method: parseResult.data.method, amount: session.cart.amount },
              pg_raw_response: paymentResult as unknown as Record<string, unknown>,
              amount: session.cart.amount,
              payment_method: parseResult.data.method,
              payment_status: 'failed',
              routing_reason: routingDecision.reason,
              is_fallback: attemptNumber > 1,
              initiated_at: initiatedAt.toISOString(),
              completed_at: completedAt.toISOString(),
              latency_ms: completedAt.getTime() - initiatedAt.getTime(),
              created_at: now,
            };
            await db.collection('transaction_logs').insertOne(txLog as any);

            attemptNumber++;
          } catch (err) {
            // Log exception and try next PG
            const completedAt = new Date();
            const txLog: TransactionLog = {
              _id: `txl_${orderId}_${attemptNumber}`,
              order_id: orderId,
              session_id,
              merchant_id: session.merchant_id,
              merchant_order_id: session.merchant_order_id ?? null,
              attempt_number: attemptNumber,
              pg_name: adapter.getName(),
              pg_order_id: pgOrder?.order_id ?? null,
              pg_payment_id: null,
              pg_status: 'error',
              pg_error_code: null,
              pg_error_message: err instanceof Error ? err.message : 'Unknown error',
              pg_raw_request: { method: parseResult.data.method, amount: session.cart.amount },
              pg_raw_response: {},
              amount: session.cart.amount,
              payment_method: parseResult.data.method,
              payment_status: 'failed',
              routing_reason: routingDecision.reason,
              is_fallback: attemptNumber > 1,
              initiated_at: initiatedAt.toISOString(),
              completed_at: completedAt.toISOString(),
              latency_ms: completedAt.getTime() - initiatedAt.getTime(),
              created_at: now,
            };
            await db.collection('transaction_logs').insertOne(txLog as any);
            attemptNumber++;
          }
        }

        if (!paymentResult || paymentResult.status !== 'success') {
          // All PGs failed
          await sessionRepository.updatePaymentStatus(session_id, 'failed');
          return reply.code(400).send({
            error: {
              code: 'PAYMENT_FAILED',
              message: paymentResult?.error_message || 'All payment gateways failed',
            },
          });
        }

        // Log successful transaction
        const completedAt = new Date();
        const successTxLog: TransactionLog = {
          _id: `txl_${orderId}_${attemptNumber}`,
          order_id: orderId,
          session_id,
          merchant_id: session.merchant_id,
          merchant_order_id: session.merchant_order_id ?? null,
          attempt_number: attemptNumber,
          pg_name: usedAdapter.getName(),
          pg_order_id: pgOrder?.order_id ?? null,
          pg_payment_id: paymentResult.transaction_id,
          pg_status: 'captured',
          pg_error_code: null,
          pg_error_message: null,
          pg_raw_request: { method: parseResult.data.method, amount: session.cart.amount },
          pg_raw_response: paymentResult as unknown as Record<string, unknown>,
          amount: session.cart.amount,
          payment_method: parseResult.data.method,
          payment_status: 'success',
          routing_reason: routingDecision.reason,
          is_fallback: attemptNumber > 1,
          initiated_at: initiatedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          latency_ms: completedAt.getTime() - initiatedAt.getTime(),
          created_at: now,
        };
        await db.collection('transaction_logs').insertOne(successTxLog as any);

        // Create Order record
        const order: Order = {
          _id: orderId,
          merchant_id: session.merchant_id,
          session_id,
          merchant_order_id: session.merchant_order_id ?? null,
          cart_amount: session.cart.amount,
          total_discount: session.applied_offers.reduce((sum, offer) => sum + offer.discount_amount, 0),
          final_amount: session.cart.amount,
          customer_info: session.customer_info!,
          applied_offers: session.applied_offers,
          payment_method: parseResult.data.method,
          pg_name: usedAdapter.getName(),
          pg_order_id: pgOrder?.order_id ?? null,
          pg_payment_id: paymentResult.transaction_id,
          pg_raw_response: paymentResult as unknown as Record<string, unknown>,
          pg_transaction_id: paymentResult.transaction_id,
          order_status: 'paid' as const,
          emi_details: null,
          created_at: now,
          updated_at: now,
        };
        await orderRepository.create(order);

        // Update session payment status
        await sessionRepository.updatePaymentStatus(
          session_id,
          'success',
          paymentResult.transaction_id,
          orderId
        );

        // Audit log
        await db.collection('session_audit_logs').insertOne({
          session_id,
          merchant_id: session.merchant_id,
          action: 'payment_success',
          previous_state: 'pending',
          new_state: 'success',
          changed_by: 'system',
          metadata: { order_id: orderId, pg_name: usedAdapter.getName(), pg_payment_id: paymentResult.transaction_id },
          timestamp: now,
        } as any);

        return reply.send({
          order_id: orderId,
          status: 'success',
          pg_name: usedAdapter.getName(),
          pg_order_id: pgOrder?.order_id,
          redirect_url: session.redirect_urls.success,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' },
        });
      }
    }
  );

  /**
   * PATCH /api/checkout/sessions/:id - Update session cart (Merchant API)
   * Only allowed when session payment_status is 'pending'.
   * Logs the change to session_audit_logs.
   */
  server.patch<{ Params: { id: string } }>(
    '/api/checkout/sessions/:id',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const UpdateCartSchema = z.object({
        cart: z.object({
          amount: z.number().positive(),
          items: z.array(
            z.object({
              sku_id: z.string(),
              name: z.string(),
              price: z.number().positive(),
              qty: z.number().int().positive(),
              category: z.string().optional(),
              brand: z.string().optional(),
            })
          ),
        }),
      });

      const parseResult = UpdateCartSchema.safeParse(
        request.body as Record<string, unknown>
      );
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findById(id, merchantId);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        if (session.payment_status !== 'pending') {
          return reply.code(409).send({
            error: {
              code: 'SESSION_NOT_PENDING',
              message: `Session is in '${session.payment_status}' state, only pending sessions can be updated`,
            },
          });
        }

        const previousState = session.payment_status;
        const updated = await repository.updateCart(id, merchantId, parseResult.data.cart);
        if (!updated) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        const auditLog: SessionAuditLog = {
          _id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          session_id: id,
          merchant_id: merchantId,
          action: 'cart_updated',
          previous_state: previousState,
          new_state: updated.payment_status,
          changed_by: 'merchant',
          metadata: { cart: parseResult.data.cart },
          timestamp: new Date().toISOString(),
        };
        await db.collection('session_audit_logs').insertOne(auditLog as any);

        return reply.send(updated);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update session cart' },
        });
      }
    }
  );

  /**
   * POST /api/checkout/sessions/:id/retry - Clone a failed/expired session for retry (Merchant API)
   * Only allowed when the source session is 'failed' or 'expired'.
   * Creates a new pending session with original_session_id set.
   */
  server.post<{ Params: { id: string } }>(
    '/api/checkout/sessions/:id/retry',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findById(id, merchantId);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        const isExpired =
          session.payment_status === 'expired' ||
          new Date(session.expires_at).getTime() < Date.now();
        const isFailed = session.payment_status === 'failed';

        if (!isFailed && !isExpired) {
          return reply.code(409).send({
            error: {
              code: 'SESSION_NOT_RETRYABLE',
              message:
                'Only failed or expired sessions can be retried',
            },
          });
        }

        const previousState = session.payment_status;
        const newSession = await repository.clone(session);

        const auditLog: SessionAuditLog = {
          _id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          session_id: newSession._id,
          merchant_id: merchantId,
          action: 'retried',
          previous_state: previousState,
          new_state: newSession.payment_status,
          changed_by: 'merchant',
          metadata: { original_session_id: id },
          timestamp: new Date().toISOString(),
        };
        await db.collection('session_audit_logs').insertOne(auditLog as any);

        return reply.code(201).send({
          session_id: newSession._id,
          checkout_url: `https://checkout.fuse.io/${newSession._id}`,
          original_session_id: id,
          expires_at: newSession.expires_at,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retry session' },
        });
      }
    }
  );

  /**
   * POST /api/checkout/sessions/:id/expire - Manually expire a session (Merchant API)
   * Only allowed when session payment_status is 'pending'.
   */
  server.post<{ Params: { id: string } }>(
    '/api/checkout/sessions/:id/expire',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const repository = new MongoSessionRepository(db);

      try {
        const session = await repository.findById(id, merchantId);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        if (session.payment_status !== 'pending') {
          return reply.code(409).send({
            error: {
              code: 'SESSION_NOT_PENDING',
              message: `Session is in '${session.payment_status}' state, only pending sessions can be expired`,
            },
          });
        }

        const previousState = session.payment_status;
        const updated = await repository.updatePaymentStatusById(
          id,
          merchantId,
          'expired'
        );
        if (!updated) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        const auditLog: SessionAuditLog = {
          _id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          session_id: id,
          merchant_id: merchantId,
          action: 'expired',
          previous_state: previousState,
          new_state: 'expired',
          changed_by: 'merchant',
          metadata: {},
          timestamp: new Date().toISOString(),
        };
        await db.collection('session_audit_logs').insertOne(auditLog as any);

        return reply.send({ session_id: id, payment_status: 'expired' });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to expire session' },
        });
      }
    }
  );
}
