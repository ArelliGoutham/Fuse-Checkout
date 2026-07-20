import { Db } from 'mongodb';
import {
  startTestDatabase,
  stopTestDatabase,
  clearTestDatabase,
} from '../../../test/setup-db';
import { MongoSessionRepository } from './mongo-session-repository';
import { CreateSessionInput } from '../schemas/checkout-session';

describe('MongoSessionRepository', () => {
  let db: Db;
  let repository: MongoSessionRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repository = new MongoSessionRepository(db);
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('creates session with _id, sets expires_at to 30 min from now, and returns it', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [
          {
            sku_id: 'sku_123',
            name: 'Product 1',
            price: 500,
            qty: 2,
            category: 'Electronics',
            brand: 'Brand A',
          },
        ],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
      customer: { email: 'test@example.com', phone: '9999999999' },
    };

    const merchantId = 'merch_test_123';
    const now = new Date();
    const session = await repository.create(input, merchantId);

    expect(session._id).toMatch(/^sess_/);
    expect(session.merchant_id).toBe(merchantId);
    expect(session.cart).toEqual(input.cart);
    expect(session.customer).toEqual(input.customer);
    expect(session.payment_status).toBe('pending');
    expect(session.applied_offers).toEqual([]);
    expect(new Date(session.created_at).getTime()).toBeGreaterThanOrEqual(
      now.getTime() - 1000
    );
    expect(
      (new Date(session.expires_at).getTime() - new Date(session.created_at).getTime()) / 1000 /
        60
    ).toBeCloseTo(30, 0);
  });

  it('finds session by id and merchant_id with tenant isolation', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [{ sku_id: 'sku_123', name: 'Product 1', price: 500, qty: 2 }],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
    };

    const merchantId = 'merch_123';
    const session = await repository.create(input, merchantId);

    const found = await repository.findById(session._id, merchantId);
    expect(found).not.toBeNull();
    expect(found?.merchant_id).toBe(merchantId);
    expect(found?.cart).toEqual(input.cart);
  });

  it('returns null when finding session with different merchant_id (tenant isolation)', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [{ sku_id: 'sku_123', name: 'Product 1', price: 500, qty: 2 }],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
    };

    const merchantId = 'merch_123';
    const session = await repository.create(input, merchantId);

    const found = await repository.findById(session._id, 'merch_different');
    expect(found).toBeNull();
  });

  it('finds session by id without merchant_id for checkout page', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [{ sku_id: 'sku_123', name: 'Product 1', price: 500, qty: 2 }],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
    };

    const merchantId = 'merch_123';
    const session = await repository.create(input, merchantId);

    const found = await repository.findByIdPublic(session._id);
    expect(found).not.toBeNull();
    expect(found?.merchant_id).toBe(merchantId);
  });

  it('updates customer info', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [{ sku_id: 'sku_123', name: 'Product 1', price: 500, qty: 2 }],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
    };

    const merchantId = 'merch_123';
    const session = await repository.create(input, merchantId);

    const customerInfo = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '9999999999',
      address: {
        line1: '123 Main St',
        city: 'Bangalore',
        state: 'KA',
        pincode: '560001',
      },
    };

    const updated = await repository.updateCustomer(session._id, merchantId, customerInfo);
    expect(updated?.customer_info).toEqual(customerInfo);
  });

  it('updates payment status', async () => {
    const input: CreateSessionInput = {
      cart: {
        amount: 1000,
        items: [{ sku_id: 'sku_123', name: 'Product 1', price: 500, qty: 2 }],
      },
      redirect_urls: {
        success: 'https://example.com/success',
        cancel: 'https://example.com/cancel',
      },
    };

    const merchantId = 'merch_123';
    const session = await repository.create(input, merchantId);

    const updated = await repository.updatePaymentStatus(
      session._id,
      'success',
      'txn_12345',
      'ord_123'
    );
    expect(updated?.payment_status).toBe('success');
    expect(updated?.pg_transaction_id).toBe('txn_12345');
    expect(updated?.order_id).toBe('ord_123');
  });
});
