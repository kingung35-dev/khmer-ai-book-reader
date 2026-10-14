# 🇰🇭 សៀវភៅណែនាំការដំណើរការ Khmer AI Book Reader លើ Windows

ឯកសារណែនាំនេះនឹងជួយលោកអ្នកក្នុងការបើកដំណើរការកម្មវិធី **Khmer AI Book Reader** នៅលើប្រព័ន្ធប្រតិបត្តិការ **Windows 10 / Windows 11** ដោយងាយស្រួលបំផុតត្រឹមតែ **១ ចុច (1-Click)**។

---

## 📋 តម្រូវការប្រព័ន្ធ (Requirements)

1. **ប្រព័ន្ធប្រតិបត្តិការ**៖ Windows 10 ឬ Windows 11 (64-bit)
2. **Node.js**៖ កំណែ LTS (v18, v20 ឬថ្មីជាងនេះ)
   - ទាញយកឥតគិតថ្លៃពី៖ **[https://nodejs.org/](https://nodejs.org/)**
   - ពេលដំឡើង សូមចុច `Next` រហូតដល់ចប់។
3. **Git (សម្រាប់ធ្វើ Update)**៖ 
   - ទាញយកឥតគិតថ្លៃពី៖ **[https://git-scm.com/](https://git-scm.com/)**

---

## 🚀 របៀបបើកដំណើរការកម្មវិធី (Start on Windows)

1. ចូលទៅកាន់ Folder នៃកម្មវិធី `កម្មវិធីអានសៀវភៅ`
2. **ចុចពីរដង (Double-Click)** លើឯកសារ៖
   👉 **`start.bat`**
3. កម្មវិធីនឹងរៀបចំប្រព័ន្ធស្វ័យប្រវត្តិ ហើយបើក Browser (Chrome/Edge) ទៅកាន់អាសយដ្ឋាន `http://localhost:3000` ដោយស្វ័យប្រវត្តិ!

> 💡 **ចំណាំ**៖ ប្រសិនបើទើបតែបើកដំបូងបង្អស់ កម្មវិធីនឹងធ្វើការដំឡើង dependencies (`npm install`) ដោយស្វ័យប្រវត្តិតែម្តងគត់។

---

## 🔄 របៀបធ្វើបច្ចុប្បន្នភាព (1-Click Update on Windows)

នៅពេលលោកអ្នកបានកែសម្រួល ឬចង់ Push កំណែថ្មីទៅកាន់ Cloud (Render / GitHub)៖
1. **ចុចពីរដង (Double-Click)** លើឯកសារ៖
   👉 **`update.bat`**
2. វាយបញ្ចូលចំណាំនៃការ Update (ឬចុច Enter យកទូទៅ)
3. ប្រព័ន្ធនឹងធ្វើការ Bump Version ស្វ័យប្រវត្តិ រួច Commit និង Push ទៅកាន់ GitHub & Render.com ភ្លាមៗ!

---

## 🔍 (ជម្រើសបន្ថែម) ការដំឡើង Tesseract OCR លើ Windows សម្រាប់ទំព័រស្កេន

ប្រសិនបើសៀវភៅរបស់លោកអ្នកជាសៀវភៅស្កេន (Scanned PDF) ឬពុម្ពអក្សរបុរាណ ហើយលោកអ្នកចង់ឱ្យម៉ាស៊ីន Windows ស្រង់អក្សរខ្មែរដោយផ្ទាល់៖

1. ទាញយក Tesseract Installer សម្រាប់ Windows ពី៖
   👉 **[UB-Mannheim Tesseract OCR for Windows](https://github.com/UB-Mannheim/tesseract/wiki)**
2. ពេលដំឡើង នៅក្នុងផ្ទាំង **"Choose Components"** -> សូមពន្លាត **"Additional script data"** -> ធីកយក **"Khmer script"** និង **"Khmer language"**។
3. ទីតាំងដំឡើងតាមលំនាំដើមគឺ៖ `C:\Program Files\Tesseract-OCR`
   (កម្មវិធី Khmer AI Book Reader បានរៀបចំផ្លូវស្វែងរកទីតាំងនេះរួចជាស្រេចដោយស្វ័យប្រវត្តិ)។

---

## 🌐 ប្រើប្រាស់នៅលើទូរស័ព្ទដៃតាមរយៈ Wi-Fi តែមួយ

នៅពេល `start.bat` កំពុងដំណើរការនៅលើកុំព្យូទ័រ Windows៖
1. បើកទូរស័ព្ទដៃដែលភ្ជាប់ Wi-Fi ដូចគ្នាជាមួយកុំព្យូទ័រ
2. វាយអាសយដ្ឋាន IP របស់កុំព្យូទ័រ (ឧទាហរណ៍៖ `http://192.168.1.X:3000`) នោះលោកអ្នកអាចអាន និងស្ដាប់សៀវភៅលើទូរស័ព្ទដៃបានភ្លាមៗ!
