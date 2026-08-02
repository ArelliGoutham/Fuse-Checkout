import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors';

/**
 * Global error handler for Fastify.
 * Maps AppError instances to appropriate HTTP status codes and error envelopes.
 * Unknown errors return 500 with a generic message.
 *
 * @param error - The error that was thrown
 * @param _req - The Fastify request object (unused)
 * @param reply - The Fastify reply object to send response
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    return;
  }

  const fastifyError = error as FastifyError;
  const statusCode = fastifyError.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) {
    reply.code(statusCode).send({
      error: {
        code: fastifyError.code || 'HTTP_ERROR',
        message: error.message,
      },
    });
    return;
  }

  reply
    .code(500)
    .send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
