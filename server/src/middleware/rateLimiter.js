import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Standard API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

/**
 * Strict limiter for authentication routes (login, register)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // max 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

/**
 * LLM generation limiter to prevent API budget exhaustion
 */
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // max 30 LLM requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'AI evaluation rate limit reached. Please wait a moment before sending more responses.'
  }
});
