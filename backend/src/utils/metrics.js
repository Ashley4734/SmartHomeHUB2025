import promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const deviceCount = new promClient.Gauge({
  name: 'smart_home_devices_total',
  help: 'Total number of registered devices',
  labelNames: ['protocol', 'type', 'status'],
  registers: [register],
});

export const automationExecutions = new promClient.Counter({
  name: 'automation_executions_total',
  help: 'Total number of automation executions',
  labelNames: ['automation_id', 'status'],
  registers: [register],
});

export const automationDuration = new promClient.Histogram({
  name: 'automation_duration_seconds',
  help: 'Duration of automation executions in seconds',
  labelNames: ['automation_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const voiceCommandsTotal = new promClient.Counter({
  name: 'voice_commands_total',
  help: 'Total number of voice commands processed',
  labelNames: ['status'],
  registers: [register],
});

export const aiRequestsTotal = new promClient.Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['provider', 'status'],
  registers: [register],
});

export const aiRequestDuration = new promClient.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI requests in seconds',
  labelNames: ['provider'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

export const errorCount = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
  registers: [register],
});

export const websocketConnections = new promClient.Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// Export register for metrics endpoint
export { register };

// Middleware to track HTTP metrics
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });

  next();
}

export default register;
