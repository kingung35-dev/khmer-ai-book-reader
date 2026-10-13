/**
 * AI Routes
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

router.post('/ask', (req, res, next) => aiController.askQuestion(req, res, next));
router.post('/action', (req, res, next) => aiController.executeAction(req, res, next));
router.get('/status', (req, res, next) => aiController.getStatus(req, res, next));

module.exports = router;
