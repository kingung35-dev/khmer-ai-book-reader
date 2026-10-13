/**
 * Automated Test Suite
 * Tests PDF processing, Khmer text normalization, retrieval (RAG) engine, and AI grounding logic.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const pdfService = require('../services/pdf.service');
const retrievalService = require('../services/retrieval.service');
const aiConfig = require('../config/ai.config');
const aiService = require('../services/ai.service');

async function runTests() {
  console.log('🧪 Starting Khmer AI Book Reader Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Khmer Unicode Normalization Tests
  test('Khmer Text Normalization - repairs broken coeng ligatures', () => {
    // \u17D2 followed by space should be repaired
    const broken = 'ព្ រ ះ រា ជា ណា ច ព្ រ';
    const normalized = pdfService.normalizeKhmerText(broken);
    assert(normalized.length > 0, 'Normalized text should not be empty');
  });

  test('Khmer Text Normalization - removes Zero-Width and BOM characters', () => {
    const raw = '\uFEFFសួស្តី\u200Bកម្ពុជា\u200E';
    const cleaned = pdfService.normalizeKhmerText(raw);
    assert(!cleaned.includes('\uFEFF'), 'Should remove BOM');
    assert(!cleaned.includes('\u200B'), 'Should remove ZWSP');
    assert(cleaned.includes('សួស្តី'), 'Should preserve Khmer characters');
  });

  // 2. Document Chunking Tests
  test('PDF Chunking - divides pages into context-preserving chunks with page tracking', () => {
    const mockPages = [
      { pageNumber: 1, text: 'នេះជាទំព័រទីមួយ។ ខ្លឹមសារនៃការអប់រំនៅកម្ពុជា។' },
      { pageNumber: 2, text: 'នេះជាទំព័រទីពីរ។ ស្តង់ដាគ្រូបង្រៀនមានសារៈសំខាន់ណាស់។' }
    ];
    const chunks = pdfService.createChunks(mockPages, 500);
    assert.strictEqual(chunks.length, 2, 'Should create 2 chunks for 2 short pages');
    assert.strictEqual(chunks[0].pageNumber, 1, 'Chunk 1 should belong to page 1');
    assert.strictEqual(chunks[1].pageNumber, 2, 'Chunk 2 should belong to page 2');
    assert(chunks[0].text.includes('ទំព័រទីមួយ'), 'Chunk 1 should contain page 1 text');
  });

  // 3. Khmer & Latin Tokenization Tests
  test('Retrieval Tokenization - extracts Latin tokens and Khmer character n-grams', () => {
    const text = 'Khmer AI Reader កម្មវិធីអានសៀវភៅ';
    const tokens = retrievalService.tokenize(text);
    assert(tokens.includes('khmer'), 'Should include latin word "khmer"');
    assert(tokens.includes('ai'), 'Should include latin word "ai"');
    assert(tokens.length >= 4, 'Should extract multiple Khmer cluster tokens');
  });

  // 4. RAG Retrieval Scoring & Grounding Tests
  test('RAG Retrieval - retrieves passages matching user query with correct page citation', () => {
    const sampleChunks = [
      { chunkId: 'c1', pageNumber: 1, text: 'ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ' },
      { chunkId: 'c2', pageNumber: 5, text: 'ស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀន ត្រូវបានកំណត់ដើម្បីលើកកម្ពស់គុណភាពអប់រំ' },
      { chunkId: 'c3', pageNumber: 10, text: 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន និងការវាយតម្លៃសិស្សានុសិស្ស' }
    ];

    const results = retrievalService.retrieveRelevantChunks(sampleChunks, 'តើស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀនមានអ្វីខ្លះ?', null, 2);
    assert(results.length > 0, 'Should find relevant chunks');
    assert.strictEqual(results[0].pageNumber, 5, 'Top chunk should be page 5 regarding teacher standards');
  });

  test('RAG Retrieval - prioritizes target page when specified', () => {
    const sampleChunks = [
      { chunkId: 'c1', pageNumber: 1, text: 'ទូទៅ' },
      { chunkId: 'c2', pageNumber: 7, text: 'ខ្លឹមសារនៃទំព័រទីប្រាំពីរ' }
    ];

    const results = retrievalService.retrieveRelevantChunks(sampleChunks, 'សង្ខេប', 7, 2);
    assert.strictEqual(results.length, 1, 'Should return only page 7 when targetPage is 7');
    assert.strictEqual(results[0].pageNumber, 7, 'Target page must be 7');
  });

  test('RAG Formatting - formats passages with clear page citation headers', () => {
    const retrieved = [
      { pageNumber: 3, text: 'អត្ថបទគំរូទំព័រ៣' },
      { pageNumber: 8, text: 'អត្ថបទគំរូទំព័រ៨' }
    ];
    const formatted = retrievalService.formatContextForPrompt(retrieved);
    assert(formatted.includes('[ឯកសារយោងទំព័រទី 3 / Page 3]'), 'Must include citation header for page 3');
    assert(formatted.includes('[ឯកសារយោងទំព័រទី 8 / Page 8]'), 'Must include citation header for page 8');
  });

  // 5. Security & Masking Tests
  test('Security - masks API key in public configuration', () => {
    aiConfig.updateConfig({ apiKey: 'AIzaSyDemoTestKey123456789SecretKey' }, false);
    const pub = aiConfig.getPublicConfig();
    assert.strictEqual(pub.hasApiKey, true, 'hasApiKey should be true');
    assert(!pub.maskedApiKey.includes('DemoTestKey'), 'Masked key must not expose full secret');
    assert(pub.maskedApiKey.includes('••••••••'), 'Masked key must contain bullet mask');
    assert.strictEqual(pub.apiKey, undefined, 'Public config must NEVER contain apiKey property');
  });

  // 6. Grounded Prompt Strictness Test
  test('AI Prompt - enforces strict fallback when information is missing', () => {
    const prompt = aiService.buildGroundedPrompt({
      question: 'តើអ្វីទៅជាបញ្ញាសិប្បនិម្មិត?',
      contextText: 'ខ្លឹមសារគំរូ',
      targetLang: 'km',
      scope: 'book',
      currentPage: 1,
      relevantPages: [1]
    });
    const expectedRequirement = 'ខ្ញុំមិនអាចរកឃើញព័ត៌មាននេះនៅក្នុងខ្លឹមសារសៀវភៅដែលបានផ្តល់ឱ្យទេ។';
    assert(prompt.includes(expectedRequirement), 'Prompt must strictly instruct AI to state exact Khmer missing message');
  });

  // 7. Quiz Answer Key & 10 Questions Enforcement Tests
  test('AI Prompt - enforces mandatory Answer Key and at least 10 questions in generate_quiz action prompt', () => {
    const prompt = aiService.buildActionPrompt({
      action: 'generate_quiz',
      text: 'មេរៀនចិត្តវិទ្យា',
      bookTitle: 'ចិត្តវិទ្យា',
      pageNumber: 12,
      targetLang: 'km'
    });
    assert(prompt.includes('ផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់'), 'Action prompt must mandate Answer Key section');
    assert(prompt.includes('ក, ខ, គ, ឃ'), 'Action prompt must mandate Khmer multiple choice options');
    assert(prompt.includes('១០ សំណួរ'), 'Action prompt must mandate at least 10 questions');
  });

  test('AI Prompt - enforces Answer Key and at least 10 questions when user query asks for quiz in grounded QA', () => {
    const prompt = aiService.buildGroundedPrompt({
      question: 'សូមបង្កើតកម្រងសំណួរ quiz លើទំព័រនេះ',
      contextText: 'ខ្លឹមសារមេរៀន',
      targetLang: 'km',
      scope: 'page',
      currentPage: 15,
      relevantPages: [15]
    });
    assert(prompt.includes('ផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់'), 'Grounded prompt for quiz must mandate Answer Key section');
    assert(prompt.includes('ក, ខ, គ, ឃ'), 'Grounded prompt must require choices');
    assert(prompt.includes('១៥ ទៅ ២០ សំណួរ'), 'Grounded prompt must require rich question count');
  });

  // 8. Page Range & Whole Book Detection Tests
  test('Retrieval Service - extracts page ranges accurately in Khmer and English numerals', () => {
    const range1 = retrievalService.extractMentionedRange('សូមបង្កើតលំហាត់ Quiz ឱ្យបាន ១០០ ចេញពីសៀវភៅនេះទាំងមូល ព្រមទាំងមានចម្លើយ ចាប់ពីទំព័រទី12 រហូតដល់ទំព័រទី184។');
    assert.deepStrictEqual(range1, { startPage: 12, endPage: 184 });

    const range2 = retrievalService.extractMentionedRange('ពីទំព័រទី ១០ ដល់ ២៥');
    assert.deepStrictEqual(range2, { startPage: 10, endPage: 25 });

    const range3 = retrievalService.extractMentionedRange('from page 5 to 30');
    assert.deepStrictEqual(range3, { startPage: 5, endPage: 30 });

    const singlePage = retrievalService.extractMentionedRange('តើទំព័រទី 12 និយាយពីអ្វី?');
    assert.strictEqual(singlePage, null);
  });

  test('Retrieval Service - detects whole-book queries', () => {
    assert.strictEqual(retrievalService.isWholeBookQuery('សូមបង្កើត Quiz ចេញពីសៀវភៅនេះទាំងមូល'), true);
    assert.strictEqual(retrievalService.isWholeBookQuery('សង្ខេបទូទាំងសៀវភៅ'), true);
    assert.strictEqual(retrievalService.isWholeBookQuery('summarize whole book'), true);
    assert.strictEqual(retrievalService.isWholeBookQuery('តើទំព័រទី ៥ និយាយពីអ្វី?'), false);
  });

  test('Retrieval Service - retrieves chunks across page range for multi-page queries', () => {
    const sampleChunks = [
      { chunkId: 'c1', pageNumber: 5, text: 'អត្ថបទទំព័រ៥ ខ្លឹមសារមេរៀន' },
      { chunkId: 'c2', pageNumber: 12, text: 'មេរៀនទី១ ចិត្តវិទ្យាជាវិទ្យាសាស្ត្រសិក្សាពីបាតុភូតចិត្ត' },
      { chunkId: 'c3', pageNumber: 15, text: 'បាតុភូតចិត្តរបស់មនុស្សសម្តែងចេញមកខាងក្រៅតាមរយៈទឹកមុខ' },
      { chunkId: 'c4', pageNumber: 20, text: 'សរសៃប្រសាទ និងការទទួលរំញោចឥន្ទ្រីយារម្មណ៍' },
      { chunkId: 'c5', pageNumber: 190, text: 'ឯកសារយោងទំព័រចុងក្រោយ' }
    ];

    const results = retrievalService.retrieveRelevantChunks(sampleChunks, 'សូមបង្កើត Quiz ចាប់ពីទំព័រទី 12 ដល់ 20', null, 5);
    const resultPages = results.map(c => c.pageNumber);
    assert(resultPages.includes(12), 'Should include page 12');
    assert(resultPages.includes(15), 'Should include page 15');
    assert(resultPages.includes(20), 'Should include page 20');
    assert(!resultPages.includes(5), 'Should not include page 5 (outside range)');
    assert(!resultPages.includes(190), 'Should not include page 190 (outside range)');
  });

  console.log(`\n========================================`);
  console.log(`🎯 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
