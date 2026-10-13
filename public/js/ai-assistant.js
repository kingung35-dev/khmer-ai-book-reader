/**
 * AI Assistant Module
 * Manages conversation stream, document grounded QA, quick actions,
 * interactive page citations, and text-to-speech.
 */

class AIAssistant {
  constructor() {
    this.currentBook = null;
    this.currentPage = 1;
    this.scope = 'book'; // 'book' or 'page'
    this.history = [];
    this.isLoading = false;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.messagesContainer = document.getElementById('chat-messages-container');
    this.textarea = document.getElementById('chat-textarea');
    this.btnSend = document.getElementById('btn-send-chat');
    this.btnClear = document.getElementById('btn-clear-chat');
    this.btnScopeBook = document.getElementById('btn-scope-book');
    this.btnScopePage = document.getElementById('btn-scope-page');
    this.labelScopePage = document.getElementById('label-scope-current-page');
    this.quickActionChips = document.querySelectorAll('.action-chip');
    this.sidebar = document.getElementById('sidebar-right');
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

    this.btnScopeBook?.addEventListener('click', () => {
      this.scope = 'book';
      this.btnScopeBook.classList.add('active');
      this.btnScopePage.classList.remove('active');
    });

    this.btnScopePage?.addEventListener('click', () => {
      this.scope = 'page';
      this.btnScopePage.classList.add('active');
      this.btnScopeBook.classList.remove('active');
    });

    this.quickActionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        this.triggerQuickAction(action);
      });
    });
  }

  setActiveBook(book, currentPage = 1) {
    this.currentBook = book;
    this.currentPage = currentPage;
    if (this.labelScopePage) this.labelScopePage.textContent = currentPage;
  }

  updateCurrentPage(pageNum) {
    this.currentPage = pageNum;
    if (this.labelScopePage) this.labelScopePage.textContent = pageNum;
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
      translate: 'បកប្រែអត្ថបទ',
      define: 'ពន្យល់ពាក្យពិបាក',
      generate_qa: 'បង្កើតសំណួរ-ចម្លើយ',
      generate_quiz: 'បង្កើតលំហាត់ Quiz',
      summarize_chapter: 'សង្ខេបជំពូក'
    };

    const actionLabel = actionNamesKhmer[action] || action;
    const userPrompt = `[${actionLabel}]: "${text.substring(0, 100)}..."`;
    this.appendUserMessage(userPrompt);

    const loadingId = this.appendLoadingIndicator();
    this.isLoading = true;

    try {
      const res = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          text,
          bookId: this.currentBook.id,
          pageNumber: pageNumber || this.currentPage
        })
      });
      const data = await res.json();
      this.removeLoadingIndicator(loadingId);

      if (data.success) {
        this.appendAssistantMessage(data.answer, data.pageNumber ? [data.pageNumber] : []);
      } else {
        this.appendAssistantMessage(data.error || 'មានបញ្ហាក្នុងការដំណើរការ AI');
      }
    } catch (err) {
      this.removeLoadingIndicator(loadingId);
      this.appendAssistantMessage(`កំហុសក្នុងការតភ្ជាប់: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  async triggerQuickAction(action) {
    if (!this.currentBook) {
      window.showToast('សូមជ្រើសរើសសៀវភៅជាមុនសិន', 'error');
      return;
    }

    // Default question prompts based on chip
    let prompt = '';
    if (action === 'summarize') {
      prompt = `សូមសង្ខេបខ្លឹមសារទំព័រទី ${this.currentPage} នៃសៀវភៅនេះ។`;
    } else if (action === 'explain') {
      prompt = `សូមពន្យល់ខ្លឹមសារទំព័រទី ${this.currentPage} ជាភាសាខ្មែរងាយយល់។`;
    } else if (action === 'translate') {
      prompt = `សូមបកប្រែខ្លឹមសារទំព័រទី ${this.currentPage} ទៅជាភាសាខ្មែរ។`;
    } else if (action === 'define') {
      prompt = `សូមពន្យល់ពាក្យបច្ចេកទេស និងពាក្យពិបាកៗក្នុងទំព័រទី ${this.currentPage}។`;
    } else if (action === 'generate_qa') {
      prompt = `សូមបង្កើតសំណួរ និងចម្លើយពីមេរៀនក្នុងទំព័រទី ${this.currentPage}។`;
    } else if (action === 'generate_quiz') {
      prompt = `សូមបង្កើតលំហាត់ពហុជ្រើសរើស (Quiz MCQ) ចេញពីទំព័រទី ${this.currentPage} យ៉ាងតិចចំនួន ១០ សំណួរ (មានជម្រើស ក, ខ, គ, ឃ) ព្រមទាំងមានផ្នែកចម្លើយត្រឹមត្រូវ និងការពន្យល់លម្អិត [ទំព័រ ${this.currentPage}] សម្រាប់គ្រប់សំណួរទាំងអស់នៅចុងបញ្ចប់។`;
    } else if (action === 'summarize_chapter') {
      prompt = `តើគំនិតសំខាន់ៗក្នុងជំពូកនេះមានអ្វីខ្លះ?`;
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

    if (!this.currentBook) {
      window.showToast('សូមបើកសៀវភៅមួយជាមុនសិន', 'error');
      return;
    }

    this.textarea.value = '';
    this.appendUserMessage(question);

    const loadingId = this.appendLoadingIndicator();
    this.isLoading = true;

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: this.currentBook.id,
          question,
          currentPage: this.currentPage,
          scope: this.scope
        })
      });
      const data = await res.json();
      this.removeLoadingIndicator(loadingId);

      if (data.success) {
        this.appendAssistantMessage(data.answer, data.citations || []);
      } else {
        this.appendAssistantMessage(data.error || 'មានបញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធ AI');
      }
    } catch (err) {
      this.removeLoadingIndicator(loadingId);
      this.appendAssistantMessage(`កំហុសបណ្តាញ: ${err.message}`);
    } finally {
      this.isLoading = false;
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
  }

  playNextAudioChunk() {
    if (!this.isPlayingAudio || this.currentChunkIndex >= this.audioChunks.length) {
      this.stopSpeaking();
      return;
    }

    const chunk = this.audioChunks[this.currentChunkIndex];
    const isKhmer = /[\u1780-\u17FF]/.test(chunk);
    const langCode = isKhmer ? 'km' : 'en';

    const url = `/api/tts?tl=${langCode}&q=${encodeURIComponent(chunk)}`;
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
      <div class="message-bubble" style="display:flex; align-items:center; gap:8px;">
        <span class="spinner" style="border-top-color:var(--accent-primary);"></span>
        <span>AI កំពុងអាន និងវិភាគខ្លឹមសារសៀវភៅ...</span>
      </div>
    `;
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
