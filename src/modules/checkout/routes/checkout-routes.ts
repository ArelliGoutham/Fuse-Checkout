import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateSessionSchema } from '../schemas/checkout-session';
import { MongoSessionRepository } from '../repositories/mongo-session-repository';
import { MongoOrderRepository } from '../repositories/mongo-order-repository';
import { calculateEMI } from '../services/emi-engine';
import { identifyBankFromBIN } from '../services/bin-lookup';
import { MockPGAdapter } from '../../pg-adapters/mock-adapter';
import type { Order } from '../schemas/order';

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
          checkout_url: `https://checkout.offerforge.io/${session._id}`,
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

        // Fetch bank rates
        let bankRates: any[] = [];
        if (bankCode) {
          bankRates = await db
            .collection('bank_rates')
            .find({ bank_code: bankCode, status: 'active' })
            .toArray();
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

        return reply.send({
          method,
          bank: bankCode || null,
          emi_options: emiOptions,
          final_amount: session.cart.amount,
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
    Body: { method: string };
  }>(
    '/api/checkout/:session_id/process-payment',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { session_id } = request.params as { session_id: string };

      const ProcessPaymentSchema = z.object({
        method: z.string(),
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
      const pgAdapter = new MockPGAdapter();

      try {
        const session = await sessionRepository.findByIdPublic(session_id);
        if (!session) {
          return reply.code(404).send({
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
          });
        }

        // Create PG order
        const pgOrder = await pgAdapter.createOrder({
          amount: session.cart.amount,
          payment_method: parseResult.data.method,
          options: {
            customer_email: session.customer_info?.email,
            customer_phone: session.customer_info?.phone,
          },
        });

        // Process payment
        const paymentResult = await pgAdapter.processPayment({
          order_id: pgOrder.order_id,
          payment_data: { method: parseResult.data.method },
        });

        if (paymentResult.status === 'success') {
          // Create Order record
          const now = new Date().toISOString();
          const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const order: Order = {
            _id: orderId,
            merchant_id: session.merchant_id,
            session_id,
            cart_amount: session.cart.amount,
            total_discount: session.applied_offers.reduce((sum, offer) => sum + offer.discount_amount, 0),
            final_amount: session.cart.amount,
            customer_info: session.customer_info!,
            applied_offers: session.applied_offers,
            payment_method: parseResult.data.method,
            pg_transaction_id: paymentResult.transaction_id,
            pg_name: 'MockPGAdapter',
            order_status: 'paid' as const,
            emi_details: null,
            created_at: now,
          };
          await orderRepository.create(order);

          // Update session payment status
          await sessionRepository.updatePaymentStatus(
            session_id,
            'success',
            paymentResult.transaction_id,
            orderId
          );

          return reply.send({
            order_id: orderId,
            status: 'success',
            redirect_url: session.redirect_urls.success,
          });
        } else {
          // Update session payment status to failed
          await sessionRepository.updatePaymentStatus(session_id, 'failed');
          return reply.code(400).send({
            error: {
              code: 'PAYMENT_FAILED',
              message: paymentResult.error_message || 'Payment processing failed',
            },
          });
        }
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' },
        });
      }
    }
  );
}
