/**
 * AI Controller
 * Handles incoming AI queries, document Q&A, and quick reading actions.
 */

const aiService = require('../services/ai.service');
const pdfService = require('../services/pdf.service');
const aiConfig = require('../config/ai.config');
const retrievalService = require('../services/retrieval.service');
const ocrService = require('../services/ocr.service');
const fs = require('fs');
const path = require('path');

const BOOKS_DIR = path.join(__dirname, '..', 'storage', 'books');

function findBookFilePath(bookId) {
  if (!fs.existsSync(BOOKS_DIR)) return null;
  const files = fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (bookId === 'sample-khmer' && files.includes('sample-khmer.pdf')) {
    return path.join(BOOKS_DIR, 'sample-khmer.pdf');
  }
  const exact = files.find(f => f === `${bookId}.pdf` || f === bookId);
  if (exact) return path.join(BOOKS_DIR, exact);
  const prefixed = files.find(f => f.startsWith(`${bookId}_`));
  return prefixed ? path.join(BOOKS_DIR, prefixed) : null;
}

function textNeedsOcr(text) {
  if (!text || text.trim().length < 20) return true;
  const hasKhmer = /[\u1780-\u17FF]/.test(text);
  const isPureEnglish = /^[a-zA-Z0-9\s.,!?'"()\-:;—\n\r]+$/.test(text);
  const hasCorruptedGlyphs = /[\u0250-\u02AF\u1D00-\u1DBF\u0180-\u024F\u0080-\u00FF]/.test(text);
  return (!hasKhmer && !isPureEnglish) || hasCorruptedGlyphs;
}

class AIController {
  /**
   * Ask a question about the book or a specific page
   */
  async askQuestion(req, res, next) {
    try {
      const { bookId, question, currentPage, scope = 'book', language } = req.body;

      if (!question || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'សូមបញ្ចូលសំណួររបស់អ្នក (Please enter your question)'
        });
      }

      if (!bookId) {
        return res.status(400).json({
          success: false,
          error: 'សូមជ្រើសរើសសៀវភៅជាមុនសិន (Please select a book first)'
        });
      }

      // Fetch metadata & chunks for this book
      const metadata = pdfService.getMetadata(bookId);
      if (!metadata || !metadata.chunks || metadata.chunks.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'មិនទាន់មានទិន្នន័យអត្ថបទសម្រាប់សៀវភៅនេះនៅឡើយទេ'
        });
      }

      // Check if user specifically requested a page, or asks for current page
      const requestedPage = retrievalService.extractMentionedPage(question) || (scope === 'page' ? currentPage : null);
      if (requestedPage) {
        const pageNum = parseInt(requestedPage, 10);
        let existingChunk = metadata.chunks.find(c => c.pageNumber === pageNum);
        const pageObj = metadata.pages?.find(p => p.pageNumber === pageNum);

        // Check if page needs OCR (empty, scanned, legacy Limon, or corrupted font hacks/IPA glyphs)
        const needsOcr = textNeedsOcr(existingChunk?.text) || pageObj?.isScanned;

        if (needsOcr) {
          const filePath = findBookFilePath(bookId);
          if (filePath && fs.existsSync(filePath)) {
            try {
              console.log(`[AIController] Performing on-demand OCR for book "${bookId}" page ${pageNum}...`);
              const ocrText = await ocrService.ocrPage(filePath, pageNum);
              if (ocrText && ocrText.trim().length > 0) {
                if (existingChunk) {
                  existingChunk.text = ocrText;
                  existingChunk.charCount = ocrText.length;
                } else {
                  existingChunk = {
                    chunkId: `p${pageNum}_ocr`,
                    pageNumber: pageNum,
                    text: ocrText,
                    charCount: ocrText.length
                  };
                  metadata.chunks.push(existingChunk);
                }
                if (pageObj) {
                  pageObj.snippet = ocrText.substring(0, 150);
                  pageObj.charCount = ocrText.length;
                  pageObj.isScanned = false;
                }
                pdfService.saveMetadata(bookId, metadata);
                console.log(`[AIController] On-demand OCR complete for page ${pageNum} (${ocrText.length} chars).`);
              }
            } catch (ocrErr) {
              console.warn('[Auto-OCR on query failed]:', ocrErr.message);
            }
          }
        }
      }

      const result = await aiService.askGroundedQuestion({
        question: question.trim(),
        chunks: metadata.chunks,
        currentPage: currentPage ? parseInt(currentPage, 10) : null,
        language: language || aiConfig.defaultLanguage,
        scope
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Execute predefined AI action on selected text or page
   */
  async executeAction(req, res, next) {
    try {
      const { action, text, bookId, pageNumber, language } = req.body;

      if (!action) {
        return res.status(400).json({ success: false, error: 'សូមបញ្ជាក់ប្រភេទសកម្មភាព AI (Action is required)' });
      }

      let actionText = (text || '').trim();
      let bookTitle = '';

      if (bookId) {
        const metadata = pdfService.getMetadata(bookId);
        bookTitle = metadata?.title || '';

        if (!actionText && pageNumber && metadata?.chunks) {
          const pageNum = parseInt(pageNumber, 10);
          const pageChunks = metadata.chunks.filter(c => c.pageNumber === pageNum);
          if (pageChunks.length > 0) {
            actionText = pageChunks.map(c => c.text).join('\n\n');
          }
        }
      }

      if (!actionText || actionText.length === 0) {
        return res.status(400).json({ success: false, error: 'សូមជ្រើសរើសអត្ថបទជាមុនសិន (Please select text)' });
      }

      const result = await aiService.executeAction({
        action,
        text: actionText,
        bookTitle,
        pageNumber: pageNumber ? parseInt(pageNumber, 10) : null,
        language: language || aiConfig.defaultLanguage
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get AI system status
   */
  async getStatus(req, res, next) {
    try {
      res.json({
        success: true,
        config: aiConfig.getPublicConfig()
      });
    } catch (err) {
      next(err);
    }
  }
}

const aiController = new AIController();
module.exports = aiController;
