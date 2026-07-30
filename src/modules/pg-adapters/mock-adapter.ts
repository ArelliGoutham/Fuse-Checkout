import {
  PGAdapter,
  PGOrder,
  PGPaymentResult,
  PGVerification,
  CreateOrderParams,
  ProcessPaymentParams,
} from './types';

/**
 * Mock Payment Gateway Adapter for testing.
 * Stores orders in memory and simulates payment processing.
 */
export class MockPGAdapter implements PGAdapter {
  private orders: Map<string, PGOrder>;

  /**
   * Initializes the mock adapter with an empty orders store.
   */
  constructor() {
    this.orders = new Map();
  }

  /**
   * Returns the name of this PG adapter.
   */
  getName(): string {
    return 'mock';
  }

  /**
   * Creates a mock payment order.
   * Generates order ID in format: pg_mock_{timestamp}_{random}
   * @param params - Order creation parameters
   * @returns Created order
   */
  async createOrder(params: CreateOrderParams): Promise<PGOrder> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const orderId = `pg_mock_${timestamp}_${random}`;

    const order: PGOrder = {
      order_id: orderId,
      amount: params.amount,
      currency: 'INR',
      status: 'created',
    };

    this.orders.set(orderId, order);
    return order;
  }

  /**
   * Processes a mock payment.
   * Succeeds if order exists and amount > 0, fails otherwise.
   * @param params - Payment processing parameters
   * @returns Payment result with transaction ID
   */
  async processPayment(params: ProcessPaymentParams): Promise<PGPaymentResult> {
    const order = this.orders.get(params.order_id);

    if (!order) {
      return {
        status: 'failed',
        transaction_id: '',
        error_message: `Order ${params.order_id} not found`,
      };
    }

    if (order.amount <= 0) {
      return {
        status: 'failed',
        transaction_id: '',
        error_message: 'Amount must be greater than 0',
      };
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const transactionId = `txn_${timestamp}_${random}`;

    return {
      status: 'success',
      transaction_id: transactionId,
    };
  }

  /**
   * Verifies a mock payment.
   * Always returns verified true for testing purposes.
   * @param _transactionId - Transaction ID to verify
   * @returns Verification result
   */
  async verifyPayment(_transactionId: string): Promise<PGVerification> {
    return {
      verified: true,
      amount: 1000,
      status: 'success',
    };
  }
}
