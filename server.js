/**
 * Khmer AI Book Reader — កម្មវិធីអានសៀវភៅ PDF ជាភាសាខ្មែរ
 * Express Application Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const bookRoutes = require('./routes/book.routes');
const aiRoutes = require('./routes/ai.routes');
const settingsRoutes = require('./routes/settings.routes');
const ttsRoutes = require('./routes/tts.routes');
const errorMiddleware = require('./middleware/error.middleware');
const pdfService = require('./services/pdf.service');

// Ensure all storage directories exist
['storage', 'storage/books', 'storage/metadata', 'storage/temp'].forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

const os = require('os');

// Helper to get local Wi-Fi / LAN IP address for mobile devices
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Security & Parsing Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/books', bookRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tts', ttsRoutes);

// Mobile & Local Network Information Endpoint
app.get('/api/network-info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    success: true,
    localUrl: `http://localhost:${PORT}`,
    mobileUrl: `http://${localIp}:${PORT}`,
    localIp,
    port: PORT
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Khmer AI Book Reader',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root fallback to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);

// Initialize Sample Book and start server
async function startServer() {
  const samplePdfPath = path.join(__dirname, 'storage', 'books', 'sample-khmer.pdf');
  if (fs.existsSync(samplePdfPath)) {
    try {
      console.log('📚 Pre-indexing sample Khmer book...');
      const metadata = await pdfService.processPdf('sample-khmer', samplePdfPath);
      metadata.title = 'ស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀន (គំរូសៀវភៅខ្មែរ)';
      metadata.lastReadPage = 1;
      pdfService.saveMetadata('sample-khmer', metadata);
      console.log(`✅ Sample book indexed: ${metadata.totalPages} pages, ${metadata.chunks.length} chunks.`);
    } catch (err) {
      console.warn('⚠️ Sample book indexing deferred:', err.message);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log('====================================================');
    console.log(`🚀 Khmer AI Book Reader is running!`);
    console.log(`💻 Mac / Local:        http://localhost:${PORT}`);
    console.log(`📱 Mobile (Phone/LAN):  http://${localIp}:${PORT}`);
    console.log(`🇰🇭 កម្មវិធីអានសៀវភៅ PDF ជាភាសាខ្មែរ ត្រៀមរួចរាល់`);
    console.log('====================================================');
  });
}

startServer();

module.exports = app;
