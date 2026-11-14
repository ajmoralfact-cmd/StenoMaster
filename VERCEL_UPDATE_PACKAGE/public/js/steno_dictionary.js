/**
 * StenoMaster AI Shorthand Dictionary & Mistakes Drill System
 * Provides Rishi Pranali standard outlines, stroke breakdowns, line positions, and mistakes notebook.
 */

class StenoDictionary {
  constructor() {
    // Curated high-frequency shorthand dictionary for Ramdhari Gupta & SSC exams (Rishi Pranali)
    this.coreDict = {
      "सभापति": {
        word: "सभापति",
        system: "ऋषि प्रणाली",
        position: "लाइन के ऊपर (First Place)",
        rule: "स का वृत्त + भ रेखा + प का आंकड़ा / त का आंकड़ा (संक्षिप्त रूप)",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 30,35 C 35,25 45,28 50,38 L 75,20 L 95,45 L 115,30" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="30" cy="35" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "स का वृत्त बनाकर भ को ऊपर से नीचे खींचें और प-त का लोप करें।"
      },
      "महोदय": {
        word: "महोदय",
        system: "ऋषि प्रणाली",
        position: "लाइन पर (Second Place)",
        rule: "म रेखा + ह का बड़ा वृत्त + य का हुक",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,50 C 45,50 55,42 65,42 C 75,42 80,50 90,50 C 100,50 110,40 120,40" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="50" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "म को लाइन पर रखें और ह का बड़ा वृत्त जोड़ते हुए अंत में य का हुक निकालें।"
      },
      "मंत्रालय": {
        word: "मंत्रालय",
        system: "ऋषि प्रणाली",
        position: "लाइन काटकर (Third Place)",
        rule: "म रेखा (दुगना) + ल + य का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="40" x2="140" y2="40" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 30,40 L 85,40 C 95,40 105,25 115,25 C 120,25 125,32 130,38" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="30" cy="40" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "तर/दर/ध्र के लिए 'म' व्यंजन को दुगना किया गया है, अंत में ल का हुक।"
      },
      "विधेयक": {
        word: "विधेयक",
        system: "ऋषि प्रणाली",
        position: "लाइन काटकर (Third Place)",
        rule: "व का आंकड़ा + ध रेखा + य + क",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="35" x2="140" y2="35" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,28 C 40,32 45,35 50,55 L 75,55 L 95,45 L 115,45" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="47" y1="45" x2="55" y2="45" stroke="#ef4444" stroke-width="2" />
        </svg>`,
        tip: "इ की मात्रा के कारण रेखा लाइन काटती है। ध को बीच से काटें।"
      },
      "समर्थन": {
        word: "समर्थन",
        system: "ऋषि प्रणाली",
        position: "लाइन पर (Second Place)",
        rule: "स का वृत्त + म + र का आंकड़ा + थ + न का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,50 C 42,42 50,42 60,50 L 85,30 L 105,50" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="50" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "स-म को लाइन पर बनाकर ऊपर की ओर थ और अंत में न का आंकड़ा घुमाएं।"
      },
      "दृष्टिकोण": {
        word: "दृष्टिकोण",
        system: "ऋषि प्रणाली",
        position: "लाइन काटकर (Third Place)",
        rule: "द में र का आंकड़ा + ष्ट (चांप) + क + ण का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="35" x2="140" y2="35" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,25 L 55,55 C 65,55 70,45 80,45 L 110,45 C 115,45 120,50 125,50" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="25" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "द-र को लाइन काटते हुए बनाएं, ष्ट का चाप लगाकर क और ण का आंकड़ा जोड़ें।"
      },
      "परिस्थिति": {
        word: "परिस्थिति",
        system: "ऋषि प्रणाली",
        position: "लाइन के ऊपर (First Place)",
        rule: "प में र का आंकड़ा + स का वृत्त + थ रेखा + त का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="55" x2="140" y2="55" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,20 L 55,40 C 65,40 70,30 80,30 L 100,45 L 115,35" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="20" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "परि- उपसर्ग के लिए प-र लाइन के ऊपर रखें, अंत में त का आंकड़ा लगाएं।"
      },
      "आत्मनिर्भर": {
        word: "आत्मनिर्भर",
        system: "ऋषि प्रणाली",
        position: "लाइन के ऊपर (First Place)",
        rule: "आत्म (संकेत चिह्न) + न रेखा + भ में र का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="55" x2="140" y2="55" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,30 C 40,25 45,25 50,30 L 80,30 L 105,50 L 125,35" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="30" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "आत्म के लिए त का संकेत ऊपर बनाकर न और भर को जोड़ें।"
      },
      "औद्योगिकीकरण": {
        word: "औद्योगिकीकरण",
        system: "ऋषि प्रणाली",
        position: "लाइन के ऊपर (First Place)",
        rule: "औ का स्वर + द रेखा + ग + करण प्रत्यय (क में र का आंकड़ा + न)",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="55" x2="140" y2="55" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,20 L 55,45 L 80,45 L 105,30 C 115,30 120,40 130,40" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="20" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "-करण प्रत्यय के लिए शब्द के अंत में क-र और न का आंकड़ा काट कर या सटाकर लगाया जाता है।"
      },
      "महत्वपूर्ण": {
        word: "महत्वपूर्ण",
        system: "ऋषि प्रणाली",
        position: "लाइन पर (Second Place)",
        rule: "म रेखा + ह का वृत्त + त का लोप + पूर्ण (प में र का आंकड़ा + न)",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,50 C 45,50 55,40 65,40 L 90,60 L 115,40" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="50" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "-पूर्ण प्रत्यय के लिए शब्द के अंत में प-र रेखा से काटा जाता है।"
      },
      "पर्यावरण": {
        word: "पर्यावरण",
        system: "ऋषि प्रणाली",
        position: "लाइन पर (Second Place)",
        rule: "प में र का आंकड़ा + य + व + रण (र में ण का आंकड़ा)",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 35,30 L 55,50 L 75,40 L 95,50 L 120,30" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="35" cy="30" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "प-र को लाइन पर रखते हुए य और व को धाराप्रवाह रूप से आगे बढ़ाएं।"
      },
      "योजना": {
        word: "योजना",
        system: "ऋषि प्रणाली",
        position: "लाइन पर (Second Place)",
        rule: "य का हुक + ज रेखा + न का आंकड़ा",
        svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
          <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
          <path d="M 40,35 C 45,35 50,40 55,45 L 80,65 L 105,50" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="40" cy="35" r="3.5" fill="#ef4444" />
        </svg>`,
        tip: "य-ज को लाइन पर बनाएं और अंत में न का आंकड़ा बाहर की ओर लगाएं।"
      }
    };
  }

  getOutline(rawWord) {
    if (!rawWord) return null;
    const clean = rawWord.trim().replace(/[.,!?;:"'()]/g, '');
    if (this.coreDict[clean]) {
      return this.coreDict[clean];
    }

    // Dynamic heuristic fallback for other words
    return {
      word: clean,
      system: "ऋषि प्रणाली (AI व्युत्पत्ति)",
      position: "स्वर के अनुसार (Line Placement by Vowel)",
      rule: `मानक ऋषि वर्णमाला के अनुसार: '${clean}' के व्यंजनों को क्रमानुसार जोड़ें।`,
      svg: `<svg viewBox="0 0 160 80" class="steno-stroke-svg">
        <line x1="20" y1="50" x2="140" y2="50" stroke="#94a3b8" stroke-dasharray="4" stroke-width="1.5" />
        <path d="M 35,45 C 50,30 70,60 90,40 L 120,40" fill="none" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="35" cy="45" r="3.5" fill="#ef4444" />
      </svg>`,
      tip: `प्रथम स्वर के स्थान के आधार पर आउटलाइन लाइन के ऊपर/पर/काटकर बनाएं।`
    };
  }

  showOutlineModal(word) {
    const data = this.getOutline(word);
    if (!data) return;

    let modal = document.getElementById('stenoOutlineModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'stenoOutlineModal';
      modal.className = 'steno-modal-overlay';
      modal.innerHTML = `
        <div class="steno-outline-modal-card">
          <div class="som-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">🖋️</span>
              <div>
                <h3 id="somWordTitle" style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-main);">शब्द</h3>
                <span id="somSystemBadge" class="badge" style="background:rgba(99,102,241,0.12); color:#4f46e5; font-size:0.75rem;">ऋषि प्रणाली</span>
              </div>
            </div>
            <button type="button" class="som-close-btn" onclick="stenoDictionary.closeOutlineModal()">✕</button>
          </div>

          <div class="som-body">
            <!-- Outline Display Box -->
            <div class="som-outline-box">
              <div class="som-stroke-view" id="somStrokeView">
                <!-- SVG rendered here -->
              </div>
              <div class="som-guide-line">
                <span class="som-pos-badge" id="somPositionBadge">लाइन पर</span>
                <span style="font-size:0.72rem; color:var(--text-muted);">(लाल बिंदु स्ट्रोक की शुरुआत दर्शाता है)</span>
              </div>
            </div>

            <!-- Stroke Rule & Tips -->
            <div class="som-info-card">
              <div class="som-info-row">
                <span class="som-label">📐 बनावट नियम:</span>
                <span class="som-val" id="somRuleText">नियम</span>
              </div>
              <div class="som-info-row">
                <span class="som-label">💡 स्पीड टिप:</span>
                <span class="som-val" id="somTipText">टिप</span>
              </div>
            </div>
          </div>

          <div class="som-footer">
            <button type="button" class="btn-secondary" onclick="stenoDictionary.saveSingleMistake(stenoDictionary.currentModalWord)" style="font-size:0.82rem; padding:8px 14px;">
              ⭐ मेरी डायरी में सहेजें
            </button>
            <button type="button" class="btn-primary" onclick="stenoDictionary.closeOutlineModal()" style="font-size:0.82rem; padding:8px 18px;">
              समझ गया ✓
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeOutlineModal();
      });
    }

    this.currentModalWord = data.word;
    document.getElementById('somWordTitle').textContent = data.word;
    document.getElementById('somSystemBadge').textContent = data.system;
    document.getElementById('somPositionBadge').textContent = `📍 ${data.position}`;
    document.getElementById('somRuleText').textContent = data.rule;
    document.getElementById('somTipText').textContent = data.tip;
    document.getElementById('somStrokeView').innerHTML = data.svg;

    modal.style.display = 'flex';
  }

  closeOutlineModal() {
    const modal = document.getElementById('stenoOutlineModal');
    if (modal) modal.style.display = 'none';
  }

  saveSingleMistake(word) {
    if (!word) return;
    const key = 'stenomaster_mistakes_bank';
    let bank = [];
    try {
      bank = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { bank = []; }

    if (!bank.includes(word)) {
      bank.unshift(word);
      localStorage.setItem(key, JSON.stringify(bank));
      if (window.stenoApp) stenoApp.showToast(`⭐ '${word}' आपकी गलतियों की डायरी में सहेज लिया गया!`, 'success');
    } else {
      if (window.stenoApp) stenoApp.showToast(`'${word}' पहले से आपकी डायरी में मौजूद है।`, 'info');
    }
  }

  saveAllMistakes(wordsList) {
    if (!wordsList || wordsList.length === 0) return;
    const key = 'stenomaster_mistakes_bank';
    let bank = [];
    try {
      bank = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { bank = []; }

    let addedCount = 0;
    wordsList.forEach(w => {
      const term = typeof w === 'object' ? w.word : w;
      if (term && !bank.includes(term)) {
        bank.unshift(term);
        addedCount++;
      }
    });

    localStorage.setItem(key, JSON.stringify(bank));
    if (window.stenoApp) {
      stenoApp.showToast(`⭐ ${addedCount} नए कठिन शब्द आपकी गलतियों की डायरी में जोड़ दिए गए!`, 'success');
    }
  }

  startMistakesDrill() {
    const key = 'stenomaster_mistakes_bank';
    let bank = [];
    try {
      bank = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { bank = []; }

    if (!bank || bank.length === 0) {
      if (window.stenoApp) stenoApp.showToast('आपकी गलतियों की डायरी अभी खाली है। टेस्ट देकर गलत शब्दों को सहेजें।', 'info');
      return;
    }

    // Launch a special typing drill with these words
    const drillText = bank.join(' ');
    sessionStorage.setItem('stenomaster_custom_drill_text', drillText);
    sessionStorage.setItem('stenomaster_custom_drill_title', '🎯 मेरी गलतियों का रिवीजन टेस्ट (Mistakes Drill)');
    
    if (window.stenoApp) {
      stenoApp.showToast(`⚡ ${bank.length} शब्दों का रिवीजन टेस्ट लोड हो रहा है...`, 'info');
    }

    setTimeout(() => {
      window.location.href = '/practice.html?custom_drill=1';
    }, 600);
  }
}

// Global instance
window.stenoDictionary = new StenoDictionary();
