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
    this.subscriptionPlans = [];
    this.selectedPlan = null;
    this.allPassages = [];
    this.selectedTypingSystem = localStorage.getItem('stenomaster_preferred_font') || localStorage.getItem('stenomaster_typing_mode') || 'mangal_unicode';
    if (this.selectedTypingSystem === 'krutidev') this.selectedTypingSystem = 'kruti_dev_010';

    // Restore cached passages immediately for instant 0ms startup
    try {
      const cached = localStorage.getItem('stenomaster_cached_passages');
      if (cached) {
        this.allPassages = JSON.parse(cached);
        this.passages = [...this.allPassages];
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

  async init() {
    this.initTheme();
    this.initPWA();
    this.initNavigation();
    this.initSessionHeartbeat();

    // Cross-tab real-time sync when Admin edits or deletes passages
    window.addEventListener('storage', (e) => {
      if (e.key === 'stenomaster_passages_version' || e.key === 'stenomaster_cached_passages') {
        this.loadPassages(true);
      }
    });

    // Check existing auth session
    if (this.token) {
      try {
        await this.fetchCurrentUser();
        if (this.user) {
          this.hideAuthGateway();
          await this.loadCategories();
          await this.loadPassages();
          if (this.user.role === 'admin') {
            this.navigate('admin');
          } else {
            this.navigate('home');
          }
          return;
        }
      } catch (err) {
        console.warn('Session verification failed, showing auth gateway:', err);
      }
    }

    // If no active or valid session, show the Auth Gateway directly
    this.showAuthGateway('student');
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('ServiceWorker registered');
          // Actively check for latest updates on every visit
          reg.update().catch(() => {});
        })
        .catch(err => console.warn('ServiceWorker error:', err));
    }
  }

  // -------------------------------------------------------------------------
  // API Helper
  // -------------------------------------------------------------------------
  async apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const opts = { method, headers };
    if (body) {
      opts.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, opts);
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

    this.switchAuthTab(tab);
    this.loadSavedCredentials();

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
    // 1. Student Saved Credentials
    try {
      const stuRaw = localStorage.getItem('stenomaster_saved_student_creds');
      if (stuRaw) {
        const stuCreds = JSON.parse(stuRaw);
        const emailInp = document.getElementById('stuAuthEmail');
        const passInp = document.getElementById('stuAuthPassword');
        const card = document.getElementById('stuQuickLoginCard');
        const nameEl = document.getElementById('stuQuickLoginName');
        const clearBtn = document.getElementById('stuClearSavedCredsBtn');

        if (emailInp && stuCreds.email_or_username) emailInp.value = stuCreds.email_or_username;
        if (passInp && stuCreds.password) passInp.value = stuCreds.password;
        if (card) card.style.display = 'block';
        if (nameEl) nameEl.textContent = stuCreds.name || stuCreds.email_or_username;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      }
    } catch (e) {
      console.warn('Failed to load saved student credentials', e);
    }

    // 2. Admin Saved Credentials
    try {
      const adminRaw = localStorage.getItem('stenomaster_saved_admin_creds');
      if (adminRaw) {
        const adminCreds = JSON.parse(adminRaw);
        const emailInp = document.getElementById('adminAuthEmail');
        const passInp = document.getElementById('adminAuthPassword');
        const card = document.getElementById('adminQuickLoginCard');
        const nameEl = document.getElementById('adminQuickLoginName');
        const clearBtn = document.getElementById('adminClearSavedCredsBtn');

        if (emailInp && adminCreds.email_or_username) emailInp.value = adminCreds.email_or_username;
        if (passInp && adminCreds.password) passInp.value = adminCreds.password;
        if (card) card.style.display = 'block';
        if (nameEl) nameEl.textContent = adminCreds.name || adminCreds.email_or_username || 'Administrator';
        if (clearBtn) clearBtn.style.display = 'inline-block';
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
    this.handleStudentLogin();
  }

  oneClickAdminLogin() {
    this.handleAdminLogin();
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
    const referralCode = document.getElementById('stuRegReferralCode')?.value.trim();
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

      if (this.user.role === 'admin') {
        this.navigate('admin');
      } else {
        this.navigate('home');
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
      await this.loadCategories();
      await this.loadPassages();

      this.showToast('प्रशासनिक कंसोल में आपका स्वागत है! 🛡️', 'success');
      this.navigate('admin');
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
    this.openModal('forgotPasswordModal');
  }

  async handleForgotPassword(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('forgotEmailInput');
    const email = emailInput?.value?.trim() || '';
    if (!email) return;

    try {
      const res = await this.apiCall('/api/auth/forgot-password', 'POST', { email });
      this.closeModal('forgotPasswordModal');
      this.showToast(res.message || `पासवर्ड रीसेट निर्देश ${email} पर भेज दिए गए हैं।`, 'success');
    } catch (err) {
      this.showToast(err.message || 'ईमेल सत्यापन विफल रहा।', 'error');
    }
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
      this.updateUserUI();
    } catch (err) {
      console.warn('Session expired, logging out');
      this.logout(false);
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
    this.token = null;
    this.user = null;
    localStorage.removeItem('stenomaster_token');
    this.updateUserUI();
    this.showAuthGateway('student');
    if (showToast) this.showToast('लॉगआउट सफल। (Logged out successfully)', 'info');
  }

  handleConcurrentLoginEviction(data = {}) {
    // 1. Wipe local credentials
    this.token = null;
    this.user = null;
    localStorage.removeItem('stenomaster_token');

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
        if (this.user.role === 'admin') {
          roleEl.textContent = 'Admin';
          roleEl.className = 'header-user-role role-admin';
        } else {
          roleEl.textContent = 'Student';
          roleEl.className = 'header-user-role role-student';
        }
      }

      if (this.user.role === 'admin') {
        if (adminNav) adminNav.style.display = 'flex';
        if (areaBadge) {
          areaBadge.className = 'area-indicator-badge admin-badge';
          areaBadge.innerHTML = '🛡️ Admin Portal';
        }
        if (validityPill) {
          validityPill.style.display = 'inline-flex';
          validityPill.className = 'plan-validity-pill is-admin';
          validityPill.innerHTML = '👑 Pro: Admin Access';
          validityPill.onclick = null;
        }
        if (avatarEl) {
          avatarEl.classList.add('pro-rainbow-ring');
        }
      } else {
        if (adminNav) adminNav.style.display = 'none';
        if (areaBadge) {
          areaBadge.className = 'area-indicator-badge';
          areaBadge.innerHTML = '👨‍🎓 Student Area';
        }

        const isPro = this.user.is_premium || this.user.subscription_status === 'active';
        if (isPro) {
          const daysLeft = this.user.subscription_days_left !== undefined ? this.user.subscription_days_left : 30;
          if (validityPill) {
            validityPill.style.display = 'inline-flex';
            validityPill.className = 'plan-validity-pill is-pro';
            validityPill.innerHTML = `👑 Pro: ${daysLeft} दिन शेष`;
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

    if (isAdmin) {
      // Streamlined Admin Sidebar Items (Most useful tools only)
      const adminItems = [
        { id: 'admin', icon: '📊', label: 'Overview', sub: 'कंसोल मेट्रिक्स', view: 'admin' },
        { id: 'admin-passages', icon: '📝', label: 'Passages (आलेख)', sub: 'आलेख सूची एवं संपादन', view: 'admin', section: 'adminPassagesSection' },
        { id: 'admin-subscribers', icon: '👥', label: 'Students & Free Access', sub: 'छात्र व फ्री एक्सेस टिक', view: 'admin', section: 'adminSubscribersSection' },
        { id: 'admin-payments', icon: '💳', label: 'Payments & UTR', sub: 'भुगतान सत्यापन', view: 'admin', section: 'adminPaymentsSection' },
        { id: 'admin-pricing', icon: '⚙️', label: 'Pricing, QR & Scoring', sub: 'प्लान, QR व नियम', view: 'admin', section: 'adminSubscriptionConfigSection' }
      ];

      navContainer.innerHTML = `
        <div class="sidebar-role-badge admin-badge">
          <span>🛡️</span> <span>ADMIN PORTAL</span>
        </div>
        ${adminItems.map(item => `
          <a href="javascript:void(0)" class="nav-item ${currentView === item.view && !item.section ? 'active' : ''}" data-sidebar-item="${item.id}" title="${item.label}">
            <span class="nav-item-icon">${item.icon}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:0.86rem; line-height:1.2;">${item.label}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${item.sub}</div>
            </div>
          </a>
        `).join('')}
      `;

      adminItems.forEach(item => {
        const el = navContainer.querySelector(`[data-sidebar-item="${item.id}"]`);
        if (!el) return;
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeSidebar();
          if (item.action === 'users') {
            stenoAdmin.openUsersModal();
          } else if (item.action === 'category') {
            this.navigate('admin');
            stenoAdmin.openCategoryModal();
          } else if (item.section) {
            this.navigate(item.view || 'admin');
            setTimeout(() => stenoAdmin.scrollToSection(item.section), 100);
          } else {
            this.navigate(item.view || item.id);
          }
        });
      });

      if (footerContainer) {
        const adminName = (this.user && (this.user.display_name || this.user.username)) || 'Administrator';
        footerContainer.innerHTML = `
          <div class="sidebar-user-preview admin-preview">
            <div class="sidebar-avatar" style="background:linear-gradient(135deg, #ef4444, #991b1b);">🛡️</div>
            <div class="sidebar-user-details">
              <div class="sidebar-user-name">${this.escapeHtml(adminName)}</div>
              <div class="sidebar-user-role">🛡️ System Administrator</div>
            </div>
          </div>
          <button class="nav-item" style="width:100%; margin-top:6px; color:var(--accent-red); justify-content:center; gap:8px;" onclick="stenoApp.closeSidebar(); stenoApp.logout();">
            <span class="nav-item-icon">🚪</span>
            <span>लॉगआउट (Logout)</span>
          </button>
        `;
      }
    } else {
      // Student Sidebar Items (Strictly NO admin items in DOM)
      const studentItems = [
        { id: 'home', icon: '🏠', label: 'Dashboard', sub: 'डैशबोर्ड' },
        { id: 'classes', icon: '🎧', label: 'Practice Classes', sub: 'डिक्टेशन क्लास' },
        { id: 'subscription', icon: '💳', label: 'Subscription', sub: 'सदस्यता एवं प्रो' },
        { id: 'my-practice', icon: '📜', label: 'Practice History', sub: 'अभ्यास इतिहास' },
        { id: 'progress', icon: '📊', label: 'Progress & Analytics', sub: 'प्रगति चार्ट' },
        { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', sub: 'रैंकिंग बोर्ड' },
        { id: 'bookmarks', icon: '🔖', label: 'Bookmarks', sub: 'सहेजे गए आलेख' },
        { id: 'rules', icon: '📋', label: 'परीक्षा नियम', sub: 'UPSSSC & SSC Rules' },
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

  navigate(viewId, params = {}) {
    // Role-based access control (RBAC) enforcement
    if (viewId === 'admin') {
      if (!this.user || this.user.role !== 'admin') {
        this.showToast('This account does not have administrator access.', 'error');
        this.navigate('home');
        return;
      }
    }

    this.activeView = viewId;
    this.closeSidebar();

    // Update active badge in top header
    const viewTitles = {
      'home': 'Dashboard',
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
      case 'rules':
        // Rules view is static HTML — just scroll to top, no async load needed
        break;
      case 'admin':

        stenoAdmin.loadOverview();
        stenoAdmin.loadPassages();
        stenoAdmin.loadScoringConfig();
        stenoAdmin.loadSystemSettings();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------------------
  async loadCategories() {
    try {
      const res = await this.apiCall('/api/categories');
      this.categories = res.categories || [];
      this.renderCategoryPills();
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  applyPassageFilters() {
    if (!this.allPassages) this.allPassages = [];
    let list = [...this.allPassages];

    if (this.selectedLanguage && this.selectedLanguage !== 'all') {
      list = list.filter(p => (p.language || '').toLowerCase() === this.selectedLanguage.toLowerCase());
    }
    if (this.selectedDifficulty && this.selectedDifficulty !== 'all') {
      list = list.filter(p => (p.difficulty || '').toLowerCase() === this.selectedDifficulty.toLowerCase());
    }
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      list = list.filter(p => String(p.category_id) === String(this.selectedCategory));
    }
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
    this.applyPassageFilters();
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
    if (!container) return;

    container.innerHTML = `
      <button class="cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="stenoApp.filterCategory('all', this)">सभी श्रेणियां (All)</button>
      ${this.categories.map(c => `
        <button class="cat-pill ${this.selectedCategory === c.id.toString() ? 'active' : ''}" onclick="stenoApp.filterCategory('${c.id}', this)">${c.name}</button>
      `).join('')}
    `;
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
    this.renderHomeCards();
    this.renderDailyTargetSummary();
  }

  async renderDailyTargetSummary() {
    if (!this.user) return;
    try {
      const res = await this.apiCall('/api/progress/summary');
      const goal = res.today_goal || {};
      const stats = res.stats || {};
      const realPoints = stats.points !== undefined && stats.points !== null ? stats.points : 0;

      // Legacy Elements Support
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

      // Phase 3: 8 Compact Horizontal Landscape Cards (Authentic Data)
      const hStreak = document.getElementById('hStatStreak');
      const hStreakSub = document.getElementById('hStatStreakSub');
      const hGoal = document.getElementById('hStatGoal');
      const hGoalSub = document.getElementById('hStatGoalSub');
      const hAvgWpm = document.getElementById('hStatAvgWpm');
      const hAcc = document.getElementById('hStatAccuracy');
      const hPractices = document.getElementById('hStatPractices');
      const hPoints = document.getElementById('hStatPoints');
      const hBestWpm = document.getElementById('hStatBestWpm');
      const hTotalTime = document.getElementById('hStatTotalTime');

      if (hStreak) hStreak.textContent = `${stats.streak_days || 0} दिन`;
      if (hStreakSub) hStreakSub.textContent = `अधिकतम ${stats.longest_streak || 0} दिन स्ट्रीक`;
      if (hGoal) hGoal.textContent = `${goal.completed_dictations || 0} / ${goal.target_dictations || 3}`;
      if (hGoalSub) hGoalSub.textContent = `${goal.percent_completed || 0}% लक्ष्य पूर्ण`;
      if (hAvgWpm) hAvgWpm.textContent = `${stats.avg_wpm !== undefined ? stats.avg_wpm : 0} WPM`;
      if (hAcc) hAcc.textContent = `${stats.avg_accuracy !== undefined ? stats.avg_accuracy : 0}%`;
      if (hPractices) hPractices.textContent = `${stats.total_practices || 0} सत्र`;
      if (hPoints) hPoints.textContent = `${realPoints} Pts`;
      if (hBestWpm) hBestWpm.textContent = `${stats.best_wpm !== undefined ? stats.best_wpm : 0} WPM`;
      if (hTotalTime) hTotalTime.textContent = `${stats.total_time_formatted || '0 mins'}`;
    } catch (err) {
      console.warn('Could not fetch daily target summary');
    }
  }

  renderHomeCards() {
    const grid = document.getElementById('homeClassCardsGrid');
    if (!grid) return;

    if (this.passages.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted);">कोई क्लास नहीं मिली।</div>';
      return;
    }

    grid.innerHTML = this.passages.map(p => this.createPassageCardHTML(p)).join('');
  }

  renderClasses() {
    const grid = document.getElementById('classesListGrid');
    if (!grid) return;

    if (this.passages.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted);">कोई क्लास नहीं मिली। कृपया फ़िल्टर बदलें।</div>';
      return;
    }

    grid.innerHTML = this.passages.map(p => this.createPassageCardHTML(p)).join('');
  }

  createPassageCardHTML(p) {
    const isBookmarked = this.bookmarks.has(p.id);
    const mins = Math.floor((p.duration_seconds || 180) / 60);
    const secs = (p.duration_seconds || 180) % 60;
    const durStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const progressPercent = p.best_wpm ? Math.min(100, Math.round((p.best_wpm / p.target_wpm) * 100)) : 0;
    const hasFullAccess = !!(this.user && (this.user.role === 'admin' || this.user.subscription_status === 'active' || this.user.is_free_access));
    const isLocked = !hasFullAccess && !!p.is_locked;
    const isFree = !!p.is_free_tier || hasFullAccess;

    return `
      <div class="class-card ${isLocked ? 'locked-card' : ''}" onclick="${isLocked ? `stenoApp.handleLockedPassageClick(${p.id})` : `stenoApp.openPractice(${p.id})`}" style="cursor:pointer;">
        <div>
          <div class="class-card-header">
            <div class="class-badge-group">
              <span class="badge badge-${p.language}">${p.language === 'hindi' ? 'हिंदी' : 'English'}</span>
              <span class="badge badge-${p.difficulty}">${p.difficulty ? p.difficulty.toUpperCase() : 'MEDIUM'}</span>
              <span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary)">⏱ ${durStr}</span>
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
            <button class="start-practice-btn" onclick="event.stopPropagation(); stenoApp.openPractice(${p.id})">
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
  async openPractice(passageId) {
    try {
      const pId = parseInt(passageId, 10);
      const cardEl = document.querySelector(`.class-card[onclick*="openPractice(${passageId})"]`);
      if (cardEl) {
        cardEl.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        cardEl.style.opacity = '0.75';
        cardEl.style.transform = 'scale(0.99)';
      }

      const res = await this.apiCall(`/api/passages/${pId}`);
      if (cardEl) {
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'none';
      }

      if (!res || !res.passage) {
        this.showToast('यह आलेख अब उपलब्ध नहीं है। सूची अपडेट की जा रही है...', 'warning');
        await this.loadPassages(true);
        return;
      }

      if (res.passage.is_locked) {
        this.handleLockedPassageClick(pId);
        return;
      }
      this.currentPassage = res.passage;

      const hasFullAccess = !!(this.user && (this.user.role === 'admin' || this.user.subscription_status === 'active' || this.user.is_free_access));
      if (!this.currentPassage.is_free_tier && this.currentPassage.is_premium && !hasFullAccess) {
        this.handleLockedPassageClick(pId);
        return;
      }

      // Automatically use preferred font (never annoy student with repeated popup modal)
      const savedPref = localStorage.getItem('stenomaster_preferred_font') || localStorage.getItem('stenomaster_typing_mode') || 'mangal_unicode';
      const preferredSystem = (savedPref === 'kruti_dev_010' || savedPref === 'krutidev') ? 'kruti_dev_010' : 'mangal_unicode';

      const sys = this.currentPassage.typing_system || 'dual';
      if (sys === 'kruti_dev_010') {
        this.startPracticeWithSystem('kruti_dev_010');
      } else if (sys === 'mangal_unicode') {
        this.startPracticeWithSystem('mangal_unicode');
      } else {
        // Dual mode: start immediately in student's preferred font!
        this.startPracticeWithSystem(preferredSystem);
      }
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

    // Reference text for audio player if synthesizing speech (never mix: use chosen reference text)
    const audioRefText = selectedSystem === 'kruti_dev_010'
      ? (this.currentPassage.official_kruti_dev_text || this.currentPassage.official_text_krutidev || this.currentPassage.official_text)
      : (this.currentPassage.official_mangal_text || this.currentPassage.official_text);

    // Setup Audio Player with streaming or synthesis fallback
    stenoAudioPlayer.loadAudio(
      this.currentPassage.audio_url,
      this.currentPassage.duration_seconds,
      audioRefText,
      this.currentPassage.language
    );

    // Start typing engine
    stenoTypingEngine.startPractice(this.currentPassage);

    // Initialize exam evaluation rule (SSC vs UPSSSC)
    const userTarget = (this.user && this.user.target_exam || '').toLowerCase();
    const defaultRule = userTarget.includes('upsssc') ? 'upsssc' : 'ssc_steno';
    this.setExamRule(this.currentExamRule || defaultRule, false);

    this.navigate('practice');
  }

  async submitPractice() {
    const text = stenoTypingEngine.getText().trim();
    if (!text) {
      this.showToast('कृपया सबमिट करने से पहले कुछ टेक्स्ट टाइप करें।', 'error');
      return;
    }

    if (!confirm('क्या आप अपना टंकण अभ्यास जमा करना चाहते हैं? (Submit practice for evaluation)')) {
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
        typed_text: text,
        typing_mode: typingMode,
        selected_typing_system: this.selectedTypingSystem || (typingMode === 'krutidev' ? 'kruti_dev_010' : 'mangal_unicode'),
        exam_rule: this.currentExamRule || 'ssc_steno',
        time_taken_seconds: timeTaken
      });

      stenoTypingEngine.stopPractice();
      this.showToast('मूल्यांकन पूर्ण! 🎉', 'success');

      // Render Result Report Card
      const reportContainer = document.getElementById('resultReportContainer');
      if (window.stenoComparisonView && reportContainer) {
        stenoComparisonView.renderResult(evalReport, reportContainer);
      }
      this.navigate('result');
      if (!this.user) {
        this.showToast('स्कोर सुरक्षित रखने व इतिहास देखने हेतु लॉगिन करें।', 'info');
      }
    } catch (err) {
      this.showToast('सबमिशन में त्रुटि: ' + err.message, 'error');
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
        const reportContainer = document.getElementById('resultReportContainer');
        stenoComparisonView.renderResult(report, reportContainer);
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
      const stats = res.stats || {};

      document.getElementById('progressTotalPractices').textContent = stats.total_practices || 0;
      document.getElementById('progressTotalTime').textContent = stats.total_time_formatted || '0 mins';
      document.getElementById('progressAvgWpm').textContent = `${stats.avg_wpm || 0} WPM`;
      document.getElementById('progressBestWpm').textContent = `${stats.best_wpm || 0} WPM`;
      document.getElementById('progressAvgAcc').textContent = `${stats.avg_accuracy || 0}%`;
      document.getElementById('progressTotalWords').textContent = stats.total_words || 0;
      document.getElementById('progressStreak').textContent = `${stats.streak_days || 0} Days`;
      document.getElementById('progressPoints').textContent = `${stats.points || 0}`;

      // Goal Gap
      const currentWpm = stats.best_wpm || 0;
      const targetWpm = stats.target_wpm || 50;
      const gap = Math.max(0, targetWpm - currentWpm);
      document.getElementById('goalTargetWpmText').textContent = `${targetWpm} WPM`;
      document.getElementById('goalCurrentWpmText').textContent = `${currentWpm} WPM`;
      document.getElementById('goalWpmGapText').textContent = gap > 0 ? `लक्ष्य से ${gap} WPM दूर (${gap} WPM to go)` : '🎉 लक्ष्य प्राप्त!';
      document.getElementById('goalWpmProgressBar').style.width = `${Math.min(100, Math.round((currentWpm / targetWpm) * 100))}%`;

      // Draw Charts
      const speedCanvas = document.getElementById('speedTrendChart');
      const accCanvas = document.getElementById('accTrendChart');
      const errorCanvas = document.getElementById('errorFreqChart');

      const trends = res.trends || [];
      const speedPoints = trends.map((t, idx) => ({ val: t.net_wpm, label: `#${idx + 1}` }));
      const accPoints = trends.map((t, idx) => ({ val: t.accuracy, label: `#${idx + 1}` }));

      stenoCharts.drawLineChart(speedCanvas, speedPoints, 'WPM', '#2563eb', 'rgba(37,99,235,0.12)');
      stenoCharts.drawLineChart(accCanvas, accPoints, '%', '#10b981', 'rgba(16,185,129,0.12)');

      const errorFreq = res.error_frequency || [];
      const errorCats = errorFreq.map(e => e.category);
      const errorVals = errorFreq.map(e => e.count);
      stenoCharts.drawBarChart(errorCanvas, errorCats, errorVals, '#f59e0b');

      // Achievements
      const achGrid = document.getElementById('progressAchievementsGrid');
      if (achGrid) {
        const achs = res.achievements || [];
        achGrid.innerHTML = achs.map(a => `
          <div class="badge-card">
            <div class="badge-icon-wrap">🏆</div>
            <div class="badge-title">${a.title}</div>
            <div class="badge-desc">${a.description}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px;">Unlocked: ${new Date(a.unlocked_at).toLocaleDateString()}</div>
          </div>
        `).join('') || '<p style="color:var(--text-muted);">अभी कोई बैज अनलॉक नहीं हुआ। नियमित अभ्यास करें!</p>';
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
  async loadSubscription() {
    try {
      const details = await this.apiCall('/api/subscription/details');
      this.subscriptionPlans = details.plans || [];
      const upiId = details.upi_id || 'stenomaster@upi';
      const statusBadgeWrap = document.getElementById('subCurrentStatusBadgeWrap');
      const expiringBanner = document.getElementById('subExpiringSoonBanner');
      const qrImgEl = document.getElementById('subActiveQrImg');
      const upiDisplayEl = document.getElementById('subUpiIdDisplay');

      if (upiDisplayEl) upiDisplayEl.textContent = upiId;
      if (qrImgEl && details.qr_url) {
        qrImgEl.src = `${details.qr_url}?t=${Date.now()}`;
      }

      const isPro = Boolean(details.is_premium || details.subscription_status === 'active');
      const daysLeft = details.subscription_days_left !== undefined ? details.subscription_days_left : 0;

      if (statusBadgeWrap) {
        if (isPro) {
          const expDate = details.subscription_end ? new Date(details.subscription_end).toLocaleDateString('hi-IN') : 'सक्रिय';
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

    const currentSelectedId = this.selectedPlan ? this.selectedPlan.id : (this.subscriptionPlans.find(p => p.id === '3m')?.id || this.subscriptionPlans[0].id);

    container.innerHTML = this.subscriptionPlans.map(plan => {
      const isSelected = plan.id === currentSelectedId;
      const isPopular = plan.id === '3m' || (plan.badge && plan.badge.includes('POPULAR'));
      const isBest = plan.id === '1y' || (plan.badge && plan.badge.includes('BEST'));

      let tagHtml = '';
      if (isPopular) {
        tagHtml = '<div class="sub-plan-card-tag tag-popular">⭐ सर्वाधिक लोकप्रिय (POPULAR)</div>';
      } else if (isBest) {
        tagHtml = '<div class="sub-plan-card-tag tag-best">👑 सर्वश्रेष्ठ मूल्य (BEST VALUE)</div>';
      } else if (plan.savings) {
        tagHtml = `<div class="sub-plan-card-tag">💰 ${this.escapeHtml(plan.savings)}</div>`;
      }

      const durationTitle = plan.title_hi || `${plan.days} दिन`;
      const subtitle = plan.subtitle_hi || plan.name;
      const savingsPill = plan.savings ? `<div class="sub-plan-savings-pill">🎉 ${this.escapeHtml(plan.savings)}</div>` : '<div class="sub-plan-savings-pill" style="visibility:hidden;">—</div>';

      return `
        <div class="sub-plan-card ${isSelected ? 'selected' : ''}" data-plan-id="${plan.id}" onclick="stenoApp.selectSubscriptionPlan('${plan.id}')">
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
          <button type="button" class="sub-select-btn">
            ${isSelected ? '✓ चयनित प्लान (Selected)' : 'यह प्लान चुनें →'}
          </button>
        </div>
      `;
    }).join('');
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
  async initiateCashfreePayment() {
    if (!this.user) {
      this.showAuthGateway('student', 'भुगतान करने के लिए कृपया पहले लॉगिन करें।');
      return;
    }

    const currentPlan = this.selectedPlan || { id: '1m', name: 'StenoMaster Pro — 1 Month', price: 100, days: 30 };
    const btn = document.getElementById('btnCashfreeCheckout');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳ ₹${currentPlan.price} हेतु Cashfree पेमेंट सत्र बनाया जा रहा है...</span>`;
    }

    try {
      this.showToast(`Cashfree सुरक्षित भुगतान सत्र (₹${currentPlan.price}) तैयार किया जा रहा है... 🔐`, 'info');
      const orderData = await this.apiCall('/api/payment/cashfree/create-order', 'POST', {
        plan_id: currentPlan.id,
        amount: currentPlan.price,
        plan_days: currentPlan.days,
        plan_name: currentPlan.name
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
            redirectTarget: '_modal'
          }).then(async (result) => {
            if (result.error) {
              this.showToast(`भुगतान: ${result.error.message || 'भुगतान रद्द किया गया'}`, 'warning');
            }
            await this.verifyCashfreeOrder(orderId, currentPlan);
          });
        } catch (sdkErr) {
          console.warn('Cashfree SDK modal launch failed, falling back to direct verification:', sdkErr);
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
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalContent;
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

  async loadReferrals() {
    if (!this.user) {
      this.openModal('loginModal');
      return;
    }
    try {
      const res = await this.apiCall('/api/referrals/stats');
      document.getElementById('referralCodeDisplay').textContent = res.referral_code || 'SMSTENO';
      document.getElementById('referralShareLink').textContent = `${window.location.origin}/?ref=${res.referral_code}`;
      document.getElementById('referralTotalCount').textContent = res.total_referrals || 0;
      document.getElementById('referralPointsEarned').textContent = `${res.points_earned || 0} Pts`;
      document.getElementById('referralTotalBalance').textContent = `${res.total_points || 0} Pts`;
    } catch (err) {
      console.error('Failed to load referrals:', err);
    }
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}


window.stenoApp = new StenoApp();

