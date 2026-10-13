/**
 * AI Service
 * Handles communication with Google Gemini API, prompt engineering,
 * document grounded QA, quick actions, citations, and fallback safety.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const aiConfig = require('../config/ai.config');
const retrievalService = require('./retrieval.service');

class AIService {
  /**
   * Get an instance of the Gemini Generative Model with current configuration
   */
  getModel(modelOverride = null) {
    if (!aiConfig.isKeyConfigured()) {
      return null;
    }

    const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
    const modelName = modelOverride || aiConfig.model || 'gemini-3.8-flash';

    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: aiConfig.temperature,
        maxOutputTokens: aiConfig.maxTokens
      }
    });
  }

  /**
   * Answer a question strictly grounded in the PDF document (RAG)
   * @param {Object} params
   * @param {string} params.question - The user query
   * @param {Array} params.chunks - All document chunks
   * @param {number} params.currentPage - Optional current page number
   * @param {string} params.language - 'km', 'en', or 'auto'
   * @param {string} params.scope - 'book' or 'page'
   */
  async askGroundedQuestion({ question, chunks, currentPage = null, language = null, scope = 'book', startPage = null, endPage = null }) {
    const targetLang = language || aiConfig.defaultLanguage || 'km';
    const isWholeBook = scope === 'book' || retrievalService.isWholeBookQuery(question);
    const targetPage = (!isWholeBook && scope === 'page') ? currentPage : null;

    // 1. Retrieve the most relevant passages
    const options = { scope: isWholeBook ? 'book' : scope };
    if (startPage && endPage) {
      options.startPage = Math.min(startPage, endPage);
      options.endPage = Math.max(startPage, endPage);
    }
    const relevantChunks = retrievalService.retrieveRelevantChunks(chunks, question, targetPage, 15, options);
    const contextText = retrievalService.formatContextForPrompt(relevantChunks);
    const pageNumbers = [...new Set(relevantChunks.map(c => c.pageNumber))].sort((a, b) => a - b);

    // If API key is not configured, return clear instructions + local grounded preview
    if (!aiConfig.isKeyConfigured()) {
      return this.generateNoKeyResponse(question, relevantChunks, targetLang);
    }

    // 2. Build system instructions and grounded prompt
    const prompt = this.buildGroundedPrompt({
      question,
      contextText,
      targetLang,
      scope: isWholeBook ? 'book' : scope,
      currentPage: isWholeBook ? null : currentPage,
      relevantPages: pageNumbers
    });

    try {
      const { text: answerText, usedModel } = await this.generateWithRetryAndFallback(prompt);

      // Ensure page citations exist if facts were answered
      return {
        answer: answerText,
        citations: pageNumbers,
        relevantChunksCount: relevantChunks.length,
        model: usedModel,
        grounded: true
      };
    } catch (err) {
      console.error('[AIService Error]:', err.message);
      return this.handleGeminiError(err, targetLang);
    }
  }

  /**
   * Execute a predefined Quick Action (Summarize, Explain, Translate, Define, Q&A, Quiz)
   */
  async executeAction({ action, text, bookTitle = '', pageNumber = null, language = null }) {
    const targetLang = language || aiConfig.defaultLanguage || 'km';

    if (!aiConfig.isKeyConfigured()) {
      return this.generateNoKeyResponseForAction(action, text, pageNumber, targetLang);
    }

    const prompt = this.buildActionPrompt({
      action,
      text,
      bookTitle,
      pageNumber,
      targetLang
    });

    try {
      const { text: answerText, usedModel } = await this.generateWithRetryAndFallback(prompt);
      return {
        answer: answerText,
        action,
        pageNumber,
        model: usedModel,
        success: true
      };
    } catch (err) {
      console.error('[AIService Action Error]:', err.message);
      return this.handleGeminiError(err, targetLang);
    }
  }

  /**
   * Execute generateContent with automatic retry on 503/429 and fallback to healthy alternative models
   */
  /**
   * Execute generateContent with automatic retry on 503/429 and fallback to healthy alternative models
   */
  async generateWithRetryAndFallback(prompt, targetModel = null) {
    const primaryModel = targetModel || aiConfig.model || 'gemini-flash-lite-latest';
    const candidateModels = [
      primaryModel,
      'gemini-flash-lite-latest',
      'gemini-3.7-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.5-flash'
    ];
    const modelsToTry = [...new Set(candidateModels)];

    let lastError = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const model = this.getModel(modelName);
          if (!model) throw new Error('API Key is not configured');

          const result = await this.executeWithTimeout(
            model.generateContent(prompt),
            aiConfig.timeoutMs
          );

          const response = await result.response;
          return {
            text: response.text().trim(),
            usedModel: modelName
          };
        } catch (err) {
          lastError = err;
          const msg = err.message || '';
          const isBusy = msg.includes('503') || msg.includes('high demand') || msg.includes('ResourceExhausted');

          // If temporary 503 service busy, wait 1.2s and retry once
          if (isBusy && attempt === 1) {
            console.log(`[AIService] Transient 503 on ${modelName}, retrying in 1.2s...`);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }

          // If quota exceeded (429) or permanent error, immediately try next model
          console.warn(`[AIService] Model ${modelName} attempt ${attempt} failed: ${msg.split('\n')[0]}. Trying fallback model.`);
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Test API key connectivity by sending a lightweight test prompt
   */
  async testApiKey(apiKeyToTest = null, modelOverride = null) {
    const key = apiKeyToTest || aiConfig.apiKey;
    if (!key || key.trim().length === 0) {
      return { success: false, message: 'សូមបញ្ចូល API Key ជាមុនសិន (Please enter an API Key)' };
    }

    const preferredModel = modelOverride || aiConfig.model || 'gemini-flash-lite-latest';
    const modelsToTry = [preferredModel, 'gemini-flash-lite-latest', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    const genAI = new GoogleGenerativeAI(key);
    let lastError = null;

    for (const modelName of uniqueModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('សួស្តី');
        const response = await result.response;
        const text = response.text();
        return {
          success: true,
          model: modelName,
          message: `ការតភ្ជាប់ទៅកាន់ Google Gemini API (${modelName}) ជោគជ័យ ១០០%!`,
          sampleResponse: text.trim()
        };
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
          break;
        }
      }
    }

    return {
      success: false,
      message: `កំហុសក្នុងការតភ្ជាប់: ${this.translateGeminiError(lastError ? lastError.message : 'Unknown error')}`,
      rawError: lastError ? lastError.message : ''
    };
  }

  /**
   * Construct grounded QA prompt
   */
  buildGroundedPrompt({ question, contextText, targetLang, scope, currentPage, relevantPages }) {
    const isQuizQuery = /quiz|លំហាត់|កម្រងសំណួរ|តេស្ត|mcq|ពហុជ្រើសរើស|ប្រឡង/i.test(question);
    const isTranslateQuery = /បកប្រែ|translate|translation/i.test(question);
    const isExplainOrInterpret = /បកស្រាយ|ពន្យល់|សង្ខេប|ខ្លឹមសារសំខាន់|explain|interpret|summarize|overview/i.test(question);
    const isOverviewQuery = /សៀវភៅនេះទាំងមូល|សៀវភៅទាំងមូល|ទូទាំងសៀវភៅ|គ្រប់ទំព័រ|គ្រប់ជំពូក|whole\s+book|entire\s+book/i.test(question);
    const isSourceKhmer = /[\u1780-\u17FF]/.test(contextText || '');

    let notFoundInstruction = '';
    if (isQuizQuery) {
      notFoundInstruction = targetLang === 'en'
        ? 'For quiz requests, generate comprehensive questions based on the provided text passages. Do not refuse if text passages exist.'
        : 'សម្រាប់សំណើបង្កើត Quiz/លំហាត់៖ ត្រូវទាញយកខ្លឹមសារមេរៀនដែលមានក្នុងអត្ថបទដកស្រង់ខាងក្រោមមកបង្កើតជាលំហាត់ Quiz ដ៏ក្បោះក្បាយជូនអ្នកប្រើប្រាស់ភ្លាម។ ដាច់ខាតកុំបដិសេធថារកមិនឃើញព័ត៌មានឡើយ!';
    } else if (isOverviewQuery || isExplainOrInterpret || isTranslateQuery) {
      notFoundInstruction = '[FAITHFUL TRANSLATION MODE]: សម្រាប់សំណើបកស្រាយ/សង្ខេប/បកប្រែ ឬសួរពីខ្លឹមសារសៀវភៅ៖ ត្រូវទាញយក និងសំយោគខ្លឹមសារសំខាន់ៗដែលមានក្នុងអត្ថបទដកស្រង់ខាងក្រោមមកបកស្រាយ ឆ្លើយតប និងបកប្រែយ៉ាងក្បោះក្បាយ មានរបៀបរៀបរយជូនអ្នកប្រើប្រាស់ភ្លាម។ ដាច់ខាតកុំបដិសេធថារកមិនឃើញព័ត៌មានឡើយ ដរាបណាមានអត្ថបទដកស្រង់!';
    } else {
      notFoundInstruction = targetLang === 'en'
        ? 'If the information cannot be found in the provided document passages, respond EXACTLY: "I cannot find this information in the provided document content."'
        : 'ប្រសិនបើគ្មានព័ត៌មាននៅក្នុងអត្ថបទដែលបានផ្តល់ឱ្យទេ សូមឆ្លើយឱ្យចំតែមួយឃ្លានេះគត់៖ "ខ្ញុំមិនអាចរកឃើញព័ត៌មាននេះនៅក្នុងខ្លឹមសារសៀវភៅដែលបានផ្តល់ឱ្យទេ។" (ដាច់ខាតកុំប្រឌិត ឬបន្ថែមក្រៅពីខ្លឹមសារសៀវភៅឡើយ)';
    }

    let langInstruction = '';
    if (targetLang === 'en') {
      langInstruction = 'Respond strictly in English.';
    } else if (isTranslateQuery) {
      langInstruction = 'គោលការណ៍បកប្រែដាច់ខាត៖ ត្រូវបកប្រែ និងឆ្លើយតបជា «ភាសាខ្មែរ» សុទ្ធសាធ ១០០% ឱ្យបានត្រឹមត្រូវ ពិរោះ រលូន និងងាយយល់ ដើម្បីឱ្យអ្នកប្រើប្រាស់អាចអាន និងស្ដាប់ជាសំឡេងខ្មែរ (Khmer Text-to-Speech) បានយ៉ាងងាយស្រួល។ ដាច់ខាតកុំបកប្រែ ឬឆ្លើយតបជាភាសាអង់គ្លេសឡើយ (រាល់ពាក្យពេចន៍ និងការបកប្រែទាំងអស់ត្រូវតែជាភាសាខ្មែរ ១០០% លើកលែងតែពាក្យដើមបរទេសក្នុងវង់ក្រចកនៃសទ្ទានុក្រម)! រៀបចំជា ២ ផ្នែក៖ (១) ការបកប្រែជាភាសាខ្មែរ (Khmer Translation) ដោយភ្ជាប់លេខទំព័រយោង [ទំព័រ X] និង (២) សទ្ទានុក្រមពាក្យបច្ចេកទេស (Key Terminology)។';
    } else {
      langInstruction = 'គោលការណ៍ភាសាដាច់ខាត៖ ត្រូវឆ្លើយតប បកស្រាយ ពន្យល់ និងសង្ខេបជា «ភាសាខ្មែរ» សុទ្ធសាធ ១០០% ឲ្យបានក្បោះក្បាយ ពិរោះ រលូន មានរបៀបរៀបរយ និងត្រឹមត្រូវតាមក្បួនវេយ្យាករណ៍ខេមរភាសា ដោយដាច់ខាតមិនឆ្លើយតប ឬបកប្រែជាភាសាអង់គ្លេសឡើយ (រាល់ពាក្យបច្ចេកទេសបរទេសត្រូវបកប្រែ និងពន្យល់ជាភាសាខ្មែរ) ដោយភ្ជាប់លេខទំព័រយោង [ទំព័រ X] សម្រាប់ផ្ទៀងផ្ទាត់។';
    }

    const quizInstruction = isQuizQuery
      ? `\n៦. ដោយសារសំណួរទាក់ទងនឹងការបង្កើត Quiz ឬលំហាត់៖
- ប្រសិនបើអ្នកប្រើប្រាស់ស្នើសុំចំនួនច្រើន (ដូចជា ៥០ ឬ ១០០ សំណួរ)៖ ដោយសារទំហំកំណត់នៃការឆ្លើយតប សូមបង្កើតកម្រងលំហាត់ Quiz ពហុជ្រើសរើស (MCQ) សំខាន់ៗបំផុតឱ្យបានយ៉ាងតិច ១៥ ទៅ ២០ សំណួរគត់ (សំណួរទី ១ ដល់ទី ២០) ដោយគ្របដណ្តប់លើគ្រប់មេរៀន/ទំព័រដែលបានដកស្រង់។
- រាល់សំណួរទាំងអស់ត្រូវមានជម្រើស ៤ គឺ ក, ខ, គ, ឃ។
- នៅចុងបញ្ចប់ ដាច់ខាតត្រូវតែមាន "ផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់" ដោយបញ្ជាក់លេខសំណួរ ចម្លើយត្រឹមត្រូវ ការពន្យល់ និងលេខទំព័រយោង [ទំព័រ X] សម្រាប់គ្រប់សំណួរទាំងអស់។
- នៅចុងបញ្ចប់នៃចម្លើយ សូមបន្ថែមចំណាំប្រាប់អ្នកប្រើប្រាស់ថា នេះជាកម្រងលំហាត់ Quiz គំរូដែលដកស្រង់ចេញពីទំព័រទាំងនេះ ហើយអ្នកប្រើប្រាស់អាចស្នើសុំឱ្យ AI បង្កើតបន្តទៀតតាមជំពូកនីមួយៗបាន (ឧទាហរណ៍៖ "សូមបង្កើត ២០ សំណួរទៀតពីទំព័រ ២០ ដល់ ៤០")។`
      : '';

    const overviewInstruction = (isOverviewQuery || (isExplainOrInterpret && scope === 'book'))
      ? `\n៧. ដោយសារសំណួរទាក់ទងនឹងការបកស្រាយ ឬសង្ខេបខ្លឹមសារសៀវភៅទាំងមូល៖
- សូមធ្វើការសំយោគ និងបកស្រាយខ្លឹមសារសំខាន់ៗដែលដកស្រង់ចេញពីគ្រប់ជំពូក/ទំព័រទាំងអស់នៃសៀវភៅនេះ។
- រៀបចំចម្លើយជាផ្នែកៗឱ្យមានរបៀបរៀបរយ (Markdown Headers, Bullet Points) រួមមាន៖ ប្រធានបទធំៗ, ទស្សនទាន ឬទ្រឹស្តីគន្លឹះ, និយមន័យសំខាន់ៗ, និងការសន្និដ្ឋាន។
- ត្រូវភ្ជាប់លេខទំព័រយោង [ទំព័រ X] នៅរាល់ចំណុច ឬកថាខណ្ឌនីមួយៗ។`
      : '';

    return `
អ្នកគឺជាជំនួយការ AI ឆ្លាតវៃសម្រាប់កម្មវិធីអានសៀវភៅ "Khmer AI Book Reader"។
ភារកិច្ចរបស់អ្នកគឺឆ្លើយសំណួររបស់អ្នកប្រើប្រាស់ ដោយផ្អែកលើតែខ្លឹមសារដែលបានដកស្រង់ចេញពីសៀវភៅខាងក្រោមនេះប៉ុណ្ណោះ។

គោលការណ៍តឹងរ៉ឹង៖
១. ផ្អែកលើតែខ្លឹមសារដកស្រង់ពីសៀវភៅ (Passages from PDF) ខាងក្រោម។
២. ${notFoundInstruction}
៣. ដាច់ខាតកុំប្រឌិតព័ត៌មាន ឬយោងទំព័រដែលមិនមានក្នុងឯកសារ។
៤. នៅចុងបញ្ចប់នៃគំនិត ឬចម្លើយនីមួយៗ សូមបញ្ជាក់លេខទំព័រយោងជាទម្រង់ [ទំព័រ X] (ឧទាហរណ៍៖ [ទំព័រ ${relevantPages[0] || 1}])។
៥. ${langInstruction}${quizInstruction}${overviewInstruction}

--- [ខ្លឹមសារដកស្រង់ចេញពីសៀវភៅ / PASSAGES FROM PDF] ---
${contextText}
--- [ចប់ខ្លឹមសារដកស្រង់] ---

សំណួររបស់អ្នកប្រើប្រាស់ (User Question):
"${question}"

សូមផ្តល់ចម្លើយដ៏ក្បោះក្បាយ មានរបៀបរៀបរយ (Markdown) និងភ្ជាប់ជាមួយលេខទំព័រយោង [ទំព័រ X]៖
`.trim();
  }

  /**
   * Construct Action prompt
   */
  buildActionPrompt({ action, text, bookTitle, pageNumber, targetLang }) {
    const isSourceKhmer = /[\u1780-\u17FF]/.test(text || '');

    const langInstruction = targetLang === 'en'
      ? 'Respond strictly in English.'
      : (action === 'translate'
          ? 'គោលការណ៍បកប្រែដាច់ខាត៖ គោលដៅចម្បងនៃកម្មវិធីអានសៀវភៅគឺបកប្រែជា «ភាសាខ្មែរ» ១០០% ឱ្យបានក្បោះក្បាយ ពិរោះ រលូន និងងាយយល់ ដើម្បីឱ្យអ្នកប្រើប្រាស់អាចអាន និងស្ដាប់ជាសំឡេងខ្មែរ (Khmer Text-to-Speech) បានយ៉ាងច្បាស់ល្អ។ ដាច់ខាតមិនបកប្រែ ឬឆ្លើយតបជាភាសាអង់គ្លេសឡើយ (រាល់ពាក្យពេចន៍ និងការបកប្រែទាំងអស់ត្រូវតែជាភាសាខ្មែរ ១០០% លើកលែងតែពាក្យដើមបរទេសក្នុងវង់ក្រចកនៃសទ្ទានុក្រម)។'
          : 'គោលការណ៍ភាសាដាច់ខាត៖ សូមឆ្លើយតបជា «ភាសាខ្មែរ» សុទ្ធសាធ ១០០% ឲ្យបានពិរោះ ត្រឹមត្រូវ និងច្បាស់លាស់ ដោយដាច់ខាតមិនប្រើប្រាស់ភាសាអង់គ្លេសឡើយ។');

    const pageCitation = pageNumber ? ` (ទំព័រទី ${pageNumber})` : '';

    let taskInstruction = '';
    switch (action) {
      case 'summarize':
        taskInstruction = `សូមធ្វើការសង្ខេបខ្លឹមសារខាងក្រោមនេះជាចំណុចសំខាន់ៗ (Bullet Points) ខ្លី ខ្លឹម និងងាយយល់បំផុត${pageCitation}។`;
        break;
      case 'explain':
        taskInstruction = `សូមពន្យល់ខ្លឹមសារខាងក្រោមនេះឲ្យបានស៊ីជម្រៅ ដោយប្រើពាក្យពេចន៍ងាយយល់ និងលើកឧទាហរណ៍ជាក់ស្តែងប្រសិនបើចាំបាច់${pageCitation}។`;
        break;
      case 'translate':
        if (isSourceKhmer) {
          taskInstruction = `សូមធ្វើការបកប្រែ និងសម្រួលអត្ថបទខាងក្រោមនេះជា «ភាសាខ្មែរសម្រាយងាយយល់» (Khmer Translation & Simplification) ឱ្យបានត្រឹមត្រូវ ១០០% តាមន័យដើមនៃសៀវភៅ ដើម្បីឱ្យអ្នកប្រើប្រាស់ងាយស្រួលអាន និងស្ដាប់ជាសំឡេងខ្មែរ (TTS Audio Playback)${pageCitation}។
គោលការណ៍បកប្រែ និងសម្រួលជាភាសាខ្មែរ៖
១. ត្រូវបកប្រែ សម្រួល និងពន្យល់ឃ្លាប្រយោគជា «ភាសាខ្មែរ» ឱ្យបានច្បាស់លាស់ ពិរោះ រលូន និងត្រឹមត្រូវតាមក្បួនខ្នាតភាសាខ្មែរ ដោយកុំប្រើពាក្យកាត់ ឬប្រយោគស្មុគស្មាញ ដើម្បីឱ្យម៉ាស៊ីនអានសំឡេងខ្មែរ (Text-to-Speech) បញ្ចេញសំឡេងបានច្បាស់ និងងាយស្ដាប់យល់។ ដាច់ខាតកុំបកប្រែជាភាសាអង់គ្លេសឡើយ!
២. រក្សាខ្លឹមសារ និងអត្ថន័យដើមនៃសៀវភៅ ១០០% ដោយមិនកាត់បន្ថយ និងមិនប្រឌិត។
៣. រៀបចំលទ្ធផលជាទម្រង់ដូចខាងក្រោម៖
   - 🌐 **ការបកប្រែជាភាសាខ្មែរ (Khmer Translation)**៖ អត្ថបទជាភាសាខ្មែរសម្រាយ ពិរោះ រលូន និងងាយស្រួលស្ដាប់។
   - 📖 **សទ្ទានុក្រមពាក្យបច្ចេកទេស (Key Terminology)**៖ បញ្ជីពាក្យបច្ចេកទេស និងការពន្យល់ន័យជាភាសាខ្មែរ។`;
        } else {
          taskInstruction = `សូមធ្វើការបកប្រែអត្ថបទខាងក្រោមនេះពី «ភាសាបរទេស/អង់គ្លេស» ទៅជា «ភាសាខ្មែរ» (Translation to Khmer) ឱ្យបានត្រឹមត្រូវ ១០០% តាមន័យដើមនៃសៀវភៅ ដើម្បីឱ្យអ្នកប្រើប្រាស់ងាយស្រួលអាន និងស្ដាប់ជាសំឡេងខ្មែរ (TTS Audio Playback)${pageCitation}។
គោលការណ៍បកប្រែជាភាសាខ្មែរ៖
១. ត្រូវបកប្រែប្រយោគ និងកថាខណ្ឌនីមួយៗទៅជា «ភាសាខ្មែរ» ឱ្យបានត្រឹមត្រូវ ១០០% តាមខ្លឹមសារដើមនៃសៀវភៅ ដោយប្រើប្រាស់ពាក្យខ្មែរត្រឹមត្រូវ ពិរោះ និងរលូនល្អសម្រាប់ម៉ាស៊ីនអានសំឡេងខ្មែរ (Text-to-Speech)។ ដាច់ខាតមិនឆ្លើយតបជាភាសាអង់គ្លេសឡើយ!
២. រក្សាពាក្យបច្ចេកទេស និងទស្សនទានឱ្យបានត្រឹមត្រូវតាមបរិបទនៃសៀវភៅ។
៣. រៀបចំលទ្ធផលជាទម្រង់ដូចខាងក្រោម៖
   - 🌐 **ការបកប្រែជាភាសាខ្មែរ (Khmer Translation)**៖ អត្ថបទបកប្រែជាភាសាខ្មែរពេញលេញ ក្បោះក្បាយ និងពិរោះងាយស្ដាប់។
   - 📖 **សទ្ទានុក្រមពាក្យបច្ចេកទេស (Key Terminology)**៖ បញ្ជីពាក្យបច្ចេកទេសសំខាន់ៗ (ភាសាដើម = ភាសាខ្មែរ) ដើម្បីងាយស្រួលផ្ទៀងផ្ទាត់។`;
        }
        break;
      case 'define':
        taskInstruction = `សូមស្រង់ពាក្យពិបាកៗ ពាក្យគន្លឹះ ឬពាក្យបច្ចេកទេសក្នុងអត្ថបទខាងក្រោម រួចពន្យល់និយមន័យនៃពាក្យនីមួយៗតាមបរិបទនៃសៀវភៅ${pageCitation}។`;
        break;
      case 'generate_qa':
        taskInstruction = `សូមបង្កើតសំណួរ និងចម្លើយចំនួន ៤ ទៅ ៥ គូ ដែលផ្តោតលើចំណុចសំខាន់ៗនៃអត្ថបទខាងក្រោម${pageCitation}។`;
        break;
      case 'generate_quiz':
        taskInstruction = `សូមបង្កើតលំហាត់ពហុជ្រើសរើស (Multiple Choice Questions) យ៉ាងតិចចំនួន ១០ សំណួរ (យ៉ាងតិច ១០ សំណួរឡើងទៅ) ចេញពីអត្ថបទខាងក្រោម${pageCitation}។
រាល់សំណួរទាំងអស់ត្រូវគោរពតាមទម្រង់ដូចខាងក្រោមជាដាច់ខាត៖
១. ផ្នែកសំណួរ (Questions): ត្រូវបង្កើតឱ្យបានយ៉ាងតិច ១០ សំណួរគត់ (ពីសំណួរទី ១ ដល់សំណួរទី ១០ ឬលើសពីនេះ)។ សំណួរនីមួយៗត្រូវសរសេរឱ្យច្បាស់លាស់ និងមានជម្រើស ៤ គឺ ក, ខ, គ, ឃ។
២. ផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់ (Answer Key & Explanations): នៅចុងបញ្ចប់ ដាច់ខាតត្រូវតែមានផ្នែកនេះ ដោយបញ្ជាក់ឱ្យបានគ្រប់ទាំង ១០ សំណួរទាំងអស់៖
   - លេខសំណួរ និងអក្សរចម្លើយត្រឹមត្រូវ (ឧទាហរណ៍៖ សំណួរទី ១ ៖ ចម្លើយត្រឹមត្រូវគឺ "...", សំណួរទី ២ ៖ ...)
   - ការពន្យល់សង្ខេបអំពីមូលហេតុដែលចម្លើយនោះត្រឹមត្រូវ
   - យោងលេខទំព័រដែលជាប្រភពនៃចម្លើយជាទម្រង់ [ទំព័រ X]។`;
        break;
      case 'summarize_chapter':
        taskInstruction = `សូមធ្វើការវិភាគ និងសង្ខេបជំពូក ឬផ្នែកនេះ ដោយបង្ហាញពីប្រធានបទធំៗ និងសារសំខាន់នៃខ្លឹមសារ${pageCitation}។`;
        break;
      default:
        taskInstruction = `សូមវិភាគ និងពន្យល់ខ្លឹមសារខាងក្រោមនេះ${pageCitation}។`;
    }

    return `
អ្នកគឺជាអ្នកជំនាញអានសៀវភៅ និងជាគ្រូបង្រៀន AI ភាសាខ្មែរ។
${taskInstruction}
${langInstruction}

--- [អត្ថបទសៀវភៅ / TEXT FROM BOOK${bookTitle ? ` "${bookTitle}"` : ''}] ---
${text}
--- [ចប់អត្ថបទ] ---

សូមបង្ហាញលទ្ធផលជាទម្រង់ Markdown ស្អាតបាត និងងាយស្រួលអាន៖
`.trim();
  }

  /**
   * Timeout execution wrapper
   */
  executeWithTimeout(promise, timeoutMs) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`សំណើ AI លើសកំណត់ពេលវេលា (${timeoutMs / 1000} វិនាទី)`);
        error.code = 'AI_TIMEOUT';
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutHandle);
    });
  }

  /**
   * Format friendly error when Gemini throws an exception
   */
  handleGeminiError(err, targetLang) {
    const raw = err.message || '';
    let userMsg = '';

    if (raw.includes('503') || raw.includes('high demand')) {
      userMsg = 'សេវា Google Gemini កំពុងមានអ្នកប្រើប្រាស់ច្រើនក្នុងពេលតែមួយ (503 High Demand)។ សូមរង់ចាំប្រហែល ៥ ទៅ ១០ វិនាទី រួចចុចសួរម្តងទៀត ឬប្តូរម៉ូឌែលទៅ Gemini 3.7 Flash ក្នុង Settings (⚙️)។';
    } else if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
      userMsg = 'Google Gemini API Key មិនត្រឹមត្រូវទេ។ សូមពិនិត្យ ឬបញ្ចូល API Key ថ្មីក្នុង Settings (⚙️)។';
    } else if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('Quota')) {
      userMsg = 'កូតាប្រើប្រាស់ Google Gemini API ពេញហើយ (Quota Exceeded)។ សូមរង់ចាំបន្តិច ឬប្រើប្រាស់ API Key ផ្សេង។';
    } else if (err.code === 'AI_TIMEOUT') {
      userMsg = 'ការឆ្លើយតបរបស់ AI យឺតពេល (Timeout)។ សូមព្យាយាមសួរម្តងទៀត។';
    } else {
      userMsg = `មានបញ្ហាតភ្ជាប់ទៅកាន់សេវា AI: ${this.translateGeminiError(raw)}`;
    }

    return {
      error: userMsg,
      error_en: raw,
      success: false,
      answer: `⚠️ **កំហុសបច្ចេកទេស AI:**\n${userMsg}`
    };
  }

  translateGeminiError(rawMsg) {
    if (/network|fetch failed|ENOTFOUND/i.test(rawMsg)) {
      return 'បរាជ័យក្នុងការតភ្ជាប់អ៊ីនធឺណិតទៅកាន់ Google API';
    }
    if (/invalid/i.test(rawMsg)) {
      return 'ទិន្នន័យ ឬកូនសោ API Key មិនត្រឹមត្រូវ';
    }
    return rawMsg;
  }

  /**
   * Friendly fallback when user hasn't supplied an API key yet
   */
  generateNoKeyResponse(question, relevantChunks, targetLang) {
    const pages = [...new Set(relevantChunks.map(c => c.pageNumber))].sort((a, b) => a - b);
    const pagesList = pages.length > 0 ? pages.map(p => `[ទំព័រ ${p}]`).join(', ') : '[ទំព័រ ១]';
    const topSnippet = relevantChunks[0] ? relevantChunks[0].text.substring(0, 300) : 'មិនមានខ្លឹមសារដកស្រង់';

    const answer = `
> 🔔 **សេចក្តីជូនដំណឹងអំពី API Key:**
> អ្នកមិនទាន់បានកំណត់ **Google Gemini API Key** នៅឡើយទេ។
> ដើម្បីឱ្យ AI ឆ្លើយតបបានឆ្លាតវៃ និងស្វ័យប្រវត្ត ១០០% សូមចុចលើ **Settings (រូបកង់ធ្មេញ ⚙️)** នៅរបារខាងលើ រួចបញ្ចូល Gemini API Key របស់អ្នក (ឥតគិតថ្លៃពីរ [Google AI Studio](https://aistudio.google.com/))។

---

### 📖 ខ្លឹមសារពាក់ព័ន្ធដែលដកស្រង់ចេញពីសៀវភៅសម្រាប់សំណួររបស់អ្នក៖
**សំណួរ:** *"${question}"*  
**ឯកសារយោង:** ${pagesList}

**អត្ថបទដកស្រង់:**
> "${topSnippet}..."
`.trim();

    return {
      answer,
      citations: pages,
      needsApiKey: true,
      grounded: true
    };
  }

  generateNoKeyResponseForAction(action, text, pageNumber, targetLang) {
    const pageRef = pageNumber ? `[ទំព័រ ${pageNumber}]` : '';
    const answer = `
> 🔔 **សេចក្តីជូនដំណឹងអំពី API Key:**
> មុខងារ AI នេះត្រូវការ **Google Gemini API Key**។
> សូមចុចលើ **Settings (រូបកង់ធ្មេញ ⚙️)** នៅខាងលើស្តាំ ដើម្បីបញ្ចូល API Key របស់អ្នកដោយឥតគិតថ្លៃពីរ [Google AI Studio](https://aistudio.google.com/)។

---

### 📄 អត្ថបទដែលបានជ្រើសរើស ${pageRef}:
> ${text.substring(0, 350)}...
`.trim();

    return {
      answer,
      action,
      pageNumber,
      needsApiKey: true
    };
  }
}

const aiService = new AIService();
module.exports = aiService;
