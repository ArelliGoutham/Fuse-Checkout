import { MockPGAdapter } from './mock-adapter';
import { CreateOrderParams, ProcessPaymentParams } from './types';

describe('MockPGAdapter', () => {
  let adapter: MockPGAdapter;

  beforeEach(() => {
    adapter = new MockPGAdapter();
  });

  it('creates an order with generated id and returns it', async () => {
    const params: CreateOrderParams = {
      amount: 1000,
      payment_method: 'card',
      options: {
        customer_email: 'test@example.com',
        customer_phone: '9999999999',
      },
    };

    const order = await adapter.createOrder(params);

    expect(order.order_id).toMatch(/^pg_mock_/);
    expect(order.amount).toBe(1000);
    expect(order.currency).toBe('INR');
    expect(order.status).toBe('created');
  });

  it('processes payment successfully for valid order with amount > 0', async () => {
    const createParams: CreateOrderParams = {
      amount: 1000,
      payment_method: 'card',
    };
    const order = await adapter.createOrder(createParams);

    const processParams: ProcessPaymentParams = {
      order_id: order.order_id,
      payment_data: { card_token: 'tok_12345' },
    };

    const result = await adapter.processPayment(processParams);

    expect(result.status).toBe('success');
    expect(result.transaction_id).toMatch(/^txn_/);
    expect(result.error_message).toBeUndefined();
  });

  it('processes payment with amount 0 returns failed', async () => {
    const createParams: CreateOrderParams = {
      amount: 0,
      payment_method: 'card',
    };
    const order = await adapter.createOrder(createParams);

    const processParams: ProcessPaymentParams = {
      order_id: order.order_id,
      payment_data: {},
    };

    const result = await adapter.processPayment(processParams);

    expect(result.status).toBe('failed');
    expect(result.error_message).toBeDefined();
  });

  it('processes payment with unknown order_id returns failed', async () => {
    const processParams: ProcessPaymentParams = {
      order_id: 'pg_mock_unknown',
      payment_data: {},
    };

    const result = await adapter.processPayment(processParams);

    expect(result.status).toBe('failed');
    expect(result.error_message).toBeDefined();
  });

  it('verifies payment returns verified true', async () => {
    const verification = await adapter.verifyPayment('txn_12345');

    expect(verification.verified).toBe(true);
    expect(verification.amount).toBeGreaterThan(0);
    expect(verification.status).toBe('success');
  });
});
