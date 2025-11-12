import { ZodError } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * Validation middleware factory
 * @param {object} schema - Zod schema to validate against
 * @param {string} source - Where to get data from: 'body', 'query', 'params'
 */
export function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const data = req[source];
      const validated = await schema.parseAsync(data);
      req[source] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors,
        });
      }
      next(error);
    }
  };
}

/**
 * Validate multiple sources at once
 * @param {object} schemas - Object with keys: body, query, params
 */
export function validateMultiple(schemas) {
  return async (req, res, next) => {
    try {
      const errors = [];

      for (const [source, schema] of Object.entries(schemas)) {
        if (schema && req[source]) {
          try {
            const validated = await schema.parseAsync(req[source]);
            req[source] = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(
                ...error.errors.map((err) => ({
                  source,
                  field: err.path.join('.'),
                  message: err.message,
                  code: err.code,
                }))
              );
            }
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default validate;
