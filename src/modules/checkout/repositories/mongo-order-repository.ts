import { Db, Collection } from 'mongodb';
import { Order, OrderSchema } from '../schemas/order';

/**
 * MongoDB repository for orders.
 * Manages order persistence, queries, and tenant isolation.
 */
export class MongoOrderRepository {
  private collection: Collection<Omit<Order, '_id'> & { _id: string }>;

  /**
   * Initializes the repository with a MongoDB database instance.
   * @param db - MongoDB database instance
   */
  constructor(db: Db) {
    this.collection = db.collection('orders');
  }

  /**
   * Creates a new order.
   * @param order - Order to create
   * @returns The created order
   */
  async create(order: Order): Promise<Order> {
    await this.collection.insertOne(order as any);
    return OrderSchema.parse(order);
  }

  /**
   * Finds an order by ID with tenant isolation.
   * @param id - Order ID
   * @param merchantId - Merchant ID (tenant isolation)
   * @returns The order or null if not found
   */
  async findById(id: string, merchantId: string): Promise<Order | null> {
    const doc = await this.collection.findOne({
      _id: id as any,
      merchant_id: merchantId,
    });

    if (!doc) return null;
    return OrderSchema.parse(doc);
  }

  /**
   * Finds orders by merchant with pagination.
   * @param merchantId - Merchant ID (tenant isolation)
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @returns Object with orders array and total count
   */
  async findByMerchant(
    merchantId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.collection
        .find({ merchant_id: merchantId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments({ merchant_id: merchantId }),
    ]);

    const orders = docs.map((doc) => OrderSchema.parse(doc));
    return { orders, total };
  }

  /**
   * Finds an order by merchant's own order ID with tenant isolation.
   * @param merchantOrderId - Merchant's order ID
   * @param merchantId - Merchant ID (tenant isolation)
   * @returns The order or null if not found
   */
  async findByMerchantOrderId(
    merchantOrderId: string,
    merchantId: string
  ): Promise<Order | null> {
    const doc = await this.collection.findOne({
      merchant_order_id: merchantOrderId,
      merchant_id: merchantId,
    });

    if (!doc) return null;
    return OrderSchema.parse(doc);
  }
}
