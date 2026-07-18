import type { FastifyInstance } from 'fastify';
import { createServer } from '../app';
import { errorHandler } from './error-handler';
import { OfferNotFoundError, ValidationError } from '../lib/errors';

describe('errorHandler', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = createServer();
    server.register(async (fastify) => {
      fastify.setErrorHandler(errorHandler);

      fastify.get('/not-found', async () => {
        throw new OfferNotFoundError('offer-123');
      });

      fastify.get('/validation-error', async () => {
        throw new ValidationError('Invalid input');
      });

      fastify.get('/unknown-error', async () => {
        throw new Error('Something went wrong');
      });
    });
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  it('maps OfferNotFoundError to 404 with error envelope', async () => {
    const response = await server.inject({ method: 'GET', url: '/not-found' });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('OFFER_NOT_FOUND');
    expect(body.error.message).toBe('Offer not found: offer-123');
  });

  it('maps ValidationError to 400 with error envelope', async () => {
    const response = await server.inject({ method: 'GET', url: '/validation-error' });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid input');
  });

  it('maps unknown Error to 500 with error envelope', async () => {
    const response = await server.inject({ method: 'GET', url: '/unknown-error' });
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });
});
