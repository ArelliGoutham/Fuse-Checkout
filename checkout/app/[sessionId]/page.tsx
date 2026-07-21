'use client';

import { useEffect, useState } from 'react';
import {
  fetchCart, saveCustomer, fetchOffers, validateCoupon,
  selectPayment, processPayment, formatINR, computeDiscount,
  Cart, Offer, EMIOption,
} from '@/lib/api';

interface CustomerData {
  name: string; email: string; phone: string;
  address: { line1: string; city: string; state: string; pincode: string };
}

interface AppliedDiscount {
  offerId: string; title: string; discount: number; code: string;
}

type ModalType = 'coupons' | 'address' | 'emi' | null;

interface OrderResult {
  orderId: string; method: string; amount: number; redirectUrl: string;
}

export default function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [processing, setProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  // Coupons & Offers
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [availableOffers, setAvailableOffers] = useState<Offer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());

  // Delivery details
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '', email: '', phone: '',
    address: { line1: '', city: '', state: '', pincode: '' },
  });
  const [addressSaved, setAddressSaved] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [cardBin, setCardBin] = useState('');
  const [emiOptions, setEmiOptions] = useState<EMIOption[]>([]);
  const [selectedEmi, setSelectedEmi] = useState<number | null>(null);

  // Modal
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => { (async () => {
    const { sessionId: id } = await params; setSessionId(id);
  })(); }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const cd = await fetchCart(sessionId);
        const cartObj = cd.cart || cd;
        setCart(cartObj);
        setMerchantId(cd.merchant_id || '');
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'demo-key-123';
        const offersData = await fetchOffers(sessionId, cartObj, apiKey);
        const all = [...(offersData.coupons || []), ...(offersData.auto_offers || [])];
        setAvailableOffers(all.filter((o: Offer) => o.is_eligible));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cart');
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const calculateTotals = () => {
    if (!cart) return { subtotal: 0, totalDiscount: 0, finalAmount: 0 };
    const s = cart.amount;
    const d = appliedDiscounts.reduce((sum, x) => sum + x.discount, 0);
    return { subtotal: s, totalDiscount: d, finalAmount: Math.max(0, s - d) };
  };
  const { subtotal, totalDiscount, finalAmount } = calculateTotals();

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !cart) return;
    setCouponError('');
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'demo-key-123';
      const result = await validateCoupon(couponInput, cart, apiKey);
      if (result.status === 200 && result.data.offer && result.data.offer.is_eligible !== false) {
        const offer = result.data.offer;
        const discount = computeDiscount(offer, cart.amount);
        setAppliedDiscounts(prev => [...prev, {
          offerId: offer._id || offer.code, title: offer.title || offer.code || 'Coupon',
          discount, code: offer.code || couponInput.toUpperCase(),
        }]);
        setCouponInput('');
      } else {
        setCouponError(result.data.message || 'Coupon not valid');
      }
    } catch { setCouponError('Failed to apply coupon'); }
  };

  const handleToggleOffer = (offerId: string) => {
    const updated = new Set(selectedOffers);
    if (updated.has(offerId)) {
      updated.delete(offerId);
      setAppliedDiscounts(prev => prev.filter(d => d.offerId !== offerId));
    } else {
      updated.add(offerId);
      const offer = availableOffers.find(o => o._id === offerId);
      if (offer && cart) {
        const discount = computeDiscount(offer, cart.amount);
        setAppliedDiscounts(prev => [...prev, {
          offerId, title: offer.title, discount, code: offer.code || offer.title,
        }]);
      }
    }
    setSelectedOffers(updated);
  };

  const handleSaveAddress = async () => {
    if (!customerData.name || !customerData.email || !customerData.phone ||
        !customerData.address.line1 || !customerData.address.city ||
        !customerData.address.state || !customerData.address.pincode) {
      setError('Fill all fields'); return;
    }
    try {
      await saveCustomer(sessionId, customerData);
      setAddressSaved(true);
      setModal(null);
      setError('');
    } catch { setError('Failed to save address'); }
  };

  const handleCardBinInput = async (bin: string) => {
    setCardBin(bin);
    if (bin.length === 6) {
      try {
        const p = await selectPayment(sessionId, 'card', bin);
        if (p?.emi_options) { setEmiOptions(p.emi_options); setModal('emi'); }
      } catch { setEmiOptions([]); }
    }
  };

  const handlePay = async () => {
    if (!paymentMethod) { setError('Select payment method'); return; }
    if (!addressSaved) { setError('Save delivery details first'); return; }
    setProcessing(true);
    try {
      const result = await processPayment(sessionId, paymentMethod, selectedEmi ?? undefined);
      if (result.status === 200 && result.data) {
        setOrderResult({
          orderId: result.data.order_id || 'ORDER_CONFIRMED',
          method: paymentMethod, amount: finalAmount,
          redirectUrl: result.data.redirect_url || result.data.success_url || '',
        });
        setStep('success');
      } else { setError(result.data.message || 'Payment failed'); }
    } catch { setError('Payment processing failed'); }
    setProcessing(false);
  };

  const getItemIcon = (cat?: string) => {
    if (!cat) return '📦';
    const c = cat.toLowerCase();
    if (c.includes('electronic')||c.includes('phone')||c.includes('mobile')) return '📱';
    if (c.includes('foot')||c.includes('shoe')) return '👟';
    if (c.includes('cloth')||c.includes('apparel')) return '👕';
    if (c.includes('food')||c.includes('grocer')) return '🍔';
    if (c.includes('book')) return '📚';
    if (c.includes('beauty')||c.includes('health')) return '💄';
    return '📦';
  };

  // ────────── Loading / Error states ──────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#F1F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 mx-auto mb-3" style={{ borderColor: '#16233F', borderTopColor: 'transparent' }} />
          <div className="text-xs font-medium tracking-wider" style={{ color: '#9AA1AC' }}>LOADING CHECKOUT…</div>
        </div>
      </div>
    );
  }

  if ((error && !cart) || !cart) {
    return (
      <div className="min-h-screen" style={{ background: '#F1F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-sm" style={{ color: '#5C6470' }}>{error || 'Cart not found'}</div>
      </div>
    );
  }

  // ────────── Success Screen ──────────
  if (step === 'success' && orderResult) {
    return (
      <div className="min-h-screen" style={{ background: '#F1F3F5', display: 'flex', justifyContent: 'center' }}>
        <div className="w-full max-w-[440px] px-4 pt-7">
          <div className="text-center pt-6 pb-1.5">
            <div className="w-24 h-24 mx-auto mb-5 rounded-full border-2 flex items-center justify-center stamp-rotate" style={{ borderColor: '#1F7A54', borderStyle: 'dashed' }}>
              <div className="text-center" style={{ lineHeight: 1.2 }}>
                <div className="text-[30px]" style={{ color: '#1F7A54' }}>✓</div>
                <div className="text-[8px] font-bold mt-0.5 tracking-wider" style={{ color: '#1F7A54' }}>PAYMENT<br />CONFIRMED</div>
              </div>
            </div>
            <h2 className="font-semibold text-[23px] tracking-tight mb-1.5" style={{ color: '#12151C' }}>Order placed</h2>
            <p className="text-[13.5px] leading-relaxed mb-5.5" style={{ color: '#5C6470' }}>Your order has been confirmed.<br />A confirmation has been sent to your email.</p>
          </div>
          <div className="bg-white rounded-2xl border p-5 mb-3.5" style={{ borderColor: '#E1E4E8' }}>
            <div className="text-xs font-medium tracking-wider uppercase flex justify-between mb-3" style={{ color: '#5C6470' }}>
              <span>Receipt</span><span style={{ color: '#9AA1AC' }}>№ {orderResult.orderId.slice(-10).toUpperCase()}</span>
            </div>
            {[
              ['Amount paid', formatINR(orderResult.amount)],
              ['Payment method', orderResult.method.toUpperCase()],
              ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px] py-2.5" style={{ borderBottom: '1px dashed #E1E4E8' }}>
                <span style={{ color: '#5C6470' }}>{k}</span>
                <span className="font-semibold tracking-wide text-[12.5px]" style={{ color: '#12151C' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-4.5">
            {orderResult.redirectUrl && (
              <a href={orderResult.redirectUrl} className="flex-1 border text-center font-semibold text-[13.5px] py-3.5 rounded-xl cursor-pointer transition hover:bg-gray-50"
                 style={{ borderColor: '#E1E4E8', background: '#FFFFFF', color: '#12151C' }}>View order</a>
            )}
            <a href="/" className="flex-1 text-center border-none text-white font-bold text-[13.5px] py-3.5 rounded-xl cursor-pointer transition hover:opacity-90" style={{ background: '#16233F' }}>Continue shopping</a>
          </div>
        </div>
      </div>
    );
  }

  // Count available coupons not yet selected
  const couponOffers = availableOffers.filter(o => o.type === 'coupon' && !selectedOffers.has(o._id) && !appliedDiscounts.some(d => d.code === o.code));
  const autoOffers = availableOffers.filter(o => o.type === 'auto_offer' && !selectedOffers.has(o._id));
  const unselectedOffersCount = couponOffers.length + autoOffers.length;

  // ────────── Main Checkout Page ──────────
  return (
    <div className="min-h-screen" style={{ background: '#F1F3F5', display: 'flex', justifyContent: 'center' }}>
      <div className="w-full max-w-[500px] px-4 pt-4 pb-32">

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 mb-3 text-[13px] flex items-center gap-2" style={{ background: '#FEF2F2', color: '#C53030', border: '1px solid #FECACA' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* ===== 1. ORDER SUMMARY ===== */}
        <div className="bg-white rounded-2xl border overflow-hidden mb-3" style={{ borderColor: '#E1E4E8' }}>
          <div className="p-4.5 pb-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[15px] tracking-tight" style={{ color: '#12151C' }}>Order Summary</h3>
              <span className="text-[13px] font-medium" style={{ color: '#5C6470' }}>{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {cart.items.map((item, idx) => (
            <div key={item.sku_id} className="flex gap-3 px-4.5 py-2.5 items-start" style={{ borderBottom: idx < cart.items.length - 1 ? '1px solid #F3F3F5' : 'none' }}>
              <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: '#F1F3F5' }}>
                {getItemIcon(item.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[14px] truncate" style={{ color: '#12151C' }}>{item.name}</div>
                {item.category && (
                  <div className="text-[12px] mt-0.5" style={{ color: '#9AA1AC' }}>
                    {item.brand ? `${item.brand} · ` : ''}{item.category} · Qty {item.qty}
                  </div>
                )}
              </div>
              <div className="font-semibold text-[14px] whitespace-nowrap text-right tracking-tight" style={{ color: '#12151C' }}>
                {formatINR(item.price * item.qty)}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="px-4.5 py-3.5" style={{ borderTop: '1px solid #E1E4E8', background: '#FAFBFC' }}>
            <div className="flex justify-between text-[13px] mb-1.5" style={{ color: '#5C6470' }}>
              <span>Subtotal</span><span>{formatINR(subtotal)}</span>
            </div>
            {appliedDiscounts.map(d => (
              <div key={d.offerId} className="flex justify-between text-[13px] mb-1.5 font-medium" style={{ color: '#1F7A54' }}>
                <span className="truncate pr-2">{d.code}</span><span>−{formatINR(d.discount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[15px] font-semibold pt-2" style={{ borderTop: '1px solid #E1E4E8', color: '#12151C' }}>
              <span>Total</span>
              <span className="tracking-tight">{formatINR(finalAmount)}</span>
            </div>
            {totalDiscount > 0 && (
              <span className="inline-flex items-center mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#E4F1EA', color: '#1F7A54' }}>
                You save {formatINR(totalDiscount)}
              </span>
            )}
          </div>
        </div>

        {/* ===== 2. COUPONS & OFFERS ===== */}
        <div className="bg-white rounded-2xl border overflow-hidden mb-3" style={{ borderColor: '#E1E4E8' }}>
          <div className="p-4.5 pb-3">
            <h3 className="font-semibold text-[15px] tracking-tight mb-3" style={{ color: '#12151C' }}>Offers & Coupons</h3>

            {/* Coupon input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text" placeholder="Enter coupon code"
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value); setCouponError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                className="flex-1 border rounded-lg px-3 py-2.5 text-[13px] outline-none transition"
                style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }}
              />
              <button onClick={handleApplyCoupon}
                className="border-none text-white font-semibold text-[12px] px-4 rounded-lg cursor-pointer transition hover:opacity-90"
                style={{ background: '#16233F' }}>Apply</button>
            </div>
            {couponError && <div className="text-[12px] mb-2" style={{ color: '#C53030' }}>{couponError}</div>}

            {/* Applied coupons */}
            {appliedDiscounts.map(d => (
              <div key={d.offerId} className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: '#F3F3F5' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E4F1EA' }}>
                    <span style={{ color: '#1F7A54', fontSize: 13 }}>✓</span>
                  </div>
                  <div>
                    <div className="font-medium text-[13px]" style={{ color: '#12151C' }}>{d.title || d.code}</div>
                    <div className="text-[11px]" style={{ color: '#5C6470' }}>Applied · {formatINR(d.discount)} off</div>
                  </div>
                </div>
                <button onClick={() => {
                  setAppliedDiscounts(prev => prev.filter(x => x.offerId !== d.offerId));
                  setSelectedOffers(prev => { const next = new Set(prev); next.delete(d.offerId); return next; });
                }}
                  className="text-[12px] font-medium border-none bg-transparent cursor-pointer" style={{ color: '#C53030' }}>Remove</button>
              </div>
            ))}

            {/* + Available Coupons link */}
            {unselectedOffersCount > 0 && (
              <button onClick={() => setModal('coupons')}
                className="w-full flex items-center gap-2 mt-2 py-2 text-[13px] font-medium bg-transparent border-none cursor-pointer transition hover:opacity-70"
                style={{ color: '#B5842A' }}>
                <span>+ Available Coupons ({unselectedOffersCount})</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            )}

            {availableOffers.length === 0 && appliedDiscounts.length === 0 && (
              <div className="text-[13px] text-center py-2" style={{ color: '#9AA1AC' }}>No offers available</div>
            )}
          </div>
        </div>

        {/* ===== 3. DELIVERY DETAILS ===== */}
        <div className="bg-white rounded-2xl border overflow-hidden mb-3" style={{ borderColor: '#E1E4E8' }}>
          <div className="p-4.5 pb-3">
            <h3 className="font-semibold text-[15px] tracking-tight mb-3" style={{ color: '#12151C' }}>Delivery Details</h3>

            {addressSaved ? (
              <div className="rounded-xl border p-3.5 flex items-start gap-3" style={{ borderColor: '#E1E4E8', background: '#F7F9FC' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: '#E1E4E8' }}>📍</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px]" style={{ color: '#12151C' }}>{customerData.name}</div>
                  <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: '#5C6470' }}>
                    {customerData.address.line1}, {customerData.address.city}, {customerData.address.state} {customerData.address.pincode}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#9AA1AC' }}>{customerData.phone} · {customerData.email}</div>
                </div>
                <button onClick={() => setModal('address')}
                  className="bg-transparent border border-solid rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide cursor-pointer transition hover:bg-gray-100"
                  style={{ borderColor: '#E1E4E8', color: '#16233F' }}>EDIT</button>
              </div>
            ) : (
              <button onClick={() => setModal('address')}
                className="w-full flex items-center gap-2.5 py-2.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition hover:opacity-70"
                style={{ color: '#B5842A' }}>
                <span>+ Add delivery address</span>
              </button>
            )}

            {!addressSaved && (
              <div className="flex items-center gap-1.5 mt-2 text-[12px]" style={{ color: '#C53030' }}>
                <span>⚠</span> Add delivery details to continue
              </div>
            )}
          </div>
        </div>

        {/* ===== 4. PAYMENT METHODS ===== */}
        <div className="bg-white rounded-2xl border overflow-hidden mb-3" style={{ borderColor: '#E1E4E8' }}>
          <div className="p-4.5 pb-3">
            <h3 className="font-semibold text-[15px] tracking-tight mb-3" style={{ color: '#12151C' }}>Payment Method</h3>

            {[
              { id: 'upi', icon: '◎', name: 'UPI', sub: 'Google Pay, PhonePe, Paytm & more', badge: 'Recommended' },
              { id: 'card', icon: '▭', name: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay, Amex', badge: '' },
              { id: 'bank_transfer', icon: '🏦', name: 'Net Banking', sub: 'All major Indian banks', badge: '' },
              { id: 'wallet', icon: '👛', name: 'Wallets', sub: 'Paytm, PhonePe, Mobikwik & more', badge: '' },
              { id: 'cod', icon: '💵', name: 'Cash on Delivery', sub: 'Pay when you receive', badge: '' },
            ].map(m => (
              <div key={m.id}
                onClick={() => { setPaymentMethod(m.id); if (m.id !== 'card') { setCardBin(''); setEmiOptions([]); } }}
                className={`flex items-center gap-3 py-3 cursor-pointer transition ${m.id !== 'cod' ? 'border-b' : ''}`}
                style={{ borderColor: '#F3F3F5' }}>
                <div className="w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0"
                     style={{ borderColor: paymentMethod === m.id ? '#B5842A' : '#C4C8CE' }}>
                  {paymentMethod === m.id && <div className="w-[10px] h-[10px] rounded-full" style={{ background: '#B5842A' }} />}
                </div>
                <div className="w-[36px] h-[36px] rounded-lg flex items-center justify-center shrink-0 text-[15px] border"
                     style={{ background: '#F7F9FC', borderColor: '#E1E4E8' }}>{m.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-[13.5px]" style={{ color: '#12151C' }}>{m.name}</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: '#5C6470' }}>{m.sub}</div>
                </div>
                {m.badge && (
                  <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full whitespace-nowrap shrink-0"
                        style={{ color: '#B5842A', background: '#F3E4C4' }}>{m.badge}</span>
                )}
              </div>
            ))}

            {/* Card BIN + EMI trigger */}
            {paymentMethod === 'card' && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E1E4E8' }}>
                <input
                  type="text" placeholder="Card number (first 6 digits for EMI)"
                  maxLength={6} value={cardBin}
                  onChange={e => handleCardBinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full border rounded-lg px-3.5 py-2.5 text-[13px] outline-none transition mb-2"
                  style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }}
                />
                {emiOptions.length > 0 && (
                  <div className="rounded-lg border p-3" style={{ background: '#F7F9FC', borderColor: '#E1E4E8' }}>
                    <div className="text-[11px] font-semibold tracking-wide uppercase mb-2.5" style={{ color: '#5C6470' }}>
                      EMI OPTIONS · {emiOptions[0]?.bank || 'Your bank'}
                    </div>
                    {emiOptions.slice(0, 3).map((emi, idx) => (
                      <div key={idx} onClick={() => { setSelectedEmi(idx); setModal('emi'); }}
                        className="flex items-center justify-between py-2.5 cursor-pointer" style={{ borderBottom: idx < 2 ? '1px solid #E1E4E8' : 'none' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: selectedEmi === idx ? '#B5842A' : '#C4C8CE', background: selectedEmi === idx ? '#B5842A' : 'transparent' }} />
                          <div>
                            <div className="text-[13px] font-medium" style={{ color: '#12151C' }}>
                              <span className="font-semibold tracking-tight">{formatINR(emi.customer_emi)}</span>/mo × {emi.tenure_months} mo
                            </div>
                            <div className="text-[11px]" style={{ color: '#9AA1AC' }}>Total: {formatINR(emi.customer_emi * emi.tenure_months)}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full" style={{
                          color: emi.emi_type === 'no_cost' ? '#1F7A54' : '#B5842A',
                          background: emi.emi_type === 'no_cost' ? '#E4F1EA' : '#F3E4C4',
                        }}>{emi.emi_type === 'no_cost' ? 'NO COST' : 'STANDARD'}</span>
                      </div>
                    ))}
                    {emiOptions.length > 3 && (
                      <button onClick={() => setModal('emi')} className="w-full mt-2 text-[12px] font-medium text-center bg-transparent border-none cursor-pointer" style={{ color: '#B5842A' }}>
                        + {emiOptions.length - 3} more EMI options
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Trust badge */}
            <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid #E1E4E8' }}>
              <div className="text-xs font-medium tracking-wide flex items-center gap-1.5 flex-wrap" style={{ color: '#5C6470' }}>
                <span>🔒</span>Secure · PCI-DSS · 256-bit encrypted
              </div>
              <div className="flex gap-1.5 ml-auto">
                {['VISA', 'MC', 'RPAY', 'UPI'].map(b => (
                  <span key={b} className="text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded border" style={{ color: '#9AA1AC', borderColor: '#E1E4E8' }}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STICKY PAY BAR ===== */}
      <div className="fixed left-0 right-0 bottom-0 flex justify-center" style={{ padding: '14px 16px 22px' }}>
        <div className="w-full max-w-[500px] flex items-center justify-between rounded-2xl p-[14px_18px]" style={{ background: '#16233F', boxShadow: '0 12px 28px rgba(22,35,63,.30)' }}>
          <div>
            <div className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#9FB0CC' }}>Amount payable</div>
            <div className="text-[20px] font-bold tracking-tight text-white">{formatINR(finalAmount)}</div>
          </div>
          <button onClick={handlePay} disabled={processing || !addressSaved}
            className="border-none font-bold text-[14.5px] py-3.5 px-6 rounded-xl cursor-pointer transition disabled:opacity-40 flex items-center gap-2"
            style={{ background: '#B5842A', color: '#241800' }}>
            {processing ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-2" style={{ borderColor: '#241800', borderTopColor: 'transparent' }} /> Processing…</>
            ) : (
              <>Pay {formatINR(finalAmount)}</>
            )}
          </button>
        </div>
      </div>

      {/* ====== BOTTOM SHEET MODALS ====== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex justify-center" onClick={() => setModal(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Coupons Modal */}
          {modal === 'coupons' && (
            <div className="absolute bottom-0 w-full max-w-[500px] bg-white rounded-t-3xl max-h-[75vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease' }}
                 onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white pt-4 pb-3 px-5 border-b z-10" style={{ borderColor: '#E1E4E8' }}>
                <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: '#C4C8CE' }} />
                <h4 className="font-semibold text-[15px] tracking-tight" style={{ color: '#12151C' }}>Available Coupons</h4>
              </div>
              <div className="px-5 py-3 space-y-0">
                {couponOffers.map(o => {
                  const d = computeDiscount(o, cart.amount);
                  return (
                    <div key={o._id} onClick={() => { handleToggleOffer(o._id); setModal(null); }}
                      className="flex items-center gap-3 py-3.5 cursor-pointer" style={{ borderBottom: '1px solid #F3F3F5' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F3E4C4' }}>
                        <span style={{ color: '#B5842A', fontSize: 14, fontWeight: 600 }}>%</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[13.5px]" style={{ color: '#12151C' }}>{o.code}</div>
                        <div className="text-[11.5px] mt-0.5" style={{ color: '#5C6470' }}>
                          {o.discount.type === 'flat' ? `₹${o.discount.value} off` : `${o.discount.value}% off`}
                        </div>
                      </div>
                      <span className="font-semibold text-[13px]" style={{ color: '#1F7A54' }}>−{formatINR(d)}</span>
                    </div>
                  );
                })}
                {autoOffers.map(o => {
                  const d = computeDiscount(o, cart.amount);
                  return (
                    <div key={o._id} onClick={() => { handleToggleOffer(o._id); setModal(null); }}
                      className="flex items-center gap-3 py-3.5 cursor-pointer" style={{ borderBottom: '1px solid #F3F3F5' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#E4F1EA' }}>
                        <span style={{ color: '#1F7A54', fontSize: 14, fontWeight: 600 }}>🎁</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[13.5px]" style={{ color: '#12151C' }}>{o.title}</div>
                        <div className="text-[11.5px] mt-0.5" style={{ color: '#5C6470' }}>Auto-applied</div>
                      </div>
                      <span className="font-semibold text-[13px]" style={{ color: '#1F7A54' }}>−{formatINR(d)}</span>
                    </div>
                  );
                })}
                {unselectedOffersCount === 0 && (
                  <div className="text-center py-6 text-[13px]" style={{ color: '#9AA1AC' }}>No more offers available</div>
                )}
              </div>
            </div>
          )}

          {/* Address Modal */}
          {modal === 'address' && (
            <div className="absolute bottom-0 w-full max-w-[500px] bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease' }}
                 onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white pt-4 pb-3 px-5 border-b z-10" style={{ borderColor: '#E1E4E8' }}>
                <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: '#C4C8CE' }} />
                <h4 className="font-semibold text-[15px] tracking-tight" style={{ color: '#12151C' }}>Delivery Details</h4>
              </div>
              <div className="px-5 py-4">
                <div className="mb-3.5">
                  <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>Full name</label>
                  <input type="text" placeholder="Your name" value={customerData.name}
                    onChange={e => setCustomerData({ ...customerData, name: e.target.value })}
                    className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                </div>
                <div className="flex gap-2.5 mb-3.5">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>Email</label>
                    <input type="email" placeholder="you@email.com" value={customerData.email}
                      onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
                      className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>Mobile</label>
                    <input type="tel" placeholder="+91 00000 00000" value={customerData.phone}
                      onChange={e => setCustomerData({ ...customerData, phone: e.target.value })}
                      className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                  </div>
                </div>
                <div className="mb-3.5">
                  <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>Address</label>
                  <input type="text" placeholder="Flat, building, street" value={customerData.address.line1}
                    onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, line1: e.target.value } })}
                    className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                </div>
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>City</label>
                    <input type="text" placeholder="City" value={customerData.address.city}
                      onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, city: e.target.value } })}
                      className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>PIN Code</label>
                    <input type="text" placeholder="000000" value={customerData.address.pincode}
                      onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, pincode: e.target.value } })}
                      className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                  </div>
                </div>
                <div className="mt-3.5">
                  <label className="block text-[11px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: '#5C6470' }}>State</label>
                  <input type="text" placeholder="State" value={customerData.address.state}
                    onChange={e => setCustomerData({ ...customerData, address: { ...customerData.address, state: e.target.value } })}
                    className="w-full border rounded-lg px-3.5 py-2.5 text-[13.5px] outline-none transition" style={{ borderColor: '#E1E4E8', background: '#F7F9FC', color: '#12151C' }} />
                </div>
                <button onClick={handleSaveAddress}
                  className="w-full border-none text-white font-bold text-[14px] py-3.5 rounded-xl cursor-pointer transition hover:opacity-90 mt-4"
                  style={{ background: '#16233F' }}>Save & Continue</button>
              </div>
            </div>
          )}

          {/* EMI Modal */}
          {modal === 'emi' && (
            <div className="absolute bottom-0 w-full max-w-[500px] bg-white rounded-t-3xl max-h-[65vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease' }}
                 onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white pt-4 pb-3 px-5 border-b z-10" style={{ borderColor: '#E1E4E8' }}>
                <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: '#C4C8CE' }} />
                <h4 className="font-semibold text-[15px] tracking-tight" style={{ color: '#12151C' }}>EMI Options</h4>
                <div className="text-[12px] mt-1 font-medium" style={{ color: '#5C6470' }}>{emiOptions[0]?.bank || 'Your bank'}</div>
              </div>
              <div className="px-5 py-3 space-y-0">
                {emiOptions.map((emi, idx) => (
                  <div key={idx} onClick={() => { setSelectedEmi(idx); setModal(null); }}
                    className="flex items-center justify-between py-3.5 cursor-pointer" style={{ borderBottom: idx < emiOptions.length - 1 ? '1px solid #F3F3F5' : 'none' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0"
                           style={{ borderColor: selectedEmi === idx ? '#B5842A' : '#C4C8CE' }}>
                        {selectedEmi === idx && <div className="w-[10px] h-[10px] rounded-full" style={{ background: '#B5842A' }} />}
                      </div>
                      <div>
                        <div className="font-semibold text-[14px] tracking-tight" style={{ color: '#12151C' }}>
                          {formatINR(emi.customer_emi)}<span className="font-normal text-[13px]" style={{ color: '#5C6470' }}>/mo</span>
                        </div>
                        <div className="text-[12px] mt-0.5" style={{ color: '#9AA1AC' }}>
                          {emi.tenure_months} months · Total {formatINR(emi.customer_emi * emi.tenure_months)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full" style={{
                      color: emi.emi_type === 'no_cost' ? '#1F7A54' : '#B5842A',
                      background: emi.emi_type === 'no_cost' ? '#E4F1EA' : '#F3E4C4',
                    }}>{emi.emi_type === 'no_cost' ? 'NO COST' : 'STANDARD'}</span>
                  </div>
                ))}
                {emiOptions.length === 0 && (
                  <div className="text-center py-6 text-[13px]" style={{ color: '#9AA1AC' }}>No EMI options available</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom sheet animation keyframe */}
      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
