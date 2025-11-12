import logger from '../utils/logger.js';
import { ZodError } from 'zod';

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error types for specific scenarios
 */
export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error) {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return {
    statusCode: 400,
    message: 'Validation failed',
    errors,
  };
}

/**
 * Handle JWT errors
 */
function handleJWTError() {
  return {
    statusCode: 401,
    message: 'Invalid token. Please log in again.',
  };
}

/**
 * Handle JWT expired errors
 */
function handleJWTExpiredError() {
  return {
    statusCode: 401,
    message: 'Your token has expired. Please log in again.',
  };
}

/**
 * Handle database errors
 */
function handleDatabaseError(error) {
  logger.error('Database error:', { error: error.message });

  // SQLite specific errors
  if (error.message.includes('UNIQUE constraint')) {
    return {
      statusCode: 409,
      message: 'A record with this value already exists',
    };
  }

  if (error.message.includes('FOREIGN KEY constraint')) {
    return {
      statusCode: 400,
      message: 'Invalid reference to related record',
    };
  }

  return {
    statusCode: 500,
    message: 'Database operation failed',
  };
}

/**
 * Send error response in development
 */
function sendErrorDev(err, res) {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
}

/**
 * Send error response in production
 */
function sendErrorProd(err, res) {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or unknown error: log but still use status code
    logger.error('Unexpected error:', {
      error: err.message,
      stack: err.stack,
    });

    // Use custom status code if present, otherwise default to 500
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: statusCode === 500 ? 'Something went wrong' : err.message,
    });
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error
  logger.error('Error occurred:', {
    method: req.method,
    url: req.url,
    statusCode: err.statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = err;

    // Handle specific error types
    if (err instanceof ZodError) {
      const zodError = handleZodError(err);
      error = new AppError(zodError.message, zodError.statusCode);
      error.errors = zodError.errors;
    } else if (err.name === 'JsonWebTokenError') {
      const jwtError = handleJWTError();
      error = new AppError(jwtError.message, jwtError.statusCode);
    } else if (err.name === 'TokenExpiredError') {
      const expiredError = handleJWTExpiredError();
      error = new AppError(expiredError.message, expiredError.statusCode);
    } else if (err.code === 'SQLITE_ERROR' || err.message.includes('SQLITE')) {
      const dbError = handleDatabaseError(err);
      error = new AppError(dbError.message, dbError.statusCode);
    }

    sendErrorProd(error, res);
  }
}

/**
 * Catch 404 errors
 */
export function notFoundHandler(req, res, next) {
  const err = new NotFoundError(`Route ${req.originalUrl}`);
  next(err);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
