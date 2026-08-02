import type { Db } from 'mongodb';
import {
  startTestDatabase,
  stopTestDatabase,
  clearTestDatabase,
} from '../../../test/setup-db';
import { MongoOrderRepository } from './mongo-order-repository';
import type { Order } from '../schemas/order';

describe('MongoOrderRepository', () => {
  let db: Db;
  let repository: MongoOrderRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repository = new MongoOrderRepository(db);
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('creates an order and returns it', async () => {
    const order: Order = {
      _id: 'ord_123',
      merchant_id: 'merch_123',
      session_id: 'sess_123',
      cart_amount: 1000,
      total_discount: 100,
      final_amount: 900,
      customer_info: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9999999999',
        address: {
          line1: '123 Main St',
          city: 'Bangalore',
          state: 'KA',
          pincode: '560001',
        },
      },
      applied_offers: [
        { offer_id: 'offer_1', type: 'coupon', discount_amount: 100 },
      ],
      payment_method: 'card',
      pg_transaction_id: 'txn_123',
      merchant_order_id: null,
      pg_order_id: 'pg_ord_123',
      pg_payment_id: 'pg_pay_123',
      pg_raw_response: null,
      pg_name: 'Razorpay',
      order_status: 'created',
      emi_details: null,
      created_at: new Date().toISOString(),
    };

    const created = await repository.create(order);
    expect(created._id).toBe('ord_123');
    expect(created.merchant_id).toBe('merch_123');
    expect(created.cart_amount).toBe(1000);
    expect(created.final_amount).toBe(900);
  });

  it('finds order by id and merchant_id with tenant isolation', async () => {
    const order: Order = {
      _id: 'ord_123',
      merchant_id: 'merch_123',
      session_id: 'sess_123',
      cart_amount: 1000,
      total_discount: 100,
      final_amount: 900,
      customer_info: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9999999999',
        address: {
          line1: '123 Main St',
          city: 'Bangalore',
          state: 'KA',
          pincode: '560001',
        },
      },
      applied_offers: [],
      payment_method: 'card',
      pg_transaction_id: null,
      merchant_order_id: null,
      pg_order_id: null,
      pg_payment_id: null,
      pg_raw_response: null,
      pg_name: 'Razorpay',
      order_status: 'created',
      emi_details: null,
      created_at: new Date().toISOString(),
    };

    await repository.create(order);
    const found = await repository.findById('ord_123', 'merch_123');
    expect(found).not.toBeNull();
    expect(found?.merchant_id).toBe('merch_123');
  });

  it('returns null when finding order with different merchant_id (tenant isolation)', async () => {
    const order: Order = {
      _id: 'ord_123',
      merchant_id: 'merch_123',
      session_id: 'sess_123',
      cart_amount: 1000,
      total_discount: 100,
      final_amount: 900,
      customer_info: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9999999999',
        address: {
          line1: '123 Main St',
          city: 'Bangalore',
          state: 'KA',
          pincode: '560001',
        },
      },
      applied_offers: [],
      payment_method: 'card',
      pg_transaction_id: null,
      merchant_order_id: null,
      pg_order_id: null,
      pg_payment_id: null,
      pg_raw_response: null,
      pg_name: 'Razorpay',
      order_status: 'created',
      emi_details: null,
      created_at: new Date().toISOString(),
    };

    await repository.create(order);
    const found = await repository.findById('ord_123', 'merch_different');
    expect(found).toBeNull();
  });

  it('finds orders by merchant with pagination', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 15; i++) {
      const order: Order = {
        _id: `ord_${i}`,
        merchant_id: 'merch_123',
        session_id: `sess_${i}`,
        cart_amount: 1000 + i * 100,
        total_discount: 100,
        final_amount: 900 + i * 100,
        customer_info: {
          name: `Customer ${i}`,
          email: `customer${i}@example.com`,
          phone: '9999999999',
          address: {
            line1: '123 Main St',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560001',
          },
        },
        applied_offers: [],
        payment_method: 'card',
        pg_transaction_id: null,
        merchant_order_id: null,
        pg_order_id: null,
        pg_payment_id: null,
        pg_raw_response: null,
        pg_name: 'Razorpay',
        order_status: 'created',
        emi_details: null,
        created_at: now,
      };
      await repository.create(order);
    }

    const result = await repository.findByMerchant('merch_123', 1, 10);
    expect(result.orders).toHaveLength(10);
    expect(result.total).toBe(15);
  });
});
