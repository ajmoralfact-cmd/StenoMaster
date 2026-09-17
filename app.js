/**
 * StenoMaster Main Client Application
 * Master Controller for State, Routing, Views, Authentication, and Interactions
 */

class StenoApp {
  constructor() {
    this.apiBase = '';
    this.token = localStorage.getItem('stenomaster_token') || null;
    this.user = null;
    this.activeView = 'home';
    this.currentPassage = null;
    this.categories = [];
    this.passages = [];
    this.bookmarks = new Set();
    this.selectedCategory = 'all';
    this.selectedLanguage = 'all';
    this.selectedDifficulty = 'all';
    this.searchQuery = '';
    this.currentExamRule = 'ssc_steno';
        this.subscriptionPlans = [
      { id: '1m', days: 30, price: 100, title_hi: '1 माह (30 दिन)', subtitle_hi: 'बेसिक मासिक अभ्यास', name: 'StenoMaster Pro — 1 Month' },
      { id: '3m', days: 90, price: 250, title_hi: '3 माह (90 दिन)', subtitle_hi: 'सबसे लोकप्रिय प्लान', savings: '₹50 की बचत', popular: true, name: 'StenoMaster Pro — 3 Months' },
      { id: '6m', days: 180, price: 450, title_hi: '6 माह (180 दिन)', subtitle_hi: 'सुपर सेवर प्लान', savings: '₹150 की बचत', name: 'StenoMaster Pro — 6 Months' },
      { id: '1y', days: 365, price: 800, title_hi: '1 वर्ष (365 दिन)', subtitle_hi: 'सर्वश्रेष्ठ वार्षिक मूल्य', savings: '₹400 की बचत', name: 'StenoMaster Pro — 1 Year' }
    ];
    this.selectedPlan = null;
    this.allPassages = [];
    this.selectedTypingSystem = localStorage.getItem('stenomaster_preferred_font') || localStorage.getItem('stenomaster_typing_mode') || 'mangal_unicode';
    if (this.selectedTypingSystem === 'krutidev') this.selectedTypingSystem = 'kruti_dev_010';

    // Restore cached user and passages immediately for instant 0ms startup
    try {
      const cachedUser = localStorage.getItem('stenomaster_user');
      if (cachedUser) {
        this.user = JSON.parse(cachedUser);
      }
    } catch(e) {}
    try {
      const cached = localStorage.getItem('stenomaster_cached_passages');
      if (cached) {
        this.allPassages = JSON.parse(cached);
        this.passages = [...this.allPassages];
      }
    } catch(e) {}
    try {
      const cachedCats = localStorage.getItem('stenomaster_cached_categories');
      if (cachedCats) {
        this.categories = JSON.parse(cachedCats);
      }
    } catch(e) {}

    this.init();
  }

  setExamRule(rule, showNotification = true) {
    this.currentExamRule = rule === 'upsssc' ? 'upsssc' : 'ssc_steno';
    const sscBtn = document.getElementById('examRuleSscBtn');
    const upssscBtn = document.getElementById('examRuleUpssscBtn');

    if (this.currentExamRule === 'upsssc') {
      if (upssscBtn) {
        upssscBtn.style.background = '#7c3aed';
        upssscBtn.style.color = '#fff';
        upssscBtn.style.borderColor = '#7c3aed';
      }
      if (sscBtn) {
        sscBtn.style.background = 'transparent';
        sscBtn.style.color = 'var(--text-secondary)';
        sscBtn.style.borderColor = 'var(--border)';
      }
      if (showNotification) {
        this.showToast('🏛️ UPSSSC स्किल टेस्ट नियम सक्रिय (25 WPM + 5% त्रुटि सीमा)', 'info');
      }
    } else {
      if (sscBtn) {
        sscBtn.style.background = '#0284c7';
        sscBtn.style.color = '#fff';
        sscBtn.style.borderColor = '#0284c7';
      }
      if (upssscBtn) {
        upssscBtn.style.background = 'transparent';
        upssscBtn.style.color = 'var(--text-secondary)';
        upssscBtn.style.borderColor = 'var(--border)';
      }
      if (showNotification) {
        this.showToast('🎯 SSC स्टेनोग्राफर नियम सक्रिय (Grade C & D: 5%/7% कटऑफ)', 'info');
      }
    }
  }

  setPreferredFont(font) {
    const normalizedFont = (font === 'krutidev' || font === 'kruti_dev_010') ? 'kruti_dev_010' : 'mangal_unicode';
    localStorage.setItem('stenomaster_preferred_font', normalizedFont);
    localStorage.setItem('stenomaster_typing_mode', normalizedFont === 'kruti_dev_010' ? 'krutidev' : 'mangal');
    this.selectedTypingSystem = normalizedFont;
    this.updateFontSwitcherUI();
    const fontName = normalizedFont === 'kruti_dev_010' ? 'कृति देव 010 (Kruti Dev)' : 'मंगल / यूनिकोड (Mangal / Unicode)';
    this.showToast(`⌨️ टाइपिंग फ़ॉन्ट चुना गया: ${fontName}`, 'info');
  }

  updateFontSwitcherUI() {
    const saved = localStorage.getItem('stenomaster_preferred_font') || this.selectedTypingSystem || 'mangal_unicode';
    const isKruti = saved === 'kruti_dev_010' || saved === 'krutidev';

    const mangalBtn = document.getElementById('classesFontMangalBtn');
    const krutiBtn = document.getElementById('classesFontKrutiBtn');

    if (mangalBtn) {
      mangalBtn.style.background = isKruti ? 'transparent' : '#0284c7';
      mangalBtn.style.color = isKruti ? 'var(--text-secondary)' : '#fff';
      mangalBtn.style.border = isKruti ? '1px solid var(--border)' : 'none';
    }
    if (krutiBtn) {
      krutiBtn.style.background = isKruti ? '#d97706' : 'transparent';
      krutiBtn.style.color = isKruti ? '#fff' : 'var(--text-secondary)';
      krutiBtn.style.border = isKruti ? 'none' : '1px solid var(--border)';
    }
  }

  // -------------------------------------------------------------------------
  // Browser Native-Style Top Loading Progress Bar
  // -------------------------------------------------------------------------
  startTopLoading() {
    this._activeLoadingOps = (this._activeLoadingOps || 0) + 1;
    const bar = document.getElementById('topLoadingProgressBar');
    if (!bar) return;

    bar.classList.remove('is-done');
    bar.classList.add('is-loading');

    // Safety Watchdog: Never let loading bar stay stuck longer than 2.5s
    clearTimeout(this._topLoadingWatchdog);
    this._topLoadingWatchdog = setTimeout(() => {
      this._activeLoadingOps = 0;
      this.finishTopLoading();
    }, 2500);

    if (this._activeLoadingOps === 1 || !this._topLoadingTimer) {
      bar.style.width = '28%';
      if (this._topLoadingTimer) clearInterval(this._topLoadingTimer);
      let progress = 28;
      this._topLoadingTimer = setInterval(() => {
        if (progress < 85) {
          progress += Math.max(1, (85 - progress) * 0.18);
          bar.style.width = `${progress}%`;
        }
      }, 120);
    }
  }

  finishTopLoading() {
    clearTimeout(this._topLoadingWatchdog);
    this._activeLoadingOps = Math.max(0, (this._activeLoadingOps || 1) - 1);
    const bar = document.getElementById('topLoadingProgressBar');
    if (!bar) return;

    if (this._activeLoadingOps === 0) {
      if (this._topLoadingTimer) {
        clearInterval(this._topLoadingTimer);
        this._topLoadingTimer = null;
      }
      bar.style.width = '100%';
      bar.classList.remove('is-loading');
      bar.classList.add('is-done');
      setTimeout(() => {
        if (this._activeLoadingOps === 0) {
          bar.classList.remove('is-done');
          bar.style.width = '0%';
        }
      }, 350);
    }
  }

  // -------------------------------------------------------------------------
  // Deep URL Hash Routing & Refresh Route Preservation
  // -------------------------------------------------------------------------
  restoreRouteOnLoad(customRoute = null) {
    let route = customRoute;
    if (!route) {
      route = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : '';
    }
    // When visiting root domain directly without hash, ALWAYS default to 'home'! Never restore stale transient views.
    if (!route) {
      route = 'home';
    }

    const isAdmin = Boolean(this.user && this.user.role === 'admin');

    const [pathPart, queryStr] = route.split('?');
    const path = pathPart.replace(/^\/+|\/+$/g, '');
    const params = {};
    if (queryStr) {
      queryStr.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    // 1. Admin route
    if (path.startsWith('admin')) {
      if (!isAdmin) {
        this.showToast('एडमिन एक्सेस के लिए एडमिन आईडी से लॉगिन करें।', 'warning');
        this.navigate('home', {}, true);
        return;
      }
      window.location.href = '/admin.html';
      return;
    }

    // 2. Typing Practice test session
    if (path === 'practice') {
      const passageId = params.id ? parseInt(params.id, 10) : null;
      if (passageId) {
        this.openPractice(passageId, params.system);
      } else {
        this.navigate('classes', {}, true);
      }
      return;
    }

    // 2b. Category detail direct URL restore
    if (path === 'category-detail') {
      const catId = params.id ? parseInt(params.id, 10) : null;
      if (catId) {
        this.openCategoryDetail(catId);
      } else {
        this.navigate('classes', {}, true);
      }
      return;
    }

    // 3. Result report - fallback to home if no active report exists
    if (path === 'result') {
      const reportContainer = document.getElementById('resultReportContainer');
      if (!reportContainer || !reportContainer.firstElementChild) {
        this.navigate(isAdmin ? 'admin' : 'home', {}, true);
        return;
      }
    }

    // 4. Known valid student views
    const validViews = [
      'home', 'classes', 'self-practice', 'subscription', 'result', 'my-practice',
      'progress', 'leaderboard', 'bookmarks', 'profile', 'refer',
      'notifications', 'settings', 'rules', 'founder', 'category-detail', 'help'
    ];

    if (validViews.includes(path)) {
      this.navigate(path, params, false, true);
    } else {
      this.navigate(isAdmin ? 'admin' : 'home', {}, true);
    }
  }

  handleHashChange() {
    if (!this.user || !this.token) return;
    const rawHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : '';
    if (!rawHash) return;

    const [pathPart, queryStr] = rawHash.split('?');
    const path = pathPart.replace(/^\/+|\/+$/g, '');
    const params = {};
    if (queryStr) {
      queryStr.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    if (path.startsWith('admin')) {
      const isAdmin = Boolean(this.user && this.user.role === 'admin');
      if (isAdmin) {
        window.location.href = '/admin.html';
      }
      return;
    }

    if (path === 'category-detail' && params.id) {
      const catId = parseInt(params.id, 10);
      if (this.currentCategoryId !== catId || this.activeView !== 'category-detail') {
        this.openCategoryDetail(catId);
      }
      return;
    }

    if (path === 'practice' && params.id) {
      const pId = parseInt(params.id, 10);
      if (!this.currentPassage || this.currentPassage.id !== pId) {
        this.openPractice(pId, params.system);
      }
      return;
    }

    if (path !== this.activeView) {
      this.navigate(path, params, false, true);
    }
  }

  async init() {
    this.initTheme();
    this.initPWA();
    this.initNavigation();
    this.initSessionHeartbeat();
    this.captureReferralParam();

    // Check for Cashfree payment return redirect
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const returnOrderId = urlParams.get('order_id');
      if (returnOrderId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          this.verifyCashfreeOrder(returnOrderId);
        }, 400);
      }
    } catch(e) {}

    // Cross-tab real-time sync when Admin edits or deletes passages
    window.addEventListener('storage', (e) => {
      if (e.key === 'stenomaster_passages_version' || e.key === 'stenomaster_cached_passages') {
        this.loadPassages(true);
      }
    });

    // Hashchange listener for smooth browser Back/Forward navigation
    window.addEventListener('hashchange', () => this.handleHashChange());

    // 0ms Instant Hydration: If token exists, display immediate view with zero delay
    if (this.token) {
      this.hideAuthGateway();
      if (this.user) {
        this.updateUserUI();
      }
      this.restoreRouteOnLoad();

      // Parallel background refresh without blocking page render
      Promise.all([
        this.fetchCurrentUser().catch((err) => {
          if (err && err.status === 401) {
            this.showAuthGateway('student');
          }
        }),
        this.loadCategories().catch(() => {}),
        this.loadPassages().catch(() => {})
      ]);
      return;
    }

    // If no active session token, show Auth Gateway directly
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isTryingAdmin = hash.toLowerCase().includes('admin') || search.toLowerCase().includes('admin');
    this.showAuthGateway(isTryingAdmin ? 'admin' : 'student');
  }


  // -------------------------------------------------------------------------
  // Single-Device Session Heartbeat & Security Monitoring
  // -------------------------------------------------------------------------
  initSessionHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      if (!this.token) return;
      try {
        const res = await fetch('/api/auth/session-status', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && (data.error === 'concurrent_login' || data.code === 'CONCURRENT_LOGIN_DETECTED')) {
          this.handleConcurrentLoginEviction(data);
        }
      } catch (e) {
        // Ignore temporary network interruptions
      }
    }, 15000);
  }

  // -------------------------------------------------------------------------
  // Theme & PWA
  // -------------------------------------------------------------------------
  initTheme() {
    const savedTheme = localStorage.getItem('stenomaster_theme') || 'light';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stenomaster_theme', theme);
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  initPWA() {
    this.deferredPwaPrompt = null;

    // 1. Purge legacy demo credentials from previous tests
    try {
      const stuRaw = localStorage.getItem('stenomaster_saved_student_creds');
      if (stuRaw && (stuRaw.includes('student@stenomaster.com') || stuRaw.includes('student123'))) {
        localStorage.removeItem('stenomaster_saved_student_creds');
      }
      const adminRaw = localStorage.getItem('stenomaster_saved_admin_creds');
      if (adminRaw && (adminRaw.includes('admin@stenomaster.com') || adminRaw.includes('admin123'))) {
        localStorage.removeItem('stenomaster_saved_admin_creds');
      }
    } catch (e) {}

    // 2. Auto purge all browser caches when app version updates
    const APP_VERSION = 'v9.1';
    if (localStorage.getItem('stenomaster_client_version') !== APP_VERSION) {
      localStorage.setItem('stenomaster_client_version', APP_VERSION);
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js?v=9.0')
        .then((reg) => {
          reg.update().catch(() => {});
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Auto reload at most once per session to prevent infinite reload loops
                  if (!sessionStorage.getItem('stenomaster_sw_updated_once')) {
                    sessionStorage.setItem('stenomaster_sw_updated_once', 'true');
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(err => console.warn('ServiceWorker error:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPwaPrompt = null;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.style.display = 'none';
      this.showToast('🎉 StenoMaster ऐप सफलतापूर्वक इंस्टॉल हो गया!', 'success');
    });
  }

  installPwaApp() {
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      this.deferredPwaPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA installation');
        }
        this.deferredPwaPrompt = null;
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) installBtn.style.display = 'none';
      });
    } else {
      this.showToast('ब्राउज़र मेनू (⋮) से "Add to Home Screen" या "Install" चुनें।', 'info');
    }
  }

  // -------------------------------------------------------------------------
  // API Helper
  // -------------------------------------------------------------------------
  async apiCall(endpoint, method = 'GET', body = null, timeoutMs = 25000) {
    const isBackground = endpoint.includes('/session-status');
    if (!isBackground) {
      this.startTopLoading();
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const opts = { method, headers, signal: controller.signal };
    if (body) {
      opts.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(endpoint, opts);
      clearTimeout(timer);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Check for Single-Device Eviction (Another login detected)
        if (response.status === 401 && (data.error === 'concurrent_login' || data.code === 'CONCURRENT_LOGIN_DETECTED')) {
          this.handleConcurrentLoginEviction(data);
          const err = new Error(data.message || 'आपका खाता किसी अन्य डिवाइस पर लॉगिन हो गया है।');
          err.status = 401;
          err.concurrent = true;
          throw err;
        }

        const err = new Error(data.error || 'Server request failed');
        err.status = response.status;
        throw err;
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('सर्वर से प्रतिक्रिया में अधिक समय लगा (Network Timeout)');
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    } finally {
      if (!isBackground) {
        this.finishTopLoading();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Authentication Gateway & Role Selection
  // -------------------------------------------------------------------------
  showAuthGateway(tab = 'student', inlineError = null) {
    document.documentElement.classList.add('no-auth-session');
    const gateway = document.getElementById('authGatewayView');
    const appContainer = document.getElementById('appContainer');
    if (gateway) gateway.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';

    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isExplicitAdmin = hash.toLowerCase().includes('admin') || search.toLowerCase().includes('admin');

    const tabAdminBtn = document.getElementById('tabAdminBtn');
    const authControl = document.querySelector('.auth-segmented-control');
    if (tabAdminBtn) {
      tabAdminBtn.style.display = isExplicitAdmin ? 'inline-flex' : 'none';
    }
    if (authControl) {
      authControl.style.display = isExplicitAdmin ? 'flex' : 'none';
    }

    if (!isExplicitAdmin && tab === 'admin') {
      tab = 'student';
    }

    this.switchAuthTab(tab);
    this.loadSavedCredentials();
    this.initGoogleAuth();

    const stuErr = document.getElementById('stuAuthError');
    const adminErr = document.getElementById('adminAuthError');
    if (stuErr) { stuErr.style.display = 'none'; stuErr.textContent = ''; }
    if (adminErr) { adminErr.style.display = 'none'; adminErr.textContent = ''; }

    if (inlineError) {
      const errBox = tab === 'admin' ? adminErr : stuErr;
      if (errBox) {
        errBox.style.display = 'flex';
        errBox.textContent = inlineError;
      }
    }
  }

  hideAuthGateway() {
    document.documentElement.classList.remove('no-auth-session');
    const gateway = document.getElementById('authGatewayView');
    const appContainer = document.getElementById('appContainer');
    if (gateway) gateway.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  }

  loadSavedCredentials() {
    // 1. Student Saved Credentials (Only shown if previously saved ON THIS SPECIFIC DEVICE)
    try {
      const stuRaw = localStorage.getItem('stenomaster_saved_student_creds');
      const emailInp = document.getElementById('stuAuthEmail');
      const passInp = document.getElementById('stuAuthPassword');
      const card = document.getElementById('stuQuickLoginCard');
      const subTitleEl = document.getElementById('stuQuickLoginSubtitle');
      const nameEl = document.getElementById('stuQuickLoginName');
      const clearBtn = document.getElementById('stuClearSavedCredsBtn');

      if (stuRaw) {
        const stuCreds = JSON.parse(stuRaw);
        if (stuCreds && (stuCreds.email_or_username || stuCreds.password)) {
          if (emailInp) emailInp.value = stuCreds.email_or_username || '';
          if (passInp) passInp.value = stuCreds.password || '';
          if (card) card.style.display = 'block';
          if (subTitleEl) subTitleEl.textContent = 'इस डिवाइस पर सहेजा गया छात्र खाता:';
          if (nameEl) nameEl.textContent = stuCreds.name || stuCreds.email_or_username;
          if (clearBtn) clearBtn.style.display = 'inline-block';
        } else {
          if (card) card.style.display = 'none';
          if (clearBtn) clearBtn.style.display = 'none';
        }
      } else {
        // Fresh device or link shared with someone else: strictly leave empty
        if (emailInp) emailInp.value = '';
        if (passInp) passInp.value = '';
        if (card) card.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
      }
    } catch (e) {
      console.warn('Failed to load saved student credentials', e);
    }

    // 2. Admin Saved Credentials (Only shown if previously saved ON THIS SPECIFIC DEVICE)
    try {
      const adminRaw = localStorage.getItem('stenomaster_saved_admin_creds');
      const emailInp = document.getElementById('adminAuthEmail');
      const passInp = document.getElementById('adminAuthPassword');
      const card = document.getElementById('adminQuickLoginCard');
      const nameEl = document.getElementById('adminQuickLoginName');
      const clearBtn = document.getElementById('adminClearSavedCredsBtn');

      if (adminRaw) {
        const adminCreds = JSON.parse(adminRaw);
        if (adminCreds && (adminCreds.email_or_username || adminCreds.password)) {
          if (emailInp) emailInp.value = adminCreds.email_or_username || '';
          if (passInp) passInp.value = adminCreds.password || '';
          if (card) card.style.display = 'block';
          if (nameEl) nameEl.textContent = adminCreds.name || adminCreds.email_or_username || 'Administrator';
          if (clearBtn) clearBtn.style.display = 'inline-block';
        } else {
          if (card) card.style.display = 'none';
          if (clearBtn) clearBtn.style.display = 'none';
        }
      } else {
        // Fresh device: strictly leave empty
        if (emailInp) emailInp.value = '';
        if (passInp) passInp.value = '';
        if (card) card.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
      }
    } catch (e) {
      console.warn('Failed to load saved admin credentials', e);
    }
  }

  clearSavedStudentCreds() {
    localStorage.removeItem('stenomaster_saved_student_creds');
    const emailInp = document.getElementById('stuAuthEmail');
    const passInp = document.getElementById('stuAuthPassword');
    const card = document.getElementById('stuQuickLoginCard');
    const clearBtn = document.getElementById('stuClearSavedCredsBtn');
    if (emailInp) emailInp.value = '';
    if (passInp) passInp.value = '';
    if (card) card.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    this.showToast('सहेजी गई छात्र लॉगिन जानकारी हटा दी गई।', 'info');
  }

  clearSavedAdminCreds() {
    localStorage.removeItem('stenomaster_saved_admin_creds');
    const emailInp = document.getElementById('adminAuthEmail');
    const passInp = document.getElementById('adminAuthPassword');
    const card = document.getElementById('adminQuickLoginCard');
    const clearBtn = document.getElementById('adminClearSavedCredsBtn');
    if (emailInp) emailInp.value = '';
    if (passInp) passInp.value = '';
    if (card) card.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    this.showToast('सहेजी गई एडमिन लॉगिन जानकारी हटा दी गई।', 'info');
  }

  oneClickStudentLogin() {
    const stuRaw = localStorage.getItem('stenomaster_saved_student_creds');
    if (!stuRaw) {
      this.showToast('कृपया मोबाइल/ईमेल एवं पासवर्ड दर्ज करके लॉगिन करें।', 'info');
      return;
    }
    const stuCreds = JSON.parse(stuRaw);
    const emailInp = document.getElementById('stuAuthEmail');
    const passInp = document.getElementById('stuAuthPassword');
    if (emailInp) emailInp.value = stuCreds.email_or_username || '';
    if (passInp) passInp.value = stuCreds.password || '';
    this.handleStudentLogin();
  }

  oneClickAdminLogin() {
    const adminRaw = localStorage.getItem('stenomaster_saved_admin_creds');
    if (!adminRaw) {
      this.showToast('कृपया एडमिन ईमेल व पासवर्ड दर्ज करें।', 'info');
      return;
    }
    const adminCreds = JSON.parse(adminRaw);
    const emailInp = document.getElementById('adminAuthEmail');
    const passInp = document.getElementById('adminAuthPassword');
    if (emailInp) emailInp.value = adminCreds.email_or_username || '';
    if (passInp) passInp.value = adminCreds.password || '';
    this.handleAdminLogin();
  }

  async initGoogleAuth() {
    try {
      if (this._googleAuthInitialized) return;
      const res = await this.apiCall('/api/settings');
      const settings = res.settings || {};
      this.googleClientId = (settings.google_client_id || '').trim();
      this.googleAuthEnabled = settings.google_auth_enabled !== '0';

      const sec = document.getElementById('googleAuthSection');
      if (sec && !this.googleAuthEnabled) {
        sec.style.display = 'none';
        return;
      }

      const tryRender = () => {
        if (this.googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (response) => this.handleGoogleAuthResponse(response),
            auto_select: false
          });

          const container = document.getElementById('googleSignInButtonContainer');
          if (container) {
            container.innerHTML = '';
            window.google.accounts.id.renderButton(container, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320
            });
          }
          this._googleAuthInitialized = true;
        }
      };

      if (window.google && window.google.accounts) {
        tryRender();
      } else {
        let attempts = 0;
        const checkTimer = setInterval(() => {
          attempts++;
          if ((window.google && window.google.accounts) || attempts > 15) {
            clearInterval(checkTimer);
            if (window.google && window.google.accounts) tryRender();
          }
        }, 200);
      }
    } catch (e) {
      console.warn('Google Auth init check:', e);
    }
  }

  triggerGoogleAuth() {
    if (this.googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.prompt();
    } else {
      this.showToast('Google Client ID अभी एडमिन द्वारा सेट नहीं की गई है। कृपया नीचे दिए गए फ़ॉर्म से लॉगिन करें।', 'info');
    }
  }

  async handleGoogleAuthResponse(googleResp) {
    if (!googleResp || !googleResp.credential) {
      this.showToast('Google प्रमाणीकरण रद्द कर दिया गया।', 'warning');
      return;
    }

    try {
      this.showToast('Google से सत्यापन हो रहा है... ⏳', 'info');
      const res = await this.apiCall('/api/auth/google', 'POST', {
        credential: googleResp.credential,
        referral_code: localStorage.getItem('stenomaster_pending_referral') || ''
      });

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));

      this.closeModal('loginModal');
      this.hideAuthGateway();
      this.updateUserUI();
      await this.loadCategories();
      await this.loadPassages();

      const welcomeMsg = res.is_new 
        ? `स्वागतम्, ${this.user.display_name || this.user.username}! आपका नया छात्र खाता (ID: ${this.user.student_code || ''}) बन गया है 🎉` 
        : `स्वागतम्, ${this.user.display_name || this.user.username}! Google से लॉगिन सफल! 👋`;
      this.showToast(welcomeMsg, 'success');

      this.restoreRouteOnLoad('home');
    } catch (err) {
      this.showToast(err.message || 'Google लॉगिन विफल रहा।', 'error');
    }
  }

  switchAuthTab(tab) {
    const studentBtn = document.getElementById('tabStudentBtn');
    const adminBtn = document.getElementById('tabAdminBtn');
    const indicator = document.getElementById('authSliderIndicator');
    const studentPanel = document.getElementById('studentLoginPanel');
    const adminPanel = document.getElementById('adminLoginPanel');

    if (tab === 'admin') {
      if (studentBtn) { studentBtn.classList.remove('active'); studentBtn.setAttribute('aria-selected', 'false'); }
      if (adminBtn) { adminBtn.classList.add('active'); adminBtn.setAttribute('aria-selected', 'true'); }
      if (indicator) indicator.classList.add('slide-right');
      if (studentPanel) studentPanel.style.display = 'none';
      if (adminPanel) {
        adminPanel.style.display = 'block';
        this.loadSavedCredentials();
        const inp = document.getElementById('adminAuthEmail');
        if (inp && !inp.value) setTimeout(() => inp.focus(), 80);
      }
    } else {
      if (studentBtn) { studentBtn.classList.add('active'); studentBtn.setAttribute('aria-selected', 'true'); }
      if (adminBtn) { adminBtn.classList.remove('active'); adminBtn.setAttribute('aria-selected', 'false'); }
      if (indicator) indicator.classList.remove('slide-right');
      if (studentPanel) {
        studentPanel.style.display = 'block';
        this.loadSavedCredentials();
        const inp = document.getElementById('stuAuthEmail');
        if (inp && !inp.value) setTimeout(() => inp.focus(), 80);
      }
      if (adminPanel) adminPanel.style.display = 'none';
    }
  }

  switchStudentAuthMode(mode) {
    const loginBtn = document.getElementById('subTabLoginBtn');
    const signupBtn = document.getElementById('subTabSignupBtn');
    const loginForm = document.getElementById('studentSubLoginForm');
    const signupForm = document.getElementById('studentSubSignupForm');
    const errBox = document.getElementById('stuAuthError');
    const signErr = document.getElementById('stuSignupError');
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (signErr) { signErr.style.display = 'none'; signErr.textContent = ''; }

    if (mode === 'signup') {
      if (loginBtn) { loginBtn.style.background = 'transparent'; loginBtn.style.color = 'var(--text-secondary)'; }
      if (signupBtn) { signupBtn.style.background = 'var(--primary)'; signupBtn.style.color = '#fff'; }
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
      this.applyPendingReferralUI(localStorage.getItem('stenomaster_pending_referral') || '');
    } else {
      if (loginBtn) { loginBtn.style.background = 'var(--primary)'; loginBtn.style.color = '#fff'; }
      if (signupBtn) { signupBtn.style.background = 'transparent'; signupBtn.style.color = 'var(--text-secondary)'; }
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
    }
  }

  async handleStudentSignup(e) {
    if (e) e.preventDefault();
    const fullName = document.getElementById('stuRegFullName')?.value.trim();
    const phone = document.getElementById('stuRegPhone')?.value.trim();
    const email = document.getElementById('stuRegEmail')?.value.trim();
    const password = document.getElementById('stuRegPassword')?.value;
    const confirmPassword = document.getElementById('stuRegConfirmPassword')?.value;
    const targetExam = document.getElementById('stuRegTargetExam')?.value;
    const prefLanguage = document.getElementById('stuRegPrefLanguage')?.value;
    const prefMode = document.getElementById('stuRegPrefMode')?.value;
    const referralCode = document.getElementById('stuRegReferralCode')?.value.trim() || localStorage.getItem('stenomaster_pending_referral') || '';
    const errBox = document.getElementById('stuSignupError');
    const submitBtn = document.getElementById('stuSignupSubmitBtn');

    if (!fullName || !phone || !email || !password) {
      if (errBox) { errBox.style.display = 'flex'; errBox.textContent = 'सभी आवश्यक फ़ील्ड भरें। (All fields required)'; }
      return;
    }

    if (password !== confirmPassword) {
      if (errBox) { errBox.style.display = 'flex'; errBox.textContent = 'पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते। (Passwords do not match)'; }
      return;
    }

    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>खाता बनाया जा रहा है...</span>'; }

    try {
      const res = await this.apiCall('/api/auth/register-student', 'POST', {
        full_name: fullName,
        phone,
        email,
        password,
        confirm_password: confirmPassword,
        target_exam: targetExam,
        preferred_language: prefLanguage,
        preferred_typing_mode: prefMode,
        referral_code: referralCode
      });

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_student_registry_updated', Date.now().toString());
      localStorage.setItem('stenomaster_users_version', Date.now().toString());

      this.hideAuthGateway();
      this.updateUserUI();
      await this.loadCategories();
      await this.loadPassages();

      // Store credentials for modal and clipboard
      this._registeredCreds = {
        student_code: res.credentials?.student_code || this.user.student_code || 'STM-2026-000000',
        username: res.credentials?.username || this.user.username,
        email: res.credentials?.email || this.user.email,
        password: password
      };

      // Auto-save newly registered student credentials for instant 1-click login
      localStorage.setItem('stenomaster_saved_student_creds', JSON.stringify({
        email_or_username: this._registeredCreds.username,
        password: password,
        name: fullName
      }));

      // Populate & open Credentials Modal
      const codeEl = document.getElementById('credStudentCode');
      const userEl = document.getElementById('credUsername');
      const emailEl = document.getElementById('credEmail');
      const passEl = document.getElementById('credPassword');
      if (codeEl) codeEl.textContent = this._registeredCreds.student_code;
      if (userEl) userEl.textContent = this._registeredCreds.username;
      if (emailEl) emailEl.textContent = this._registeredCreds.email;
      if (passEl) passEl.textContent = this._registeredCreds.password;

      this.openModal('studentCredentialsModal');
    } catch (err) {
      if (errBox) {
        errBox.style.display = 'flex';
        errBox.textContent = err.message || 'पंजीकरण विफल रहा।';
      } else {
        this.showToast(err.message || 'पंजीकरण विफल रहा।', 'error');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>खाता बनाएं और अभ्यास शुरू करें (Create Account)</span> <span>→</span>'; }
    }
  }

  async handleStudentLogin(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('stuAuthEmail');
    const passInput = document.getElementById('stuAuthPassword');
    const errBox = document.getElementById('stuAuthError');
    const submitBtn = document.getElementById('stuLoginSubmitBtn');

    if (!emailInput || !passInput) return;
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      if (errBox) { errBox.style.display = 'flex'; errBox.textContent = 'Password is required.'; }
      return;
    }

    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>लॉगिन हो रहा है...</span>'; }

    try {
      const res = await this.apiCall('/api/auth/login', 'POST', {
        email_or_username: email,
        password: password
      });

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));

      // Save Student Credentials for 1-Click Login if Remember Me is checked
      const rememberStudent = document.getElementById('stuRememberMe')?.checked ?? true;
      if (rememberStudent) {
        localStorage.setItem('stenomaster_saved_student_creds', JSON.stringify({
          email_or_username: email,
          password: password,
          name: this.user.display_name || this.user.username
        }));
      } else {
        localStorage.removeItem('stenomaster_saved_student_creds');
      }

      this.hideAuthGateway();
      this.updateUserUI();
      await this.loadCategories();
      await this.loadPassages();

      this.showToast(`स्वागतम्, ${this.user.display_name || this.user.username}! 👋`, 'success');

      const redirectRoute = sessionStorage.getItem('stenomaster_redirect_after_login') || localStorage.getItem('stenomaster_last_route');
      sessionStorage.removeItem('stenomaster_redirect_after_login');

      if (this.user.role === 'admin') {
        window.location.href = '/admin.html';
        return;
      } else {
        this.restoreRouteOnLoad(redirectRoute && !redirectRoute.startsWith('admin') ? redirectRoute : 'home');
      }
    } catch (err) {
      const msg = err.status === 401 ? 'Invalid username or password.' : (err.message || 'Login failed.');
      if (errBox) {
        errBox.style.display = 'flex';
        errBox.textContent = msg;
      } else {
        this.showToast(msg, 'error');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>लॉगिन करें (Login)</span> <span>→</span>'; }
    }
  }

  async login(emailOrUser, password) {
    const email = (emailOrUser || '').trim();
    const pwd = password || '';
    if (!email || !pwd) {
      this.showToast('कृपया ईमेल/यूज़रनेम और पासवर्ड दर्ज करें।', 'warning');
      return;
    }
    try {
      this.showToast('सत्यापन हो रहा है... ⏳', 'info');
      const res = await this.apiCall('/api/auth/login', 'POST', {
        email_or_username: email,
        password: pwd
      });
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));
      this.closeModal('loginModal');
      this.hideAuthGateway();
      this.updateUserUI();
      await this.loadCategories();
      await this.loadPassages();
      this.showToast(`स्वागतम्, ${this.user.display_name || this.user.username}! 👋`, 'success');
      if (this.user.role === 'admin') {
        window.location.href = '/admin.html';
        return;
      } else {
        this.navigate('home');
      }
    } catch (err) {
      const msg = err.status === 401 ? 'गलत ईमेल/यूज़रनेम अथवा पासवर्ड।' : (err.message || 'लॉगिन विफल रहा।');
      this.showToast(msg, 'error');
    }
  }

  async handleAdminLogin(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('adminAuthEmail');
    const passInput = document.getElementById('adminAuthPassword');
    const errBox = document.getElementById('adminAuthError');
    const submitBtn = document.getElementById('adminLoginSubmitBtn');

    if (!emailInput || !passInput) return;
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      if (errBox) { errBox.style.display = 'flex'; errBox.textContent = 'Password is required.'; }
      return;
    }

    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>प्रमाणन जांच जारी है...</span>'; }

    try {
      const res = await this.apiCall('/api/auth/login', 'POST', {
        email_or_username: email,
        password: password
      });

      // Strict Server-Side Role Enforcement
      if (!res.user || res.user.role !== 'admin') {
        // Reject student attempting to use admin portal
        throw new Error('This account does not have administrator access.');
      }

      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));

      // Save Admin Credentials for 1-Click Login if Remember Me is checked
      const rememberAdmin = document.getElementById('adminRememberMe')?.checked ?? true;
      if (rememberAdmin) {
        localStorage.setItem('stenomaster_saved_admin_creds', JSON.stringify({
          email_or_username: email,
          password: password,
          name: this.user.display_name || this.user.username || 'Administrator'
        }));
      } else {
        localStorage.removeItem('stenomaster_saved_admin_creds');
      }

      this.hideAuthGateway();
      this.updateUserUI();

      this.showToast('प्रशासनिक कंसोल में आपका स्वागत है! 🛡️', 'success');

      sessionStorage.removeItem('stenomaster_redirect_after_login');
      window.location.href = '/admin.html';
      return;
    } catch (err) {
      const msg = err.status === 401 ? 'Invalid username or password.' : (err.message || 'Admin authentication failed.');
      if (errBox) {
        errBox.style.display = 'flex';
        errBox.textContent = msg;
      } else {
        this.showToast(msg, 'error');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>🛡️ Secure Admin Login</span>'; }
    }
  }

  copyStudentCredentials() {
    if (!this._registeredCreds) return;
    const text = `🎓 StenoMaster - मेरी लॉगिन जानकारी:
━━━━━━━━━━━━━━━━━━━━
छात्र आईडी (Student ID): ${this._registeredCreds.student_code}
यूज़रनेम (Login ID): ${this._registeredCreds.username}
पंजीकृत ईमेल: ${this._registeredCreds.email}
पासवर्ड: ${this._registeredCreds.password}
वेबसाइट: ${window.location.origin}
━━━━━━━━━━━━━━━━━━━━
⚠️ कृपया इसे सुरक्षित रख लें। इसी जानकारी से लॉगिन होगा।`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('लॉगिन जानकारी क्लिपबोर्ड पर कॉपी हो गई! 📋', 'success');
      }).catch(() => {
        this.fallbackCopyText(text);
      });
    } else {
      this.fallbackCopyText(text);
    }
  }

  fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast('लॉगिन जानकारी क्लिपबोर्ड पर कॉपी हो गई! 📋', 'success');
    } catch (e) {
      this.showToast('कृपया स्क्रीनशॉट लेकर सेव कर लें।', 'info');
    }
    document.body.removeChild(ta);
  }

  proceedToPracticeAfterSignup() {
    this.closeModal('studentCredentialsModal');
    this.showToast(`स्वागतम्, ${this.user.display_name}! 🎓`, 'success');
    this.navigate('home');
  }

  openForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    const step1 = document.getElementById('forgotStep1');
    const step2 = document.getElementById('forgotStep2');
    const step3 = document.getElementById('forgotStep3');
    const err1 = document.getElementById('forgotStep1Error');
    const err2 = document.getElementById('forgotStep2Error');
    const idInput = document.getElementById('forgotIdentifierInput');

    if (err1) err1.style.display = 'none';
    if (err2) err2.style.display = 'none';
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';

    const typedAuth = (document.getElementById('stuAuthEmail')?.value || '').trim();
    if (idInput) {
      idInput.value = typedAuth;
    }

    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        if (idInput) idInput.focus();
      }, 50);
    }
  }

  closeForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  backToForgotStep1() {
    const step1 = document.getElementById('forgotStep1');
    const step2 = document.getElementById('forgotStep2');
    const err1 = document.getElementById('forgotStep1Error');
    if (err1) err1.style.display = 'none';
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }

  async handleSendForgotOtp() {
    const idInput = document.getElementById('forgotIdentifierInput');
    const identifier = (idInput?.value || '').trim();
    const errEl = document.getElementById('forgotStep1Error');
    const btn = document.getElementById('forgotSendOtpBtn');

    if (errEl) errEl.style.display = 'none';

    if (!identifier) {
      if (errEl) {
        errEl.textContent = 'कृपया अपना पंजीकृत ईमेल या मोबाइल नंबर दर्ज करें।';
        errEl.style.display = 'block';
      }
      if (idInput) idInput.focus();
      return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>OTP भेजा जा रहा है...</span>';
    }

    try {
      const res = await this.apiCall('/api/auth/forgot-password/send-otp', 'POST', { identifier });
      if (res && res.success) {
        this.forgotTargetEmail = res.email || identifier;
        
        const targetDisplay = document.getElementById('forgotTargetEmailDisplay');
        if (targetDisplay) targetDisplay.textContent = res.masked_email || res.email || identifier;

        const otpInput = document.getElementById('forgotOtpInput');
        if (otpInput) {
          otpInput.value = res.demo_otp || '';
        }

        const step1 = document.getElementById('forgotStep1');
        const step2 = document.getElementById('forgotStep2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';

        this.showToast(res.message || 'OTP सफलता पूर्वक भेज दिया गया है।', 'success');
        this.startForgotResendTimer();

        setTimeout(() => {
          if (otpInput) otpInput.focus();
        }, 50);
      } else {
        throw new Error(res?.error || 'OTP भेजने में त्रुटि हुई');
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'OTP भेजने में विफल रहा।';
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  async resendForgotOtp() {
    if (this._forgotResendCooling) return;
    await this.handleSendForgotOtp();
  }

  startForgotResendTimer() {
    let timeLeft = 30;
    this._forgotResendCooling = true;
    const btn = document.getElementById('forgotResendOtpBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.style.opacity = '0.6';

    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        this._forgotResendCooling = false;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '🔄 पुनः OTP भेजें';
      } else {
        btn.textContent = `पुनः OTP भेजें (${timeLeft}s)`;
      }
    }, 1000);
  }

  async handleVerifyAndResetPassword() {
    const email = this.forgotTargetEmail || (document.getElementById('forgotIdentifierInput')?.value || '').trim();
    const otp = (document.getElementById('forgotOtpInput')?.value || '').trim();
    const newPass = (document.getElementById('forgotNewPasswordInput')?.value || '').trim();
    const confirmPass = (document.getElementById('forgotConfirmPasswordInput')?.value || '').trim();
    const errEl = document.getElementById('forgotStep2Error');
    const btn = document.getElementById('forgotResetSubmitBtn');

    if (errEl) errEl.style.display = 'none';

    if (!otp || otp.length < 6) {
      if (errEl) {
        errEl.textContent = 'कृपया 6 अंकों का सही OTP दर्ज करें।';
        errEl.style.display = 'block';
      }
      document.getElementById('forgotOtpInput')?.focus();
      return;
    }

    if (!newPass || newPass.length < 4) {
      if (errEl) {
        errEl.textContent = 'नया पासवर्ड कम से कम 4 अक्षरों का होना चाहिए।';
        errEl.style.display = 'block';
      }
      document.getElementById('forgotNewPasswordInput')?.focus();
      return;
    }

    if (newPass !== confirmPass) {
      if (errEl) {
        errEl.textContent = 'पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।';
        errEl.style.display = 'block';
      }
      document.getElementById('forgotConfirmPasswordInput')?.focus();
      return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>पासवर्ड बदला जा रहा है...</span>';
    }

    try {
      const res = await this.apiCall('/api/auth/forgot-password/verify-reset', 'POST', {
        email,
        otp,
        new_password: newPass,
        confirm_password: confirmPass
      });

      if (res && res.success) {
        const step2 = document.getElementById('forgotStep2');
        const step3 = document.getElementById('forgotStep3');
        if (step2) step2.style.display = 'none';
        if (step3) step3.style.display = 'block';

        this.showToast(res.message || '✓ पासवर्ड सफलतापूर्वक रीसेट हो गया!', 'success');

        const loginEmail = document.getElementById('stuAuthEmail');
        const loginPass = document.getElementById('stuAuthPassword');
        if (loginEmail) loginEmail.value = email;
        if (loginPass) loginPass.value = newPass;
      } else {
        throw new Error(res?.error || 'पासवर्ड रीसेट विफल रहा');
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'पासवर्ड रीसेट विफल रहा। कृपया पुनः प्रयास करें।';
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  finishForgotPasswordLogin() {
    this.closeForgotPassword();
    const submitBtn = document.getElementById('stuLoginSubmitBtn');
    if (submitBtn) {
      submitBtn.focus();
    }
  }

  togglePasswordVisibility(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
  }


  handleLogoClick() {
    if (this.user && this.user.role === 'admin') {
      this.navigate('admin');
    } else {
      this.navigate('home');
    }
  }

  async fetchCurrentUser() {
    try {
      const res = await this.apiCall('/api/auth/me');
      this.user = res.user;
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));
      this.updateUserUI();
    } catch (err) {
      if (err.status === 401) {
        console.warn('Session expired (401), logging out');
        this.logout(false);
      } else {
        console.warn('Transient error in fetchCurrentUser, retaining session:', err);
      }
      throw err;
    }
  }

  async register(username, email, password, displayName, targetExam, refCode) {
    try {
      const res = await this.apiCall('/api/auth/register', 'POST', {
        username, email, password, display_name: displayName, target_exam: targetExam, referral_code: refCode
      });
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('stenomaster_token', this.token);
      localStorage.removeItem('stenomaster_pending_referral');
      localStorage.setItem('stenomaster_user', JSON.stringify(this.user));
      localStorage.setItem('stenomaster_student_registry_updated', Date.now().toString());
      localStorage.setItem('stenomaster_users_version', Date.now().toString());
      this.hideAuthGateway();
      this.updateUserUI();
      this.closeModal('registerModal');
      this.showToast('पंजीकरण सफल! Welcome to StenoMaster 🎉', 'success');
      this.navigate('home');
    } catch (err) {
      this.showToast(err.message || 'Account already exists.', 'error');
    }
  }

  logout(showToast = true) {
    if (this.token) {
      this.apiCall('/api/auth/logout', 'POST').catch(() => {});
    }
    if (window.stenoAdmin && typeof window.stenoAdmin.stopSubscribersLiveSync === 'function') {
      window.stenoAdmin.stopSubscribersLiveSync();
    }
    this.token = null;
    this.user = null;
    localStorage.removeItem('stenomaster_token');
    localStorage.removeItem('stenomaster_user');
    this.updateUserUI();
    this.showAuthGateway('student');
    if (showToast) this.showToast('लॉगआउट सफल। (Logged out successfully)', 'info');
  }

  handleConcurrentLoginEviction(data = {}) {
    // 1. Wipe local credentials
    this.token = null;
    this.user = null;
    localStorage.removeItem('stenomaster_token');
    localStorage.removeItem('stenomaster_user');

    // 2. Halt audio playback immediately
    if (window.stenoAudioPlayer && typeof window.stenoAudioPlayer.stop === 'function') {
      window.stenoAudioPlayer.stop();
    }

    // 3. Halt typing test and timer immediately
    if (window.stenoTypingEngine && typeof window.stenoTypingEngine.stopPractice === 'function') {
      window.stenoTypingEngine.stopPractice();
    }

    // 4. Fill in eviction details
    const ipEl = document.getElementById('concurrentLoginIp');
    if (ipEl) {
      ipEl.textContent = data.superseded_by_ip || 'Other Device IP';
    }

    const timeEl = document.getElementById('concurrentLoginTime');
    if (timeEl) {
      if (data.superseded_at) {
        try {
          const d = new Date(data.superseded_at);
          timeEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
          timeEl.textContent = data.superseded_at;
        }
      } else {
        timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }

    // 5. Reveal the Security Eviction Modal
    const modal = document.getElementById('concurrentLoginModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // 6. Update user indicators
    this.updateUserUI();
  }

  openLoginFromConcurrent() {
    const modal = document.getElementById('concurrentLoginModal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.showAuthGateway('student', 'अन्य डिवाइस से लॉगआउट कर दिया गया है। पुनः लॉगिन करें।');
  }

    async oneClickDemoStudentLogin() {
    const emailInput = document.getElementById('stuAuthEmail');
    const passInput = document.getElementById('stuAuthPassword');
    if (emailInput) emailInput.value = 'student@stenomaster.com';
    if (passInput) passInput.value = 'student123';
    await this.handleStudentLogin();
  }

  renderActivePlanBanner() {
    const banner = document.getElementById('dashboardActivePlanBanner');
    if (!banner) return;

    const icon = document.getElementById('planBannerIcon');
    const tag = document.getElementById('planBannerTag');
    const title = document.getElementById('planBannerTitle');
    const subtitle = document.getElementById('planBannerSubtitle');
    const actionBtn = document.getElementById('planBannerActionBtn');

    const isPremium = Boolean(this.user && (this.user.is_premium || this.user.is_free_access || (this.user.subscription_days_left && this.user.subscription_days_left > 0)));
    let planName = (this.user && this.user.subscription_plan) || 'StenoMaster Pro';
    if (planName === 'System Administrator' || planName.toLowerCase().includes('admin')) {
      planName = 'StenoMaster Pro (₹100/माह)';
    }
    const daysLeft = (this.user && typeof this.user.subscription_days_left === 'number') ? this.user.subscription_days_left : 0;

    // Pricing mapping
    const planPriceMap = {
      'StenoMaster Basic (30 Days)': '₹100 (1 माह / 30 दिन)',
      'StenoMaster Standard (90 Days)': '₹250 (3 माह / 90 दिन)',
      'StenoMaster Extended (180 Days)': '₹450 (6 माह / 180 दिन)',
      'StenoMaster Annual Pro (365 Days)': '₹800 (1 वर्ष / 365 दिन)',
      'StenoMaster Pro': '₹100 प्रति माह',
      'StenoMaster Pro (₹100/माह)': '₹100 प्रति माह',
      'StenoMaster Pro — 30 दिन (₹100)': '₹100 (1 माह / 30 दिन)',
      'StenoMaster Pro (30 दिन फ्री)': '30 दिन फ्री एक्सेस'
    };
    const priceText = planPriceMap[planName] || '₹100 मासिक प्लान';

    if (isPremium && daysLeft > 0) {
      // GREEN STYLISH HORIZONTAL BOX (ACTIVE PLAN)
      banner.style.background = 'linear-gradient(90deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.06))';
      banner.style.border = '1.5px solid rgba(16, 185, 129, 0.45)';
      banner.style.color = '#065f46';

      if (icon) icon.textContent = '🟢';
      if (tag) {
        tag.textContent = 'सक्रिय प्लान (ACTIVE PLAN)';
        tag.style.background = '#10b981';
        tag.style.color = '#ffffff';
      }
      if (title) {
        title.innerHTML = `StenoMaster Pro • <span style="color:#059669; font-weight:700;">${priceText}</span> सक्रिय है`;
        title.style.color = '#065f46';
      }
      if (subtitle) {
        if (daysLeft >= 1000) {
          subtitle.innerHTML = `♾️ <strong>लाइफटाइम प्रो एक्सेस</strong> • असीमित डिक्टेशन, परीक्षा हॉल मोड एवं विस्तृत मूल्यांकन सक्रिय है।`;
        } else {
          subtitle.innerHTML = `⏳ <strong>${daysLeft} दिन शेष बचे हैं</strong> • असीमित डिक्टेशन, परीक्षा हॉल मोड एवं विस्तृत मूल्यांकन सक्रिय है।`;
        }
        subtitle.style.color = '#047857';
      }
      if (actionBtn) {
        actionBtn.textContent = '👑 प्लान अपग्रेड / रिन्यू करें →';
        actionBtn.style.background = '#10b981';
        actionBtn.style.borderColor = '#10b981';
      }
    } else {
      // RED STYLISH HORIZONTAL BOX (NO ACTIVE PLAN / EXPIRED)
      banner.style.background = 'linear-gradient(90deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.06))';
      banner.style.border = '1.5px solid rgba(239, 68, 68, 0.45)';
      banner.style.color = '#991b1b';

      if (icon) icon.textContent = '🔴';
      if (tag) {
        tag.textContent = 'कोई प्लान सक्रिय नहीं (NO ACTIVE PLAN)';
        tag.style.background = '#ef4444';
        tag.style.color = '#ffffff';
      }
      if (title) {
        title.textContent = 'वर्तमान में आपका कोई सशुल्क प्लान सक्रिय नहीं है';
        title.style.color = '#b91c1c';
      }
      if (subtitle) {
        subtitle.innerHTML = '⚠️ आपकी वर्तमान योजना समाप्त है या आप सीमित फ्री मोड में हैं। असीमित डिक्टेशन अभ्यास एवं लाइव रैंकिंग के लिए तुरंत प्लान सक्रिय करें।';
        subtitle.style.color = '#b91c1c';
      }
      if (actionBtn) {
        actionBtn.textContent = '⚡ अभी प्लान चुनें (मात्र ₹100 से शुरू) →';
        actionBtn.style.background = '#ef4444';
        actionBtn.style.borderColor = '#ef4444';
      }
    }
  }

  updateUserUI() {
    const greetingEl = document.getElementById('userGreetingText');
    const avatarEl = document.getElementById('headerUserAvatar');
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const streakEl = document.getElementById('userStreakCount');
    const adminNav = document.getElementById('adminNavItem');
    const areaBadge = document.getElementById('areaIndicatorBadge');
    const validityPill = document.getElementById('headerPlanValidityBadge');

    if (this.user) {
      const name = this.user.display_name || this.user.username || 'Student';
      if (greetingEl) greetingEl.textContent = `Good Day, ${name} 👋`;
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = name;
      if (streakEl) streakEl.textContent = `${this.user.streak_days || 0} Day Streak`;

      if (roleEl) {
        roleEl.textContent = (this.user.role === 'admin' || this.user.is_premium) ? 'Pro Member' : 'Student';
        roleEl.className = 'header-user-role role-student';
      }

      const headerAdminPortalLink = document.getElementById('headerAdminPortalLink');
      if (headerAdminPortalLink) headerAdminPortalLink.style.display = 'none';
      if (adminNav) adminNav.style.display = 'none';

      if (areaBadge) {
        areaBadge.className = 'area-indicator-badge';
        areaBadge.innerHTML = '👨‍🎓 Student Area';
      }

      if (this.user.role === 'admin') {
        if (validityPill) {
          validityPill.style.display = 'inline-flex';
          validityPill.className = 'plan-validity-pill is-pro';
          validityPill.innerHTML = '👑 ऑल एक्सेस (Pro Active)';
          validityPill.title = 'प्रो प्लान सक्रिय है';
          validityPill.onclick = () => stenoApp.navigate('subscription');
        }
        if (avatarEl) {
          avatarEl.classList.add('pro-rainbow-ring');
        }
      } else {
        const headerAdminPortalLink = document.getElementById('headerAdminPortalLink');
        if (headerAdminPortalLink) headerAdminPortalLink.style.display = 'none';
        if (adminNav) adminNav.style.display = 'none';
        if (areaBadge) {
          areaBadge.className = 'area-indicator-badge';
          areaBadge.innerHTML = '👨‍🎓 Student Area';
        }

        const isPro = Boolean(this.user.is_premium || this.user.subscription_status === 'active');
        const daysLeft = this.user.subscription_days_left !== undefined ? this.user.subscription_days_left : 0;
        if (isPro && daysLeft > 0) {
          if (validityPill) {
            validityPill.style.display = 'inline-flex';
            validityPill.className = 'plan-validity-pill is-pro';
            validityPill.innerHTML = (daysLeft >= 1000) ? '👑 Pro: Active' : `👑 Pro: ${daysLeft} दिन शेष`;
            validityPill.title = 'प्रो प्लान सक्रिय है';
            validityPill.onclick = () => stenoApp.navigate('subscription');
          }
          if (avatarEl) {
            avatarEl.classList.add('pro-rainbow-ring');
          }
        } else {
          if (validityPill) {
            validityPill.style.display = 'inline-flex';
            validityPill.className = 'plan-validity-pill is-free';
            validityPill.innerHTML = '🔒 2 फ्री कक्षाएं • ₹100 में Pro लें';
            validityPill.title = 'प्रीमियम अनलॉक करने के लिए क्लिक करें';
            validityPill.onclick = () => stenoApp.navigate('subscription');
          }
          if (avatarEl) {
            avatarEl.classList.remove('pro-rainbow-ring');
          }
        }
      }
    } else {
      if (greetingEl) greetingEl.textContent = 'Good Day, Student 👋';
      if (avatarEl) {
        avatarEl.textContent = 'S';
        avatarEl.classList.remove('pro-rainbow-ring');
      }
      if (nameEl) nameEl.textContent = 'Student';
      if (roleEl) {
        roleEl.textContent = 'Student';
        roleEl.className = 'header-user-role role-student';
      }
      if (streakEl) streakEl.textContent = '0 Day Streak';
      if (adminNav) adminNav.style.display = 'none';
      if (areaBadge) {
        areaBadge.className = 'area-indicator-badge';
        areaBadge.innerHTML = '👨‍🎓 Student Area';
      }
      if (validityPill) {
        validityPill.style.display = 'none';
      }
    }

    this.renderSidebarNav();
    this.renderActivePlanBanner();
  }

  // -------------------------------------------------------------------------
  // 3-Dot Slide-Out Sidebar Navigation & Role-Based Menu
  // -------------------------------------------------------------------------
  toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  openSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('navToggleBtn');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    this.renderSidebarNav();
  }

  closeSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('navToggleBtn');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  closeMobileDrawer() {
    this.closeSidebar();
  }

  renderSidebarNav() {
    const navContainer = document.getElementById('sidebarNavItems');
    const footerContainer = document.getElementById('sidebarFooter');
    if (!navContainer) return;

    const isAdmin = Boolean(this.user && this.user.role === 'admin');
    const currentView = this.activeView || 'home';

    if (false) {
      // Disabled: Admin portal items strictly excluded from student app
    } else {
      // Student Sidebar Items (Strictly NO admin items in DOM)
      const studentItems = [
        { id: 'home', icon: '🏠', label: 'Dashboard', sub: 'डैशबोर्ड' },
        { id: 'classes', icon: '🎧', label: 'Practice Classes', sub: 'डिक्टेशन क्लास' },
        { id: 'self-practice', icon: '🎙️', label: 'Self Practice', sub: 'कस्टम डिक्टेशन' },
        { id: 'subscription', icon: '💳', label: 'Subscription', sub: 'सदस्यता एवं प्रो' },
        { id: 'my-practice', icon: '📜', label: 'Practice History', sub: 'अभ्यास इतिहास' },
        { id: 'progress', icon: '📊', label: 'Progress & Analytics', sub: 'प्रगति चार्ट' },
        { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', sub: 'रैंकिंग बोर्ड' },
        { id: 'bookmarks', icon: '🔖', label: 'Bookmarks', sub: 'सहेजे गए आलेख' },
        { id: 'rules', icon: '📋', label: 'परीक्षा नियम', sub: 'UPSSSC & SSC Rules' },
        { id: 'founder', icon: '👤', label: 'संस्थापक परिचय', sub: 'About Founder & Mentor' },
        { id: 'profile', icon: '👤', label: 'My Profile', sub: 'मेरी प्रोफ़ाइल' },
        { id: 'refer', icon: '🎁', label: 'Refer & Earn', sub: 'रेफरल एवं अंक' },
        { id: 'settings', icon: '⚙️', label: 'Settings', sub: 'प्राथमिकताएं' }
      ];

      navContainer.innerHTML = `
        <div class="sidebar-role-badge student-badge">
          <span>👨‍🎓</span> <span>STUDENT PORTAL</span>
        </div>
        ${studentItems.map(item => `
          <a href="javascript:void(0)" class="nav-item ${currentView === item.id ? 'active' : ''}" data-sidebar-item="${item.id}" title="${item.label}">
            <span class="nav-item-icon">${item.icon}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:0.86rem; line-height:1.2;">${item.label}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${item.sub}</div>
            </div>
          </a>
        `).join('')}

      `;

      studentItems.forEach(item => {
        const el = navContainer.querySelector(`[data-sidebar-item="${item.id}"]`);
        if (!el) return;
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeSidebar();
          this.navigate(item.id);
        });
      });

      if (footerContainer) {
        const studentName = (this.user && (this.user.display_name || this.user.username)) || 'Student';
        const initial = studentName.charAt(0).toUpperCase();
        footerContainer.innerHTML = `
          <div class="sidebar-user-preview">
            <div class="sidebar-avatar">${initial}</div>
            <div class="sidebar-user-details">
              <div class="sidebar-user-name">${this.escapeHtml(studentName)}</div>
              <div class="sidebar-user-role">👨‍🎓 Student Role</div>
            </div>
          </div>
          <button class="nav-item" style="width:100%; margin-top:6px; color:var(--accent-red); justify-content:center; gap:8px;" onclick="stenoApp.closeSidebar(); stenoApp.logout();">
            <span class="nav-item-icon">🚪</span>
            <span>लॉगआउट (Logout)</span>
          </button>
        `;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Navigation & View Routing
  // -------------------------------------------------------------------------
  initNavigation() {
    // ESC key closes slide drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSidebar();
      }
    });

    // Mobile nav & existing data-nav triggers
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-nav');
        this.navigate(view);
        this.closeSidebar();
      });
    });

    // Mount typing engine
    stenoTypingEngine.mount({
      textarea: document.getElementById('typingTextarea'),
      wordCount: document.getElementById('liveWordCount'),
      charCount: document.getElementById('liveCharCount'),
      timer: document.getElementById('liveTimerText'),
      modeSelector: document.getElementById('typingModeSelect'),
      draftStatus: document.getElementById('draftStatusText')
    });

    // Mount Audio callbacks
    stenoAudioPlayer.onTimeUpdateCallback = (current, duration) => {
      const curEl = document.getElementById('audioCurrentTime');
      const remEl = document.getElementById('audioRemainingTime');
      const fillEl = document.getElementById('scrubberFill');

      if (curEl) curEl.textContent = stenoAudioPlayer.formatTime(current);
      if (remEl) remEl.textContent = stenoAudioPlayer.formatTime(Math.max(0, duration - current));
      if (fillEl && duration > 0) {
        fillEl.style.width = `${(current / duration) * 100}%`;
      }
    };

    stenoAudioPlayer.onEndedCallback = () => {
      const playBtn = document.getElementById('audioPlayBtn');
      if (playBtn) playBtn.innerHTML = '▶️';
      this.showToast('डिक्टेशन समाप्त! अब अपना टंकण पूरा करें और सबमिट करें। (Dictation Completed)', 'info');
    };

    // Scrubber click
    const scrubberTrack = document.getElementById('scrubberTrack');
    if (scrubberTrack) {
      scrubberTrack.addEventListener('click', (e) => {
        const rect = scrubberTrack.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        stenoAudioPlayer.seek(pos * stenoAudioPlayer.duration);
      });
    }

    // Initial sidebar render
    this.renderSidebarNav();
  }

  goBack() {
    // 1. If practice typing test is currently active, confirm before exiting
    if (this.activeView === 'practice' && window.stenoTypingEngine && window.stenoTypingEngine.isStarted && !window.stenoTypingEngine.isCompleted) {
      if (!confirm('क्या आप वाकई टेस्ट छोड़कर वापस जाना चाहते हैं? (Are you sure you want to leave the test?)')) {
        return;
      }
    }

    if (window.stenoAudioPlayer && typeof window.stenoAudioPlayer.stop === 'function') {
      window.stenoAudioPlayer.stop();
    }

    const stickyBar = document.getElementById('catDetailStickyBar');
    if (stickyBar) stickyBar.style.display = 'none';

    // 2. Context-aware back from Practice or Result report
    if (this.activeView === 'practice' || this.activeView === 'result') {
      if (this.practiceOrigin && this.practiceOrigin.view) {
        const origin = this.practiceOrigin;
        this.practiceOrigin = null;
        if (origin.view === 'category-detail' && origin.categoryId) {
          this.openCategoryDetail(origin.categoryId);
          return;
        }
        if (origin.view && origin.view !== 'practice' && origin.view !== 'result') {
          this.navigate(origin.view, {}, true, true);
          return;
        }
      }
      if (this.currentCategoryId) {
        this.openCategoryDetail(this.currentCategoryId);
        return;
      }
      this.navigate('classes', {}, true, true);
      return;
    }

    // 3. Context-aware back from Category Detail view
    if (this.activeView === 'category-detail') {
      const origin = this.categoryOrigin || 'home';
      this.categoryOrigin = null;
      this.navigate(origin === 'classes' ? 'classes' : 'home', {}, true, true);
      return;
    }

    // 4. Pop through custom navigationHistory until a truly different view is found
    if (this.navigationHistory && this.navigationHistory.length > 0) {
      while (this.navigationHistory.length > 0) {
        const prev = this.navigationHistory.pop();
        if (!prev) continue;
        const targetView = (typeof prev === 'string') ? prev : prev.view;
        const targetParams = (typeof prev === 'object') ? prev.params : {};
        const targetCatId = (typeof prev === 'object') ? prev.categoryId : null;

        if (targetView && targetView !== this.activeView) {
          if (targetView === 'category-detail' && (targetCatId || this.currentCategoryId)) {
            this.openCategoryDetail(targetCatId || this.currentCategoryId);
            return;
          }
          this.navigate(targetView, targetParams, true, true);
          return;
        }
      }
    }

    // 5. Ultimate fallback to Home
    this.navigate('home', {}, true, true);
  }

  showView(viewId) {
    if (typeof viewId === 'string' && viewId.startsWith('view-')) {
      viewId = viewId.replace('view-', '');
    }
    return this.navigate(viewId);
  }

  navigate(viewId, params = {}, updateHash = true, isBack = false) {
    // Role-based access control (RBAC) enforcement
    if (viewId === 'admin') {
      if (!this.user || this.user.role !== 'admin') {
        this.showToast('This account does not have administrator access.', 'error');
        this.navigate('home', {}, true, true);
        return;
      }
      window.location.href = '/admin.html';
      return;
    }

    // Only record history when moving forward (never when backing out)
    if (!isBack && !this.isBackNavigating && this.activeView && this.activeView !== viewId) {
      if (!this.navigationHistory) this.navigationHistory = [];
      const last = this.navigationHistory[this.navigationHistory.length - 1];
      const lastView = (typeof last === 'string') ? last : (last && last.view);
      if (lastView !== this.activeView) {
        this.navigationHistory.push({
          view: this.activeView,
          categoryId: this.currentCategoryId || null,
          params: { ...params }
        });
        if (this.navigationHistory.length > 25) this.navigationHistory.shift();
      }
    }

    const headerBackBtn = document.getElementById('headerBackBtn');
    if (headerBackBtn) {
      headerBackBtn.style.display = (viewId === 'home') ? 'none' : 'inline-flex';
    }

    this.startTopLoading();
    this.activeView = viewId;
    this.closeSidebar();

    if (viewId !== 'admin' && window.stenoAdmin && typeof window.stenoAdmin.stopSubscribersLiveSync === 'function') {
      window.stenoAdmin.stopSubscribersLiveSync();
    }

    if (viewId !== 'practice' && window.stenoAudioPlayer && typeof window.stenoAudioPlayer.stop === 'function') {
      window.stenoAudioPlayer.stop();
    }

    // Determine target route string
    let routeStr = viewId;
    if (viewId === 'admin') {
      const adminTab = (params && params.adminTab) || (window.stenoAdmin && window.stenoAdmin.activeTab) || localStorage.getItem('stenomaster_last_admin_tab') || 'overview';
      routeStr = `admin/${adminTab}`;
    } else if (viewId === 'category-detail') {
      const cId = (params && params.id) || this.currentCategoryId;
      if (cId) routeStr = `category-detail?id=${cId}`;
    } else if (viewId === 'practice') {
      const pId = (params && params.passageId) || (this.currentPassage && this.currentPassage.id);
      if (pId) {
        routeStr = `practice?id=${pId}`;
        if (params && params.system) routeStr += `&system=${params.system}`;
      }
    }

    if (updateHash) {
      const targetHash = `#/${routeStr}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
    // Transient views must never be remembered across browser launches
    if (viewId !== 'result' && viewId !== 'practice') {
      localStorage.setItem('stenomaster_last_route', routeStr);
    } else {
      localStorage.setItem('stenomaster_last_route', 'home');
    }

    // Update document title dynamically
    const pageTitles = {
      'home': 'डैशबोर्ड (Dashboard) — StenoMaster',
      'category-detail': 'डिक्टेशन कक्षाएं — StenoMaster',
      'self-practice': 'सेल्फ प्रैक्टिस — StenoMaster',
      'classes': 'अभ्यास कक्षाएं (Classes) — StenoMaster',
      'subscription': 'सदस्यता प्लान (Subscription) — StenoMaster',
      'practice': 'स्टेनो टंकण अभ्यास (Typing Test) — StenoMaster',
      'result': 'मूल्यांकन परिणाम (Result Report) — StenoMaster',
      'my-practice': 'अभ्यास इतिहास (Practice History) — StenoMaster',
      'progress': 'प्रगति विश्लेषण (Progress Analytics) — StenoMaster',
      'leaderboard': 'लीडरबोर्ड (Leaderboard) — StenoMaster',
      'bookmarks': 'सहेजे गए आलेख (Bookmarks) — StenoMaster',
      'profile': 'मेरी प्रोफ़ाइल (My Profile) — StenoMaster',
      'refer': 'रेफरल एवं पुरस्कार (Refer & Earn) — StenoMaster',
      'notifications': 'सूचनाएं (Notifications) — StenoMaster',
      'settings': 'प्राथमिकताएं (Settings) — StenoMaster',
      'rules': '📜 परीक्षा नियम — StenoMaster',
      'admin': 'एडमिन कंसोल (Admin Console) — StenoMaster'
    };
    if (pageTitles[viewId]) {
      document.title = pageTitles[viewId];
    }

    // Update active badge in top header
    const viewTitles = {
      'home': 'Dashboard',
      'category-detail': 'Category Classes',
      'self-practice': 'Self Practice',
      'classes': 'Practice Classes',
      'subscription': 'Subscription & Pro Access',
      'practice': 'Typing Test',
      'result': 'Result Report',
      'my-practice': 'Practice History',
      'progress': 'Progress Analytics',
      'leaderboard': 'Leaderboard',
      'bookmarks': 'Bookmarks',
      'profile': 'My Profile',
      'refer': 'Refer & Earn',
      'notifications': 'Notifications',
      'settings': 'Settings',
      'rules': '📜 परीक्षा नियम',
      'admin': 'Admin Console'
    };
    const badge = document.getElementById('activeViewBadge');
    if (badge) {
      badge.textContent = viewTitles[viewId] || viewId;
    }

    // Update active class on nav items
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === viewId);
    });
    document.querySelectorAll('[data-sidebar-item]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-sidebar-item') === viewId);
    });

    // Hide all views, display targeted view
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetEl = document.getElementById(`view-${viewId}`);
    if (targetEl) {
      targetEl.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Load view specific data
    switch (viewId) {
      case 'home':
        this.renderHome();
        break;
      case 'classes':
        this.renderClasses();
        this.updateFontSwitcherUI();
        break;
      case 'subscription':
        this.loadSubscription();
        break;
      case 'my-practice':
        this.loadHistory();
        break;
      case 'progress':
        this.loadProgress();
        break;
      case 'leaderboard':
        this.loadLeaderboard();
        break;
      case 'bookmarks':
        this.loadBookmarks();
        break;
      case 'profile':
        this.renderProfile();
        break;
      case 'refer':
        this.loadReferrals();
        break;
      case 'notifications':
        this.loadNotifications();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'result': {
        const reportContainer = document.getElementById('resultReportContainer');
        if (!reportContainer || !reportContainer.firstElementChild) {
          this.navigate('home', {}, true);
          return;
        }
        break;
      }
      case 'rules':
        // Rules view is static HTML — just scroll to top, no async load needed
        break;
      case 'self-practice':
        this.initSelfPractice();
        break;
      case 'admin':
        const targetAdminTab = (params && params.adminTab) || (window.stenoAdmin && window.stenoAdmin.activeTab) || localStorage.getItem('stenomaster_last_admin_tab') || 'overview';
        stenoAdmin.loadOverview();
        stenoAdmin.switchTab(targetAdminTab, false);
        break;
    }

    setTimeout(() => {
      this.finishTopLoading();
    }, 180);
  }

  // -------------------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------------------
  async loadCategories() {
    // 0ms Instant Hydration from memory/localStorage
    if (this.categories && this.categories.length > 0) {
      this.renderCategoryPills();
    }
    try {
      const res = await this.apiCall('/api/categories');
      this.categories = res.categories || [];
      try {
        localStorage.setItem('stenomaster_cached_categories', JSON.stringify(this.categories));
      } catch (e) {}
      this.renderCategoryPills();
      this.renderHorizontalCategories();
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  filterByExam(examKey, btnEl) {
    this.selectedExamFilter = examKey || 'all';
    if (btnEl) {
      document.querySelectorAll('#classesExamPills .curated-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    this.applyPassageFilters();
  }

  filterBySource(sourceKey, btnEl) {
    this.selectedSourceFilter = sourceKey || 'all';
    if (btnEl) {
      document.querySelectorAll('#classesSourcePills .curated-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    this.applyPassageFilters();
  }

  applyPassageFilters() {
    if (!this.allPassages) this.allPassages = [];
    let list = [...this.allPassages];

    // 1. Language Filter
    if (this.selectedLanguage && this.selectedLanguage !== 'all') {
      list = list.filter(p => (p.language || '').toLowerCase() === this.selectedLanguage.toLowerCase());
    }

    // 2. Difficulty Filter
    if (this.selectedDifficulty && this.selectedDifficulty !== 'all') {
      list = list.filter(p => (p.difficulty || '').toLowerCase() === this.selectedDifficulty.toLowerCase());
    }

    // 3. Category Filter
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      list = list.filter(p => String(p.category_id) === String(this.selectedCategory));
    }

    // 4. Curated Target Exam Filter
    if (this.selectedExamFilter && this.selectedExamFilter !== 'all') {
      const ef = this.selectedExamFilter.toLowerCase();
      list = list.filter(p => {
        const text = `${p.title || ''} ${p.category_name || ''} ${p.tags || ''} ${p.instructions || ''}`.toLowerCase();
        if (ef === 'ssc') {
          return text.includes('ssc') || text.includes('ग्रेड') || text.includes('grade') || (p.target_wpm >= 80 && p.target_wpm <= 100);
        } else if (ef === 'upsssc') {
          return text.includes('upsssc') || text.includes('कनिष्ठ') || text.includes('अधीनस्थ') || text.includes('पंचायती');
        } else if (ef === 'court') {
          return text.includes('court') || text.includes('कोर्ट') || text.includes('हाईकोर्ट') || text.includes('विधिक') || text.includes('न्यायालय') || text.includes('legal');
        } else if (ef === 'reporter') {
          return text.includes('रिपोर्टर') || text.includes('विधानसभा') || text.includes('संसद') || (p.target_wpm && p.target_wpm >= 120);
        }
        return true;
      });
    }

    // 5. Curated Source & Books Filter
    if (this.selectedSourceFilter && this.selectedSourceFilter !== 'all') {
      const sf = this.selectedSourceFilter.toLowerCase();
      list = list.filter(p => {
        const text = `${p.title || ''} ${p.category_name || ''} ${p.tags || ''}`.toLowerCase();
        if (sf === 'khand1') {
          return text.includes('खंड 1') || text.includes('खंड-1') || text.includes('rg1') || text.includes('रश्मिरथी') || text.includes('दिनकर');
        } else if (sf === 'khand2') {
          return text.includes('खंड 2') || text.includes('खंड-2') || text.includes('rg2');
        } else if (sf === 'editorial') {
          return text.includes('संपादकीय') || text.includes('दैनिक') || text.includes('जागरण') || text.includes('जनसत्ता') || text.includes('editorial');
        } else if (sf === 'legal') {
          return text.includes('विधिक') || text.includes('कोर्ट') || text.includes('कानून') || text.includes('न्यायालय') || text.includes('legal');
        } else if (sf === 'free') {
          return !!p.is_free_tier || p.id <= 2;
        } else if (sf === 'bookmarks') {
          return this.bookmarks && this.bookmarks.has(p.id);
        }
        return true;
      });
    }

    // 6. Search Query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.category_name && p.category_name.toLowerCase().includes(q)) ||
        (p.tags && p.tags.toLowerCase().includes(q))
      );
    }
    this.passages = list;
    if (this.activeView === 'home') this.renderHomeCards();
    if (this.activeView === 'classes') this.renderClasses();
  }

  onSearchInput(val) {
    this.searchQuery = val || '';
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.applyPassageFilters();
    }, 160);
  }

  onLanguageFilterChange(val) {
    this.selectedLanguage = val || 'all';
    this.applyPassageFilters();
  }

  onDifficultyFilterChange(val) {
    this.selectedDifficulty = val || 'all';
    this.applyPassageFilters();
  }

  renderPassagesSkeleton() {
    const skeletonHTML = Array(6).fill(0).map(() => `
      <div class="class-card skeleton-card" style="opacity:0.5; pointer-events:none; border:1px solid var(--border); border-radius:12px; padding:18px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
          <div style="height:18px; width:70px; background:var(--border); border-radius:4px;"></div>
          <div style="height:18px; width:40px; background:var(--border); border-radius:4px;"></div>
        </div>
        <div style="height:22px; width:80%; background:var(--border); border-radius:4px; margin-bottom:8px;"></div>
        <div style="height:14px; width:40%; background:var(--border); border-radius:4px; margin-bottom:16px;"></div>
        <div style="height:32px; width:100%; background:var(--border); border-radius:6px;"></div>
      </div>
    `).join('');

    const grid = document.getElementById('classesListGrid');
    if (grid && (!this.allPassages || this.allPassages.length === 0)) grid.innerHTML = skeletonHTML;
    const homeGrid = document.getElementById('homeClassCardsGrid');
    if (homeGrid && (!this.allPassages || this.allPassages.length === 0)) homeGrid.innerHTML = skeletonHTML;
  }

  async loadPassages(forceRefresh = false) {
    // 1. If passages exist in memory/cache, render immediately so user sees zero delay
    if (this.allPassages && this.allPassages.length > 0) {
      this.applyPassageFilters();
      this.updateFontSwitcherUI();
    } else {
      this.renderPassagesSkeleton();
    }

    // 2. ALWAYS fetch fresh passages from server to stay 100% in sync with admin edits/deletes
    try {
      const res = await this.apiCall('/api/passages');
      this.allPassages = res.passages || [];

      // Populate bookmarks set
      this.bookmarks.clear();
      this.allPassages.forEach(p => {
        if (p.is_bookmarked) this.bookmarks.add(p.id);
      });

      // Save fresh data to cache
      try {
        localStorage.setItem('stenomaster_cached_passages', JSON.stringify(this.allPassages));
      } catch (e) {}

      // Re-render with 100% updated server data
      this.applyPassageFilters();
      this.updateFontSwitcherUI();
    } catch (err) {
      console.error('Failed to load passages:', err);
    }
  }

  // -------------------------------------------------------------------------
  // View Renderers: Home & Classes
  // -------------------------------------------------------------------------
  renderCategoryPills() {
    const container = document.getElementById('homeCategoryPills');
    if (container) {
      container.innerHTML = '';
      container.style.display = 'none';
    }
  }

  filterCategory(catId, btnEl) {
    this.selectedCategory = catId;
    if (btnEl) {
      document.querySelectorAll('#homeCategoryPills .cat-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    this.applyPassageFilters();
  }

  renderHome() {
    this.renderCategoryPills();
    this.renderHomeCards();
    this.renderHorizontalCategories();
    this.renderDailyTargetSummary();
  }

  _applySummaryToDOM(res) {
    if (!res) return;
    this.userSummary = res;
    const goal = res.today_goal || {};
    const stats = res.stats || {};
    const realPoints = stats.points !== undefined && stats.points !== null ? stats.points : 0;
    const streakDays = stats.streak_days || 0;
    const longestStreak = stats.longest_streak || streakDays;

    // Mini target widgets
    const countEl = document.getElementById('todayTargetCompletedCount');
    const minEl = document.getElementById('todayTargetMinutes');
    const speedEl = document.getElementById('todayTargetSpeed');
    const fillEl = document.getElementById('todayTargetProgressFill');

    if (countEl) countEl.textContent = `${goal.completed_dictations || 0} / ${goal.target_dictations || 3}`;
    if (minEl) minEl.textContent = `${goal.completed_minutes || 0} / ${goal.target_minutes || 15} min`;
    if (speedEl) speedEl.textContent = `${goal.target_speed || 40} WPM`;
    if (fillEl) fillEl.style.width = `${goal.percent_completed || 0}%`;

    const avgWpmEl = document.getElementById('homeQuickAvgWpm');
    const avgAccEl = document.getElementById('homeQuickAvgAcc');
    const totalPracEl = document.getElementById('homeQuickTotalPrac');
    const pointsEl = document.getElementById('homeQuickPoints');

    if (avgWpmEl) avgWpmEl.textContent = `${stats.avg_wpm || 0} WPM`;
    if (avgAccEl) avgAccEl.textContent = `${stats.avg_accuracy || 0}%`;
    if (totalPracEl) totalPracEl.textContent = `${stats.total_practices || 0}`;
    if (pointsEl) pointsEl.textContent = `${realPoints} Pts`;

    // -------------------------------------------------------------------------
    // 8 Dashboard Metric Cards — Attractive, Actionable & Live-Updated
    // -------------------------------------------------------------------------

    // 1. Streak Card
    const hStreak = document.getElementById('hStatStreak');
    const hStreakSub = document.getElementById('hStatStreakSub');
    const hStreakTag = document.getElementById('hStatStreakTag');
    const hStreakRecord = document.getElementById('hStatStreakRecord');
    if (hStreak) hStreak.textContent = `${streakDays} दिन`;
    if (hStreakSub) {
      hStreakSub.textContent = streakDays > 0 
        ? '🔥 लगातार अभ्यास जारी है' 
        : 'आज 1 डिक्टेशन कर स्ट्रीक शुरू करें';
    }
    if (hStreakTag) {
      hStreakTag.textContent = streakDays > 0 ? `${streakDays} दिन स्ट्रीक` : 'दैनिक नियमितता';
    }
    if (hStreakRecord) {
      hStreakRecord.textContent = `अधिकतम रिकॉर्ड: ${longestStreak} दिन`;
    }

    // 2. Daily Goal Card
    const hGoal = document.getElementById('hStatGoal');
    const hGoalSub = document.getElementById('hStatGoalSub');
    const hGoalTag = document.getElementById('hStatGoalTag');
    const hGoalBar = document.getElementById('hStatGoalBar');
    const completedDict = goal.completed_dictations || 0;
    const targetDict = goal.target_dictations || 3;
    const pct = goal.percent_completed || Math.min(100, Math.round((completedDict / targetDict) * 100));
    if (hGoal) hGoal.textContent = `${completedDict} / ${targetDict} डिक्टेशन`;
    if (hGoalSub) {
      if (completedDict >= targetDict) {
        hGoalSub.textContent = '🎉 आज का लक्ष्य पूर्ण (+20 Pts बोनस)';
      } else {
        const left = targetDict - completedDict;
        hGoalSub.textContent = `आज ${left} डिक्टेशन शेष हैं (${pct}% पूर्ण)`;
      }
    }
    if (hGoalTag) {
      hGoalTag.textContent = completedDict >= targetDict ? 'लक्ष्य सिद्ध ✓' : `${pct}% पूर्ण`;
    }
    if (hGoalBar) {
      hGoalBar.style.width = `${pct}%`;
    }

    // 3. Average Speed Card
    const hAvgWpm = document.getElementById('hStatAvgWpm');
    const hAvgWpmSub = document.getElementById('hStatAvgWpmSub');
    const hAvgWpmTag = document.getElementById('hStatAvgWpmTag');
    const hAvgWpmTier = document.getElementById('hStatAvgWpmTier');
    const avgWpm = stats.avg_wpm !== undefined ? Number(stats.avg_wpm) : 0;
    if (hAvgWpm) hAvgWpm.textContent = `${avgWpm} WPM`;
    if (hAvgWpmSub) hAvgWpmSub.textContent = 'नेट शुद्ध टंकण गति';
    if (hAvgWpmTag) {
      if (avgWpm >= 100) hAvgWpmTag.textContent = 'कोर्ट / ग्रेड C';
      else if (avgWpm >= 80) hAvgWpmTag.textContent = 'SSC ग्रेड D';
      else if (avgWpm >= 60) hAvgWpmTag.textContent = 'मध्यम स्तर';
      else hAvgWpmTag.textContent = 'प्रारंभिक';
    }
    if (hAvgWpmTier) {
      if (avgWpm >= 100) hAvgWpmTier.textContent = '🏆 परीक्षा तैयार: उत्कृष्ट उच्च गति';
      else if (avgWpm >= 80) hAvgWpmTier.textContent = '🎯 SSC Grade D मानक गति पूर्ण';
      else if (avgWpm >= 60) hAvgWpmTier.textContent = '⚡ मध्यम स्तर: 80 WPM का लक्ष्य रखें';
      else hAvgWpmTier.textContent = '🌱 नियमित अभ्यास से गति 60+ ले जाएं';
    }

    // 4. Accuracy Card
    const hAcc = document.getElementById('hStatAccuracy');
    const hAccSub = document.getElementById('hStatAccSub');
    const hAccTag = document.getElementById('hStatAccTag');
    const hAccTier = document.getElementById('hStatAccTier');
    const avgAcc = stats.avg_accuracy !== undefined ? Number(stats.avg_accuracy) : 0;
    if (hAcc) hAcc.textContent = `${avgAcc}%`;
    if (hAccSub) {
      if (avgAcc >= 95) hAccSub.textContent = '💎 उत्कृष्ट शुद्धता (गलतियां < 5%)';
      else if (avgAcc >= 90) hAccSub.textContent = '✅ मानक शुद्धता (गलतियां < 10%)';
      else hAccSub.textContent = '⚠️ शुद्धता पर ध्यान दें (त्रुटियां कम करें)';
    }
    if (hAccTag) {
      if (avgAcc >= 95) hAccTag.textContent = 'उत्कृष्ट 💎';
      else if (avgAcc >= 90) hAccTag.textContent = 'मानक शुद्धता';
      else hAccTag.textContent = 'सुधार अपेक्षित';
    }
    if (hAccTier) {
      hAccTier.textContent = 'आधिकारिक परीक्षा लक्ष्य: 95%+';
    }

    // 5. Total Practices Card
    const hPractices = document.getElementById('hStatPractices');
    const hPracticesSub = document.getElementById('hStatPracticesSub');
    const hPracticesTag = document.getElementById('hStatPracticesTag');
    const hTotalWords = document.getElementById('hStatTotalWords');
    const totalPrac = stats.total_practices || 0;
    const totalWords = stats.total_words || 0;
    if (hPractices) hPractices.textContent = `${totalPrac} सत्र`;
    if (hPracticesSub) hPracticesSub.textContent = 'सफलतापूर्वक पूर्ण डिक्टेशन';
    if (hPracticesTag) hPracticesTag.textContent = `${totalPrac} पूर्ण`;
    if (hTotalWords) {
      hTotalWords.textContent = `कुल ${Number(totalWords).toLocaleString('hi-IN')} शब्द टाइप`;
    }

    // 6. Reward Points Card
    const hPoints = document.getElementById('hStatPoints');
    const hPointsSub = document.getElementById('hStatPointsSub');
    const hPointsTag = document.getElementById('hStatPointsTag');
    const hPointsTier = document.getElementById('hStatPointsTier');
    if (hPoints) hPoints.textContent = `${realPoints} Pts`;
    if (hPointsSub) hPointsSub.textContent = 'सटीकता व नियमितता से अर्जित';
    if (hPointsTag) hPointsTag.textContent = 'सत्यापित अंक';
    if (hPointsTier) hPointsTier.textContent = '+10 Pts प्रति पूर्ण डिक्टेशन';

    // 7. Best Speed Card
    const hBestWpm = document.getElementById('hStatBestWpm');
    const hBestWpmSub = document.getElementById('hStatBestWpmSub');
    const hBestWpmTag = document.getElementById('hStatBestWpmTag');
    const hBestWpmTier = document.getElementById('hStatBestWpmTier');
    const bestWpm = stats.best_wpm !== undefined ? Number(stats.best_wpm) : 0;
    if (hBestWpm) hBestWpm.textContent = `${bestWpm} WPM`;
    if (hBestWpmSub) hBestWpmSub.textContent = 'उच्चतम रिकॉर्ड गति';
    if (hBestWpmTag) hBestWpmTag.textContent = 'ऑल-टाइम हाई 🚀';
    if (hBestWpmTier) hBestWpmTier.textContent = 'व्यक्तिगत सर्वश्रेष्ठ टंकण रिकॉर्ड';

    // 8. Total Time Card
    const hTotalTime = document.getElementById('hStatTotalTime');
    const hTotalTimeSub = document.getElementById('hStatTotalTimeSub');
    const hTotalTimeTag = document.getElementById('hStatTotalTimeTag');
    const hTotalTimeMicro = document.getElementById('hStatTotalTimeMicro');
    if (hTotalTime) hTotalTime.textContent = `${stats.total_time_formatted || '0 mins'}`;
    if (hTotalTimeSub) hTotalTimeSub.textContent = 'सक्रिय टाइपिंग अभ्यास';
    if (hTotalTimeTag) hTotalTimeTag.textContent = 'समय निवेश';
    if (hTotalTimeMicro) hTotalTimeMicro.textContent = 'दैनिक 15-30 मिनट अभ्यास रखें';
  }

  async refreshDashboardLive(showToast = false) {
    if (!this.user) return;
    try {
      const res = await this.apiCall('/api/progress/summary');
      if (res) {
        this._applySummaryToDOM(res);
        try {
          localStorage.setItem('stenomaster_cached_summary', JSON.stringify(res));
        } catch(e) {}
        if (showToast) {
          this.showToast('डैशबोर्ड आंकड़े लाइव अपडेट हुए! ✓', 'success');
        }
      }
    } catch(err) {
      console.warn('Live refresh error:', err);
    }
  }

  async renderDailyTargetSummary() {
    if (!this.user) return;
    try {
      const cached = localStorage.getItem('stenomaster_cached_summary');
      if (cached) {
        this._applySummaryToDOM(JSON.parse(cached));
      }
    } catch(e) {}
    try {
      const res = await this.apiCall('/api/progress/summary');
      if (res) {
        this._applySummaryToDOM(res);
        try {
          localStorage.setItem('stenomaster_cached_summary', JSON.stringify(res));
        } catch(e) {}
      }
    } catch (err) {
      console.warn('Could not fetch daily target summary');
    }
  }

  renderHomeCards() {
    const grid = document.getElementById('homeClassCardsGrid');
    if (!grid) return;

    // Show all classes together without any category filter split
    const list = (this.allPassages && this.allPassages.length > 0) ? this.allPassages : (this.passages || []);
    if (!list || list.length === 0) {
      this.renderPassagesSkeleton();
      return;
    }

    grid.innerHTML = list.map(p => this.createPassageCardHTML(p)).join('');
  }

  renderClasses() {
    const grid = document.getElementById('classesListGrid');
    if (!grid) return;

    if (this.passages.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted);">कोई क्लास नहीं मिली। कृपया फ़िल्टर बदलें।</div>';
      return;
    }

    grid.innerHTML = this.passages.map(p => this.createPassageCardHTML(p)).join('');
    this.renderHorizontalCategories();
  }

  // -------------------------------------------------------------------------
  // Hover / Touch Audio & Passage Pre-Buffering (Instant 0ms Dictation Launch)
  // -------------------------------------------------------------------------
  prefetchPassage(passageId) {
    if (!passageId) return;
    const pId = parseInt(passageId, 10);
    if (!this._prefetchedIds) this._prefetchedIds = new Set();
    if (this._prefetchedIds.has(pId)) return;
    this._prefetchedIds.add(pId);

    // 1. Prefetch Passage Metadata into memory cache
    if (!this._passageDetailsCache) this._passageDetailsCache = new Map();
    if (!this._passageDetailsCache.has(pId)) {
      this.apiCall(`/api/passages/${pId}`).then(res => {
        if (res && res.passage) {
          this._passageDetailsCache.set(pId, res.passage);
        }
      }).catch(() => {});
    }

    // 2. Prefetch Audio Stream into browser memory buffer
    const p = (this.allPassages || []).find(item => Number(item.id) === pId);
    if (p && p.audio_url && !p.is_locked) {
      try {
        if (!this._audioPrefetchCache) this._audioPrefetchCache = new Map();
        if (!this._audioPrefetchCache.has(pId)) {
          const audioPre = new Audio();
          audioPre.preload = 'auto';
          audioPre.src = p.audio_url;
          this._audioPrefetchCache.set(pId, audioPre);
          
          // Limit memory buffer to 6 recent items to avoid memory bloat
          if (this._audioPrefetchCache.size > 6) {
            const firstKey = this._audioPrefetchCache.keys().next().value;
            const oldA = this._audioPrefetchCache.get(firstKey);
            if (oldA) oldA.src = '';
            this._audioPrefetchCache.delete(firstKey);
          }
        }
      } catch (e) {}
    }
  }

  createPassageCardHTML(p) {
    const isBookmarked = this.bookmarks.has(p.id);
    const mins = Math.floor((p.duration_seconds || 180) / 60);
    const secs = (p.duration_seconds || 180) % 60;
    const durStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const wordCount = p.word_count || Math.max(1, Math.round((p.target_wpm || 80) * (p.duration_seconds || 180) / 60));
    const progressPercent = p.best_wpm ? Math.min(100, Math.round((p.best_wpm / p.target_wpm) * 100)) : 0;
    const hasFullAccess = !!(this.user && (this.user.role === 'admin' || this.user.subscription_status === 'active' || this.user.is_free_access));
    const isLocked = !hasFullAccess && !!p.is_locked;
    const isFree = !!p.is_free_tier || hasFullAccess;

    return `
      <div class="class-card ${isLocked ? 'locked-card' : ''}" onmouseenter="stenoApp.prefetchPassage(${p.id})" ontouchstart="stenoApp.prefetchPassage(${p.id})" onclick="${isLocked ? `stenoApp.handleLockedPassageClick(${p.id})` : `stenoApp.openPractice(${p.id})`}" style="cursor:pointer;">
        <div>
          <div class="class-card-header">
            <div class="class-badge-group">
              <span class="badge badge-${p.language}">${p.language === 'hindi' ? 'हिंदी' : 'English'}</span>
              <span class="badge badge-${p.difficulty}">${p.difficulty ? p.difficulty.toUpperCase() : 'MEDIUM'}</span>
              ${(p.title && (p.title.includes('रामधारी गुप्ता') || (p.tags && p.tags.includes('रामधारी')))) ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700;">📘 रामधारी गुप्ता</span>' : ''}
              ${(p.title && (p.title.includes('संपादकीय') || (p.tags && p.tags.includes('संपादकीय')))) ? '<span class="badge" style="background:#ecfdf5; color:#065f46; font-weight:700;">📰 दैनिक संपादकीय</span>' : ''}
              ${(p.title && (p.title.includes('विधिक') || p.title.includes('न्यायालय') || (p.tags && p.tags.includes('विधिक')))) ? '<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;">⚖️ विधिक / कोर्ट</span>' : ''}
              ${(p.target_wpm && p.target_wpm >= 120) ? '<span class="badge" style="background:#fce7f3; color:#9d174d; font-weight:700;">⚡ रिपोर्टर (140-160 WPM)</span>' : ''}
              <span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary)">⏱ ${durStr}</span>
              <span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary)" title="शब्द संख्या">📝 ${wordCount} शब्द</span>
              ${isFree ? '<span class="badge badge-free-tier">🎁 फ्री क्लास (Free)</span>' : ''}
              ${isLocked ? '<span class="badge badge-locked-tier">🔒 Pro Locked (₹100/माह)</span>' : ''}
              ${!isLocked && !isFree && p.is_premium ? '<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700; border:1px solid #fde68a;">👑 PRO</span>' : ''}
            </div>
            <button class="bookmark-toggle-btn ${isBookmarked ? 'active' : ''}" onclick="event.stopPropagation(); stenoApp.toggleBookmark(${p.id}, this)" title="बुकमार्क करें">
              ${isBookmarked ? '★' : '☆'}
            </button>
          </div>

          <h4 class="class-title hindi-text" style="margin-top:10px;">${this.escapeHtml(p.title)}</h4>
          <div class="class-category" style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">📂 ${this.escapeHtml(p.category_name || '')}</div>

          <div class="class-stats-row">
            <div class="class-stat-item">
              <div class="stat-lbl">लक्ष्य गति</div>
              <div class="stat-val">${p.target_wpm} WPM</div>
            </div>
            <div class="class-stat-item">
              <div class="stat-lbl">सर्वश्रेष्ठ गति</div>
              <div class="stat-val" style="color:var(--primary);">${p.best_wpm ? `${p.best_wpm} WPM` : '—'}</div>
            </div>
            <div class="class-stat-item">
              <div class="stat-lbl">सटीकता</div>
              <div class="stat-val" style="color:var(--accent-green);">${p.best_accuracy ? `${p.best_accuracy}%` : '—'}</div>
            </div>
          </div>

          <!-- Progress Indicator -->
          <div style="margin-top:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
              <span>प्रगति (Mastery Progress)</span>
              <span>${progressPercent}%</span>
            </div>
            <div style="height:5px; background:var(--bg-subtle); border-radius:10px; overflow:hidden;">
              <div style="height:100%; width:${progressPercent}%; background:var(--primary); border-radius:10px; transition:width 0.3s ease;"></div>
            </div>
          </div>
        </div>

        <div class="class-card-footer">
          <span style="font-size:0.8rem; color:var(--text-muted);">${isLocked ? '🔒 प्रो आवश्यक' : 'ऑडियो डिक्टेशन'}</span>
          ${isLocked ? `
            <button class="start-practice-btn btn-locked" onclick="event.stopPropagation(); stenoApp.handleLockedPassageClick(${p.id})">
              <span>🔒 अनलॉक करें (₹100/माह) →</span>
            </button>
          ` : `
            <button class="start-practice-btn" onmouseenter="stenoApp.prefetchPassage(${p.id})" onclick="event.stopPropagation(); stenoApp.openPractice(${p.id})">
              <span>${isFree ? '🎁 फ्री अभ्यास शुरू करें →' : (p.is_premium ? '👑 Pro Practice →' : 'Start Practice →')}</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  handleLockedPassageClick(passageId) {
    if (!this.user) {
      this.showAuthGateway('student', 'प्रीमियम डिक्टेशन अनलॉक करने के लिए कृपया पहले लॉगिन करें।');
      return;
    }
    this.openModal('lockedClassProModal');
  }

  async toggleBookmark(passageId, btnEl) {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/bookmarks/toggle', 'POST', { passage_id: passageId });
      if (res.is_bookmarked) {
        this.bookmarks.add(passageId);
        btnEl.classList.add('active');
        btnEl.textContent = '★';
        this.showToast('आलेख बुकमार्क किया गया ⭐', 'success');
      } else {
        this.bookmarks.delete(passageId);
        btnEl.classList.remove('active');
        btnEl.textContent = '☆';
        this.showToast('बुकमार्क हटाया गया', 'info');
      }
    } catch (err) {
      this.showToast('बुकमार्क अपडेट विफल', 'error');
    }
  }

  // -------------------------------------------------------------------------
  // Practice Dictation Flow (Phase 8)
  // -------------------------------------------------------------------------
  async openPractice(passageId, forcedSystem = null, customPassage = null) {
    if (this.activeView && this.activeView !== 'practice') {
      this.practiceOrigin = {
        view: this.activeView,
        categoryId: this.currentCategoryId || null,
        categoryData: this.currentCategoryData || null
      };
    }
    if (customPassage) {
      this.currentPassage = customPassage;
      const selectedSystem = forcedSystem || (this.currentPassage.typing_system || 'mangal_unicode');
      this.startPracticeWithSystem(selectedSystem);
      return;
    }
    try {
      const pId = parseInt(passageId, 10);
      const cardEl = document.querySelector(`.class-card[onclick*="openPractice(${passageId})"]`);
      if (cardEl) {
        cardEl.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        cardEl.style.opacity = '0.75';
        cardEl.style.transform = 'scale(0.99)';
      }

      // 1. Instantaneous 0ms in-memory lookup from this.allPassages or cache
      const inMem = (this.allPassages || []).find(p => Number(p.id) === pId);
      let passage = this._passageDetailsCache ? this._passageDetailsCache.get(pId) : null;
      if (!passage && inMem) {
        passage = { ...inMem };
      }

      const hasFullAccess = !!(this.user && (this.user.role === 'admin' || this.user.subscription_status === 'active' || this.user.is_free_access));

      // Check lock status before entering
      if (passage && passage.is_locked && !hasFullAccess) {
        this.handleLockedPassageClick(pId);
        return;
      }

      // 2. If available in memory (99.9% of times), launch practice room IN 0ms!
      if (passage) {
        this.currentPassage = passage;
        const savedPref = forcedSystem || localStorage.getItem('stenomaster_preferred_font') || localStorage.getItem('stenomaster_typing_mode') || 'mangal_unicode';
        const preferredSystem = (savedPref === 'kruti_dev_010' || savedPref === 'krutidev') ? 'kruti_dev_010' : 'mangal_unicode';
        const sys = this.currentPassage.typing_system || 'dual';
        const systemToStart = (sys === 'kruti_dev_010') ? 'kruti_dev_010' : (sys === 'mangal_unicode' ? 'mangal_unicode' : preferredSystem);

        this.startPracticeWithSystem(systemToStart);

        // Background hydration for instructions and steno notes (zero UI blocking)
        if (!this._passageDetailsCache || !this._passageDetailsCache.has(pId)) {
          this.apiCall(`/api/passages/${pId}`).then(res => {
            if (res && res.passage) {
              if (this._passageDetailsCache) this._passageDetailsCache.set(pId, res.passage);
              if (this.currentPassage && Number(this.currentPassage.id) === pId) {
                if (res.passage.instructions) {
                  this.currentPassage.instructions = res.passage.instructions;
                  const instrEl = document.getElementById('practiceInstructions');
                  if (instrEl) instrEl.textContent = res.passage.instructions;
                }
                if (res.passage.steno_notes_url) {
                  this.currentPassage.steno_notes_url = res.passage.steno_notes_url;
                  this.currentPassage.steno_notes_type = res.passage.steno_notes_type;
                  const stenoBtn = document.getElementById('practiceStenoNotesBtn');
                  if (stenoBtn) {
                    stenoBtn.style.display = 'inline-flex';
                    stenoBtn.textContent = res.passage.steno_notes_type === 'pdf' ? '📄 स्टेनो PDF देखें' : '📝 स्टेनो आउटलाइन देखें';
                  }
                }
              }
            }
          }).catch(() => {});
        }
        return;
      }

      // Fallback only if item not in memory
      const res = await this.apiCall(`/api/passages/${pId}`);
      passage = res ? res.passage : null;
      if (!passage) {
        this.showToast('यह आलेख अब उपलब्ध नहीं है। सूची अपडेट की जा रही है...', 'warning');
        await this.loadPassages(true);
        return;
      }
      if (passage.is_locked && !hasFullAccess) {
        this.handleLockedPassageClick(pId);
        return;
      }
      this.currentPassage = passage;
      const savedPref = forcedSystem || localStorage.getItem('stenomaster_preferred_font') || localStorage.getItem('stenomaster_typing_mode') || 'mangal_unicode';
      const preferredSystem = (savedPref === 'kruti_dev_010' || savedPref === 'krutidev') ? 'kruti_dev_010' : 'mangal_unicode';
      const sys = this.currentPassage.typing_system || 'dual';
      this.startPracticeWithSystem(sys === 'kruti_dev_010' ? 'kruti_dev_010' : (sys === 'mangal_unicode' ? 'mangal_unicode' : preferredSystem));
    } catch (err) {
      const cardEl = document.querySelector(`.class-card[onclick*="openPractice(${passageId})"]`);
      if (cardEl) {
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'none';
      }
      if (err.message && (err.message.includes('PRO_SUBSCRIPTION_REQUIRED') || err.message.includes('लॉक') || err.message.includes('सदस्यता'))) {
        this.handleLockedPassageClick(passageId);
      } else if (err.message && (err.message.includes('not found') || err.message.includes('नहीं मिला') || err.message.includes('404'))) {
        this.showToast('आलेख सूची अपडेट की जा रही है...', 'info');
        this.loadPassages(true);
      } else {
        this.showToast('आलेख लोड करने में विफलता: ' + err.message, 'error');
      }
    }
  }

  confirmDualModeSelection(selectedSystem) {
    this.closeModal('dualModeSelectModal');
    this.setPreferredFont(selectedSystem);
    this.startPracticeWithSystem(selectedSystem);
  }

  startPracticeWithSystem(selectedSystem) {
    if (!this.currentPassage) return;
    this.selectedTypingSystem = selectedSystem;

    // Apply typing mode styles to typing engine (Mangal vs Kruti Dev)
    if (selectedSystem === 'kruti_dev_010') {
      stenoTypingEngine.setTypingMode('krutidev');
    } else {
      stenoTypingEngine.setTypingMode('mangal');
    }

    // Populate Practice Header Info safely
    const titleEl = document.getElementById('practicePassageTitle');
    if (titleEl) titleEl.textContent = this.currentPassage.title || 'आलेख अभ्यास';
    const catEl = document.getElementById('practiceCategoryName');
    if (catEl) catEl.textContent = this.currentPassage.category_name || '';
    const modeBadgeText = selectedSystem === 'kruti_dev_010' ? 'KRUTI DEV 010' : 'MANGAL / UNICODE';
    const langBadge = document.getElementById('practiceLanguageBadge');
    if (langBadge) langBadge.textContent = `${(this.currentPassage.language || 'hindi').toUpperCase()} (${modeBadgeText})`;
    const diffBadge = document.getElementById('practiceDifficultyBadge');
    if (diffBadge) diffBadge.textContent = (this.currentPassage.difficulty || 'medium').toUpperCase();
    const wpmBadge = document.getElementById('practiceTargetWpm');
    if (wpmBadge) wpmBadge.textContent = `${this.currentPassage.target_wpm || 80} WPM`;
    const instrEl = document.getElementById('practiceInstructions');
    if (instrEl) instrEl.textContent = this.currentPassage.instructions || 'ऑडियो ध्यानपूर्वक सुनें और शुद्धता के साथ टाइप करें।';

    // Show Steno Outline Button if notes are attached
    const stenoBtn = document.getElementById('practiceStenoNotesBtn');
    if (stenoBtn) {
      if (this.currentPassage.steno_notes_url) {
        stenoBtn.style.display = 'inline-flex';
        stenoBtn.textContent = this.currentPassage.steno_notes_type === 'pdf' ? '📄 स्टेनो PDF देखें' : '📝 स्टेनो आउटलाइन देखें';
      } else {
        stenoBtn.style.display = 'none';
      }
    }

    // Reference text for audio player if synthesizing speech (never mix: use chosen reference text)
    const audioRefText = selectedSystem === 'kruti_dev_010'
      ? (this.currentPassage.official_kruti_dev_text || this.currentPassage.official_text_krutidev || this.currentPassage.official_text)
      : (this.currentPassage.official_mangal_text || this.currentPassage.official_text);

    // Setup Audio Player with streaming or synthesis fallback
    stenoAudioPlayer.loadAudio(
      this.currentPassage.audio_url,
      this.currentPassage.duration_seconds,
      audioRefText,
      this.currentPassage.language,
      this.currentPassage.target_wpm || 80
    );

    // Pre-unlock audio element synchronously during user click to ensure zero browser autoplay block!
    if (stenoAudioPlayer.audioElement && !stenoAudioPlayer.isSpeechSynthesis) {
      try {
        const unlockP = stenoAudioPlayer.audioElement.play();
        if (unlockP !== undefined) {
          unlockP.then(() => {
            stenoAudioPlayer.audioElement.pause();
            stenoAudioPlayer.audioElement.currentTime = 0;
          }).catch(() => {});
        }
      } catch (e) {}
    }

    // Start typing engine
    stenoTypingEngine.startPractice(this.currentPassage);

    // Initialize exam evaluation rule (SSC vs UPSSSC)
    const userTarget = (this.user && this.user.target_exam || '').toLowerCase();
    const defaultRule = userTarget.includes('upsssc') ? 'upsssc' : 'ssc_steno';
    this.setExamRule(this.currentExamRule || defaultRule, false);

    this.navigate('practice');
    if (window.stenoAudioPlayer) {
      window.stenoAudioPlayer.updateWpmUI();
    }

    // Dictation & timer start ONLY when student clicks the Play (▶️) button
    if (window.stenoAudioPlayer) {
      window.stenoAudioPlayer.pause();
    }
  }

  // -------------------------------------------------------------------------
  // Dynamic Script Loader (Lazy Loads charts & comparison view on-demand)
  // -------------------------------------------------------------------------
  async loadScript(src) {
    if (document.querySelector(`script[src*="${src}"]`)) return true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  }

  async ensureComparisonView() {
    if (window.stenoComparisonView) return window.stenoComparisonView;
    try {
      await this.loadScript('/js/comparison_view.js?v=7.4');
    } catch (e) {
      console.warn('Failed to dynamic load comparison_view.js:', e);
    }
    return window.stenoComparisonView;
  }

  async ensureCharts() {
    if (window.stenoCharts) return window.stenoCharts;
    try {
      await this.loadScript('/js/charts.js?v=7.4');
    } catch (e) {
      console.warn('Failed to dynamic load charts.js:', e);
    }
    return window.stenoCharts;
  }

  async openCurrentPassageStenoNotes() {
    if (!this.currentPassage || !this.currentPassage.steno_notes_url) {
      this.showToast('इस आलेख के लिए स्टेनो आउटलाइन संलग्न नहीं है।', 'info');
      return;
    }
    const type = this.currentPassage.steno_notes_type || (this.currentPassage.steno_notes_url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    stenoComparisonView.openStenoLightbox(
      this.currentPassage.steno_notes_url,
      type,
      this.currentPassage.title || 'स्टेनो आउटलाइन व नोट्स'
    );
  }

  async submitPractice(autoSubmit = false) {
    const text = stenoTypingEngine.getText().trim();
    if (!text && !autoSubmit) {
      this.showToast('कृपया सबमिट करने से पहले कुछ टेक्स्ट टाइप करें।', 'error');
      return;
    }

    if (!autoSubmit && !confirm('क्या आप अपना टंकण अभ्यास जमा करना चाहते हैं? (Submit practice for evaluation)')) {
      return;
    }

    // Stop audio & timer
    stenoAudioPlayer.stop();
    const timeTaken = stenoTypingEngine.getElapsedSeconds();
    const typingMode = stenoTypingEngine.typingMode;

    const submitBtn = document.getElementById('submitPracticeBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Evaluating your typing...';
    }

    try {
      this.showToast('उत्तर का मूल्यांकन किया जा रहा है... ⚙️', 'info');

      const evalReport = await this.apiCall('/api/practice/submit', 'POST', {
        passage_id: this.currentPassage.id,
        is_custom: Boolean(this.currentPassage.is_custom),
        custom_official_text: this.currentPassage.is_custom ? (this.currentPassage.official_text || this.currentPassage.content) : null,
        typed_text: text,
        typing_mode: typingMode,
        selected_typing_system: this.selectedTypingSystem || (typingMode === 'krutidev' ? 'kruti_dev_010' : 'mangal_unicode'),
        exam_rule: this.currentExamRule || 'ssc_steno',
        time_taken_seconds: timeTaken,
        tab_switches: (window.stenoTypingEngine && window.stenoTypingEngine.tabSwitchCount) || 0
      }, 30000);

      stenoTypingEngine.stopPractice();
      this.showToast('मूल्यांकन पूर्ण! 🎉', 'success');

      // Instant live real-time dashboard update
      try {
        localStorage.removeItem('stenomaster_cached_summary');
        if (evalReport && evalReport.updated_summary) {
          this._applySummaryToDOM(evalReport.updated_summary);
          localStorage.setItem('stenomaster_cached_summary', JSON.stringify(evalReport.updated_summary));
        } else {
          this.renderDailyTargetSummary();
        }
      } catch (e) {
        console.warn('Post-submit live summary error:', e);
      }

      // Render Result Report Card (Lazy-load comparison_view.js)
      await this.ensureComparisonView();
      const reportContainer = document.getElementById('resultReportContainer');
      if (window.stenoComparisonView && reportContainer) {
        try {
          stenoComparisonView.renderResult(evalReport, reportContainer);
        } catch (renderErr) {
          console.error('Error in renderResult:', renderErr);
        }
      }
      this.navigate('result');
      if (!this.user) {
        this.showToast('स्कोर सुरक्षित रखने व इतिहास देखने हेतु लॉगिन करें।', 'info');
      }
    } catch (err) {
      if (err.status === 403) {
        this.showToast(err.message || 'यह अभ्यास केवल प्रो सदस्यों के लिए उपलब्ध है।', 'warning');
        this.openModal('subscriptionModal');
      } else if (err.status === 401) {
        this.showToast('सत्र समाप्त हो गया है, कृपया पुनः लॉगिन करें।', 'warning');
        this.openModal('loginModal');
      } else {
        this.showToast('सबमिशन में त्रुटि: ' + err.message, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 उत्तर सबमिट करें (Submit Practice)';
      }
    }
  }

  retryPractice() {
    if (this.currentPassage) {
      this.openPractice(this.currentPassage.id);
    } else {
      this.navigate('classes');
    }
  }

  // -------------------------------------------------------------------------
  // History & Reports
  // -------------------------------------------------------------------------
  async loadHistory() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/practice/history');
      const tbody = document.querySelector('#historyTable tbody');
      if (!tbody) return;

      const history = res.history || [];
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">अभी तक कोई अभ्यास नहीं किया गया है। पहला अभ्यास शुरू करें!</td></tr>';
        return;
      }

      tbody.innerHTML = history.map(h => {
        const dt = new Date(h.created_at).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
          <tr>
            <td><span style="font-size:0.82rem; color:var(--text-muted);">${dt}</span></td>
            <td><strong>${h.passage_title}</strong></td>
            <td><span style="font-weight:700; color:var(--primary);">${h.net_wpm} WPM</span></td>
            <td><span style="font-weight:700; color:var(--accent-green);">${h.accuracy}%</span></td>
            <td style="color:var(--accent-red);">${h.total_errors}</td>
            <td>${Math.floor(h.time_taken_seconds / 60)}m ${h.time_taken_seconds % 60}s</td>
            <td><span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary);">${h.typing_mode}</span></td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="stenoApp.viewSavedAttemptReport(${h.id})">📊 रिपोर्ट</button>
                <button class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="stenoApp.openPractice(${h.passage_id})">🔄 पुनः</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  async viewSavedAttemptReport(attemptId) {
    try {
      const res = await this.apiCall(`/api/practice/attempt/${attemptId}`);
      if (res.attempt && res.attempt.report) {
        const report = res.attempt.report;
        report.passage_title = res.attempt.passage_title;
        report.language = res.attempt.language;
        await this.ensureComparisonView();
        const reportContainer = document.getElementById('resultReportContainer');
        if (window.stenoComparisonView && reportContainer) {
          stenoComparisonView.renderResult(report, reportContainer);
        }
        this.navigate('result');
      }
    } catch (err) {
      this.showToast('रिपोर्ट लोड करने में विफलता', 'error');
    }
  }

  // -------------------------------------------------------------------------
  // Progress & Charts
  // -------------------------------------------------------------------------
  async loadProgress() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/progress/summary');
      if (!res) return;

      const stats = res.stats || {};
      const trends = res.trends || [];
      const weakWords = res.weak_words || [];
      const recentAttempts = res.recent_attempts || [];

      const emptyState = document.getElementById('progressEmptyState');
      const dataContainer = document.getElementById('progressDataContainer');

      if (!stats.total_practices || stats.total_practices === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (dataContainer) dataContainer.style.display = 'none';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (dataContainer) dataContainer.style.display = 'block';

      // 1. Qualification Status Banner
      const qualIcon = document.getElementById('qualIcon');
      const qualTitle = document.getElementById('qualTitle');
      const qualDesc = document.getElementById('qualDesc');
      const qualPassCount = document.getElementById('qualPassCount');
      const qualFailCount = document.getElementById('qualFailCount');
      const qualPassRate = document.getElementById('qualPassRate');

      const passCount = stats.qualified_count || 0;
      const failCount = stats.not_qualified_count || 0;
      const passRate = stats.pass_percentage || 0;

      if (qualPassCount) qualPassCount.textContent = passCount;
      if (qualFailCount) qualFailCount.textContent = failCount;
      if (qualPassRate) qualPassRate.textContent = `${passRate}%`;

      const avgErr = stats.avg_error_rate !== undefined ? stats.avg_error_rate : (100 - (stats.avg_accuracy || 100));

      if (avgErr <= 5.0) {
        if (qualIcon) qualIcon.textContent = '🌟';
        if (qualTitle) qualTitle.textContent = 'SSC Grade "C" एवं "D" दोनों में उत्तीर्ण (Qualified)';
        if (qualDesc) qualDesc.textContent = `शानदार प्रदर्शन! आपकी औसत गलती दर केवल ${avgErr.toFixed(1)}% है। आप SSC Grade 'C' (≤5%) और Grade 'D' (≤7%) दोनों के आधिकारिक कटऑफ मानक को पूरा कर रहे हैं।`;
      } else if (avgErr <= 7.0) {
        if (qualIcon) qualIcon.textContent = '✅';
        if (qualTitle) qualTitle.textContent = 'SSC Grade "D" में उत्तीर्ण (Qualified)';
        if (qualDesc) qualDesc.textContent = `बहुत अच्छा! आपकी औसत गलती दर ${avgErr.toFixed(1)}% है, जो SSC Grade 'D' (≤7%) के लिए मान्य है। Grade 'C' के लिए गलतियों को 5% से नीचे लाएं।`;
      } else {
        if (qualIcon) qualIcon.textContent = '⚠️';
        if (qualTitle) qualTitle.textContent = 'सुधार अपेक्षित (Improvement Required)';
        if (qualDesc) qualDesc.textContent = `वर्तमान औसत गलती दर ${avgErr.toFixed(1)}% है। SSC/UPSSSC परीक्षा उत्तीर्ण करने के लिए गलतियों को 7% (Grade 'D') या 5% (Grade 'C') से कम करना आवश्यक है।`;
      }

      // 2. Core 4 Metrics
      const elTotal = document.getElementById('progressTotalPractices');
      const elTime = document.getElementById('progressTotalTime');
      const elAvgWpm = document.getElementById('progressAvgWpm');
      const elAvgMistake = document.getElementById('progressAvgMistake');
      const elAvgAcc = document.getElementById('progressAvgAcc');
      const elBestWpm = document.getElementById('progressBestWpm');
      const elBestError = document.getElementById('progressBestError');

      if (elTotal) elTotal.textContent = stats.total_practices;
      if (elTime) elTime.textContent = `${stats.total_time_formatted || '0 mins'} अभ्यास`;
      if (elAvgWpm) elAvgWpm.textContent = `${stats.avg_wpm || 0} WPM`;
      if (elAvgMistake) elAvgMistake.textContent = `${avgErr.toFixed(1)}%`;
      if (elAvgAcc) elAvgAcc.textContent = `सटीकता: ${stats.avg_accuracy || 0}%`;
      if (elBestWpm) elBestWpm.textContent = `${stats.best_wpm || 0} WPM`;
      const bestErr = stats.best_error_rate !== undefined ? stats.best_error_rate : (100 - (stats.best_accuracy || 100));
      if (elBestError) elBestError.textContent = `न्यूनतम गलती: ${bestErr.toFixed(1)}%`;

      // 3. Draw Dual Trend Chart (Lazy-load charts.js on-demand)
      await this.ensureCharts();
      const trendCanvas = document.getElementById('stenoDualTrendChart');
      if (trendCanvas && window.stenoCharts && window.stenoCharts.drawDualTrendChart) {
        const trendPoints = trends.map((t, idx) => ({
          net_wpm: t.net_wpm || 0,
          error_rate: t.error_rate !== undefined ? t.error_rate : (100 - (t.accuracy || 100)),
          label: `T${idx + 1}`
        }));
        stenoCharts.drawDualTrendChart(trendCanvas, trendPoints);
      }

      // 4. Real Weak Words List
      const weakWordsList = document.getElementById('progressWeakWordsList');
      if (weakWordsList) {
        if (weakWords.length === 0) {
          weakWordsList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.88rem; padding: 20px 0; text-align: center;">🎉 बहुत खूब! पिछले टेस्टों में कोई बार-बार होने वाली गलती दर्ज नहीं हुई।</div>';
        } else {
          weakWordsList.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${weakWords.map(w => {
                const catLabel = w.category === 'missing' ? 'छूटा शब्द' : (w.category === 'spelling' ? 'वर्तनी' : (w.category === 'punctuation' ? 'विराम चिह्न' : 'त्रुटि'));
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; background: var(--bg-hover); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div>
                      <strong style="color: var(--text-main); font-size: 0.95rem;">${this.escapeHtml(w.target_word)}</strong>
                      ${w.typed_word && w.typed_word !== '—' && w.typed_word !== '' ? `<span style="font-size: 0.8rem; color: #ef4444; margin-left: 8px; text-decoration: line-through;">${this.escapeHtml(w.typed_word)}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(239,68,68,0.1); color: #ef4444; font-weight: 600;">${catLabel}</span>
                      <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">${w.count} बार</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
      }

      // 5. Recent Tests Scorecard Table
      const recentBody = document.getElementById('progressRecentTestsBody');
      if (recentBody) {
        if (recentAttempts.length === 0) {
          recentBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">कोई हालिया टेस्ट उपलब्ध नहीं है।</td></tr>';
        } else {
          recentBody.innerHTML = recentAttempts.map((a, idx) => {
            const isQual = Boolean(a.is_qualified || (a.error_rate <= 7.0));
            const badgeClass = isQual 
              ? 'background: rgba(16,185,129,0.12); color: #059669; border: 1px solid rgba(16,185,129,0.25);'
              : 'background: rgba(239,68,68,0.12); color: #dc2626; border: 1px solid rgba(239,68,68,0.25);';
            const badgeText = isQual ? 'QUALIFIED ✓' : 'NOT QUALIFIED ✕';

            return `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 12px 10px; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                <td style="padding: 12px 10px; font-size: 0.82rem; color: var(--text-muted);">${a.test_date || '-'}</td>
                <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(a.title || 'डिक्टेशन')}</td>
                <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: var(--primary);">${a.net_wpm} WPM</td>
                <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: ${a.error_rate <= 7.0 ? '#10b981' : '#ef4444'};">${a.error_rate}%</td>
                <td style="padding: 12px 10px; text-align: center; color: var(--text-muted);">${a.accuracy}%</td>
                <td style="padding: 12px 10px; text-align: center;">
                  <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; ${badgeClass}">${badgeText}</span>
                </td>
                <td style="padding: 12px 10px; text-align: right;">
                  <button class="btn btn-sm btn-outline" onclick="stenoApp.viewSavedAttemptReport(${a.id})" style="padding: 4px 10px; font-size: 0.78rem;">रिपोर्ट →</button>
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Leaderboard
  // -------------------------------------------------------------------------
  async loadLeaderboard(period = 'all') {
    try {
      const res = await this.apiCall(`/api/leaderboard?period=${period}`);
      const tbody = document.querySelector('#leaderboardTable tbody');
      if (!tbody) return;

      const records = res.leaderboard || [];
      if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">इस अवधि में कोई लीडरबोर्ड रिकॉर्ड उपलब्ध नहीं है।</td></tr>';
        return;
      }

      tbody.innerHTML = records.map(r => {
        let rankBadge = r.rank;
        if (r.rank === 1) rankBadge = '🥇 1';
        else if (r.rank === 2) rankBadge = '🥈 2';
        else if (r.rank === 3) rankBadge = '🥉 3';

        return `
          <tr>
            <td><strong class="rank-medal">${rankBadge}</strong></td>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="user-avatar" style="width:32px; height:32px; font-size:0.8rem;">${r.display_name.charAt(0)}</div>
                <div>
                  <div style="font-weight:600;">${r.display_name}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${r.target_exam || 'Steno Aspirant'}</div>
                </div>
              </div>
            </td>
            <td><strong style="color:var(--primary); font-size:1.05rem;">${r.best_wpm} WPM</strong></td>
            <td><strong style="color:var(--accent-green);">${r.avg_accuracy}%</strong></td>
            <td>${r.attempts_count}</td>
            <td><span class="badge" style="background:var(--accent-amber-subtle); color:#b45309;">⭐ ${r.points} Pts</span></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Bookmarks
  // -------------------------------------------------------------------------
  async loadBookmarks() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/bookmarks');
      const grid = document.getElementById('bookmarksListGrid');
      if (!grid) return;

      const bookmarks = res.bookmarks || [];
      if (bookmarks.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted);">आपने अभी तक कोई आलेख बुकमार्क नहीं किया है।</div>';
        return;
      }

      grid.innerHTML = bookmarks.map(p => this.createPassageCardHTML(p)).join('');
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Profile, Subscription, Refer & Earn, Notifications, Settings
  // -------------------------------------------------------------------------
  renderProfile() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    const stuCodeEl = document.getElementById('profileStudentCodeDisplay');
    const emailEl = document.getElementById('profileEmailDisplay');
    const phoneEl = document.getElementById('profilePhoneDisplay');
    const badgeEl = document.getElementById('profileSubscriptionBadge');

    if (stuCodeEl) stuCodeEl.textContent = this.user.student_code || `STM-2026-${String(this.user.user_id || 1).padStart(6, '0')}`;
    if (emailEl) emailEl.textContent = this.user.email || 'student@stenomaster.com';
    if (phoneEl) phoneEl.textContent = this.user.phone ? `📱 ${this.user.phone}` : 'फ़ोन नंबर दर्ज नहीं है';

    if (badgeEl) {
      if (this.user.subscription_status === 'active') {
        const expStr = this.user.subscription_end ? new Date(this.user.subscription_end).toLocaleDateString('hi-IN') : 'सक्रिय';
        badgeEl.className = 'badge badge-success';
        badgeEl.textContent = `👑 Pro Active (वैधता: ${expStr})`;
      } else {
        badgeEl.className = 'badge badge-secondary';
        badgeEl.textContent = 'Free Plan';
      }
    }

    document.getElementById('profileDisplayNameInput').value = this.user.display_name || '';
    document.getElementById('profileTargetExamSelect').value = this.user.target_exam || 'SSC Stenographer';
    document.getElementById('profileLanguageSelect').value = this.user.preferred_language || 'hindi';
    document.getElementById('profileTypingModeSelect').value = this.user.preferred_typing_mode || 'mangal';
    document.getElementById('profileTargetWpmInput').value = this.user.target_wpm || 50;
    document.getElementById('profileLeaderboardVisibility').checked = !!this.user.show_on_leaderboard;
  }

  // -------------------------------------------------------------------------
  // Subscription & Pro Payment Handlers (Phase 3)
  // -------------------------------------------------------------------------
  getActivePlanDisplay(details) {
    const rawPlan = (details.subscription_plan || details.plan_name || '').toLowerCase();
    const daysLeft = details.subscription_days_left !== undefined ? details.subscription_days_left : (details.days_left || 0);

    if (rawPlan.includes('admin')) {
      return { price: '₹0', name: 'एडमिन प्रो आजीवन प्लान', full: '₹0 (लाइफटाइम) — एडमिन प्रो प्लान' };
    }
    if (rawPlan.includes('800') || rawPlan.includes('1y') || rawPlan.includes('1 वर्ष') || rawPlan.includes('1 year') || daysLeft > 180) {
      return { price: '₹800', name: '1 वर्ष (365 दिन) प्लान', full: '₹800 का 1 वर्ष (365 दिन) प्लान' };
    }
    if (rawPlan.includes('450') || rawPlan.includes('6m') || rawPlan.includes('6 माह') || rawPlan.includes('6 month') || daysLeft > 90) {
      return { price: '₹450', name: '6 माह (180 दिन) प्लान', full: '₹450 का 6 माह (180 दिन) प्लान' };
    }
    if (rawPlan.includes('250') || rawPlan.includes('3m') || rawPlan.includes('3 माह') || rawPlan.includes('3 month') || daysLeft > 30) {
      return { price: '₹250', name: '3 माह (90 दिन) प्लान', full: '₹250 का 3 माह (90 दिन) प्लान' };
    }
    if (rawPlan.includes('30 दिन फ्री') || details.is_free_access) {
      return { price: '₹0', name: '30 दिन प्रो ट्रायल प्लान', full: '₹0 का 30 दिन प्रो ट्रायल प्लान' };
    }
    const priceStr = details.plan_price ? `₹${details.plan_price}` : '₹100';
    return { price: priceStr, name: '1 माह (30 दिन) प्लान', full: `${priceStr} का 1 माह (30 दिन) प्लान` };
  }

  renderActivePlanBar(details) {
    const barEl = document.getElementById('subActivePlanBox');
    if (!barEl) return;

    const isPro = Boolean(details.is_premium || details.subscription_status === 'active');
    const daysLeft = details.subscription_days_left !== undefined ? details.subscription_days_left : (details.days_left || 0);

    if (isPro && daysLeft > 0) {
      const planInfo = this.getActivePlanDisplay(details);
      const expDate = details.subscription_end
        ? new Date(details.subscription_end).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'सक्रिय';

      barEl.className = 'sub-active-bar bar-active';
      barEl.innerHTML = `
        <div class="sub-active-bar-inner">
          <div class="sub-active-bar-left">
            <span class="sub-active-badge"><span class="sub-active-pulse-dot"></span> सक्रिय प्लान (Active Plan)</span>
            <span class="sub-active-highlight">${planInfo.full} एक्टिव है</span>
          </div>
          <div class="sub-active-bar-right">
            <span class="sub-active-days-chip">⏳ <strong>${daysLeft} दिन शेष</strong></span>
            <span class="sub-active-exp-text">(वैधता: ${expDate} तक)</span>
          </div>
        </div>
      `;
    } else {
      barEl.className = 'sub-active-bar bar-inactive';
      barEl.innerHTML = `
        <div class="sub-active-bar-inner">
          <div class="sub-active-bar-left">
            <span class="sub-active-lead">🔴 कोई प्लान एक्टिव नहीं है (No Active Plan)</span>
            <span class="sub-active-desc">— असीमित डिक्टेशन अभ्यास व परीक्षा मोड के लिए नीचे से कोई भी प्लान चुनें।</span>
          </div>
          <div class="sub-active-bar-right">
            <span class="sub-active-pill-inactive">अक्रिय (Inactive)</span>
          </div>
        </div>
      `;
    }
  }

  async loadSubscription() {
    try {
      if (this.user) {
        this.renderActivePlanBar(this.user);
      }
      const details = await this.apiCall('/api/subscription/details');
      this.subscriptionPlans = details.plans || [];
      const upiId = details.upi_id || 'stenomaster@upi';
      const statusBadgeWrap = document.getElementById('subCurrentStatusBadgeWrap');
      if (statusBadgeWrap) { statusBadgeWrap.style.display = 'none'; statusBadgeWrap.innerHTML = ''; }
      this.renderActivePlanBar(details);
      const expiringBanner = document.getElementById('subExpiringSoonBanner');
      const qrImgEl = document.getElementById('subActiveQrImg');
      const upiDisplayEl = document.getElementById('subUpiIdDisplay');

      if (upiDisplayEl) upiDisplayEl.textContent = upiId;
      if (qrImgEl && details.qr_url) {
        qrImgEl.src = `${details.qr_url}?t=${Date.now()}`;
      }

      const isPro = Boolean(details.is_premium || details.subscription_status === 'active');
      const daysLeft = details.subscription_days_left !== undefined ? details.subscription_days_left : (details.days_left || 0);

      if (statusBadgeWrap) {
        if (isPro && daysLeft > 0) {
          const expDate = details.subscription_end ? new Date(details.subscription_end).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'सक्रिय';
          statusBadgeWrap.innerHTML = `
            <span class="badge badge-success" style="font-size:0.9rem; padding:8px 16px;">
              👑 Pro Active (वैधता: ${expDate} • ${daysLeft} दिन शेष)
            </span>
          `;
        } else {
          statusBadgeWrap.innerHTML = `
            <span class="badge badge-secondary" style="font-size:0.9rem; padding:8px 16px;">
              🆓 Free Plan (2 फ्री कक्षाएं)
            </span>
          `;
        }
      }

      // Expiring soon alert banner (shown if Pro and <= 3 days remain)
      if (expiringBanner) {
        if (isPro && daysLeft <= 3) {
          expiringBanner.style.display = 'flex';
          const titleEl = document.getElementById('subExpiryAlertTitle');
          const subEl = document.getElementById('subExpiryAlertSubtitle');
          if (titleEl) {
            titleEl.textContent = daysLeft <= 0 ? 'आपकी प्रो सदस्यता आज समाप्त हो रही है!' : `आपकी प्रो सदस्यता समाप्त होने में केवल ${daysLeft} दिन शेष हैं!`;
          }
          if (subEl) {
            subEl.textContent = 'बिना रुकावट डिक्टेशन अभ्यास जारी रखने के लिए नीचे अपना पसंदीदा प्लान चुनें और रिन्यू करें।';
          }
        } else {
          expiringBanner.style.display = 'none';
        }
      }

      // Render the multi-tier plans selector cards
      this.renderSubscriptionPlans();

      // Default selection: retain current selection if valid, or pick popular/first plan
      if (!this.selectedPlan || !this.subscriptionPlans.some(p => p.id === this.selectedPlan.id)) {
        const defaultPlan = this.subscriptionPlans.find(p => p.popular) || this.subscriptionPlans[0];
        if (defaultPlan) {
          this.selectSubscriptionPlan(defaultPlan.id);
        }
      } else {
        this.selectSubscriptionPlan(this.selectedPlan.id);
      }

      // Load Student's previous payment requests
      await this.loadStudentPaymentRequests();
    } catch (err) {
      console.error('Failed to load subscription details:', err);
    }
  }

  renderSubscriptionPlans() {
    const container = document.getElementById('subPlansGrid');
    if (!container) return;

    if (!this.subscriptionPlans || this.subscriptionPlans.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:16px;">प्लान लोड हो रहे हैं...</div>';
      return;
    }

    container.innerHTML = this.subscriptionPlans.map(plan => {
      const isPopular = plan.id === '3m' || (plan.badge && plan.badge.includes('POPULAR'));
      const isBest = plan.id === '1y' || (plan.badge && plan.badge.includes('BEST'));

      let tagHtml = '';
      if (isPopular) {
        tagHtml = '<div class="sub-plan-card-tag tag-popular">⭐ लोकप्रिय (POPULAR)</div>';
      } else if (isBest) {
        tagHtml = '<div class="sub-plan-card-tag tag-best">👑 बेस्ट वैल्यू (BEST VALUE)</div>';
      } else if (plan.savings) {
        tagHtml = `<div class="sub-plan-card-tag">💰 ${this.escapeHtml(plan.savings)}</div>`;
      }

      const durationTitle = plan.title_hi || `${plan.days} दिन`;
      const subtitle = plan.subtitle_hi || plan.name;
      const savingsPill = plan.savings ? `<div class="sub-plan-savings-pill">🎉 ${this.escapeHtml(plan.savings)}</div>` : '<div class="sub-plan-savings-pill" style="visibility:hidden;">—</div>';

      return `
        <div class="sub-plan-card" data-plan-id="${plan.id}" onclick="stenoApp.initiateCashfreePayment('${plan.id}')">
          ${tagHtml}
          <div>
            <div class="sub-plan-title">${this.escapeHtml(durationTitle)}</div>
            <div class="sub-plan-subtitle">${this.escapeHtml(subtitle)}</div>
            <div class="sub-plan-price-row">
              <span class="sub-plan-amount">₹${plan.price}</span>
              <span class="sub-plan-period">/ ${plan.days} दिन</span>
            </div>
            ${savingsPill}
          </div>
          <button type="button" class="sub-buy-now-btn" onclick="event.stopPropagation(); stenoApp.initiateCashfreePayment('${plan.id}')">
            <span>⚡ ₹${plan.price} में खरीदें</span>
            <span>→</span>
          </button>
        </div>
      `;
    }).join('');
  }

  setQrPlan(planId, price) {
    const plan = (this.subscriptionPlans || []).find(p => p.id === planId) || { id: planId, price: price, days: planId === '1y' ? 365 : planId === '6m' ? 180 : planId === '3m' ? 90 : 30, name: `StenoMaster Pro — ${planId}` };
    this.selectedPlan = plan;

    document.querySelectorAll('.qr-plan-chip').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-plan-id') === planId);
    });

    const qrPayAmountLabel = document.getElementById('qrPayAmountLabel');
    const payAmountInput = document.getElementById('payAmountInput');
    const payPlanNameInput = document.getElementById('payPlanNameInput');
    const payPlanDaysInput = document.getElementById('payPlanDaysInput');

    if (qrPayAmountLabel) qrPayAmountLabel.textContent = `₹${plan.price}`;
    if (payAmountInput) payAmountInput.value = plan.price;
    if (payPlanNameInput) payPlanNameInput.value = plan.name || `StenoMaster Pro — ${plan.days} दिन`;
    if (payPlanDaysInput) payPlanDaysInput.value = plan.days;
  }

  selectSubscriptionPlan(planId) {
    const plan = (this.subscriptionPlans || []).find(p => p.id === planId) || this.subscriptionPlans[0];
    if (!plan) return;
    this.selectedPlan = plan;

    // Update selection styling in plans grid
    document.querySelectorAll('#subPlansGrid .sub-plan-card').forEach(card => {
      const id = card.getAttribute('data-plan-id');
      const isSelected = id === plan.id;
      card.classList.toggle('selected', isSelected);
      const btn = card.querySelector('.sub-select-btn');
      if (btn) {
        btn.textContent = isSelected ? '✓ चयनित प्लान (Selected)' : 'यह प्लान चुनें →';
      }
    });

    // Update Showcase card details
    const planTitleEl = document.getElementById('subPlanTitleDisplay');
    const planPriceEl = document.getElementById('subPlanPriceDisplay');
    const planDaysEl = document.getElementById('subPlanDaysDisplay');
    const cashfreeBtnText = document.getElementById('btnCashfreeText');

    const durationTitle = plan.title_hi || `${plan.days} दिन`;
    if (planTitleEl) planTitleEl.textContent = `StenoMaster Pro — ${durationTitle}`;
    if (planPriceEl) planPriceEl.textContent = `₹${plan.price}`;
    if (planDaysEl) planDaysEl.textContent = `/ ${plan.days} दिन (${durationTitle})`;
    if (cashfreeBtnText) cashfreeBtnText.textContent = `⚡ ₹${plan.price} का सुरक्षित भुगतान करें (Pay ₹${plan.price} via Cashfree)`;

    // Update Manual QR accordion inputs & badges if present
    const qrPriceBadge = document.getElementById('qrPriceBadge');
    const qrPayAmountLabel = document.getElementById('qrPayAmountLabel');
    const payAmountInput = document.getElementById('payAmountInput');
    const payPlanNameInput = document.getElementById('payPlanNameInput');
    const payPlanDaysInput = document.getElementById('payPlanDaysInput');

    if (qrPriceBadge) qrPriceBadge.textContent = `₹${plan.price}`;
    if (qrPayAmountLabel) qrPayAmountLabel.textContent = `₹${plan.price}`;
    if (payAmountInput) payAmountInput.value = plan.price;
    if (payPlanNameInput) payPlanNameInput.value = plan.name;
    if (payPlanDaysInput) payPlanDaysInput.value = plan.days;
  }

  copyUpiId() {
    const upiEl = document.getElementById('subUpiIdDisplay');
    const upiId = upiEl ? upiEl.textContent.trim() : 'stenomaster@upi';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(upiId).then(() => {
        this.showToast(`UPI ID '${upiId}' क्लिपबोर्ड पर कॉपी हो गई! 📋`, 'success');
      }).catch(() => {
        this.fallbackCopyText(upiId);
      });
    } else {
      this.fallbackCopyText(upiId);
    }
  }

  async loadStudentPaymentRequests() {
    if (!this.user) return;
    const tbody = document.getElementById('studentPaymentsTableBody');
    if (!tbody) return;

    try {
      const res = await this.apiCall('/api/subscription/my-requests');
      const requests = res.requests || [];
      if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">कोई पूर्व भुगतान अनुरोध नहीं मिला।</td></tr>';
        return;
      }

      tbody.innerHTML = requests.map(r => {
        const dt = new Date(r.created_at).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        let statusBadge = '<span class="badge badge-warning">⏳ Pending</span>';
        if (r.status === 'approved') statusBadge = '<span class="badge badge-success">✅ Approved</span>';
        if (r.status === 'rejected') statusBadge = '<span class="badge badge-hard">❌ Rejected</span>';

        return `
          <tr>
            <td style="font-weight:700;">#${r.id}</td>
            <td>${this.escapeHtml(r.plan_name)}</td>
            <td><strong>₹${r.amount}</strong></td>
            <td><code>${this.escapeHtml(r.transaction_id)}</code></td>
            <td>${statusBadge}</td>
            <td>${dt}</td>
            <td style="font-size:0.85rem; color:var(--text-secondary);">${this.escapeHtml(r.admin_notes || '—')}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async handlePaymentSubmit(e) {
    if (e) e.preventDefault();
    const txnInput = document.getElementById('payTransactionIdInput');
    const screenshotInput = document.getElementById('payScreenshotUrlInput');
    const msgBox = document.getElementById('paymentSubmitMsg');
    const submitBtn = document.getElementById('submitPaymentBtn');

    if (!txnInput) return;
    const txnId = txnInput.value.trim();
    const screenshot = screenshotInput ? screenshotInput.value.trim() : '';

    if (!txnId) {
      if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.color = 'var(--accent-red)';
        msgBox.textContent = 'कृपया 12-अंकीय UPI Transaction ID / UTR दर्ज करें।';
      }
      return;
    }

    const currentPlan = this.selectedPlan || {
      name: document.getElementById('payPlanNameInput')?.value || 'StenoMaster Pro — 1 Month (₹100/माह)',
      price: parseFloat(document.getElementById('payAmountInput')?.value) || 100,
      days: parseInt(document.getElementById('payPlanDaysInput')?.value) || 30
    };

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'सत्यापन अनुरोध भेजा जा रहा है...'; }

    try {
      const res = await this.apiCall('/api/subscription/request-payment', 'POST', {
        transaction_id: txnId,
        screenshot_url: screenshot,
        plan_name: currentPlan.name,
        amount: currentPlan.price,
        plan_days: currentPlan.days
      });

      if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.color = 'var(--accent-green)';
        msgBox.textContent = res.message || 'भुगतान विवरण सफलतापूर्वक जमा किया गया!';
      }
      txnInput.value = '';
      if (screenshotInput) screenshotInput.value = '';

      this.showToast(`₹${currentPlan.price} का भुगतान अनुरोध सफलतापूर्वक सबमिट हुआ! एडमिन सत्यापन उपरांत प्रो सक्रिय होगा। 🎉`, 'success');
      await this.loadStudentPaymentRequests();
    } catch (err) {
      if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.color = 'var(--accent-red)';
        msgBox.textContent = err.message || 'सबमिशन विफल रहा।';
      } else {
        this.showToast(err.message || 'सबमिशन विफल रहा।', 'error');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'मैन्युअल UTR सबमिट करें (Submit Payment Proof)'; }
    }
  }

  // -------------------------------------------------------------------------
  // Cashfree Payment Gateway Integration (Instant Unlock)
  // -------------------------------------------------------------------------
  async initiateCashfreePayment(planId = null) {
    if (!this.user) {
      this.showAuthGateway('student', 'सदस्यता खरीदने के लिए कृपया पहले लॉगिन करें।');
      return;
    }

    let currentPlan = null;
    if (typeof planId === 'string') {
      currentPlan = (this.subscriptionPlans || []).find(p => p.id === planId);
    }
    if (!currentPlan) {
      currentPlan = this.selectedPlan || (this.subscriptionPlans && this.subscriptionPlans[0]) || { id: '1m', name: 'StenoMaster Pro — 1 Month', price: 100, days: 30 };
    }
    this.selectedPlan = currentPlan;

    // Visual feedback on the specific plan card button
    const cardEl = document.querySelector(`.sub-plan-card[data-plan-id="${currentPlan.id}"]`);
    const btnEl = cardEl ? cardEl.querySelector('.sub-buy-now-btn') : null;
    const originalContent = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = `<span>⏳ लोड हो रहा है...</span>`;
    }

    try {
      this.showToast(`Cashfree सुरक्षित भुगतान पेज (₹${currentPlan.price}) खोला जा रहा है... 🔐`, 'info');
      const returnUrl = `${window.location.origin}/?order_id={order_id}&payment=cashfree`;
      const orderData = await this.apiCall('/api/payment/cashfree/create-order', 'POST', {
        plan_id: currentPlan.id,
        amount: currentPlan.price,
        plan_days: currentPlan.days,
        plan_name: currentPlan.name,
        return_url: returnUrl
      });

      if (!orderData.success && !orderData.order_id) {
        throw new Error(orderData.error || 'ऑर्डर बनाने में असमर्थ।');
      }

      const orderId = orderData.order_id;
      const paymentSessionId = orderData.payment_session_id;
      const isSimulator = !!orderData.is_simulator;

      // If Cashfree JS SDK is available and we have a session ID & not simulator
      if (window.Cashfree && paymentSessionId && !isSimulator) {
        try {
          const cashfree = window.Cashfree({
            mode: orderData.mode === 'production' ? 'production' : 'sandbox'
          });

          cashfree.checkout({
            paymentSessionId: paymentSessionId,
            redirectTarget: '_self'
          }).then(async (result) => {
            if (result && result.error) {
              this.showToast(`भुगतान: ${result.error.message || 'भुगतान रद्द किया गया'}`, 'warning');
            }
          });
        } catch (sdkErr) {
          console.warn('Cashfree SDK redirect failed, falling back to direct verify:', sdkErr);
          await this.verifyCashfreeOrder(orderId, currentPlan);
        }
      } else {
        // Direct sandbox/simulation verification
        this.showToast('सैंडबॉक्स भुगतान सत्यापित किया जा रहा है... 💳', 'info');
        await this.verifyCashfreeOrder(orderId, currentPlan);
      }
    } catch (err) {
      this.showToast('भुगतान आरंभ करने में त्रुटि: ' + (err.message || 'अज्ञात त्रुटि'), 'error');
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalContent;
      }
    }
  }

  async verifyCashfreeOrder(orderId, plan = null) {
    try {
      this.showToast('भुगतान स्थिति जांची जा रही है... ⏳', 'info');
      const verifyRes = await this.apiCall('/api/payment/cashfree/verify', 'POST', {
        order_id: orderId
      });

      const planName = plan ? plan.name : 'प्रो सदस्यता';
      const planDays = plan ? `${plan.days} दिन` : '30 दिन';

      if (verifyRes.success && (verifyRes.order_status === 'PAID' || verifyRes.status === 'PAID')) {
        this.showToast(`🎉 भुगतान सफल! आपकी ${planName} (${planDays}) सक्रिय हो गई है!`, 'success');
        await this.fetchCurrentUser();
        this.updateUserUI();
        await this.loadPassages();
        await this.loadSubscription();
        this.navigate('classes');
      } else {
        this.showToast(verifyRes.message || 'भुगतान अभी लंबित है या रद्द हो गया।', 'warning');
        await this.fetchCurrentUser();
        this.updateUserUI();
        await this.loadSubscription();
      }
    } catch (err) {
      this.showToast('भुगतान सत्यापन में त्रुटि: ' + err.message, 'error');
    }
  }

  async saveProfile(e) {
    e.preventDefault();
    const payload = {
      display_name: document.getElementById('profileDisplayNameInput').value.trim(),
      target_exam: document.getElementById('profileTargetExamSelect').value,
      preferred_language: document.getElementById('profileLanguageSelect').value,
      preferred_typing_mode: document.getElementById('profileTypingModeSelect').value,
      target_wpm: parseInt(document.getElementById('profileTargetWpmInput').value) || 50,
      show_on_leaderboard: document.getElementById('profileLeaderboardVisibility').checked
    };

    try {
      await this.apiCall('/api/profile/update', 'POST', payload);
      this.showToast('प्रोफ़ाइल सफलतापूर्ण अपडेट की गई! ✅', 'success');
      await this.fetchCurrentUser();
    } catch (err) {
      this.showToast('प्रोफ़ाइल अपडेट में त्रुटि: ' + err.message, 'error');
    }
  }

  captureReferralParam() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('ref')) {
        const refCode = (urlParams.get('ref') || '').trim().toUpperCase();
        if (refCode) {
          localStorage.setItem('stenomaster_pending_referral', refCode);
          console.log('[Referral] Auto-captured referral code:', refCode);
          setTimeout(() => {
            this.applyPendingReferralUI(refCode);
            if (!this.token) {
              this.switchStudentAuthMode('signup');
              this.showToast(`🎉 रेफरल कोड '${refCode}' सक्रिय! पंजीकरण पर आपको 50 वेलकम बोनस अंक मिलेंगे।`, 'success', 6000);
            }
          }, 400);
        }
      } else {
        const stored = localStorage.getItem('stenomaster_pending_referral');
        if (stored) {
          this.applyPendingReferralUI(stored);
        }
      }
    } catch (e) {
      console.warn('Failed to parse referral param:', e);
    }
  }

  applyPendingReferralUI(refCode) {
    if (!refCode) return;
    const stuRefInput = document.getElementById('stuRegReferralCode');
    if (stuRefInput) {
      stuRefInput.value = refCode;
      const notice = document.getElementById('stuRegReferralNotice');
      if (notice) notice.style.display = 'block';
    }
    const regRefInput = document.getElementById('regReferralCode');
    if (regRefInput) {
      regRefInput.value = refCode;
    }
  }

  handleReferralInput(val) {
    const notice = document.getElementById('stuRegReferralNotice');
    if (notice) {
      notice.style.display = (val && val.trim().length > 2) ? 'block' : 'none';
    }
  }

  async loadReferrals() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/referrals/stats');
      const refCode = res.referral_code || this.user.referral_code || 'SMSTENO';
      const codeEl = document.getElementById('referralCodeDisplay');
      if (codeEl) codeEl.textContent = refCode;
      const linkEl = document.getElementById('referralShareLink');
      if (linkEl) linkEl.textContent = `${window.location.origin}/?ref=${refCode}`;
      const totalEl = document.getElementById('referralTotalCount');
      if (totalEl) totalEl.textContent = res.total_referrals || 0;
      const ptsEl = document.getElementById('referralPointsEarned');
      if (ptsEl) ptsEl.textContent = `${res.points_earned || 0} Pts`;
      const balEl = document.getElementById('referralTotalBalance');
      if (balEl) balEl.textContent = `${res.total_points || 0} Pts`;

      const badge = document.getElementById('referralHistoryBadge');
      if (badge) badge.textContent = `${res.total_referrals || 0} सफल रेफरल`;

      this.renderReferralHistory(res.history || []);
    } catch (err) {
      console.error('Failed to load referrals:', err);
    }
  }

  renderReferralHistory(history) {
    const container = document.getElementById('referralHistoryContainer');
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">👥</div>
          <p style="font-weight: 600; margin-bottom: 4px; color: var(--text-main);">अभी तक कोई रेफरल नहीं हुआ है</p>
          <p style="font-size: 0.85rem; max-width: 440px; margin: 0 auto; line-height:1.5;">
            ऊपर दिए गए अपने रेफरल लिंक को दोस्तों के साथ साझा करें। जब भी कोई छात्र जुड़ेगा, आपको <strong>100 रिवॉर्ड अंक</strong> और उन्हें <strong>50 अंक</strong> तुरंत मिलेंगे!
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 6px;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border); text-align: left; color: var(--text-muted);">
            <th style="padding: 10px 12px;">#</th>
            <th style="padding: 10px 12px;">छात्र का नाम (Student)</th>
            <th style="padding: 10px 12px;">शामिल होने की तिथि</th>
            <th style="padding: 10px 12px;">अर्जित अंक</th>
            <th style="padding: 10px 12px;">स्थिति</th>
          </tr>
        </thead>
        <tbody>
          ${history.map((item, idx) => {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'हाल ही में';
            const studentName = item.referred_display_name || item.referred_username || 'नया छात्र';
            return `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 10px 12px; color: var(--text-muted);">${idx + 1}</td>
                <td style="padding: 10px 12px; font-weight: 600; color: var(--text-main);">
                  <span style="display:inline-flex; align-items:center; gap:6px;">
                    <span>🎓</span> ${this.escapeHtml(studentName)}
                  </span>
                </td>
                <td style="padding: 10px 12px; color: var(--text-muted);">${dateStr}</td>
                <td style="padding: 10px 12px; font-weight: 700; color: #10b981;">+${item.reward_points || 100} Pts</td>
                <td style="padding: 10px 12px;">
                  <span class="badge badge-success" style="background:#dcfce7; color:#15803d; font-size:0.75rem; padding:3px 8px; border-radius:12px;">
                    ✓ सफल (Credited)
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  shareOnWhatsApp() {
    const refCode = document.getElementById('referralCodeDisplay')?.textContent?.trim() || 'STENO101';
    const link = `${window.location.origin}/?ref=${refCode}`;
    const text = `🎯 StenoMaster पर स्टेनोग्राफी और टाइपिंग की तैयारी करें! मेरे रेफरल कोड *${refCode}* से जुड़ें और पाएं 50 वेलकम बोनस अंक:\n${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  shareOnTelegram() {
    const refCode = document.getElementById('referralCodeDisplay')?.textContent?.trim() || 'STENO101';
    const link = `${window.location.origin}/?ref=${refCode}`;
    const text = `🎯 StenoMaster पर स्टेनोग्राफी और टाइपिंग की तैयारी करें! मेरे रेफरल कोड ${refCode} से जुड़ें और पाएं 50 वेलकम बोनस अंक!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
  }

  copyReferralCode() {
    const code = document.getElementById('referralCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.showToast(`रेफरल कोड '${code}' कॉपी किया गया! 📋`, 'success');
    });
  }

  copyReferralLink() {
    const link = document.getElementById('referralShareLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
      this.showToast('रेफरल लिंक क्लिपबोर्ड में कॉपी किया गया! 🔗', 'success');
    });
  }

  async loadNotifications() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/notifications');
      const listEl = document.getElementById('notificationsList');
      if (!listEl) return;

      const notes = res.notifications || [];
      if (notes.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">कोई नई अधिसूचना नहीं है।</div>';
        return;
      }

      listEl.innerHTML = notes.map(n => `
        <div class="stat-card" style="margin-bottom:12px; border-left: 4px solid var(--primary);">
          <div>
            <div style="font-weight:700; font-size:0.95rem;">${n.title}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${n.message}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">${new Date(n.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      `).join('');

      // Mark read
      this.apiCall('/api/notifications/mark-read', 'POST').catch(() => {});
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  renderSettings() {
    const themeSelect = document.getElementById('settingsThemeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('stenomaster_theme') || 'light';

    const modeSelect = document.getElementById('settingsTypingModeSelect');
    if (modeSelect) modeSelect.value = localStorage.getItem('stenomaster_typing_mode') || 'mangal';

    const speedSelect = document.getElementById('settingsAudioSpeedSelect');
    if (speedSelect) speedSelect.value = localStorage.getItem('stenomaster_audio_speed') || '1.0';
  }

  saveSettings(e) {
    e.preventDefault();
    const theme = document.getElementById('settingsThemeSelect').value;
    const mode = document.getElementById('settingsTypingModeSelect').value;
    const speed = document.getElementById('settingsAudioSpeedSelect').value;

    this.setTheme(theme);
    stenoTypingEngine.setTypingMode(mode);
    stenoAudioPlayer.setSpeed(speed);

    this.showToast('सेटिंग्स सुरक्षित कर ली गईं! ✅', 'success');
  }

  // -------------------------------------------------------------------------
  // Modals & Toast Utilities
  // -------------------------------------------------------------------------
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      console.warn('Modal not found:', modalId);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  togglePolicyAccordion(policyId) {
    const content = document.getElementById(policyId);
    if (!content) return;
    const isVisible = content.style.display === 'block';
    content.style.display = isVisible ? 'none' : 'block';
    const icon = document.getElementById(`${policyId}-icon`);
    if (icon) {
      icon.textContent = isVisible ? '▼' : '▲';
    }
    if (!isVisible) {
      setTimeout(() => {
        content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  updateSpeedChips(clickedChip) {
    if (!clickedChip) return;
    document.querySelectorAll('.speed-selector-group .speed-chip').forEach(c => c.classList.remove('active'));
    clickedChip.classList.add('active');
  }

  // -----------------------------------------------------------------------
  // Exam Rules Tab Switching (UPSSSC / SSC)
  // -----------------------------------------------------------------------
  switchRulesTab(tab, clickedBtn) {
    // Toggle panel visibility
    const upssscPanel = document.getElementById('rules-upsssc');
    const sscPanel = document.getElementById('rules-ssc');
    if (upssscPanel) upssscPanel.style.display = tab === 'upsssc' ? 'block' : 'none';
    if (sscPanel) sscPanel.style.display = tab === 'ssc' ? 'block' : 'none';

    // Toggle button active states
    document.querySelectorAll('.rules-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');
  }

  // Accordion card open/close for rules page
  toggleRuleCard(headerEl) {
    if (!headerEl) return;
    const card = headerEl.closest('.rules-card');
    if (!card) return;
    const body = card.querySelector('.rules-card-body');
    const arrow = card.querySelector('.rules-arrow');
    if (!body) return;

    const isOpen = body.style.display !== 'none' && body.style.maxHeight !== '0px';
    if (isOpen) {
      body.style.display = 'none';
      if (arrow) arrow.textContent = '▾';
    } else {
      body.style.display = 'block';
      if (arrow) arrow.textContent = '▴';
    }
  }

  openRewardsModal() {
    const summary = this.userSummary || {};
    const stats = summary.stats || {};
    const achievements = summary.achievements || [];
    const points = stats.points !== undefined && stats.points !== null ? stats.points : 0;
    const streak = stats.streak_days || 0;

    // 1. Live Current Points
    const ptsEl = document.getElementById('rewardModalCurrentPoints');
    if (ptsEl) ptsEl.textContent = `${points} Pts`;

    // 2. Live Current Streak
    const stkEl = document.getElementById('rewardModalCurrentStreak');
    if (stkEl) stkEl.textContent = `${streak} दिन`;

    // 3. Player Level & Tier
    const tierEl = document.getElementById('rewardModalPlayerTier');
    if (tierEl) {
      if (points >= 500) {
        tierEl.textContent = '👑 Steno Master';
        tierEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      } else if (points >= 250) {
        tierEl.textContent = '⚔️ Steno Warrior';
        tierEl.style.background = 'linear-gradient(135deg, #8b5cf6, #ec4899)';
      } else if (points >= 100) {
        tierEl.textContent = '⭐ Steno Achiever';
        tierEl.style.background = 'linear-gradient(135deg, #3b82f6, #06b6d4)';
      } else {
        tierEl.textContent = '🌱 Steno Cadet';
        tierEl.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }
    }

    // 4. Badges Evaluation
    const totalPrac = stats.total_practices || 0;
    const bestWpm = stats.best_wpm || 0;
    const bestAcc = stats.best_accuracy || 0;

    const unlockedKeys = new Set(achievements.map(a => a.badge_key));
    if (totalPrac >= 1) unlockedKeys.add('first_practice');
    if (totalPrac >= 10) unlockedKeys.add('practice_10');
    if (totalPrac >= 50) unlockedKeys.add('practice_50');
    if (bestAcc >= 90) unlockedKeys.add('accuracy_90');
    if (bestAcc >= 95) unlockedKeys.add('accuracy_95');
    if (bestWpm >= 40) unlockedKeys.add('speed_40');
    if (bestWpm >= 50) unlockedKeys.add('speed_50');
    if (streak >= 7) unlockedKeys.add('streak_7');

    const allBadges = [
      { key: 'first_practice', icon: '🧭', name: 'प्रथम डिक्टेशन (First Practice)', desc: 'पहली डिक्टेशन सफलतापूर्वक पूर्ण की।' },
      { key: 'practice_10', icon: '🎯', name: '10 डिक्टेशन क्लब (10 Practices)', desc: '10 डिक्टेशन अभ्यास सफलतापूर्ण पूरे किए।' },
      { key: 'practice_50', icon: '🛡️', name: 'स्टेनो योद्धा (50 Practices)', desc: '50 डिक्टेशन अभ्यास पूर्ण किए।' },
      { key: 'accuracy_90', icon: '⭐', name: '90% सटीकता स्टार (90% Accuracy)', desc: 'डिक्टेशन में 90%+ शुद्धता प्राप्त की।' },
      { key: 'accuracy_95', icon: '🎖️', name: '95% सटीकता मास्टर (95% Accuracy)', desc: '95%+ आधिकारिक परीक्षा स्तरीय शुद्धता।' },
      { key: 'speed_40', icon: '⚡', name: '40 WPM गति पार (40 WPM Speed)', desc: '40 शब्द प्रति मिनट की स्टेनो गति पार की।' },
      { key: 'speed_50', icon: '📈', name: '50 WPM गति पार (50 WPM Speed)', desc: '50 शब्द प्रति मिनट की उच्च गति दर्ज की।' },
      { key: 'streak_7', icon: '🔥', name: '7-दिवसीय स्ट्रीक (7 Day Streak)', desc: 'लगातार 7 दिन नियमित अभ्यास किया।' }
    ];

    let unlockedCount = 0;
    const grid = document.getElementById('rewardBadgesShowcaseGrid');
    if (grid) {
      grid.innerHTML = allBadges.map(b => {
        const isUnlocked = unlockedKeys.has(b.key);
        if (isUnlocked) unlockedCount++;
        return `
          <div class="badge-achievement-card ${isUnlocked ? 'unlocked' : ''}">
            <div class="badge-icon-box">${b.icon}</div>
            <div class="badge-info-box">
              <div class="badge-title-row">
                <span class="badge-name">${b.name}</span>
                <span class="badge-status-tag ${isUnlocked ? 'tag-unlocked' : 'tag-locked'}">
                  ${isUnlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}
                </span>
              </div>
              <div class="badge-desc">${b.desc}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    const countEl = document.getElementById('rewardModalBadgesCount');
    if (countEl) countEl.textContent = `${unlockedCount} / ${allBadges.length}`;
    const progEl = document.getElementById('rewardModalUnlockProgress');
    if (progEl) progEl.textContent = `${unlockedCount} / ${allBadges.length} अनलॉक`;

    this.openModal('rewardsModal');
  }

  togglePracticeKeyboard() {
    const drawer = document.getElementById('practiceKeyboardDrawer');
    const btn = document.getElementById('togglePracticeKeyboardBtn');
    if (!drawer) return;
    const isCurrentlyOpen = drawer.style.display !== 'none';
    if (isCurrentlyOpen) {
      drawer.style.display = 'none';
      if (btn) {
        btn.className = 'btn-secondary';
        btn.innerHTML = '⌨️ कीबोर्ड: OFF';
      }
      this.showToast('कीबोर्ड विजुअल छिपाया गया', 'info');
    } else {
      drawer.style.display = 'block';
      // Sync layout with current typing mode
      const curMode = (window.stenoTypingEngine && window.stenoTypingEngine.typingMode) || 'mangal';
      if (window.stenoKeyboardMap) {
        if (curMode === 'krutidev') {
          stenoKeyboardMap.currentLayout = 'krutidev';
        } else if (curMode === 'inscript') {
          stenoKeyboardMap.currentLayout = 'inscript';
        } else {
          stenoKeyboardMap.currentLayout = 'remington';
        }
        stenoKeyboardMap.renderPracticeDrawer();
      }
      if (btn) {
        btn.className = 'btn-primary';
        btn.innerHTML = '⌨️ कीबोर्ड: ON';
      }
      this.showToast('कीबोर्ड विजुअल सक्रिय! टाइपिंग करते समय देखें', 'success');
    }
    const ta = document.getElementById('typingTextarea');
    if (ta && document.activeElement !== ta) {
      ta.focus();
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  // -------------------------------------------------------------------------
  // Self Practice / Custom Audio & Text Handlers (v6.8 - ai 03 Steno Engine)
  // -------------------------------------------------------------------------
  initSelfPractice() {
    this.selfAudioMode = this.selfAudioMode || 'ai';
    this.switchSelfAudioMode(this.selfAudioMode);
    this.updateSelfTextStats();
    this.loadMyCustomClasses();
  }

  switchSelfAudioMode(mode) {
    this.selfAudioMode = mode;
    const aiBtn = document.getElementById('selfTabAiBtn');
    const uploadBtn = document.getElementById('selfTabUploadBtn');
    const silentBtn = document.getElementById('selfTabSilentBtn');

    const aiZone = document.getElementById('selfAiVoiceZone');
    const uploadZone = document.getElementById('selfAudioUploadZone');
    const uploadPreviewWrap = document.getElementById('selfAudioPreviewWrap');
    const silentNote = document.getElementById('selfSilentNote');

    if (aiBtn) aiBtn.className = mode === 'ai' ? 'btn-sm btn-primary' : 'btn-sm btn-secondary';
    if (uploadBtn) uploadBtn.className = mode === 'upload' ? 'btn-sm btn-primary' : 'btn-sm btn-secondary';
    if (silentBtn) silentBtn.className = mode === 'silent' ? 'btn-sm btn-primary' : 'btn-sm btn-secondary';

    if (aiZone) aiZone.style.display = mode === 'ai' ? 'block' : 'none';
    if (uploadZone) uploadZone.style.display = mode === 'upload' ? 'block' : 'none';
    if (uploadPreviewWrap) uploadPreviewWrap.style.display = (mode === 'upload' && this.selfAudioBlobUrl) ? 'block' : 'none';
    if (silentNote) silentNote.style.display = mode === 'silent' ? 'block' : 'none';
  }

  handleSelfAudioFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    this.selfAudioBlobUrl = URL.createObjectURL(file);
    this.selfAudioFileName = file.name;

    const nameEl = document.getElementById('selfAudioFileName');
    if (nameEl) nameEl.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    const preview = document.getElementById('selfAudioPreview');
    const previewWrap = document.getElementById('selfAudioPreviewWrap');
    if (preview && previewWrap) {
      preview.src = this.selfAudioBlobUrl;
      previewWrap.style.display = 'block';
    }
    this.showToast(`ऑडियो लोड हुआ: ${file.name}`, 'success');
  }

  updateSelfTextStats() {
    const text = (document.getElementById('selfMasterText')?.value || '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;

    const wordEl = document.getElementById('selfWordCount');
    const charEl = document.getElementById('selfCharCount');
    const estEl = document.getElementById('selfEstTime');

    if (wordEl) wordEl.textContent = words.toString();
    if (charEl) charEl.textContent = chars.toString();
    if (estEl) {
      const speed = parseInt(document.getElementById('selfTargetSpeed')?.value || '80', 10);
      const minutes = (words / speed).toFixed(1);
      estEl.textContent = `${minutes} मिनट (${speed} WPM)`;
    }
  }

  async pasteFromClipboardToSelf() {
    try {
      const text = await navigator.clipboard.readText();
      const ta = document.getElementById('selfMasterText');
      if (ta && text) {
        ta.value = text;
        this.updateSelfTextStats();
    this.loadMyCustomClasses();
        this.showToast('टेक्स्ट क्लिपबोर्ड से पेस्ट किया गया! 📋', 'success');
      }
    } catch (e) {
      this.showToast('क्लिपबोर्ड से ऑटो-पेस्ट की अनुमति नहीं मिली। कृपया मैन्युअल पेस्ट करें (Ctrl+V)', 'info');
    }
  }

  async handleSelfPhotoUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    input.value = '';

    const progressBox = document.getElementById('selfOcrProgressBox');
    const statusText = document.getElementById('selfOcrStatusText');
    const percentText = document.getElementById('selfOcrPercentText');
    const progressBar = document.getElementById('selfOcrProgressBar');
    const photoBtn = document.getElementById('selfPhotoUploadBtn');

    if (progressBox) progressBox.style.display = 'block';
    if (photoBtn) photoBtn.disabled = true;

    try {
      this.showToast('📷 फोटो स्कैन की जा रही है, कृपया प्रतीक्षा करें...', 'info');

      if (!window.stenoOcr) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/js/ocr_service.js?v=1.1';
          s.onload = resolve;
          s.onerror = () => reject(new Error('OCR स्क्रिप्ट लोड करने में त्रुटि'));
          document.head.appendChild(s);
        });
      }

      const result = await window.stenoOcr.extractText(file, ({ status, percent }) => {
        if (statusText) statusText.textContent = `🔍 ${status}`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;
      });

      if (!result.text || result.text.length < 5) {
        this.showToast('फोटो में कोई स्पष्ट टेक्स्ट नहीं मिला। कृपया साफ एवं सीधी फोटो अपलोड करें।', 'warning');
        return;
      }

      const ta = document.getElementById('selfMasterText');
      if (ta) {
        if (ta.value.trim().length > 0) {
          ta.value = ta.value.trim() + '\n\n' + result.text;
        } else {
          ta.value = result.text;
        }
        this.updateSelfTextStats();
    this.loadMyCustomClasses();
        ta.focus();
      }

      this.showToast(`✓ फोटो से ${result.wordCount} शब्द सफलतापूर्वक निकाले गए! 🎉`, 'success');

      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
      }, 2500);

    } catch (err) {
      console.error('Photo OCR error:', err);
      this.showToast(`OCR स्कैन त्रुटि: ${err.message}`, 'danger');
      if (statusText) statusText.textContent = '❌ स्कैन विफल: ' + (err.message || 'त्रुटि');
    } finally {
      if (photoBtn) photoBtn.disabled = false;
    }
  }

  async generateSelfAiAudio() {
    const text = (document.getElementById('selfMasterText')?.value || '').trim();
    if (!text || text.split(/\s+/).length < 5) {
      this.showToast('कृपया पहले मूल डिक्टेशन आलेख (Master Passage) में कम से कम 5-10 शब्द लिखें या पेस्ट करें।', 'warning');
      const ta = document.getElementById('selfMasterText');
      if (ta) ta.focus();
      return null;
    }

    const speed = parseInt(document.getElementById('selfTargetSpeed')?.value || '80', 10);
    const voice = document.getElementById('selfAiVoiceSelect')?.value || 'male';
    const pauseMode = document.getElementById('selfAiPauseMode')?.value || 'exam';
    const addIntro = document.getElementById('selfAiIntroCheck')?.checked || false;

    const btn = document.getElementById('selfAiGenerateBtn');
    const btnIcon = document.getElementById('selfAiBtnIcon');
    const btnText = document.getElementById('selfAiBtnText');

    if (btn) btn.disabled = true;
    if (btnIcon) btnIcon.textContent = '⏳';
    if (btnText) btnText.textContent = 'AI स्टेनो ऑडियो तैयार हो रहा है...';

    this.showToast('🎙️ AI स्टेनो ऑडियो तैयार हो रहा है (1-1 शब्द रुक-रुक कर और सटीक WPM टाइमिंग के साथ)...', 'info');

    try {
      const res = await fetch('/api/practice/generate-ai-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          text: text,
          speed_wpm: speed,
          voice: voice,
          pause_mode: pauseMode,
          add_intro: addIntro,
          title: 'self_practice'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI ऑडियो जनरेट करने में विफलता');
      }

      this.selfGeneratedAudioUrl = data.audio_url;
      this.selfGeneratedDuration = data.duration_seconds;
      this.selfGeneratedText = text;
      this.selfGeneratedSpeed = speed;

      const previewWrap = document.getElementById('selfAiPreviewWrap');
      const audioPlayer = document.getElementById('selfAiAudioPlayer');
      const metaEl = document.getElementById('selfAiAudioMeta');

      if (previewWrap && audioPlayer) {
        audioPlayer.src = data.audio_url;
        if (metaEl) {
          const m = Math.floor(data.duration_seconds / 60);
          const s = data.duration_seconds % 60;
          metaEl.textContent = `${data.word_count} शब्द • ${m}m ${s}s • ${speed} WPM (${voice === 'female' ? 'महिला' : 'पुरुष'})`;
        }
        previewWrap.style.display = 'block';
      }

      this.showToast(`✓ AI स्टेनो ऑडियो तैयार! (${speed} WPM - ai 03 स्टाइल)`, 'success');
      return data.audio_url;
    } catch (err) {
      console.error('generateSelfAiAudio error:', err);
      this.showToast(`ऑडियो जनरेशन त्रुटि: ${err.message}`, 'danger');
      return null;
    } finally {
      if (btn) btn.disabled = false;
      if (btnIcon) btnIcon.textContent = '⚡';
      if (btnText) btnText.textContent = 'AI स्टेनो ऑडियो पुनः तैयार करें';
    }
  }

  async startCustomPractice() {
    const masterText = (document.getElementById('selfMasterText')?.value || '').trim();
    if (!masterText || masterText.split(/\s+/).length < 5) {
      this.showToast('कृपया कम से कम 5-10 शब्दों का मूल डिक्टेशन आलेख (Master Passage) पेस्ट करें।', 'warning');
      const ta = document.getElementById('selfMasterText');
      if (ta) ta.focus();
      return;
    }

    const words = masterText.split(/\s+/).length;
    const targetSpeed = parseInt(document.getElementById('selfTargetSpeed')?.value || '80', 10);
    const targetExam = document.getElementById('selfTargetExam')?.value || 'ssc_steno';
    const fontMode = document.getElementById('selfFontMode')?.value || 'mangal_unicode';
    const durationMinutes = parseInt(document.getElementById('selfDuration')?.value || '10', 10);

    let audioUrl = null;
    let actualDuration = durationMinutes > 0 ? durationMinutes * 60 : Math.max(300, Math.round((words / targetSpeed) * 60));

    if (this.selfAudioMode === 'ai') {
      const needsRegen = !this.selfGeneratedAudioUrl || 
                         this.selfGeneratedText !== masterText || 
                         this.selfGeneratedSpeed !== targetSpeed;

      if (needsRegen) {
        const genUrl = await this.generateSelfAiAudio();
        if (!genUrl) {
          return;
        }
      }
      audioUrl = this.selfGeneratedAudioUrl;
      if (this.selfGeneratedDuration) {
        actualDuration = this.selfGeneratedDuration;
      }
    } else if (this.selfAudioMode === 'upload') {
      if (!this.selfAudioBlobUrl) {
        this.showToast('कृपया एक ऑडियो फ़ाइल चुनें अथवा "केवल टाइपिंग (साइलेंट)" मोड चुनें।', 'warning');
        return;
      }
      audioUrl = this.selfAudioBlobUrl;
    } else {
      // silent mode
      audioUrl = null;
    }

    const customPassage = {
      id: 999999,
      is_custom: true,
      title: 'कस्टम डिक्टेशन (Self Practice)',
      category_name: 'Self Practice',
      language: 'hindi',
      difficulty: 'medium',
      target_wpm: targetSpeed,
      speed_wpm: targetSpeed,
      duration_seconds: actualDuration,
      official_text: masterText,
      official_mangal_text: masterText,
      official_kruti_dev_text: masterText,
      audio_url: audioUrl,
      exam_rule: targetExam,
      typing_system: fontMode,
      is_free_tier: true,
      is_premium: false
    };

    this.currentExamRule = targetExam;
    this.openPractice(999999, fontMode, customPassage);
    this.showToast(`सेल्फ प्रैक्टिस शुरू! (${fontMode === 'kruti_dev_010' ? 'कृति देव 010' : 'मंगल यूनिकोड'} | ${targetSpeed} WPM)`, 'success');
  }


  // -------------------------------------------------------------------------
  // Horizontal Category Cards & Classes View (Screenshot 1 & 2 Style)
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Horizontal Category Cards & Classes View (Screenshot 1 & 2 Style)
  // -------------------------------------------------------------------------
  getCategoryIconDisplay(icon, slug, name) {
    const iconMap = {
      'feather': '🪶',
      'scale': '⚖️',
      'book-open': '📖',
      'book': '📚',
      'award': '🏆',
      'shield': '🛡️',
      'mic': '🎙️',
      'landmark': '🏛️',
      'file-text': '📄',
      'briefcase': '💼',
      'star': '⭐',
      'scroll': '📜'
    };
    if (icon && iconMap[String(icon).toLowerCase()]) return iconMap[String(icon).toLowerCase()];
    if (icon && !/^[a-zA-Z0-9_-]+$/.test(String(icon).trim())) return String(icon).trim();

    const str = `${slug || ''} ${name || ''}`.toLowerCase();
    if (str.includes('ramdhari') || str.includes('dinkar')) return '🪶';
    if (str.includes('vidhik') || str.includes('court') || str.includes('legal') || str.includes('nyay') || str.includes('scale')) return '⚖️';
    if (str.includes('samvidhan') || str.includes('constitution') || str.includes('sansad') || str.includes('landmark')) return '🏛️';
    if (str.includes('editorial') || str.includes('sampadkiya') || str.includes('patrika')) return '📰';
    if (str.includes('ssc') || str.includes('upsssc') || str.includes('award')) return '🏆';
    return '📘';
  }

  getCategoryTheme(cat, isUnlocked) {
    if (isUnlocked) {
      return {
        accentColor: '#10b981',
        borderColor: 'rgba(16, 185, 129, 0.45)',
        bgGradient: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.98) 35%, rgba(16, 185, 129, 0.04) 100%)',
        boxShadow: '0 6px 20px -2px rgba(16, 185, 129, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
        emblemBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.25))',
        emblemBorder: 'rgba(16, 185, 129, 0.35)'
      };
    }

    const str = `${cat.slug || ''} ${cat.name || ''}`.toLowerCase();
    if (str.includes('ramdhari') || str.includes('dinkar')) {
      return {
        accentColor: '#6366f1',
        borderColor: 'rgba(99, 102, 241, 0.4)',
        bgGradient: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 255, 255, 0.98) 35%, rgba(99, 102, 241, 0.04) 100%)',
        boxShadow: '0 6px 20px -2px rgba(99, 102, 241, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
        emblemBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(129, 140, 248, 0.25))',
        emblemBorder: 'rgba(99, 102, 241, 0.35)'
      };
    } else if (str.includes('court') || str.includes('vidhik') || str.includes('legal')) {
      return {
        accentColor: '#d97706',
        borderColor: 'rgba(217, 119, 6, 0.4)',
        bgGradient: 'linear-gradient(90deg, rgba(217, 119, 6, 0.08) 0%, rgba(255, 255, 255, 0.98) 35%, rgba(217, 119, 6, 0.04) 100%)',
        boxShadow: '0 6px 20px -2px rgba(217, 119, 6, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
        emblemBg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(245, 158, 11, 0.25))',
        emblemBorder: 'rgba(217, 119, 6, 0.35)'
      };
    } else if (str.includes('editorial') || str.includes('sampadkiya')) {
      return {
        accentColor: '#0284c7',
        borderColor: 'rgba(2, 132, 199, 0.4)',
        bgGradient: 'linear-gradient(90deg, rgba(2, 132, 199, 0.08) 0%, rgba(255, 255, 255, 0.98) 35%, rgba(2, 132, 199, 0.04) 100%)',
        boxShadow: '0 6px 20px -2px rgba(2, 132, 199, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
        emblemBg: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(56, 189, 248, 0.25))',
        emblemBorder: 'rgba(2, 132, 199, 0.35)'
      };
    }

    return {
      accentColor: '#8b5cf6',
      borderColor: 'rgba(139, 92, 246, 0.4)',
      bgGradient: 'linear-gradient(90deg, rgba(139, 92, 246, 0.08) 0%, rgba(255, 255, 255, 0.98) 35%, rgba(139, 92, 246, 0.04) 100%)',
      boxShadow: '0 6px 20px -2px rgba(139, 92, 246, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
      emblemBg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(167, 139, 250, 0.25))',
      emblemBorder: 'rgba(139, 92, 246, 0.35)'
    };
  }

  renderHorizontalCategories() {
    try {
      const homeContainer = document.getElementById('homeCategoriesList');
      const classesContainer = document.getElementById('classesCategoriesList');
      if (!homeContainer && !classesContainer) return;

      const cats = this.categories || [];
      if (!cats.length) {
        const skeleton = `
          <div class="stat-card" style="padding:18px; border-radius:16px; opacity:0.6; display:flex; align-items:center; gap:16px; margin-bottom:12px;">
            <div style="width:58px; height:58px; border-radius:16px; background:var(--border);"></div>
            <div style="flex:1;">
              <div style="height:20px; width:45%; background:var(--border); border-radius:4px; margin-bottom:8px;"></div>
              <div style="height:15px; width:65%; background:var(--border); border-radius:4px;"></div>
            </div>
          </div>
        `;
        if (homeContainer) homeContainer.innerHTML = skeleton;
        if (classesContainer) classesContainer.innerHTML = skeleton;
        return;
      }

      // Filter out empty audit categories
      const activeCats = cats.filter(c => {
        const slug = String(c.slug || '').toLowerCase();
        const name = String(c.name || '').toLowerCase();
        if (slug.startsWith('audit-cat-') && (!c.passage_count || c.passage_count === 0)) return false;
        const pCount = parseInt(c.passage_count || 0, 10);
        return pCount > 0 || slug.includes('ramdhari') || slug.includes('editorial') || slug.includes('steno') || slug.includes('court') || slug.includes('upsssc') || slug.includes('constitution') || name.includes('रामधारी');
      });
      const displayCats = activeCats.length > 0 ? activeCats : cats;

      const html = displayCats.map(cat => {
        const isUnlocked = Boolean(cat.is_unlocked);
        const price = cat.price || 49;
        const iconDisplay = this.getCategoryIconDisplay(cat.icon, cat.slug, cat.name);
        const passageCount = parseInt(cat.passage_count || 0, 10);
        const freeCount = parseInt(cat.free_count !== undefined && cat.free_count !== null ? cat.free_count : (passageCount > 0 ? 1 : 0), 10);
        const theme = this.getCategoryTheme(cat, isUnlocked);

        return `
          <div class="category-series-card" onclick="stenoApp.openCategoryDetail(${cat.id})" style="background:${theme.bgGradient}; border:1.5px solid ${theme.borderColor}; border-radius:18px; padding:18px 22px; display:flex; align-items:center; justify-content:space-between; gap:18px; cursor:pointer; transition:all 0.25s cubic-bezier(0.16, 1, 0.3, 1); margin-bottom:14px; box-shadow:${theme.boxShadow}; position:relative; overflow:hidden;">
            <!-- Left Accent Strip -->
            <div style="position:absolute; top:0; left:0; width:5px; height:100%; background:${theme.accentColor};"></div>

            <!-- LEFT SECTION: Emblem Avatar + Title & Badges -->
            <div style="display:flex; align-items:center; gap:16px; min-width:280px; flex:1.2;">
              <div style="width:60px; height:60px; min-width:60px; border-radius:16px; background:${theme.emblemBg}; border:1.5px solid ${theme.emblemBorder}; display:flex; align-items:center; justify-content:center; font-size:2rem; flex-shrink:0; box-shadow:0 3px 10px rgba(0,0,0,0.05);">
                ${iconDisplay}
              </div>
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                  <h4 style="margin:0; font-size:1.18rem; font-weight:800; color:var(--text-main); line-height:1.35;">${this.escapeHtml(cat.name)}</h4>
                  ${isUnlocked 
                    ? '<span class="badge" style="background:#10b981; color:#fff; font-size:0.75rem; font-weight:800; padding:4px 10px; border-radius:6px;">✓ अनलॉक्ड</span>' 
                    : `<span class="badge badge-paid" onclick="event.stopPropagation(); stenoApp.openMultiCategoryCheckout(${cat.id})" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; font-weight:800; font-size:0.78rem; padding:4px 11px; border-radius:8px; box-shadow:0 2px 8px rgba(245,158,11,0.3); cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="क्लिक करके ₹${price} में खरीदें">🔒 पेड श्रेणी • ₹${price} <span style="font-size:0.72rem; text-decoration:underline; opacity:0.95;">(अनलॉक ➔)</span></span>`
                  }
                </div>
                <div style="font-size:0.86rem; color:var(--text-muted); display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:3px;">
                  <span style="font-weight:700; color:var(--text-main);">📊 <strong>${passageCount}</strong> कुल टेस्ट</span>
                  <span style="color:var(--border);">•</span>
                  <span style="color:#059669; font-weight:800;">🎁 <strong>${freeCount}</strong> फ्री डेमो टेस्ट</span>
                </div>
              </div>
            </div>

            <!-- MIDDLE SECTION: Rich Specifications & Feature Highlights (Filling the empty space!) -->
            <div class="cat-middle-specs" style="flex:1.4; display:flex; flex-direction:column; gap:6px; min-width:240px; padding:0 14px; border-left:1px dashed var(--border); border-right:1px dashed var(--border);">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <span style="background:rgba(2,132,199,0.1); color:#0284c7; border:1px solid rgba(2,132,199,0.25); font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
                  ⚡ 80 - 100 WPM
                </span>
                <span style="background:rgba(99,102,241,0.1); color:#4f46e5; border:1px solid rgba(99,102,241,0.25); font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
                  ⏱️ 5-10 मिनट डिक्टेशन
                </span>
                <span style="background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.25); font-weight:800; font-size:0.8rem; padding:4px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
                  🎙️ ऑडियो + आउटलाइन
                </span>
              </div>
              <div style="font-size:0.82rem; color:var(--text-muted); font-weight:600; display:flex; align-items:center; gap:6px; flex-wrap:wrap; line-height:1.4;">
                <span>⌨️ मंगल (रेमिंगटन गेल/CBI) एवं कृति देव 010</span>
                <span>•</span>
                <span>तुरंत AI मूल्यांकन</span>
              </div>
            </div>

            <!-- RIGHT SECTION: Action / Unlock Button -->
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-shrink:0;">
              ${isUnlocked 
                ? `<button type="button" class="btn-primary" style="padding:10px 22px; font-size:0.92rem; font-weight:800; border-radius:12px; background:linear-gradient(135deg, #0284c7, #2563eb); border:none; box-shadow:0 4px 14px rgba(2,132,199,0.35); display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="event.stopPropagation(); stenoApp.openCategoryDetail(${cat.id})">
                    <span>🎯 अभ्यास करें</span> <span style="font-size:1.1rem; line-height:1;">➔</span>
                  </button>`
                : `<button type="button" class="btn-primary" style="padding:10px 22px; font-size:0.92rem; font-weight:800; border-radius:12px; background:linear-gradient(135deg, #10b981, #059669); border:none; box-shadow:0 4px 14px rgba(16,185,129,0.35); display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="event.stopPropagation(); stenoApp.openMultiCategoryCheckout(${cat.id})">
                    <span>🔒 ₹${price} में खरीदें</span> <span style="font-size:1.1rem; line-height:1;">➔</span>
                  </button>`
              }
            </div>
          </div>
        `;
      }).join('');

      if (homeContainer) homeContainer.innerHTML = html;
      if (classesContainer) classesContainer.innerHTML = html;
    } catch (err) {
      console.error('Error in renderHorizontalCategories:', err);
    }
  }

  async openCategoryDetail(categoryId) {
    this.closeSidebar();
    if (this.activeView && this.activeView !== 'category-detail') {
      this.categoryOrigin = this.activeView;
    }
    this.currentCategoryId = categoryId;
    this.navigate('category-detail', { id: categoryId });

    const titleEl = document.getElementById('catDetailTitle');
    const nameEl = document.getElementById('catDetailName');
    const iconEl = document.getElementById('catDetailIcon');
    const subEl = document.getElementById('catDetailSub');
    const badgeEl = document.getElementById('catDetailAccessBadge');
    const listEl = document.getElementById('catDetailPassagesList');
    const stickyBar = document.getElementById('catDetailStickyBar');
    const stickyPrice = document.getElementById('catStickyPrice');

    if (listEl) {
      listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>डिक्टेशन्स लोड हो रही हैं...</div>';
    }

    try {
      const res = await this.apiCall(`/api/categories/detail?id=${categoryId}`);
      const cat = res.category || {};
      this.currentCategoryData = cat;
      this.currentCategoryPassages = res.passages || [];

      if (nameEl) nameEl.textContent = cat.name || 'डिक्टेशन टेस्ट सीरीज';
      if (iconEl) iconEl.textContent = cat.icon_emoji || '📘';
      if (subEl) subEl.textContent = `कुल ${this.currentCategoryPassages.length} डिक्टेशन्स • 80-100 WPM • ऑडियो सहित`;

      const isUnlocked = Boolean(cat.is_unlocked);
      if (badgeEl) {
        badgeEl.innerHTML = isUnlocked
          ? '<span class="badge badge-success" style="font-size:0.78rem; padding:5px 12px; font-weight:800;">🟢 पूर्ण अनलॉक्ड</span>'
          : `<button type="button" class="btn-primary" onclick="stenoApp.openMultiCategoryCheckout(${cat.id})" style="font-size:0.82rem; padding:7px 16px; font-weight:800; background:linear-gradient(135deg, #10b981, #059669); border:none; border-radius:10px; box-shadow:0 3px 10px rgba(16,185,129,0.3); cursor:pointer;">🔒 पेड श्रेणी • ₹${cat.price || 49} में अभी अनलॉक करें ➔</button>`;
      }

      if (stickyBar) {
        if (!isUnlocked) {
          stickyBar.style.display = 'block';
          if (stickyPrice) stickyPrice.textContent = `₹${cat.price || 49} (एकमुश्त / Full Access)`;
        } else {
          stickyBar.style.display = 'none';
        }
      }

      this.renderCategoryPassagesList(this.currentCategoryPassages);
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:30px 20px; background:rgba(239,68,68,0.04); border-radius:12px; border:1px dashed rgba(239,68,68,0.25); margin-top:10px;">
            <div style="font-size:1.8rem; margin-bottom:8px;">⚠️</div>
            <div style="color:var(--accent-red); font-weight:700; font-size:0.95rem; margin-bottom:6px;">त्रुटि: ${this.escapeHtml(err.message)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:14px;">सर्वर या इंटरनेट में क्षणिक देरी हुई। कृपया दोबारा प्रयास करें।</div>
            <button type="button" class="btn-primary" onclick="stenoApp.openCategoryDetail(${categoryId})" style="padding:7px 20px; font-size:0.85rem; font-weight:800; border-radius:10px; cursor:pointer;">🔄 पुनः लोड करें (Retry)</button>
          </div>
        `;
      }
    }
  }

  backFromCategoryDetail() {
    const stickyBar = document.getElementById('catDetailStickyBar');
    if (stickyBar) stickyBar.style.display = 'none';
    this.goBack();
  }

  filterCategoryPassages(type, btnEl) {
    document.querySelectorAll('.cat-filter-btn').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-secondary');
    });
    if (btnEl) {
      btnEl.classList.remove('btn-secondary');
      btnEl.classList.add('btn-primary');
    }

    if (!this.currentCategoryPassages) return;
    let filtered = [...this.currentCategoryPassages];
    if (type === 'free') {
      filtered = filtered.filter(p => p.is_free_tier);
    } else if (type === '80') {
      filtered = filtered.filter(p => (p.target_wpm || 80) <= 85);
    } else if (type === '100') {
      filtered = filtered.filter(p => (p.target_wpm || 80) >= 95);
    }
    this.renderCategoryPassagesList(filtered);
  }

  renderCategoryPassagesList(passages) {
    const container = document.getElementById('catDetailPassagesList');
    if (!container) return;

    if (!passages || passages.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">इस फ़िल्टर में कोई क्लास उपलब्ध नहीं है।</div>';
      return;
    }

    const catPrice = (this.currentCategoryData && this.currentCategoryData.price) || 49;
    container.innerHTML = passages.map(p => {
      const isAcc = Boolean(p.is_free_tier || (this.currentCategoryData && this.currentCategoryData.is_unlocked));
      const durationMins = p.duration_seconds ? Math.round(p.duration_seconds / 60) : 10;

      return `
        <div class="category-passage-card" style="background:var(--bg-card); border:1.5px solid var(--border); border-radius:14px; padding:16px 18px; display:flex; justify-content:space-between; align-items:center; gap:14px; transition:border-color 0.15s, box-shadow 0.15s; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
              <h4 style="margin:0; font-size:0.98rem; font-weight:700; color:var(--text-main);">${this.escapeHtml(p.title)}</h4>
              ${p.is_free_tier ? '<span class="badge badge-success" style="font-size:0.65rem; padding:2px 6px;">🎁 FREE DEMO</span>' : ''}
            </div>
            <div style="display:flex; gap:8px; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap; margin-bottom:4px;">
              <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:4px; font-weight:600; color:var(--primary);">⚡ ${p.target_wpm || 80} WPM</span>
              <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:4px;">📝 ${p.word_count || 400} शब्द</span>
              <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:4px;">⏱️ ${durationMins} मिनट</span>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              🔤 मंगल एवं कृति देव 010 • आधिकारिक ऑडियो सहित
            </div>
          </div>
          <div style="flex-shrink:0;">
            ${isAcc 
              ? `<button type="button" class="btn-primary" style="padding:8px 18px; font-size:0.84rem; font-weight:700; border-radius:20px; white-space:nowrap; box-shadow:0 3px 10px rgba(2,132,199,0.3);" onclick="stenoApp.openPractice(${p.id})">🎯 Start Test →</button>`
              : `<button type="button" class="btn-secondary" style="padding:8px 14px; font-size:0.8rem; font-weight:700; border-radius:20px; color:#10b981; border-color:#10b981; white-space:nowrap;" onclick="stenoApp.openMultiCategoryCheckout(${p.category_id})">🔒 अनलॉक करें (₹${catPrice})</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  enrollCurrentCategory() {
    if (this.currentCategoryId) {
      this.openMultiCategoryCheckout(this.currentCategoryId);
    } else {
      this.openMultiCategoryCheckout();
    }
  }

  // -------------------------------------------------------------------------
  // Multi-Category Custom Checkout Operations
  // -------------------------------------------------------------------------
  openMultiCategoryCheckout(preSelectedCatId = null) {
    const modal = document.getElementById('categoryCheckoutModal');
    const container = document.getElementById('checkoutCategoriesChecklist');
    const allInOneCheck = document.getElementById('checkAllInOnePass');
    if (allInOneCheck) allInOneCheck.checked = false;

    if (!modal || !container) return;

    const cats = this.categories || [];
    container.innerHTML = cats.map(cat => {
      const isPre = preSelectedCatId && (cat.id === preSelectedCatId || cat.id === Number(preSelectedCatId));
      const price = cat.price || 49;
      const isAlreadyUnlocked = Boolean(cat.is_unlocked);

      return `
        <label class="checkout-cat-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--border); border-radius:10px; background:var(--bg-card); cursor:${isAlreadyUnlocked ? 'default' : 'pointer'}; transition:background 0.15s;">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" class="cat-checkout-checkbox" value="${cat.id}" data-price="${price}" ${isPre ? 'checked' : ''} ${isAlreadyUnlocked ? 'disabled checked' : ''} onchange="stenoApp.updateCheckoutTotal()" style="width:18px; height:18px; accent-color:#0284c7; cursor:pointer;">
            <div>
              <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">${this.escapeHtml(cat.name)}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${cat.passage_count || 0} डिक्टेशन्स • 80-100 WPM</div>
            </div>
          </div>
          <div style="text-align:right;">
            ${isAlreadyUnlocked 
              ? '<span class="badge badge-success" style="font-size:0.65rem;">पहले से अनलॉक ✓</span>'
              : `<span style="font-weight:800; color:#0284c7; font-size:0.95rem;">₹${price}</span>`
            }
          </div>
        </label>
      `;
    }).join('');

    modal.style.display = 'flex';
    this.updateCheckoutTotal();
  }

  closeCategoryCheckoutModal() {
    const modal = document.getElementById('categoryCheckoutModal');
    if (modal) modal.style.display = 'none';
  }

  selectAllCategories() {
    const allInOneCheck = document.getElementById('checkAllInOnePass');
    if (allInOneCheck) allInOneCheck.checked = false;
    document.querySelectorAll('.cat-checkout-checkbox:not(:disabled)').forEach(cb => {
      cb.checked = true;
    });
    this.updateCheckoutTotal();
  }

  toggleAllInOnePass() {
    const allInOneCheck = document.getElementById('checkAllInOnePass');
    const isChecked = allInOneCheck ? allInOneCheck.checked : false;

    if (isChecked) {
      document.querySelectorAll('.cat-checkout-checkbox:not(:disabled)').forEach(cb => {
        cb.checked = false;
      });
    }
    this.updateCheckoutTotal();
  }

  updateCheckoutTotal() {
    const allInOneCheck = document.getElementById('checkAllInOnePass');
    const isAllInOne = allInOneCheck ? allInOneCheck.checked : false;

    const countEl = document.getElementById('checkoutSelectedCount');
    const totalEl = document.getElementById('checkoutTotalPrice');
    const payBtn = document.getElementById('checkoutProceedPayBtn');

    if (isAllInOne) {
      if (countEl) countEl.textContent = 'सभी कैटेगरीज (All-In-One)';
      if (totalEl) totalEl.textContent = '₹100';
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
      }
      return;
    }

    let total = 0;
    let selectedCount = 0;
    document.querySelectorAll('.cat-checkout-checkbox:not(:disabled)').forEach(cb => {
      if (cb.checked) {
        total += Number(cb.getAttribute('data-price') || 49);
        selectedCount++;
      }
    });

    if (countEl) countEl.textContent = `${selectedCount}`;
    if (totalEl) totalEl.textContent = `₹${total}`;

    if (payBtn) {
      payBtn.disabled = total <= 0;
      payBtn.style.opacity = total <= 0 ? '0.5' : '1';
    }
  }

  async proceedCategoryPayment() {
    const allInOneCheck = document.getElementById('checkAllInOnePass');
    const isAllInOne = allInOneCheck ? allInOneCheck.checked : false;

    const selectedIds = [];
    document.querySelectorAll('.cat-checkout-checkbox:not(:disabled)').forEach(cb => {
      if (cb.checked) {
        selectedIds.push(parseInt(cb.value, 10));
      }
    });

    if (!isAllInOne && selectedIds.length === 0) {
      this.showToast('कृपया कम से कम एक कैटेगरी चुनें।', 'warning');
      return;
    }

    const payBtn = document.getElementById('checkoutProceedPayBtn');
    const origHtml = payBtn ? payBtn.innerHTML : '';
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = '<span>⏳</span> <span>ऑर्डर तैयार हो रहा है...</span>';
    }

    try {
      const res = await this.apiCall('/api/subscription/create-custom-category-order', 'POST', {
        category_ids: selectedIds,
        all_in_one: isAllInOne
      });

      if (!res || !res.success) {
        throw new Error(res?.error || 'ऑर्डर तैयार करने में विफल');
      }

      this.closeCategoryCheckoutModal();

      if (res.cashfree_configured && res.cashfree_session_id && window.Cashfree) {
        this.showToast('Cashfree पेमेंट गेटवे खुल रहा है...', 'info');
        const cashfree = Cashfree({ mode: res.cashfree_env === 'PRODUCTION' ? 'production' : 'sandbox' });
        cashfree.checkout({
          paymentSessionId: res.cashfree_session_id,
          redirectTarget: '_modal'
        }).then((result) => {
          if (result.error) {
            this.showToast(`भुगतान त्रुटि: ${result.error.message}`, 'danger');
          }
          if (result.paymentDetails) {
            this.showToast('✓ भुगतान सफल! कैटेगरीज अनलॉक हो रही हैं...', 'success');
            setTimeout(() => {
              this.loadCategories();
              this.loadPassages(true);
            }, 1500);
          }
        });
        return;
      }

      this.openCategoryUpiModal(res);
    } catch (err) {
      this.showToast(`त्रुटि: ${err.message}`, 'danger');
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = origHtml;
      }
    }
  }

  openCategoryUpiModal(orderData) {
    const amt = orderData.amount;
    const upiId = orderData.upi_id || 'stenomaster@upi';
    const promptMsg = `कुल देय राशि: ₹${amt}\nUPI ID: ${upiId}\n\nपेमेंट पूर्ण करने के बाद कृपया UPI UTR / Ref Number दर्ज करें:`;
    const utr = prompt(promptMsg, '');
    if (!utr) return;

    this.submitCategoryUpiPayment(orderData.order_id, orderData.category_ids, orderData.all_in_one, utr, amt);
  }

  async submitCategoryUpiPayment(orderId, catIds, allInOne, utr, amount) {
    try {
      const res = await this.apiCall('/api/subscription/submit-category-upi', 'POST', {
        order_id: orderId,
        category_ids: catIds,
        all_in_one: allInOne,
        utr_number: utr,
        amount: amount
      });
      if (res && res.success) {
        this.showToast(res.message || '✓ पेमेंट अनुरोध भेजा गया! पुष्टि होते ही कक्षाएं अनलॉक हो जाएंगी।', 'success');
      } else {
        throw new Error(res?.error || 'अनुरोध भेजने में विफल');
      }
    } catch (err) {
      this.showToast(`त्रुटि: ${err.message}`, 'danger');
    }
  }


    openSaveCustomClassModal() {
    const masterText = (document.getElementById('selfMasterText')?.value || '').trim();
    if (!masterText || masterText.split(/\s+/).length < 5) {
      this.showToast('कृपया पहले मूल आलेख (Master Passage) में कम से कम 5-10 शब्द लिखें या फोटो स्कैन करें।', 'warning');
      const ta = document.getElementById('selfMasterText');
      if (ta) ta.focus();
      return;
    }

    const modal = document.getElementById('saveCustomClassModal');
    const input = document.getElementById('modalSaveClassTitle');
    const existingTitle = (document.getElementById('selfClassTitle')?.value || '').trim();
    const targetSpeed = parseInt(document.getElementById('selfTargetSpeed')?.value || '80', 10);
    const fontMode = document.getElementById('selfFontMode')?.value || 'mangal_unicode';
    const words = masterText.split(/\s+/).length;

    let defaultTitle = existingTitle;
    if (!defaultTitle) {
      const cleanWords = masterText.replace(/[^\u0900-\u097F\w\s]/g, ' ').trim().split(/\s+/).slice(0, 5).join(' ');
      if (cleanWords && cleanWords.length >= 3) {
        defaultTitle = `${cleanWords} (${targetSpeed} WPM)`;
      } else {
        defaultTitle = `कस्टम डिक्टेशन (${targetSpeed} WPM)`;
      }
    }

    if (input) {
      input.value = defaultTitle;
    }

    const chipWpm = document.getElementById('modalSaveChipWpm');
    if (chipWpm) chipWpm.textContent = `⚡ ${targetSpeed} WPM`;
    const chipWords = document.getElementById('modalSaveChipWords');
    if (chipWords) chipWords.textContent = `📝 ${words} शब्द`;
    const chipFont = document.getElementById('modalSaveChipFont');
    if (chipFont) chipFont.textContent = `🔤 ${fontMode === 'kruti_dev_010' ? 'कृति देव' : 'मंगल'}`;

    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    }
  }

  closeSaveCustomClassModal() {
    const modal = document.getElementById('saveCustomClassModal');
    if (modal) modal.style.display = 'none';
  }

  async confirmSaveCustomClass() {
    const input = document.getElementById('modalSaveClassTitle');
    const title = (input?.value || '').trim();
    if (!title) {
      this.showToast('कृपया क्लास का नाम (शीर्षक) अवश्य दर्ज करें।', 'warning');
      if (input) input.focus();
      return;
    }

    const mainTitleInput = document.getElementById('selfClassTitle');
    if (mainTitleInput) mainTitleInput.value = title;

    const modalConfirmBtn = document.getElementById('modalConfirmSaveBtn');
    const originalText = modalConfirmBtn ? modalConfirmBtn.innerHTML : '';
    if (modalConfirmBtn) {
      modalConfirmBtn.disabled = true;
      modalConfirmBtn.innerHTML = '<span>⏳</span> <span>सेव हो रहा है...</span>';
    }

    try {
      const saved = await this.saveCurrentCustomClass(title);
      if (saved) {
        this.closeSaveCustomClassModal();
      }
    } finally {
      if (modalConfirmBtn) {
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.innerHTML = originalText;
      }
    }
  }

  async saveCurrentCustomClass(forcedTitle = null) {
    const masterText = (document.getElementById('selfMasterText')?.value || '').trim();
    if (!masterText || masterText.split(/\s+/).length < 5) {
      this.showToast('कृपया पहले मूल आलेख (Master Passage) में कम से कम 5-10 शब्द लिखें या फोटो स्कैन करें।', 'warning');
      const ta = document.getElementById('selfMasterText');
      if (ta) ta.focus();
      return false;
    }

    const titleInput = (forcedTitle || document.getElementById('selfClassTitle')?.value || '').trim();
    const targetSpeed = parseInt(document.getElementById('selfTargetSpeed')?.value || '80', 10);
    const targetExam = document.getElementById('selfTargetExam')?.value || 'ssc_steno';
    const fontMode = document.getElementById('selfFontMode')?.value || 'mangal_unicode';
    const durationMinutes = parseInt(document.getElementById('selfDuration')?.value || '10', 10);
    const words = masterText.split(/\s+/).length;
    let actualDuration = durationMinutes > 0 ? durationMinutes * 60 : Math.max(300, Math.round((words / targetSpeed) * 60));

    const finalTitle = titleInput || ('कस्टम डिक्टेशन ' + targetSpeed + ' WPM');

    const saveBtn = document.getElementById('selfSaveClassBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>⏳</span> <span>सेव हो रहा है...</span>';
    }

    try {
      let audioUrl = null;
      if (this.selfAudioMode === 'ai') {
        const needsRegen = !this.selfGeneratedAudioUrl || 
                           this.selfGeneratedText !== masterText || 
                           this.selfGeneratedSpeed !== targetSpeed;
        if (needsRegen) {
          this.showToast('AI स्टेनो ऑडियो तैयार किया जा रहा है...', 'info');
          const genUrl = await this.generateSelfAiAudio();
          if (!genUrl) {
            this.showToast('ऑडियो जनरेट नहीं हो सका। कृपया पुनः प्रयास करें।', 'warning');
            return false;
          }
        }
        audioUrl = this.selfGeneratedAudioUrl;
        if (this.selfGeneratedDuration) actualDuration = this.selfGeneratedDuration;
      }

      const payload = {
        title: finalTitle,
        official_text: masterText,
        target_wpm: targetSpeed,
        duration_seconds: actualDuration,
        audio_url: audioUrl || '',
        typing_system: fontMode,
        exam_rule: targetExam
      };

      const res = await this.apiCall('/api/practice/save-custom-class', 'POST', payload);
      if (res && res.success) {
        this.showToast(res.message || `✓ क्लास "${finalTitle}" सुरक्षित हो गई!`, 'success');
        await this.loadMyCustomClasses(true);
        return true;
      } else {
        throw new Error(res?.error || 'क्लास सेव करने में त्रुटि');
      }
    } catch (err) {
      console.error('saveCurrentCustomClass error:', err);
      this.showToast(`त्रुटि: ${err.message}`, 'danger');
      return false;
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾</span> <span>My Classes में सेव करें</span>';
      }
    }
  }


  async loadMyCustomClasses(force = false) {
    const container = document.getElementById('myCustomClassesList');
    const loadingEl = document.getElementById('myCustomClassesLoading');
    const emptyEl = document.getElementById('myCustomClassesEmpty');
    if (!container) return;

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      const res = await this.apiCall('/api/practice/my-custom-classes');
      this.myCustomClasses = res.custom_classes || [];

      if (loadingEl) loadingEl.style.display = 'none';

      if (!this.myCustomClasses.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        container.innerHTML = '';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      container.innerHTML = this.myCustomClasses.map(item => {
        const isPub = item.status === 'published';
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('hi-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
        return `
          <div class="stat-card" style="padding:16px; border:1px solid var(--border); border-radius:12px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s, box-shadow 0.15s; background:var(--bg-card);">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
                <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main); line-height:1.35;">${this.escapeHtml(item.title)}</h4>
                <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem; padding:2px 8px; border-radius:12px; white-space:nowrap;">
                  ${isPub ? '🟢 सभी के लिए लाइव' : '🟡 सुरक्षित (Saved)'}
                </span>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">
                <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:6px; font-weight:600; color:var(--primary);">⚡ ${item.target_wpm || 80} WPM</span>
                <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:6px;">📝 ${item.word_count || 0} शब्द</span>
                <span style="background:var(--bg-subtle); padding:2px 8px; border-radius:6px;">🔤 ${item.typing_system === 'kruti_dev_010' ? 'कृति देव' : 'मंगल'}</span>
                ${dateStr ? `<span style="background:var(--bg-subtle); padding:2px 8px; border-radius:6px;">📅 ${dateStr}</span>` : ''}
              </div>
              ${item.audio_url ? `
                <div style="margin-bottom:12px;">
                  <audio controls src="${item.audio_url}" style="width:100%; height:32px;" preload="none"></audio>
                </div>
              ` : ''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; pt:8px; border-top:1px solid var(--border-subtle, #e2e8f0);">
              <button type="button" class="btn-sm btn-primary" style="padding:6px 14px; font-size:0.8rem; font-weight:700; border-radius:20px; display:inline-flex; align-items:center; gap:4px;" onclick="stenoApp.playCustomClassById(${item.id})">
                <span>🎯</span> <span>अभ्यास करें →</span>
              </button>
              <button type="button" class="btn-sm btn-secondary" style="padding:6px 10px; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.2);" onclick="stenoApp.deleteCustomClass(${item.id})" title="क्लास हटाएं">
                <span>🗑️</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      console.error('loadMyCustomClasses error:', err);
    }
  }

  playCustomClassById(passageId) {
    if (!this.myCustomClasses) return;
    const p = this.myCustomClasses.find(x => x.id === passageId);
    if (!p) {
      this.showToast('क्लास विवरण नहीं मिला।', 'warning');
      return;
    }

    const passageObj = {
      id: p.id,
      is_custom: true,
      title: p.title,
      category_name: 'My Saved Classes',
      language: p.language || 'hindi',
      difficulty: p.difficulty || 'medium',
      target_wpm: p.target_wpm || 80,
      speed_wpm: p.target_wpm || 80,
      duration_seconds: p.duration_seconds || 300,
      official_text: p.official_text,
      official_mangal_text: p.official_text,
      official_kruti_dev_text: p.official_text_krutidev || p.official_text,
      audio_url: p.audio_url || null,
      typing_system: p.typing_system || 'mangal_unicode',
      is_free_tier: true,
      is_premium: false
    };

    const fontMode = p.typing_system || 'mangal_unicode';
    this.openPractice(p.id, fontMode, passageObj);
    this.showToast(`कस्टम क्लास शुरू: ${p.title} (${p.target_wpm} WPM)`, 'success');
  }

  async deleteCustomClass(passageId) {
    if (!confirm('क्या आप वाकई इस कस्टम क्लास को हटाना चाहते हैं?')) return;
    try {
      const res = await this.apiCall('/api/practice/delete-custom-class', 'POST', { passage_id: passageId });
      if (res && res.success) {
        this.showToast('क्लास सफलतापूर्वक हटा दी गई।', 'info');
        await this.loadMyCustomClasses(true);
      }
    } catch (err) {
      this.showToast(`हटाने में त्रुटि: ${err.message}`, 'danger');
    }
  }

}



window.stenoApp = new StenoApp();
window.app = window.stenoApp;
