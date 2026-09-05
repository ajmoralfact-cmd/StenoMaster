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
 * - Exam restrictions (Backspace Lock & Anti-Paste)
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
  // Chhoti 'i' matra (f) reorder: f[consonant] -> [consonant]ि
  res = res.replace(/f([\u0915-\u0939](\u094D[\u0915-\u0939])*)/g, '$1ि');
  res = res.replace(/f/g, 'ि');
  // Reph Z -> र्
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
    this.krutiPreviewWrap = null;
    this.krutiPreviewText = null;

    this.initLeaveWarning();
  }

  mount(elements) {
    this.textarea = elements.textarea;
    this.wordCountEl = elements.wordCount;
    this.charCountEl = elements.charCount;
    this.timerEl = elements.timer;
    this.modeSelectorEl = elements.modeSelector;
    this.draftStatusEl = elements.draftStatus;
    this.krutiPreviewWrap = document.getElementById('krutiPreviewContainer');
    this.krutiPreviewText = document.getElementById('krutiUnicodePreviewText');

    if (this.modeSelectorEl) {
      this.modeSelectorEl.value = this.typingMode;
      this.modeSelectorEl.addEventListener('change', (e) => {
        this.setTypingMode(e.target.value);
      });
    }

    if (this.textarea) {
      this.textarea.addEventListener('input', () => {
        this.onTextInput();
      });

      // Exam Mode: Backspace lock enforcement
      this.textarea.addEventListener('keydown', (e) => {
        if (this.backspaceLocked && e.key === 'Backspace') {
          e.preventDefault();
          this.showDraftNotice('⚠️ परीक्षा मोड: बैकस्पेस लॉक है (Backspace Disabled)');
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
    this.elapsedSeconds = 0;

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

    // Typing Timer starts only when the student actually types in the box
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.updateTimerDisplay();

    // Remove active timer pulse indicator
    const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
    if (timerPill) timerPill.classList.remove('timer-active');
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
      }, 1000);

      // Visual indicator that typing timer has officially started
      const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
      if (timerPill) timerPill.classList.add('timer-active');
    }
  }

  onTextInput() {
    this.isDirty = true;
    this.startTimerIfNeeded();
    this.updateLiveStats();
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
      this.textarea.setAttribute('placeholder', 'कृति देव 010 में डिक्टेशन टाइप करना प्रारंभ करें... (Start typing in Kruti Dev 010)');
      if (this.krutiPreviewWrap) {
        this.krutiPreviewWrap.style.display = 'block';
      }
    } else {
      this.textarea.classList.add('font-mangal');
      this.textarea.setAttribute('placeholder', 'डिक्टेशन सुनकर यहाँ टाइप करना प्रारंभ करें... (Start typing the dictated passage here)');
      if (this.krutiPreviewWrap) {
        this.krutiPreviewWrap.style.display = 'none';
      }
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

    // Update active state in toolbar buttons if present
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

    let chars = rawText.length;
    let words = 0;

    if (this.typingMode === 'krutidev') {
      const convertedUnicode = krutiDevToUnicodeJS(rawText);
      if (this.krutiPreviewText) {
        this.krutiPreviewText.textContent = convertedUnicode || '(यहाँ आपके टाइप किए गए कृति देव शब्दों का देवनागरी अनुवाद स्वतः दिखेगा...)';
      }
      words = convertedUnicode.trim() ? convertedUnicode.trim().split(/\s+/).length : 0;
    } else {
      words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    }

    if (this.charCountEl) this.charCountEl.textContent = chars;
    if (this.wordCountEl) this.wordCountEl.textContent = words;
  }

  updateTimerDisplay() {
    if (!this.timerEl) return;
    const mins = Math.floor(this.elapsedSeconds / 60);
    const secs = this.elapsedSeconds % 60;
    this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.hasSubmitted = true;
    this.isDirty = false;
    const timerPill = this.timerEl ? this.timerEl.closest('.stat-pill') : null;
    if (timerPill) timerPill.classList.remove('timer-active');
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
