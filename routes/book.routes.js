/**
 * Book Routes
 */

const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');
const upload = require('../middleware/upload.middleware');

router.get('/', (req, res, next) => bookController.listBooks(req, res, next));
router.post('/upload', upload.single('pdf'), (req, res, next) => bookController.uploadBook(req, res, next));
router.get('/:id', (req, res, next) => bookController.getBookDetails(req, res, next));
router.get('/:id/pdf', (req, res, next) => bookController.servePdf(req, res, next));
router.post('/:id/progress', (req, res, next) => bookController.updateProgress(req, res, next));
router.delete('/:id', (req, res, next) => bookController.deleteBook(req, res, next));
router.post('/:id/ocr', (req, res, next) => bookController.runOcr(req, res, next));

module.exports = router;
