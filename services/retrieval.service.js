/**
 * Retrieval Service (RAG Engine)
 * Tokenizes Khmer and English text, indexes document chunks,
 * and retrieves the most relevant passages for a user's question with page citations.
 */

const aiConfig = require('../config/ai.config');

class RetrievalService {
  /**
   * Tokenize text for both Khmer and Latin/English languages
   * @param {string} text
   * @returns {string[]} Array of normalized tokens
   */
  tokenize(text) {
    if (!text) return [];

    const tokens = [];
    const normalized = text.toLowerCase();

    // 1. Extract Latin words and numbers
    const latinTokens = normalized.match(/[a-z0-9_]+/g) || [];
    tokens.push(...latinTokens);

    // 2. Extract Khmer segments
    const khmerMatches = normalized.match(/[\u1780-\u17FF]+/g) || [];
    for (const seg of khmerMatches) {
      if (seg.length <= 1) continue;

      // Extract 2-gram and 3-gram character clusters for Khmer words
      // Since Khmer doesn't use spaces between words, n-grams capture compound vocabulary accurately
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2));
        if (i < seg.length - 2) {
          tokens.push(seg.substring(i, i + 3));
        }
      }

      // Also add the segment if short
      if (seg.length <= 8) {
        tokens.push(seg);
      }
    }

    return tokens;
  }

  /**
   * Check if a chunk text contains readable Khmer or English rather than corrupted font glyphs
   */
  isCleanText(text) {
    if (!text || text.trim().length < 15) return false;
    const corruptMatches = text.match(/[\u0180-\u02AF\u1D00-\u1DBF\u0400-\u04FF]/g) || [];
    const khmerMatches = text.match(/[\u1780-\u17FF]/g) || [];
    const latinMatches = text.match(/[a-zA-Z]/g) || [];

    // If corrupted glyphs exist and low Khmer
    if (corruptMatches.length > 2 && khmerMatches.length < 5) return false;
    if (khmerMatches.length === 0 && corruptMatches.length > 1) return false;
    if (text.length > 15 && (corruptMatches.length / text.length) > 0.08) return false;

    // Must be either legitimate Khmer or clean English
    const hasSufficientKhmer = khmerMatches.length >= 5;
    const isCleanEnglish = latinMatches.length >= 10 && /^[a-zA-Z0-9\s.,!?'"()\-:;—\n\r/«»]+$/.test(text);

    return hasSufficientKhmer || isCleanEnglish;
  }

  /**
   * Extract page range mentioned in query (e.g. "ចាប់ពីទំព័រទី 12 ដល់ 184", "ពីទំព័រ ១២ រហូតដល់ទំព័រទី ១៨៤")
   */
  extractMentionedRange(query) {
    if (!query) return null;
    const khmerToArabic = {
      '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
      '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9'
    };
    const normalized = query.replace(/[\u17E0-\u17E9]/g, d => khmerToArabic[d] || d);
    const rangeRegex = /(?:ចាប់ពី|ពី)?\s*(?:ទំព័រ\s*ទី|ទំព័រ|pages?|p\.)\s*(\d+)\s*(?:រហូតដល់|ដល់|ទៅ|to|-)\s*(?:ទំព័រ\s*ទី|ទំព័រ|page|p\.)?\s*(\d+)/i;
    const match = normalized.match(rangeRegex);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      if (!isNaN(p1) && !isNaN(p2)) {
        return {
          startPage: Math.min(p1, p2),
          endPage: Math.max(p1, p2)
        };
      }
    }
    return null;
  }

  /**
   * Detect if query asks across the entire book
   */
  isWholeBookQuery(query) {
    if (!query) return false;
    return /(?:សៀវភៅនេះទាំងមូល|សៀវភៅទាំងមូល|ទូទាំងសៀវភៅ|គ្រប់ទំព័រ|គ្រប់ជំពូក|ទាំងមូល|whole\s+book|entire\s+book|all\s+pages|all\s+chapters)/i.test(query);
  }

  /**
   * Extract page number mentioned in query (supporting Arabic & Khmer numerals, with or without "ទី")
   */
  extractMentionedPage(query) {
    if (!query) return null;
    // If a range or whole book was requested, do not isolate to a single page
    if (this.extractMentionedRange(query) || this.isWholeBookQuery(query)) {
      return null;
    }
    const khmerToArabic = {
      '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
      '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9'
    };
    const normalized = query.replace(/[\u17E0-\u17E9]/g, d => khmerToArabic[d] || d);
    const match = normalized.match(/(?:ទំព័រ\s*ទី|ទំព័រ|page|p\.)\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Search and rank chunks relevant to a user query
   * @param {Array} chunks - List of chunks { chunkId, pageNumber, text }
   * @param {string} query - The user question or search phrase
   * @param {number} targetPage - Optional target page context (if user asks about a specific page)
   * @param {number} maxChunks - Maximum number of chunks to return
   * @returns {Array} Ranked relevant chunks with scores
   */
  retrieveRelevantChunks(chunks, query, targetPage = null, maxChunks = 15, options = {}) {
    if (!chunks || chunks.length === 0) return [];

    // 1. Check if user specified a page range (via options or mentioned in query)
    let pageRange = null;
    if (options && options.startPage && options.endPage) {
      pageRange = {
        startPage: Math.min(parseInt(options.startPage, 10), parseInt(options.endPage, 10)),
        endPage: Math.max(parseInt(options.startPage, 10), parseInt(options.endPage, 10))
      };
    } else if (options && options.pageRange) {
      pageRange = options.pageRange;
    } else {
      pageRange = this.extractMentionedRange(query);
    }

    if (pageRange) {
      const { startPage, endPage } = pageRange;
      const inRange = chunks.filter(c => c.pageNumber >= startPage && c.pageNumber <= endPage);
      const cleanInRange = inRange.filter(c => this.isCleanText(c.text));
      const pool = cleanInRange.length > 0 ? cleanInRange : inRange;

      if (pool.length <= maxChunks) {
        return pool.sort((a, b) => a.pageNumber - b.pageNumber);
      }

      // Sample evenly across the page range
      const sampled = [];
      const step = pool.length / maxChunks;
      for (let i = 0; i < maxChunks; i++) {
        const idx = Math.min(Math.floor(i * step), pool.length - 1);
        if (!sampled.includes(pool[idx])) {
          sampled.push(pool[idx]);
        }
      }
      return sampled.sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // 2. Check if user requested the entire book
    const isWholeBook = (options && options.scope === 'book') || this.isWholeBookQuery(query);
    if (isWholeBook) {
      const cleanAll = chunks.filter(c => this.isCleanText(c.text));
      const pool = cleanAll.length > 0 ? cleanAll : chunks;

      if (pool.length <= maxChunks) {
        return pool.sort((a, b) => a.pageNumber - b.pageNumber);
      }

      const sampled = [];
      const step = pool.length / maxChunks;
      for (let i = 0; i < maxChunks; i++) {
        const idx = Math.min(Math.floor(i * step), pool.length - 1);
        if (!sampled.includes(pool[idx])) {
          sampled.push(pool[idx]);
        }
      }
      return sampled.sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // 3. Extract single page number mentioned in query text (e.g., "ទំព័រទី 12", "ទំព័រ ៥")
    const explicitlyMentionedPage = this.extractMentionedPage(query);
    const targetPageNum = targetPage !== null && targetPage !== undefined ? parseInt(targetPage, 10) : explicitlyMentionedPage;

    // If query targets or mentions a specific page, return chunks for that page directly!
    if (targetPageNum !== null) {
      const pageChunks = chunks.filter(c => c.pageNumber === targetPageNum);
      if (pageChunks.length > 0) {
        return pageChunks;
      }
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      // Default fallback: return first clean chunks
      const cleanChunks = chunks.filter(c => this.isCleanText(c.text));
      return (cleanChunks.length > 0 ? cleanChunks : chunks).slice(0, maxChunks);
    }

    // Build Document Frequency (DF) across chunks
    const df = {};
    const chunkTokensMap = new Map();

    for (const chunk of chunks) {
      const cTokens = this.tokenize(chunk.text);
      const uniqueTokens = new Set(cTokens);
      chunkTokensMap.set(chunk.chunkId, { tokens: cTokens, unique: uniqueTokens });

      for (const t of uniqueTokens) {
        df[t] = (df[t] || 0) + 1;
      }
    }

    const totalDocs = chunks.length;

    // Score each chunk
    const scoredChunks = [];

    for (const chunk of chunks) {
      const { tokens: cTokens, unique: uniqueTokens } = chunkTokensMap.get(chunk.chunkId);
      let score = 0;

      // BM25-inspired term scoring
      for (const qToken of queryTokens) {
        if (uniqueTokens.has(qToken)) {
          const docFreq = df[qToken] || 1;
          const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));
          // Count TF
          const tf = cTokens.filter(t => t === qToken).length;
          const tfScore = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (cTokens.length / 100)));
          score += idf * tfScore;
        }
      }

      // Bonus for exact query phrase match
      if (chunk.text.toLowerCase().includes(query.toLowerCase().trim())) {
        score += 15.0;
      }

      // Bonus if query explicitly asked for this page
      if (explicitlyMentionedPage !== null && chunk.pageNumber === explicitlyMentionedPage) {
        score += 25.0;
      }

      // Prioritize readable Khmer text over un-OCR'd corrupted glyphs
      if (this.isCleanText(chunk.text)) {
        score += 5.0;
      }

      if (score > 0) {
        scoredChunks.push({
          ...chunk,
          score
        });
      }
    }

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    // If no chunks scored, return the first clean chunks
    let selected = scoredChunks.length > 0 ? scoredChunks.slice(0, maxChunks) : chunks.filter(c => this.isCleanText(c.text)).slice(0, maxChunks);
    if (selected.length === 0) selected = chunks.slice(0, maxChunks);

    // Enforce character limit to fit AI prompt window
    const maxChars = aiConfig.maxContextChars || 36000;
    let accumulatedChars = 0;
    const finalChunks = [];

    for (const chunk of selected) {
      if (accumulatedChars + chunk.text.length <= maxChars || finalChunks.length === 0) {
        finalChunks.push(chunk);
        accumulatedChars += chunk.text.length;
      }
    }

    // Sort selected chunks back by page order for coherent reading context
    finalChunks.sort((a, b) => a.pageNumber - b.pageNumber);

    return finalChunks;
  }

  /**
   * Format retrieved chunks into a structured prompt context with page references
   */
  formatContextForPrompt(retrievedChunks) {
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return '(គ្មានខ្លឹមសារដកស្រង់ចេញពីសៀវភៅទេ / No document passages retrieved)';
    }

    return retrievedChunks.map((chunk, idx) => {
      const cleanChunkText = chunk.text
        .replace(/[\u0180-\u02AF\u1D00-\u1DBF\u0400-\u04FF]+/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      return `--- [ឯកសារយោងទំព័រទី ${chunk.pageNumber} / Page ${chunk.pageNumber}] ---\n${cleanChunkText}`;
    }).join('\n\n');
  }
}

const retrievalService = new RetrievalService();
module.exports = retrievalService;
