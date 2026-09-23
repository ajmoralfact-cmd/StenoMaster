/**
 * Typing Engine & Distraction-Free Editor Controller for StenoMaster
 * Handles:
 * - Word & Character counting (Unicode-aware)
 * - Genuine Hindi typing font switching (Mangal / Kruti Dev 010 / Devlys / Inscript / Remington)
 * - Real-time Kruti Dev to Unicode translation preview
 * - Auto-save draft to localStorage
 * - Timer & Live WPM tracking
 * - Accidental leave protection
 * - Font scaling (A- / A+)
 * - Strict Exam Hall Mode (Full Screen lock, Tab switch anti-cheat, 1-Min Beep & Backspace Lock)
 */

const KD_MAP = [
  ["kZ", "र्ा"], ["र्f", "िर्"], ["vks", "ओ"], ["vkS", "औ"], ["vk", "आ"], ["bZ", "ई"],
  ["?k", "घ"], ["Tk", "झ"], ["Fk", "थ"], ["/k", "ध"], ["Hk", "भ"], ["'k", "श"],
  ['"k', "ष"], [".k", "ण"], ["[k", "ख"],
  ["Z", "र्"], ["a", "ं"], ["¡", "ँ"], ["%", "ः"],
  ["1", "१"], ["2", "२"], ["3", "३"], ["4", "४"], ["5", "५"],
  ["6", "६"], ["7", "७"], ["8", "८"], ["9", "९"], ["0", "०"],
  ["A", "।"], ["d", "क"], ["D", "क्"], ["[", "ख्"], ["x", "ग"], ["X", "ग्"],
  ["?", "घ्"], ["p", "च"], ["P", "च्"], ["N", "छ"], ["t", "ज"], ["T", "ज्"],
  ["V", "ट"], ["B", "ठ"], ["M", "ड"], ["<", "ढ"], [".", "ण्"],
  ["r", "त"], ["R", "त्"], ["F", "थ्"], ["n", "द"], ["/", "ध्"],
  ["u", "न"], ["U", "न्"], ["i", "प"], ["I", "प्"], ["Q", "फ"],
  ["c", "ब"], ["C", "ब्"], ["H", "भ्"], ["e", "म"], ["E", "म्"],
  [";", "य"], ["Y", "य्"], ["j", "र"], ["y", "ल"], ["L", "ल्"],
  ["o", "व"], ["O", "व्"], ["'", "श्"], ['"', "ष्"], ["l", "स"],
  ["S", "स्"], ["g", "ह"], ["~", "्"], ["K", "ज्ञ"], ["=", "त्र"],
  ["«", "त्र"], ["k", "ा"], ["h", "ी"], ["q", "ु"], ["w", "ू"],
  ["`", "ृ"], ["s", "े"], ["S", "ै"], ["ks", "ो"], ["kS", "ौ"],
  ["v", "अ"], ["b", "इ"], ["m", "उ"], ["Å", "ऊ"], ["J", "श्र"]
];

function krutiDevToUnicodeJS(text) {
  if (!text) return "";
  let res = text;
  for (const [k, v] of KD_MAP) {
    res = res.split(k).join(v);
  }
  res = res.replace(/f([\u0915-\u0939]([\u094D][\u0915-\u0939])*)/g, '$1ि');
  res = res.replace(/f/g, 'ि');
  res = res.replace(/([क-ह](?:[\u093E-\u094C])?)Z/g, 'र्$1');
  return res;
}

class StenoTypingEngine {
  constructor() {
    this.currentPassageId = null;
    this.currentPassage = null;
    this.typingMode = localStorage.getItem('stenomaster_typing_mode') || 'mangal';
    this.fontSizeLevel = localStorage.getItem('stenomaster_font_size') || 'md';
    this.backspaceLocked = localStorage.getItem('stenomaster_backspace_locked') === 'true';

    // Strict Exam Hall Mode state
    this.examModeEnabled = localStorage.getItem('stenomaster_exam_mode') === 'true';
    this.tabSwitchCount = 0;
    this.oneMinuteAlertFired = false;
    this.isPracticeActive = false;
    this.targetDurationSeconds = 300;
    this._antiCheatInitialized = false;

    // OTG Physical Keyboard, Screen WakeLock & Mobile Optimization
    this.otgMode = localStorage.getItem('stenomaster_otg_mode') === 'true';
    this.wakeLock = null;
    this.mobilePlayerCompact = localStorage.getItem('stenomaster_mobile_player_compact') === 'true';

    this.startTime = null;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isDirty = false;
    this.hasSubmitted = false;

    this.textarea = null;
    this.wordCountEl = null;
    this.charCountEl = null;
    this.timerEl = null;
    this.modeSelectorEl = null;
    this.draftStatusEl = null;

    this.initLeaveWarning();
  }

  mount(elements) {
    this.textarea = elements.textarea;
    this.wordCountEl = elements.wordCount;
    this.charCountEl = elements.charCount;
    this.timerEl = elements.timer;
    this.modeSelectorEl = elements.modeSelector;
    this.draftStatusEl = elements.draftStatus;

    if (this.modeSelectorEl) {
      this.modeSelectorEl.value = this.typingMode;
      this.modeSelectorEl.addEventListener('change', (e) => {
        this.setTypingMode(e.target.value);
        if (window.stenoApp) {
          const sys = e.target.value === 'krutidev' ? 'kruti_dev_010' : 'mangal_unicode';
          localStorage.setItem('stenomaster_preferred_font', sys);
          if (typeof stenoApp.updateFontSwitcherUI === 'function') {
            stenoApp.updateFontSwitcherUI();
          }
        }
      });
    }

    if (this.textarea) {
      this.textarea.setAttribute('spellcheck', 'false');
      this.textarea.setAttribute('autocomplete', 'off');
      this.textarea.setAttribute('autocorrect', 'off');
      this.textarea.setAttribute('autocapitalize', 'off');

      this.textarea.addEventListener('input', () => {
        this.onTextInput();
      });

      // Exam Mode: Backspace lock enforcement (Optional Switch)
      this.textarea.addEventListener('keydown', (e) => {
        if (this.backspaceLocked && (e.key === 'Backspace' || e.key === 'Delete')) {
          e.preventDefault();
          this.showDraftNotice('🚫 परीक्षा नियम: बैकस्पेस लॉक है (Backspace Disabled)');
        }
      });

      // Anti-Cheat: Paste restriction during exam
      this.textarea.addEventListener('paste', (e) => {
        e.preventDefault();
        this.showDraftNotice('🚫 परीक्षा नियम: कॉपी-पेस्ट करना वर्जित है');
      });
    }

    // Apply active mode styles & font size
    this.applyTypingModeStyles();
    this.applyFontSize();
    this.updateBackspaceUI();
    this.updateExamModeUI();
    this.initExamAntiCheat();
    this.initOtgMode();
    this.initMobilePlayerState();
    this.updateFullscreenUI();

    document.addEventListener('fullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isPracticeActive && !this.hasSubmitted) {
        this.acquireWakeLock();
      }
    });

    // Auto-save interval every 5 seconds
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = setInterval(() => {
      this.saveDraft();
    }, 5000);
  }

  startPractice(passage) {
    this.currentPassageId = passage.id;
    this.currentPassage = passage;
    this.hasSubmitted = false;
    this.isDirty = false;
    this.isPracticeActive = true;
    this.elapsedSeconds = 0;
    this.tabSwitchCount = 0;
    this.oneMinuteAlertFired = false;
    this.targetDurationSeconds = (passage && passage.duration_seconds) ? parseInt(passage.duration_seconds) : 300;

    const banner = document.getElementById('practiceExamAlertBanner');
    if (banner) banner.style.display = 'none';

    // Restore draft if present
    const savedDraft = localStorage.getItem(`stenomaster_draft_${passage.id}`);
    if (savedDraft && this.textarea) {
      this.textarea.value = savedDraft;
      this.showDraftNotice('पिछला अधूरा ड्राफ्ट लोड किया गया (Draft restored)');
    } else if (this.textarea) {
      this.textarea.value = '';
    }

    this.applyTypingModeStyles();
    this.updateLiveStats();

    // Reset timer
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.updateTimerDisplay();

    const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
    if (timerPill) {
      timerPill.classList.remove('timer-active', 'timer-one-minute-alert');
    }

    // Apply OTG Mode, Compact Mobile Player & Screen Wake Lock
    this.applyOtgMode();
    this.initMobilePlayerState();
    this.acquireWakeLock();

    // Enter Full Screen if Exam Mode is active
    if (this.examModeEnabled) {
      setTimeout(() => this.enterFullScreen(), 300);
    }
  }

  startTimerIfNeeded() {
    if (this.isTimerRunning || this.hasSubmitted) return;
    const text = this.textarea ? this.textarea.value.trim() : '';
    if (text.length > 0) {
      this.isTimerRunning = true;
      this.startTime = Date.now() - (this.elapsedSeconds * 1000);
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.updateTimerDisplay();

        // 1-Minute Alert & Time's Up Auto-submit
        if (this.targetDurationSeconds > 0) {
          const remaining = this.targetDurationSeconds - this.elapsedSeconds;
          if (remaining === 60 && !this.oneMinuteAlertFired) {
            this.oneMinuteAlertFired = true;
            this.triggerOneMinuteAlert();
          } else if (remaining <= 0 && !this.hasSubmitted) {
            this.handleTimeUpAutoSubmit();
          }
        }
      }, 1000);

      const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
      if (timerPill) timerPill.classList.add('timer-active');
    }
  }

  triggerOneMinuteAlert() {
    this.playExamWarningBeep();
    const banner = document.getElementById('practiceExamAlertBanner');
    const textEl = document.getElementById('practiceExamAlertBannerText');
    if (banner) {
      if (textEl) textEl.textContent = '⚠️ अंतिम 1 मिनट शेष है! अपनी आशुलिपि आउटलाइन से टंकण शीघ्र पूर्ण करें।';
      banner.style.display = 'flex';
    }
    const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
    if (timerPill) timerPill.classList.add('timer-one-minute-alert');
    if (window.stenoApp) {
      stenoApp.showToast('⚠️ अंतिम 1 मिनट शेष है! (Final 1 Minute Alert)', 'warning');
    }
  }

  handleTimeUpAutoSubmit() {
    this.stopPractice();
    if (window.stenoApp) {
      stenoApp.showToast('⏱️ निर्धारित समय समाप्त! उत्तर स्वतः सबमिट किया जा रहा है...', 'info');
      stenoApp.submitPractice(true);
    }
  }

  playExamWarningBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Authentic Exam Hall Double Chime (880Hz -> 660Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, now + 0.25);
      gain2.gain.setValueAtTime(0.35, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Exam beep error:', e);
    }
  }

  playTabViolationBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      for (let i = 0; i < 3; i++) {
        const t = now + (i * 0.15);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      }
    } catch (e) {}
  }

  toggleExamMode(forceState) {
    this.examModeEnabled = (forceState !== undefined) ? forceState : !this.examModeEnabled;
    localStorage.setItem('stenomaster_exam_mode', this.examModeEnabled);
    this.updateExamModeUI();

    if (this.examModeEnabled) {
      this.enterFullScreen();
      if (window.stenoApp) stenoApp.showToast('🔒 सख्त परीक्षा मोड सक्रिय (फुल-स्क्रीन, एंटी-चीट व बीप ऑन)', 'success');
    } else {
      this.exitFullScreen();
      if (window.stenoApp) stenoApp.showToast('🔓 सामान्य अभ्यास मोड सक्रिय (फुल-स्क्रीन बंद)', 'info');
    }
  }

  updateExamModeUI() {
    const btn = document.getElementById('toggleExamModeBtn');
    if (btn) {
      if (this.examModeEnabled) {
        btn.innerHTML = '🔒 परीक्षा मोड: ON';
        btn.style.background = '#dc2626';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#b91c1c';
        btn.title = 'सख्त परीक्षा मोड सक्रिय है (फुल-स्क्रीन, टैब सुरक्षा व 1-मिनट बीप)';
      } else {
        btn.innerHTML = '🔓 परीक्षा मोड: OFF';
        btn.style.background = '#fef2f2';
        btn.style.color = '#b91c1c';
        btn.style.borderColor = '#fecaca';
        btn.title = 'सख्त परीक्षा हॉल मोड ऑन/ऑफ करें (फुल-स्क्रीन, एंटी-चीट व बीप)';
      }
    }
  }

  enterFullScreen() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
      }
    } catch (e) {}
  }

  exitFullScreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      }
    } catch (e) {}
    setTimeout(() => this.updateFullscreenUI(), 100);
  }

  toggleFullScreen() {
    try {
      const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (!isFull) {
        this.enterFullScreen();
      } else {
        this.exitFullScreen();
      }
    } catch (e) {}
    setTimeout(() => this.updateFullscreenUI(), 100);
  }

  updateFullscreenUI() {
    const btn = document.getElementById('practiceFullscreenBtn');
    if (!btn) return;
    const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    btn.innerHTML = isFull ? '✕ सामान्य स्क्रीन' : '📺 फुल-स्क्रीन';
    btn.classList.toggle('active', isFull);
    if (isFull) {
      btn.style.background = '#0284c7';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#0284c7';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }

  // -------------------------------------------------------------------------
  // OTG & Hardware Keyboard Optimization (inputmode="none")
  // -------------------------------------------------------------------------
  initOtgMode() {
    this.otgMode = localStorage.getItem('stenomaster_otg_mode') === 'true';
    this.applyOtgMode();
  }

  toggleOtgMode() {
    this.otgMode = !this.otgMode;
    localStorage.setItem('stenomaster_otg_mode', this.otgMode ? 'true' : 'false');
    this.applyOtgMode();
    if (this.otgMode) {
      if (window.stenoApp && typeof window.stenoApp.showToast === 'function') {
        window.stenoApp.showToast('⌨️ OTG कीबोर्ड मोड ON: ऑन-स्क्रीन कीबोर्ड छुपा दिया गया है। अपने फिजिकल कीबोर्ड से टाइप करें!', 'success');
      }
    } else {
      if (window.stenoApp && typeof window.stenoApp.showToast === 'function') {
        window.stenoApp.showToast('📱 ऑन-स्क्रीन टच कीबोर्ड सक्रिय है।', 'info');
      }
    }
  }

  applyOtgMode() {
    const btn = document.getElementById('toggleOtgModeBtn');
    const container = document.getElementById('view-practice') || document.querySelector('.practice-container');

    if (this.textarea) {
      if (this.otgMode) {
        this.textarea.setAttribute('inputmode', 'none');
      } else {
        this.textarea.removeAttribute('inputmode');
      }
    }

    if (btn) {
      if (this.otgMode) {
        btn.classList.add('active');
        btn.innerHTML = '⌨️ OTG: ON';
        btn.style.background = '#10b981';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#059669';
        btn.title = 'OTG फिजिकल कीबोर्ड मोड चालू है (सॉफ्ट कीबोर्ड छिपा है)';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '⌨️ OTG: OFF';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.title = 'OTG फिजिकल कीबोर्ड मोड चालू करने के लिए क्लिक करें';
      }
    }

    if (container) {
      container.classList.toggle('otg-mode-active', this.otgMode);
    }
    document.body.classList.toggle('otg-mode-active', this.otgMode);
  }

  // -------------------------------------------------------------------------
  // Screen Wake Lock API (Prevents mobile screen from dimming/sleeping)
  // -------------------------------------------------------------------------
  async acquireWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {}
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  // -------------------------------------------------------------------------
  // Mobile Compact Audio Player Strip
  // -------------------------------------------------------------------------
  toggleMobilePlayer() {
    const card = document.querySelector('.audio-player-card');
    if (!card) return;
    const isCompact = card.classList.toggle('audio-player-compact');
    localStorage.setItem('stenomaster_mobile_player_compact', isCompact ? 'true' : 'false');
    const btn = document.getElementById('toggleMobilePlayerBtn');
    if (btn) {
      btn.innerHTML = isCompact ? '🔽 विस्तृत' : '🔼 संक्षिप्त';
    }
  }

  initMobilePlayerState() {
    const card = document.querySelector('.audio-player-card');
    const btn = document.getElementById('toggleMobilePlayerBtn');
    if (!card) return;
    const saved = localStorage.getItem('stenomaster_mobile_player_compact');
    const isMobile = window.innerWidth <= 768;
    const shouldCompact = saved === 'true' || (saved === null && isMobile);
    if (shouldCompact) {
      card.classList.add('audio-player-compact');
      if (btn) btn.innerHTML = '🔽 विस्तृत';
    } else {
      card.classList.remove('audio-player-compact');
      if (btn) btn.innerHTML = '🔼 संक्षिप्त';
    }
  }

  initExamAntiCheat() {
    if (this._antiCheatInitialized) return;
    this._antiCheatInitialized = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isPracticeActive && this.examModeEnabled && !this.hasSubmitted) {
          this.tabSwitchCount++;
          this.showTabViolationAlert();
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isPracticeActive && this.examModeEnabled && !this.hasSubmitted) {
        this.showFullScreenExitAlert();
      }
    });
  }

  showTabViolationAlert() {
    this.playTabViolationBeep();
    const modal = document.getElementById('examHallWarningModal');
    const badge = document.getElementById('examWarningStrikeBadge');
    const sub = document.getElementById('examWarningModalSubtitle');

    if (sub) sub.textContent = 'आपने परीक्षा विंडो से बाहर स्विच किया है!';
    if (badge) badge.textContent = `चेतावनी स्ट्राइक: ${this.tabSwitchCount} / 3 बार विंडो छोड़ी गई`;

    if (modal) modal.classList.add('active');
    if (window.stenoApp) {
      stenoApp.showToast(`🚨 चेतावनी (${this.tabSwitchCount}): परीक्षा के दौरान अन्य टैब खोलना वर्जित है!`, 'error');
    }
  }

  showFullScreenExitAlert() {
    this.playTabViolationBeep();
    const modal = document.getElementById('examHallWarningModal');
    const badge = document.getElementById('examWarningStrikeBadge');
    const sub = document.getElementById('examWarningModalSubtitle');

    if (sub) sub.textContent = 'फुल-स्क्रीन मोड बंद किया गया है!';
    if (badge) badge.textContent = `चेतावनी: कृपया परीक्षा हॉल मोड में बने रहें`;

    if (modal) modal.classList.add('active');
  }

  resumeExamFullScreen() {
    const modal = document.getElementById('examHallWarningModal');
    if (modal) modal.classList.remove('active');
    this.enterFullScreen();
    if (this.textarea) this.textarea.focus();
  }

  onTextInput() {
    this.isDirty = true;
    this.startTimerIfNeeded();
    if (!this._statsRaf) {
      this._statsRaf = requestAnimationFrame(() => {
        this.updateLiveStats();
        this._statsRaf = null;
      });
    }
  }

  setTypingMode(mode) {
    this.typingMode = mode;
    localStorage.setItem('stenomaster_typing_mode', mode);
    if (this.modeSelectorEl) {
      this.modeSelectorEl.value = mode;
    }
    this.applyTypingModeStyles();
    this.updateLiveStats();
  }

  applyTypingModeStyles() {
    if (!this.textarea) return;

    this.textarea.classList.remove('font-krutidev', 'font-mangal', 'font-inscript', 'font-remington');

    if (this.typingMode === 'krutidev') {
      this.textarea.classList.add('font-krutidev');
      this.textarea.setAttribute('placeholder', 'कृति देव 010 में डिक्टेशन टाइप करना प्रारंभ करें...');
    } else {
      this.textarea.classList.add('font-mangal');
      this.textarea.setAttribute('placeholder', 'डिक्टेशन सुनकर यहाँ टाइप करना प्रारंभ करें...');
    }
  }

  setFontSize(level) {
    this.fontSizeLevel = level;
    localStorage.setItem('stenomaster_font_size', level);
    this.applyFontSize();
  }

  applyFontSize() {
    if (!this.textarea) return;
    this.textarea.classList.remove('fs-sm', 'fs-md', 'fs-lg', 'fs-xl');
    this.textarea.classList.add(`fs-${this.fontSizeLevel}`);

    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === this.fontSizeLevel);
    });
  }

  toggleBackspaceLock() {
    this.backspaceLocked = !this.backspaceLocked;
    localStorage.setItem('stenomaster_backspace_locked', this.backspaceLocked);
    this.updateBackspaceUI();
    const statusText = this.backspaceLocked ? 'सख्त परीक्षा मोड: बैकस्पेस बंद कर दिया गया' : 'अभ्यास मोड: बैकस्पेस चालू किया गया';
    this.showDraftNotice(statusText);
  }

  updateBackspaceUI() {
    const btn = document.getElementById('toggleBackspaceBtn');
    if (btn) {
      if (this.backspaceLocked) {
        btn.innerHTML = '🔒 Backspace: OFF';
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-secondary');
        btn.title = 'सख्त परीक्षा मोड (Strict Exam Mode): बैकस्पेस की अक्षम है';
      } else {
        btn.innerHTML = '🔓 Backspace: ON';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
        btn.title = 'अभ्यास मोड (Normal Mode): बैकस्पेस की सक्षम है';
      }
    }
  }

  updateLiveStats() {
    if (!this.textarea) return;
    const rawText = this.textarea.value;

    const chars = rawText.length;
    const trimmed = rawText.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;

    if (this.charCountEl) this.charCountEl.textContent = chars;
    if (this.wordCountEl) this.wordCountEl.textContent = words;
  }

  updateTimerDisplay() {
    if (!this.timerEl) return;
    if (this.targetDurationSeconds > 0) {
      const remaining = Math.max(0, this.targetDurationSeconds - this.elapsedSeconds);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      const mins = Math.floor(this.elapsedSeconds / 60);
      const secs = this.elapsedSeconds % 60;
      this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  saveDraft() {
    if (!this.currentPassageId || !this.textarea || !this.isDirty || this.hasSubmitted) return;
    const text = this.textarea.value;
    if (text.trim()) {
      localStorage.setItem(`stenomaster_draft_${this.currentPassageId}`, text);
      this.showDraftNotice('ड्राफ्ट स्वतः सहेजा गया (Auto-saved)');
    }
  }

  clearDraft(passageId) {
    localStorage.removeItem(`stenomaster_draft_${passageId || this.currentPassageId}`);
    if (this.textarea) this.textarea.value = '';
    this.updateLiveStats();
  }

  showDraftNotice(msg) {
    if (this.draftStatusEl) {
      this.draftStatusEl.textContent = msg;
      setTimeout(() => {
        if (this.draftStatusEl) this.draftStatusEl.textContent = 'सहेजा गया';
      }, 3000);
    }
  }

  getText() {
    return this.textarea ? this.textarea.value : '';
  }

  getElapsedSeconds() {
    return Math.max(5, this.elapsedSeconds);
  }

  stopPractice() {
    this.isPracticeActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.hasSubmitted = true;
    this.isDirty = false;
    const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
    if (timerPill) {
      timerPill.classList.remove('timer-active', 'timer-one-minute-alert');
    }
    const banner = document.getElementById('practiceExamAlertBanner');
    if (banner) banner.style.display = 'none';
    const warningModal = document.getElementById('examHallWarningModal');
    if (warningModal) warningModal.classList.remove('active');

    this.exitFullScreen();
    this.releaseWakeLock();

    if (this.currentPassageId) {
      localStorage.removeItem(`stenomaster_draft_${this.currentPassageId}`);
    }
  }

  initLeaveWarning() {
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty && !this.hasSubmitted && this.textarea && this.textarea.value.trim().length > 0) {
        e.preventDefault();
        e.returnValue = 'आपका अभ्यास अभी अधूरा है। क्या आप वाकई छोड़ना चाहते हैं?';
        return e.returnValue;
      }
    });
  }
}

window.stenoTypingEngine = new StenoTypingEngine();
