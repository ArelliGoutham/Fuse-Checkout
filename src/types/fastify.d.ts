import type { Db } from 'mongodb';
import type { OfferService, OfferRepository } from '../modules/offers/types';

declare module 'fastify' {
  interface FastifyRequest {
    merchantId?: string;
  }

  interface FastifyInstance {
    offerService?: OfferService;
    offerRepository?: OfferRepository;
    db?: Db;
  }
}
