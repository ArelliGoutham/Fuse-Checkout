import { createOfferModule } from './index';
import type { OfferService } from './types';

describe('createOfferModule', () => {
  it('returns an OfferService with evaluate, evaluateEligible, resolveCombo methods', () => {
    const service: OfferService = createOfferModule();
    expect(service).toBeDefined();
    expect(typeof service.evaluate).toBe('function');
    expect(typeof service.evaluateEligible).toBe('function');
    expect(typeof service.resolveCombo).toBe('function');
  });
});
