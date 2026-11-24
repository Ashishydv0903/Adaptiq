import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { initSocket } from './services/socket.js';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server, env.CLIENT_URL);

const startServer = async () => {
  try {
    // Attempt DB connection
    await connectDB().catch((err) => {
      logger.warn(`Database connection deferred: ${err.message}`);
    });

    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 AdaptIQ Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      if (!env.GEMINI_API_KEY) {
        logger.warn('⚠️ [AI CONFIGURATION] No GEMINI_API_KEY configured: AI scoring will use the heuristic scorer.');
      }
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

const handleShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Only start when invoked directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { app, server };
