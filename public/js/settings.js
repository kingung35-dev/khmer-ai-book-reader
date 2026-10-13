/**
 * Settings Module
 * Manages client settings, API key configuration, and live connection testing.
 */

class SettingsManager {
  constructor() {
    this.config = null;
    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.modal = document.getElementById('modal-settings');
    this.btnOpen = document.getElementById('btn-open-settings');
    this.btnClose = document.getElementById('btn-close-settings');
    this.btnCloseX = document.getElementById('btn-close-settings-x');
    this.btnSave = document.getElementById('btn-save-settings');
    this.btnTest = document.getElementById('btn-test-connection');
    this.btnToggleKey = document.getElementById('btn-toggle-key-visibility');

    this.inputKey = document.getElementById('setting-gemini-key');
    this.selectModel = document.getElementById('setting-model-select');
    this.selectLang = document.getElementById('setting-lang-select');
    this.testResult = document.getElementById('test-connection-result');
    this.statusPill = document.getElementById('ai-status-pill');
  }

  initEvents() {
    this.btnOpen?.addEventListener('click', () => this.openModal());
    this.btnClose?.addEventListener('click', () => this.closeModal());
    this.btnCloseX?.addEventListener('click', () => this.closeModal());

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    this.btnToggleKey?.addEventListener('click', () => {
      if (this.inputKey.type === 'password') {
        this.inputKey.type = 'text';
        this.btnToggleKey.textContent = '🔒';
      } else {
        this.inputKey.type = 'password';
        this.btnToggleKey.textContent = '👁️';
      }
    });

    this.btnTest?.addEventListener('click', () => this.testConnection());
    this.btnSave?.addEventListener('click', () => this.saveSettings());
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        this.config = data.settings;
        this.updateUI();
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }

  updateUI() {
    if (!this.config) return;

    if (this.selectModel) this.selectModel.value = this.config.model;
    if (this.selectLang) this.selectLang.value = this.config.defaultLanguage;

    if (this.config.hasApiKey) {
      this.inputKey.placeholder = `បច្ចុប្បន្ន: ${this.config.maskedApiKey}`;
      this.statusPill.textContent = `${this.config.model} 🟢`;
      this.statusPill.classList.remove('needs-key');
    } else {
      this.inputKey.placeholder = 'បញ្ចូល Google Gemini API Key...';
      this.statusPill.textContent = '⚠️ បញ្ចូល API Key';
      this.statusPill.classList.add('needs-key');
    }
  }

  openModal() {
    this.testResult.style.display = 'none';
    this.modal.classList.add('active');
  }

  closeModal() {
    this.modal.classList.remove('active');
  }

  async testConnection() {
    const key = this.inputKey.value.trim();
    const model = this.selectModel?.value || 'gemini-3.8-flash';
    this.testResult.style.display = 'block';
    this.testResult.style.backgroundColor = 'var(--bg-tertiary)';
    this.testResult.style.color = 'var(--text-primary)';
    this.testResult.innerHTML = '<span class="spinner" style="display:inline-block; vertical-align:middle; margin-right:8px;"></span> កំពុងសាកល្បងតភ្ជាប់ទៅកាន់ Google Gemini API...';

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, model })
      });
      const data = await res.json();

      if (data.success) {
        this.testResult.style.backgroundColor = 'var(--accent-success-subtle)';
        this.testResult.style.color = 'var(--accent-success)';
        this.testResult.innerHTML = `✅ <strong>ជោគជ័យ!</strong> ${data.message}`;
      } else {
        this.testResult.style.backgroundColor = 'var(--accent-danger-subtle)';
        this.testResult.style.color = 'var(--accent-danger)';
        this.testResult.innerHTML = `❌ <strong>បរាជ័យ:</strong> ${data.message}`;
      }
    } catch (err) {
      this.testResult.style.backgroundColor = 'var(--accent-danger-subtle)';
      this.testResult.style.color = 'var(--accent-danger)';
      this.testResult.innerHTML = `❌ កំហុសបណ្តាញ: ${err.message}`;
    }
  }

  async saveSettings() {
    const key = this.inputKey.value.trim();
    const model = this.selectModel.value;
    const defaultLanguage = this.selectLang.value;

    const payload = {
      model,
      defaultLanguage
    };

    if (key.length > 0) {
      payload.apiKey = key;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.config = data.settings;
        this.updateUI();
        this.closeModal();
        window.showToast('បានរក្សាទុកការកំណត់ដោយជោគជ័យ!', 'success');
      } else {
        alert(data.error || 'បរាជ័យក្នុងការរក្សាទុក');
      }
    } catch (err) {
      alert(`កំហុស: ${err.message}`);
    }
  }
}

window.settingsManager = new SettingsManager();
