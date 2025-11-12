import logger from '../utils/logger.js';

/**
 * Express middleware for logging HTTP requests
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  logger.http('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.http('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    originalSend.call(this, data);
  };

  next();
}

export default requestLogger;
