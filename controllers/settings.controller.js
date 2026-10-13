/**
 * Settings Controller
 * Handles user settings, API key configuration, and connection testing.
 */

const aiConfig = require('../config/ai.config');
const aiService = require('../services/ai.service');

class SettingsController {
  /**
   * Get current settings safely
   */
  async getSettings(req, res, next) {
    try {
      res.json({
        success: true,
        settings: aiConfig.getPublicConfig()
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update configuration
   */
  async updateSettings(req, res, next) {
    try {
      const { apiKey, model, defaultLanguage, temperature } = req.body;

      const updated = aiConfig.updateConfig({
        apiKey,
        model,
        defaultLanguage,
        temperature
      });

      res.json({
        success: true,
        message: 'បានរក្សាទុកការកំណត់ដោយជោគជ័យ (Settings updated)',
        settings: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Test API key connectivity
   */
  async testConnection(req, res, next) {
    try {
      const { apiKey, model } = req.body;
      const result = await aiService.testApiKey(apiKey, model);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

const settingsController = new SettingsController();
module.exports = settingsController;
