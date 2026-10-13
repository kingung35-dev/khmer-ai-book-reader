/**
 * AI Assistant Module
 * Manages conversation stream, document grounded QA, quick actions,
 * interactive page citations, and text-to-speech.
 */

class AIAssistant {
  constructor() {
    this.currentBook = null;
    this.currentPage = 1;
    this.scope = 'book'; // 'book', 'page', or 'range'
    this.rangeStart = 1;
    this.rangeEnd = 1;
    this.history = [];
    this.isLoading = false;
    this.currentAbortController = null;
    this.currentLoadingId = null;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.messagesContainer = document.getElementById('chat-messages-container');
    this.textarea = document.getElementById('chat-textarea');
    this.btnSend = document.getElementById('btn-send-chat');
    this.btnStopChat = document.getElementById('btn-stop-chat');
    this.btnClear = document.getElementById('btn-clear-chat');
    this.sidebar = document.getElementById('sidebar-right');

    // Scope & Range elements
    this.btnScopeBook = document.getElementById('btn-scope-book');
    this.btnScopePage = document.getElementById('btn-scope-page');
    this.btnScopeRange = document.getElementById('btn-scope-range');
    this.labelScopePage = document.getElementById('label-scope-current-page');
    this.pageRangePanel = document.getElementById('page-range-panel');
    this.inputRangeStart = document.getElementById('input-range-start');
    this.inputRangeEnd = document.getElementById('input-range-end');
    this.labelRangeTotal = document.getElementById('label-range-total-pages');
    this.labelActionTarget = document.getElementById('label-action-target');
    this.btnOpenActionStudio = document.getElementById('btn-open-action-studio');
    this.btnHeaderOpenPageActions = document.getElementById('btn-open-page-actions');

    // Quick action chips
    this.quickActionChips = document.querySelectorAll('.action-chip');

    // Action Studio Modal elements
    this.modalPageActions = document.getElementById('modal-page-actions');
    this.btnClosePageActions = document.getElementById('btn-close-page-actions');
    this.btnClosePageActionsX = document.getElementById('btn-close-page-actions-x');
    this.btnExecutePageAction = document.getElementById('btn-execute-page-action');
    this.studioRangeStart = document.getElementById('studio-range-start');
    this.studioRangeEnd = document.getElementById('studio-range-end');
    this.studioCurrentPageNum = document.getElementById('studio-current-page-num');
    this.studioBookTotalPages = document.getElementById('studio-book-total-pages');
    this.studioRangeCountBadge = document.getElementById('studio-range-count-badge');
    this.studioRangeBox = document.getElementById('studio-range-box');
    this.radioStudioPage = document.getElementById('radio-studio-page');
    this.radioStudioRange = document.getElementById('radio-studio-range');
    this.radioStudioBook = document.getElementById('radio-studio-book');
  }

  initEvents() {
    this.btnSend?.addEventListener('click', () => this.sendMessage());

    this.textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.btnClear?.addEventListener('click', () => this.clearChat());

    // Scope selection in sidebar
    this.btnScopeBook?.addEventListener('click', () => {
      this.setScope('book');
    });

    this.btnScopePage?.addEventListener('click', () => {
      this.setScope('page');
    });

    this.btnScopeRange?.addEventListener('click', () => {
      this.setScope('range');
    });

    // Range input listeners
    this.inputRangeStart?.addEventListener('change', () => this.handleRangeInputChange());
    this.inputRangeEnd?.addEventListener('change', () => this.handleRangeInputChange());

    // Range preset buttons in sidebar
    document.querySelectorAll('.btn-range-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.applyRangePreset(preset);
      });
    });

    // Quick Action Chips in sidebar
    this.quickActionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        this.triggerQuickAction(action);
      });
    });

    // Open Page Action Studio Modal
    this.btnOpenActionStudio?.addEventListener('click', () => this.openPageActionStudio());
    this.btnHeaderOpenPageActions?.addEventListener('click', () => this.openPageActionStudio());

    // Modal Close
    this.btnClosePageActions?.addEventListener('click', () => this.closePageActionStudio());
    this.btnClosePageActionsX?.addEventListener('click', () => this.closePageActionStudio());

    // Modal Radio changes
    [this.radioStudioPage, this.radioStudioRange, this.radioStudioBook].forEach(radio => {
      radio?.addEventListener('change', () => {
        document.querySelectorAll('.target-option-card').forEach(card => card.classList.remove('selected'));
        radio.closest('.target-option-card')?.classList.add('selected');
        if (this.studioRangeBox) {
          this.studioRangeBox.style.display = this.radioStudioRange?.checked ? 'block' : 'none';
        }
      });
    });

    // Modal Action card selection
    document.querySelectorAll('.studio-action-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.studio-action-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Modal Range inputs
    this.studioRangeStart?.addEventListener('input', () => this.updateStudioRangeSummary());
    this.studioRangeEnd?.addEventListener('input', () => this.updateStudioRangeSummary());

    // Modal Presets
    document.querySelectorAll('.btn-studio-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.applyStudioPreset(preset);
      });
    });

    // Modal Execute Action
    this.btnExecutePageAction?.addEventListener('click', () => this.executeActionFromStudio());

    // Stop AI Generation / Audio Button
    this.btnStopChat?.addEventListener('click', () => this.abortGeneration());
  }

  setLoadingState(isLoading) {
    this.isLoading = isLoading;
    if (this.btnStopChat) {
      this.btnStopChat.style.display = isLoading ? 'inline-flex' : 'none';
    }
    if (this.btnSend) {
      this.btnSend.style.display = isLoading ? 'none' : 'inline-flex';
    }
    if (this.textarea) {
      this.textarea.disabled = isLoading;
    }
  }

  abortGeneration() {
    let aborted = false;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      aborted = true;
    }

    if (this.isPlayingAudio) {
      this.stopSpeaking();
      aborted = true;
    }

    if (this.currentLoadingId) {
      this.removeLoadingIndicator(this.currentLoadingId);
      this.currentLoadingId = null;
      aborted = true;
    }

    this.setLoadingState(false);

    if (aborted) {
      this.appendAssistantMessage('⏹️ _បានបញ្ឈប់ការដំណើរការ AI តាមការស្នើសុំ។_ (AI generation stopped by user)');
      window.showToast('បានបញ្ឈប់ការដំណើរការ AI រួចរាល់!', 'info');
    }
  }

  setScope(scope) {
    this.scope = scope;
    this.btnScopeBook?.classList.toggle('active', scope === 'book');
    this.btnScopePage?.classList.toggle('active', scope === 'page');
    this.btnScopeRange?.classList.toggle('active', scope === 'range');

    if (this.pageRangePanel) {
      this.pageRangePanel.style.display = scope === 'range' ? 'block' : 'none';
    }

    if (scope === 'range') {
      const total = this.currentBook?.totalPages || 184;
      if (!this.rangeStart || this.rangeStart < 1) this.rangeStart = this.currentPage;
      if (!this.rangeEnd || this.rangeEnd < this.rangeStart) {
        this.rangeEnd = Math.min(total, this.rangeStart + 9);
      }
      if (this.inputRangeStart) this.inputRangeStart.value = this.rangeStart;
      if (this.inputRangeEnd) this.inputRangeEnd.value = this.rangeEnd;
    }

    this.updateTargetBadge();
  }

  handleRangeInputChange() {
    const total = this.currentBook?.totalPages || 9999;
    let s = parseInt(this.inputRangeStart?.value, 10) || 1;
    let e = parseInt(this.inputRangeEnd?.value, 10) || s;

    s = Math.max(1, Math.min(s, total));
    e = Math.max(s, Math.min(e, total));

    this.rangeStart = s;
    this.rangeEnd = e;

    if (this.inputRangeStart) this.inputRangeStart.value = s;
    if (this.inputRangeEnd) this.inputRangeEnd.value = e;

    this.updateTargetBadge();
  }

  applyRangePreset(preset) {
    const total = this.currentBook?.totalPages || 184;
    const current = this.currentPage || 1;

    if (preset === '10') {
      this.rangeStart = current;
      this.rangeEnd = Math.min(total, current + 9);
    } else if (preset === '20') {
      this.rangeStart = current;
      this.rangeEnd = Math.min(total, current + 19);
    } else if (preset === '50') {
      this.rangeStart = current;
      this.rangeEnd = Math.min(total, current + 49);
    } else if (preset === 'all') {
      this.rangeStart = 1;
      this.rangeEnd = total;
    }

    if (this.inputRangeStart) this.inputRangeStart.value = this.rangeStart;
    if (this.inputRangeEnd) this.inputRangeEnd.value = this.rangeEnd;

    this.updateTargetBadge();
  }

  updateTargetBadge() {
    if (!this.labelActionTarget) return;

    if (this.scope === 'page') {
      this.labelActionTarget.textContent = `ទំព័រទី ${this.currentPage}`;
    } else if (this.scope === 'range') {
      const count = Math.max(1, (this.rangeEnd - this.rangeStart + 1));
      this.labelActionTarget.textContent = `ទំព័រទី ${this.rangeStart} ដល់ ${this.rangeEnd} (${count} ទំព័រ)`;
    } else {
      const total = this.currentBook?.totalPages;
      this.labelActionTarget.textContent = total ? `សៀវភៅទាំងមូល (${total} ទំព័រ)` : 'សៀវភៅទាំងមូល';
    }
  }

  ensureActiveBook() {
    if (!this.currentBook) {
      if (window.pdfReader?.currentBook) {
        this.setActiveBook(window.pdfReader.currentBook, window.pdfReader.currentPage || 1);
      } else if (window.libraryManager?.books && window.libraryManager.books.length > 0) {
        const activeId = window.libraryManager.activeBookId;
        const b = (activeId && window.libraryManager.books.find(x => x.id === activeId)) || window.libraryManager.books[0];
        if (b) {
          this.setActiveBook(b, b.lastReadPage || 1);
        }
      }
    }
    return this.currentBook;
  }

  openPageActionStudio() {
    this.ensureActiveBook();

    if (!this.currentBook) {
      window.showToast('សូមជ្រើសរើសសៀវភៅមួយជាមុនសិន', 'error');
      return;
    }

    const total = this.currentBook.totalPages || 184;
    if (this.studioCurrentPageNum) this.studioCurrentPageNum.textContent = this.currentPage;
    if (this.studioBookTotalPages) this.studioBookTotalPages.textContent = total;

    // Sync values
    const s = this.scope === 'range' ? (this.rangeStart || this.currentPage) : this.currentPage;
    const e = this.scope === 'range' ? (this.rangeEnd || Math.min(total, s + 9)) : Math.min(total, s + 9);

    if (this.studioRangeStart) {
      this.studioRangeStart.value = s;
      this.studioRangeStart.max = total;
    }
    if (this.studioRangeEnd) {
      this.studioRangeEnd.value = e;
      this.studioRangeEnd.max = total;
    }

    this.updateStudioRangeSummary();

    // Select matching scope in modal
    if (this.scope === 'page' && this.radioStudioPage) {
      this.radioStudioPage.checked = true;
      this.radioStudioPage.dispatchEvent(new Event('change'));
    } else if (this.scope === 'book' && this.radioStudioBook) {
      this.radioStudioBook.checked = true;
      this.radioStudioBook.dispatchEvent(new Event('change'));
    } else if (this.radioStudioRange) {
      this.radioStudioRange.checked = true;
      this.radioStudioRange.dispatchEvent(new Event('change'));
    }

    this.modalPageActions?.classList.add('active');
  }

  closePageActionStudio() {
    this.modalPageActions?.classList.remove('active');
  }

  updateStudioRangeSummary() {
    const total = this.currentBook?.totalPages || 9999;
    const s = parseInt(this.studioRangeStart?.value, 10) || 1;
    const e = parseInt(this.studioRangeEnd?.value, 10) || s;
    const count = Math.max(1, e - s + 1);
    if (this.studioRangeCountBadge) {
      this.studioRangeCountBadge.textContent = `សរុប ${count} ទំព័រ`;
    }
  }

  applyStudioPreset(preset) {
    const total = this.currentBook?.totalPages || 184;
    const current = this.currentPage || 1;

    let s = current;
    let e = current;

    if (preset === 'current-lesson') {
      s = Math.max(1, current - 2);
      e = Math.min(total, current + 3);
    } else if (preset === 'next-10') {
      s = current;
      e = Math.min(total, current + 9);
    } else if (preset === 'next-20') {
      s = current;
      e = Math.min(total, current + 19);
    } else if (preset === 'pages-12-184') {
      s = Math.min(12, total);
      e = total;
    } else if (preset === 'all') {
      s = 1;
      e = total;
    }

    if (this.studioRangeStart) this.studioRangeStart.value = s;
    if (this.studioRangeEnd) this.studioRangeEnd.value = e;

    this.updateStudioRangeSummary();
  }

  executeActionFromStudio() {
    const activeCard = document.querySelector('.studio-action-card.active');
    const action = activeCard?.dataset.action || 'summarize';

    let selectedScope = 'range';
    if (this.radioStudioPage?.checked) selectedScope = 'page';
    else if (this.radioStudioBook?.checked) selectedScope = 'book';

    let customRange = null;
    if (selectedScope === 'range') {
      const s = parseInt(this.studioRangeStart?.value, 10) || 1;
      const e = parseInt(this.studioRangeEnd?.value, 10) || s;
      customRange = { start: Math.min(s, e), end: Math.max(s, e) };
      this.rangeStart = customRange.start;
      this.rangeEnd = customRange.end;
      if (this.inputRangeStart) this.inputRangeStart.value = this.rangeStart;
      if (this.inputRangeEnd) this.inputRangeEnd.value = this.rangeEnd;
    }

    this.setScope(selectedScope);
    this.closePageActionStudio();

    // Trigger action immediately
    this.triggerQuickAction(action, customRange);
  }

  setActiveBook(book, currentPage = 1) {
    this.currentBook = book;
    this.currentPage = currentPage || 1;
    const total = book.totalPages || 184;

    this.rangeStart = this.currentPage;
    this.rangeEnd = Math.min(total, Math.max(this.currentPage, this.currentPage + 9));

    if (this.labelScopePage) this.labelScopePage.textContent = this.currentPage;
    if (this.labelRangeTotal) this.labelRangeTotal.textContent = total;
    if (this.inputRangeStart) this.inputRangeStart.value = this.rangeStart;
    if (this.inputRangeEnd) {
      this.inputRangeEnd.value = this.rangeEnd;
      this.inputRangeEnd.max = total;
    }

    this.updateTargetBadge();
  }

  updateCurrentPage(pageNum) {
    this.currentPage = pageNum;
    if (this.labelScopePage) this.labelScopePage.textContent = pageNum;
    if (this.studioCurrentPageNum) this.studioCurrentPageNum.textContent = pageNum;
    if (this.scope === 'page') {
      this.updateTargetBadge();
    }
  }

  openWithContext(selectedText, pageNum) {
    // Open sidebar if collapsed
    if (this.sidebar?.classList.contains('collapsed')) {
      this.sidebar.classList.remove('collapsed');
    }

    if (this.textarea) {
      this.textarea.value = `តើអត្ថបទនេះមានន័យដូចម្តេច៖ "${selectedText}"`;
      this.textarea.focus();
    }
  }

  async triggerAction(action, text, pageNumber) {
    this.ensureActiveBook();
    if (!this.currentBook) {
      window.showToast('សូមជ្រើសរើសសៀវភៅជាមុនសិន', 'error');
      return;
    }

    // Open sidebar if collapsed
    if (this.sidebar?.classList.contains('collapsed')) {
      this.sidebar.classList.remove('collapsed');
    }

    const actionNamesKhmer = {
      summarize: 'សង្ខេបអត្ថបទ',
      explain: 'ពន្យល់ខ្លឹមសារ',
      translate: 'បកប្រែជាភាសាខ្មែរ',
      define: 'ពន្យល់ពាក្យពិបាក',
      generate_qa: 'បង្កើតសំណួរ-ចម្លើយ',
      generate_quiz: 'បង្កើតលំហាត់ Quiz',
      summarize_chapter: 'សង្ខេបជំពូក'
    };

    const actionLabel = actionNamesKhmer[action] || action;
    const userPrompt = `[${actionLabel}]: "${text.substring(0, 100)}..."`;
    this.appendUserMessage(userPrompt);

    this.currentAbortController = new AbortController();
    this.setLoadingState(true);
    const loadingId = this.appendLoadingIndicator();
    this.currentLoadingId = loadingId;

    try {
      const res = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.currentAbortController.signal,
        body: JSON.stringify({
          action,
          text,
          bookId: this.currentBook.id,
          pageNumber: pageNumber || this.currentPage
        })
      });
      const data = await res.json();
      this.removeLoadingIndicator(loadingId);
      this.currentLoadingId = null;

      if (data.success) {
        this.appendAssistantMessage(data.answer, data.pageNumber ? [data.pageNumber] : []);
      } else {
        this.appendAssistantMessage(data.error || 'មានបញ្ហាក្នុងការដំណើរការ AI');
      }
    } catch (err) {
      this.removeLoadingIndicator(loadingId);
      this.currentLoadingId = null;
      if (err.name === 'AbortError') {
        return;
      }
      this.appendAssistantMessage(`កំហុសក្នុងការតភ្ជាប់: ${err.message}`);
    } finally {
      this.setLoadingState(false);
      this.currentAbortController = null;
    }
  }

  /**
   * Trigger any of the 7 AI actions on Selected Page, Page Range, or Whole Book
   */
  async triggerQuickAction(action, customRange = null) {
    this.ensureActiveBook();
    if (!this.currentBook) {
      window.showToast('សូមជ្រើសរើសសៀវភៅជាមុនសិន', 'error');
      return;
    }

    // Open sidebar if collapsed
    if (this.sidebar?.classList.contains('collapsed')) {
      this.sidebar.classList.remove('collapsed');
    }

    const total = this.currentBook.totalPages || 184;
    const current = this.currentPage || 1;
    const start = customRange?.start || (this.scope === 'range' ? (this.rangeStart || 1) : current);
    const end = customRange?.end || (this.scope === 'range' ? (this.rangeEnd || Math.min(total, start + 9)) : current);

    let prompt = '';

    if (this.scope === 'range' || customRange) {
      // 1. Page Range Prompts
      if (action === 'summarize') {
        prompt = `សូមធ្វើការសង្ខេបខ្លឹមសារសៀវភៅនេះ ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} ជាចំណុចសំខាន់ៗ (Bullet Points) ខ្លី ខ្លឹម និងងាយយល់បំផុត ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'explain') {
        prompt = `សូមពន្យល់ខ្លឹមសារមេរៀនសំខាន់ៗ ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} ជាភាសាខ្មែរឱ្យបានស៊ីជម្រៅ ក្បោះក្បាយ ងាយយល់ និងលើកឧទាហរណ៍ជាក់ស្តែង ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'translate') {
        prompt = `សូមធ្វើការបកប្រែខ្លឹមសារសៀវភៅនេះ ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} ជាភាសាខ្មែរ ឱ្យបានត្រឹមត្រូវ ១០០% ពិរោះ និងងាយយល់ ដើម្បីស្ដាប់ជាសំឡេងខ្មែរ (Khmer Text-to-Speech) ដោយរក្សាពាក្យបច្ចេកទេស និងភ្ជាប់លេខទំព័រយោង [ទំព័រ X] សម្រាប់ផ្ទៀងផ្ទាត់។`;
      } else if (action === 'define') {
        prompt = `សូមស្រង់ពាក្យគន្លឹះ ពាក្យបច្ចេកទេស និងពាក្យពិបាកៗ ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} រួចពន្យល់និយមន័យនៃពាក្យនីមួយៗឱ្យបានក្បោះក្បាយ ព្រមទាំងបញ្ជាក់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'generate_qa') {
        prompt = `សូមបង្កើតកម្រងសំណួរ និងចម្លើយសំខាន់ៗ (Q&A) ចេញពីមេរៀន ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} ឱ្យបានចំនួន ១០ ទៅ ១៥ គូ ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'generate_quiz') {
        prompt = `សូមបង្កើតកម្រងលំហាត់ Quiz ពហុជ្រើសរើស (MCQ) ចេញពីសៀវភៅនេះ ចាប់ពីទំព័រទី ${start} រហូតដល់ទំព័រទី ${end} ឱ្យបានចំនួន ១៥ ទៅ ២០ សំណួរគត់ (មានជម្រើស ៤ គឺ ក, ខ, គ, ឃ) ព្រមទាំងមានផ្នែកចម្លើយត្រឹមត្រូវ ការពន្យល់ និងលេខទំព័រយោង [ទំព័រ X] សម្រាប់គ្រប់សំណួរទាំងអស់នៅចុងបញ្ចប់។`;
      } else if (action === 'summarize_chapter') {
        prompt = `សូមធ្វើការវិភាគ និងសង្ខេបជំពូក ឬផ្នែកនៃមេរៀន ចាប់ពីទំព័រទី ${start} ដល់ទំព័រទី ${end} ដោយបង្ហាញពីប្រធានបទធំៗ ចំណុចគន្លឹះ និងលទ្ធផលសិក្សា ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      }
    } else if (this.scope === 'book') {
      // 2. Whole Book Prompts
      if (action === 'summarize') {
        prompt = `សូមធ្វើការសង្ខេបខ្លឹមសារសៀវភៅនេះទាំងមូល ដោយបង្ហាញពីប្រធានបទធំៗ មេរៀនសំខាន់ៗ និងសារអប់រំនៃសៀវភៅ ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'explain') {
        prompt = `សូមពន្យល់ពីទស្សនទាន គោលគំនិត និងទ្រឹស្តីសំខាន់ៗនៃសៀវភៅនេះទាំងមូលឱ្យបានស៊ីជម្រៅ និងងាយយល់។`;
      } else if (action === 'translate') {
        prompt = `សូមធ្វើការបកប្រែខ្លឹមសារសំខាន់ៗនៃសៀវភៅនេះទាំងមូលជាភាសាខ្មែរ ឱ្យបានត្រឹមត្រូវ ១០០% ពិរោះ និងងាយយល់ ដើម្បីស្ដាប់ជាសំឡេងខ្មែរ (Khmer Text-to-Speech) ដោយរក្សាពាក្យបច្ចេកទេស និងភ្ជាប់លេខទំព័រយោង [ទំព័រ X] សម្រាប់ផ្ទៀងផ្ទាត់។`;
      } else if (action === 'define') {
        prompt = `សូមស្រង់វាក្យសព្ទគន្លឹះ និងពាក្យបច្ចេកទេសសំខាន់ៗនៃសៀវភៅនេះទាំងមូល រួចពន្យល់និយមន័យលម្អិត។`;
      } else if (action === 'generate_qa') {
        prompt = `សូមបង្កើតកម្រងសំណួរ និងចម្លើយ (Q&A) សំខាន់ៗបំផុតចេញពីគ្រប់ជំពូកនៃសៀវភៅនេះទាំងមូល ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      } else if (action === 'generate_quiz') {
        prompt = `សូមបង្កើតកម្រងលំហាត់ Quiz ពហុជ្រើសរើស (MCQ) ចេញពីសៀវភៅនេះទាំងមូល ឱ្យបានយ៉ាងតិច ១៥ ទៅ ២០ សំណួរគត់ (មានជម្រើស ក, ខ, គ, ឃ) គ្របដណ្តប់លើគ្រប់ជំពូក ព្រមទាំងមានផ្នែកចម្លើយត្រឹមត្រូវ ការពន្យល់ និងលេខទំព័រយោង [ទំព័រ X] នៅចុងបញ្ចប់។`;
      } else if (action === 'summarize_chapter') {
        prompt = `សូមធ្វើការវិភាគ និងសង្ខេបគ្រប់ជំពូកនៃសៀវភៅនេះទាំងមូលជាលំដាប់លំដោយ ដោយបង្ហាញពីចំណងជើងជំពូក ខ្លឹមសារសង្ខេប និងគំនិតសំខាន់ៗ ព្រមទាំងភ្ជាប់លេខទំព័រយោង [ទំព័រ X]។`;
      }
    } else {
      // 3. Single Page Prompts
      if (action === 'summarize') {
        prompt = `សូមសង្ខេបខ្លឹមសារទំព័រទី ${current} នៃសៀវភៅនេះជាចំណុចសំខាន់ៗ (Bullet Points) ខ្លី ខ្លឹម និងងាយយល់បំផុត។`;
      } else if (action === 'explain') {
        prompt = `សូមពន្យល់ខ្លឹមសារទំព័រទី ${current} ជាភាសាខ្មែរងាយយល់ និងលើកឧទាហរណ៍ជាក់ស្តែង។`;
      } else if (action === 'translate') {
        prompt = `សូមធ្វើការបកប្រែខ្លឹមសារទំព័រទី ${current} ជាភាសាខ្មែរ ឱ្យបានត្រឹមត្រូវ ១០០% ពិរោះ និងងាយយល់ ដើម្បីស្ដាប់ជាសំឡេងខ្មែរ (Khmer Text-to-Speech) ដោយរក្សាពាក្យបច្ចេកទេស និងភ្ជាប់លេខទំព័រយោង [ទំព័រ ${current}] សម្រាប់ផ្ទៀងផ្ទាត់។`;
      } else if (action === 'define') {
        prompt = `សូមពន្យល់ពាក្យបច្ចេកទេស និងពាក្យពិបាកៗក្នុងទំព័រទី ${current}។`;
      } else if (action === 'generate_qa') {
        prompt = `សូមបង្កើតសំណួរ និងចម្លើយពីមេរៀនក្នុងទំព័រទី ${current}។`;
      } else if (action === 'generate_quiz') {
        prompt = `សូមបង្កើតលំហាត់ពហុជ្រើសរើស (Quiz MCQ) ចេញពីទំព័រទី ${current} យ៉ាងតិចចំនួន ១០ សំណួរ (មានជម្រើស ក, ខ, គ, ឃ) ព្រមទាំងមានផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់លម្អិត [ទំព័រ ${current}] សម្រាប់គ្រប់សំណួរទាំងអស់នៅចុងបញ្ចប់។`;
      } else if (action === 'summarize_chapter') {
        prompt = `សូមធ្វើការវិភាគ និងសង្ខេបជំពូក ឬផ្នែកនៃទំព័រទី ${current} នេះ។`;
      }
    }

    if (this.textarea) {
      this.textarea.value = prompt;
      this.sendMessage();
    }
  }

  async sendMessage() {
    if (this.isLoading) return;

    const question = this.textarea?.value.trim();
    if (!question) return;

    this.ensureActiveBook();
    if (!this.currentBook) {
      window.showToast('សូមបើកសៀវភៅមួយជាមុនសិន', 'error');
      return;
    }

    this.textarea.value = '';
    this.appendUserMessage(question);

    this.currentAbortController = new AbortController();
    this.setLoadingState(true);
    const loadingId = this.appendLoadingIndicator();
    this.currentLoadingId = loadingId;

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.currentAbortController.signal,
        body: JSON.stringify({
          bookId: this.currentBook.id,
          question,
          currentPage: this.currentPage,
          scope: this.scope,
          startPage: this.scope === 'range' ? this.rangeStart : null,
          endPage: this.scope === 'range' ? this.rangeEnd : null
        })
      });
      const data = await res.json();
      this.removeLoadingIndicator(loadingId);
      this.currentLoadingId = null;

      if (data.success) {
        this.appendAssistantMessage(data.answer, data.citations || []);
      } else {
        this.appendAssistantMessage(data.error || 'មានបញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធ AI');
      }
    } catch (err) {
      this.removeLoadingIndicator(loadingId);
      this.currentLoadingId = null;
      if (err.name === 'AbortError') {
        return;
      }
      this.appendAssistantMessage(`កំហុសបណ្តាញ: ${err.message}`);
    } finally {
      this.setLoadingState(false);
      this.currentAbortController = null;
    }
  }

  appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message user';
    msgDiv.innerHTML = `
      <div class="message-bubble">${this.escapeHtml(text)}</div>
    `;
    this.messagesContainer.appendChild(msgDiv);
    this.scrollToBottom();
  }

  appendAssistantMessage(markdownText, citations = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant';

    // Parse markdown
    let htmlContent = '';
    if (window.marked) {
      htmlContent = marked.parse(markdownText);
    } else {
      htmlContent = `<p>${this.escapeHtml(markdownText)}</p>`;
    }

    // Convert page citations [ទំព័រ X] or [Page X] into clickable interactive badges
    htmlContent = htmlContent.replace(/\[(?:ទំព័រ|ទំព័រទី|Page)\s*(\d+)\]/gi, (match, pageNum) => {
      return `<button class="citation-badge" data-page="${pageNum}" title="ចុចដើម្បីរំកិលទៅទំព័រទី ${pageNum}">📍 ទំព័រ ${pageNum}</button>`;
    });

    const msgId = `msg_${Date.now()}`;

    msgDiv.innerHTML = `
      <div class="message-bubble" id="${msgId}">
        ${htmlContent}
      </div>
      <div class="message-actions">
        <button class="action-mini-btn btn-copy-msg" title="ចម្លងចម្លើយ (Copy)">📋 ចម្លង</button>
        <button class="action-mini-btn btn-speak-msg" title="អានជាសំឡេង (Speak Khmer)">🔊 អាន</button>
      </div>
    `;

    this.messagesContainer.appendChild(msgDiv);

    // Bind citation click events to jump reader directly to the referenced page!
    msgDiv.querySelectorAll('.citation-badge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = parseInt(btn.dataset.page, 10);
        if (targetPage && window.pdfReader) {
          window.pdfReader.goToPage(targetPage);
          window.showToast(`បានរំកិលទៅកាន់ទំព័រទី ${targetPage}`, 'info');
        }
      });
    });

    // Bind copy action
    msgDiv.querySelector('.btn-copy-msg')?.addEventListener('click', () => {
      navigator.clipboard.writeText(markdownText);
      window.showToast('បានចម្លងចម្លើយទៅ Clipboard!', 'success');
    });

    // Bind TTS action
    const btnSpeak = msgDiv.querySelector('.btn-speak-msg');
    btnSpeak?.addEventListener('click', () => {
      this.speakText(markdownText, btnSpeak);
    });

    this.scrollToBottom();
  }

  speakText(text, btn = null) {
    if (window.bookAudioPlayer) {
      window.bookAudioPlayer.stop();
    }

    if (this.audioPlayer && this.isPlayingAudio) {
      this.stopSpeaking();
      if (this.currentPlayingBtn === btn) {
        return;
      }
    }

    const sentences = this.splitKhmerSentences(text);
    if (sentences.length === 0) {
      window.showToast('មិនមានអត្ថបទសម្រាប់អានទេ', 'error');
      return;
    }

    this.audioChunks = sentences;
    this.currentChunkIndex = 0;
    this.isPlayingAudio = true;
    this.currentPlayingBtn = btn;

    if (btn) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '⏹️ ឈប់';
      btn.style.color = 'var(--accent-danger)';
    }

    if (this.btnStopChat) {
      this.btnStopChat.style.display = 'inline-flex';
    }

    window.showToast('កំពុងអានជាសំឡេងខ្មែរធម្មជាតិ...', 'info');
    this.playNextAudioChunk();
  }

  stopSpeaking() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.onended = null;
      this.audioPlayer.onerror = null;
      this.audioPlayer = null;
    }
    this.isPlayingAudio = false;
    if (this.currentPlayingBtn) {
      this.currentPlayingBtn.innerHTML = this.currentPlayingBtn.dataset.originalText || '🔊 អាន';
      this.currentPlayingBtn.style.color = '';
      this.currentPlayingBtn = null;
    }
    if (this.btnStopChat && !this.isLoading) {
      this.btnStopChat.style.display = 'none';
    }
  }

  playNextAudioChunk() {
    if (!this.isPlayingAudio || this.currentChunkIndex >= this.audioChunks.length) {
      this.stopSpeaking();
      return;
    }

    const chunk = this.audioChunks[this.currentChunkIndex];
    // Always request Khmer voice ('km') so TTS proxy ensures 100% Khmer speech
    const url = `/api/tts?tl=km&q=${encodeURIComponent(chunk)}`;
    this.audioPlayer = new Audio(url);

    this.audioPlayer.onended = () => {
      this.currentChunkIndex++;
      this.playNextAudioChunk();
    };

    this.audioPlayer.onerror = (err) => {
      console.warn('Audio chunk error, skipping to next:', err);
      this.currentChunkIndex++;
      this.playNextAudioChunk();
    };

    this.audioPlayer.play().catch(err => {
      console.warn('Audio playback error:', err);
      this.stopSpeaking();
    });
  }

  splitKhmerSentences(text) {
    if (!text) return [];
    // Strip markdown formatting & citations
    let cleaned = text
      .replace(/\[(?:ទំព័រ|ទំព័រទី|Page)\s*\d+\]/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_#`>]/g, '')
      .replace(/[\uFEFF\u200B\u200E\u200F]/g, '')
      .trim();

    // Match sentences ending with Khmer punctuation (។, ៕, !, ?, \n)
    const rawMatches = cleaned.match(/[^។៕!?\n\r]+[។៕!?]?/g) || [cleaned];
    const chunks = [];

    for (const raw of rawMatches) {
      const s = raw.trim();
      if (!s) continue;

      if (s.length <= 130) {
        chunks.push(s);
      } else {
        // Split longer sentences on punctuation or spaces
        const subParts = s.split(/(?<=[,;:\s])/);
        let curr = '';
        for (const part of subParts) {
          if ((curr + part).length > 130 && curr.length > 0) {
            chunks.push(curr.trim());
            curr = part;
          } else {
            curr += part;
          }
        }
        if (curr.trim().length > 0) {
          chunks.push(curr.trim());
        }
      }
    }

    return chunks;
  }

  appendLoadingIndicator() {
    const id = `loading_${Date.now()}`;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message assistant';
    loadingDiv.id = id;
    loadingDiv.innerHTML = `
      <div class="message-bubble loading-bubble">
        <div class="loading-content">
          <span class="spinner" style="border-top-color:var(--accent-primary); width:15px; height:15px;"></span>
          <span>AI កំពុងអាន និងវិភាគខ្លឹមសារសៀវភៅ...</span>
        </div>
        <button type="button" class="btn-loading-stop" title="បញ្ឈប់ការដំណើរការ AI (Stop)">
          ⏹️ បញ្ឈប់
        </button>
      </div>
    `;

    const stopBtn = loadingDiv.querySelector('.btn-loading-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.abortGeneration();
      });
    }

    this.messagesContainer.appendChild(loadingDiv);
    this.scrollToBottom();
    return id;
  }

  removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  clearChat() {
    if (!confirm('តើអ្នកចង់សម្អាតប្រវត្តិការសន្ទនានេះមែនទេ?')) return;
    this.messagesContainer.innerHTML = '';
    this.appendAssistantMessage('បានសម្អាតការសន្ទនា។ តើអ្នកចង់សួរអ្វីបន្តទៀតអំពីសៀវភៅនេះ?');
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
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

window.aiAssistant = new AIAssistant();
window.khmerAudioPlayer = {
  speak: (text, btn) => window.aiAssistant?.speakText(text, btn),
  stop: () => window.aiAssistant?.stopSpeaking()
};
