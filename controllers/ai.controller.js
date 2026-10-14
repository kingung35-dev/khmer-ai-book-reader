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
  if (pdfService.isCorruptedGlyphText(text)) return true;
  const khmerCount = (text.match(/[\u1780-\u17FF]/g) || []).length;
  const isPureEnglish = /^[a-zA-Z0-9\s.,!?'"()\-:;—\n\r/«»]+$/.test(text) && (text.match(/[a-zA-Z]/g) || []).length >= 30;
  return khmerCount < 15 && !isPureEnglish;
}

class AIController {
  /**
   * Ask a question about the book or a specific page
   */
  async askQuestion(req, res, next) {
    try {
      const { bookId, question, currentPage, scope = 'book', language, startPage, endPage } = req.body;

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

      // Filter out any corrupted chunks so AI never receives broken legacy font data
      metadata.chunks = metadata.chunks.filter(c => !pdfService.isCorruptedGlyphText(c.text));

      // Check if user specifically requested a page range, whole book, or single page
      let pageRange = retrievalService.extractMentionedRange(question);
      if (!pageRange && startPage && endPage && (scope === 'range' || parseInt(startPage, 10) !== parseInt(endPage, 10))) {
        pageRange = {
          startPage: Math.min(parseInt(startPage, 10), parseInt(endPage, 10)),
          endPage: Math.max(parseInt(startPage, 10), parseInt(endPage, 10))
        };
      }
      const isWholeBook = !pageRange && (scope === 'book' || retrievalService.isWholeBookQuery(question));
      const requestedPage = (pageRange || isWholeBook) ? null : (retrievalService.extractMentionedPage(question) || (scope === 'page' ? currentPage : null));

      if (requestedPage) {
        const pageNum = parseInt(requestedPage, 10);
        const pageChunks = metadata.chunks.filter(c => c.pageNumber === pageNum);
        const pageObj = metadata.pages?.find(p => p.pageNumber === pageNum);

        // Check if page needs OCR (empty, scanned, legacy Limon, or corrupted font hacks/IPA glyphs)
        const needsOcr = pageChunks.length === 0 || pageChunks.some(c => textNeedsOcr(c.text)) || pageObj?.isScanned;

        if (needsOcr) {
          const filePath = findBookFilePath(bookId);
          if (filePath && fs.existsSync(filePath)) {
            try {
              console.log(`[AIController] Performing on-demand OCR for book "${bookId}" page ${pageNum}...`);
              const ocrText = await ocrService.ocrPage(filePath, pageNum);
              if (ocrText && ocrText.trim().length > 0) {
                // Remove old corrupted chunks for this page
                metadata.chunks = metadata.chunks.filter(c => c.pageNumber !== pageNum);
                metadata.chunks.push({
                  chunkId: `p${pageNum}_ocr`,
                  pageNumber: pageNum,
                  text: ocrText,
                  charCount: ocrText.length
                });

                if (pageObj) {
                  pageObj.snippet = ocrText.substring(0, 150);
                  pageObj.charCount = ocrText.length;
                  pageObj.isScanned = false;
                }
                if (!metadata.pageTexts) metadata.pageTexts = {};
                metadata.pageTexts[pageNum] = ocrText;
                pdfService.saveMetadata(bookId, metadata);
                console.log(`[AIController] On-demand OCR complete for page ${pageNum} (${ocrText.length} chars).`);
              }
            } catch (ocrErr) {
              console.warn('[Auto-OCR on query failed]:', ocrErr.message);
            }
          }
        }
      }

      const effectiveScope = isWholeBook ? 'book' : (pageRange ? 'range' : (scope || 'page'));

      const result = await aiService.askGroundedQuestion({
        question: question.trim(),
        chunks: metadata.chunks,
        currentPage: requestedPage ? parseInt(requestedPage, 10) : null,
        language: language || aiConfig.defaultLanguage,
        scope: effectiveScope,
        startPage: pageRange ? pageRange.startPage : (startPage ? parseInt(startPage, 10) : null),
        endPage: pageRange ? pageRange.endPage : (endPage ? parseInt(endPage, 10) : null)
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
   * Execute predefined AI action on selected text, specific page, or page range
   */
  async executeAction(req, res, next) {
    try {
      const { action, text, bookId, pageNumber, startPage, endPage, scope, language } = req.body;

      if (!action) {
        return res.status(400).json({ success: false, error: 'សូមបញ្ជាក់ប្រភេទសកម្មភាព AI (Action is required)' });
      }

      let actionText = (text || '').trim();
      let bookTitle = '';
      let displayPage = pageNumber ? parseInt(pageNumber, 10) : null;

      if (bookId) {
        const metadata = pdfService.getMetadata(bookId);
        bookTitle = metadata?.title || '';

        if (!actionText && metadata?.chunks) {
          // Filter clean chunks only
          const allCleanChunks = metadata.chunks.filter(c => retrievalService.isCleanText(c.text) && !pdfService.isCorruptedGlyphText(c.text));

          if (startPage && endPage) {
            const p1 = parseInt(startPage, 10);
            const p2 = parseInt(endPage, 10);
            const s = Math.min(p1, p2);
            const e = Math.max(p1, p2);
            const rangeChunks = allCleanChunks.filter(c => c.pageNumber >= s && c.pageNumber <= e);
            actionText = rangeChunks.slice(0, 15).map(c => `[ទំព័រទី ${c.pageNumber}]\n${c.text.trim()}`).join('\n\n');
            displayPage = `${s}-${e}`;
          } else if (pageNumber) {
            const pageNum = parseInt(pageNumber, 10);
            const pageChunks = allCleanChunks.filter(c => c.pageNumber === pageNum);
            if (pageChunks.length > 0) {
              actionText = pageChunks.map(c => c.text).join('\n\n');
            } else if (metadata.pageTexts && metadata.pageTexts[pageNum]) {
              actionText = metadata.pageTexts[pageNum];
            }
          } else if (scope === 'book') {
            actionText = allCleanChunks.slice(0, 15).map(c => `[ទំព័រទី ${c.pageNumber}]\n${c.text.trim()}`).join('\n\n');
            displayPage = 'សៀវភៅទាំងមូល';
          }
        }
      }

      // Sanitize any corrupt glyphs
      actionText = pdfService.sanitizeCorruptGlyphs(actionText);

      if (!actionText || actionText.length === 0) {
        return res.status(400).json({ success: false, error: 'សូមជ្រើសរើសអត្ថបទ ឬទំព័រជាមុនសិន (Please select text or pages)' });
      }

      const result = await aiService.executeAction({
        action,
        text: actionText,
        bookTitle,
        pageNumber: displayPage,
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
