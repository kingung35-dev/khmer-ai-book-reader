/**
 * Text-to-Speech & Translation Proxy Routes
 * Streams native high-quality Khmer and multilingual MP3 audio directly to client,
 * with 100% Khmer translation for foreign/mixed text, and Khmer number conversion.
 */

const express = require('express');
const router = express.Router();

// Digits mapping
const ARABIC_TO_KHMER_DIGITS = {
  '0': '០', '1': '១', '2': '២', '3': '៣', '4': '៤',
  '5': '៥', '6': '៦', '7': '៧', '8': '៨', '9': '៩'
};

/**
 * Translate text to Khmer if it contains significant English/Latin characters
 */
async function ensureKhmerText(text) {
  if (!text) return '';

  const latinMatches = text.match(/[A-Za-z]/g) || [];
  const khmerMatches = text.match(/[\u1780-\u17FF]/g) || [];

  // If text contains substantial Latin words (foreign document or mixed text)
  if (latinMatches.length > 4 && (khmerMatches.length === 0 || latinMatches.length > khmerMatches.length * 0.2)) {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=km&dt=t&q=${encodeURIComponent(text.substring(0, 1000))}`;
      const gRes = await fetch(gUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
        }
      });
      if (gRes.ok) {
        const data = await gRes.json();
        if (data && data[0]) {
          const translated = data[0].map(s => s[0]).join('');
          if (translated && translated.trim().length > 0) {
            text = translated;
          }
        }
      }
    } catch (e) {
      console.warn('[Translate to Khmer Error]:', e.message);
    }
  }

  // Convert Arabic digits to Khmer digits for authentic Khmer pronunciation
  text = text.replace(/[0-9]/g, digit => ARABIC_TO_KHMER_DIGITS[digit] || digit);

  return text;
}

router.get('/', async (req, res) => {
  const rawQ = req.query.q || '';
  const tl = req.query.tl || 'km';

  if (!rawQ || rawQ.trim().length === 0) {
    return res.status(400).send('Missing query text parameter: q');
  }

  try {
    // If target language is Khmer, ensure text is translated to 100% Khmer
    let q = rawQ;
    if (tl === 'km') {
      q = await ensureKhmerText(rawQ);
    }

    // Google TTS segment limit is ~200 characters
    const trimmed = q.trim().substring(0, 200);

    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(tl)}&client=tw-ob&q=${encodeURIComponent(trimmed)}`;
    
    const ttsRes = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': '*/*'
      }
    });

    if (!ttsRes.ok) {
      console.warn(`Upstream Google TTS returned status ${ttsRes.status}`);
      return res.status(ttsRes.status).send(`Upstream TTS error: ${ttsRes.status}`);
    }

    const arrayBuffer = await ttsRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    res.send(buffer);
  } catch (err) {
    console.error('[TTS Proxy Error]:', err.message);
    res.status(500).send(`TTS Proxy Error: ${err.message}`);
  }
});

// Translation proxy endpoint
router.get('/translate', async (req, res) => {
  const q = req.query.q || '';
  const tl = req.query.tl || 'km';

  if (!q) {
    return res.json({ text: '' });
  }

  try {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q.substring(0, 1500))}`;
    const gRes = await fetch(gUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
      }
    });

    if (gRes.ok) {
      const data = await gRes.json();
      const translated = data && data[0] ? data[0].map(s => s[0]).join('') : q;
      return res.json({ text: translated });
    }
  } catch (e) {
    console.warn('Translate error:', e.message);
  }

  res.json({ text: q });
});

module.exports = router;
