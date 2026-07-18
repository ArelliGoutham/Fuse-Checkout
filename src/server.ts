/* eslint-disable no-undef */
import { createServer } from './app';
import { connectDatabase, closeDatabase, getDatabase } from './config/database';
import { registerOfferRoutes } from './modules/offers/routes/offer-routes';
import { registerCheckoutRoutes } from './modules/offers/routes/checkout-routes';
import { registerTrackingRoutes } from './modules/offers/routes/tracking-routes';
import { registerProductRoutes } from './modules/products/routes/product-routes';
import { registerAnalyticsRoutes } from './modules/analytics/analytics-routes';
import { createOfferComponents } from './modules/offers';

async function start() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const mongoDbName = process.env.MONGO_DB_NAME || 'offerforge';
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

    // Register all route groups
    await registerOfferRoutes(server);
    await registerCheckoutRoutes(server);
    await registerTrackingRoutes(server);
    await registerProductRoutes(server);
    await registerAnalyticsRoutes(server);

    console.log('✓ All routes registered');

    // Start server
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`✓ Server listening on port ${port}`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} signal received. Shutting down gracefully...`);
      try {
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
