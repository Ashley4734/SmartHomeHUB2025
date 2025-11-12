/**
 * Tests for configuration module
 */

import { jest } from '@jest/globals';

describe('Config Module', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear module cache
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('should load default configuration', async () => {
      const { config } = await import('../config.js');

      expect(config).toHaveProperty('env');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('dbPath');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('jwtExpiresIn');
      expect(config).toHaveProperty('bcryptRounds');
    });

    it('should use environment variables when provided', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.HOST = '127.0.0.1';
      process.env.JWT_SECRET = 'test-secret';
      process.env.JWT_EXPIRES_IN = '1h';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.env).toBe('production');
      expect(config.port).toBe(8080);
      expect(config.host).toBe('127.0.0.1');
      expect(config.jwtSecret).toBe('test-secret');
      expect(config.jwtExpiresIn).toBe('1h');
    });

    it('should parse integer values correctly', async () => {
      process.env.PORT = '5000';
      process.env.BCRYPT_ROUNDS = '10';
      process.env.RATE_LIMIT_WINDOW_MS = '60000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '50';
      process.env.MAX_BACKUPS = '10';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.port).toBe(5000);
      expect(config.bcryptRounds).toBe(10);
      expect(config.rateLimitWindowMs).toBe(60000);
      expect(config.rateLimitMaxRequests).toBe(50);
      expect(config.maxBackups).toBe(10);
    });

    it('should configure AI providers correctly', async () => {
      process.env.OLLAMA_ENABLED = 'true';
      process.env.OLLAMA_BASE_URL = 'http://ollama:11434';
      process.env.OPENAI_ENABLED = 'true';
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.CLAUDE_ENABLED = 'true';
      process.env.CLAUDE_API_KEY = 'claude-test';
      process.env.GEMINI_ENABLED = 'true';
      process.env.GEMINI_API_KEY = 'gemini-test';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.ai.ollama.enabled).toBe(true);
      expect(config.ai.ollama.baseUrl).toBe('http://ollama:11434');
      expect(config.ai.openai.enabled).toBe(true);
      expect(config.ai.openai.apiKey).toBe('sk-test');
      expect(config.ai.claude.enabled).toBe(true);
      expect(config.ai.claude.apiKey).toBe('claude-test');
      expect(config.ai.gemini.enabled).toBe(true);
      expect(config.ai.gemini.apiKey).toBe('gemini-test');
    });

    it('should configure Zigbee settings correctly', async () => {
      process.env.ZIGBEE_ENABLED = 'true';
      process.env.ZIGBEE_PORT = '/dev/ttyACM0';
      process.env.ZIGBEE_ADAPTER = 'deconz';
      process.env.ZIGBEE_CHANNEL = '15';
      process.env.ZIGBEE_PAN_ID = '0x1234';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.zigbee.enabled).toBe(true);
      expect(config.zigbee.port).toBe('/dev/ttyACM0');
      expect(config.zigbee.adapter).toBe('deconz');
      expect(config.zigbee.channel).toBe(15);
      expect(config.zigbee.panId).toBe('0x1234');
    });

    it('should configure Matter settings correctly', async () => {
      process.env.MATTER_ENABLED = 'true';
      process.env.MATTER_PORT = '5541';
      process.env.MATTER_DISCRIMINATOR = '3841';
      process.env.MATTER_PASSCODE = '12345678';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.matter.enabled).toBe(true);
      expect(config.matter.port).toBe(5541);
      expect(config.matter.discriminator).toBe(3841);
      expect(config.matter.passcode).toBe(12345678);
    });

    it('should configure Voice settings correctly', async () => {
      process.env.VOICE_ENABLED = 'true';
      process.env.VOICE_LANGUAGE = 'es-ES';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.voice.enabled).toBe(true);
      expect(config.voice.language).toBe('es-ES');
    });

    it('should configure Redis settings correctly', async () => {
      process.env.REDIS_ENABLED = 'true';
      process.env.REDIS_HOST = 'redis-server';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'redis-pass';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.redis.enabled).toBe(true);
      expect(config.redis.host).toBe('redis-server');
      expect(config.redis.port).toBe(6380);
      expect(config.redis.password).toBe('redis-pass');
    });

    it('should enable metrics by default', async () => {
      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.metrics.enabled).toBe(true);
    });

    it('should disable metrics when explicitly set', async () => {
      process.env.METRICS_ENABLED = 'false';

      jest.resetModules();
      const { config } = await import('../config.js');

      expect(config.metrics.enabled).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should pass validation with default development config', async () => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should fail validation when JWT_SECRET is default in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'change-this-secret';

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).toThrow('JWT_SECRET must be set in production');
    });

    it('should pass validation with custom JWT_SECRET in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'custom-secret-key';

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should fail validation when OpenAI is enabled without API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.OPENAI_ENABLED = 'true';
      delete process.env.OPENAI_API_KEY;

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).toThrow('OPENAI_API_KEY is required when OpenAI is enabled');
    });

    it('should pass validation when OpenAI is enabled with API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.OPENAI_ENABLED = 'true';
      process.env.OPENAI_API_KEY = 'sk-test-key';

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should fail validation when Claude is enabled without API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.CLAUDE_ENABLED = 'true';
      delete process.env.CLAUDE_API_KEY;

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).toThrow('CLAUDE_API_KEY is required when Claude is enabled');
    });

    it('should pass validation when Claude is enabled with API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.CLAUDE_ENABLED = 'true';
      process.env.CLAUDE_API_KEY = 'claude-test-key';

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should fail validation when Gemini is enabled without API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.GEMINI_ENABLED = 'true';
      delete process.env.GEMINI_API_KEY;

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).toThrow('GEMINI_API_KEY is required when Gemini is enabled');
    });

    it('should pass validation when Gemini is enabled with API key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.GEMINI_ENABLED = 'true';
      process.env.GEMINI_API_KEY = 'gemini-test-key';

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should report multiple validation errors', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'change-this-secret';
      process.env.OPENAI_ENABLED = 'true';
      delete process.env.OPENAI_API_KEY;
      process.env.CLAUDE_ENABLED = 'true';
      delete process.env.CLAUDE_API_KEY;

      jest.resetModules();
      const { validateConfig } = await import('../config.js');

      expect(() => validateConfig()).toThrow('Configuration errors:');
      expect(() => validateConfig()).toThrow('JWT_SECRET must be set in production');
      expect(() => validateConfig()).toThrow('OPENAI_API_KEY is required when OpenAI is enabled');
      expect(() => validateConfig()).toThrow('CLAUDE_API_KEY is required when Claude is enabled');
    });
  });
});
