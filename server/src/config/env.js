import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/adaptiq'),
  MONGO_TEST_URI: z.string().default('mongodb://127.0.0.1:27017/adaptiq_test'),

  JWT_SECRET: z.string().min(16).default('super_secure_jwt_secret_key_adaptiq_2026_dev_min_32_chars'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(16).default('super_secure_refresh_secret_key_adaptiq_2026_dev_min_32_chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LLM_PROVIDER: z.enum(['gemini', 'openai', 'claude']).default('gemini'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('text-embedding-004'),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  WHISPER_PROVIDER: z.enum(['groq', 'openai']).default('groq'),
  WHISPER_API_KEY: z.string().optional().default(''),

  JUDGE0_API_URL: z.string().default('http://localhost:2358'),
  JUDGE0_API_KEY: z.string().optional().default(''),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100)
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Environment validation failed:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};

export const env = parseEnv();
export default env;
