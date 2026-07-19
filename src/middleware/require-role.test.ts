import { requireRole } from './require-role';
import { ROLE_LEVELS } from '../modules/auth/schemas/invite';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('Role-Based Access Control Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: undefined,
    } as any;
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
  });

  it('allows access when user role exceeds minimum required role (owner accessing offer_manager route)', async () => {
    const middleware = requireRole('offer_manager');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'owner',
    };

    // Should not call reply.code or reply.send for allowed access
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it('allows access when user role equals minimum required role', async () => {
    const middleware = requireRole('owner');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'owner',
    };

    // Should not call reply.code or reply.send for allowed access
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it('denies access when user role is below minimum required role (analytics_viewer accessing admin route)', async () => {
    const middleware = requireRole('admin');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'analytics_viewer',
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        }),
      })
    );
  });

  it('returns 401 when user is not authenticated', async () => {
    const middleware = requireRole('admin');

    mockRequest.user = undefined;

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

  it('allows offer_manager accessing offer_manager route', async () => {
    const middleware = requireRole('offer_manager');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'offer_manager',
    };

    // Should not call reply.code or reply.send for allowed access
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it('denies offer_manager accessing owner route', async () => {
    const middleware = requireRole('owner');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'offer_manager',
    };

    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      })
    );
  });

  it('verifies role hierarchy: owner(4) > admin(3) > offer_manager(2) > analytics_viewer(1)', () => {
    // Verify the hierarchy is correct
    expect(ROLE_LEVELS['owner']).toBe(4);
    expect(ROLE_LEVELS['admin']).toBe(3);
    expect(ROLE_LEVELS['offer_manager']).toBe(2);
    expect(ROLE_LEVELS['analytics_viewer']).toBe(1);
  });

  it('allows admin accessing offer_manager route', async () => {
    const middleware = requireRole('offer_manager');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'admin',
    };

    // Should not call reply.code or reply.send for allowed access
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it('allows analytics_viewer accessing analytics_viewer route', async () => {
    const middleware = requireRole('analytics_viewer');

    mockRequest.user = {
      user_id: 'user_123',
      merchant_id: 'merch_456',
      role: 'analytics_viewer',
    };

    // Should not call reply.code or reply.send for allowed access
    await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });
});
