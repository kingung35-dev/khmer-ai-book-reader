/**
 * Upload Middleware
 * Handles secure file uploads for PDF documents with size, MIME, and filename sanitization.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'books');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 50 MB limit
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique ID prefix
    const uniqueId = uuidv4();
    
    // Decode original name properly if encoded
    let originalName = file.originalname;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      // keep original
    }

    // Clean filename: allow Khmer unicode (\u1780-\u17FF), English letters, digits, dots, hyphens, underscores
    const safeBaseName = originalName
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[^\w\s\u1780-\u17FF.-]/g, '_')
      .trim()
      .substring(0, 80) || 'document';

    const safeFilename = `${uniqueId}_${safeBaseName}.pdf`;
    cb(null, safeFilename);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  // Accept only PDF files
  if (ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
    cb(null, true);
  } else {
    const error = new Error('ឯកសារត្រូវតែជាប្រភេទ PDF ប៉ុណ្ណោះ (Only PDF files are allowed)');
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter
});

module.exports = upload;
