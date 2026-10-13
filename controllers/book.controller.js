/**
 * Book Controller
 * Manages book library, uploads, reading progress, OCR requests, and file streaming.
 */

const fs = require('fs');
const path = require('path');
const pdfService = require('../services/pdf.service');
const ocrService = require('../services/ocr.service');

const BOOKS_DIR = path.join(__dirname, '..', 'storage', 'books');
const METADATA_DIR = path.join(__dirname, '..', 'storage', 'metadata');

class BookController {
  /**
   * List all books in the library
   */
  async listBooks(req, res, next) {
    try {
      if (!fs.existsSync(BOOKS_DIR)) {
        return res.json({ success: true, books: [] });
      }

      const files = fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
      const books = [];

      for (const file of files) {
        const filePath = path.join(BOOKS_DIR, file);
        const stats = fs.statSync(filePath);
        
        // Extract bookId and clean title
        let bookId = file.replace(/\.pdf$/i, '');
        let title = file.replace(/\.pdf$/i, '');
        
        // If file starts with uuid prefix (e.g., uuid_title.pdf)
        const uuidMatch = file.match(/^([a-f0-9-]+)_(.+)\.pdf$/i);
        if (uuidMatch) {
          bookId = uuidMatch[1];
          title = uuidMatch[2].replace(/_/g, ' ');
        } else if (file === 'sample-khmer.pdf') {
          bookId = 'sample-khmer';
          title = 'ស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀន (គំរូសៀវភៅខ្មែរ)';
        }

        // Check for cached metadata
        const metadata = pdfService.getMetadata(bookId);

        books.push({
          id: bookId,
          filename: file,
          title: metadata?.title || title,
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          totalPages: metadata?.totalPages || 0,
          detectedLanguage: metadata?.detectedLanguage || 'km',
          lastReadPage: metadata?.lastReadPage || 1,
          bookmarksCount: metadata?.bookmarks?.length || 0,
          notesCount: metadata?.notes?.length || 0,
          isScanned: metadata?.isMostlyScanned || false,
          createdAt: stats.birthtime || stats.mtime,
          updatedAt: metadata?.updatedAt || stats.mtime
        });
      }

      // Sort by date added descending
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json({
        success: true,
        count: books.length,
        books
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload and process a new PDF book
   */
  async uploadBook(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'សូមជ្រើសរើសឯកសារ PDF មួយដើម្បីផ្ទុកឡើង',
          error_en: 'No PDF file uploaded'
        });
      }

      const filename = req.file.filename;
      const filePath = req.file.path;

      // Extract bookId
      let bookId = filename.replace(/\.pdf$/i, '');
      let title = path.basename(req.file.originalname, '.pdf');
      const uuidMatch = filename.match(/^([a-f0-9-]+)_(.+)\.pdf$/i);
      if (uuidMatch) {
        bookId = uuidMatch[1];
        title = uuidMatch[2].replace(/_/g, ' ');
      }

      if (req.body.customTitle && req.body.customTitle.trim().length > 0) {
        title = req.body.customTitle.trim();
      } else if (req.body.title && req.body.title.trim().length > 0) {
        title = req.body.title.trim();
      }

      // Process PDF: extract pages, reconstruct Khmer text, index chunks
      const metadata = await pdfService.processPdf(bookId, filePath);
      metadata.title = title;
      metadata.originalFilename = req.file.originalname;
      metadata.lastReadPage = 1;
      metadata.bookmarks = [];
      metadata.notes = [];
      pdfService.saveMetadata(bookId, metadata);

      res.status(201).json({
        success: true,
        message: 'បានផ្ទុកឡើង និងដំណើរការអានសៀវភៅដោយជោគជ័យ',
        book: {
          id: bookId,
          title,
          filename,
          totalPages: metadata.totalPages,
          detectedLanguage: metadata.detectedLanguage,
          isScanned: metadata.isMostlyScanned,
          scannedPagesCount: metadata.scannedPagesCount
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get metadata and progress for a single book
   */
  async getBookDetails(req, res, next) {
    try {
      const { id } = req.params;
      const file = findBookFileById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'រកមិនឃើញសៀវភៅនេះក្នុងបណ្ណាល័យទេ',
          error_en: 'Book not found'
        });
      }

      const filePath = path.join(BOOKS_DIR, file);
      let metadata = pdfService.getMetadata(id);

      if (!metadata) {
        // Process on demand if not cached yet
        metadata = await pdfService.processPdf(id, filePath);
      }

      res.json({
        success: true,
        book: {
          id,
          filename: file,
          title: metadata.title || id,
          totalPages: metadata.totalPages,
          detectedLanguage: metadata.detectedLanguage,
          lastReadPage: metadata.lastReadPage || 1,
          bookmarks: metadata.bookmarks || [],
          notes: metadata.notes || [],
          isScanned: metadata.isMostlyScanned,
          scannedPages: metadata.scannedPageNumbers || [],
          chunksCount: metadata.chunksCount || metadata.chunks?.length || 0
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Stream the PDF file to client for PDF.js viewer
   */
  async servePdf(req, res, next) {
    try {
      const { id } = req.params;
      const file = findBookFileById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'រកមិនឃើញឯកសារ PDF នេះទេ',
          error_en: 'PDF file not found'
        });
      }

      const filePath = path.join(BOOKS_DIR, file);
      const stat = fs.statSync(filePath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file)}"`);
      res.setHeader('Accept-Ranges', 'bytes');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update reading progress, bookmarks, and notes
   */
  async updateProgress(req, res, next) {
    try {
      const { id } = req.params;
      const { lastReadPage, bookmark, removeBookmark, note } = req.body;

      let metadata = pdfService.getMetadata(id);
      if (!metadata) {
        return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យសៀវភៅ' });
      }

      if (lastReadPage !== undefined) {
        metadata.lastReadPage = Math.max(1, parseInt(lastReadPage, 10));
      }

      if (!metadata.bookmarks) metadata.bookmarks = [];
      if (!metadata.notes) metadata.notes = [];

      // Add bookmark
      if (bookmark && typeof bookmark.page === 'number') {
        const exists = metadata.bookmarks.some(b => b.page === bookmark.page);
        if (!exists) {
          metadata.bookmarks.push({
            page: bookmark.page,
            title: bookmark.title || `ទំព័រទី ${bookmark.page}`,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Remove bookmark
      if (removeBookmark && typeof removeBookmark.page === 'number') {
        metadata.bookmarks = metadata.bookmarks.filter(b => b.page !== removeBookmark.page);
      }

      // Add note
      if (note && note.text) {
        metadata.notes.push({
          id: Date.now().toString(),
          page: note.page || metadata.lastReadPage,
          text: note.text,
          createdAt: new Date().toISOString()
        });
      }

      metadata.updatedAt = new Date().toISOString();
      pdfService.saveMetadata(id, metadata);

      res.json({
        success: true,
        lastReadPage: metadata.lastReadPage,
        bookmarks: metadata.bookmarks,
        notes: metadata.notes
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a book from the library
   */
  async deleteBook(req, res, next) {
    try {
      const { id } = req.params;
      const file = findBookFileById(id);

      if (file) {
        const filePath = path.join(BOOKS_DIR, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Delete metadata cache
      const metaPath = path.join(METADATA_DIR, `${id}.json`);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }

      res.json({
        success: true,
        message: 'បានលុបសៀវភៅចេញពីបណ្ណាល័យដោយជោគជ័យ'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger OCR on a specific page or scanned pages of a book
   */
  async runOcr(req, res, next) {
    try {
      const { id } = req.params;
      const { pageNumber } = req.body;

      const file = findBookFileById(id);
      if (!file) {
        return res.status(404).json({ success: false, error: 'រកមិនឃើញសៀវភៅ' });
      }

      const filePath = path.join(BOOKS_DIR, file);
      const targetPage = parseInt(pageNumber, 10);

      const ocrText = await ocrService.ocrPage(filePath, targetPage);

      // Update metadata with newly OCR'd text
      let metadata = pdfService.getMetadata(id);
      if (metadata) {
        const pObj = metadata.pages?.find(p => p.pageNumber === targetPage);
        if (pObj) {
          pObj.isScanned = false;
          pObj.charCount = ocrText.length;
        }

        // Add chunk for this page
        if (!metadata.chunks) metadata.chunks = [];
        metadata.chunks.push({
          chunkId: `ocr_p${targetPage}`,
          pageNumber: targetPage,
          text: ocrText,
          charCount: ocrText.length
        });

        pdfService.saveMetadata(id, metadata);
      }

      res.json({
        success: true,
        pageNumber: targetPage,
        text: ocrText
      });
    } catch (err) {
      next(err);
    }
  }
}

function findBookFileById(bookId) {
  if (!fs.existsSync(BOOKS_DIR)) return null;
  const files = fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  
  if (bookId === 'sample-khmer' && files.includes('sample-khmer.pdf')) {
    return 'sample-khmer.pdf';
  }

  // Exact match
  const exact = files.find(f => f === `${bookId}.pdf` || f === bookId);
  if (exact) return exact;

  // Prefix match (uuid_title.pdf)
  const prefixed = files.find(f => f.startsWith(`${bookId}_`));
  return prefixed || null;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const bookController = new BookController();
module.exports = bookController;
