/**
 * Book Audio Player Module — កម្មវិធីចាក់សំឡេងអានសៀវភៅច្បាប់ដើម
 * Provides seamless audio narration of the original book PDF pages with:
 * - Natural Khmer text-to-speech synthesis (100% Khmer voice)
 * - Real-time spoken sentence highlighting & transcription
 * - Play/Pause, Stop, Next/Prev Sentence, Next/Prev Page controls
 * - Continuous auto-advance across pages (reads whole chapters/books automatically)
 * - Audio playback speed control (0.8x, 1.0x, 1.2x)
 * - Automatic OCR & server text retrieval fallback
 */

class BookAudioPlayer {
  constructor() {
    this.container = document.getElementById('book-audio-player');
    this.bookTitleEl = document.getElementById('bap-book-title');
    this.pageIndicatorEl = document.getElementById('bap-page-indicator');
    this.toggleAutoplay = document.getElementById('bap-toggle-autoplay');
    this.btnClose = document.getElementById('bap-btn-close');
    this.progressInfoEl = document.getElementById('bap-progress-info');
    this.statusTextEl = document.getElementById('bap-status-text');
    this.currentSentenceEl = document.getElementById('bap-current-sentence');
    this.waveWrap = document.querySelector('.bap-icon-wave');

    this.btnPrevPage = document.getElementById('bap-btn-prev-page');
    this.btnPrevSentence = document.getElementById('bap-btn-prev-sentence');
    this.btnPlayPause = document.getElementById('bap-btn-play-pause');
    this.playIconEl = document.getElementById('bap-play-icon');
    this.playTextEl = document.getElementById('bap-play-text');
    this.btnStop = document.getElementById('bap-btn-stop');
    this.btnNextSentence = document.getElementById('bap-btn-next-sentence');
    this.btnNextPage = document.getElementById('bap-btn-next-page');
    this.selectSpeed = document.getElementById('bap-select-speed');

    // Header & Mobile trigger buttons
    this.btnHeaderRead = document.getElementById('btn-read-page-aloud');
    this.btnMobileRead = document.getElementById('btn-mobile-read-aloud');

    // State
    this.isPlaying = false;
    this.isPaused = false;
    this.currentBookId = null;
    this.currentBookTitle = '';
    this.currentPage = 1;
    this.totalPages = 1;
    this.sentences = [];
    this.sentenceIndex = 0;
    this.speed = 1.0;
    this.autoAdvance = true;
    this.audio = null;
    this.isLoading = false;

    this.initEvents();
  }

  initEvents() {
    this.btnPlayPause?.addEventListener('click', () => this.togglePlayPause());
    this.btnStop?.addEventListener('click', () => this.stop());
    this.btnClose?.addEventListener('click', () => this.close());

    this.btnPrevSentence?.addEventListener('click', () => this.prevSentence());
    this.btnNextSentence?.addEventListener('click', () => this.nextSentence());
    this.btnPrevPage?.addEventListener('click', () => this.prevPage());
    this.btnNextPage?.addEventListener('click', () => this.nextPage());

    this.toggleAutoplay?.addEventListener('change', () => {
      this.autoAdvance = Boolean(this.toggleAutoplay.checked);
    });

    this.selectSpeed?.addEventListener('change', () => {
      this.setSpeed(parseFloat(this.selectSpeed.value) || 1.0);
    });

    // Header and mobile button triggers
    this.btnHeaderRead?.addEventListener('click', () => this.startReadingCurrentPage());
    this.btnMobileRead?.addEventListener('click', () => this.startReadingCurrentPage());
  }

  /**
   * Split original book text into natural Khmer sentences (max 130 chars for smooth TTS)
   */
  splitKhmerSentences(rawText) {
    if (!rawText) return [];

    let cleaned = rawText
      .replace(/\[(?:ទំព័រ|ទំព័រទី|Page)\s*\d+\]/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_#`>~]/g, '')
      .replace(/[\uFEFF\u200B\u200E\u200F]/g, '')
      .replace(/\r\n/g, '\n')
      .trim();

    // Split on Khmer full stops (។, ៕), question/exclamation marks, or newlines
    const rawParts = cleaned.split(/(?<=[។៕!?\n])/);
    const chunks = [];

    for (const part of rawParts) {
      const s = part.trim();
      if (!s || s.length === 0) continue;

      if (s.length <= 130) {
        chunks.push(s);
      } else {
        // Sub-split longer sentences on commas, semicolons, colons, or whitespace
        const subParts = s.split(/(?<=[,;:\s])/);
        let curr = '';
        for (const piece of subParts) {
          if ((curr + piece).length > 130 && curr.length > 0) {
            chunks.push(curr.trim());
            curr = piece;
          } else {
            curr += piece;
          }
        }
        if (curr.trim().length > 0) {
          chunks.push(curr.trim());
        }
      }
    }

    return chunks;
  }

  /**
   * Start reading current page of active book
   */
  async startReadingCurrentPage() {
    const book = window.pdfReader?.currentBook;
    const pageNum = window.pdfReader?.currentPage || 1;

    if (!book) {
      window.showToast('សូមជ្រើសរើសសៀវភៅមួយជាមុនសិន', 'error');
      return;
    }

    // If currently playing on this exact page, toggle play/pause
    if (this.isPlaying && this.currentBookId === book.id && this.currentPage === pageNum) {
      this.togglePlayPause();
      return;
    }

    await this.loadPageAndPlay(book.id, pageNum, true);
  }

  /**
   * Load clean text of specified page and start playback
   */
  async loadPageAndPlay(bookId, pageNumber, autoStart = true) {
    const book = window.pdfReader?.currentBook;
    this.currentBookId = bookId;
    this.currentBookTitle = book?.title || 'សៀវភៅ';
    this.currentPage = pageNumber;
    this.totalPages = book?.totalPages || window.pdfReader?.totalPages || 1;

    // Open player UI
    this.showPlayerUI();
    this.updateHeaderActiveState(true);

    if (this.bookTitleEl) this.bookTitleEl.textContent = this.currentBookTitle;
    if (this.pageIndicatorEl) this.pageIndicatorEl.textContent = `ទំព័រទី ${this.currentPage} / ${this.totalPages}`;
    if (this.statusTextEl) this.statusTextEl.textContent = `កំពុងស្រង់អត្ថបទពីទំព័រទី ${this.currentPage}...`;
    if (this.currentSentenceEl) this.currentSentenceEl.textContent = 'កំពុងទាញយកខ្លឹមសារច្បាប់ដើមនៃសៀវភៅ...';
    if (this.progressInfoEl) this.progressInfoEl.textContent = 'ទំព័រដើម';

    this.stopAudio();
    this.isLoading = true;

    if (!this.pageTextCache) {
      this.pageTextCache = {};
    }

    let pageText = '';
    let isOcr = false;

    // 1. Check local in-memory cache first (instant 0ms)
    const cacheKey = `${bookId}_p${this.currentPage}`;
    if (this.pageTextCache[cacheKey]) {
      pageText = this.pageTextCache[cacheKey];
    }

    // 2. Fast Client-side PDF.js extraction (takes ~5-15ms, skips slow server OCR)
    if (!pageText && window.pdfReader?.pdfDoc) {
      try {
        const page = await window.pdfReader.pdfDoc.getPage(this.currentPage);
        if (page) {
          const textContent = await page.getTextContent();
          const items = textContent.items || [];
          if (items.length > 0) {
            const rawClientText = items.map(s => s.str).join(' ').trim();
            // If page has real content, use it immediately!
            if (rawClientText.length >= 15) {
              pageText = rawClientText;
              this.pageTextCache[cacheKey] = pageText;
            }
          }
        }
      } catch (clientErr) {
        console.warn('[BookAudioPlayer] Fast client text extraction error:', clientErr.message);
      }
    }

    // 3. Fallback to server endpoint with 7s timeout (only for pure scanned pages)
    if (!pageText || pageText.trim().length < 10) {
      if (this.statusTextEl) {
        this.statusTextEl.textContent = `កំពុងស្រង់អក្សរពី Server (ទំព័រទី ${this.currentPage})...`;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/page/${this.currentPage}/text`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.text && data.text.trim().length > 0) {
            pageText = data.text;
            isOcr = data.isOcr;
            this.pageTextCache[cacheKey] = pageText;
            if (data.title) this.currentBookTitle = data.title;
            if (data.totalPages) this.totalPages = data.totalPages;
          }
        }
      } catch (e) {
        console.warn('[BookAudioPlayer] Server page text fetch fallback:', e.message);
      }
    }

    this.isLoading = false;

    // Check if page truly has no text (e.g. blank page or illustration)
    if (!pageText || pageText.trim().length < 5) {
      if (this.currentSentenceEl) {
        this.currentSentenceEl.innerHTML = `<em>ទំព័រទី ${this.currentPage} គ្មានខ្លឹមសារអត្ថបទសម្រាប់អានទេ (ទំព័រទទេ ឬរូបភាពគំនូរ)</em>`;
      }
      if (this.statusTextEl) this.statusTextEl.textContent = 'គ្មានអត្ថបទ';

      // If auto-advance is enabled and not at the last page, skip to next page after 1.2s
      if (this.autoAdvance && this.currentPage < this.totalPages) {
        window.showToast(`ទំព័រទី ${this.currentPage} គ្មានអក្សរទេ កំពុងរំលងទៅទំព័រទី ${this.currentPage + 1}...`, 'info');
        setTimeout(() => {
          if (this.isPlaying || this.container.style.display !== 'none') {
            this.nextPage();
          }
        }, 1200);
      } else {
        window.showToast(`ទំព័រទី ${this.currentPage} គ្មានអក្សរស្រង់ស្រាប់ទេ`, 'info');
        this.resetPlayButton();
      }
      return;
    }

    // Prefetch next page text in background so next page starts instantly!
    this.prefetchNextPage(bookId, this.currentPage + 1);

    // Split page text into sentences
    this.sentences = this.splitKhmerSentences(pageText);

    if (this.sentences.length === 0) {
      if (this.currentSentenceEl) this.currentSentenceEl.textContent = 'មិនអាចបំបែកជាឃ្លាអានបានទេ។';
      return;
    }

    if (this.bookTitleEl) this.bookTitleEl.textContent = this.currentBookTitle;
    if (this.pageIndicatorEl) this.pageIndicatorEl.textContent = `ទំព័រទី ${this.currentPage} / ${this.totalPages}`;

    this.sentenceIndex = 0;
    if (autoStart) {
      this.playSentence(0);
    } else {
      this.currentSentenceEl.textContent = this.sentences[0];
      this.progressInfoEl.textContent = `ប្រយោគ ១ / ${this.sentences.length}`;
      this.statusTextEl.textContent = 'ត្រៀមខ្លួនអាន';
      this.resetPlayButton();
    }
  }

  /**
   * Play specific sentence by index
   */
  playSentence(index) {
    if (index < 0 || index >= this.sentences.length) {
      this.handlePageFinished();
      return;
    }

    this.stopAudio();
    if (window.aiAssistant) {
      window.aiAssistant.stopSpeaking();
    }

    this.sentenceIndex = index;
    this.isPlaying = true;
    this.isPaused = false;

    const sentence = this.sentences[this.sentenceIndex];

    // Update UI elements
    if (this.progressInfoEl) {
      this.progressInfoEl.textContent = `ប្រយោគ ${this.sentenceIndex + 1} / ${this.sentences.length}`;
    }
    if (this.statusTextEl) {
      this.statusTextEl.textContent = 'កំពុងអាន...';
    }
    if (this.currentSentenceEl) {
      this.currentSentenceEl.innerHTML = `<span class="bap-highlighted-text">«${this.escapeHtml(sentence)}»</span>`;
    }

    this.setPlayingState(true);

    // Stream native Khmer TTS audio
    const url = `/api/tts?tl=km&q=${encodeURIComponent(sentence)}`;
    this.audio = new Audio(url);
    this.audio.playbackRate = this.speed;

    // Pre-cache next sentence audio in background for seamless flow
    if (this.sentenceIndex + 1 < this.sentences.length) {
      const nextSentence = this.sentences[this.sentenceIndex + 1];
      const nextAudio = new Audio(`/api/tts?tl=km&q=${encodeURIComponent(nextSentence)}`);
      nextAudio.preload = 'auto';
    }

    this.audio.onended = () => {
      this.handleSentenceEnded();
    };

    this.audio.onerror = (err) => {
      console.warn('[BookAudioPlayer] Audio chunk error, moving to next:', err);
      setTimeout(() => this.handleSentenceEnded(), 400);
    };

    this.audio.play().catch(err => {
      console.warn('[BookAudioPlayer] Audio play interrupted:', err);
    });
  }

  handleSentenceEnded() {
    if (!this.isPlaying) return;

    if (this.sentenceIndex + 1 < this.sentences.length) {
      this.playSentence(this.sentenceIndex + 1);
    } else {
      this.handlePageFinished();
    }
  }

  handlePageFinished() {
    if (this.statusTextEl) this.statusTextEl.textContent = `ចប់ការអានទំព័រទី ${this.currentPage}`;
    this.setPlayingState(false);

    // Auto-advance to next page if enabled
    if (this.autoAdvance && this.currentPage < this.totalPages) {
      const nextPageNum = this.currentPage + 1;
      if (this.statusTextEl) this.statusTextEl.textContent = `កំពុងប្តូរទៅទំព័រទី ${nextPageNum}...`;

      // Smoothly navigate PDF reader to next page
      if (window.pdfReader) {
        window.pdfReader.goToPage(nextPageNum);
      }

      // Small pause before reading next page
      setTimeout(() => {
        if (this.isPlaying || this.container.style.display !== 'none') {
          this.loadPageAndPlay(this.currentBookId, nextPageNum, true);
        }
      }, 700);
    } else {
      window.showToast(`បានអានចប់ទំព័រទី ${this.currentPage} នៃសៀវភៅ!`, 'success');
      this.resetPlayButton();
      this.updateHeaderActiveState(false);
    }
  }

  togglePlayPause() {
    if (!this.isPlaying && this.sentences.length === 0) {
      this.startReadingCurrentPage();
      return;
    }

    if (this.audio) {
      if (this.isPaused) {
        this.audio.play();
        this.isPaused = false;
        this.isPlaying = true;
        this.setPlayingState(true);
        if (this.statusTextEl) this.statusTextEl.textContent = 'កំពុងអាន...';
      } else {
        this.audio.pause();
        this.isPaused = true;
        this.setPlayingState(false);
        if (this.statusTextEl) this.statusTextEl.textContent = 'បានផ្អាក';
        if (this.playIconEl) this.playIconEl.textContent = '▶️';
        if (this.playTextEl) this.playTextEl.textContent = 'បន្ត';
      }
    } else {
      if (this.sentences.length > 0) {
        this.playSentence(this.sentenceIndex || 0);
      } else {
        this.startReadingCurrentPage();
      }
    }
  }

  prevSentence() {
    if (this.sentences.length === 0) return;
    const target = Math.max(0, this.sentenceIndex - 1);
    this.playSentence(target);
  }

  nextSentence() {
    if (this.sentences.length === 0) return;
    if (this.sentenceIndex + 1 < this.sentences.length) {
      this.playSentence(this.sentenceIndex + 1);
    } else {
      this.handlePageFinished();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      const prev = this.currentPage - 1;
      if (window.pdfReader) window.pdfReader.goToPage(prev);
      this.loadPageAndPlay(this.currentBookId, prev, true);
    } else {
      window.showToast('នេះជាទំព័រដំបូងបង្អស់នៃសៀវភៅ', 'info');
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      const next = this.currentPage + 1;
      if (window.pdfReader) window.pdfReader.goToPage(next);
      this.loadPageAndPlay(this.currentBookId, next, true);
    } else {
      window.showToast('នេះជាទំព័រចុងក្រោយនៃសៀវភៅ', 'info');
    }
  }

  setSpeed(newSpeed) {
    this.speed = newSpeed;
    if (this.audio) {
      this.audio.playbackRate = this.speed;
    }
  }

  stop() {
    this.stopAudio();
    this.isPlaying = false;
    this.isPaused = false;
    this.setPlayingState(false);
    this.resetPlayButton();
    if (this.statusTextEl) this.statusTextEl.textContent = 'បានបញ្ឈប់';
    this.updateHeaderActiveState(false);
  }

  close() {
    this.stop();
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio = null;
    }
  }

  showPlayerUI() {
    if (this.container) {
      this.container.style.display = 'flex';
      this.container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  setPlayingState(playing) {
    if (this.waveWrap) {
      if (playing) {
        this.waveWrap.classList.add('playing');
      } else {
        this.waveWrap.classList.remove('playing');
      }
    }

    if (this.playIconEl) this.playIconEl.textContent = playing ? '⏸️' : '▶️';
    if (this.playTextEl) this.playTextEl.textContent = playing ? 'ផ្អាក' : 'អាន';
  }

  resetPlayButton() {
    if (this.playIconEl) this.playIconEl.textContent = '▶️';
    if (this.playTextEl) this.playTextEl.textContent = 'អាន';
    if (this.waveWrap) this.waveWrap.classList.remove('playing');
  }

  updateHeaderActiveState(active) {
    if (this.btnHeaderRead) {
      if (active) {
        this.btnHeaderRead.classList.add('active-reading');
        this.btnHeaderRead.title = 'កំពុងអានសៀវភៅ... (ចុចដើម្បីគ្រប់គ្រង ឬផ្អាក)';
      } else {
        this.btnHeaderRead.classList.remove('active-reading');
        this.btnHeaderRead.title = 'អានសៀវភៅច្បាប់ដើមជាសំឡេង (Read Book Aloud)';
      }
    }
  }

  /**
   * Read custom text (e.g. from selection toolbar)
   */
  speakSelectedText(text) {
    if (!text || text.trim().length === 0) return;

    this.currentBookTitle = window.pdfReader?.currentBook?.title || 'សៀវភៅ';
    this.currentPage = window.pdfReader?.currentPage || 1;
    this.totalPages = window.pdfReader?.totalPages || 1;

    this.showPlayerUI();
    this.updateHeaderActiveState(true);

    if (this.bookTitleEl) this.bookTitleEl.textContent = 'អត្ថបទដែលបានជ្រើសរើស';
    if (this.pageIndicatorEl) this.pageIndicatorEl.textContent = `ទំព័រទី ${this.currentPage}`;

    this.sentences = this.splitKhmerSentences(text);
    if (this.sentences.length > 0) {
      this.playSentence(0);
    }
  }

  async prefetchNextPage(bookId, nextPageNum) {
    if (nextPageNum > this.totalPages) return;
    const cacheKey = `${bookId}_p${nextPageNum}`;
    if (this.pageTextCache && this.pageTextCache[cacheKey]) return;

    try {
      if (window.pdfReader?.pdfDoc) {
        const page = await window.pdfReader.pdfDoc.getPage(nextPageNum);
        if (page) {
          const textContent = await page.getTextContent();
          const items = textContent.items || [];
          if (items.length > 0) {
            const rawText = items.map(s => s.str).join(' ').trim();
            if (rawText.length >= 15) {
              if (!this.pageTextCache) this.pageTextCache = {};
              this.pageTextCache[cacheKey] = rawText;
            }
          }
        }
      }
    } catch (e) {
      // background prefetch failure is non-fatal
    }
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate globally
window.bookAudioPlayer = new BookAudioPlayer();
