/**
 * AI Configuration Module
 * Manages runtime and environment AI provider configurations securely.
 */

require('dotenv').config();

class AIConfig {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gemini-flash-lite-latest';
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.2');
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || '8192', 10);
    this.timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '60000', 10);
    this.maxContextChars = parseInt(process.env.AI_MAX_CONTEXT_CHARS || '36000', 10);
    this.defaultLanguage = process.env.AI_DEFAULT_LANGUAGE || 'km'; // 'km' (Khmer), 'en' (English), 'auto'
    this.storagePath = require('path').join(__dirname, '..', 'storage', 'settings.json');
    this.loadPersistedConfig();
  }

  loadPersistedConfig() {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const saved = JSON.parse(raw);
        if (saved.apiKey && typeof saved.apiKey === 'string' && saved.apiKey.trim().length > 5 && saved.apiKey !== 'your_google_gemini_api_key_here') {
          this.apiKey = saved.apiKey;
        }
        if (saved.model && typeof saved.model === 'string') this.model = saved.model;
        if (saved.temperature !== undefined) this.temperature = parseFloat(saved.temperature);
        if (saved.defaultLanguage) this.defaultLanguage = saved.defaultLanguage;
      }
      // If persisted key was empty or placeholder, fall back to environment variable
      if (!this.apiKey || this.apiKey === 'your_google_gemini_api_key_here') {
        this.apiKey = process.env.GEMINI_API_KEY || '';
      }
    } catch (e) {
      console.warn('[AIConfig] Could not load persisted settings:', e.message);
    }
  }

  savePersistedConfig() {
    try {
      const fs = require('fs');
      const data = {
        apiKey: this.apiKey,
        model: this.model,
        temperature: this.temperature,
        defaultLanguage: this.defaultLanguage
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[AIConfig] Could not save settings to disk:', e.message);
    }
  }

  /**
   * Return configuration safe for frontend consumption (API key is strictly masked)
   */
  getPublicConfig() {
    return {
      provider: this.provider,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      maxContextChars: this.maxContextChars,
      defaultLanguage: this.defaultLanguage,
      hasApiKey: Boolean(this.apiKey && this.apiKey.trim().length > 5 && this.apiKey !== 'your_api_key_here' && this.apiKey !== 'your_google_gemini_api_key_here'),
      maskedApiKey: this.getMaskedKey(),
      availableModels: [
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (ស្ថិរភាព & ឆ្លើយតបរហ័ស - ណែនាំ)', recommended: true },
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (ល្បឿនលឿន)' },
        { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (ជំនាន់ចុងក្រោយ)' },
        { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' }
      ],
      availableLanguages: [
        { id: 'km', name: 'ភាសាខ្មែរ (Khmer)' },
        { id: 'en', name: 'English' },
        { id: 'auto', name: 'តាមភាសាសៀវភៅ (Same as Book)' }
      ]
    };
  }

  getMaskedKey() {
    if (!this.apiKey || this.apiKey.length < 8) return '';
    const prefix = this.apiKey.substring(0, 4);
    const suffix = this.apiKey.substring(this.apiKey.length - 4);
    return `${prefix}••••••••${suffix}`;
  }

  /**
   * Update configuration dynamically from user settings
   */
  updateConfig(updates = {}, persist = true) {
    if (typeof updates.apiKey === 'string') {
      const trimmed = updates.apiKey.trim();
      if (trimmed.length > 0) {
        this.apiKey = trimmed;
      } else if (updates.apiKey === '') {
        this.apiKey = '';
      }
    }

    if (updates.model && typeof updates.model === 'string') {
      this.model = updates.model;
    }

    if (updates.defaultLanguage && typeof updates.defaultLanguage === 'string') {
      this.defaultLanguage = updates.defaultLanguage;
    }

    if (updates.temperature !== undefined) {
      this.temperature = Math.max(0, Math.min(1, parseFloat(updates.temperature) || 0.2));
    }

    if (persist) {
      this.savePersistedConfig();
    }

    return this.getPublicConfig();
  }

  isKeyConfigured() {
    return Boolean(
      this.apiKey &&
      this.apiKey.trim().length > 5 &&
      this.apiKey !== 'your_api_key_here' &&
      this.apiKey !== 'your_google_gemini_api_key_here'
    );
  }
}

const aiConfig = new AIConfig();
module.exports = aiConfig;
