import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment-specific configuration
 */
function loadConfig() {
  const env = process.env.NODE_ENV || 'development';

  // Try to load environment-specific file first
  const envFile = path.join(__dirname, `../../.env.${env}`);
  dotenv.config({ path: envFile });

  // Then load .env for any missing values
  const defaultEnvFile = path.join(__dirname, '../../.env');
  dotenv.config({ path: defaultEnvFile });
}

// Load configuration on module import
loadConfig();

/**
 * Configuration object with typed values and defaults
 */
export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  dbPath: process.env.DB_PATH || './data/smart-home.db',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Backup
  backupDir: process.env.BACKUP_DIR || './backups',
  maxBackups: parseInt(process.env.MAX_BACKUPS || '30', 10),

  // AI Providers
  ai: {
    ollama: {
      enabled: process.env.OLLAMA_ENABLED === 'true',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
    openai: {
      enabled: process.env.OPENAI_ENABLED === 'true',
      apiKey: process.env.OPENAI_API_KEY,
    },
    claude: {
      enabled: process.env.CLAUDE_ENABLED === 'true',
      apiKey: process.env.CLAUDE_API_KEY,
    },
    gemini: {
      enabled: process.env.GEMINI_ENABLED === 'true',
      apiKey: process.env.GEMINI_API_KEY,
    },
  },

  // Zigbee
  zigbee: {
    enabled: process.env.ZIGBEE_ENABLED === 'true',
    port: process.env.ZIGBEE_PORT || '/dev/ttyUSB0',
    adapter: process.env.ZIGBEE_ADAPTER || 'zstack',
    channel: parseInt(process.env.ZIGBEE_CHANNEL || '11', 10),
    panId: process.env.ZIGBEE_PAN_ID || '0x1a62',
  },

  // Matter
  matter: {
    enabled: process.env.MATTER_ENABLED === 'true',
    port: parseInt(process.env.MATTER_PORT || '5540', 10),
    discriminator: parseInt(process.env.MATTER_DISCRIMINATOR || '3840', 10),
    passcode: parseInt(process.env.MATTER_PASSCODE || '20202021', 10),
  },

  // Voice
  voice: {
    enabled: process.env.VOICE_ENABLED === 'true',
    language: process.env.VOICE_LANGUAGE || 'en-US',
  },

  // Redis
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // Monitoring
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false', // Default to true
  },
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const errors = [];

  if (config.env === 'production' && config.jwtSecret === 'change-this-secret') {
    errors.push('JWT_SECRET must be set in production');
  }

  if (config.ai.openai.enabled && !config.ai.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required when OpenAI is enabled');
  }

  if (config.ai.claude.enabled && !config.ai.claude.apiKey) {
    errors.push('CLAUDE_API_KEY is required when Claude is enabled');
  }

  if (config.ai.gemini.enabled && !config.ai.gemini.apiKey) {
    errors.push('GEMINI_API_KEY is required when Gemini is enabled');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

export default config;
