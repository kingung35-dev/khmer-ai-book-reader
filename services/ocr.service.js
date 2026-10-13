/**
 * OCR Service
 * Performs Khmer & English OCR for scanned PDF pages using Poppler pdftoppm and Tesseract OCR.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const TEMP_DIR = path.join(__dirname, '..', 'storage', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class OcrService {
  constructor() {
    this.tesseractPath = this.resolveBinary(process.env.TESSERACT_PATH, 'tesseract');
    this.pdftoppmPath = this.resolveBinary(process.env.PDFTOPPM_PATH, 'pdftoppm');
    this.languages = process.env.OCR_LANGUAGES || 'khm+eng';
    this.isAvailable = null;
  }

  resolveBinary(configuredPath, name) {
    if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;
    const candidates = [
      configuredPath,
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      name
    ].filter(Boolean);
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return configuredPath || name;
  }

  /**
   * Check if OCR tools are installed and operational
   */
  async checkAvailability() {
    if (this.isAvailable !== null) return this.isAvailable;

    try {
      await execPromise(`"${this.tesseractPath}" --version`);
      await execPromise(`"${this.pdftoppmPath}" -v`);
      this.isAvailable = true;
    } catch (err) {
      console.warn('[OCR Service] Tesseract or pdftoppm not detected at configured paths:', err.message);
      this.isAvailable = false;
    }
    return this.isAvailable;
  }

  /**
   * Run OCR on a specific page of a PDF document
   * @param {string} pdfPath - Full path to PDF file
   * @param {number} pageNumber - 1-based page number
   * @returns {Promise<string>} Recognized text
   */
  async ocrPage(pdfPath, pageNumber) {
    const available = await this.checkAvailability();
    if (!available) {
      throw new Error('សេវា OCR មិនមាននៅលើម៉ាស៊ីនបម្រើនេះទេ (OCR tools are not available on this server)');
    }

    const timestamp = Date.now();
    const prefix = path.join(TEMP_DIR, `ocr_${timestamp}_p${pageNumber}`);

    try {
      // 1. Render specific page to PNG image using pdftoppm (150 DPI is optimal for speed & accuracy)
      const renderCmd = `"${this.pdftoppmPath}" -png -r 150 -f ${pageNumber} -l ${pageNumber} "${pdfPath}" "${prefix}"`;
      await execPromise(renderCmd);

      // Find generated PNG image file (pdftoppm may append -1.png or -01.png or -001.png)
      const tempFiles = fs.readdirSync(TEMP_DIR);
      const generatedImg = tempFiles.find(f => f.startsWith(`ocr_${timestamp}_p${pageNumber}`) && f.endsWith('.png'));

      if (!generatedImg) {
        throw new Error(`មិនអាចបង្កើតរូបភាពទំព័រ ${pageNumber} សម្រាប់ OCR បានទេ`);
      }

      const imgPath = path.join(TEMP_DIR, generatedImg);

      // 2. Run Tesseract OCR with Khmer and English language models
      const ocrCmd = `"${this.tesseractPath}" "${imgPath}" stdout -l ${this.languages} --psm 6 2>/dev/null`;
      const { stdout } = await execPromise(ocrCmd);

      // Clean up temporary image
      try {
        fs.unlinkSync(imgPath);
      } catch (e) {
        // ignore
      }

      // 3. Post-process and normalize Khmer OCR text
      const cleaned = this.cleanOcrText(stdout);
      return cleaned;
    } catch (err) {
      console.error(`[OCR Error on page ${pageNumber}]:`, err.message);
      throw err;
    }
  }

  /**
   * Run OCR on multiple pages (or all scanned pages)
   * @param {string} pdfPath
   * @param {number[]} pageNumbers - Array of 1-based page numbers
   * @param {Function} onProgress - Optional callback(current, total)
   */
  async ocrPages(pdfPath, pageNumbers, onProgress = null) {
    const results = [];
    for (let i = 0; i < pageNumbers.length; i++) {
      const pNum = pageNumbers[i];
      try {
        const text = await this.ocrPage(pdfPath, pNum);
        results.push({ pageNumber: pNum, text, success: true });
      } catch (err) {
        results.push({ pageNumber: pNum, text: '', success: false, error: err.message });
      }
      if (onProgress) {
        onProgress(i + 1, pageNumbers.length);
      }
    }
    return results;
  }

  /**
   * Normalize and sanitize OCR text for Khmer language
   */
  cleanOcrText(rawText) {
    if (!rawText) return '';
    return rawText
      // Remove control characters except newline and tab
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove redundant spaces between Khmer characters
      .replace(/([\u1780-\u17D3])\s+([\u17B6-\u17D3])/g, '$1$2')
      // Fix coeng ligature split
      .replace(/\u17D2\s+([\u1780-\u17A2])/g, '\u17D2$1')
      // Trim empty lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
}

const ocrService = new OcrService();
module.exports = ocrService;
