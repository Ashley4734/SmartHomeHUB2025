/**
 * Tests for Automation Engine
 */

import { jest } from '@jest/globals';

// Mock database module
const mockDbPrepare = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn().mockReturnValue([])
};

const mockDb = {
  prepare: jest.fn().mockReturnValue(mockDbPrepare)
};

const mockGetDatabase = jest.fn(() => mockDb);

jest.unstable_mockModule('../../database/db.js', () => ({
  getDatabase: mockGetDatabase,
  initDatabase: jest.fn(),
  closeDatabase: jest.fn(),
}));

// Mock cron
jest.unstable_mockModule('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

const { default: AutomationEngine } = await import('../automationEngine.js');

describe('AutomationEngine', () => {
  let automationEngine;
  let mockDeviceManager;
  let mockAiService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockDbPrepare.run.mockClear();
    mockDbPrepare.get.mockClear();
    mockDbPrepare.all.mockClear().mockReturnValue([]);
    mockDb.prepare.mockClear().mockReturnValue(mockDbPrepare);
    mockGetDatabase.mockClear().mockReturnValue(mockDb);

    // Mock device manager
    mockDeviceManager = {
      on: jest.fn(),
      listDevices: jest.fn().mockReturnValue([]),
      getDevice: jest.fn(),
      controlDevice: jest.fn().mockResolvedValue({ success: true })
    };

    // Mock AI service
    mockAiService = {
      generateAutomation: jest.fn()
    };

    // Create automation engine
    automationEngine = new AutomationEngine(mockDeviceManager, mockAiService);
  });

  afterEach(() => {
    // Clean up event listeners
    if (automationEngine) {
      automationEngine.removeAllListeners();
    }
  });

  describe('constructor', () => {
    it('should initialize with device manager and AI service', () => {
      expect(automationEngine.deviceManager).toBe(mockDeviceManager);
      expect(automationEngine.aiService).toBe(mockAiService);
      expect(automationEngine.automations).toBeInstanceOf(Map);
      expect(automationEngine.cronJobs).toBeInstanceOf(Map);
      expect(automationEngine.runningAutomations).toBeInstanceOf(Set);
    });

    it('should listen to device state changes', () => {
      expect(mockDeviceManager.on).toHaveBeenCalledWith(
        'device:state_changed',
        expect.any(Function)
      );
    });

    it('should load automations on initialization', () => {
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM automations WHERE enabled = 1'
      );
    });
  });

  describe('createAutomation', () => {
    it('should create a new automation', () => {
      const automationData = {
        name: 'Test Automation',
        description: 'Test description',
        triggerType: 'state',
        triggerConfig: { deviceId: 'device-1', property: 'on', operator: 'equals', value: true },
        conditions: [],
        actions: [{ type: 'device_control', deviceId: 'device-2', command: 'turn_on' }],
        createdBy: 'user-1'
      };

      const automation = automationEngine.createAutomation(automationData);

      expect(automation).toHaveProperty('id');
      expect(automation.name).toBe('Test Automation');
      expect(automation.trigger_type).toBe('state');
      expect(mockDbPrepare.run).toHaveBeenCalled();
      expect(automationEngine.automations.has(automation.id)).toBe(true);
    });

    it('should create AI-generated automation', () => {
      const automationData = {
        name: 'AI Automation',
        triggerType: 'time',
        triggerConfig: { time: '18:00' },
        actions: [{ type: 'device_control', deviceId: 'device-1', command: 'turn_on' }],
        createdBy: 'user-1',
        aiGenerated: true,
        aiMetadata: { originalPrompt: 'Turn on lights at 6 PM' }
      };

      const automation = automationEngine.createAutomation(automationData);

      expect(automation.ai_generated).toBe(1);
      expect(automation.ai_metadata).toEqual({ originalPrompt: 'Turn on lights at 6 PM' });
    });

    it('should emit automation:created event', (done) => {
      automationEngine.on('automation:created', (automation) => {
        expect(automation.name).toBe('Event Test');
        done();
      });

      automationEngine.createAutomation({
        name: 'Event Test',
        triggerType: 'state',
        triggerConfig: { deviceId: 'device-1' },
        actions: [],
        createdBy: 'user-1'
      });
    });
  });

  describe('createFromNaturalLanguage', () => {
    it('should create automation from natural language', async () => {
      mockDeviceManager.listDevices.mockReturnValue([
        { id: 'device-1', name: 'Living Room Light', type: 'light', capabilities: ['on_off'], state: { on: false } }
      ]);

      mockAiService.generateAutomation.mockResolvedValue({
        name: 'Evening Lights',
        description: 'Turn on lights in the evening',
        trigger: { type: 'time', config: { time: '18:00' } },
        conditions: [],
        actions: [{ type: 'device_control', deviceId: 'device-1', command: 'turn_on' }]
      });

      const automation = await automationEngine.createFromNaturalLanguage(
        'Turn on living room lights at 6 PM',
        'user-1'
      );

      expect(automation.name).toBe('Evening Lights');
      expect(automation.ai_generated).toBe(1);
      expect(mockAiService.generateAutomation).toHaveBeenCalled();
    });

    it('should throw error when AI generation fails', async () => {
      mockAiService.generateAutomation.mockRejectedValue(new Error('AI service unavailable'));

      await expect(
        automationEngine.createFromNaturalLanguage('Invalid prompt', 'user-1')
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('matchesStateTrigger', () => {
    it('should match equals operator', () => {
      const triggerConfig = { property: 'temperature', operator: 'equals', value: 22 };
      const oldState = { temperature: 20 };
      const newState = { temperature: 22 };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should match changes_to operator', () => {
      const triggerConfig = { property: 'on', operator: 'changes_to', value: true };
      const oldState = { on: false };
      const newState = { on: true };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should not match changes_to when value was already set', () => {
      const triggerConfig = { property: 'on', operator: 'changes_to', value: true };
      const oldState = { on: true };
      const newState = { on: true };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(false);
    });

    it('should match changes_from operator', () => {
      const triggerConfig = { property: 'on', operator: 'changes_from', value: true };
      const oldState = { on: true };
      const newState = { on: false };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should match greater_than operator', () => {
      const triggerConfig = { property: 'temperature', operator: 'greater_than', value: 25 };
      const oldState = { temperature: 20 };
      const newState = { temperature: 26 };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should match less_than operator', () => {
      const triggerConfig = { property: 'temperature', operator: 'less_than', value: 20 };
      const oldState = { temperature: 25 };
      const newState = { temperature: 18 };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should match changes operator', () => {
      const triggerConfig = { property: 'brightness', operator: 'changes' };
      const oldState = { brightness: 50 };
      const newState = { brightness: 75 };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(true);
    });

    it('should not match changes operator when value stays same', () => {
      const triggerConfig = { property: 'brightness', operator: 'changes' };
      const oldState = { brightness: 50 };
      const newState = { brightness: 50 };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(false);
    });

    it('should return false for unknown operator', () => {
      const triggerConfig = { property: 'on', operator: 'unknown_op', value: true };
      const oldState = { on: false };
      const newState = { on: true };

      const result = automationEngine.matchesStateTrigger(triggerConfig, oldState, newState);
      expect(result).toBe(false);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate device_state condition', async () => {
      mockDeviceManager.getDevice.mockReturnValue({
        id: 'device-1',
        state: { temperature: 25 }
      });

      const condition = {
        type: 'device_state',
        deviceId: 'device-1',
        property: 'temperature',
        operator: 'greater_than',
        value: 20
      };

      const result = await automationEngine.evaluateCondition(condition);
      expect(result).toBe(true);
    });

    it('should evaluate time_range condition', async () => {
      // Mock current time to 14:30 (2:30 PM)
      const mockDate = new Date('2024-01-01T14:30:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const condition = {
        type: 'time_range',
        start: '14:00',
        end: '16:00'
      };

      const result = await automationEngine.evaluateCondition(condition);
      expect(result).toBe(true);

      global.Date.mockRestore();
    });

    it('should evaluate day_of_week condition', async () => {
      // Mock Monday (day 1)
      const mockDate = new Date('2024-01-01T12:00:00'); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const condition = {
        type: 'day_of_week',
        days: [1, 2, 3, 4, 5] // Weekdays
      };

      const result = await automationEngine.evaluateCondition(condition);
      expect(result).toBe(true);

      global.Date.mockRestore();
    });

    it('should return true for unknown condition type', async () => {
      const condition = { type: 'unknown_type' };
      const result = await automationEngine.evaluateCondition(condition);
      expect(result).toBe(true);
    });
  });

  describe('executeAction', () => {
    it('should execute device_control action', async () => {
      const action = {
        type: 'device_control',
        deviceId: 'device-1',
        command: 'turn_on',
        parameters: { brightness: 100 }
      };

      const result = await automationEngine.executeAction(action);

      expect(mockDeviceManager.controlDevice).toHaveBeenCalledWith(
        'device-1',
        'turn_on',
        { brightness: 100 }
      );
      expect(result).toEqual({ success: true });
    });

    it('should execute delay action', async () => {
      const action = { type: 'delay', duration: 100 };

      const startTime = Date.now();
      const result = await automationEngine.executeAction(action);
      const endTime = Date.now();

      expect(result).toEqual({ delayed: 100 });
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should execute notification action', async () => {
      const action = { type: 'notification', message: 'Test notification' };

      const emitSpy = jest.spyOn(automationEngine, 'emit');
      const result = await automationEngine.executeAction(action);

      expect(emitSpy).toHaveBeenCalledWith('notification', action);
      expect(result).toEqual({ sent: true });
    });

    it('should throw error for unknown action type', async () => {
      const action = { type: 'unknown_action' };

      await expect(automationEngine.executeAction(action)).rejects.toThrow(
        'Unknown action type: unknown_action'
      );
    });
  });

  describe('triggerAutomation', () => {
    beforeEach(() => {
      const automation = {
        id: 'auto-1',
        name: 'Test Automation',
        enabled: 1,
        trigger_type: 'state',
        trigger_config: {},
        conditions: [],
        actions: [{ type: 'device_control', deviceId: 'device-1', command: 'turn_on' }]
      };
      automationEngine.automations.set('auto-1', automation);
    });

    it('should trigger automation successfully', async () => {
      await automationEngine.triggerAutomation('auto-1');

      expect(mockDeviceManager.controlDevice).toHaveBeenCalled();
      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should not trigger disabled automation', async () => {
      const automation = automationEngine.automations.get('auto-1');
      automation.enabled = 0;

      await automationEngine.triggerAutomation('auto-1');

      expect(mockDeviceManager.controlDevice).not.toHaveBeenCalled();
    });

    it('should not trigger non-existent automation', async () => {
      await automationEngine.triggerAutomation('non-existent');

      expect(mockDeviceManager.controlDevice).not.toHaveBeenCalled();
    });

    it('should not re-trigger already running automation', async () => {
      automationEngine.runningAutomations.add('auto-1');

      await automationEngine.triggerAutomation('auto-1');

      expect(mockDeviceManager.controlDevice).not.toHaveBeenCalled();
    });

    it('should emit automation:triggered event on success', (done) => {
      automationEngine.on('automation:triggered', ({ automation, results }) => {
        expect(automation.id).toBe('auto-1');
        expect(results).toHaveLength(1);
        done();
      });

      automationEngine.triggerAutomation('auto-1');
    });

    it('should handle action failures gracefully', (done) => {
      mockDeviceManager.controlDevice.mockRejectedValue(new Error('Device error'));

      automationEngine.on('automation:triggered', ({ automation, results }) => {
        expect(automation.id).toBe('auto-1');
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].error).toContain('Device error');
        done();
      });

      automationEngine.triggerAutomation('auto-1');
    });
  });

  describe('updateAutomation', () => {
    beforeEach(() => {
      const automation = {
        id: 'auto-1',
        name: 'Test Automation',
        enabled: 1,
        trigger_type: 'state',
        trigger_config: {},
        conditions: [],
        actions: []
      };
      automationEngine.automations.set('auto-1', automation);

      // Mock database row with stringified JSON fields
      const dbRow = {
        id: 'auto-1',
        name: 'Test Automation',
        enabled: 1,
        trigger_type: 'state',
        trigger_config: '{}',
        conditions: '[]',
        actions: '[]',
        ai_metadata: null
      };
      mockDbPrepare.all.mockReturnValue([dbRow]);
    });

    it('should update automation name', () => {
      automationEngine.updateAutomation('auto-1', { name: 'Updated Name' });

      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should update automation enabled status', () => {
      automationEngine.updateAutomation('auto-1', { enabled: 0 });

      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should throw error for non-existent automation', () => {
      expect(() => {
        automationEngine.updateAutomation('non-existent', { name: 'Test' });
      }).toThrow('Automation not found');
    });
  });

  describe('deleteAutomation', () => {
    beforeEach(() => {
      const automation = {
        id: 'auto-1',
        name: 'Test Automation',
        enabled: 1,
        trigger_type: 'state',
        trigger_config: {},
        conditions: [],
        actions: []
      };
      automationEngine.automations.set('auto-1', automation);
    });

    it('should delete automation', () => {
      automationEngine.deleteAutomation('auto-1');

      expect(mockDbPrepare.run).toHaveBeenCalled();
      expect(automationEngine.automations.has('auto-1')).toBe(false);
    });

    it('should emit automation:deleted event', (done) => {
      automationEngine.on('automation:deleted', (automation) => {
        expect(automation.id).toBe('auto-1');
        done();
      });

      automationEngine.deleteAutomation('auto-1');
    });

    it('should throw error for non-existent automation', () => {
      expect(() => {
        automationEngine.deleteAutomation('non-existent');
      }).toThrow('Automation not found');
    });
  });

  describe('listAutomations', () => {
    beforeEach(() => {
      automationEngine.automations.set('auto-1', { id: 'auto-1', enabled: 1, created_by: 'user-1' });
      automationEngine.automations.set('auto-2', { id: 'auto-2', enabled: 0, created_by: 'user-1' });
      automationEngine.automations.set('auto-3', { id: 'auto-3', enabled: 1, created_by: 'user-2' });
    });

    it('should list all automations', () => {
      const result = automationEngine.listAutomations();
      expect(result).toHaveLength(3);
    });

    it('should filter by enabled status', () => {
      const result = automationEngine.listAutomations({ enabled: 1 });
      expect(result).toHaveLength(2);
    });

    it('should filter by creator', () => {
      const result = automationEngine.listAutomations({ createdBy: 'user-1' });
      expect(result).toHaveLength(2);
    });

    it('should apply multiple filters', () => {
      const result = automationEngine.listAutomations({ enabled: 1, createdBy: 'user-2' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auto-3');
    });
  });

  describe('getAutomationLogs', () => {
    it('should retrieve automation logs', () => {
      const mockLogs = [
        {
          id: 1,
          automation_id: 'auto-1',
          status: 'success',
          trigger_data: '{"type":"state"}',
          actions_executed: '[{"action":"turn_on"}]',
          timestamp: Date.now()
        }
      ];
      mockDbPrepare.all.mockReturnValue(mockLogs);

      const logs = automationEngine.getAutomationLogs('auto-1', 10);

      expect(logs).toHaveLength(1);
      expect(logs[0].trigger_data).toEqual({ type: 'state' });
      expect(logs[0].actions_executed).toEqual([{ action: 'turn_on' }]);
    });

    it('should limit number of logs returned', () => {
      automationEngine.getAutomationLogs('auto-1', 50);

      expect(mockDbPrepare.all).toHaveBeenCalledWith('auto-1', 50);
    });
  });

  describe('handleDeviceStateChange', () => {
    beforeEach(() => {
      const automation = {
        id: 'auto-1',
        name: 'Test Automation',
        enabled: 1,
        trigger_type: 'state',
        trigger_config: {
          deviceId: 'device-1',
          property: 'on',
          operator: 'equals',
          value: true
        },
        conditions: [],
        actions: [{ type: 'device_control', deviceId: 'device-2', command: 'turn_on' }]
      };
      automationEngine.automations.set('auto-1', automation);
    });

    it('should trigger automation on matching state change', async () => {
      const event = {
        deviceId: 'device-1',
        oldState: { on: false },
        newState: { on: true }
      };

      automationEngine.handleDeviceStateChange(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDeviceManager.controlDevice).toHaveBeenCalled();
    });

    it('should not trigger automation on non-matching state change', async () => {
      const event = {
        deviceId: 'device-1',
        oldState: { on: true },
        newState: { on: false }
      };

      automationEngine.handleDeviceStateChange(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDeviceManager.controlDevice).not.toHaveBeenCalled();
    });
  });
});
