/**
 * Library Module
 * Handles book library list, PDF file uploading, sorting, filtering, and deletion.
 */

class LibraryManager {
  constructor() {
    this.books = [];
    this.activeBookId = null;
    this.selectedFile = null;
    this.isUploading = false;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    // Library sidebar elements
    this.container = document.getElementById('library-book-list');
    this.searchInput = document.getElementById('input-search-library');
    this.sortSelect = document.getElementById('select-sort-books');
    this.btnUploadTrigger = document.getElementById('btn-upload-trigger');
    this.fileInput = document.getElementById('file-upload-input');
    this.readerDropzone = document.getElementById('reader-dropzone');

    // Header upload button
    this.btnHeaderUpload = document.getElementById('btn-header-upload');

    // Upload Modal elements
    this.modalUpload = document.getElementById('modal-upload-book');
    this.btnCloseUploadX = document.getElementById('btn-close-upload-x');
    this.btnCancelUpload = document.getElementById('btn-cancel-upload');
    this.btnSubmitUpload = document.getElementById('btn-submit-upload');
    this.modalDropzone = document.getElementById('modal-upload-dropzone');
    this.modalFileInput = document.getElementById('modal-file-input');
    this.selectedFileCard = document.getElementById('selected-file-card');
    this.selectedFileName = document.getElementById('selected-file-name');
    this.selectedFileSize = document.getElementById('selected-file-size');
    this.btnRemoveSelectedFile = document.getElementById('btn-remove-selected-file');
    this.groupCustomTitle = document.getElementById('group-custom-title');
    this.inputCustomTitle = document.getElementById('input-book-custom-title');
    this.uploadProgressWrapper = document.getElementById('upload-progress-wrapper');
    this.uploadStatusText = document.getElementById('upload-status-text');
    this.uploadStatusPercent = document.getElementById('upload-status-percent');
    this.uploadProgressFill = document.getElementById('upload-progress-fill');
    this.uploadStepIndicator = document.getElementById('upload-step-indicator');
    this.uploadAlertBox = document.getElementById('upload-alert-box');
  }

  initEvents() {
    this.searchInput?.addEventListener('input', () => this.render());
    this.sortSelect?.addEventListener('change', () => this.render());

    // Triggers for opening Upload Modal
    this.btnHeaderUpload?.addEventListener('click', () => this.openUploadModal());
    this.btnUploadTrigger?.addEventListener('click', () => this.openUploadModal());

    // Close Modal events
    this.btnCloseUploadX?.addEventListener('click', () => this.closeUploadModal());
    this.btnCancelUpload?.addEventListener('click', () => this.closeUploadModal());
    this.modalUpload?.addEventListener('click', (e) => {
      if (e.target === this.modalUpload && !this.isUploading) {
        this.closeUploadModal();
      }
    });

    // Modal Dropzone click to select file
    this.modalDropzone?.addEventListener('click', () => this.modalFileInput?.click());
    this.modalFileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileSelected(e.target.files[0]);
      }
    });

    // Drag and Drop on Modal Dropzone
    if (this.modalDropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        this.modalDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.modalDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.modalDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.modalDropzone.classList.remove('dragover');
        });
      });

      this.modalDropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    // Drag and Drop on Reader Viewport Empty State
    if (this.readerDropzone) {
      this.readerDropzone.addEventListener('click', () => this.openUploadModal());
      
      ['dragenter', 'dragover'].forEach(name => {
        this.readerDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.readerDropzone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.readerDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          this.readerDropzone.classList.remove('drag-over');
        });
      });

      this.readerDropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.openUploadModal(e.dataTransfer.files[0]);
        }
      });
    }

    // Remove selected file in modal
    this.btnRemoveSelectedFile?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearSelectedFile();
    });

    // Submit upload in modal
    this.btnSubmitUpload?.addEventListener('click', () => {
      this.performUpload();
    });
  }

  /**
   * Open the book upload modal
   */
  openUploadModal(preselectedFile = null) {
    if (!this.modalUpload) return;
    this.modalUpload.classList.add('active');

    if (preselectedFile) {
      this.handleFileSelected(preselectedFile);
    } else {
      this.clearSelectedFile();
    }
  }

  /**
   * Close the book upload modal
   */
  closeUploadModal() {
    if (this.isUploading) return;
    if (this.modalUpload) {
      this.modalUpload.classList.remove('active');
    }
    this.clearSelectedFile();
  }

  /**
   * Handle user choosing a PDF file
   */
  handleFileSelected(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showUploadError('ឯកសារត្រូវតែជាប្រភេទ PDF ប៉ុណ្ណោះ (.pdf)');
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showUploadError('ទំហំឯកសារធំពេក (លើសពី 50 MB)');
      return;
    }

    this.selectedFile = file;

    // Clean initial title: remove .pdf and underscores
    const rawTitle = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim();

    if (this.selectedFileName) this.selectedFileName.textContent = file.name;
    if (this.selectedFileSize) this.selectedFileSize.textContent = this.formatFileSize(file.size);
    if (this.inputCustomTitle) this.inputCustomTitle.value = rawTitle;

    if (this.modalDropzone) this.modalDropzone.style.display = 'none';
    if (this.selectedFileCard) this.selectedFileCard.style.display = 'flex';
    if (this.groupCustomTitle) this.groupCustomTitle.style.display = 'flex';
    if (this.btnSubmitUpload) this.btnSubmitUpload.disabled = false;
    if (this.uploadAlertBox) this.uploadAlertBox.style.display = 'none';
    if (this.uploadProgressWrapper) this.uploadProgressWrapper.style.display = 'none';
  }

  /**
   * Reset file selection inside modal
   */
  clearSelectedFile() {
    this.selectedFile = null;
    if (this.modalFileInput) this.modalFileInput.value = '';
    if (this.fileInput) this.fileInput.value = '';

    if (this.modalDropzone) this.modalDropzone.style.display = 'block';
    if (this.selectedFileCard) this.selectedFileCard.style.display = 'none';
    if (this.groupCustomTitle) this.groupCustomTitle.style.display = 'none';
    if (this.btnSubmitUpload) this.btnSubmitUpload.disabled = true;
    if (this.uploadAlertBox) this.uploadAlertBox.style.display = 'none';
    if (this.uploadProgressWrapper) this.uploadProgressWrapper.style.display = 'none';
    this.resetUploadButtons();
  }

  /**
   * Display upload error inside modal
   */
  showUploadError(message) {
    if (!this.uploadAlertBox) return;
    this.uploadAlertBox.textContent = `⚠️ ${message}`;
    this.uploadAlertBox.className = 'upload-alert-box error';
    this.uploadAlertBox.style.display = 'block';
  }

  resetUploadButtons() {
    if (this.btnSubmitUpload) this.btnSubmitUpload.disabled = !this.selectedFile;
    if (this.btnCancelUpload) this.btnCancelUpload.disabled = false;
    if (this.btnCloseUploadX) this.btnCloseUploadX.disabled = false;
    if (this.btnRemoveSelectedFile) this.btnRemoveSelectedFile.disabled = false;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Execute upload with real-time XMLHttpRequest progress
   */
  performUpload() {
    if (!this.selectedFile || this.isUploading) return;

    this.isUploading = true;
    if (this.btnSubmitUpload) this.btnSubmitUpload.disabled = true;
    if (this.btnCancelUpload) this.btnCancelUpload.disabled = true;
    if (this.btnCloseUploadX) this.btnCloseUploadX.disabled = true;
    if (this.btnRemoveSelectedFile) this.btnRemoveSelectedFile.disabled = true;

    if (this.uploadAlertBox) this.uploadAlertBox.style.display = 'none';
    if (this.uploadProgressWrapper) this.uploadProgressWrapper.style.display = 'flex';
    if (this.uploadProgressFill) this.uploadProgressFill.style.width = '0%';
    if (this.uploadStatusPercent) this.uploadStatusPercent.textContent = '0%';
    if (this.uploadStatusText) this.uploadStatusText.textContent = 'កំពុងផ្ទុកឡើងឯកសារ PDF...';
    if (this.uploadStepIndicator) this.uploadStepIndicator.textContent = 'ជំហានទី ១/២: កំពុងបញ្ជូនឯកសារ PDF ទៅកាន់ Server...';

    const formData = new FormData();
    formData.append('pdf', this.selectedFile);

    const customTitle = this.inputCustomTitle?.value.trim();
    if (customTitle) {
      formData.append('customTitle', customTitle);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/books/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Upload progress (0% - 85%)
        const percent = Math.min(85, Math.round((e.loaded / e.total) * 85));
        if (this.uploadProgressFill) this.uploadProgressFill.style.width = `${percent}%`;
        if (this.uploadStatusPercent) this.uploadStatusPercent.textContent = `${percent}%`;
        
        if (percent >= 85) {
          if (this.uploadStatusText) this.uploadStatusText.textContent = 'កំពុងវិភាគ និងរៀបចំអក្សរខ្មែរ...';
          if (this.uploadStepIndicator) this.uploadStepIndicator.textContent = 'ជំហានទី ២/២: កំពុងស្រង់អក្សរ និងបង្កើតលិបិក្រម (Khmer Text Indexing)...';
        }
      }
    };

    xhr.onload = async () => {
      this.isUploading = false;
      let resData = null;
      try {
        resData = JSON.parse(xhr.responseText);
      } catch (err) {
        // ignore parse error
      }

      if (xhr.status >= 200 && xhr.status < 300 && resData?.success) {
        if (this.uploadProgressFill) this.uploadProgressFill.style.width = '100%';
        if (this.uploadStatusPercent) this.uploadStatusPercent.textContent = '100%';
        if (this.uploadStatusText) this.uploadStatusText.textContent = 'ជោគជ័យ ១០០%!';
        if (this.uploadStepIndicator) this.uploadStepIndicator.textContent = 'បានបញ្ចូលសៀវភៅ និងរៀបចំអក្សរខ្មែររួចរាល់!';

        window.showToast('បានបញ្ចូលសៀវភៅថ្មីដោយជោគជ័យ!', 'success');

        setTimeout(async () => {
          this.closeUploadModal();
          await this.fetchBooks();
          if (resData.book?.id) {
            this.selectBook(resData.book.id);
          }
        }, 700);
      } else {
        const errMsg = resData?.error || 'បរាជ័យក្នុងការផ្ទុកឡើងឯកសារ';
        this.showUploadError(errMsg);
        this.resetUploadButtons();
      }
    };

    xhr.onerror = () => {
      this.isUploading = false;
      this.showUploadError('មានបញ្ហាបណ្តាញក្នុងការតភ្ជាប់ទៅកាន់ Server');
      this.resetUploadButtons();
    };

    xhr.send(formData);
  }

  async fetchBooks() {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      if (data.success) {
        this.books = data.books || [];
        this.render();
        
        // Auto-open sample book if available and no book opened yet
        if (!this.activeBookId && this.books.length > 0) {
          const sample = this.books.find(b => b.id === 'sample-khmer') || this.books[0];
          this.selectBook(sample.id);
        }
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  }

  render() {
    if (!this.container) return;

    const searchTerm = (this.searchInput?.value || '').toLowerCase().trim();
    const sortBy = this.sortSelect?.value || 'recent';

    let filtered = this.books.filter(b => {
      return b.title.toLowerCase().includes(searchTerm) || b.filename.toLowerCase().includes(searchTerm);
    });

    if (sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'pages') {
      filtered.sort((a, b) => (b.totalPages || 0) - (a.totalPages || 0));
    } else {
      // Recent
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding: 24px 10px; color: var(--text-tertiary); font-size: 0.85rem;">
          ${searchTerm ? 'រកមិនឃើញសៀវភៅដែលត្រូវនឹងការស្វែងរកទេ' : 'មិនទាន់មានសៀវភៅក្នុងបណ្ណាល័យទេ'}
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered.map(book => {
      const isActive = book.id === this.activeBookId;
      const initial = (book.title.trim().charAt(0) || '📖').toUpperCase();
      const pagesLabel = book.totalPages ? `${book.totalPages} ទំព័រ` : 'ដំណើរការ...';
      const scannedBadge = book.isScanned ? '<span style="color:var(--accent-gold); font-size:0.7rem;">(ស្កេន)</span>' : '';

      return `
        <div class="book-card ${isActive ? 'active' : ''}" data-id="${book.id}">
          <div class="book-cover-badge">${initial}</div>
          <div class="book-info">
            <div class="book-title" title="${book.title}">${book.title}</div>
            <div class="book-meta">
              <span>📄 ${pagesLabel}</span>
              <span>•</span>
              <span>💾 ${book.sizeFormatted}</span>
              ${scannedBadge}
            </div>
          </div>
          <div class="book-card-actions">
            <button class="btn-icon btn-delete-book" data-id="${book.id}" title="លុបសៀវភៅ (Delete)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    this.container.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-book')) return;
        const id = card.dataset.id;
        this.selectBook(id);
      });
    });

    this.container.querySelectorAll('.btn-delete-book').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteBook(id);
      });
    });
  }

  async selectBook(bookId) {
    this.activeBookId = bookId;
    this.render();

    const book = this.books.find(b => b.id === bookId);
    if (book && window.pdfReader) {
      window.pdfReader.loadBook(book);
    }
  }

  async deleteBook(bookId) {
    const book = this.books.find(b => b.id === bookId);
    const title = book?.title || 'សៀវភៅនេះ';
    if (!confirm(`តើអ្នកពិតជាចង់លុប "${title}" ចេញពីបណ្ណាល័យមែនទេ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        window.showToast('បានលុបសៀវភៅដោយជោគជ័យ', 'success');
        if (this.activeBookId === bookId) {
          this.activeBookId = null;
          if (window.pdfReader) window.pdfReader.closeBook();
        }
        await this.fetchBooks();
      } else {
        window.showToast(data.error || 'មិនអាចលុបសៀវភៅបានទេ', 'error');
      }
    } catch (err) {
      window.showToast(`កំហុស: ${err.message}`, 'error');
    }
  }
}

window.libraryManager = new LibraryManager();
