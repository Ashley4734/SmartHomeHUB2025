import { describe, expect, test } from '@jest/globals';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  deviceControlSchema,
  updateDeviceSchema,
  deviceQuerySchema,
  triggerConditionSchema,
  actionSchema,
  createAutomationSchema,
  updateAutomationSchema,
  createAutomationFromTextSchema,
  sceneActionSchema,
  createSceneSchema,
  updateSceneSchema,
  createRoomSchema,
  updateRoomSchema,
  chatSchema,
  analyzePatternSchema,
  voiceCommandSchema,
  voiceListeningSchema,
  zigbeePairingSchema,
  matterCommissioningSchema,
  matterCommissionSchema,
  paginationSchema,
  uuidParamSchema,
  idParamSchema,
} from '../schemas.js';

describe('Auth Schemas', () => {
  describe('registerSchema', () => {
    test('should validate correct registration data', () => {
      const valid = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };
      expect(() => registerSchema.parse(valid)).not.toThrow();
    });

    test('should validate with optional role', () => {
      const valid = {
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'password123',
        fullName: 'Admin User',
        role: 'admin',
      };
      expect(() => registerSchema.parse(valid)).not.toThrow();
    });

    test('should reject username too short', () => {
      const invalid = {
        username: 'ab',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };
      expect(() => registerSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid email', () => {
      const invalid = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
        fullName: 'Test User',
      };
      expect(() => registerSchema.parse(invalid)).toThrow();
    });

    test('should reject password too short', () => {
      const invalid = {
        username: 'testuser',
        email: 'test@example.com',
        password: '12345',
        fullName: 'Test User',
      };
      expect(() => registerSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid role', () => {
      const invalid = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'superadmin',
      };
      expect(() => registerSchema.parse(invalid)).toThrow();
    });
  });

  describe('loginSchema', () => {
    test('should validate correct login data', () => {
      const valid = { email: 'test@example.com', password: 'password' };
      expect(() => loginSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalid = { email: 'not-an-email', password: 'password' };
      expect(() => loginSchema.parse(invalid)).toThrow();
    });

    test('should reject empty password', () => {
      const invalid = { email: 'test@example.com', password: '' };
      expect(() => loginSchema.parse(invalid)).toThrow();
    });
  });

  describe('updateUserSchema', () => {
    test('should validate partial updates', () => {
      const valid = { username: 'newusername' };
      expect(() => updateUserSchema.parse(valid)).not.toThrow();
    });

    test('should validate multiple field updates', () => {
      const valid = {
        username: 'newusername',
        email: 'newemail@example.com',
        fullName: 'New Name',
      };
      expect(() => updateUserSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid email', () => {
      const invalid = { email: 'not-valid' };
      expect(() => updateUserSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Device Schemas', () => {
  describe('deviceControlSchema', () => {
    test('should validate command without value', () => {
      const valid = { command: 'toggle' };
      expect(() => deviceControlSchema.parse(valid)).not.toThrow();
    });

    test('should validate command with value', () => {
      const valid = { command: 'setBrightness', value: 75 };
      expect(() => deviceControlSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty command', () => {
      const invalid = { command: '' };
      expect(() => deviceControlSchema.parse(invalid)).toThrow();
    });
  });

  describe('updateDeviceSchema', () => {
    test('should validate name update', () => {
      const valid = { name: 'Living Room Light' };
      expect(() => updateDeviceSchema.parse(valid)).not.toThrow();
    });

    test('should validate roomId update', () => {
      const valid = { roomId: '123e4567-e89b-12d3-a456-426614174000' };
      expect(() => updateDeviceSchema.parse(valid)).not.toThrow();
    });

    test('should accept null roomId', () => {
      const valid = { roomId: null };
      expect(() => updateDeviceSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid UUID', () => {
      const invalid = { roomId: 'not-a-uuid' };
      expect(() => updateDeviceSchema.parse(invalid)).toThrow();
    });
  });

  describe('deviceQuerySchema', () => {
    test('should validate protocol filter', () => {
      const valid = { protocol: 'zigbee' };
      expect(() => deviceQuerySchema.parse(valid)).not.toThrow();
    });

    test('should validate multiple filters', () => {
      const valid = {
        protocol: 'matter',
        type: 'light',
        online: 'true',
      };
      expect(() => deviceQuerySchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid protocol', () => {
      const invalid = { protocol: 'zwave' };
      expect(() => deviceQuerySchema.parse(invalid)).toThrow();
    });

    test('should reject invalid online value', () => {
      const invalid = { online: 'yes' };
      expect(() => deviceQuerySchema.parse(invalid)).toThrow();
    });
  });
});

describe('Automation Schemas', () => {
  describe('triggerConditionSchema', () => {
    test('should validate device_state trigger', () => {
      const valid = {
        type: 'device_state',
        deviceId: '123e4567-e89b-12d3-a456-426614174000',
        property: 'temperature',
        operator: 'gt',
        value: 25,
      };
      expect(() => triggerConditionSchema.parse(valid)).not.toThrow();
    });

    test('should validate time trigger', () => {
      const valid = {
        type: 'time',
        time: '18:00',
      };
      expect(() => triggerConditionSchema.parse(valid)).not.toThrow();
    });

    test('should validate schedule trigger', () => {
      const valid = {
        type: 'schedule',
        schedule: '0 8 * * MON-FRI',
      };
      expect(() => triggerConditionSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid type', () => {
      const invalid = { type: 'invalid_type' };
      expect(() => triggerConditionSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid operator', () => {
      const invalid = {
        type: 'device_state',
        operator: 'equals',
      };
      expect(() => triggerConditionSchema.parse(invalid)).toThrow();
    });
  });

  describe('actionSchema', () => {
    test('should validate device_control action', () => {
      const valid = {
        type: 'device_control',
        deviceId: '123e4567-e89b-12d3-a456-426614174000',
        command: 'turnOn',
      };
      expect(() => actionSchema.parse(valid)).not.toThrow();
    });

    test('should validate notification action', () => {
      const valid = {
        type: 'notification',
        message: 'Temperature alert!',
      };
      expect(() => actionSchema.parse(valid)).not.toThrow();
    });

    test('should validate delay action', () => {
      const valid = {
        type: 'delay',
        delay: 5000,
      };
      expect(() => actionSchema.parse(valid)).not.toThrow();
    });

    test('should reject negative delay', () => {
      const invalid = {
        type: 'delay',
        delay: -100,
      };
      expect(() => actionSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid action type', () => {
      const invalid = { type: 'invalid' };
      expect(() => actionSchema.parse(invalid)).toThrow();
    });
  });

  describe('createAutomationSchema', () => {
    test('should validate complete automation', () => {
      const valid = {
        name: 'Evening Routine',
        description: 'Turn on lights at sunset',
        enabled: true,
        triggers: [{ type: 'time', time: '18:00' }],
        actions: [
          {
            type: 'device_control',
            deviceId: '123e4567-e89b-12d3-a456-426614174000',
            command: 'turnOn',
          },
        ],
      };
      expect(() => createAutomationSchema.parse(valid)).not.toThrow();
    });

    test('should validate automation with conditions', () => {
      const valid = {
        name: 'Smart Heating',
        triggers: [{ type: 'time', time: '07:00' }],
        conditions: [
          {
            type: 'sensor',
            property: 'temperature',
            operator: 'lt',
            value: 18,
          },
        ],
        actions: [
          {
            type: 'device_control',
            deviceId: '123e4567-e89b-12d3-a456-426614174000',
            command: 'turnOn',
          },
        ],
      };
      expect(() => createAutomationSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty triggers array', () => {
      const invalid = {
        name: 'Test',
        triggers: [],
        actions: [{ type: 'notification', message: 'test' }],
      };
      expect(() => createAutomationSchema.parse(invalid)).toThrow();
    });

    test('should reject empty actions array', () => {
      const invalid = {
        name: 'Test',
        triggers: [{ type: 'time', time: '18:00' }],
        actions: [],
      };
      expect(() => createAutomationSchema.parse(invalid)).toThrow();
    });

    test('should default enabled to true', () => {
      const valid = {
        name: 'Test',
        triggers: [{ type: 'time', time: '18:00' }],
        actions: [{ type: 'notification', message: 'test' }],
      };
      const result = createAutomationSchema.parse(valid);
      expect(result.enabled).toBe(true);
    });
  });

  describe('updateAutomationSchema', () => {
    test('should validate partial update', () => {
      const valid = { name: 'Updated Name' };
      expect(() => updateAutomationSchema.parse(valid)).not.toThrow();
    });

    test('should validate enabled toggle', () => {
      const valid = { enabled: false };
      expect(() => updateAutomationSchema.parse(valid)).not.toThrow();
    });
  });

  describe('createAutomationFromTextSchema', () => {
    test('should validate text automation', () => {
      const valid = { text: 'Turn on lights when I get home' };
      expect(() => createAutomationFromTextSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty text', () => {
      const invalid = { text: '' };
      expect(() => createAutomationFromTextSchema.parse(invalid)).toThrow();
    });

    test('should reject text too long', () => {
      const invalid = { text: 'a'.repeat(1001) };
      expect(() => createAutomationFromTextSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Scene Schemas', () => {
  describe('sceneActionSchema', () => {
    test('should validate scene action', () => {
      const valid = {
        deviceId: '123e4567-e89b-12d3-a456-426614174000',
        command: 'setBrightness',
        value: 50,
      };
      expect(() => sceneActionSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid UUID', () => {
      const invalid = { deviceId: 'not-a-uuid', command: 'turnOn' };
      expect(() => sceneActionSchema.parse(invalid)).toThrow();
    });
  });

  describe('createSceneSchema', () => {
    test('should validate complete scene', () => {
      const valid = {
        name: 'Movie Night',
        description: 'Dim lights for movies',
        icon: 'movie',
        actions: [
          {
            deviceId: '123e4567-e89b-12d3-a456-426614174000',
            command: 'setBrightness',
            value: 20,
          },
        ],
      };
      expect(() => createSceneSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty actions', () => {
      const invalid = {
        name: 'Test Scene',
        actions: [],
      };
      expect(() => createSceneSchema.parse(invalid)).toThrow();
    });
  });

  describe('updateSceneSchema', () => {
    test('should validate partial update', () => {
      const valid = { name: 'Updated Scene Name' };
      expect(() => updateSceneSchema.parse(valid)).not.toThrow();
    });
  });
});

describe('Room Schemas', () => {
  describe('createRoomSchema', () => {
    test('should validate room creation', () => {
      const valid = {
        name: 'Living Room',
        description: 'Main living area',
        icon: 'sofa',
      };
      expect(() => createRoomSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty name', () => {
      const invalid = { name: '' };
      expect(() => createRoomSchema.parse(invalid)).toThrow();
    });
  });

  describe('updateRoomSchema', () => {
    test('should validate partial update', () => {
      const valid = { icon: 'home' };
      expect(() => updateRoomSchema.parse(valid)).not.toThrow();
    });
  });
});

describe('AI Schemas', () => {
  describe('chatSchema', () => {
    test('should validate chat message', () => {
      const valid = { message: 'Turn on the living room lights' };
      expect(() => chatSchema.parse(valid)).not.toThrow();
    });

    test('should validate with conversationId', () => {
      const valid = {
        message: 'What is the temperature?',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      };
      expect(() => chatSchema.parse(valid)).not.toThrow();
    });

    test('should validate with provider', () => {
      const valid = {
        message: 'Hello',
        provider: 'ollama',
      };
      expect(() => chatSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty message', () => {
      const invalid = { message: '' };
      expect(() => chatSchema.parse(invalid)).toThrow();
    });

    test('should reject message too long', () => {
      const invalid = { message: 'a'.repeat(5001) };
      expect(() => chatSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid provider', () => {
      const invalid = { message: 'test', provider: 'gpt4' };
      expect(() => chatSchema.parse(invalid)).toThrow();
    });
  });

  describe('analyzePatternSchema', () => {
    test('should validate empty pattern analysis', () => {
      const valid = {};
      expect(() => analyzePatternSchema.parse(valid)).not.toThrow();
    });

    test('should validate with date range', () => {
      const valid = {
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-12-31T23:59:59Z',
      };
      expect(() => analyzePatternSchema.parse(valid)).not.toThrow();
    });

    test('should validate with deviceId', () => {
      const valid = {
        deviceId: '123e4567-e89b-12d3-a456-426614174000',
      };
      expect(() => analyzePatternSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid datetime', () => {
      const invalid = { startDate: 'not-a-date' };
      expect(() => analyzePatternSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Voice Schemas', () => {
  describe('voiceCommandSchema', () => {
    test('should validate voice command', () => {
      const valid = { command: 'turn on the lights' };
      expect(() => voiceCommandSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty command', () => {
      const invalid = { command: '' };
      expect(() => voiceCommandSchema.parse(invalid)).toThrow();
    });

    test('should reject command too long', () => {
      const invalid = { command: 'a'.repeat(501) };
      expect(() => voiceCommandSchema.parse(invalid)).toThrow();
    });
  });

  describe('voiceListeningSchema', () => {
    test('should validate start action', () => {
      const valid = { action: 'start' };
      expect(() => voiceListeningSchema.parse(valid)).not.toThrow();
    });

    test('should validate stop action', () => {
      const valid = { action: 'stop' };
      expect(() => voiceListeningSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid action', () => {
      const invalid = { action: 'pause' };
      expect(() => voiceListeningSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Protocol Schemas', () => {
  describe('zigbeePairingSchema', () => {
    test('should validate without timeout', () => {
      const valid = {};
      expect(() => zigbeePairingSchema.parse(valid)).not.toThrow();
    });

    test('should validate with timeout', () => {
      const valid = { timeout: 120 };
      expect(() => zigbeePairingSchema.parse(valid)).not.toThrow();
    });

    test('should reject negative timeout', () => {
      const invalid = { timeout: -10 };
      expect(() => zigbeePairingSchema.parse(invalid)).toThrow();
    });

    test('should reject timeout over max', () => {
      const invalid = { timeout: 400 };
      expect(() => zigbeePairingSchema.parse(invalid)).toThrow();
    });
  });

  describe('matterCommissioningSchema', () => {
    test('should validate empty commissioning', () => {
      const valid = {};
      expect(() => matterCommissioningSchema.parse(valid)).not.toThrow();
    });

    test('should validate with all fields', () => {
      const valid = {
        setupCode: '12345678',
        discriminator: 1234,
        pinCode: 20202021,
      };
      expect(() => matterCommissioningSchema.parse(valid)).not.toThrow();
    });
  });

  describe('matterCommissionSchema', () => {
    test('should validate with setup code', () => {
      const valid = { setupCode: 'MT:Y.K90IRV01YZ.548G00' };
      expect(() => matterCommissionSchema.parse(valid)).not.toThrow();
    });

    test('should validate with device name', () => {
      const valid = {
        setupCode: 'MT:Y.K90IRV01YZ.548G00',
        deviceName: 'Smart Bulb',
      };
      expect(() => matterCommissionSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty setup code', () => {
      const invalid = { setupCode: '' };
      expect(() => matterCommissionSchema.parse(invalid)).toThrow();
    });
  });
});

describe('Pagination and ID Schemas', () => {
  describe('paginationSchema', () => {
    test('should apply default values', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('should validate custom pagination', () => {
      const valid = { page: 2, limit: 50 };
      const result = paginationSchema.parse(valid);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    test('should validate with sorting', () => {
      const valid = {
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      };
      expect(() => paginationSchema.parse(valid)).not.toThrow();
    });

    test('should reject page 0', () => {
      const invalid = { page: 0 };
      expect(() => paginationSchema.parse(invalid)).toThrow();
    });

    test('should reject limit over 100', () => {
      const invalid = { limit: 150 };
      expect(() => paginationSchema.parse(invalid)).toThrow();
    });

    test('should reject invalid sort order', () => {
      const invalid = { sortOrder: 'ascending' };
      expect(() => paginationSchema.parse(invalid)).toThrow();
    });
  });

  describe('uuidParamSchema', () => {
    test('should validate UUID', () => {
      const valid = { id: '123e4567-e89b-12d3-a456-426614174000' };
      expect(() => uuidParamSchema.parse(valid)).not.toThrow();
    });

    test('should reject invalid UUID', () => {
      const invalid = { id: 'not-a-uuid' };
      expect(() => uuidParamSchema.parse(invalid)).toThrow();
    });

    test('should reject empty string', () => {
      const invalid = { id: '' };
      expect(() => uuidParamSchema.parse(invalid)).toThrow();
    });
  });

  describe('idParamSchema', () => {
    test('should validate any non-empty string', () => {
      const valid = { id: 'some-id-123' };
      expect(() => idParamSchema.parse(valid)).not.toThrow();
    });

    test('should reject empty string', () => {
      const invalid = { id: '' };
      expect(() => idParamSchema.parse(invalid)).toThrow();
    });
  });
});
