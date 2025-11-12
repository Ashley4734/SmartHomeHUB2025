/**
 * AI Service Abstraction Layer
 * Supports multiple AI providers: Ollama, OpenAI, Claude (Anthropic), Gemini (Google)
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';

class AIService {
  constructor() {
    this.providers = {
      ollama: new OllamaProvider(),
      openai: new OpenAIProvider(),
      claude: new ClaudeProvider(),
      gemini: new GeminiProvider()
    };

    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'ollama';
  }

  /**
   * Send a message to AI and get response
   */
  async chat(messages, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const aiProvider = this.providers[provider];

    if (!aiProvider) {
      throw new Error(`Unknown AI provider: ${provider}`);
    }

    if (!aiProvider.isEnabled()) {
      throw new Error(`AI provider ${provider} is not enabled. Check your .env configuration.`);
    }

    try {
      const response = await aiProvider.chat(messages, options);
      return {
        provider,
        response: response.content,
        usage: response.usage || null,
        model: response.model || null
      };
    } catch (error) {
      console.error(`AI provider ${provider} error:`, error.message);
      throw error;
    }
  }

  /**
   * Generate automation from natural language
   */
  async generateAutomation(userPrompt, context = {}) {
    const systemPrompt = `You are a smart home automation expert. Generate automation rules based on user requests.

Context:
- Available devices: ${JSON.stringify(context.devices || [])}
- Existing automations: ${JSON.stringify(context.automations || [])}

Return a JSON object with this structure:
{
  "name": "automation name",
  "description": "what it does",
  "trigger": { "type": "time|state|event", "config": {} },
  "conditions": [],
  "actions": [{ "deviceId": "id", "command": "on|off|set", "parameters": {} }]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.chat(messages, { temperature: 0.7 });

    try {
      // Extract JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('Failed to parse automation:', error);
      throw new Error('AI failed to generate valid automation');
    }
  }

  /**
   * Analyze device patterns and suggest optimizations
   */
  async analyzePatterns(patterns, context = {}) {
    const systemPrompt = `You are a smart home optimization expert. Analyze user patterns and suggest automations or optimizations.

Patterns detected:
${JSON.stringify(patterns, null, 2)}

Context:
${JSON.stringify(context, null, 2)}

Provide actionable suggestions for automations that would improve the user's experience.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'What automations would you suggest based on these patterns?' }
    ];

    const response = await this.chat(messages, { temperature: 0.8 });
    return response.response;
  }

  /**
   * Process voice command with AI
   */
  async processVoiceCommand(command, context = {}) {
    const systemPrompt = `You are a smart home voice assistant. Parse voice commands and return structured actions.

Available devices: ${JSON.stringify(context.devices || [])}

Return JSON with this structure:
{
  "intent": "control|query|automation|other",
  "entities": { "device": "name", "action": "on|off|set", "value": null },
  "response": "natural language response to user"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: command }
    ];

    const response = await this.chat(messages, { temperature: 0.5 });

    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('Failed to parse voice command:', error);
      return {
        intent: 'unknown',
        entities: {},
        response: "I'm sorry, I didn't understand that command."
      };
    }
  }

  /**
   * Save conversation to database
   */
  saveConversation(userId, provider, messages, context = {}, intent = null) {
    const db = getDatabase();
    const conversationId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO ai_conversations (id, user_id, provider, messages, context, intent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      conversationId,
      userId,
      provider,
      JSON.stringify(messages),
      JSON.stringify(context),
      intent,
      now,
      now
    );

    return conversationId;
  }

  /**
   * Create AI suggestion
   */
  createSuggestion(userId, type, title, description, suggestionData) {
    const db = getDatabase();
    const suggestionId = uuidv4();

    db.prepare(`
      INSERT INTO ai_suggestions (id, user_id, type, title, description, suggestion_data, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      suggestionId,
      userId,
      type,
      title,
      description,
      JSON.stringify(suggestionData),
      Date.now()
    );

    return suggestionId;
  }
}

/**
 * Ollama Provider (Local AI)
 */
class OllamaProvider {
  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2:7b';
  }

  isEnabled() {
    return process.env.OLLAMA_ENABLED === 'true';
  }

  async chat(messages, options = {}) {
    const response = await axios.post(`${this.baseUrl}/api/chat`, {
      model: options.model || this.model,
      messages: messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9
      }
    });

    return {
      content: response.data.message.content,
      model: this.model,
      usage: null
    };
  }
}

/**
 * OpenAI Provider
 */
class OpenAIProvider {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = 'gpt-4-turbo-preview';
  }

  isEnabled() {
    return process.env.OPENAI_ENABLED === 'true' && this.apiKey;
  }

  async chat(messages, options = {}) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: options.model || this.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.choices[0].message.content,
      model: response.data.model,
      usage: response.data.usage
    };
  }
}

/**
 * Claude Provider (Anthropic)
 */
class ClaudeProvider {
  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  }

  isEnabled() {
    return process.env.CLAUDE_ENABLED === 'true' && this.apiKey;
  }

  async chat(messages, options = {}) {
    // Convert messages format for Claude
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: options.model || this.model,
        max_tokens: options.max_tokens || 1024,
        system: systemMessage?.content || '',
        messages: userMessages,
        temperature: options.temperature || 0.7
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.content[0].text,
      model: response.data.model,
      usage: response.data.usage
    };
  }
}

/**
 * Gemini Provider (Google)
 */
class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-pro';
  }

  isEnabled() {
    return process.env.GEMINI_ENABLED === 'true' && this.apiKey;
  }

  async chat(messages, options = {}) {
    // Convert messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        contents: contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.max_tokens || 1000
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.candidates[0].content.parts[0].text,
      model: this.model,
      usage: response.data.usageMetadata || null
    };
  }
}

export default AIService;
