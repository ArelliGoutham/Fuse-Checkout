import Razorpay from 'razorpay';
import type {
  PGAdapter,
  PGWebhookVerifier,
  PGOrder,
  PGPaymentResult,
  PGVerification,
  RefundParams,
  RefundResult,
  CreateOrderParams,
  ProcessPaymentParams,
} from './types';

/**
 * Razorpay payment gateway adapter.
 * Implements PGAdapter for payment processing and PGWebhookVerifier for webhook validation.
 * Uses merchant's own API keys (BYOK model).
 */
export class RazorpayAdapter implements PGAdapter, PGWebhookVerifier {
  private client: Razorpay;
  private apiSecret: string;

  /**
   * Initializes the Razorpay client with decrypted merchant credentials.
   *
   * @param apiKey - Razorpay API key (rzp_live_xxx or rzp_test_xxx)
   * @param apiSecret - Razorpay API secret
   */
  constructor(apiKey: string, apiSecret: string) {
    this.apiSecret = apiSecret;
    this.client = new Razorpay({
      key_id: apiKey,
      key_secret: apiSecret,
    });
  }

  /**
   * Returns the adapter name for logging and stats.
   */
  getName(): string {
    return 'razorpay';
  }

  /**
   * Creates a payment order in Razorpay.
   * Amount is in paise (Razorpay requirement).
   */
  async createOrder(params: CreateOrderParams): Promise<PGOrder> {
    const order = await this.client.orders.create({
      amount: params.amount,
      currency: 'INR',
      notes: {
        payment_method: params.payment_method,
        ...(params.options?.customer_email && { customer_email: params.options.customer_email }),
        ...(params.options?.customer_phone && { customer_phone: params.options.customer_phone }),
      },
    });

    return {
      order_id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      status: order.status as 'created' | 'attempted' | 'paid',
    };
  }

  /**
   * Verifies a Razorpay payment signature.
   * Razorpay captures payment on the client side; server verifies the signature.
   */
  async processPayment(params: ProcessPaymentParams): Promise<PGPaymentResult> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params.payment_data as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        status: 'failed',
        transaction_id: '',
        error_message: 'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature',
      };
    }

    // Use the SDK's built-in signature verification
    const isValid = Razorpay.validateWebhookSignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature,
      this.apiSecret
    );

    if (!isValid) {
      return {
        status: 'failed',
        transaction_id: '',
        error_message: 'Payment signature verification failed',
      };
    }

    // Fetch payment details to confirm status
    const payment = await this.client.payments.fetch(razorpay_payment_id);

    if (payment.status === 'captured') {
      return {
        status: 'success',
        transaction_id: razorpay_payment_id,
      };
    }

    return {
      status: 'pending',
      transaction_id: razorpay_payment_id,
      error_message: `Payment status: ${payment.status}`,
    };
  }

  /**
   * Verifies a payment by fetching its status from Razorpay.
   */
  async verifyPayment(transactionId: string): Promise<PGVerification> {
    const payment = await this.client.payments.fetch(transactionId);

    return {
      verified: payment.status === 'captured',
      amount: Number(payment.amount),
      status: payment.status,
    };
  }

  /**
   * Verifies a webhook signature from Razorpay.
   * Implements PGWebhookVerifier interface.
   */
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    return Razorpay.validateWebhookSignature(rawBody, signature, secret);
  }

  /**
   * Refunds a payment through Razorpay.
   * Supports full and partial refunds.
   *
   * @param params - Refund parameters (payment_id, amount, reason)
   * @returns Refund result with PG refund ID
   */
  async refundPayment(params: RefundParams): Promise<RefundResult> {
    try {
      const refund = await this.client.payments.refund(params.payment_id, {
        amount: params.amount,
        notes: params.notes || {},
        ...(params.reason && { receipt: params.reason }),
      });

      const status: 'success' | 'pending' = refund.status === 'processed' ? 'success' : 'pending';
      return {
        status,
        refund_id: refund.id,
        amount: Number(refund.amount),
      };
    } catch (err) {
      return {
        status: 'failed',
        refund_id: '',
        amount: 0,
        error_message: err instanceof Error ? err.message : 'Razorpay refund failed',
      };
    }
  }
}
