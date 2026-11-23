import { ZodError } from 'zod';

/**
 * Express middleware for Zod schema validation
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [target='body']
 */
export const validate = (schema, target = 'body') => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[target]);
      req[target] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(error);
      }
      next(error);
    }
  };
};

export default validate;
