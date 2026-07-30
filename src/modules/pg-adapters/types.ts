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
   * Refunds a payment through the PG.
   * @param params - Refund parameters
   * @returns Refund result
   */
  refundPayment(params: RefundParams): Promise<RefundResult>;

  /**
   * Returns the name of this PG adapter (e.g., "razorpay", "cashfree").
   * Used by the smart router for logging and stats.
   */
  getName(): string;
}

/**
 * Parameters for creating a refund.
 */
export interface RefundParams {
  /** PG payment ID to refund */
  payment_id: string;
  /** Refund amount in paise (full or partial) */
  amount?: number;
  /** Reason for refund */
  reason?: string;
  /** Merchant notes for audit */
  notes?: Record<string, string>;
}

/**
 * Result of a refund request.
 */
export interface RefundResult {
  /** Refund status */
  status: 'success' | 'failed' | 'pending';
  /** PG refund ID */
  refund_id: string;
  /** Refunded amount in paise */
  amount: number;
  /** Error message if refund failed */
  error_message?: string;
}

/**
 * Interface for verifying PG webhook signatures.
 * Webhook routes depend on this interface, not concrete adapters.
 */
export interface PGWebhookVerifier {
  /**
   * Verifies a webhook signature from the PG.
   * @param rawBody - Raw request body as string
   * @param signature - Signature header value from PG
   * @param secret - Webhook secret for this merchant
   * @returns Whether the webhook is authentic
   */
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean;
}

/**
 * Interface for providers that load PG credentials for a merchant.
 * Routes depend on this interface, not concrete repositories.
 */
export interface PGCredentialProvider {
  /**
   * Finds active PG credentials for a merchant.
   * Returns decrypted keys or null if not configured.
   */
  findActiveCredentials(merchantId: string, pgName: string): Promise<{
    apiKey: string;
    apiSecret: string;
    webhookSecret: string | null;
    testMode: boolean;
  } | null>;
}
