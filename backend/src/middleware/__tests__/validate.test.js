import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { validate, validateMultiple } from '../validate.js';

describe('Validate Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      query: {},
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('validate function', () => {
    const userSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      age: z.number().positive().optional(),
    });

    describe('body validation', () => {
      test('should validate valid body data', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should update req.body with validated data', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
          age: 25,
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(req.body).toEqual({
          email: 'test@example.com',
          password: 'password123',
          age: 25,
        });
      });

      test('should reject invalid email', async () => {
        req.body = {
          email: 'invalid-email',
          password: 'password123',
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          status: 'fail',
          message: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: expect.any(String),
            }),
          ]),
        });
        expect(next).not.toHaveBeenCalled();
      });

      test('should reject password too short', async () => {
        req.body = {
          email: 'test@example.com',
          password: '12345',
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'password',
              }),
            ]),
          })
        );
      });

      test('should include error code in response', async () => {
        req.body = {
          email: 'invalid',
          password: 'password123',
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        const errors = res.json.mock.calls[0][0].errors;
        expect(errors[0]).toHaveProperty('code');
      });

      test('should handle multiple validation errors', async () => {
        req.body = {
          email: 'invalid-email',
          password: '123',
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        const errors = res.json.mock.calls[0][0].errors;
        expect(errors.length).toBeGreaterThanOrEqual(2);
      });

      test('should handle missing required fields', async () => {
        req.body = {};

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Validation failed',
          })
        );
      });

      test('should handle optional fields', async () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123',
          // age is optional, omitting it
        };

        const middleware = validate(userSchema, 'body');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('query validation', () => {
      const querySchema = z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/),
      });

      test('should validate query parameters', async () => {
        req.query = {
          page: '1',
          limit: '10',
        };

        const middleware = validate(querySchema, 'query');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should reject invalid query parameters', async () => {
        req.query = {
          page: 'abc',
          limit: '10',
        };

        const middleware = validate(querySchema, 'query');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'page',
              }),
            ]),
          })
        );
      });
    });

    describe('params validation', () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      test('should validate URL parameters', async () => {
        req.params = {
          id: '123e4567-e89b-12d3-a456-426614174000',
        };

        const middleware = validate(paramsSchema, 'params');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should reject invalid UUID', async () => {
        req.params = {
          id: 'not-a-uuid',
        };

        const middleware = validate(paramsSchema, 'params');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('nested object validation', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      });

      test('should validate nested objects', async () => {
        req.body = {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        };

        const middleware = validate(nestedSchema, 'body');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      test('should report nested field errors correctly', async () => {
        req.body = {
          user: {
            name: 'John Doe',
            email: 'invalid-email',
          },
        };

        const middleware = validate(nestedSchema, 'body');
        await middleware(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'user.email',
              }),
            ]),
          })
        );
      });
    });

    describe('error handling', () => {
      test('should pass non-Zod errors to next', async () => {
        const errorSchema = {
          parseAsync: jest.fn().mockRejectedValue(new Error('Unknown error')),
        };

        req.body = { test: 'data' };

        const middleware = validate(errorSchema, 'body');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('async validation', () => {
      test('should handle async validation', async () => {
        const asyncSchema = z.object({
          email: z.string().email(),
        });

        req.body = {
          email: 'test@example.com',
        };

        const middleware = validate(asyncSchema, 'body');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('validateMultiple function', () => {
    const schemas = {
      body: z.object({
        name: z.string().min(1),
      }),
      query: z.object({
        page: z.string().regex(/^\d+$/),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    };

    test('should validate multiple sources successfully', async () => {
      req.body = { name: 'Test' };
      req.query = { page: '1' };
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple(schemas);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject validation errors from any source', async () => {
      req.body = { name: '' }; // Invalid
      req.query = { page: '1' };
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple(schemas);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              source: 'body',
              field: 'name',
            }),
          ]),
        })
      );
    });

    test('should collect errors from multiple sources', async () => {
      req.body = { name: '' }; // Invalid
      req.query = { page: 'abc' }; // Invalid
      req.params = { id: 'not-uuid' }; // Invalid

      const middleware = validateMultiple(schemas);
      await middleware(req, res, next);

      const errors = res.json.mock.calls[0][0].errors;
      expect(errors.length).toBe(3);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'body' }),
          expect.objectContaining({ source: 'query' }),
          expect.objectContaining({ source: 'params' }),
        ])
      );
    });

    test('should include source in error response', async () => {
      req.body = { name: '' };
      req.query = { page: '1' };
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple(schemas);
      await middleware(req, res, next);

      const errors = res.json.mock.calls[0][0].errors;
      expect(errors[0]).toHaveProperty('source', 'body');
    });

    test('should handle partial schema validation', async () => {
      const partialSchemas = {
        body: z.object({
          name: z.string(),
        }),
        // query and params not provided
      };

      req.body = { name: 'Test' };

      const middleware = validateMultiple(partialSchemas);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should skip validation when source data does not exist', async () => {
      const partialSchemas = {
        body: z.object({
          name: z.string(),
        }),
      };

      req.body = { name: 'Test' };
      // query and params not in schemas

      const middleware = validateMultiple(partialSchemas);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should update all validated sources', async () => {
      req.body = { name: 'Test' };
      req.query = { page: '1' };
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateMultiple(schemas);
      await middleware(req, res, next);

      expect(req.body).toEqual({ name: 'Test' });
      expect(req.query).toEqual({ page: '1' });
      expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    test('should silently skip schemas that throw non-Zod errors', async () => {
      // Non-Zod errors from parseAsync are caught but not re-thrown
      // This test verifies the middleware doesn't crash
      const errorSchemas = {
        body: {
          parseAsync: jest.fn().mockRejectedValue(new Error('Unknown error')),
        },
      };

      req.body = { test: 'data' };

      const middleware = validateMultiple(errorSchemas);
      await middleware(req, res, next);

      // Should continue without errors
      expect(next).toHaveBeenCalled();
    });

    test('should handle empty schemas object', async () => {
      const middleware = validateMultiple({});
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should validate only provided schemas', async () => {
      const singleSchema = {
        body: z.object({
          name: z.string(),
        }),
      };

      req.body = { name: 'Test' };
      req.query = { invalid: 'data' }; // Not validated

      const middleware = validateMultiple(singleSchema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
