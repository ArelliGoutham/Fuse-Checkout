/**
 * Payment Gateway integration types and interfaces.
 */

/**
 * Represents a payment order from the payment gateway.
 */
export interface PGOrder {
  /** Unique order ID from the PG */
  order_id: string;
  /** Order amount in paise */
  amount: number;
  /** Currency code (e.g., INR) */
  currency: string;
  /** Order status */
  status: 'created' | 'attempted' | 'paid';
}

/**
 * Result of a payment processing request.
 */
export interface PGPaymentResult {
  /** Payment status */
  status: 'success' | 'failed' | 'pending';
  /** Unique transaction ID from PG */
  transaction_id: string;
  /** Error message if payment failed */
  error_message?: string;
}

/**
 * Result of payment verification.
 */
export interface PGVerification {
  /** Whether payment was verified */
  verified: boolean;
  /** Verified amount in paise */
  amount: number;
  /** Payment status */
  status: string;
}

/**
 * Parameters for creating a payment order.
 */
export interface CreateOrderParams {
  /** Amount in paise */
  amount: number;
  /** Payment method */
  payment_method: string;
  /** Optional payment-method-specific options */
  options?: {
    /** Bank code for EMI/bank transfer */
    bank?: string;
    /** EMI tenure in months */
    tenure?: number;
    /** Customer email */
    customer_email?: string;
    /** Customer phone */
    customer_phone?: string;
  };
}

/**
 * Parameters for processing a payment.
 */
export interface ProcessPaymentParams {
  /** Order ID from PG */
  order_id: string;
  /** Payment data from customer (method-specific) */
  payment_data: Record<string, unknown>;
}

/**
 * Payment Gateway adapter interface.
 * Implementations handle integration with different PGs (Razorpay, PayU, etc.).
 */
export interface PGAdapter {
  /**
   * Creates a payment order in the PG system.
   * @param params - Order creation parameters
   * @returns Created order details
   */
  createOrder(params: CreateOrderParams): Promise<PGOrder>;

  /**
   * Processes a payment for an order.
   * @param params - Payment processing parameters
   * @returns Payment result (success/failure with transaction ID)
   */
  processPayment(params: ProcessPaymentParams): Promise<PGPaymentResult>;

  /**
   * Verifies a payment transaction with the PG.
   * @param transactionId - Transaction ID to verify
   * @returns Verification result
   */
  verifyPayment(transactionId: string): Promise<PGVerification>;

  /**
   * Returns the name of this PG adapter (e.g., "razorpay", "cashfree").
   * Used by the smart router for logging and stats.
   */
  getName(): string;
}
