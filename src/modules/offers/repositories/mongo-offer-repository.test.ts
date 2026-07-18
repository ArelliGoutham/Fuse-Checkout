import { startTestDatabase, stopTestDatabase, getTestDatabase, clearTestDatabase } from '../../../test/setup-db';
import { MongoOfferRepository } from './mongo-offer-repository';
import type { Offer } from '../schemas/offer';

describe('MongoOfferRepository', () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  const createTestOffer = (overrides?: Partial<Offer>): Offer => ({
    _id: 'test-offer-1',
    merchant_id: 'merchant-1',
    code: 'TEST10',
    type: 'coupon',
    title: 'Test Offer',
    description: 'Test description',
    discount: { type: 'percentage', value: 10, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: {
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    },
    usage_limits: { total: 100, per_customer: 5 },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  describe('save and findById', () => {
    it('saves and retrieves an offer by id', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer();

      await repository.save(offer);
      const result = await repository.findById(offer._id, offer.merchant_id);

      expect(result).toEqual(offer);
    });
  });

  describe('tenant isolation', () => {
    it('returns null when querying offer with different merchant_id', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer();

      await repository.save(offer);
      const result = await repository.findById(offer._id, 'different-merchant');

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('finds an offer by code and merchant_id', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer({ code: 'UNIQUE10' });

      await repository.save(offer);
      const result = await repository.findByCode('UNIQUE10', 'merchant-1');

      expect(result).toEqual(offer);
    });

    it('returns null for non-existent code', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);

      const result = await repository.findByCode('NONEXISTENT', 'merchant-1');

      expect(result).toBeNull();
    });

    it('returns null when code exists but merchant_id differs', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer({ code: 'UNIQUE10' });

      await repository.save(offer);
      const result = await repository.findByCode('UNIQUE10', 'different-merchant');

      expect(result).toBeNull();
    });
  });

  describe('findByMerchant', () => {
    it('lists all offers for a merchant', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);

      const offer1 = createTestOffer({ _id: 'offer-1', code: 'CODE1' });
      const offer2 = createTestOffer({ _id: 'offer-2', code: 'CODE2' });

      await repository.save(offer1);
      await repository.save(offer2);

      const result = await repository.findByMerchant('merchant-1');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(offer1);
      expect(result).toContainEqual(offer2);
    });

    it('returns empty array for merchant with no offers', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);

      const result = await repository.findByMerchant('merchant-with-no-offers');

      expect(result).toHaveLength(0);
    });

    it('returns only offers for the specified merchant', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);

      const offer1 = createTestOffer({ _id: 'offer-1', merchant_id: 'merchant-1' });
      const offer2 = createTestOffer({ _id: 'offer-2', merchant_id: 'merchant-2' });

      await repository.save(offer1);
      await repository.save(offer2);

      const result = await repository.findByMerchant('merchant-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(offer1);
    });
  });

  describe('delete', () => {
    it('deletes an offer and returns true', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer();

      await repository.save(offer);
      const result = await repository.delete(offer._id, offer.merchant_id);

      expect(result).toBe(true);

      const found = await repository.findById(offer._id, offer.merchant_id);
      expect(found).toBeNull();
    });

    it('returns false when deleting non-existent offer', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);

      const result = await repository.delete('nonexistent-id', 'merchant-1');

      expect(result).toBe(false);
    });

    it('respects merchant_id scope on delete', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer({ _id: 'offer-1', merchant_id: 'merchant-1' });

      await repository.save(offer);

      const result = await repository.delete('offer-1', 'different-merchant');

      expect(result).toBe(false);

      const found = await repository.findById('offer-1', 'merchant-1');
      expect(found).toEqual(offer);
    });
  });

  describe('update via save', () => {
    it('updates an existing offer', async () => {
      const db = getTestDatabase();
      const repository = new MongoOfferRepository(db);
      const offer = createTestOffer();

      await repository.save(offer);

      const updated = {
        ...offer,
        title: 'Updated Title',
        usage_count: 5,
      };
      await repository.save(updated);

      const result = await repository.findById(offer._id, offer.merchant_id);

      expect(result?.title).toBe('Updated Title');
      expect(result?.usage_count).toBe(5);
    });
  });
});
