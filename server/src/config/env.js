import dotenv from 'dotenv';
import crypto from 'crypto';
import { z } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// In development / test, generate random secrets at startup if not provided or too short
let jwtSecret = process.env.JWT_SECRET;
let jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

if (!jwtSecret || (!isProduction && jwtSecret.length < 32)) {
  if (!isProduction) {
    if (jwtSecret && jwtSecret.length < 32) {
      console.warn('⚠️ [SECURITY WARNING] JWT_SECRET is under 32 characters. Generated random 32-byte secret for development/testing.');
    } else {
      console.warn('⚠️ [SECURITY WARNING] JWT_SECRET not set in environment. Generated random 32-byte secret for development/testing.');
    }
    jwtSecret = crypto.randomBytes(32).toString('hex');
  }
}

if (!jwtRefreshSecret || (!isProduction && jwtRefreshSecret.length < 32)) {
  if (!isProduction) {
    if (jwtRefreshSecret && jwtRefreshSecret.length < 32) {
      console.warn('⚠️ [SECURITY WARNING] JWT_REFRESH_SECRET is under 32 characters. Generated random 32-byte secret for development/testing.');
    } else {
      console.warn('⚠️ [SECURITY WARNING] JWT_REFRESH_SECRET not set in environment. Generated random 32-byte secret for development/testing.');
    }
    jwtRefreshSecret = crypto.randomBytes(32).toString('hex');
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/adaptiq'),
  MONGO_TEST_URI: z.string().default('mongodb://127.0.0.1:27017/adaptiq_test'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LLM_PROVIDER: z.enum(['gemini']).default('gemini'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),

  WHISPER_PROVIDER: z.enum(['groq', 'openai']).default('groq'),
  WHISPER_API_KEY: z.string().optional().default(''),

  JUDGE0_API_URL: z.string().default('http://localhost:2358'),
  JUDGE0_API_KEY: z.string().optional().default(''),
  JUDGE0_API_HOST: z.string().optional().default(''),
  ALLOW_UNSAFE_LOCAL_EXEC: z
    .union([z.boolean(), z.string()])
    .transform((val) => String(val).toLowerCase() === 'true')
    .default(false),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100)
});

const parseEnv = () => {
  const envToValidate = {
    ...process.env,
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret
  };

  const result = envSchema.safeParse(envToValidate);
  if (!result.success) {
    console.error('❌ Environment validation failed:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration: JWT_SECRET and JWT_REFRESH_SECRET must be set and at least 32 characters in production');
  }
  return result.data;
};

export const env = parseEnv();
export default env;
