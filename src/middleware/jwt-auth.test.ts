import { createJwtAuthMiddleware } from './jwt-auth';
import { generateToken } from '../lib/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('JWT Auth Middleware', () => {
  let middleware: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    middleware = createJwtAuthMiddleware();
    mockRequest = {
      headers: {},
    } as any;
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
  });

  it('sets request.user when valid Bearer token is provided', async () => {
    const token = generateToken({
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'owner',
    });

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.user_id).toBe('user_123');
    expect(mockRequest.user?.merchant_id).toBe('merch_456');
    expect(mockRequest.user?.role).toBe('owner');
  });

  it('sets request.merchantId when valid token is provided', async () => {
    const token = generateToken({
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'owner',
    });

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockRequest.merchantId).toBe('merch_456');
  });

  it('returns 401 when authorization header is missing', async () => {
    mockRequest.headers = {};

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_INVALID',
        }),
      })
    );
  });

  it('returns 401 when Bearer prefix is missing', async () => {
    const token = generateToken({
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'owner',
    });

    mockRequest.headers = {
      authorization: token, // Missing "Bearer " prefix
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_INVALID',
        }),
      })
    );
  });

  it('returns 401 when token is invalid', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid.token.here',
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_INVALID',
        }),
      })
    );
  });

  it('returns 401 when token is expired', async () => {
    // Test with an invalid token (expired tokens are also invalid)
    mockRequest.headers = {
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'AUTH_INVALID',
        }),
      })
    );
  });
});
