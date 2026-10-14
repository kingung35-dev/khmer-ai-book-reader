/**
 * PDF Service
 * Handles PDF text extraction, Khmer Unicode reconstruction, page-level chunking,
 * scanned page detection, and metadata caching.
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ocrService = require('./ocr.service');

const METADATA_DIR = path.join(__dirname, '..', 'storage', 'metadata');
if (!fs.existsSync(METADATA_DIR)) {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
}

class PdfService {
  /**
   * Process a PDF document: extract pages, reconstruct Khmer text, create chunks, and cache.
   * @param {string} bookId - Unique book identifier
   * @param {string} pdfPath - Path to the PDF file
   * @param {boolean} forceReindex - Whether to force re-extraction
   */
  async processPdf(bookId, pdfPath, forceReindex = false) {
    const metaPath = this.getMetadataPath(bookId);

    // Return cached if available and not forced
    if (!forceReindex && fs.existsSync(metaPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return cached;
      } catch (err) {
        console.warn(`[PdfService] Corrupt metadata cache for ${bookId}, re-processing:`, err.message);
      }
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`ឯកសារ PDF មិនមាននៅក្នុងប្រព័ន្ធទេ: ${path.basename(pdfPath)}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);

    // Extract pages with coordinate reconstruction for proper Khmer character spacing
    const pages = [];
    const renderPage = (pageData) => {
      return pageData.getTextContent().then((textContent) => {
        let lastY = null;
        let lastX = null;
        let lastWidth = 0;
        let pageText = '';

        for (const item of textContent.items) {
          const x = item.transform[4];
          const y = item.transform[5];

          if (lastY !== null && Math.abs(y - lastY) > 5) {
            // New line
            pageText += '\n';
          } else if (lastX !== null) {
            const gap = x - (lastX + lastWidth);
            // Word gap threshold
            if (gap > 4) {
              pageText += ' ';
            }
          }

          pageText += item.str;
          lastX = x;
          lastY = y;
          lastWidth = item.width || 0;
        }

        const normalized = this.normalizeKhmerText(pageText);
        const pageNum = pageData.pageIndex + 1;
        const khmerCount = (normalized.match(/[\u1780-\u17FF]/g) || []).length;
        const isCorrupt = this.isCorruptedGlyphText(normalized);
        const isScannedOrCorrupt = normalized.trim().length < 20 || isCorrupt || (khmerCount < 10 && !/^[a-zA-Z0-9\s.,!?'"()\-:;—\n\r]+$/.test(normalized));

        pages.push({
          pageNumber: pageNum,
          text: isCorrupt ? '' : normalized,
          charCount: isCorrupt ? 0 : normalized.length,
          isScanned: isScannedOrCorrupt
        });

        return isCorrupt ? '' : normalized;
      });
    };

    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer, { pagerender: renderPage });
    } catch (parseErr) {
      if (parseErr.message && parseErr.message.includes('Password')) {
        const err = new Error('ឯកសារ PDF នេះមានលេខកូដសម្ងាត់ការពារ (Password-protected PDF)');
        err.code = 'PASSWORD_PROTECTED';
        err.status = 400;
        throw err;
      }
      const err = new Error(`មិនអាចអានឯកសារ PDF នេះបានទេ (Corrupted or invalid PDF): ${parseErr.message}`);
      err.code = 'INVALID_PDF';
      err.status = 400;
      throw err;
    }

    // Sort pages by page number ascending
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    const totalPages = pdfData.numpages || pages.length;
    const scannedPages = pages.filter(p => p.isScanned).map(p => p.pageNumber);

    // Fast mapping of page texts for instant lookup by page number
    const pageTexts = {};
    for (const p of pages) {
      pageTexts[p.pageNumber] = p.text;
    }

    // Generate RAG chunks with page associations
    const chunks = this.createChunks(pages);

    // Determine document language
    const totalKhmerChars = (pdfData.text.match(/[\u1780-\u17FF]/g) || []).length;
    const totalLatinChars = (pdfData.text.match(/[A-Za-z]/g) || []).length;
    let detectedLanguage = 'mixed';
    if (totalKhmerChars > totalLatinChars * 2) {
      detectedLanguage = 'km';
    } else if (totalLatinChars > totalKhmerChars * 2) {
      detectedLanguage = 'en';
    }

    const metadata = {
      bookId,
      totalPages,
      pageCount: totalPages,
      detectedLanguage,
      totalKhmerChars,
      totalLatinChars,
      scannedPagesCount: scannedPages.length,
      isMostlyScanned: scannedPages.length > totalPages * 0.7,
      scannedPageNumbers: scannedPages,
      chunksCount: chunks.length,
      pageTexts,
      pages: pages.map(p => ({
        pageNumber: p.pageNumber,
        charCount: p.charCount,
        isScanned: p.isScanned,
        snippet: p.text.substring(0, 150)
      })),
      chunks,
      processedAt: new Date().toISOString()
    };

    // Cache metadata
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    return metadata;
  }

  /**
   * Check if a string is corrupted legacy font glyphs (IPA, Latin Extended-B, Cyrillic hacks)
   */
  isCorruptedGlyphText(text) {
    if (!text || typeof text !== 'string') return false;
    const corruptMatches = text.match(/[\u0180-\u02AF\u1D00-\u1DBF\u0400-\u04FF]/g) || [];
    const khmerMatches = text.match(/[\u1780-\u17FF]/g) || [];
    if (corruptMatches.length > 2 && khmerMatches.length < 5) return true;
    if (khmerMatches.length === 0 && corruptMatches.length > 1) return true;
    if (text.length > 15 && (corruptMatches.length / text.length) > 0.08) return true;
    return false;
  }

  /**
   * Remove corrupted glyph runs from text
   */
  sanitizeCorruptGlyphs(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\u0180-\u02AF\u1D00-\u1DBF\u0400-\u04FF]+/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  /**
   * Normalize and fix common Khmer Unicode extraction issues
   */
  normalizeKhmerText(text) {
    if (!text) return '';

    return text
      // Normalize Unicode decomposition/composition
      .normalize('NFC')
      // Remove zero-width non-breaking spaces and BOM
      .replace(/[\uFEFF\u200B\u200E\u200F]/g, '')
      // Strip corrupted legacy glyph runs
      .replace(/[\u0180-\u02AF\u1D00-\u1DBF\u0400-\u04FF]{2,}/g, ' ')
      // Fix broken Coeng (Subscript consonant indicator \u17D2 followed by spaces)
      .replace(/\u17D2\s+([\u1780-\u17A2])/g, '\u17D2$1')
      // Fix vowel split from consonant
      .replace(/([\u1780-\u17D3])\s+([\u17B6-\u17D1])/g, '$1$2')
      // Clean excessive spaces (more than 2 consecutive spaces to 1)
      .replace(/[ \t]{2,}/g, ' ')
      // Clean excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Split pages into manageable, context-preserving chunks
   */
  createChunks(pages, targetChunkChars = 800) {
    const chunks = [];
    let chunkCounter = 1;

    for (const page of pages) {
      const pageText = page.text.trim();
      if (!pageText || this.isCorruptedGlyphText(pageText)) continue;

      // If page is short, keep as single chunk
      if (pageText.length <= targetChunkChars) {
        chunks.push({
          chunkId: `chunk_${chunkCounter++}`,
          pageNumber: page.pageNumber,
          text: pageText,
          charCount: pageText.length
        });
        continue;
      }

      // Split by paragraphs or Khmer sentence ends (។ / ៕ / newlines)
      const segments = pageText.split(/(?<=[។៕\n])/);
      let currentChunkText = '';

      for (const seg of segments) {
        if (this.isCorruptedGlyphText(seg)) continue;

        if ((currentChunkText + seg).length > targetChunkChars && currentChunkText.length > 200) {
          if (!this.isCorruptedGlyphText(currentChunkText)) {
            chunks.push({
              chunkId: `chunk_${chunkCounter++}`,
              pageNumber: page.pageNumber,
              text: currentChunkText.trim(),
              charCount: currentChunkText.trim().length
            });
          }
          currentChunkText = seg;
        } else {
          currentChunkText += seg;
        }
      }

      if (currentChunkText.trim().length > 0 && !this.isCorruptedGlyphText(currentChunkText)) {
        chunks.push({
          chunkId: `chunk_${chunkCounter++}`,
          pageNumber: page.pageNumber,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length
        });
      }
    }

    return chunks;
  }

  /**
   * Retrieve cached metadata or chunks for a book
   */
  getMetadata(bookId) {
    const metaPath = this.getMetadataPath(bookId);
    if (!fs.existsSync(metaPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  /**
   * Update metadata cache (e.g. after OCR on a scanned page)
   */
  saveMetadata(bookId, metadata) {
    const metaPath = this.getMetadataPath(bookId);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  getMetadataPath(bookId) {
    return path.join(METADATA_DIR, `${bookId}.json`);
  }
}

const pdfService = new PdfService();
module.exports = pdfService;
