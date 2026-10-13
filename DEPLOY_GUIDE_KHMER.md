# 📖 មគ្គុទ្ទេសក៍ដាក់បង្ហោះកម្មវិធីលើ Cloud (Render.com) ដើម្បីប្រើលើទូរស័ព្ទដៃ ១០០% ឥតគិតថ្លៃ

ឯកសារនេះណែនាំលោកអ្នកពីរបៀបដាក់បង្ហោះ (Deploy) កម្មវិធី **Khmer AI Book Reader** ទៅកាន់ Cloud Server (Render.com) ដើម្បីឱ្យលោកអ្នកអាចយកទូរស័ព្ទដៃ (iPhone ឬ Android) បើកអាន និងដំឡើងជា App ប្រើបានគ្រប់ទីកន្លែងតាម 4G/5G ឬ Wi-Fi ដោយមិនចាំបាច់បើកកុំព្យូទ័រ Mac ចោលឡើយ។

---

## ជំហានទី ១៖ បង្កើត Repository លើ GitHub

1. បើកគេហទំព័រ [github.com](https://github.com) រួចចូលគណនីរបស់អ្នក (Log in)។
2. ចុចសញ្ញា **«+»** នៅខាងលើស្តាំ រួចរើស **«New repository»**។
3. ដាក់ឈ្មោះ Repository: `khmer-ai-book-reader`
4. ជ្រើសរើស **Private** (ឬ Public) រួចចុចប៊ូតុង **«Create repository»**។
5. បញ្ជូនកូដពីកុំព្យូទ័រ Mac របស់អ្នកទៅកាន់ GitHub ដោយបើក Terminal ក្នុងថត `កម្មវិធីអានសៀវភៅ` រួចវាយពាក្យបញ្ជាខាងក្រោម៖

```bash
git init
git add .
git commit -m "Initial commit of Khmer AI Book Reader"
git branch -M main
git remote add origin https://github.com/<ឈ្មោះ_GITHUB_របស់អ្នក>/khmer-ai-book-reader.git
git push -u origin main
```
*(ជំនួស `<ឈ្មោះ_GITHUB_របស់អ្នក>` ដោយ Username របស់លោកអ្នក)*

---

## ជំហានទី ២៖ ដាក់បង្ហោះលើ Render.com (ឥតគិតថ្លៃ ១០០%)

1. ចូលទៅកាន់គេហទំព័រ [render.com](https://render.com)។
2. ចុច **«Sign in with GitHub»** ដើម្បីភ្ជាប់គណនី GitHub របស់អ្នក។
3. នៅលើផ្ទាំង Dashboard ចុចប៊ូតុង **«New +»** ➔ ជ្រើសរើស **«Web Service»**។
4. ជ្រើសរើស Repository `khmer-ai-book-reader` ដែលលោកអ្នកទើបតែ Push ទៅកាន់ GitHub។
5. បំពេញព័ត៌មានដូចខាងក្រោម៖
   - **Name:** `khmer-ai-book-reader` (ឬឈ្មោះណាមួយដែលលោកអ្នកពេញចិត្ត)
   - **Region:** `Singapore` (សម្រាប់ល្បឿនលឿននៅកម្ពុជា)
   - **Runtime:** `Docker` (ប្រព័ន្ធបានរៀបចំ `Dockerfile` ស្រាប់ដែលមាន Poppler + Tesseract Khmer OCR)
   - **Instance Type:** `Free`
6. នៅផ្នែក **Environment Variables** (អថេរប្រព័ន្ធ) ចុច **«Add Environment Variable»**៖
   - Key: `GEMINI_API_KEY`
   - Value: បិទភ្ជាប់ (Paste) Google Gemini API Key របស់លោកអ្នក
7. ចុចប៊ូតុង **«Deploy Web Service»** នៅខាងក្រោម។

---

## ជំហានទី ៣៖ ទទួលបាន Link និងដំឡើងលើទូរស័ព្ទដៃ

រង់ចាំប្រហែល ២ ទៅ ៣ នាទី នៅពេលដំណើរការចប់ Render នឹងផ្តល់ Link ផ្លូវការមួយដល់លោកអ្នក (ឧទាហរណ៍៖ `https://khmer-ai-book-reader.onrender.com`)។

### 📱 របៀបដំឡើងលើ iPhone (iOS Safari):
1. បើកកម្មវិធី **Safari** លើ iPhone រួចចូលទៅកាន់ Link របស់លោកអ្នក (ឧ. `https://khmer-ai-book-reader.onrender.com`)។
2. ចុចប៊ូតុង **Share (📤)** នៅរបារខាងក្រោមនៃ Safari។
3. អូសចុះក្រោមបន្តិច រួចចុចលើ **«Add to Home Screen (បន្ថែមទៅអេក្រង់ដើម)»**។
4. ចុច **«Add (បន្ថែម)»** នៅខាងលើស្តាំ។
5. រូបសញ្ញា App **Khmer AI Reader** 🇰🇭 នឹងបង្ហាញនៅលើអេក្រង់ទូរស័ព្ទរបស់អ្នក។ ពេលចុចបើក វានឹងដំណើរការពេញអេក្រង់ (Full Screen) ដូច Native App ពិតៗ!

### 📱 របៀបដំឡើងលើ Android (Google Chrome):
1. បើកកម្មវិធី **Chrome** លើទូរស័ព្ទ Android រួចចូលទៅកាន់ Link ខាងលើ។
2. ចុចលើសញ្ញាចុចបី **(⋮)** នៅខាងលើស្តាំ។
3. ជ្រើសរើស **«Install app (ដំឡើងកម្មវិធី)»** ឬ **«Add to Home screen»**។
4. ចុច **«Install»** — កម្មវិធីនឹងដំឡើងចូលទៅក្នុងបញ្ជី App លើទូរស័ព្ទដៃរបស់អ្នកភ្លាមៗ!

---

## 🎉 អត្ថប្រយោជន៍ក្រោយពេល Deploy លើ Cloud:
- ✅ **ប្រើបានគ្រប់ទីកន្លែង:** ប្រើបានទាំងលើទូរស័ព្ទដៃ កុំព្យូទ័រ iPad តាម 4G/5G ឬ Wi-Fi។
- ✅ **មិនបាច់បើក Mac ចោល:** កម្មវិធីដំណើរការលើ Cloud Server ២៤ម៉ោង/៧ថ្ងៃ។
- ✅ **គាំទ្រ Khmer OCR & Gemini AI:** ដំណើរការស្រង់អក្សរ និង AI ឆ្លើយសំណួរ/Quiz បានយ៉ាងរលូន។
- ✅ **រក្សាទិន្នន័យបានល្អ:** សៀវភៅ និងការកំណត់ផ្សេងៗអាចចូលអានបានគ្រប់ពេលវេលា។
