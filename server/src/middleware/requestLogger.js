import morgan from 'morgan';
import { env } from '../config/env.js';

/**
 * HTTP request logging middleware
 */
export const requestLogger = env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined');

export default requestLogger;
