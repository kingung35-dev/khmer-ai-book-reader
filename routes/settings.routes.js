/**
 * Settings Routes
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');

router.get('/', (req, res, next) => settingsController.getSettings(req, res, next));
router.post('/', (req, res, next) => settingsController.updateSettings(req, res, next));
router.post('/test', (req, res, next) => settingsController.testConnection(req, res, next));

module.exports = router;
