/**
 * Application Bootstrap & Main Controller
 * Handles global theme switching, responsive sidebar toggling,
 * keyboard shortcuts, and toast notifications.
 */

const CURRENT_APP_VERSION = '2.3.3';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebars();
  initTabs();
  initKeyboardShortcuts();
  initMobileSupport();
  initUpdateManager();

  // Load initial settings and library books
  if (window.settingsManager) {
    window.settingsManager.loadSettings();
  }
  if (window.libraryManager) {
    window.libraryManager.fetchBooks();
  }
});

// Toast Notification System
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// Theme Management
function initTheme() {
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const themeIcon = document.getElementById('theme-icon');
  
  const savedTheme = localStorage.getItem('khmer_reader_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  btnToggleTheme?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('khmer_reader_theme', next);
    if (themeIcon) {
      themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
    }
  });
}

// Sidebar Toggles & Mobile Drawer Controller
function initSidebars() {
  const btnToggleLibrary = document.getElementById('btn-toggle-library');
  const btnToggleAi = document.getElementById('btn-toggle-ai');
  const sidebarLeft = document.getElementById('sidebar-left');
  const sidebarRight = document.getElementById('sidebar-right');
  const backdrop = document.getElementById('mobile-drawer-backdrop');

  const isMobile = () => window.innerWidth <= 768;

  // On small mobile screens, ensure sidebars start collapsed so user sees reader
  if (isMobile()) {
    sidebarLeft?.classList.add('collapsed');
    sidebarRight?.classList.add('collapsed');
    btnToggleLibrary?.classList.remove('active');
    btnToggleAi?.classList.remove('active');
  }

  function updateBackdrop() {
    if (!backdrop) return;
    const isLeftOpen = !sidebarLeft?.classList.contains('collapsed');
    const isRightOpen = !sidebarRight?.classList.contains('collapsed');
    if (isMobile() && (isLeftOpen || isRightOpen)) {
      backdrop.classList.add('active');
    } else {
      backdrop.classList.remove('active');
    }
  }

  btnToggleLibrary?.addEventListener('click', () => {
    const willOpen = sidebarLeft?.classList.contains('collapsed');
    if (isMobile() && willOpen) {
      // Close right sidebar if opening left
      sidebarRight?.classList.add('collapsed');
      btnToggleAi?.classList.remove('active');
    }
    sidebarLeft?.classList.toggle('collapsed');
    btnToggleLibrary.classList.toggle('active', !sidebarLeft?.classList.contains('collapsed'));
    updateBackdrop();
  });

  btnToggleAi?.addEventListener('click', () => {
    const willOpen = sidebarRight?.classList.contains('collapsed');
    if (isMobile() && willOpen) {
      // Close left sidebar if opening right
      sidebarLeft?.classList.add('collapsed');
      btnToggleLibrary?.classList.remove('active');
    }
    sidebarRight?.classList.toggle('collapsed');
    btnToggleAi.classList.toggle('active', !sidebarRight?.classList.contains('collapsed'));
    updateBackdrop();
  });

  // Tapping backdrop closes all open drawers on mobile
  backdrop?.addEventListener('click', () => {
    sidebarLeft?.classList.add('collapsed');
    sidebarRight?.classList.add('collapsed');
    btnToggleLibrary?.classList.remove('active');
    btnToggleAi?.classList.remove('active');
    updateBackdrop();
  });

  // Resize handler: adapt sidebars smoothly between desktop and mobile
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      backdrop?.classList.remove('active');
    }
  });
}

// Mobile Bottom Navigation Bar & Mobile Network Discovery
function initMobileSupport() {
  const btnMobileLibrary = document.getElementById('btn-mobile-nav-library');
  const btnMobilePrev = document.getElementById('btn-mobile-prev-page');
  const btnMobileNext = document.getElementById('btn-mobile-next-page');
  const btnMobileRead = document.getElementById('btn-mobile-read-aloud');
  const btnMobileAi = document.getElementById('btn-mobile-nav-ai');
  const pageCounterBox = document.getElementById('mobile-page-counter-box');

  const btnToggleLibrary = document.getElementById('btn-toggle-library');
  const btnToggleAi = document.getElementById('btn-toggle-ai');

  btnMobileLibrary?.addEventListener('click', () => {
    btnToggleLibrary?.click();
  });

  btnMobileAi?.addEventListener('click', () => {
    btnToggleAi?.click();
  });

  btnMobilePrev?.addEventListener('click', () => {
    window.pdfReader?.goToPrevPage();
  });

  btnMobileNext?.addEventListener('click', () => {
    window.pdfReader?.goToNextPage();
  });

  btnMobileRead?.addEventListener('click', () => {
    window.pdfReader?.readCurrentPageAloud();
  });

  // Tap page counter on mobile to jump directly to page
  pageCounterBox?.addEventListener('click', () => {
    const total = window.pdfReader?.totalPages || 1;
    const current = window.pdfReader?.currentPage || 1;
    const input = prompt(`បញ្ចូលលេខទំព័រដែលចង់អាន (១ ដល់ ${total}):`, current);
    if (input !== null) {
      const pageNum = parseInt(input.trim(), 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= total) {
        window.pdfReader?.goToPage(pageNum);
      } else {
        window.showToast('លេខទំព័រមិនត្រឹមត្រូវ', 'error');
      }
    }
  });

  // Load Mobile Network URL for phone access
  loadMobileNetworkUrl();
}

async function loadMobileNetworkUrl() {
  const urlEl = document.getElementById('mobile-network-url');
  const copyBtn = document.getElementById('btn-copy-mobile-url');
  if (!urlEl) return;

  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();
    if (data.success && data.mobileUrl) {
      urlEl.textContent = data.mobileUrl;
      copyBtn?.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.mobileUrl).then(() => {
            window.showToast('បានចម្លង Link សម្រាប់ទូរស័ព្ទដៃរួចរាល់!', 'success');
          }).catch(() => fallbackCopy(data.mobileUrl));
        } else {
          fallbackCopy(data.mobileUrl);
        }
      });
    } else {
      urlEl.textContent = window.location.origin;
    }
  } catch (e) {
    urlEl.textContent = window.location.origin;
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  window.showToast('បានចម្លង Link រួចរាល់!', 'success');
}

// Sidebar Tabs (Library / Thumbnails / Bookmarks)
function initTabs() {
  const tabButtons = document.querySelectorAll('.sidebar-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Keyboard Shortcuts
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts if focus is inside text input or textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    // Page navigation: Arrow Left / Arrow Right
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      window.pdfReader?.goToPrevPage();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      window.pdfReader?.goToNextPage();
    }

    // Search shortcut: Ctrl+F or Cmd+F
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const searchInput = document.getElementById('input-pdf-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Escape closes modal or selection toolbar
    if (e.key === 'Escape') {
      window.settingsManager?.closeModal();
      window.pdfReader?.hideSelectionToolbar();
    }
  });
}

// --------------------------------------------------------------------------
// Update & Version Management System
// --------------------------------------------------------------------------
function initUpdateManager() {
  const headerBadge = document.getElementById('header-version-badge');
  const settingsVersion = document.getElementById('settings-current-version');
  const bannerVersionTag = document.getElementById('banner-version-tag');
  const bannerDesc = document.getElementById('banner-version-desc');
  const updateBanner = document.getElementById('app-update-banner');
  const btnApplyUpdate = document.getElementById('btn-apply-update');
  const btnDismissUpdate = document.getElementById('btn-dismiss-update');
  const btnManualUpdate = document.getElementById('btn-manual-update');
  const settingsVersionStatus = document.getElementById('settings-version-status');

  // Display version number in header and settings
  if (headerBadge) headerBadge.textContent = 'v' + CURRENT_APP_VERSION;
  if (settingsVersion) settingsVersion.textContent = 'v' + CURRENT_APP_VERSION;

  async function checkVersion() {
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.version) return;

      if (data.version !== CURRENT_APP_VERSION) {
        console.log(`[UpdateManager] New version available: v${data.version} (current: v${CURRENT_APP_VERSION})`);
        if (bannerVersionTag) bannerVersionTag.textContent = 'v' + data.version;
        if (bannerDesc && data.changelog) bannerDesc.textContent = data.changelog;
        if (updateBanner) updateBanner.style.display = 'flex';
        if (settingsVersionStatus) {
          settingsVersionStatus.innerHTML = `<span style="color: #ef4444; font-weight: 700;">⚠️ មានកំណែថ្មី v${data.version}!</span>`;
        }
      } else {
        if (settingsVersionStatus) {
          settingsVersionStatus.innerHTML = '<span class="status-up-to-date">● ចុងក្រោយបង្អស់</span>';
        }
      }
    } catch (err) {
      console.warn('[UpdateManager] Check version skipped:', err);
    }
  }

  // Perform a clean cache-busting update
  async function performForceUpdate() {
    window.showToast?.('កំពុងលុប Cache និងផ្ទុកកំណែថ្មី...', 'info');

    // 1. Tell active Service Worker to clear caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
      navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
    }

    // 2. Clear client CacheStorage directly
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
        console.log('[UpdateManager] All caches cleared.');
      } catch (err) {
        console.warn('Cache clear error:', err);
      }
    }

    // 3. Unregister all Service Worker registrations to avoid serving old cached scripts
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        console.log('[UpdateManager] Service workers unregistered.');
      } catch (err) {
        console.warn('SW unregister error:', err);
      }
    }

    // 4. Force hard reload with timestamp query string
    setTimeout(() => {
      const targetUrl = window.location.origin + window.location.pathname + '?forceUpdate=' + Date.now();
      window.location.href = targetUrl;
    }, 350);
  }

  btnApplyUpdate?.addEventListener('click', performForceUpdate);
  btnManualUpdate?.addEventListener('click', performForceUpdate);
  btnDismissUpdate?.addEventListener('click', () => {
    if (updateBanner) updateBanner.style.display = 'none';
  });

  // Register Service Worker with update detection
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            checkVersion();
          }
        });
      });
    }).catch((err) => {
      console.log('SW registration optional:', err);
    });
  }

  // Check immediately
  checkVersion();

  // Check when tab or phone screen wakes up
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkVersion();
    }
  });

  // Periodic check every 60 seconds
  setInterval(checkVersion, 60000);
}

