import { z } from 'zod';

/**
 * Auth Schemas
 */
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  fullName: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

export const loginSchema = z
  .object({
    identifier: z.string().min(1).max(100).optional(),
    username: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
  })
  .refine(
    (data) => data.identifier || data.username || data.email,
    {
      message: 'Username or email is required',
      path: ['identifier'],
    }
  );

export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
  password: z.string().min(6).max(100).optional(),
});

/**
 * Device Schemas
 */
export const deviceControlSchema = z.object({
  command: z.string().min(1),
  value: z.any().optional(),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  roomId: z.string().uuid().optional().nullable(),
});

export const deviceQuerySchema = z.object({
  protocol: z.enum(['zigbee', 'matter', 'mqtt']).optional(),
  type: z.string().optional(),
  roomId: z.string().uuid().optional(),
  online: z.enum(['true', 'false']).optional(),
});

/**
 * Automation Schemas
 */
export const triggerConditionSchema = z.object({
  type: z.enum(['device_state', 'time', 'schedule', 'sensor']),
  deviceId: z.string().uuid().optional(),
  property: z.string().optional(),
  operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']).optional(),
  value: z.any().optional(),
  time: z.string().optional(),
  schedule: z.string().optional(),
});

export const actionSchema = z.object({
  type: z.enum(['device_control', 'scene', 'notification', 'delay']),
  deviceId: z.string().uuid().optional(),
  command: z.string().optional(),
  value: z.any().optional(),
  sceneId: z.string().uuid().optional(),
  message: z.string().optional(),
  delay: z.number().positive().optional(),
});

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  triggers: z.array(triggerConditionSchema).min(1),
  conditions: z.array(triggerConditionSchema).optional(),
  actions: z.array(actionSchema).min(1),
});

export const updateAutomationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  triggers: z.array(triggerConditionSchema).min(1).optional(),
  conditions: z.array(triggerConditionSchema).optional(),
  actions: z.array(actionSchema).min(1).optional(),
});

export const createAutomationFromTextSchema = z.object({
  text: z.string().min(1).max(1000),
});

/**
 * Scene Schemas
 */
export const sceneActionSchema = z.object({
  deviceId: z.string().uuid(),
  command: z.string(),
  value: z.any().optional(),
});

export const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  actions: z.array(sceneActionSchema).min(1),
});

export const updateSceneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  actions: z.array(sceneActionSchema).min(1).optional(),
});

/**
 * Room Schemas
 */
export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
});

/**
 * AI Schemas
 */
export const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().uuid().optional(),
  provider: z.enum(['ollama', 'openai', 'claude', 'gemini']).optional(),
});

export const analyzePatternSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  deviceId: z.string().uuid().optional(),
});

/**
 * Voice Schemas
 */
export const voiceCommandSchema = z.object({
  command: z.string().min(1).max(500),
});

export const voiceListeningSchema = z.object({
  action: z.enum(['start', 'stop']),
});

/**
 * Protocol Schemas
 */
export const zigbeePairingSchema = z.object({
  timeout: z.number().positive().max(300).optional(), // Max 5 minutes
});

export const matterCommissioningSchema = z.object({
  setupCode: z.string().optional(),
  discriminator: z.number().optional(),
  pinCode: z.number().optional(),
});

export const matterCommissionSchema = z.object({
  setupCode: z.string().min(1),
  deviceName: z.string().min(1).max(100).optional(),
});

/**
 * Pagination Schema
 */
export const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * ID Param Schema
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});
