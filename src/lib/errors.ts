/** Base class for all Fuse typed errors. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Thrown when an offer ID or code doesn't exist (or belongs to another merchant). */
export class OfferNotFoundError extends AppError {
  constructor(identifier: string) {
    super(`Offer not found: ${identifier}`, 'OFFER_NOT_FOUND', 404);
  }
}

/** Thrown when an offer exists but is expired or usage-limited. */
export class OfferInvalidError extends AppError {
  constructor(reason: string) {
    super(reason, 'OFFER_INVALID', 422);
  }
}

/** Thrown when cart/customer doesn't meet offer rules. */
export class OfferIneligibleError extends AppError {
  constructor(reason: string) {
    super(reason, 'OFFER_INELIGIBLE', 422);
  }
}

/** Thrown when stacking policy forbids a combination. */
export class ComboConflictError extends AppError {
  constructor(reason: string) {
    super(reason, 'COMBO_CONFLICT', 422);
  }
}

/** Thrown when request body is malformed. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/** Thrown when API key is missing or invalid. */
export class AuthError extends AppError {
  constructor(message: string) {
    super(message, 'AUTH_INVALID', 401);
  }
}
