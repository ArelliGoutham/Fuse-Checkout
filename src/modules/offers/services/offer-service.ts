import type { Db } from 'mongodb';
import { createOfferModule } from '../index';
import { MongoOfferRepository } from '../repositories/mongo-offer-repository';
import type { OfferService, OfferRepository } from '../types';

/**
 * Creates offer service and repository components wired to a database instance.
 *
 * @param db - MongoDB Db instance
 * @returns Object containing OfferService and OfferRepository instances
 */
export function createOfferComponents(db: Db): { service: OfferService; repository: OfferRepository } {
  return {
    service: createOfferModule(),
    repository: new MongoOfferRepository(db),
  };
}
