/* eslint-disable no-undef */
import { createServer } from './app';
import { connectDatabase, closeDatabase, getDatabase } from './config/database';
import { registerOfferRoutes } from './modules/offers/routes/offer-routes';
import { registerCheckoutRoutes as registerOffersCheckoutRoutes } from './modules/offers/routes/checkout-routes';
import { registerTrackingRoutes } from './modules/offers/routes/tracking-routes';
import { registerProductRoutes } from './modules/products/routes/product-routes';
import { registerAnalyticsRoutes } from './modules/analytics/analytics-routes';
import { registerCheckoutRoutes } from './modules/checkout/routes/checkout-routes';
import { registerOrderRoutes } from './modules/checkout/routes/order-routes';
import { registerBankRateRoutes } from './modules/checkout/routes/bank-rate-routes';
import { registerEMICampaignRoutes } from './modules/checkout/routes/emi-campaign-routes';
import { registerIINRangeRoutes } from './modules/checkout/routes/iin-range-routes';
import { registerPGCredentialsRoutes } from './modules/checkout/routes/pg-credentials-routes';
import { registerPGWebhook } from './modules/checkout/routes/razorpay-webhook';
import { registerTransactionRoutes } from './modules/checkout/routes/transaction-routes';
import { startSessionExpiryCron } from './modules/checkout/services/session-expiry-cron';
import { startAnomalyDetectionCron } from './modules/checkout/services/anomaly-detection-engine';
import { startAlertCleanupCron } from './modules/checkout/services/alert-cleanup-cron';
import { registerSettlementRoutes } from './modules/checkout/routes/settlement-routes';
import { registerRefundRoutes } from './modules/checkout/routes/refund-routes';
import { registerAlertRoutes } from './modules/checkout/routes/alert-routes';
import { OEMAdapterRegistry } from './modules/oem-adapters/types';
import { MockOEMAdapter } from './modules/oem-adapters/mock-oem-adapter';
import { OEMService } from './modules/oem-adapters/oem-service';
import { RazorpayAdapter } from './modules/pg-adapters/razorpay-adapter';
import { registerAuthRoutes } from './modules/auth/routes/auth-routes';
import { registerInviteRoutes } from './modules/auth/routes/invite-routes';
import { registerApiKeyRoutes } from './modules/auth/routes/api-key-routes';
import { createOfferComponents } from './modules/offers';
import { createAuthMiddleware } from './middleware/auth';
import { createJwtAuthMiddleware } from './middleware/jwt-auth';
import { errorHandler } from './middleware/error-handler';
import type { FastifyRequest, FastifyReply } from 'fastify';

async function start() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://fuse:fuse@localhost:27017/fuse?authSource=admin';
  const mongoDbName = process.env.MONGO_DB_NAME || 'fuse';
  const port = parseInt(process.env.PORT || '3000', 10);

  try {
    // Connect to database
    await connectDatabase(mongoUri, mongoDbName);
    console.log('✓ Connected to MongoDB');

    // Create and configure server
    const server = createServer();

    // Get database connection and create offer components
    const db = getDatabase();
    const { service: offerService, repository: offerRepository } = createOfferComponents(db);

    // Decorate server with database and services
    server.decorate('db', db);
    server.decorate('offerService', offerService);
    server.decorate('offerRepository', offerRepository);

    // Set error handler
    server.setErrorHandler(errorHandler);

    // Register auth routes first (signup, login, accept-invite — no JWT required)
    registerAuthRoutes(server);
    registerInviteRoutes(server);
    registerApiKeyRoutes(server);

    // Add auth middleware (applies to all routes except /health and /api/auth/*)
    server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for health, auth endpoints, and checkout page endpoints
      // Checkout page endpoints use session_id as auth (not API key)
      // Skip /api/checkout/sess_* (cart load, customer save, select-payment, process-payment)
      // But DON'T skip /api/checkout/sessions (merchant session creation — needs auth)
      if (
        request.url === '/health'
        || request.url.startsWith('/api/auth/')
        || request.url.startsWith('/api/webhooks/')
        || (request.url.startsWith('/api/checkout/') && !request.url.includes('/sessions'))
      ) {
        return;
      }
      // Try JWT first (Authorization header)
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwtMiddleware = createJwtAuthMiddleware();
        return jwtMiddleware(request, reply);
      }
      // Fall back to API key
      const apikeyMiddleware = createAuthMiddleware(db);
      return apikeyMiddleware(request, reply);
    });

    // Register all route groups
    await registerOfferRoutes(server);
    await registerOffersCheckoutRoutes(server);
    await registerTrackingRoutes(server);
    await registerProductRoutes(server);
    await registerAnalyticsRoutes(server);
    registerCheckoutRoutes(server);
    registerOrderRoutes(server);
    registerBankRateRoutes(server);
    registerEMICampaignRoutes(server);
    registerIINRangeRoutes(server);
    registerPGCredentialsRoutes(server);
    // Register PG webhooks with verifier adapters (dependency injection — route depends on PGWebhookVerifier interface)
    const razorpayVerifier = new RazorpayAdapter('placeholder', 'placeholder');
    registerPGWebhook(server, razorpayVerifier, 'razorpay');
    registerTransactionRoutes(server);
    registerSettlementRoutes(server);
    registerRefundRoutes(server);
    registerAlertRoutes(server);

    // OEM adapter registry (composition root — inject dependencies)
    // New OEMs are registered here. No changes to consuming code (Open/Closed).
    // To add Samsung: register real SamsungAdapter here, remove mock for samsung brand
    const oemRegistry = new OEMAdapterRegistry();
    oemRegistry.register('samsung', new MockOEMAdapter());
    oemRegistry.register('apple', new MockOEMAdapter());
    oemRegistry.register('oneplus', new MockOEMAdapter());
    const oemService = new OEMService(oemRegistry);
    server.decorate('oemService', oemService);
    console.log(`✓ OEM adapters registered: ${oemService.getSupportedBrands().join(', ')}`);

    // Start session expiry cron (runs every 5 minutes)
    const stopSessionCron = startSessionExpiryCron(db);
    console.log('✓ Session expiry cron started (5 min interval)');

    const stopAnomalyCron = startAnomalyDetectionCron(db);
    console.log('✓ Anomaly detection cron started (5 min interval)');

    const stopAlertCleanup = startAlertCleanupCron(db);
    console.log('✓ Alert cleanup cron started (daily)');

    console.log('✓ All routes registered');

    // Start server
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`✓ Server listening on port ${port}`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} signal received. Shutting down gracefully...`);
      try {
        stopSessionCron();
        stopAnomalyCron();
        stopAlertCleanup();
        console.log('✓ All cron jobs stopped');
        await server.close();
        console.log('✓ Server closed');
        await closeDatabase();
        console.log('✓ Database connection closed');
        process.exit(0);
      } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
