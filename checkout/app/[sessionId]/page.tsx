'use client';

import { useEffect, useState } from 'react';
import {
  fetchCart,
  saveCustomer,
  fetchOffers,
  validateCoupon,
  selectPayment,
  processPayment,
  formatINR,
  computeDiscount,
  Cart,
  Offer,
  EMIOption,
} from '@/lib/api';

type Step = 'review' | 'details' | 'payment';

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

interface AppliedDiscount {
  offerId: string;
  title: string;
  discount: number;
}

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [step, setStep] = useState<Step>('review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [availableOffers, setAvailableOffers] = useState<Offer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    email: '',
    phone: '',
    address: { line1: '', city: '', state: '', pincode: '' },
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardBin, setCardBin] = useState('');
  const [emiOptions, setEmiOptions] = useState<EMIOption[]>([]);
  const [selectedEmi, setSelectedEmi] = useState<number | null>(null);

  // Extract sessionId from params promise
  useEffect(() => {
    (async () => {
      const { sessionId: id } = await params;
      setSessionId(id);
    })();
  }, [params]);

  // Load cart on mount
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const cartData = await fetchCart(sessionId);
        setCart(cartData);
        // Fetch available offers
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'test_key';
        const offersData = await fetchOffers(sessionId, cartData, apiKey);
        const allOffers = [...(offersData.coupons || []), ...(offersData.auto_offers || [])];
        setAvailableOffers(allOffers.filter(o => o.is_eligible));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cart');
        setLoading(false);
      }
    })();
  }, [sessionId]);

  // Calculate total discount and final amount
  const calculateTotals = () => {
    if (!cart) return { subtotal: 0, totalDiscount: 0, finalAmount: 0 };
    const subtotal = cart.amount;
    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.discount, 0);
    const finalAmount = Math.max(0, subtotal - totalDiscount);
    return { subtotal, totalDiscount, finalAmount };
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !cart) return;
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'test_key';
      const result = await validateCoupon(couponInput, cart, apiKey);
      if (result.status === 200 && result.data.offer) {
        const offer = result.data.offer;
        const discount = computeDiscount(offer, cart.amount);
        const discount_obj: AppliedDiscount = {
          offerId: offer._id || offer.code || 'coupon',
          title: offer.title || offer.code || 'Coupon',
          discount,
        };
        setAppliedDiscounts([...appliedDiscounts, discount_obj]);
        setCouponInput('');
      } else {
        setError(result.data.message || 'Coupon not valid');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply coupon');
    }
  };

  const handleToggleOffer = (offerId: string) => {
    const updated = new Set(selectedOffers);
    if (updated.has(offerId)) {
      updated.delete(offerId);
      setAppliedDiscounts(appliedDiscounts.filter(d => d.offerId !== offerId));
    } else {
      updated.add(offerId);
      const offer = availableOffers.find(o => o._id === offerId);
      if (offer && cart) {
        const discount = computeDiscount(offer, cart.amount);
        setAppliedDiscounts([...appliedDiscounts, { offerId, title: offer.title, discount }]);
      }
    }
    setSelectedOffers(updated);
  };

  const handleCardBinInput = async (bin: string) => {
    setCardBin(bin);
    if (bin.length === 6) {
      try {
        const payment = await selectPayment(sessionId, 'card', bin);
        if (payment && payment.emi_options) {
          setEmiOptions(payment.emi_options);
          setSelectedEmi(null);
        }
      } catch (err) {
        console.error('BIN lookup failed:', err);
      }
    }
  };

  const handleContinueReview = () => {
    setStep('details');
  };

  const handleContinueDetails = async () => {
    if (!customerData.name || !customerData.email || !customerData.phone || !customerData.address.line1 || !customerData.address.city || !customerData.address.state || !customerData.address.pincode) {
      setError('Please fill all customer details');
      return;
    }
    try {
      const saved = await saveCustomer(sessionId, customerData);
      if (saved) {
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }
    try {
      const result = await processPayment(sessionId, paymentMethod, selectedEmi ?? undefined);
      if (result.status === 200) {
        const successUrl = result.data.success_url || '/success';
        window.location.href = successUrl;
      } else {
        setError(result.data.message || 'Payment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing failed');
    }
  };

  const { subtotal, totalDiscount, finalAmount } = calculateTotals();

  const getCategoryEmoji = (category?: string): string => {
    if (!category) return '📦';
    const lower = category.toLowerCase();
    if (lower.includes('electronics')) return '📱';
    if (lower.includes('clothing')) return '👕';
    if (lower.includes('food')) return '🍔';
    if (lower.includes('book')) return '📚';
    if (lower.includes('beauty')) return '💄';
    return '📦';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-fg-soft">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent mx-auto mb-4"></div>
          Loading checkout...
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-danger mb-2">❌</div>
          <p className="text-fg-soft">{error}</p>
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-fg-soft">Cart not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Topbar */}
      <div className="sticky top-0 z-50 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-dark rounded-lg flex items-center justify-center">
            <span className="text-base">⚡</span>
          </div>
          <span className="font-bold text-fg text-sm">OfferForge</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-fg-muted">
          <span className={`px-2 py-1 rounded-full ${step === 'review' ? 'bg-surface-2 text-accent' : 'bg-surface-3'}`}>
            ✓ Review
          </span>
          <span className={`px-2 py-1 rounded-full ${step === 'details' ? 'bg-surface-2 text-accent' : 'bg-surface-3'}`}>
            ✓ Details
          </span>
          <span className={`px-2 py-1 rounded-full ${step === 'payment' ? 'bg-surface-2 text-accent' : 'bg-surface-3'}`}>
            ✓ Pay
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[500px] mx-auto px-4 pb-24 pt-5">
        {error && (
          <div className="bg-danger/10 border border-danger rounded-xl p-3 mb-3.5 text-danger text-[13px] flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {step === 'review' && (
          <>
            {/* Order Summary */}
            <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
              <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                <span>📦</span> Order Summary
              </h2>
              <div className="space-y-2 mb-3.5 border-b border-border-light pb-3.5">
                {cart?.items?.map((item) => (
                  <div key={item.sku_id} className="flex justify-between items-start gap-2 text-[13px]">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span>{getCategoryEmoji(item.category)}</span>
                        <span className="text-fg font-medium truncate">{item.name}</span>
                      </div>
                      <div className="text-fg-muted ml-5">{item.qty} × {formatINR(item.price)}</div>
                    </div>
                    <div className="text-fg font-medium">{formatINR(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>

              {/* Subtotal Row */}
              <div className="flex justify-between text-[13px] text-fg-soft mb-2">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>

              {/* Applied Discounts */}
              {appliedDiscounts.map((discount) => (
                <div key={discount.offerId} className="flex justify-between text-[13px] text-success mb-2">
                  <span className="truncate">{discount.title}</span>
                  <span>-{formatINR(discount.discount)}</span>
                </div>
              ))}

              {/* Total Row */}
              <div className="flex justify-between text-[14px] font-bold text-fg border-t border-border-light pt-3.5 mt-3.5">
                <span>Total Amount</span>
                <span>{formatINR(finalAmount)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-success bg-success/10 px-2 py-1 rounded-full">
                  <span>🎉</span> You save {formatINR(totalDiscount)}
                </div>
              )}
            </div>

            {/* Coupon & Offers */}
            <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
              <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                <span>🎁</span> Coupon & Offers
              </h2>

              {/* Coupon Input */}
              <div className="flex gap-2 mb-3.5">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="bg-accent text-bg font-bold text-[13px] px-4 py-2 rounded-lg transition hover:bg-accent-light"
                >
                  Apply
                </button>
              </div>

              {/* Best Offers */}
              <div className="text-[13px] font-bold text-fg-soft mb-2">Best Offers For You</div>
              {availableOffers.length > 0 ? (
                <div className="space-y-2">
                  {availableOffers.map((offer) => (
                    <div key={offer._id} className="flex items-center gap-2 p-2 bg-surface-2 rounded-lg border border-border-light">
                      <input
                        type="checkbox"
                        checked={selectedOffers.has(offer._id)}
                        onChange={() => handleToggleOffer(offer._id)}
                        className="w-4 h-4 accent-accent rounded cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-[12px] text-fg font-medium">{offer.title}</div>
                        <div className="text-[11px] text-fg-muted">{offer.code ? `Code: ${offer.code}` : 'Auto offer'}</div>
                      </div>
                      <div className="text-[12px] text-success font-bold">{offer.discount.value}% off</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-fg-muted text-center py-2">No offers available</div>
              )}
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinueReview}
              className="w-full bg-accent text-bg font-bold text-base py-3 rounded-xl transition hover:bg-accent-light mb-4"
            >
              Continue to Details
            </button>
          </>
        )}

        {step === 'details' && (
          <>
            {/* Customer Info Card */}
            <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
              <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                <span>👤</span> Customer Information
              </h2>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={customerData.name}
                  onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={customerData.email}
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Address Card */}
            <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
              <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                <span>📍</span> Delivery Address
              </h2>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Address Line 1"
                  value={customerData.address.line1}
                  onChange={(e) =>
                    setCustomerData({
                      ...customerData,
                      address: { ...customerData.address, line1: e.target.value },
                    })
                  }
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={customerData.address.city}
                  onChange={(e) =>
                    setCustomerData({
                      ...customerData,
                      address: { ...customerData.address, city: e.target.value },
                    })
                  }
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="State"
                    value={customerData.address.state}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        address: { ...customerData.address, state: e.target.value },
                      })
                    }
                    className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={customerData.address.pincode}
                    onChange={(e) =>
                      setCustomerData({
                        ...customerData,
                        address: { ...customerData.address, pincode: e.target.value },
                      })
                    }
                    className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setStep('review')}
                className="flex-1 bg-surface-2 border border-border-light text-fg font-bold text-base py-3 rounded-xl transition hover:bg-surface-3"
              >
                Back
              </button>
              <button
                onClick={handleContinueDetails}
                className="flex-1 bg-accent text-bg font-bold text-base py-3 rounded-xl transition hover:bg-accent-light"
              >
                Continue to Payment
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            {/* Payment Methods */}
            <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
              <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                <span>💳</span> Payment Method
              </h2>

              <div className="space-y-2">
                {[
                  { id: 'upi', name: 'UPI', emoji: '📱' },
                  { id: 'card', name: 'Card', emoji: '💳' },
                  { id: 'netbanking', name: 'Net Banking', emoji: '🏦' },
                  { id: 'wallet', name: 'Wallet', emoji: '👛' },
                  { id: 'cod', name: 'Cash on Delivery', emoji: '💵' },
                ].map(({ id, name, emoji }) => (
                  <div
                    key={id}
                    onClick={() => {
                      setPaymentMethod(id);
                      setCardBin('');
                      setEmiOptions([]);
                      setSelectedEmi(null);
                    }}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                      paymentMethod === id
                        ? 'bg-surface-2 border-accent'
                        : 'bg-surface-3 border-border-light hover:border-border'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === id ? 'border-accent bg-accent/20' : 'border-fg-muted'
                      }`}
                    >
                      {paymentMethod === id && <div className="w-2 h-2 bg-accent rounded-full"></div>}
                    </div>
                    <span className="text-lg">{emoji}</span>
                    <span className="text-[13px] font-medium text-fg">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card BIN Lookup & EMI Options */}
            {paymentMethod === 'card' && (
              <div className="bg-surface border border-border rounded-2xl p-5 mb-3.5 shadow-lg">
                <h2 className="text-[15px] font-bold mb-3.5 flex items-center gap-2 text-fg">
                  <span>🔢</span> Card Details
                </h2>

                <input
                  type="text"
                  placeholder="Card Number (First 6 digits)"
                  maxLength={6}
                  value={cardBin}
                  onChange={(e) => handleCardBinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-surface-2 border border-border-light rounded-lg px-3 py-2 text-[13px] text-fg placeholder-fg-muted focus:outline-none focus:border-accent mb-3.5"
                />

                {emiOptions.length > 0 && (
                  <div>
                    <div className="text-[13px] font-bold text-fg-soft mb-2">Available EMI Options</div>
                    <div className="grid grid-cols-1 gap-2">
                      {emiOptions.map((emi, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedEmi(idx)}
                          className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition ${
                            selectedEmi === idx
                              ? 'bg-surface-2 border-accent'
                              : 'bg-surface-3 border-border-light hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full border border-fg-muted ${
                                selectedEmi === idx ? 'bg-accent border-accent' : ''
                              }`}
                            ></div>
                            <div>
                              <div className="text-[12px] font-medium text-fg">
                                {formatINR(emi.customer_emi)}/month × {emi.tenure_months} months
                              </div>
                              <div className="text-[11px] text-fg-muted">{emi.bank}</div>
                            </div>
                          </div>
                          <div className="text-[11px] font-bold text-success bg-success/10 px-2 py-1 rounded">
                            {emi.emi_type === 'no_cost' ? 'No Cost' : 'Standard'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setStep('details')}
                className="flex-1 bg-surface-2 border border-border-light text-fg font-bold text-base py-3 rounded-xl transition hover:bg-surface-3"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>

      {/* Pay Bar (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border px-4 py-3 flex items-center justify-between max-w-[500px] mx-auto">
        <div>
          <div className="text-[11px] text-fg-muted">Amount to Pay</div>
          <div className="text-[18px] font-bold text-accent">{formatINR(finalAmount)}</div>
        </div>
        <button
          onClick={
            step === 'review'
              ? handleContinueReview
              : step === 'details'
                ? handleContinueDetails
                : handleProcessPayment
          }
          className="bg-accent text-bg font-bold text-base px-6 py-3.5 rounded-xl transition hover:bg-accent-light"
        >
          {step === 'review' ? 'Continue →' : step === 'details' ? 'Continue →' : `Pay ${formatINR(finalAmount)} →`}
        </button>
      </div>
    </div>
  );
}
