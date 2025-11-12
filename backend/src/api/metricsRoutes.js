import express from 'express';
import { register } from '../utils/metrics.js';

const router = express.Router();

/**
 * GET /metrics - Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
});

export default router;
