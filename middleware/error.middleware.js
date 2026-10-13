/**
 * Error Middleware
 * Centralized error handler providing user-friendly Khmer and English messages.
 */

const multer = require('multer');

function errorMiddleware(err, req, res, next) {
  console.error('[Error Logger]', {
    message: err.message,
    code: err.code,
    status: err.status || 500,
    path: req.originalUrl
  });

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'ទំហំឯកសារធំពេក (អតិបរមា 50MB)',
        error_en: 'File size exceeds limit (Max 50MB)',
        code: 'LIMIT_FILE_SIZE'
      });
    }
    return res.status(400).json({
      success: false,
      error: `កំហុសក្នុងការផ្ទុកឡើងឯកសារ: ${err.message}`,
      error_en: `Upload error: ${err.message}`,
      code: err.code
    });
  }

  // Handle invalid file type
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: err.message || 'ឯកសារត្រូវតែជាប្រភេទ PDF ប៉ុណ្ណោះ',
      error_en: 'Only PDF files are supported',
      code: 'INVALID_FILE_TYPE'
    });
  }

  const statusCode = err.status || 500;
  const khmerMessage = err.khmerMessage || 'មានបញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធ សូមព្យាយាមម្តងទៀត';
  
  res.status(statusCode).json({
    success: false,
    error: khmerMessage,
    error_en: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
}

module.exports = errorMiddleware;
