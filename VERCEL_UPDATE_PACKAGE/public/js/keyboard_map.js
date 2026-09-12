/**
 * StenoMaster - Visual Interactive Keyboard Layout Map
 * Provides visual on-screen typing guide for Kruti Dev 010, Remington Gail, and Inscript.
 */

class StenoKeyboardMap {
  constructor() {
    this.currentLayout = 'krutidev';
    this.isShift = false;
    this.searchQuery = '';

    this.rows = [
      [
        { code: 'Backquote', key: '`', shiftKey: '~', kdNorm: '़', kdShift: '्', remNorm: '़', remShift: '्', insNorm: 'ो', insShift: 'ौ', finger: 1 },
        { code: 'Digit1', key: '1', shiftKey: '!', kdNorm: '१', kdShift: '!', remNorm: '१', remShift: '!', insNorm: '१', insShift: 'ऍ', finger: 1 },
        { code: 'Digit2', key: '2', shiftKey: '@', kdNorm: '२', kdShift: 'ॅ', remNorm: '२', remShift: 'ॅ', insNorm: '२', insShift: 'र्', finger: 2 },
        { code: 'Digit3', key: '3', shiftKey: '#', kdNorm: '३', kdShift: '्र', remNorm: '३', remShift: '्र', insNorm: '३', insShift: '्र', finger: 3 },
        { code: 'Digit4', key: '4', shiftKey: '$', kdNorm: '४', kdShift: 'र्', remNorm: '४', remShift: 'र्', insNorm: '४', insShift: 'र्', finger: 4 },
        { code: 'Digit5', key: '5', shiftKey: '%', kdNorm: '५', kdShift: 'ज्ञ', remNorm: '५', remShift: 'ज्ञ', insNorm: '५', insShift: 'ज्ञ', finger: 4 },
        { code: 'Digit6', key: '6', shiftKey: '^', kdNorm: '६', kdShift: 'त्र', remNorm: '६', remShift: 'त्र', insNorm: '६', insShift: 'त्र', finger: 5 },
        { code: 'Digit7', key: '7', shiftKey: '&', kdNorm: '७', kdShift: 'क्ष', remNorm: '७', remShift: 'क्ष', insNorm: '७', insShift: 'क्ष', finger: 5 },
        { code: 'Digit8', key: '8', shiftKey: '*', kdNorm: '८', kdShift: 'श्र', remNorm: '८', remShift: 'श्र', insNorm: '८', insShift: 'श्र', finger: 6 },
        { code: 'Digit9', key: '9', shiftKey: '(', kdNorm: '९', kdShift: '(', remNorm: '९', remShift: '(', insNorm: '९', insShift: '(', finger: 7 },
        { code: 'Digit0', key: '0', shiftKey: ')', kdNorm: '०', kdShift: ')', remNorm: '०', remShift: ')', insNorm: '०', insShift: ')', finger: 8 },
        { code: 'Minus', key: '-', shiftKey: '_', kdNorm: '-', kdShift: 'ः', remNorm: '-', remShift: 'ः', insNorm: '-', insShift: 'ः', finger: 8 },
        { code: 'Equal', key: '=', shiftKey: '+', kdNorm: 'ृ', kdShift: 'ऋ', remNorm: 'ृ', remShift: 'ऋ', insNorm: 'ृ', insShift: 'ऋ', finger: 8 },
        { code: 'Backspace', key: 'Backspace', label: 'Backspace ⌫', width: 'wide-backspace', isSpecial: true, finger: 8 }
      ],
      [
        { code: 'Tab', key: 'Tab', label: 'Tab ⇥', width: 'wide-tab', isSpecial: true, finger: 1 },
        { code: 'KeyQ', key: 'q', shiftKey: 'Q', kdNorm: 'ु', kdShift: 'फ', remNorm: 'ु', remShift: 'फ', insNorm: 'ौ', insShift: 'औ', finger: 1 },
        { code: 'KeyW', key: 'w', shiftKey: 'W', kdNorm: 'ू', kdShift: 'ॅ', remNorm: 'ू', remShift: 'ॅ', insNorm: 'ै', insShift: 'ऐ', finger: 2 },
        { code: 'KeyE', key: 'e', shiftKey: 'E', kdNorm: 'म', kdShift: 'म्', remNorm: 'म', remShift: 'म्', insNorm: 'ा', insShift: 'आ', finger: 3 },
        { code: 'KeyR', key: 'r', shiftKey: 'R', kdNorm: 'त', kdShift: 'त्', remNorm: 'त', remShift: 'त्', insNorm: 'ी', insShift: 'ई', finger: 4 },
        { code: 'KeyT', key: 't', shiftKey: 'T', kdNorm: 'ज', kdShift: 'ज्', remNorm: 'ज', remShift: 'ज्', insNorm: 'ू', insShift: 'ऊ', finger: 4 },
        { code: 'KeyY', key: 'y', shiftKey: 'Y', kdNorm: 'ल', kdShift: 'ल्', remNorm: 'ल', remShift: 'ल्', insNorm: 'ब', insShift: 'भ', finger: 5 },
        { code: 'KeyU', key: 'u', shiftKey: 'U', kdNorm: 'न', kdShift: 'न्', remNorm: 'न', remShift: 'न्', insNorm: 'ह', insShift: 'ङ', finger: 5 },
        { code: 'KeyI', key: 'i', shiftKey: 'I', kdNorm: 'प', kdShift: 'प्', remNorm: 'प', remShift: 'प्', insNorm: 'ग', insShift: 'घ', finger: 6 },
        { code: 'KeyO', key: 'o', shiftKey: 'O', kdNorm: 'व', kdShift: 'व्', remNorm: 'व', remShift: 'व्', insNorm: 'द', insShift: 'ध', finger: 7 },
        { code: 'KeyP', key: 'p', shiftKey: 'P', kdNorm: 'च', kdShift: 'च्', remNorm: 'च', remShift: 'च्', insNorm: 'ज', insShift: 'झ', finger: 8 },
        { code: 'BracketLeft', key: '[', shiftKey: '{', kdNorm: 'ख', kdShift: 'ख्', remNorm: 'ख', remShift: 'ख्', insNorm: 'ड', insShift: 'ढ', finger: 8 },
        { code: 'BracketRight', key: ']', shiftKey: '}', kdNorm: ',', kdShift: 'द्व', remNorm: '़', remShift: 'ञ', insNorm: '़', insShift: 'ञ', finger: 8 },
        { code: 'Backslash', key: '\\', shiftKey: '|', kdNorm: '?', kdShift: '।', remNorm: '?', remShift: '।', insNorm: 'ॉ', insShift: 'ऑ', width: 'wide-pipe', finger: 8 }
      ],
      [
        { code: 'CapsLock', key: 'Caps', label: 'Caps ⇪', width: 'wide-caps', isSpecial: true, finger: 1 },
        { code: 'KeyA', key: 'a', shiftKey: 'A', kdNorm: 'ं', kdShift: 'ाे', remNorm: 'ं', remShift: 'ाे', insNorm: 'ो', insShift: 'ओ', finger: 1, isHome: true },
        { code: 'KeyS', key: 's', shiftKey: 'S', kdNorm: 'े', kdShift: 'ै', remNorm: 'े', remShift: 'ै', insNorm: 'े', insShift: 'ए', finger: 2, isHome: true },
        { code: 'KeyD', key: 'd', shiftKey: 'D', kdNorm: 'क', kdShift: 'क्', remNorm: 'क', remShift: 'क्', insNorm: '्', insShift: 'अ', finger: 3, isHome: true },
        { code: 'KeyF', key: 'f', shiftKey: 'F', kdNorm: 'ि', kdShift: 'थ्', remNorm: 'ि', remShift: 'थ्', insNorm: 'ि', insShift: 'इ', finger: 4, isHome: true, hasBump: true },
        { code: 'KeyG', key: 'g', shiftKey: 'G', kdNorm: 'ह', kdShift: 'ळ', remNorm: 'ह', remShift: 'ळ', insNorm: 'ु', insShift: 'उ', finger: 4 },
        { code: 'KeyH', key: 'h', shiftKey: 'H', kdNorm: 'ी', kdShift: 'भ्', remNorm: 'ी', remShift: 'भ्', insNorm: 'प', insShift: 'फ', finger: 5 },
        { code: 'KeyJ', key: 'j', shiftKey: 'J', kdNorm: 'र', kdShift: 'श्र', remNorm: 'र', remShift: 'श्र', insNorm: 'र', insShift: 'ऱ', finger: 5, isHome: true, hasBump: true },
        { code: 'KeyK', key: 'k', shiftKey: 'K', kdNorm: 'ा', kdShift: 'ज्ञ', remNorm: 'ा', remShift: 'ज्ञ', insNorm: 'क', insShift: 'ख', finger: 6, isHome: true },
        { code: 'KeyL', key: 'l', shiftKey: 'L', kdNorm: 'स', kdShift: 'स्', remNorm: 'स', remShift: 'स्', insNorm: 'त', insShift: 'थ', finger: 7, isHome: true },
        { code: 'Semicolon', key: ';', shiftKey: ':', kdNorm: 'य', kdShift: 'य्', remNorm: 'य', remShift: 'य्', insNorm: 'च', insShift: 'छ', finger: 8, isHome: true },
        { code: 'Quote', key: "'", shiftKey: '"', kdNorm: 'श', kdShift: 'श्', remNorm: 'श', remShift: 'श्', insNorm: 'ट', insShift: 'ठ', finger: 8 },
        { code: 'Enter', key: 'Enter', label: 'Enter ↵', width: 'wide-enter', isSpecial: true, finger: 8 }
      ],
      [
        { code: 'ShiftLeft', key: 'Shift', label: 'Shift ⇧', width: 'wide-shift-l', isSpecial: true, finger: 1 },
        { code: 'KeyZ', key: 'z', shiftKey: 'Z', kdNorm: '्र', kdShift: 'र्', remNorm: '्र', remShift: 'र्', insNorm: 'े', insShift: 'ँ', finger: 1 },
        { code: 'KeyX', key: 'x', shiftKey: 'X', kdNorm: 'ग', kdShift: 'ग्', remNorm: 'ग', remShift: 'ग्', insNorm: 'ं', insShift: 'ण', finger: 2 },
        { code: 'KeyC', key: 'c', shiftKey: 'C', kdNorm: 'ब', kdShift: 'ब्', remNorm: 'ब', remShift: 'ब्', insNorm: 'म', insShift: 'श', finger: 3 },
        { code: 'KeyV', key: 'v', shiftKey: 'V', kdNorm: 'अ', kdShift: 'ट', remNorm: 'अ', remShift: 'ट', insNorm: 'न', insShift: 'ष', finger: 4 },
        { code: 'KeyB', key: 'b', shiftKey: 'B', kdNorm: 'इ', kdShift: 'ठ', remNorm: 'इ', remShift: 'ठ', insNorm: 'व', insShift: 'स', finger: 4 },
        { code: 'KeyN', key: 'n', shiftKey: 'N', kdNorm: 'द', kdShift: 'ड', remNorm: 'द', remShift: 'ड', insNorm: 'ल', insShift: 'ळ', finger: 5 },
        { code: 'KeyM', key: 'm', shiftKey: 'M', kdNorm: 'उ', kdShift: 'ढ', remNorm: 'उ', remShift: 'ढ', insNorm: 'स', insShift: 'श', finger: 5 },
        { code: 'Comma', key: ',', shiftKey: '<', kdNorm: 'ए', kdShift: '़', remNorm: 'ए', remShift: '़', insNorm: ',', insShift: 'ष', finger: 6 },
        { code: 'Period', key: '.', shiftKey: '>', kdNorm: 'ण्', kdShift: 'ध्', remNorm: 'ण्', remShift: 'ध्', insNorm: '.', insShift: '।', finger: 7 },
        { code: 'Slash', key: '/', shiftKey: '?', kdNorm: 'ध्', kdShift: '?', remNorm: 'ध्', remShift: '?', insNorm: 'य', insShift: '?', finger: 8 },
        { code: 'ShiftRight', key: 'Shift', label: 'Shift ⇧', width: 'wide-shift-r', isSpecial: true, finger: 8 }
      ],
      [
        { code: 'Space', key: 'Space', label: 'स्पेस बार (Space Bar)', width: 'wide-space', isSpecial: true, finger: 0 }
      ]
    ];

    this.altCodes = [
      { code: 'Alt + 0216', char: 'क्र', desc: 'क में र की मात्रा (जैसे: क्रम, क्रांति)' },
      { code: 'Alt + 0161', char: 'द्ग', desc: 'द्ग संयुक्ताक्षर (जैसे: उद्गम)' },
      { code: 'Alt + 0170', char: 'द्ध', desc: 'द्ध संयुक्ताक्षर (जैसे: शुद्ध, युद्ध)' },
      { code: 'Alt + 0188', char: 'द्व', desc: 'द्व संयुक्ताक्षर (जैसे: द्वार, द्वितीय)' },
      { code: 'Alt + 0197', char: 'ह्र', desc: 'ह्र संयुक्ताक्षर (जैसे: ह्रस्व)' },
      { code: 'Alt + 0204', char: 'क्त', desc: 'क्त संयुक्ताक्षर (जैसे: रक्त, भक्त)' },
      { code: 'Alt + 0205', char: 'ष्ठ', desc: 'ष्ठ संयुक्ताक्षर (जैसे: पृष्ठ, श्रेष्ठ)' },
      { code: 'Alt + 0206', char: 'ष्ठ्', desc: 'आधा ष्ठ (जैसे: वरिष्ठता)' },
      { code: 'Alt + 0217', char: 'त्र', desc: 'त्र अक्षर (जैसे: छात्र, पत्र)' },
      { code: 'Alt + 0221', char: 'रू', desc: 'बड़ा रू (जैसे: रूप, रूचि)' },
      { code: 'Alt + 0225', char: 'द्य', desc: 'द्य संयुक्ताक्षर (जैसे: विद्या, विद्यार्थी)' },
      { code: 'Alt + 0227', char: 'ट्ट', desc: 'ट्ट संयुक्ताक्षर (जैसे: पट्टी, छुट्टी)' },
      { code: 'Alt + 0228', char: 'ट्ठ', desc: 'ट्ठ संयुक्ताक्षर (जैसे: चिट्ठी, गट्ठर)' },
      { code: 'Alt + 0230', char: 'ड्ड', desc: 'ड्ड संयुक्ताक्षर (जैसे: गड्ढा, कबड्डी)' },
      { code: 'Alt + 0182', char: 'ऋ', desc: 'ऋ ऋषि स्वर' }
    ];
  }

  init() {
    this.renderView();
    this.renderModal();
  }

  setLayout(layout) {
    this.currentLayout = layout;
    this.renderView();
    this.renderModalKeyboard();
  }

  toggleShift() {
    this.isShift = !this.isShift;
    this.renderView();
    this.renderModalKeyboard();
  }

  onSearch(val) {
    this.searchQuery = (val || '').trim().toLowerCase();
    this.renderView();
    this.renderModalKeyboard();
  }

  renderKeyHTML(k) {
    if (k.isSpecial) {
      return `<div class="v-key v-key-special ${k.width || ''}" data-code="${k.code}"><span class="v-key-label">${k.label || k.key}</span></div>`;
    }

    let hindiChar = '';
    let shiftHindi = '';
    if (this.currentLayout === 'krutidev') {
      hindiChar = k.kdNorm || '';
      shiftHindi = k.kdShift || '';
    } else if (this.currentLayout === 'remington') {
      hindiChar = k.remNorm || '';
      shiftHindi = k.remShift || '';
    } else {
      hindiChar = k.insNorm || '';
      shiftHindi = k.insShift || '';
    }

    const displayedHindi = this.isShift ? shiftHindi : hindiChar;
    const subHindi = this.isShift ? hindiChar : shiftHindi;
    const isMatched = this.searchQuery && (
      (displayedHindi && displayedHindi.includes(this.searchQuery)) ||
      (subHindi && subHindi.includes(this.searchQuery)) ||
      (k.key && k.key.toLowerCase() === this.searchQuery) ||
      (k.shiftKey && k.shiftKey.toLowerCase() === this.searchQuery)
    );

    return `
      <div class="v-key finger-${k.finger} ${k.isHome ? 'v-key-home' : ''} ${isMatched ? 'v-key-matched' : ''}" 
           data-code="${k.code}"
           onclick="stenoKeyboardMap.showKeyDetails('${k.key}', '${k.shiftKey}', '${hindiChar}', '${shiftHindi}')"
           title="English: ${k.key}/${k.shiftKey} | सामान्य: ${hindiChar} | शिफ्ट: ${shiftHindi}">
        <span class="v-eng-key">${this.isShift ? k.shiftKey : k.key}</span>
        <span class="v-hindi-char ${this.isShift ? 'is-shifted' : ''}">${displayedHindi || '—'}</span>
        <span class="v-sub-hindi">${subHindi || ''}</span>
        ${k.hasBump ? '<span class="v-key-bump"></span>' : ''}
      </div>
    `;
  }

  renderView() {
    const container = document.getElementById('keyboardMapContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="v-keyboard-wrapper">
        <div class="v-keyboard-header">
          <div class="v-layout-pills">
            <button class="v-tab-btn ${this.currentLayout === 'krutidev' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('krutidev')">
              ⌨️ कृति देव 010 (Kruti Dev)
            </button>
            <button class="v-tab-btn ${this.currentLayout === 'remington' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('remington')">
              🅰️ मंगल रेमिंगटन गेल (Remington Gail)
            </button>
            <button class="v-tab-btn ${this.currentLayout === 'inscript' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('inscript')">
              🇮🇳 मंगल इनस्क्रिप्ट (Inscript)
            </button>
          </div>

          <div class="v-keyboard-controls">
            <button class="v-shift-toggle ${this.isShift ? 'active' : ''}" onclick="stenoKeyboardMap.toggleShift()" title="Shift मोड टॉगल करें">
              ⇧ Shift: ${this.isShift ? 'ON (सक्रिय)' : 'OFF (सामान्य)'}
            </button>
            <div class="v-search-box">
              <span>🔍</span>
              <input type="text" class="v-search-input" placeholder="अक्षर खोजें (उदा: ज्ञ, त्र, क्र, ष्ठ)..." 
                     value="${this.searchQuery}"
                     oninput="stenoKeyboardMap.onSearch(this.value)">
              ${this.searchQuery ? `<button class="v-clear-search" onclick="stenoKeyboardMap.onSearch('')">✕</button>` : ''}
            </div>
          </div>
        </div>

        <div class="v-keyboard-board">
          ${this.rows.map(row => `
            <div class="v-key-row">
              ${row.map(k => this.renderKeyHTML(k)).join('')}
            </div>
          `).join('')}
        </div>

        <div class="v-finger-legend">
          <span class="legend-item"><span class="legend-dot finger-1"></span> बायां कनिष्ठा (Pinky L)</span>
          <span class="legend-item"><span class="legend-dot finger-2"></span> बायां अनामिका (Ring L)</span>
          <span class="legend-item"><span class="legend-dot finger-3"></span> बायां मध्यमा (Middle L)</span>
          <span class="legend-item"><span class="legend-dot finger-4"></span> बायां तर्जनी (Index L)</span>
          <span class="legend-item"><span class="legend-dot finger-5"></span> दायां तर्जनी (Index R)</span>
          <span class="legend-item"><span class="legend-dot finger-6"></span> दायां मध्यमा (Middle R)</span>
          <span class="legend-item"><span class="legend-dot finger-7"></span> दायां अनामिका (Ring R)</span>
          <span class="legend-item"><span class="legend-dot finger-8"></span> दायां कनिष्ठा (Pinky R)</span>
        </div>

        ${this.currentLayout === 'krutidev' ? `
          <div class="alt-codes-container">
            <div class="alt-codes-header">
              <h4 style="margin:0 0 4px 0; color:var(--text-main); font-size:1rem;">📋 कृति देव 010 महत्वपूर्ण ऑल्ट कोड्स (Kruti Dev Special Alt Codes)</h4>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">संयुक्ताक्षरों को टाइप करने के लिए <code>Alt</code> दबाकर दाईं ओर के नंबर पैड से 4 अंक टाइप करें:</p>
            </div>
            <div class="alt-codes-grid">
              ${this.altCodes.map(item => `
                <div class="alt-code-card" onclick="stenoKeyboardMap.copyCode('${item.code}')" title="क्लिक करके कॉपी करें">
                  <span class="alt-char">${item.char}</span>
                  <div class="alt-info">
                    <span class="alt-code-badge">${item.code}</span>
                    <span class="alt-desc">${item.desc}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderModal() {
    let modal = document.getElementById('keyboardMapModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'keyboardMapModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content keyboard-modal-content" style="max-width: 960px; width: 95vw; padding: 20px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">⌨️</span>
              <div>
                <h3 style="margin:0; font-size:1.15rem; color:var(--text-main);">इंटरैक्टिव कीबोर्ड मानचित्र (Visual Keyboard Map)</h3>
                <p style="margin:0; font-size:0.75rem; color:var(--text-muted);">शुरुआती छात्रों के लिए त्वरित संदर्भ गाइड</p>
              </div>
            </div>
            <button class="modal-close-btn" onclick="stenoKeyboardMap.closeModal()" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">✕</button>
          </div>
          <div id="modalKeyboardContainer"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  renderModalKeyboard() {
    const modalContainer = document.getElementById('modalKeyboardContainer');
    if (!modalContainer) return;
    modalContainer.innerHTML = `
      <div class="v-keyboard-wrapper modal-version">
        <div class="v-keyboard-header" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div class="v-layout-pills" style="display:flex; gap:6px;">
            <button class="v-tab-btn ${this.currentLayout === 'krutidev' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('krutidev')">कृति देव 010</button>
            <button class="v-tab-btn ${this.currentLayout === 'remington' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('remington')">मंगल रेमिंगटन</button>
            <button class="v-tab-btn ${this.currentLayout === 'inscript' ? 'active' : ''}" onclick="stenoKeyboardMap.setLayout('inscript')">इनस्क्रिप्ट</button>
          </div>
          <button class="v-shift-toggle ${this.isShift ? 'active' : ''}" onclick="stenoKeyboardMap.toggleShift()">
            ⇧ Shift: ${this.isShift ? 'ON' : 'OFF'}
          </button>
        </div>
        <div class="v-keyboard-board">
          ${this.rows.map(row => `
            <div class="v-key-row">
              ${row.map(k => this.renderKeyHTML(k)).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  openModal() {
    this.renderModal();
    this.renderModalKeyboard();
    const modal = document.getElementById('keyboardMapModal');
    if (modal) modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('keyboardMapModal');
    if (modal) modal.classList.remove('active');
  }

  showKeyDetails(engKey, shiftKey, normalHindi, shiftHindi) {
    if (window.stenoApp) {
      stenoApp.showToast(`🔑 Key '${engKey.toUpperCase()}': सामान्य = [ ${normalHindi || '—'} ] • शिफ्ट = [ ${shiftHindi || '—'} ]`, 'info');
    }
  }

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      if (window.stenoApp) stenoApp.showToast(`📋 कोड कॉपी हुआ: ${code}`, 'success');
    }).catch(() => {
      if (window.stenoApp) stenoApp.showToast(`कोड: ${code}`, 'info');
    });
  }
}

window.stenoKeyboardMap = new StenoKeyboardMap();
