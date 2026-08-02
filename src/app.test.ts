import { createServer } from './app';
import type { FastifyInstance } from 'fastify';

describe('createServer', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    if (server) await server.close();
  });

  it('creates a Fastify instance with /health endpoint returning 200', async () => {
    server = await createServer();
    const response = await server.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('returns brand name in /health response', async () => {
    server = await createServer();
    const response = await server.inject({ method: 'GET', url: '/health' });
    const body = JSON.parse(response.body);
    expect(body.service).toBeDefined();
  });

  it('registers CORS plugin', async () => {
    server = await createServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
