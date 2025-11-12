import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import metricsRoutes from '../metricsRoutes.js';
import { register, httpRequestTotal } from '../../utils/metrics.js';

describe('Metrics Routes', () => {
  let app;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api', metricsRoutes);
  });

  afterAll(async () => {
    // Clear metrics after tests
    register.clear();
  });

  describe('GET /api/metrics', () => {
    test('should return metrics in Prometheus format', async () => {
      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });

    test('should include default metrics', async () => {
      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      // Check for some default Node.js metrics
      expect(response.text).toContain('process_cpu_');
      expect(response.text).toContain('nodejs_');
    });

    test('should include custom metrics if available', async () => {
      // Increment a custom metric
      httpRequestTotal.labels('GET', '/test', '200').inc();

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.text).toContain('http_requests_total');
    });

    test('should handle metrics collection errors gracefully', async () => {
      // Mock register.metrics to throw an error
      const originalMetrics = register.metrics;
      register.metrics = async () => {
        throw new Error('Metrics collection failed');
      };

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(500);
      expect(response.text).toContain('Metrics collection failed');

      // Restore original method
      register.metrics = originalMetrics;
    });

    test('should return metrics on multiple requests', async () => {
      const response1 = await request(app).get('/api/metrics');
      const response2 = await request(app).get('/api/metrics');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.text).toBeDefined();
      expect(response2.text).toBeDefined();
    });

    test('should have correct content-type header', async () => {
      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBeTruthy();
      expect(response.headers['content-type']).toMatch(register.contentType);
    });
  });
});
