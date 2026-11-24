import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import skillGapRoutes from './routes/skillGapRoutes.js';
import fairnessRoutes from './routes/fairnessRoutes.js';
import proctorRoutes from './routes/proctorRoutes.js';
import mongoose from 'mongoose';
import { checkJudge0Health } from './services/judge0/judge0Service.js';
import { checkAIHealth } from './services/llm/index.js';
import { Question, Skill } from './models/index.js';

export const createApp = () => {
  const app = express();

  // Security HTTP headers
  app.use(helmet());

  // Enable CORS
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Request Logging
  app.use(requestLogger);

  // Apply rate limiter to /api routes
  app.use('/api', apiLimiter);

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'AdaptIQ Backend & ML Engine'
    });
  });

  // Judge0 Sandbox Health Probe endpoint
  app.get('/api/health/judge0', async (req, res) => {
    try {
      const health = await checkJudge0Health();
      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        code: 'EXECUTION_UNAVAILABLE',
        message: 'Code execution is unavailable right now.',
        data: error.data || {
          status: 'DOWN',
          error: error.message
        }
      });
    }
  });

  // AI & LLM Subsystem Health Probe endpoint
  app.get('/api/health/ai', async (req, res) => {
    try {
      const health = await checkAIHealth();
      const statusCode = health.status === 'UP' || health.status === 'DEGRADED' ? 200 : 503;
      res.status(statusCode).json({
        success: health.status === 'UP' || health.status === 'DEGRADED',
        data: health
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        code: 'AI_UNAVAILABLE',
        message: 'AI service is unavailable right now.',
        data: {
          status: 'DOWN',
          error: error.message
        }
      });
    }
  });

  // Public Platform Statistics Endpoint (used by landing page and status indicators)
  const getPublicStats = async (req, res) => {
    try {
      let questionsCount = 0;
      let skillsCount = 0;
      try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          questionsCount = await Question.countDocuments();
          skillsCount = await Skill.countDocuments();
        }
      } catch {
        // Fallback if database query fails
      }

      if (!questionsCount) questionsCount = 160;
      if (!skillsCount) skillsCount = 84;

      const tracks = [
        'Full-Stack Engineering',
        'Frontend Mastery',
        'Backend & Systems',
        'Algorithms & Data Structures',
        'DevOps & Cloud Architecture',
        'Data Science & ML',
        'STAR Behavioral & Architecture'
      ];

      res.status(200).json({
        success: true,
        data: {
          questionsCount,
          skillsCount,
          tracksCount: tracks.length,
          roundsCount: 5,
          tracks,
          stages: [
            'Resume & Role Matching',
            'Adaptive 3PL IRT Assessment',
            'Sandboxed Code Execution',
            'STAR Behavioral Analysis',
            'Explainable Feedback & DAG Roadmap'
          ],
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve public statistics',
        error: error.message
      });
    }
  };

  app.get('/api/public/stats', getPublicStats);
  app.get('/api/stats/public', getPublicStats);

  // Root route handler: seamless redirection for browser navigation to frontend app
  app.get('/', (req, res) => {
    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
    if (req.accepts('html')) {
      return res.redirect(clientUrl);
    }
    res.status(200).json({
      success: true,
      service: 'AdaptIQ AI Interview & Proctoring Platform API',
      status: 'operational',
      clientUrl,
      apiHealth: '/api/health'
    });
  });

  // API Route Mounts
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/skills', skillGapRoutes);
  app.use('/api/fairness', fairnessRoutes);
  app.use('/api/proctor', proctorRoutes);

  // For any non-API route accessed via browser, automatically redirect to client SPA
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api') && req.accepts('html')) {
      const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}${req.originalUrl}`);
    }
    next();
  });

  // 404 Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
