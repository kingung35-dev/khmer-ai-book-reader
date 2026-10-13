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
  async askGroundedQuestion({ question, chunks, currentPage = null, language = null, scope = 'book' }) {
    const targetLang = language || aiConfig.defaultLanguage || 'km';
    const targetPage = scope === 'page' ? currentPage : null;

    // 1. Retrieve the most relevant passages
    const relevantChunks = retrievalService.retrieveRelevantChunks(chunks, question, targetPage);
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
      scope,
      currentPage,
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
    const langInstruction = targetLang === 'en'
      ? 'Respond strictly in English.'
      : 'សូមឆ្លើយតបជាភាសាខ្មែរសុទ្ធសាធ ១០០% ឲ្យបានក្បោះក្បាយ ពិរោះ និងត្រឹមត្រូវតាមក្បួនវេយ្យាករណ៍ខេមរភាសា ដោយដាច់ខាតមិនប្រើប្រាស់ភាសាអង់គ្លេសឡើយ (រាល់ពាក្យបច្ចេកទេសត្រូវបកប្រែ និងពន្យល់ជាភាសាខ្មែរ)។';

    const isQuizQuery = /quiz|លំហាត់|កម្រងសំណួរ|តេស្ត|mcq|ពហុជ្រើសរើស|ប្រឡង/i.test(question);

    const notFoundInstruction = isQuizQuery
      ? (targetLang === 'en'
          ? 'For quiz requests, generate comprehensive questions based on the provided text passages. Do not refuse if text passages exist.'
          : 'សម្រាប់សំណើបង្កើត Quiz/លំហាត់៖ ត្រូវទាញយកខ្លឹមសារមេរៀនដែលមានក្នុងអត្ថបទដកស្រង់ខាងក្រោមមកបង្កើតជាលំហាត់ Quiz ដ៏ក្បោះក្បាយជូនអ្នកប្រើប្រាស់ភ្លាម។ ដាច់ខាតកុំបដិសេធថារកមិនឃើញព័ត៌មានឡើយ!')
      : (targetLang === 'en'
          ? 'If the information cannot be found in the provided document passages, respond EXACTLY: "I cannot find this information in the provided document content."'
          : 'ប្រសិនបើគ្មានព័ត៌មាននៅក្នុងអត្ថបទដែលបានផ្តល់ឱ្យទេ សូមឆ្លើយឱ្យចំតែមួយឃ្លានេះគត់៖ "ខ្ញុំមិនអាចរកឃើញព័ត៌មាននេះនៅក្នុងខ្លឹមសារសៀវភៅដែលបានផ្តល់ឱ្យទេ។" (ដាច់ខាតកុំប្រឌិត ឬបន្ថែមក្រៅពីខ្លឹមសារសៀវភៅឡើយ)');

    const quizInstruction = isQuizQuery
      ? `\n៦. ដោយសារសំណួរទាក់ទងនឹងការបង្កើត Quiz ឬលំហាត់៖
- ប្រសិនបើអ្នកប្រើប្រាស់ស្នើសុំចំនួនច្រើន (ដូចជា ៥០ ឬ ១០០ សំណួរ)៖ ដោយសារទំហំកំណត់នៃការឆ្លើយតប សូមបង្កើតកម្រងលំហាត់ Quiz ពហុជ្រើសរើស (MCQ) សំខាន់ៗបំផុតឱ្យបានយ៉ាងតិច ១៥ ទៅ ២០ សំណួរគត់ (សំណួរទី ១ ដល់ទី ២០) ដោយគ្របដណ្តប់លើគ្រប់មេរៀន/ទំព័រដែលបានដកស្រង់។
- រាល់សំណួរទាំងអស់ត្រូវមានជម្រើស ៤ គឺ ក, ខ, គ, ឃ។
- នៅចុងបញ្ចប់ ដាច់ខាតត្រូវតែមាន "ផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់" ដោយបញ្ជាក់លេខសំណួរ ចម្លើយត្រឹមត្រូវ ការពន្យល់ និងលេខទំព័រយោង [ទំព័រ X] សម្រាប់គ្រប់សំណួរទាំងអស់។
- នៅចុងបញ្ចប់នៃចម្លើយ សូមបន្ថែមចំណាំប្រាប់អ្នកប្រើប្រាស់ថា នេះជាកម្រងលំហាត់ Quiz គំរូដែលដកស្រង់ចេញពីទំព័រទាំងនេះ ហើយអ្នកប្រើប្រាស់អាចស្នើសុំឱ្យ AI បង្កើតបន្តទៀតតាមជំពូកនីមួយៗបាន (ឧទាហរណ៍៖ "សូមបង្កើត ២០ សំណួរទៀតពីទំព័រ ២០ ដល់ ៤០")។`
      : '';

    return `
អ្នកគឺជាជំនួយការ AI ឆ្លាតវៃសម្រាប់កម្មវិធីអានសៀវភៅ "Khmer AI Book Reader"។
ភារកិច្ចរបស់អ្នកគឺឆ្លើយសំណួររបស់អ្នកប្រើប្រាស់ ដោយផ្អែកលើតែខ្លឹមសារដែលបានដកស្រង់ចេញពីសៀវភៅខាងក្រោមនេះប៉ុណ្ណោះ។

គោលការណ៍តឹងរ៉ឹង៖
១. ផ្អែកលើតែខ្លឹមសារដកស្រង់ពីសៀវភៅ (Passages from PDF) ខាងក្រោម។
២. ${notFoundInstruction}
៣. ដាច់ខាតកុំប្រឌិតព័ត៌មាន ឬយោងទំព័រដែលមិនមានក្នុងឯកសារ។
៤. នៅចុងបញ្ចប់នៃគំនិត ឬចម្លើយនីមួយៗ សូមបញ្ជាក់លេខទំព័រយោងជាទម្រង់ [ទំព័រ X] (ឧទាហរណ៍៖ [ទំព័រ ${relevantPages[0] || 1}])។
៥. ${langInstruction}${quizInstruction}

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
    const langInstruction = targetLang === 'en'
      ? 'Respond strictly in English.'
      : 'សូមឆ្លើយតបជាភាសាខ្មែរសុទ្ធសាធ ១០០% ឲ្យបានពិរោះ ត្រឹមត្រូវ និងច្បាស់លាស់ ដោយមិនប្រើប្រាស់ភាសាអង់គ្លេសឡើយ។';

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
        taskInstruction = targetLang === 'en'
          ? 'Please translate the following text into natural, accurate English.'
          : 'សូមបកប្រែអត្ថបទខាងក្រោមនេះទៅជាភាសាខ្មែរដ៏ត្រឹមត្រូវ ពិរោះ និងរក្សាអត្ថន័យដើម១០០%។';
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
