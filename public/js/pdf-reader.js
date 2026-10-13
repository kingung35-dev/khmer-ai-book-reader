/**
 * PDF Reader Module
 * Powered by PDF.js with high-DPI canvas rendering, textLayer selection,
 * continuous/single-page modes, search, bookmarks, and OCR triggering.
 */

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdfjs/pdf.worker.min.js';
}

class PdfReader {
  constructor() {
    this.pdfDoc = null;
    this.currentBook = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.zoomMode = 'page-width';
    this.isContinuous = true;
    this.scannedPages = [];
    this.bookmarks = [];
    this.selectedText = '';
    this.pageRendering = false;
    this.pageNumPending = null;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.viewport = document.getElementById('pdf-viewport');
    this.emptyState = document.getElementById('reader-empty-state');
    this.btnPrev = document.getElementById('btn-prev-page');
    this.btnNext = document.getElementById('btn-next-page');
    this.inputPage = document.getElementById('input-current-page');
    this.labelTotal = document.getElementById('label-total-pages');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.selectZoom = document.getElementById('select-zoom');
    this.btnViewMode = document.getElementById('btn-view-mode');
    this.btnBookmark = document.getElementById('btn-add-bookmark');
    this.btnDownload = document.getElementById('btn-download-pdf');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    
    // Search
    this.inputSearch = document.getElementById('input-pdf-search');
    this.labelSearchMatches = document.getElementById('label-search-matches');
    this.btnSearchPrev = document.getElementById('btn-search-prev');
    this.btnSearchNext = document.getElementById('btn-search-next');

    // Scanned page banner
    this.scannedBanner = document.getElementById('scanned-page-banner');
    this.btnRunOcr = document.getElementById('btn-run-ocr');

    // Floating selection toolbar
    this.btnSelAsk = document.getElementById('btn-sel-ask');
    this.btnSelSpeak = document.getElementById('btn-sel-speak');
    this.btnSelSummarize = document.getElementById('btn-sel-summarize');
    this.btnSelExplain = document.getElementById('btn-sel-explain');
    this.btnSelTranslate = document.getElementById('btn-sel-translate');
    this.btnSelDefine = document.getElementById('btn-sel-define');
    this.btnSelCopy = document.getElementById('btn-sel-copy');
    this.btnReadAloud = document.getElementById('btn-read-page-aloud');

    // Thumbnails & Bookmarks container
    this.thumbnailsContainer = document.getElementById('thumbnails-container');
    this.bookmarksContainer = document.getElementById('bookmarks-list');

    // Mobile indicators
    this.mobileCurrent = document.getElementById('mobile-current-page');
    this.mobileTotal = document.getElementById('mobile-total-pages');
  }

  initEvents() {
    this.btnPrev?.addEventListener('click', () => this.goToPrevPage());
    this.btnNext?.addEventListener('click', () => this.goToNextPage());

    this.inputPage?.addEventListener('change', () => {
      const p = parseInt(this.inputPage.value, 10);
      if (p >= 1 && p <= this.totalPages) {
        this.goToPage(p);
      } else {
        this.inputPage.value = this.currentPage;
      }
    });

    this.btnZoomIn?.addEventListener('click', () => this.adjustZoom(0.15));
    this.btnZoomOut?.addEventListener('click', () => this.adjustZoom(-0.15));
    
    this.selectZoom?.addEventListener('change', () => {
      const val = this.selectZoom.value;
      if (val === 'page-width' || val === 'page-fit' || val === 'auto') {
        this.zoomMode = val;
      } else {
        this.zoomMode = 'fixed';
        this.scale = parseFloat(val);
      }
      this.renderCurrentView();
    });

    this.btnViewMode?.addEventListener('click', () => {
      this.isContinuous = !this.isContinuous;
      this.btnViewMode.title = this.isContinuous ? 'ប្តូរទៅទម្រង់ទំព័រទោល (Single Page)' : 'ប្តូរទៅទម្រង់រំកិលបន្ត (Continuous Scroll)';
      this.renderCurrentView();
    });

    this.btnBookmark?.addEventListener('click', () => this.toggleBookmark());
    this.btnReadAloud?.addEventListener('click', () => this.readCurrentPageAloud());

    this.btnDownload?.addEventListener('click', () => {
      if (this.currentBook) {
        window.open(`/api/books/${this.currentBook.id}/pdf`, '_blank');
      }
    });

    this.btnFullscreen?.addEventListener('click', () => this.toggleFullscreen());

    // Search events
    this.inputSearch?.addEventListener('input', () => this.performSearch());

    // OCR Trigger
    this.btnRunOcr?.addEventListener('click', () => this.triggerOcrOnCurrentPage());

    // Selection floating toolbar triggers
    document.addEventListener('selectionchange', () => this.handleTextSelection());

    this.btnSelCopy?.addEventListener('click', () => {
      if (this.selectedText) {
        navigator.clipboard.writeText(this.selectedText);
        window.showToast('បានចម្លងអត្ថបទ!', 'success');
        this.hideSelectionToolbar();
      }
    });

    this.btnSelSpeak?.addEventListener('click', () => {
      if (this.selectedText && window.bookAudioPlayer) {
        window.bookAudioPlayer.speakSelectedText(this.selectedText);
      } else if (this.selectedText && window.khmerAudioPlayer) {
        window.khmerAudioPlayer.speak(this.selectedText, this.btnSelSpeak);
      }
      this.hideSelectionToolbar();
    });

    this.btnSelAsk?.addEventListener('click', () => {
      if (window.aiAssistant) {
        window.aiAssistant.openWithContext(this.selectedText, this.currentPage);
      }
      this.hideSelectionToolbar();
    });

    this.btnSelSummarize?.addEventListener('click', () => {
      if (window.aiAssistant) {
        window.aiAssistant.triggerAction('summarize', this.selectedText, this.currentPage);
      }
      this.hideSelectionToolbar();
    });

    this.btnSelExplain?.addEventListener('click', () => {
      if (window.aiAssistant) {
        window.aiAssistant.triggerAction('explain', this.selectedText, this.currentPage);
      }
      this.hideSelectionToolbar();
    });

    this.btnSelTranslate?.addEventListener('click', () => {
      if (window.aiAssistant) {
        window.aiAssistant.triggerAction('translate', this.selectedText, this.currentPage);
      }
      this.hideSelectionToolbar();
    });

    this.btnSelDefine?.addEventListener('click', () => {
      if (window.aiAssistant) {
        window.aiAssistant.triggerAction('define', this.selectedText, this.currentPage);
      }
      this.hideSelectionToolbar();
    });

    // Continuous scroll observer
    this.viewport?.addEventListener('scroll', () => {
      if (this.isContinuous && this.pdfDoc) {
        this.updateCurrentPageFromScroll();
      }
    });

    // Mobile Phone Touch Swipe Gestures (Swipe Left -> Next, Swipe Right -> Prev)
    let touchStartX = 0;
    let touchStartY = 0;

    this.viewport?.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.viewport?.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        // Require dominant horizontal movement of at least 60px
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) {
            this.goToNextPage();
          } else {
            this.goToPrevPage();
          }
        }
      }
    }, { passive: true });
  }

  async loadBook(book) {
    this.currentBook = book;
    this.currentPage = book.lastReadPage || 1;

    if (this.emptyState) this.emptyState.style.display = 'none';

    window.showToast(`កំពុងបើក "${book.title}"...`, 'info');

    try {
      // 1. Fetch metadata & bookmarks
      const detailsRes = await fetch(`/api/books/${book.id}`);
      const details = await detailsRes.json();
      if (details.success && details.book) {
        this.bookmarks = details.book.bookmarks || [];
        this.scannedPages = details.book.scannedPages || [];
        this.renderBookmarksList();
      }

      // 2. Load PDF with PDF.js
      const loadingTask = pdfjsLib.getDocument(`/api/books/${book.id}/pdf`);
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      if (this.labelTotal) this.labelTotal.textContent = this.totalPages;
      if (this.mobileTotal) this.mobileTotal.textContent = this.totalPages;
      if (this.mobileCurrent) this.mobileCurrent.textContent = this.currentPage;
      if (this.inputPage) {
        this.inputPage.max = this.totalPages;
        this.inputPage.value = this.currentPage;
      }

      // Notify AI Assistant of active book
      if (window.aiAssistant) {
        window.aiAssistant.setActiveBook(book, this.currentPage);
      }

      // 3. Render reader
      await this.renderCurrentView();

      // 4. Generate thumbnails in background
      this.generateThumbnails();

    } catch (err) {
      console.error('Failed to load PDF document:', err);
      window.showToast(`កំហុសក្នុងការបើក PDF: ${err.message}`, 'error');
    }
  }

  closeBook() {
    this.pdfDoc = null;
    this.currentBook = null;
    this.viewport.innerHTML = '';
    if (this.emptyState) {
      this.viewport.appendChild(this.emptyState);
      this.emptyState.style.display = 'flex';
    }
    this.scannedBanner.style.display = 'none';
  }

  async renderCurrentView() {
    if (!this.pdfDoc) return;

    this.viewport.innerHTML = '';

    if (this.isContinuous) {
      // Render all pages in continuous vertical stack
      for (let i = 1; i <= this.totalPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.id = `page-container-${i}`;
        pageContainer.dataset.page = i;
        this.viewport.appendChild(pageContainer);

        await this.renderPageToContainer(i, pageContainer);
      }
      this.scrollToPage(this.currentPage);
    } else {
      // Single Page Mode
      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.id = `page-container-${this.currentPage}`;
      pageContainer.dataset.page = this.currentPage;
      this.viewport.appendChild(pageContainer);

      await this.renderPageToContainer(this.currentPage, pageContainer);
    }

    this.checkScannedPageBanner();
    this.updateBookmarkButtonState();
  }

  async renderPageToContainer(pageNum, container) {
    const page = await this.pdfDoc.getPage(pageNum);
    
    // Calculate viewport & scale
    let scale = this.scale;
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    if (this.zoomMode === 'page-width') {
      const containerWidth = this.viewport.clientWidth - 48; // padding
      scale = containerWidth / unscaledViewport.width;
      this.scale = scale;
    } else if (this.zoomMode === 'page-fit') {
      const containerHeight = this.viewport.clientHeight - 48;
      scale = containerHeight / unscaledViewport.height;
      this.scale = scale;
    }

    const viewport = page.getViewport({ scale });

    // Prepare Canvas with devicePixelRatio for ultra-crisp display
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // Render Text Layer for crisp selection and search
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    container.appendChild(textLayerDiv);

    const textContent = await page.getTextContent();
    pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport,
      textDivs: []
    });
  }

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages) return;
    this.currentPage = pageNum;
    if (this.inputPage) this.inputPage.value = pageNum;
    if (this.mobileCurrent) this.mobileCurrent.textContent = pageNum;

    if (this.isContinuous) {
      this.scrollToPage(pageNum);
    } else {
      this.renderCurrentView();
    }

    this.saveReadingProgress();
    this.checkScannedPageBanner();
    this.updateBookmarkButtonState();

    if (window.aiAssistant) {
      window.aiAssistant.updateCurrentPage(pageNum);
    }
  }

  scrollToPage(pageNum) {
    const el = document.getElementById(`page-container-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToPrevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  adjustZoom(delta) {
    this.zoomMode = 'fixed';
    this.scale = Math.max(0.4, Math.min(3.0, this.scale + delta));
    if (this.selectZoom) this.selectZoom.value = this.scale.toFixed(2);
    this.renderCurrentView();
  }

  updateCurrentPageFromScroll() {
    const containers = this.viewport.querySelectorAll('.pdf-page-container');
    const viewportTop = this.viewport.scrollTop + 80;

    for (const c of containers) {
      const top = c.offsetTop;
      const bottom = top + c.offsetHeight;
      if (viewportTop >= top && viewportTop < bottom) {
        const pNum = parseInt(c.dataset.page, 10);
        if (pNum !== this.currentPage) {
          this.currentPage = pNum;
          if (this.inputPage) this.inputPage.value = pNum;
          if (this.mobileCurrent) this.mobileCurrent.textContent = pNum;
          this.checkScannedPageBanner();
          this.updateBookmarkButtonState();
          if (window.aiAssistant) {
            window.aiAssistant.updateCurrentPage(pNum);
          }
        }
        break;
      }
    }
  }

  checkScannedPageBanner() {
    const isScanned = this.scannedPages.includes(this.currentPage);
    if (this.scannedBanner) {
      this.scannedBanner.style.display = isScanned ? 'flex' : 'none';
    }
  }

  async triggerOcrOnCurrentPage() {
    if (!this.currentBook) return;

    window.showToast(`កំពុងស្កេន OCR ទំព័រទី ${this.currentPage}...`, 'info');

    try {
      const res = await fetch(`/api/books/${this.currentBook.id}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber: this.currentPage })
      });
      const data = await res.json();

      if (data.success) {
        window.showToast(`ស្កេន OCR ជោគជ័យ! រកឃើញ ${data.text.length} តួអក្សរ`, 'success');
        // Remove from scanned list
        this.scannedPages = this.scannedPages.filter(p => p !== this.currentPage);
        this.checkScannedPageBanner();

        // Feed to AI assistant
        if (window.aiAssistant) {
          window.aiAssistant.triggerAction('explain', data.text, this.currentPage);
        }
      } else {
        window.showToast(`OCR បរាជ័យ: ${data.error}`, 'error');
      }
    } catch (err) {
      window.showToast(`កំហុស OCR: ${err.message}`, 'error');
    }
  }

  handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text || text.length < 2) {
      this.hideSelectionToolbar();
      return;
    }

    // Verify selection is inside PDF textLayer
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !anchorNode.parentElement?.closest('.textLayer')) {
      this.hideSelectionToolbar();
      return;
    }

    this.selectedText = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const viewportRect = this.viewport.getBoundingClientRect();

    if (this.selectionToolbar) {
      this.selectionToolbar.style.display = 'flex';
      this.selectionToolbar.style.top = `${rect.top - viewportRect.top + this.viewport.scrollTop}px`;
      this.selectionToolbar.style.left = `${rect.left - viewportRect.left + rect.width / 2}px`;
    }
  }

  hideSelectionToolbar() {
    if (this.selectionToolbar) {
      this.selectionToolbar.style.display = 'none';
    }
  }

  async toggleBookmark() {
    if (!this.currentBook) return;

    const page = this.currentPage;
    const isBookmarked = this.bookmarks.some(b => b.page === page);

    const payload = isBookmarked
      ? { removeBookmark: { page } }
      : { bookmark: { page, title: `ទំព័រទី ${page}` } };

    try {
      const res = await fetch(`/api/books/${this.currentBook.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.bookmarks = data.bookmarks || [];
        this.updateBookmarkButtonState();
        this.renderBookmarksList();
        window.showToast(isBookmarked ? 'បានដកចំណាំ' : 'បានចំណាំទំព័រនេះ', 'success');
      }
    } catch (err) {
      console.warn('Failed to toggle bookmark:', err);
    }
  }

  updateBookmarkButtonState() {
    const isBookmarked = this.bookmarks.some(b => b.page === this.currentPage);
    if (this.btnBookmark) {
      this.btnBookmark.classList.toggle('active', isBookmarked);
    }
  }

  renderBookmarksList() {
    if (!this.bookmarksContainer) return;

    if (this.bookmarks.length === 0) {
      this.bookmarksContainer.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.82rem;">មិនទាន់មានចំណាំនៅឡើយទេ</div>';
      return;
    }

    this.bookmarksContainer.innerHTML = this.bookmarks.map(bm => `
      <div class="bookmark-item" data-page="${bm.page}" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-tertiary); border-radius:var(--radius-sm); cursor:pointer;">
        <span style="font-size:0.85rem; font-weight:500;">🔖 ${bm.title}</span>
        <span style="font-size:0.75rem; color:var(--text-tertiary);">ទំព័រ ${bm.page}</span>
      </div>
    `).join('');

    this.bookmarksContainer.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = parseInt(item.dataset.page, 10);
        this.goToPage(page);
      });
    });
  }

  async generateThumbnails() {
    if (!this.thumbnailsContainer || !this.pdfDoc) return;
    this.thumbnailsContainer.innerHTML = '';

    for (let i = 1; i <= Math.min(this.totalPages, 40); i++) {
      const item = document.createElement('div');
      item.className = `thumbnail-item ${i === this.currentPage ? 'active' : ''}`;
      item.dataset.page = i;

      const canvas = document.createElement('canvas');
      canvas.className = 'thumbnail-canvas';
      item.appendChild(canvas);

      const label = document.createElement('span');
      label.className = 'thumbnail-page-num';
      label.textContent = `${i}`;
      item.appendChild(label);

      item.addEventListener('click', () => this.goToPage(i));
      this.thumbnailsContainer.appendChild(item);

      // Render thumbnail asynchronously
      this.renderThumbnail(i, canvas);
    }
  }

  async renderThumbnail(pageNum, canvas) {
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      // ignore thumbnail error
    }
  }

  async saveReadingProgress() {
    if (!this.currentBook) return;
    try {
      await fetch(`/api/books/${this.currentBook.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastReadPage: this.currentPage })
      });
    } catch (e) {
      // background
    }
  }

  readCurrentPageAloud() {
    if (window.bookAudioPlayer) {
      window.bookAudioPlayer.startReadingCurrentPage();
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
}

window.pdfReader = new PdfReader();
