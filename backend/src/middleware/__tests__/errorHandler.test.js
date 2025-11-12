import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ZodError, z } from 'zod';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../errorHandler.js';

describe('Error Handler Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  describe('Custom Error Classes', () => {
    describe('AppError', () => {
      test('should create error with default values', () => {
        const error = new AppError('Test error');

        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
        expect(error.status).toBe('error');
      });

      test('should create error with custom status code', () => {
        const error = new AppError('Not found', 404);

        expect(error.statusCode).toBe(404);
        expect(error.status).toBe('fail');
      });

      test('should set status to "fail" for 4xx errors', () => {
        const error = new AppError('Bad request', 400);
        expect(error.status).toBe('fail');
      });

      test('should set status to "error" for 5xx errors', () => {
        const error = new AppError('Server error', 500);
        expect(error.status).toBe('error');
      });

      test('should capture stack trace', () => {
        const error = new AppError('Test error');
        expect(error.stack).toBeDefined();
      });
    });

    describe('ValidationError', () => {
      test('should create validation error with 400 status', () => {
        const error = new ValidationError('Invalid input');

        expect(error.message).toBe('Invalid input');
        expect(error.statusCode).toBe(400);
        expect(error.status).toBe('fail');
      });
    });

    describe('AuthenticationError', () => {
      test('should create authentication error with default message', () => {
        const error = new AuthenticationError();

        expect(error.message).toBe('Authentication required');
        expect(error.statusCode).toBe(401);
      });

      test('should create authentication error with custom message', () => {
        const error = new AuthenticationError('Invalid credentials');

        expect(error.message).toBe('Invalid credentials');
        expect(error.statusCode).toBe(401);
      });
    });

    describe('AuthorizationError', () => {
      test('should create authorization error with default message', () => {
        const error = new AuthorizationError();

        expect(error.message).toBe('Permission denied');
        expect(error.statusCode).toBe(403);
      });

      test('should create authorization error with custom message', () => {
        const error = new AuthorizationError('Admin access required');

        expect(error.message).toBe('Admin access required');
        expect(error.statusCode).toBe(403);
      });
    });

    describe('NotFoundError', () => {
      test('should create not found error with default resource', () => {
        const error = new NotFoundError();

        expect(error.message).toBe('Resource not found');
        expect(error.statusCode).toBe(404);
      });

      test('should create not found error with custom resource', () => {
        const error = new NotFoundError('Device');

        expect(error.message).toBe('Device not found');
        expect(error.statusCode).toBe(404);
      });
    });

    describe('ConflictError', () => {
      test('should create conflict error', () => {
        const error = new ConflictError('Resource already exists');

        expect(error.message).toBe('Resource already exists');
        expect(error.statusCode).toBe(409);
      });
    });

    describe('RateLimitError', () => {
      test('should create rate limit error with default message', () => {
        const error = new RateLimitError();

        expect(error.message).toBe('Too many requests');
        expect(error.statusCode).toBe(429);
      });

      test('should create rate limit error with custom message', () => {
        const error = new RateLimitError('Rate limit exceeded');

        expect(error.message).toBe('Rate limit exceeded');
        expect(error.statusCode).toBe(429);
      });
    });
  });

  describe('notFoundHandler middleware', () => {
    test('should create NotFoundError with route', () => {
      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route /api/test not found',
          statusCode: 404,
        })
      );
    });

    test('should pass error to next middleware', () => {
      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    test('should use originalUrl for error message', () => {
      req.originalUrl = '/api/devices/123';

      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route /api/devices/123 not found',
        })
      );
    });
  });

  describe('asyncHandler wrapper', () => {
    test('should handle successful async functions', async () => {
      const asyncFn = async (req, res) => {
        res.json({ success: true });
      };

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    test('should catch async errors', async () => {
      const asyncFn = async () => {
        throw new Error('Async error');
      };

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Async error',
        })
      );
    });

    test('should work with synchronous functions', async () => {
      const syncFn = (req, res) => {
        res.json({ success: true });
      };

      const wrappedFn = asyncHandler(syncFn);
      await wrappedFn(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('should pass request, response, and next to handler', async () => {
      const asyncFn = jest.fn(async () => {});

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    });

    test('should handle custom AppErrors', async () => {
      const asyncFn = async () => {
        throw new ValidationError('Invalid data');
      };

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid data',
          statusCode: 400,
        })
      );
    });
  });

  describe('errorHandler middleware', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    describe('development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      test('should send full error details in development', () => {
        const error = new AppError('Test error', 500);

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'error',
            message: 'Test error',
            stack: expect.any(String),
          })
        );
      });

      test('should include error object in development', () => {
        const error = new AppError('Dev error', 400);

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Dev error',
              statusCode: 400,
            }),
          })
        );
      });
    });

    describe('production mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      test('should send operational errors in production', () => {
        const error = new AppError('Operational error', 404, true);

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          status: 'fail',
          message: 'Operational error',
        });
      });

      test('should hide details of non-operational errors', () => {
        const error = new Error('Programming error');
        error.isOperational = false;

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          status: 'error',
          message: 'Something went wrong',
        });
      });

      test('should include validation errors array', () => {
        const error = new AppError('Validation failed', 400);
        error.errors = [{ field: 'email', message: 'Invalid email' }];

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: [{ field: 'email', message: 'Invalid email' }],
          })
        );
      });
    });

    describe('Zod validation errors', () => {
      test('should handle Zod validation errors', () => {
        process.env.NODE_ENV = 'production';

        const schema = z.object({ email: z.string().email() });
        let zodError;

        try {
          schema.parse({ email: 'invalid' });
        } catch (err) {
          zodError = err;
        }

        errorHandler(zodError, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Validation failed',
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: expect.any(String),
                message: expect.any(String),
              }),
            ]),
          })
        );
      });
    });

    describe('JWT errors', () => {
      test('should handle JsonWebTokenError', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('jwt malformed');
        error.name = 'JsonWebTokenError';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid token. Please log in again.',
          })
        );
      });

      test('should handle TokenExpiredError', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Your token has expired. Please log in again.',
          })
        );
      });
    });

    describe('database errors', () => {
      test('should handle UNIQUE constraint errors', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('UNIQUE constraint failed');
        error.code = 'SQLITE_ERROR';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'A record with this value already exists',
          })
        );
      });

      test('should handle FOREIGN KEY constraint errors', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('FOREIGN KEY constraint failed');
        error.code = 'SQLITE_ERROR';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid reference to related record',
          })
        );
      });

      test('should handle generic SQLITE errors', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('SQLITE database error');
        error.code = 'SQLITE_ERROR';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Database operation failed',
          })
        );
      });

      test('should handle errors with SQLITE in message', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('Something SQLITE related');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('default status codes', () => {
      test('should default to 500 status code', () => {
        const error = new Error('Unknown error');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
      });

      test('should use existing status code if present', () => {
        const error = new Error('Custom error');
        error.statusCode = 418;

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(418);
      });
    });
  });
});
