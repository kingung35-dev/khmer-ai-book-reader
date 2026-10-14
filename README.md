# Khmer AI Book Reader — កម្មវិធីអានសៀវភៅ PDF ជាភាសាខ្មែរ

កម្មវិធីអានសៀវភៅ PDF កម្រិតអាជីព បំពាក់ដោយបច្ចេកវិទ្យា AI ជំនាន់ចុងក្រោយ **Google Gemini (Gemini 3.8 Flash / 1.5 Pro)** ដែលត្រូវបានរចនាឡើងយ៉ាងយកចិត្តទុកដាក់សម្រាប់ឯកសារភាសាខ្មែរ (Khmer Unicode), ភាសាអង់គ្លេស, ឯកសារចម្រុះ, និងឯកសារស្កេនរូបភាព (OCR)។

---

## 🌟 លក្ខណៈពិសេសចម្បង (Key Features)

### ១. បណ្ណាល័យសៀវភៅ PDF (Book Library)
* **ផ្ទុកឡើងឯកសារ PDF (Upload)**: គាំទ្រការ Upload និង Drag & Drop ឯកសារ PDF ទំហំរហូតដល់ 50MB។
* **ការគ្រប់គ្រងសៀវភៅ (Book Management)**: បង្ហាញចំណងជើង, ទំហំឯកសារ, ចំនួនទំព័រ, ស្ថានភាពឯកសារស្កេន (Scanned badge) និងកាលបរិច្ឆេទ។
* **ស្វែងរក & តម្រៀប (Search & Filter)**: ស្វែងរកតាមចំណងជើង និងតម្រៀបតាមកាលបរិច្ឆេទ, អក្ខរក្រម, ឬចំនួនទំព័រ។
* **ចងចាំទំព័រអានចុងក្រោយ (Reading Progress)**: រក្សាទុកទំព័រដែលបានអានចុងក្រោយដោយស្វ័យប្រវត្ត។

### ២. កម្មវិធីអាន PDF កម្រិតអាជីព (Professional PDF Reader)
* **ការបង្ហាញច្បាស់កម្រិតខ្ពស់ (Retina Canvas Rendering)**: ដំណើរការដោយ Mozilla PDF.js ផ្តល់នូវភាពច្បាស់ 100% លើគ្រប់អេក្រង់។
* **ស្រទាប់អត្ថបទអន្តរកម្ម (Interactive Text Layer)**: អូស Highlight អក្សរខ្មែរលើ PDF ដើម្បីចម្លង ឬចុចលើ Menu អណ្តែត **«✨ សួរ AI»**, **«📝 សង្ខេប»**, **«💡 ពន្យល់»**, **«🌐 បកប្រែ»**, **«📖 ពាក្យពិបាក»**។
* **ទម្រង់អានចម្រុះ (View Modes)**: គាំទ្រទាំង Single Page Mode និង Continuous Vertical Scroll Mode។
* **ប្រព័ន្ធពង្រីក/បង្រួម (Smart Zoom)**: Fit Width, Fit Page, Auto, និងកម្រិតពី 50% ដល់ 200%។
* **ស្វែងរកក្នុងឯកសារ (In-Document Search)**: ស្វែងរកអត្ថបទក្នុង PDF ជាមួយការ Highlight និងរំកិលទៅកាន់ពាក្យបន្ទាប់/មុន។
* **ចំណាំទំព័រ (Bookmarks)**: ចុច Bookmark ទំព័រណាមួយ និងអាចចុចត្រឡប់មកវិញភ្លាមៗពី Sidebar។
* **រូបភាពតូចៗនៃទំព័រ (Page Thumbnails)**: បង្ហាញទំព័រតូចៗទាំងអស់ក្នុង Sidebar ដើម្បីចុចរំលងទំព័របានរហ័ស។

### ៣. ជំនួយការ AI ឆ្លាតវៃ (AI Reading Assistant with Grounding & RAG)
* **ការឆ្លើយតបផ្អែកលើតែខ្លឹមសារសៀវភៅ (Strict Document Grounding)**: AI ឆ្លើយតបដោយដកស្រង់ចេញពីសៀវភៅជាក់ស្តែង មិនប្រឌិតព័ត៌មានឡើយ។
* **ការបញ្ជាក់លេខទំព័រយោងអន្តរកម្ម (Interactive Page Citations)**: រាល់ពេល AI ឆ្លើយ ចម្លើយនឹងភ្ជាប់ជាមួយស្លាកលេខទំព័រដូចជា `[ទំព័រ ៥]`។ **ចុចលើស្លាកនោះ នោះកម្មវិធីអាននឹងរំកិលទៅទំព័រទី ៥ ដោយស្វ័យប្រវត្តិ!**
* **ឃ្លាការពារ (Strict Guardrail)**: ប្រសិនបើសៀវភៅគ្មានព័ត៌មាននោះ AI នឹងឆ្លើយយ៉ាងច្បាស់៖ *"ខ្ញុំមិនអាចរកឃើញព័ត៌មាននេះនៅក្នុងខ្លឹមសារសៀវភៅដែលបានផ្តល់ឱ្យទេ។"*
* **សកម្មភាពរហ័ស (Quick Actions)**:
  1. 📝 សង្ខេបទំព័រនេះ (Summarize Page)
  2. 💡 ពន្យល់ខ្លឹមសារ (Explain Content)
  3. 🌐 បកប្រែ (Translate)
  4. 📖 ពន្យល់ពាក្យពិបាក (Define Technical Terms)
  5. ❓ បង្កើតសំណួរ-ចម្លើយ (Generate Q&A)
  6. 🎯 លំហាត់ Quiz MCQ (Create Multiple Choice Quiz)
  7. 🔍 សង្ខេបជំពូក (Summarize Chapter)
* **សំឡេងអានជាភាសាខ្មែរធម្មជាតិ (High-Fidelity Khmer Text-to-Speech)**: ដំណើរការដោយ Local Streaming Audio Proxy (`/api/tts`) ចាក់សំឡេង MP3 ភាសាខ្មែរយ៉ាងច្បាស់ ១០០% ដោយគ្មានបញ្ហាស្ងាត់សំឡេងលើ macOS/iOS ឡើយ។ គាំទ្រទាំងការអានចម្លើយ AI, អត្ថបទដែលបាន Highlight, និងការអានទំព័រសៀវភៅទាំងមូល (ប៊ូតុង 🔊 នៅ Toolbar ខាងលើ)។

### ៤. ការគាំទ្រឯកសារស្កេនរូបភាព (Khmer OCR)
* រកឃើញទំព័រដែលជាប្រភេទរូបភាពស្កេន (Scanned Page) ដោយស្វ័យប្រវត្តិ។
* ផ្តល់នូវប៊ូតុង **«🔍 ស្កេនអក្សរខ្មែរ (OCR)»** ដោយប្រើប្រាស់ Tesseract OCR ជាមួយ Khmer Language Model (`khm+eng`) រួចបញ្ចូលអត្ថបទទៅក្នុង RAG Index ភ្លាមៗ។

---

## 🛠️ រចនាសម្ព័ន្ធគម្រោង (Project Architecture)

```
khmer-ai-book-reader/
├── package.json               # Dependencies & scripts
├── .env.example               # Environment template
├── .env                       # Local secrets (ignored by git)
├── .gitignore                 # Excluded directories
├── README.md                  # Complete documentation
├── server.js                  # Express backend entry point
├── config/
│   └── ai.config.js           # Secure AI settings & key masking
├── routes/
│   ├── ai.routes.js           # AI Q&A and actions endpoints
│   ├── book.routes.js         # Library and reader endpoints
│   └── settings.routes.js     # System settings & connectivity tests
├── controllers/
│   ├── ai.controller.js       # AI request dispatching
│   ├── book.controller.js     # Book CRUD, PDF streaming, OCR
│   └── settings.controller.js # Settings management & key testing
├── services/
│   ├── ai.service.js          # Google Gemini API & prompt engineering
│   ├── pdf.service.js         # PDF text extraction & Khmer normalizer
│   ├── ocr.service.js         # Tesseract OCR & Poppler rendering
│   └── retrieval.service.js   # RAG BM25/n-gram retrieval engine
├── middleware/
│   ├── upload.middleware.js   # PDF sanitization & 50MB file upload
│   └── error.middleware.js    # Centralized bilingual error handling
├── public/
│   ├── index.html             # Accessible semantic HTML5 layout
│   ├── css/
│   │   └── styles.css         # Modern design tokens, Dark/Light modes
│   ├── js/
│   │   ├── app.js             # Bootstrap, shortcuts, theme toggle
│   │   ├── pdf-reader.js      # PDF.js rendering & canvas controls
│   │   ├── ai-assistant.js    # AI chat, citations, actions & TTS
│   │   ├── library.js         # Library management & upload dropzone
│   │   └── settings.js        # API key modal & live test
│   └── libs/
│       ├── marked.min.js      # Local markdown parser
│       └── pdfjs/
│           ├── pdf.min.js     # Local Mozilla PDF.js core
│           └── pdf.worker.min.js
├── storage/
│   ├── books/                 # Saved PDF documents
│   ├── metadata/              # Extracted chunks & reading progress
│   └── temp/                  # Temporary OCR image buffer
├── scripts/
│   └── generateSamples.js     # Sample Khmer book initializer
└── tests/
    └── run-tests.js           # Automated unit & integration test suite
```

---

## 🚀 របៀបដំឡើង និងដំណើរការ (Quick Start)

### ១. លក្ខខណ្ឌតម្រូវ (Prerequisites)
* **Node.js**: v18.0.0 ឬខ្ពស់ជាងនេះ (បានតេស្តលើ Node v25.6.1)
* **Tesseract OCR** (ស្រេចចិត្ត សម្រាប់ឯកសារស្កេន): `brew install tesseract tesseract-lang poppler`

### ២. ការដំឡើង Dependencies
```bash
cd "កម្មវិធីអានសៀវភៅ"
npm install
```

### ៣. ការកំណត់ Google Gemini API Key
អ្នកអាចកំណត់ API Key តាមវិធីពីរយ៉ាង៖
1. **តាមរយៈ `.env` ឯកសារ**:
   ```bash
   cp .env.example .env
   # បើក .env ហើយបញ្ចូល GEMINI_API_KEY របស់អ្នក
   ```
2. **ឬបញ្ចូលតាមរយៈ Settings ក្នុងផ្ទាំងកម្មវិធីផ្ទាល់ (UI)**:
   ចុចលើរូបកង់ធ្មេញ **⚙️ Settings** នៅខាងស្តាំដៃខាងលើ រួចបញ្ចូល Key និងចុចសាកល្បង **«សាកល្បងតភ្ជាប់ (Test)»**។
   *(អ្នកអាចបង្កើត API Key ដោយឥតគិតថ្លៃពីរ [Google AI Studio](https://aistudio.google.com/))*

### ៤. ដំណើរការកម្មវិធី (1-Click Run)

* **លើ Windows**:
  - **ចុចពីរដង (Double-Click)** លើឯកសារ 👉 **`start.bat`** (កម្មវិធីនឹងបើក Browser ទៅកាន់ `http://localhost:3000` ស្វ័យប្រវត្តិ)
  - សម្រាប់ Update: **ចុចពីរដង** លើ 👉 **`update.bat`**
  - មើលការណែនាំលម្អិតក្នុង៖ [WINDOWS_INSTALL_GUIDE.md](file:///Users/sythatom/Desktop/កម្មវិធីអានសៀវភៅ/WINDOWS_INSTALL_GUIDE.md)

* **លើ macOS**:
  - **ចុចពីរដង (Double-Click)** លើឯកសារ 👉 **`start.command`**
  - សម្រាប់ Update: **ចុចពីរដង** លើ 👉 **`update.command`**

* **ឬតាមរយៈ Terminal / Command Prompt**:
```bash
# ដំណើរការ Server
npm start

# ឬសម្រាប់ Development Mode (Auto-restart)
npm run dev
```

បើកកម្មវិធីរុករក (Browser) របស់អ្នកទៅកាន់៖
👉 **`http://localhost:3000`**

---

## 🧪 ការដំណើរការតេស្តស្វ័យប្រវត្តិ (Automated Testing)

ដើម្បីផ្ទៀងផ្ទាត់កូដ ដំណើរការស្រង់អក្សរខ្មែរ ប្រព័ន្ធ RAG និងសុវត្ថិភាព API Key សូមដំណើរការ៖

```bash
npm test
```

លទ្ធផលតេស្ត៖
* ✅ Khmer Text Normalization (ជួសជុលជើងអក្សរដែលដាច់ និងលុប ZWSP)
* ✅ PDF Chunking (បែងចែកបំណែកអត្ថបទតាមទំព័រ)
* ✅ Khmer-English Tokenization (ការកាត់ n-grams សម្រាប់ពាក្យខ្មែរ)
* ✅ RAG Retrieval (ការស្វែងរក និងផ្តល់ពិន្ទុអត្ថបទដែលពាក់ព័ន្ធ)
* ✅ Security & API Key Masking (ធានាថាកូនសោសម្ងាត់មិនបែកធ្លាយទៅ Frontend)
* ✅ Grounding Prompt Strictness (ធានាថា AI មិនប្រឌិតព័ត៌មាន)

---

## 🔒 សុវត្ថិភាព និងឯកជនភាព (Security & Privacy)

1. **គ្មានការបង្ហាញ API Key ទៅកាន់ Frontend**: API Key ត្រូវបានរក្សាទុកតែនៅលើ Server-side ប៉ុណ្ណោះ។
2. **ការត្រួតពិនិត្យឯកសារតឹងរ៉ឹង**: ឯកសារត្រូវតែមាន MIME Type `application/pdf` និងកន្ទុយ `.pdf` ដោយកំណត់ទំហំអតិបរមា 50MB។
3. **ការសម្អាតឈ្មោះឯកសារ (Filename Sanitization)**: ការពារ Directory Traversal Attacks។
4. **មិនបញ្ជូនទិន្នន័យក្រៅពីការសាកសួរ**: ឯកសារត្រូវបានរក្សាទុកក្នុងកុំព្យូទ័ររបស់អ្នក (Local Storage)។ តែបំណែកអត្ថបទដែលពាក់ព័ន្ធនឹងសំណួររបស់អ្នកប៉ុណ្ណោះដែលត្រូវបានផ្ញើទៅកាន់ Gemini API ដើម្បីបង្កើតចម្លើយ។

---

## ❓ ដោះស្រាយបញ្ហាទូទៅ (Troubleshooting)

| បញ្ហា | មូលហេតុ | ដំណោះស្រាយ |
|---|---|---|
| AI ឆ្លើយថាត្រូវការ API Key | មិនទាន់បានបញ្ចូល Gemini Key | ចុច Settings (⚙️) រួចបញ្ចូល API Key ពី Google AI Studio |
| Quota Exceeded (429) | គណនី Free Tier ដល់កម្រិតកំណត់ | រង់ចាំ ១ នាទី ឬប្តូរទៅប្រើ Gemini 3.8 Flash |
| ទំព័របង្ហាញគ្មានអក្សរ | សៀវភៅជាប្រភេទរូបភាពស្កេន | ចុចលើផ្ទាំងលឿងខាងលើ «🔍 ស្កេនអក្សរខ្មែរ (OCR)» |
| អក្សរខ្មែររញ៉េរញ៉ៃលើ PDF ដើម | PDF ដើមប្រើ Custom Legacy Fonts គ្មាន Unicode CMap | ប្រើប៊ូតុង OCR ដើម្បីស្គាល់ជាអក្សរខ្មែរ Unicode ថ្មី |
