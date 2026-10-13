/**
 * Sample Generator & Importer Script
 * Automatically sets up sample books in storage/books and indexes them.
 */

const fs = require('fs');
const path = require('path');
const pdfService = require('../services/pdf.service');

const BOOKS_DIR = path.join(__dirname, '..', 'storage', 'books');
const DESKTOP_DIR = path.join(process.env.HOME || '/Users/sythatom', 'Desktop');

async function setupSamples() {
  console.log('🚀 Checking and setting up sample Khmer books...');

  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  }

  // Check if sample-khmer.pdf exists
  const targetSample = path.join(BOOKS_DIR, 'sample-khmer.pdf');
  const desktopSource = path.join(DESKTOP_DIR, 'ស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀន.pdf');

  if (!fs.existsSync(targetSample) && fs.existsSync(desktopSource)) {
    console.log('📋 Copying sample Khmer book from Desktop...');
    fs.copyFileSync(desktopSource, targetSample);
  }

  if (fs.existsSync(targetSample)) {
    console.log('🔍 Indexing sample book for Khmer AI Reader...');
    try {
      const metadata = await pdfService.processPdf('sample-khmer', targetSample, true);
      metadata.title = 'ស្តង់ដាវិជ្ជាជីវៈគ្រូបង្រៀន (គំរូសៀវភៅខ្មែរ)';
      metadata.lastReadPage = 1;
      pdfService.saveMetadata('sample-khmer', metadata);
      console.log(`✅ Success! Indexed ${metadata.totalPages} pages with ${metadata.chunks.length} chunks.`);
    } catch (err) {
      console.error('❌ Indexing failed:', err.message);
    }
  } else {
    console.log('ℹ️ No sample PDF found to copy.');
  }
}

setupSamples().then(() => {
  console.log('✨ Setup complete.');
});
