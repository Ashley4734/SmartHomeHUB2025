/**
 * Automation Engine with AI Assistance
 * Handles triggers, conditions, and actions for home automation
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { CronJob } from 'cron';
import EventEmitter from 'events';

class AutomationEngine extends EventEmitter {
  constructor(deviceManager, aiService) {
    super();
    this.deviceManager = deviceManager;
    this.aiService = aiService;
    this.automations = new Map();
    this.cronJobs = new Map();
    this.runningAutomations = new Set();

    // Load automations from database
    this.loadAutomations();

    // Listen to device state changes for triggers
    this.deviceManager.on('device:state_changed', this.handleDeviceStateChange.bind(this));
  }

  /**
   * Load automations from database
   */
  loadAutomations() {
    const db = getDatabase();
    const automations = db.prepare('SELECT * FROM automations WHERE enabled = 1').all();

    for (const automation of automations) {
      const parsed = {
        ...automation,
        trigger_config: JSON.parse(automation.trigger_config),
        conditions: automation.conditions ? JSON.parse(automation.conditions) : [],
        actions: JSON.parse(automation.actions),
        ai_metadata: automation.ai_metadata ? JSON.parse(automation.ai_metadata) : null
      };

      this.automations.set(automation.id, parsed);

      // Setup cron jobs for time-based triggers
      if (parsed.trigger_type === 'time') {
        this.setupCronTrigger(parsed);
      }
    }

    console.log(`✓ Loaded ${automations.length} automations`);
  }

  /**
   * Create a new automation
   */
  createAutomation({
    name,
    description = null,
    triggerType,
    triggerConfig,
    conditions = [],
    actions,
    createdBy,
    aiGenerated = false,
    aiMetadata = null
  }) {
    const db = getDatabase();
    const automationId = uuidv4();
    const now = Date.now();

    const automation = {
      id: automationId,
      name,
      description,
      trigger_type: triggerType,
      trigger_config: JSON.stringify(triggerConfig),
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      enabled: 1,
      created_by: createdBy,
      ai_generated: aiGenerated ? 1 : 0,
      ai_metadata: aiMetadata ? JSON.stringify(aiMetadata) : null,
      last_triggered: null,
      trigger_count: 0,
      created_at: now,
      updated_at: now
    };

    db.prepare(`
      INSERT INTO automations (
        id, name, description, trigger_type, trigger_config, conditions,
        actions, enabled, created_by, ai_generated, ai_metadata,
        last_triggered, trigger_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      automation.id, automation.name, automation.description, automation.trigger_type,
      automation.trigger_config, automation.conditions, automation.actions, automation.enabled,
      automation.created_by, automation.ai_generated, automation.ai_metadata,
      automation.last_triggered, automation.trigger_count, automation.created_at, automation.updated_at
    );

    // Add to memory
    const parsed = {
      ...automation,
      trigger_config: triggerConfig,
      conditions,
      actions,
      ai_metadata: aiMetadata
    };
    this.automations.set(automationId, parsed);

    // Setup trigger if needed
    if (triggerType === 'time') {
      this.setupCronTrigger(parsed);
    }

    console.log(`✓ Created automation: ${name}`);
    this.emit('automation:created', parsed);

    return parsed;
  }

  /**
   * Create automation from natural language using AI
   */
  async createFromNaturalLanguage(userPrompt, userId) {
    try {
      // Get context for AI
      const devices = this.deviceManager.listDevices();
      const existingAutomations = Array.from(this.automations.values());

      const context = {
        devices: devices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          capabilities: d.capabilities,
          state: d.state
        })),
        automations: existingAutomations.map(a => ({
          name: a.name,
          description: a.description
        }))
      };

      // Generate automation with AI
      const automationSpec = await this.aiService.generateAutomation(userPrompt, context);

      // Create the automation
      const automation = this.createAutomation({
        name: automationSpec.name,
        description: automationSpec.description,
        triggerType: automationSpec.trigger.type,
        triggerConfig: automationSpec.trigger.config,
        conditions: automationSpec.conditions || [],
        actions: automationSpec.actions,
        createdBy: userId,
        aiGenerated: true,
        aiMetadata: {
          originalPrompt: userPrompt,
          generatedAt: Date.now()
        }
      });

      console.log(`✓ Created AI-generated automation: ${automation.name}`);
      return automation;
    } catch (error) {
      console.error('Failed to create automation from natural language:', error);
      throw error;
    }
  }

  /**
   * Setup cron trigger for time-based automation
   */
  setupCronTrigger(automation) {
    const { id, trigger_config } = automation;

    try {
      // Convert trigger config to cron expression
      let cronExpression;

      if (trigger_config.cron) {
        cronExpression = trigger_config.cron;
      } else if (trigger_config.time) {
        // Parse time (HH:MM format)
        const [hours, minutes] = trigger_config.time.split(':');
        const days = trigger_config.days || '*';
        cronExpression = `${minutes} ${hours} * * ${days}`;
      } else {
        throw new Error('Invalid time trigger configuration');
      }

      // Create cron job
      const job = new CronJob(
        cronExpression,
        () => this.triggerAutomation(id, { type: 'time', timestamp: Date.now() }),
        null,
        true,
        trigger_config.timezone || 'America/New_York'
      );

      this.cronJobs.set(id, job);
      console.log(`✓ Setup cron trigger for automation: ${automation.name}`);
    } catch (error) {
      console.error(`Failed to setup cron trigger for ${automation.name}:`, error);
    }
  }

  /**
   * Handle device state changes for state-based triggers
   */
  handleDeviceStateChange(event) {
    const { deviceId, newState, oldState } = event;

    // Check all automations for matching state triggers
    for (const automation of this.automations.values()) {
      if (automation.trigger_type === 'state' && automation.trigger_config.deviceId === deviceId) {
        // Check if state change matches trigger
        if (this.matchesStateTrigger(automation.trigger_config, oldState, newState)) {
          this.triggerAutomation(automation.id, {
            type: 'state',
            deviceId,
            oldState,
            newState,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Check if state change matches trigger configuration
   */
  matchesStateTrigger(triggerConfig, oldState, newState) {
    const { property, operator, value } = triggerConfig;

    const newValue = newState[property];
    const oldValue = oldState[property];

    switch (operator) {
      case 'equals':
        return newValue === value;
      case 'changes_to':
        return newValue === value && oldValue !== value;
      case 'changes_from':
        return oldValue === value && newValue !== value;
      case 'greater_than':
        return newValue > value;
      case 'less_than':
        return newValue < value;
      case 'changes':
        return newValue !== oldValue;
      default:
        return false;
    }
  }

  /**
   * Trigger an automation
   */
  async triggerAutomation(automationId, triggerData = {}) {
    const automation = this.automations.get(automationId);
    if (!automation || !automation.enabled) return;

    // Prevent re-triggering if already running
    if (this.runningAutomations.has(automationId)) {
      console.log(`Automation ${automation.name} is already running, skipping...`);
      return;
    }

    this.runningAutomations.add(automationId);

    try {
      console.log(`⚡ Triggering automation: ${automation.name}`);

      // Check conditions
      if (!await this.evaluateConditions(automation.conditions)) {
        console.log(`Automation ${automation.name} conditions not met, skipping...`);
        this.runningAutomations.delete(automationId);
        return;
      }

      // Execute actions
      const results = await this.executeActions(automation.actions);

      // Update automation stats
      const db = getDatabase();
      db.prepare(`
        UPDATE automations
        SET last_triggered = ?, trigger_count = trigger_count + 1
        WHERE id = ?
      `).run(Date.now(), automationId);

      // Log execution
      this.logAutomationExecution(automationId, 'success', triggerData, results);

      console.log(`✓ Automation ${automation.name} executed successfully`);
      this.emit('automation:triggered', { automation, triggerData, results });
    } catch (error) {
      console.error(`Automation ${automation.name} failed:`, error);
      this.logAutomationExecution(automationId, 'error', triggerData, null, error.message);
      this.emit('automation:error', { automation, error });
    } finally {
      this.runningAutomations.delete(automationId);
    }
  }

  /**
   * Evaluate automation conditions
   */
  async evaluateConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) return false;
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition) {
    switch (condition.type) {
      case 'device_state':
        return this.evaluateDeviceStateCondition(condition);

      case 'time_range':
        return this.evaluateTimeRangeCondition(condition);

      case 'day_of_week':
        return this.evaluateDayOfWeekCondition(condition);

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return true;
    }
  }

  /**
   * Evaluate device state condition
   */
  evaluateDeviceStateCondition(condition) {
    const device = this.deviceManager.getDevice(condition.deviceId);
    if (!device) return false;

    const value = device.state[condition.property];
    const { operator, value: expectedValue } = condition;

    switch (operator) {
      case 'equals':
        return value === expectedValue;
      case 'not_equals':
        return value !== expectedValue;
      case 'greater_than':
        return value > expectedValue;
      case 'less_than':
        return value < expectedValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate time range condition
   */
  evaluateTimeRangeCondition(condition) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = condition.start.split(':').map(Number);
    const [endHour, endMin] = condition.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Evaluate day of week condition
   */
  evaluateDayOfWeekCondition(condition) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    return condition.days.includes(dayOfWeek);
  }

  /**
   * Execute automation actions
   */
  async executeActions(actions) {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action);
        results.push({ action, result, success: true });
      } catch (error) {
        console.error(`Action failed:`, error);
        results.push({ action, error: error.message, success: false });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  async executeAction(action) {
    switch (action.type) {
      case 'device_control':
        return await this.deviceManager.controlDevice(
          action.deviceId,
          action.command,
          action.parameters || {}
        );

      case 'delay':
        await new Promise(resolve => setTimeout(resolve, action.duration));
        return { delayed: action.duration };

      case 'notification':
        this.emit('notification', action);
        return { sent: true };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Log automation execution
   */
  logAutomationExecution(automationId, status, triggerData, actionsExecuted, error = null) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO automation_logs (automation_id, status, trigger_data, actions_executed, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      automationId,
      status,
      JSON.stringify(triggerData),
      JSON.stringify(actionsExecuted),
      error,
      Date.now()
    );
  }

  /**
   * Update automation
   */
  updateAutomation(automationId, updates) {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }

    const db = getDatabase();
    const fields = [];
    const values = [];

    const allowedFields = ['name', 'description', 'enabled'];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.triggerConfig) {
      fields.push('trigger_config = ?');
      values.push(JSON.stringify(updates.triggerConfig));
    }

    if (updates.conditions) {
      fields.push('conditions = ?');
      values.push(JSON.stringify(updates.conditions));
    }

    if (updates.actions) {
      fields.push('actions = ?');
      values.push(JSON.stringify(updates.actions));
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(automationId);

    db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Reload automation
    this.loadAutomations();

    console.log(`✓ Updated automation: ${automation.name}`);
    return this.automations.get(automationId);
  }

  /**
   * Delete automation
   */
  deleteAutomation(automationId) {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }

    // Stop cron job if exists
    if (this.cronJobs.has(automationId)) {
      this.cronJobs.get(automationId).stop();
      this.cronJobs.delete(automationId);
    }

    // Delete from database
    const db = getDatabase();
    db.prepare('DELETE FROM automations WHERE id = ?').run(automationId);

    // Remove from memory
    this.automations.delete(automationId);

    console.log(`✓ Deleted automation: ${automation.name}`);
    this.emit('automation:deleted', automation);
  }

  /**
   * List all automations
   */
  listAutomations(filter = {}) {
    let automations = Array.from(this.automations.values());

    if (filter.enabled !== undefined) {
      automations = automations.filter(a => a.enabled === filter.enabled);
    }

    if (filter.createdBy) {
      automations = automations.filter(a => a.created_by === filter.createdBy);
    }

    return automations;
  }

  /**
   * Get automation logs
   */
  getAutomationLogs(automationId, limit = 50) {
    const db = getDatabase();
    const logs = db.prepare(`
      SELECT * FROM automation_logs
      WHERE automation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(automationId, limit);

    return logs.map(log => ({
      ...log,
      trigger_data: JSON.parse(log.trigger_data || '{}'),
      actions_executed: JSON.parse(log.actions_executed || '[]')
    }));
  }
}

export default AutomationEngine;
