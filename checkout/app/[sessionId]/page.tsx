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

type Step = 0 | 1 | 2 | 3;

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  address: { line1: string; city: string; state: string; pincode: string };
}

interface AppliedDiscount {
  offerId: string;
  title: string;
  discount: number;
  code: string;
}

const STEPS = [
  { label: 'Cart', idx: 0 },
  { label: 'Details', idx: 1 },
  { label: 'Payment', idx: 2 },
];

const SCREENS_META = [
  { title: 'Your cart', sub: 'SECURE CHECKOUT', footLabel: 'Amount payable', footBtn: 'Continue to details →' },
  { title: 'Delivery details', sub: 'STEP 2 OF 3', footLabel: 'Amount payable', footBtn: 'Continue to payment →' },
  { title: 'Payment', sub: 'STEP 3 OF 3', footLabel: 'Amount payable', footBtn: 'Pay securely →' },
  { title: 'Order confirmed', sub: 'PAYMENT CONFIRMED', footLabel: '', footBtn: '' },
];

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [availableOffers, setAvailableOffers] = useState<Offer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '', email: '', phone: '',
    address: { line1: '', city: '', state: '', pincode: '' },
  });
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [cardBin, setCardBin] = useState('');
  const [emiOptions, setEmiOptions] = useState<EMIOption[]>([]);
  const [selectedEmi, setSelectedEmi] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; method: string; amount: number; redirectUrl: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { sessionId: id } = await params;
      setSessionId(id);
    })();
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const cartData = await fetchCart(sessionId);
        const cartObj = cartData.cart || cartData;
        setCart(cartObj);
        setMerchantId(cartData.merchant_id || '');
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'demo-key-123';
        const offersData = await fetchOffers(sessionId, cartObj, apiKey);
        const allOffers = [...(offersData.coupons || []), ...(offersData.auto_offers || [])];
        setAvailableOffers(allOffers.filter(o => o.is_eligible));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cart');
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const calculateTotals = () => {
    if (!cart) return { subtotal: 0, totalDiscount: 0, finalAmount: 0 };
    const subtotal = cart.amount;
    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.discount, 0);
    const finalAmount = Math.max(0, subtotal - totalDiscount);
    return { subtotal, totalDiscount, finalAmount };
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !cart) return;
    setCouponError('');
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'demo-key-123';
      const result = await validateCoupon(couponInput, cart, apiKey);
      if (result.status === 200 && result.data.offer) {
        const offer = result.data.offer;
        const discount = computeDiscount(offer, cart.amount);
        setAppliedDiscounts([...appliedDiscounts, {
          offerId: offer._id || offer.code || 'coupon',
          title: offer.title || offer.code || 'Coupon',
          discount, code: offer.code || couponInput.toUpperCase(),
        }]);
        setCouponInput('');
      } else {
        setCouponError(result.data.message || 'Coupon not valid');
      }
    } catch {
      setCouponError('Failed to apply coupon');
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
        setAppliedDiscounts([...appliedDiscounts, {
          offerId, title: offer.title, discount, code: offer.code || offer.title,
        }]);
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
      } catch {
        setEmiOptions([]);
      }
    }
  };

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (!customerData.name || !customerData.email || !customerData.phone ||
          !customerData.address.line1 || !customerData.address.city ||
          !customerData.address.state || !customerData.address.pincode) {
        setError('Please fill all fields to continue');
        return;
      }
      try {
        await saveCustomer(sessionId, customerData);
        setStep(2);
      } catch {
        setError('Failed to save details');
      }
    } else if (step === 2) {
      setProcessing(true);
      try {
        const result = await processPayment(sessionId, paymentMethod, selectedEmi ?? undefined);
        if (result.status === 200 && result.data) {
          setOrderResult({
            orderId: result.data.order_id || 'ORDER_CONFIRMED',
            method: paymentMethod,
            amount: finalAmount,
            redirectUrl: result.data.redirect_url || result.data.success_url || '',
          });
          setStep(3);
        } else {
          setError(result.data.message || 'Payment failed');
        }
      } catch {
        setError('Payment processing failed');
      }
      setProcessing(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(Math.max(0, step - 1) as Step);
  };

  const { subtotal, totalDiscount, finalAmount } = calculateTotals();
  const meta = SCREENS_META[step];

  const getItemIcon = (category?: string) => {
    if (!category) return '■';
    const c = category.toLowerCase();
    if (c.includes('electronic') || c.includes('phone') || c.includes('mobile')) return '📱';
    if (c.includes('foot') || c.includes('shoe')) return '👟';
    if (c.includes('cloth') || c.includes('apparel')) return '👕';
    if (c.includes('food') || c.includes('grocer')) return '🍔';
    if (c.includes('book')) return '📚';
    if (c.includes('beauty') || c.includes('health')) return '💄';
    return '📦';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 mx-auto mb-3"
               style={{ borderColor: 'var(--color-navy)', borderTopColor: 'transparent' }} />
          <div className="font-medium tracking-wide text-xs" style={{ color: 'var(--color-faint)' }}>LOADING CHECKOUT…</div>
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
        <div className="text-center">
          <div className="text-3xl mb-3">⚠</div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
        <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Cart not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center px-4 pt-7"
         style={{ background: 'radial-gradient(circle at 15% 8%, #E7EAEE 0%, transparent 45%), var(--color-paper)' }}>

      <div className="w-full max-w-[440px]">

        {/* ===== Topbar ===== */}
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-[9px] border flex items-center justify-center transition hover:bg-surface-3"
            style={{
              borderColor: 'var(--color-line)',
              background: 'var(--color-card)',
              visibility: step === 0 || step === 3 ? 'hidden' : 'visible',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5L8 12L15 19" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="font-bold text-[15px] text-ink">{meta.title}</div>
            <div className="font-medium tracking-wide text-[10.5px]" style={{ color: 'var(--color-faint)' }}>{meta.sub}</div>
          </div>
        </div>

        {/* ===== Stepper ===== */}
        {step < 3 && (
          <div className="flex items-center justify-between px-1 pb-5">
            {STEPS.map((s, i) => (
              <div key={s.idx} className="flex items-center w-full">
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => i <= step && setStep(s.idx as Step)}
                >
                  <div
                    className="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      borderColor: i <= step ? 'var(--color-navy)' : 'var(--color-faint)',
                      background: i < step ? 'var(--color-navy)' : 'var(--color-paper)',
                      color: i < step ? '#fff' : i === step ? 'var(--color-navy)' : 'var(--color-faint)',
                    }}
                  >
                    {i < step ? '✓' : s.idx + 1}
                  </div>
                  <span
                    className="font-medium tracking-wide text-[11px] hidden sm:inline"
                    style={{ color: i <= step ? 'var(--color-navy)' : 'var(--color-faint)' }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-1.5"
                    style={{ background: i < step ? 'var(--color-navy)' : 'var(--color-line)' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== Error banner ===== */}
        {error && step < 3 && (
          <div className="rounded-xl p-3 mb-3.5 text-[13px] flex items-center gap-2"
               style={{ background: '#FEF2F2', color: 'var(--color-danger)', border: '1px solid #FECACA' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* ===== Screens ===== */}
        <div key={step} className="screen-fade">

          {/* ====== SCREEN 0: CART ====== */}
          {step === 0 && (
            <>
              {/* Cart Items Card */}
              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase flex justify-between mb-4"
                     style={{ color: 'var(--color-muted)' }}>
                  <span>Items · {cart.items.length}</span>
                </div>

                {cart.items.map((item, idx) => (
                  <div key={item.sku_id} className="flex gap-3.5 items-start py-3"
                       style={{ borderBottom: idx < cart.items.length - 1 ? '1px solid var(--color-line)' : 'none' }}>
                    <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0"
                         style={{ background: 'var(--color-navy)' }}>
                      <span style={{ filter: 'none' }}>{getItemIcon(item.category)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14.5px] text-ink truncate">{item.name}</div>
                      {item.category && (
                        <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                          {item.brand ? `${item.brand} · ` : ''}{item.category}
                        </div>
                      )}
                      <div className="text-[12px] mt-1" style={{ color: 'var(--color-faint)' }}>
                        Qty {item.qty}
                      </div>
                    </div>
                    <div className="font-semibold tracking-tight text-[15.5px] text-ink whitespace-nowrap text-right">
                      {formatINR(item.price * item.qty)}
                    </div>
                  </div>
                ))}

                <div className="h-px my-4" style={{ background: 'var(--color-line)' }} />
                <div className="flex justify-between text-[13.5px] mb-2" style={{ color: 'var(--color-muted)' }}>
                  <span>Subtotal</span><span>{formatINR(subtotal)}</span>
                </div>
                {appliedDiscounts.map(d => (
                  <div key={d.offerId} className="flex justify-between text-[13.5px] mb-2"
                       style={{ color: 'var(--color-green)' }}>
                    <span className="truncate pr-2">{d.code}</span><span>−{formatINR(d.discount)}</span>
                  </div>
                ))}
                <div className="h-px my-3" style={{ background: 'var(--color-line)' }} />
                <div className="flex justify-between text-[14px] font-semibold text-ink">
                  <span>Total amount</span>
                  <span className="font-semibold tracking-tight text-[22px]">{formatINR(finalAmount)}</span>
                </div>
                {totalDiscount > 0 && (
                  <span className="inline-block mt-2.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-full"
                        style={{ background: 'var(--color-green-soft)', color: 'var(--color-green)' }}>
                    You're saving {formatINR(totalDiscount)} on this order
                  </span>
                )}
              </div>

              {/* Coupons & Offers Card */}
              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase mb-4"
                     style={{ color: 'var(--color-muted)' }}>
                  Coupons &amp; Offers
                </div>

                <div className="flex gap-2 mb-4.5">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value); setCouponError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    className="flex-1 border rounded-[9px] px-3.5 py-3 text-[13.5px] outline-none transition"
                    style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="border-none text-white font-semibold text-[13px] px-[18px] rounded-[9px] cursor-pointer transition hover:opacity-90"
                    style={{ background: 'var(--color-navy)' }}
                  >
                    Apply
                  </button>
                </div>

                {couponError && (
                  <div className="text-[12px] mb-3" style={{ color: 'var(--color-danger)' }}>{couponError}</div>
                )}

                {availableOffers.length > 0 && (
                  <>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2.5"
                         style={{ color: 'var(--color-faint)' }}>
                      Best offers for you
                    </div>
                    {availableOffers.map(offer => {
                      const checked = selectedOffers.has(offer._id);
                      const discount = computeDiscount(offer, cart.amount);
                      return (
                        <div key={offer._id}
                             onClick={() => handleToggleOffer(offer._id)}
                             className="flex items-center gap-3 py-3 cursor-pointer transition"
                             style={{ borderBottom: '1px solid var(--color-line)' }}>
                          <div className="w-[18px] h-[18px] border-[1.5px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                               style={{
                                 borderColor: checked ? 'var(--color-green)' : 'var(--color-faint)',
                                 background: checked ? 'var(--color-green)' : 'transparent',
                                 color: '#fff', fontSize: '11px',
                               }}>
                            {checked ? '✓' : ''}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-ink">
                              {offer.code || offer.title}
                            </div>
                            <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                              {offer.title !== offer.code ? offer.title : ''}
                              {offer.discount.type === 'flat'
                                ? `₹${offer.discount.value} off`
                                : `${offer.discount.value}% off`}
                            </div>
                          </div>
                          {offer.type === 'auto_offer' ? (
                            <span className="font-medium tracking-wide text-[10.5px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                                  style={{ color: 'var(--color-gold)', background: 'var(--color-gold-soft)' }}>
                              AUTO
                            </span>
                          ) : (
                            <span className="font-medium tracking-wide text-[12px] font-semibold whitespace-nowrap"
                                  style={{ color: 'var(--color-green)' }}>
                              − {formatINR(discount)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {availableOffers.length === 0 && appliedDiscounts.length === 0 && (
                  <div className="text-[13px] text-center py-3" style={{ color: 'var(--color-faint)' }}>
                    No offers available for this cart
                  </div>
                )}
              </div>
            </>
          )}

          {/* ====== SCREEN 1: DETAILS ====== */}
          {step === 1 && (
            <>
              {/* Delivery Address */}
              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase mb-4"
                     style={{ color: 'var(--color-muted)' }}>
                  Contact details
                </div>
                <div className="mb-3.5">
                  <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                         style={{ color: 'var(--color-muted)' }}>Full name</label>
                  <input
                    type="text"
                    placeholder="Rahul Sharma"
                    value={customerData.name}
                    onChange={e => setCustomerData({ ...customerData, name: e.target.value })}
                    className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                    style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                  />
                </div>
                <div className="flex gap-2.5 mb-3.5">
                  <div className="flex-1">
                    <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                           style={{ color: 'var(--color-muted)' }}>Email</label>
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={customerData.email}
                      onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
                      className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                      style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                           style={{ color: 'var(--color-muted)' }}>Mobile</label>
                    <input
                      type="tel"
                      placeholder="+91 00000 00000"
                      value={customerData.phone}
                      onChange={e => setCustomerData({ ...customerData, phone: e.target.value })}
                      className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                      style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase mb-4"
                     style={{ color: 'var(--color-muted)' }}>
                  Shipping address
                </div>
                <div className="mb-3.5">
                  <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                         style={{ color: 'var(--color-muted)' }}>Address line</label>
                  <input
                    type="text"
                    placeholder="Flat, house no., building"
                    value={customerData.address.line1}
                    onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, line1: e.target.value } })}
                    className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                    style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                  />
                </div>
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                           style={{ color: 'var(--color-muted)' }}>City</label>
                    <input
                      type="text"
                      placeholder="Bengaluru"
                      value={customerData.address.city}
                      onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, city: e.target.value } })}
                      className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                      style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                           style={{ color: 'var(--color-muted)' }}>PIN code</label>
                    <input
                      type="text"
                      placeholder="560001"
                      value={customerData.address.pincode}
                      onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, pincode: e.target.value } })}
                      className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                      style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                    />
                  </div>
                </div>
                <div className="mt-3.5">
                  <label className="block font-medium tracking-wide text-[10px] uppercase mb-1.5"
                         style={{ color: 'var(--color-muted)' }}>State</label>
                  <input
                    type="text"
                    placeholder="Karnataka"
                    value={customerData.address.state}
                    onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, state: e.target.value } })}
                    className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition"
                    style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                  />
                </div>
              </div>

              {/* Mini total */}
              <div className="flex justify-between items-center text-[13px] bg-white rounded-[14px] border p-[14px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)' }}>
                <span style={{ color: 'var(--color-muted)' }}>Total payable</span>
                <b className="font-semibold tracking-tight text-[16px] text-ink">{formatINR(finalAmount)}</b>
              </div>
            </>
          )}

          {/* ====== SCREEN 2: PAYMENT ====== */}
          {step === 2 && (
            <>
              {/* Payment Methods */}
              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase mb-4"
                     style={{ color: 'var(--color-muted)' }}>
                  Choose payment method
                </div>

                {[
                  { id: 'upi', icon: '◎', name: 'UPI', sub: 'GPay, PhonePe, Paytm & more', badge: 'FASTEST' },
                  { id: 'card', icon: '▭', name: 'Credit / Debit card', sub: 'Visa, Mastercard, RuPay', badge: '' },
                  { id: 'bank_transfer', icon: '🏦', name: 'Net banking', sub: 'All major banks', badge: '' },
                ].map(m => (
                  <div key={m.id}
                       onClick={() => { setPaymentMethod(m.id); setCardBin(''); setEmiOptions([]); setSelectedEmi(null); }}
                       className="flex items-center gap-3 py-3.5 cursor-pointer transition"
                       style={{ borderBottom: m.id !== 'bank_transfer' ? '1px solid var(--color-line)' : 'none' }}>
                    <div className="w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                         style={{ borderColor: paymentMethod === m.id ? 'var(--color-navy)' : 'var(--color-faint)' }}>
                      {paymentMethod === m.id && (
                        <div className="w-[10px] h-[10px] rounded-full" style={{ background: 'var(--color-navy)' }} />
                      )}
                    </div>
                    <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center flex-shrink-0 text-[15px] border"
                         style={{ background: 'var(--color-paper)', borderColor: 'var(--color-line)' }}>
                      {m.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[13.5px] text-ink">{m.name}</div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--color-muted)' }}>{m.sub}</div>
                    </div>
                    {m.badge && (
                      <span className="font-medium tracking-wide text-[9.5px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                            style={{ color: 'var(--color-green)', background: 'var(--color-green-soft)' }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Card + EMI */}
              {paymentMethod === 'card' && (
                <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                     style={{ borderColor: 'var(--color-line)', boxShadow: '0 1px 2px rgba(18,21,28,.03)' }}>
                  <div className="font-medium tracking-wide text-[10.5px] uppercase mb-4"
                       style={{ color: 'var(--color-muted)' }}>
                    Card details
                  </div>
                  <input
                    type="text"
                    placeholder="Card number (first 6 digits for EMI)"
                    maxLength={6}
                    value={cardBin}
                    onChange={e => handleCardBinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full border rounded-[9px] px-3.5 py-3 text-[14px] outline-none transition mb-3"
                    style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)', color: 'var(--color-ink)' }}
                  />

                  {emiOptions.length > 0 && (
                    <div className="rounded-[10px] border p-3.5"
                         style={{ background: 'var(--color-paper)', borderColor: 'var(--color-line)' }}>
                      <div className="font-medium tracking-wide text-[10px] uppercase mb-3"
                           style={{ color: 'var(--color-muted)' }}>
                        EMI options · {emiOptions[0]?.bank || 'Your bank'}
                      </div>
                      {emiOptions.map((emi, idx) => (
                        <div key={idx}
                             onClick={() => setSelectedEmi(idx)}
                             className="flex items-center justify-between py-2.5 cursor-pointer transition"
                             style={{ borderBottom: idx < emiOptions.length - 1 ? '1px solid var(--color-line)' : 'none' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full border-[1.5px]"
                                 style={{
                                   borderColor: selectedEmi === idx ? 'var(--color-navy)' : 'var(--color-faint)',
                                   background: selectedEmi === idx ? 'var(--color-navy)' : 'transparent',
                                 }} />
                            <div>
                              <div className="text-[13px] font-semibold text-ink">
                                <span className="font-medium tracking-wide">{formatINR(emi.customer_emi)}</span>/mo × {emi.tenure_months} mo
                              </div>
                              <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-faint)' }}>
                                Total: {formatINR(emi.customer_emi * emi.tenure_months)}
                              </div>
                            </div>
                          </div>
                          <span className="font-medium tracking-wide text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{
                                  color: emi.emi_type === 'no_cost' ? 'var(--color-green)' : 'var(--color-gold)',
                                  background: emi.emi_type === 'no_cost' ? 'var(--color-green-soft)' : 'var(--color-gold-soft)',
                                }}>
                            {emi.emi_type === 'no_cost' ? 'NO COST' : emi.emi_type === 'low_cost' ? 'LOW COST' : 'STANDARD'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trust Card */}
              <div className="bg-white rounded-[14px] border flex items-center gap-4 p-[18px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)' }}>
                <div className="w-16 h-16 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 stamp-rotate"
                     style={{ borderColor: 'var(--color-navy)', borderStyle: 'dashed' }}>
                  <div className="text-center font-medium tracking-wide" style={{ color: 'var(--color-navy)', lineHeight: 1.15 }}>
                    <div className="text-[16px]">🔒</div>
                    <div className="text-[6.6px] font-semibold mt-0.5">VERIFIED<br />SECURE</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">256-bit encrypted checkout</div>
                  <div className="text-[11.5px] mt-0.5 leading-tight" style={{ color: 'var(--color-muted)' }}>
                    PCI-DSS compliant · Your card details never touch our servers
                  </div>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {['VISA', 'MASTERCARD', 'RUPAY', 'UPI', 'NET BANKING'].map(b => (
                      <span key={b} className="font-medium tracking-wide text-[9.5px] font-semibold px-2 py-1 rounded border"
                            style={{ color: 'var(--color-muted)', borderColor: 'var(--color-line)', background: 'var(--color-paper)' }}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ====== SCREEN 3: SUCCESS ====== */}
          {step === 3 && orderResult && (
            <>
              <div className="text-center pt-6 pb-1.5">
                <div className="w-24 h-24 mx-auto mb-5 rounded-full border-2 flex items-center justify-center stamp-rotate-success"
                     style={{ borderColor: 'var(--color-green)', borderStyle: 'dashed' }}>
                  <div className="text-center font-medium tracking-wide" style={{ color: 'var(--color-green)', lineHeight: 1.2 }}>
                    <div className="text-[30px]">✓</div>
                    <div className="text-[8px] font-bold mt-0.5">PAYMENT<br />CONFIRMED</div>
                  </div>
                </div>
                <h2 className="font-serif-num text-[23px] font-semibold text-ink mb-1.5">Order placed</h2>
                <p className="text-[13.5px] leading-relaxed mb-5.5" style={{ color: 'var(--color-muted)' }}>
                  Your order has been confirmed.<br />
                  A confirmation has been sent to your email.
                </p>
              </div>

              <div className="bg-white rounded-[14px] border p-[22px_20px] mb-3.5"
                   style={{ borderColor: 'var(--color-line)' }}>
                <div className="font-medium tracking-wide text-[10.5px] uppercase flex justify-between mb-3"
                     style={{ color: 'var(--color-muted)' }}>
                  <span>Receipt</span>
                  <span style={{ color: 'var(--color-faint)' }}>№ {orderResult.orderId.slice(-10).toUpperCase()}</span>
                </div>
                {[
                  ['Amount paid', formatINR(orderResult.amount)],
                  ['Payment method', orderResult.method.toUpperCase()],
                  ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[13px] py-2.5"
                       style={{ borderBottom: '1px dashed var(--color-line)' }}>
                    <span style={{ color: 'var(--color-muted)' }}>{k}</span>
                    <span className="font-semibold tracking-wide text-[12.5px] text-ink">{v}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 mt-4.5">
                {orderResult.redirectUrl && (
                  <a href={orderResult.redirectUrl}
                     className="flex-1 border text-center font-semibold text-[13.5px] py-3.5 rounded-[11px] cursor-pointer transition hover:bg-surface-3"
                     style={{ borderColor: 'var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)' }}>
                    View order
                  </a>
                )}
                <a href="/"
                   className="flex-1 text-center border-none text-white font-bold text-[13.5px] py-3.5 rounded-[11px] cursor-pointer transition hover:opacity-90"
                   style={{ background: 'var(--color-navy)' }}>
                  Continue shopping
                </a>
              </div>
            </>
          )}
        </div>

        {/* Spacer for sticky paybar */}
        {step < 3 && <div className="h-[120px]" />}
      </div>

      {/* ===== Sticky Pay Bar ===== */}
      {step < 3 && (
        <div className="fixed left-0 right-0 bottom-0 flex justify-center"
             style={{
               background: 'linear-gradient(180deg, rgba(241,243,245,0) 0%, var(--color-paper) 24%)',
               padding: '18px 16px 22px',
             }}>
          <div className="w-full max-w-[440px] flex items-center justify-between rounded-2xl p-[14px_16px]"
               style={{ background: 'var(--color-navy)', boxShadow: '0 12px 28px rgba(22,35,63,.28)' }}>
            <div>
              <div className="font-medium tracking-wide text-[10px] uppercase"
                   style={{ color: '#9FB0CC', letterSpacing: '0.06em' }}>
                {meta.footLabel}
              </div>
              <div className="font-serif-num text-[19px] font-semibold text-white">
                {formatINR(finalAmount)}
              </div>
            </div>
            <button
              onClick={handleNext}
              disabled={processing}
              className="border-none font-bold text-[14.5px] py-3.5 px-5 rounded-[11px] cursor-pointer flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-gold)', color: '#241800' }}
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2"
                       style={{ borderColor: '#241800', borderTopColor: 'transparent' }} />
                  Processing…
                </>
              ) : (
                meta.footBtn
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
