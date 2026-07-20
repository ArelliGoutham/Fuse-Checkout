import { Db, Collection } from 'mongodb';
import {
  CheckoutSession,
  CreateSessionInput,
  CheckoutSessionSchema,
} from '../schemas/checkout-session';

/**
 * MongoDB repository for checkout sessions.
 * Manages session lifecycle: creation, querying, and updates with tenant isolation.
 */
export class MongoSessionRepository {
  private collection: Collection<Omit<CheckoutSession, '_id'> & { _id: string }>;

  /**
   * Initializes the repository with a MongoDB database instance.
   * @param db - MongoDB database instance
   */
  constructor(db: Db) {
    this.collection = db.collection('checkout_sessions');
  }

  /**
   * Creates a new checkout session.
   * Generates an ID with format: sess_{timestamp}_{random}
   * Sets expires_at to 30 minutes from creation time.
   * @param input - Session creation input
   * @param merchantId - Merchant ID (tenant isolation)
   * @returns The created session
   */
  async create(input: CreateSessionInput, merchantId: string): Promise<CheckoutSession> {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).substring(2, 10);
    const sessionId = `sess_${timestamp}_${random}`;

    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

    const session: CheckoutSession = {
      _id: sessionId,
      merchant_id: merchantId,
      cart: input.cart,
      customer: input.customer ?? null,
      customer_info: null,
      applied_offers: [],
      payment_method: null,
      payment_status: 'pending',
      pg_transaction_id: null,
      order_id: null,
      redirect_urls: input.redirect_urls,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    await this.collection.insertOne(session as any);
    return CheckoutSessionSchema.parse(session);
  }

  /**
   * Finds a session by ID with merchant isolation.
   * @param id - Session ID
   * @param merchantId - Merchant ID (tenant isolation)
   * @returns The session or null if not found
   */
  async findById(id: string, merchantId: string): Promise<CheckoutSession | null> {
    const doc = await this.collection.findOne({
      _id: id as any,
      merchant_id: merchantId,
    });

    if (!doc) return null;
    return CheckoutSessionSchema.parse(doc);
  }

  /**
   * Finds a session by ID without merchant isolation (for public checkout page).
   * Use with caution - only for endpoints that don't require merchant auth.
   * @param id - Session ID
   * @returns The session or null if not found
   */
  async findByIdPublic(id: string): Promise<CheckoutSession | null> {
    const doc = await this.collection.findOne({
      _id: id as any,
    });

    if (!doc) return null;
    return CheckoutSessionSchema.parse(doc);
  }

  /**
   * Updates customer information for a session.
   * @param id - Session ID
   * @param merchantId - Merchant ID (tenant isolation)
   * @param customerInfo - Customer information to update
   * @returns The updated session or null if not found
   */
  async updateCustomer(
    id: string,
    merchantId: string,
    customerInfo: CheckoutSession['customer_info']
  ): Promise<CheckoutSession | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id as any, merchant_id: merchantId },
      { $set: { customer_info: customerInfo } },
      { returnDocument: 'after' }
    );

    if (!result) return null;
    return CheckoutSessionSchema.parse(result);
  }

  /**
   * Updates payment status and related fields.
   * @param id - Session ID
   * @param status - New payment status
   * @param pgTransactionId - Optional PG transaction ID
   * @param orderId - Optional Order ID
   * @returns The updated session or null if not found
   */
  async updatePaymentStatus(
    id: string,
    status: CheckoutSession['payment_status'],
    pgTransactionId?: string,
    orderId?: string
  ): Promise<CheckoutSession | null> {
    const updateFields: Record<string, unknown> = { payment_status: status };
    if (pgTransactionId) updateFields.pg_transaction_id = pgTransactionId;
    if (orderId) updateFields.order_id = orderId;

    const result = await this.collection.findOneAndUpdate(
      { _id: id as any },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) return null;
    return CheckoutSessionSchema.parse(result);
  }
}
