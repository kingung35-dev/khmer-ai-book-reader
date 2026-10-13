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
   * Extract page number mentioned in query (supporting Arabic & Khmer numerals, with or without "ទី")
   */
  extractMentionedPage(query) {
    if (!query) return null;
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
  retrieveRelevantChunks(chunks, query, targetPage = null, maxChunks = 6) {
    if (!chunks || chunks.length === 0) return [];

    // Extract page number mentioned in query text (e.g., "ទំព័រទី 12", "ទំព័រ ៥")
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
      // Default fallback: return first few chunks
      return chunks.slice(0, maxChunks);
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

      if (score > 0) {
        scoredChunks.push({
          ...chunk,
          score
        });
      }
    }

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    // If no chunks scored, return the first few chunks
    let selected = scoredChunks.length > 0 ? scoredChunks.slice(0, maxChunks) : chunks.slice(0, maxChunks);

    // Enforce character limit to fit AI prompt window
    const maxChars = aiConfig.maxContextChars || 12000;
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
      return `--- [ឯកសារយោងទំព័រទី ${chunk.pageNumber} / Page ${chunk.pageNumber}] ---\n${chunk.text.trim()}`;
    }).join('\n\n');
  }
}

const retrievalService = new RetrievalService();
module.exports = retrievalService;
