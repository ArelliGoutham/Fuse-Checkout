import {
  OfferNotFoundError, OfferInvalidError, OfferIneligibleError,
  ComboConflictError, ValidationError, AuthError,
} from './errors';

describe('typed errors', () => {
  it('OfferNotFoundError has correct code and status', () => {
    const err = new OfferNotFoundError('FLAT50');
    expect(err.code).toBe('OFFER_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('FLAT50');
  });
  it('OfferInvalidError has correct code and status', () => {
    const err = new OfferInvalidError('Coupon expired');
    expect(err.code).toBe('OFFER_INVALID');
    expect(err.statusCode).toBe(422);
  });
  it('OfferIneligibleError has correct code and status', () => {
    const err = new OfferIneligibleError('Cart below minimum');
    expect(err.code).toBe('OFFER_INELIGIBLE');
    expect(err.statusCode).toBe(422);
  });
  it('ComboConflictError has correct code and status', () => {
    const err = new ComboConflictError('Cannot stack exclusive offers');
    expect(err.code).toBe('COMBO_CONFLICT');
    expect(err.statusCode).toBe(422);
  });
  it('ValidationError has correct code and status', () => {
    const err = new ValidationError('Invalid request body');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });
  it('AuthError has correct code and status', () => {
    const err = new AuthError('Invalid API key');
    expect(err.code).toBe('AUTH_INVALID');
    expect(err.statusCode).toBe(401);
  });
  it('all errors extend Error', () => {
    expect(new OfferNotFoundError('x')).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
  });
});
