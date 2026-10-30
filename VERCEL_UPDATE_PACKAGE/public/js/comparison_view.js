/**
 * Comparison View & Error Diagnostics Renderer for StenoMaster
 * Renders:
 * - Dynamic aligned token sequence with color coding
 * - Click-to-inspect popover modal
 * - Interactive and filterable error list table
 * - Diagnostic weak-area recommendations
 * - Grammar & style suggestions
 */
// Shield Root Hindi Shorthand Content from Chrome / Browser Auto-Translation
if (!customElements.get('hindi-root')) {
  class HindiRootElement extends HTMLElement {
    static get observedAttributes() { return ['text']; }
    constructor() {
      super();
      this._shadow = null;
    }
    connectedCallback() {
      this._render();
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (name === 'text' && oldVal !== newVal) {
        this._render();
      }
    }
    get text() {
      return this.getAttribute('text') || '';
    }
    set text(val) {
      this.setAttribute('text', val || '');
    }
    _render() {
      let rawText = this.getAttribute('text');
      if (rawText === null || rawText === undefined) {
        rawText = this.textContent || '';
      }
      this.textContent = '';
      if (!this._shadow) {
        try {
          this._shadow = this.attachShadow({ mode: 'closed' });
        } catch (e) {
          this._shadow = this.shadowRoot;
        }
      }
      const safeText = String(rawText || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      const content = `
        <style>
          :host { display: inline !important; font-family: inherit; font-size: inherit; font-weight: inherit; color: inherit; line-height: inherit; }
          .steno-hindi-inner { font-family: inherit; font-size: inherit; font-weight: inherit; color: inherit; line-height: inherit; }
        </style>
        <span class="steno-hindi-inner notranslate skiptranslate" translate="no" lang="hi">${safeText}</span>
      `;
      if (this._shadow) {
        this._shadow.innerHTML = content;
      } else {
        this.innerHTML = content;
      }
    }
  }
  customElements.define('hindi-root', HindiRootElement);
}

class StenoComparisonView {
  constructor() {
    this.currentReport = null;
    this.activeFilter = 'all';
    this.popoverEl = null;
    this.initPopover();
  }

  initPopover() {
    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'token-popover notranslate';
    this.popoverEl.setAttribute('translate', 'no');
    document.body.appendChild(this.popoverEl);

    document.addEventListener('click', (e) => {
      if (!this.popoverEl.contains(e.target) && !e.target.classList.contains('eval-token')) {
        this.popoverEl.style.display = 'none';
      }
    });
  }

  renderExamQualificationCard(report) {
    const es = report.exam_summary || {};
    const rule = es.active_rule || report.exam_rule || 'ssc_steno';
    const m = report.metrics || {};
    const ec = report.error_counts || {};

    if (rule === 'upsssc') {
      const u = es.upsssc || {};
      const isQual = !!u.is_qualified;
      const speedOk = !!u.speed_qualified;
      const errOk = !!u.mistake_qualified;
      const achievedWpm = u.achieved_wpm ?? m.net_wpm ?? 0;
      const reqWpm = u.required_wpm ?? (report.language === 'hindi' ? 25 : 30);
      const achievedErr = u.achieved_mistake_percent ?? m.mistake_percent ?? 0;
      const maxErr = u.max_mistake_percent ?? 5.0;

      const upssscVerdictHtml = isQual 
        ? `<div class="exam-verdict-banner banner-pass">🎉 UPSSSC सफल (QUALIFIED) — गति (${achievedWpm} WPM) व त्रुटियां (${achievedErr}%) दोनों आयोग के मानक अनुसार उत्तीर्ण!</div>`
        : `<div class="exam-verdict-banner banner-fail">❌ UPSSSC असफल (NOT QUALIFIED) — ${u.status_reason || 'गति या त्रुटि मानक पूर्ण नहीं हुए।'}</div>`;

      return `
        <div class="chart-card" style="border: 2px solid ${isQual ? '#10b981' : '#ef4444'}; background: ${isQual ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)'}; margin-bottom: 24px; padding: 22px; border-radius: var(--radius-lg);">
          ${upssscVerdictHtml}
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
            <div>
              <span class="badge" style="background:#7c3aed; color:#fff; font-size:0.8rem; font-weight:700; padding:4px 10px;">🏛️ UPSSSC SKILL TEST</span>
              <h3 style="font-size:1.25rem; font-weight:800; margin-top:6px; color:var(--text-primary);">
                उ.प्र. अधीनस्थ सेवा चयन आयोग (UPSSSC) मूल्यांकन रिपोर्ट
              </h3>
            </div>
            <div style="font-size:1.15rem; font-weight:800; padding:8px 18px; border-radius:30px; background:${isQual ? '#d1fae5' : '#fee2e2'}; color:${isQual ? '#065f46' : '#991b1b'}; display:flex; align-items:center; gap:8px;">
              <span>${isQual ? '🎉' : '❌'}</span>
              <span>${isQual ? 'सफल (QUALIFIED)' : 'असफल (NOT QUALIFIED)'}</span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:16px;">
            <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:14px; border-radius:var(--radius-md);">
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">1. गति परीक्षण (Speed Check)</div>
              <div style="font-size:1.2rem; font-weight:800; color:${speedOk ? '#10b981' : '#ef4444'};">
                ${achievedWpm} WPM <span style="font-size:0.82rem; font-weight:normal; color:var(--text-secondary);">(न्यूनतम: ${reqWpm} WPM)</span>
              </div>
              <div style="font-size:0.75rem; margin-top:4px; font-weight:700; color:${speedOk ? '#10b981' : '#ef4444'};">
                ${speedOk ? '✓ गति मानक उत्तीर्ण' : '✗ गति न्यूनतम से कम'}
              </div>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:14px; border-radius:var(--radius-md);">
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">2. त्रुटि सीमा (Permissible Error)</div>
              <div style="font-size:1.2rem; font-weight:800; color:${errOk ? '#10b981' : '#ef4444'};">
                ${achievedErr}% <span style="font-size:0.82rem; font-weight:normal; color:var(--text-secondary);">(अधिकतम: ${maxErr}%)</span>
              </div>
              <div style="font-size:0.75rem; margin-top:4px; font-weight:700; color:${errOk ? '#10b981' : '#ef4444'};">
                ${errOk ? '✓ त्रुटियां सीमा के भीतर' : '✗ त्रुटियां अनुमन्य सीमा से अधिक'}
              </div>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:14px; border-radius:var(--radius-md);">
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">3. कुल दंड गलतियां (Mistakes)</div>
              <div style="font-size:1.2rem; font-weight:800; color:var(--text-primary);">
                ${es.total_equivalent_mistakes || 0}
              </div>
              <div style="font-size:0.75rem; margin-top:4px; color:var(--text-secondary);">
                पूर्ण: ${es.full_mistakes || 0} (1x) • आधा: ${es.half_mistakes || 0} (0.5x)
              </div>
            </div>
          </div>

          <div style="background:var(--bg-subtle); padding:12px 16px; border-radius:var(--radius-md); font-size:0.88rem; color:var(--text-secondary); border-left:4px solid ${isQual ? '#10b981' : '#ef4444'};">
            <strong>आयोग टिप्पणी:</strong> ${u.status_reason || 'UPSSSC परीक्षा नियमों के अनुसार परिणाम निर्धारित किया गया।'}
          </div>
        </div>
      `;
    }

    // Default: SSC Stenographer Grade C & D Mode
    const s = es.ssc || {};
    const cUr = s.grade_c_ur || { cutoff: 5.0, is_qualified: false };
    const cRes = s.grade_c_res || { cutoff: 7.0, is_qualified: false };
    const dUr = s.grade_d_ur || { cutoff: 7.0, is_qualified: false };
    const dRes = s.grade_d_res || { cutoff: 10.0, is_qualified: false };
    const mistakePct = es.mistake_percent ?? m.mistake_percent ?? 0;

    let sscVerdictHtml = '';
    if (mistakePct <= 5.0) {
      sscVerdictHtml = `<div class="exam-verdict-banner banner-pass">🏆 SSC योग्य (QUALIFIED) — ग्रेड 'C' (100 WPM) एवं ग्रेड 'D' (80 WPM) दोनों में सफल! (त्रुटि दर: ${mistakePct}%)</div>`;
    } else if (mistakePct <= 7.0) {
      sscVerdictHtml = `<div class="exam-verdict-banner banner-pass">✅ SSC योग्य (QUALIFIED) — ग्रेड 'D' सामान्य (UR) एवं ग्रेड 'C' आरक्षित वर्ग में सफल! (त्रुटि दर: ${mistakePct}%)</div>`;
    } else if (mistakePct <= 10.0) {
      sscVerdictHtml = `<div class="exam-verdict-banner banner-warn">⚠️ SSC योग्य (QUALIFIED) — ग्रेड 'D' आरक्षित वर्ग (OBC/SC/ST/EWS) में सफल! (त्रुटि दर: ${mistakePct}%)</div>`;
    } else {
      sscVerdictHtml = `<div class="exam-verdict-banner banner-fail">❌ SSC अयोग्य (NOT QUALIFIED) — त्रुटि दर 10% से अधिक (${mistakePct}%) होने के कारण अयोग्य।</div>`;
    }

    return `
      <div class="chart-card" style="border: 2px solid #0284c7; background: rgba(2, 132, 199, 0.04); margin-bottom: 24px; padding: 22px; border-radius: var(--radius-lg);">
        ${sscVerdictHtml}
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div>
            <span class="badge" style="background:#0284c7; color:#fff; font-size:0.8rem; font-weight:700; padding:4px 10px;">🎯 SSC STENOGRAPHER</span>
            <h3 style="font-size:1.25rem; font-weight:800; margin-top:6px; color:var(--text-primary);">
              कर्मचारी चयन आयोग (SSC) स्किल टेस्ट मूल्यांकन रिपोर्ट
            </h3>
          </div>
          <div style="font-size:0.88rem; color:var(--text-secondary); background:var(--bg-card); padding:6px 14px; border-radius:20px; border:1px solid var(--border-subtle);">
            आधिकारिक त्रुटि दर: <strong style="color:${mistakePct <= 7 ? '#10b981' : '#ef4444'}; font-size:1.1rem;">${mistakePct}%</strong>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-bottom:16px;">
          <!-- Grade C Card -->
          <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:16px; border-radius:var(--radius-md); border-top:3px solid #0284c7;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:1rem;">Stenographer Grade 'C' (100 WPM)</span>
              <span class="badge" style="background:${cUr.is_qualified ? '#d1fae5' : (cRes.is_qualified ? '#fef3c7' : '#fee2e2')}; color:${cUr.is_qualified ? '#065f46' : (cRes.is_qualified ? '#92400e' : '#991b1b')}; font-weight:700;">
                ${cUr.is_qualified ? '✅ QUALIFIED' : (cRes.is_qualified ? '⚠️ RESERVED ONLY' : '❌ DISQUALIFIED')}
              </span>
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.5;">
              • सामान्य (UR) कटऑफ (≤ ${cUr.cutoff}%): <strong style="color:${cUr.is_qualified ? '#10b981' : '#ef4444'}">${cUr.is_qualified ? 'योग्य (Pass)' : 'अयोग्य (Fail)'}</strong><br>
              • आरक्षित (OBC/SC/ST/EWS ≤ ${cRes.cutoff}%): <strong style="color:${cRes.is_qualified ? '#10b981' : '#ef4444'}">${cRes.is_qualified ? 'योग्य (Pass)' : 'अयोग्य (Fail)'}</strong>
            </div>
          </div>

          <!-- Grade D Card -->
          <div style="background:var(--bg-card); border:1px solid var(--border-subtle); padding:16px; border-radius:var(--radius-md); border-top:3px solid #059669;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:1rem;">Stenographer Grade 'D' (80 WPM)</span>
              <span class="badge" style="background:${dUr.is_qualified ? '#d1fae5' : (dRes.is_qualified ? '#fef3c7' : '#fee2e2')}; color:${dUr.is_qualified ? '#065f46' : (dRes.is_qualified ? '#92400e' : '#991b1b')}; font-weight:700;">
                ${dUr.is_qualified ? '✅ QUALIFIED' : (dRes.is_qualified ? '⚠️ RESERVED ONLY' : '❌ DISQUALIFIED')}
              </span>
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.5;">
              • सामान्य (UR) कटऑफ (≤ ${dUr.cutoff}%): <strong style="color:${dUr.is_qualified ? '#10b981' : '#ef4444'}">${dUr.is_qualified ? 'योग्य (Pass)' : 'अयोग्य (Fail)'}</strong><br>
              • आरक्षित (OBC/SC/ST/EWS ≤ ${dRes.cutoff}%): <strong style="color:${dRes.is_qualified ? '#10b981' : '#ef4444'}">${dRes.is_qualified ? 'योग्य (Pass)' : 'अयोग्य (Fail)'}</strong>
            </div>
          </div>
        </div>

        <div style="background:var(--bg-subtle); padding:12px 16px; border-radius:var(--radius-md); font-size:0.84rem; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <strong>SSC मिस्टेक गणना:</strong> पूर्ण गलतियां (छूटे + गलत + अतिरिक्त): <strong>${es.full_mistakes || 0} × 1.0</strong> | आधी गलतियां (मात्रा + वर्तनी + विराम): <strong>${es.half_mistakes || 0} × 0.5</strong>
          </div>
          <div>
            समतुल्य गलतियां: <strong style="color:var(--accent-red); font-size:0.95rem;">${es.total_equivalent_mistakes || 0}</strong> / ${es.total_official_words || m.total_words_official || 0} शब्द
          </div>
        </div>
      </div>
    `;
  }

  renderOfficialMistakeFormulaCard(report) {
    const es = report.exam_summary || {};
    const ec = report.error_counts || {};
    const m = report.metrics || {};

    const missingCount = ec.missing || 0;
    const extraCount = ec.extra || 0;
    const wrongCount = ec.wrong || 0;
    const matraCount = ec.matra || 0;
    const spellingCount = (ec.spelling || 0) + (ec.character || 0);
    const punctCount = ec.punctuation || 0;

    const fullMistakes = es.full_mistakes !== undefined ? es.full_mistakes : (missingCount + extraCount + wrongCount);
    const halfMistakes = es.half_mistakes !== undefined ? es.half_mistakes : (matraCount + spellingCount + punctCount);
    const totalEq = es.total_equivalent_mistakes !== undefined ? es.total_equivalent_mistakes : ((fullMistakes * 1.0) + (halfMistakes * 0.5)).toFixed(1);
    const totalWords = m.total_words_official || es.total_official_words || 100;
    const mistakePct = es.mistake_percent !== undefined ? es.mistake_percent : ((totalEq / totalWords) * 100).toFixed(2);

    return `
      <div class="mistake-formula-card">
        <div class="formula-header">
          <div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <h3 class="formula-title" style="margin:0;">⚖️ आधिकारिक त्रुटि फॉर्मूला (SSC / UPSSSC Official Marking Scheme)</h3>
              ${(() => {
                const pm = ((es.punctuation_mode || report.punctuation_mode || 'half')).toLowerCase();
                if (pm === 'off') return '<span style="background:#d1fae5; color:#065f46; font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:20px; border:1px solid #a7f3d0;">विराम चिह्न: 🚫 छूट मान्य (0 कटौती)</span>';
                if (pm === 'full') return '<span style="background:#fee2e2; color:#991b1b; font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:20px; border:1px solid #fecaca;">विराम चिह्न: 🔴 पूर्ण गलती (1.0 कटौती)</span>';
                return '<span style="background:#fef3c7; color:#92400e; font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:20px; border:1px solid #fde68a;">विराम चिह्न: 🟡 आधी गलती (0.5 कटौती - SSC मानक)</span>';
              })()}
            </div>
            <p class="formula-subtitle" style="margin-top:6px;">आयोग के आधिकारिक नियमों के अनुसार पूर्ण एवं आधी गलतियों का पारदर्शी पृथक्करण:</p>
          </div>
          <div class="formula-final-badge">
            कुल समतुल्य गलतियां: <strong style="color:var(--accent-red); font-size:1.15rem;">${totalEq}</strong> (${mistakePct}%)
          </div>
        </div>

        <div class="formula-boxes-grid">
          <!-- Full Mistakes Box -->
          <div class="formula-box box-full-mistake">
            <div class="f-box-top">
              <span class="f-badge f-badge-full">🔴 पूर्ण गलतियां (FULL MISTAKES)</span>
              <span class="f-deduction">कटौती: <strong>1.0 अंक</strong> / शब्द</span>
            </div>
            <div class="f-total-count">${fullMistakes} <span class="f-calc">× 1.0 = <strong>${(fullMistakes * 1.0).toFixed(1)}</strong> गलती</span></div>
            <div class="f-breakdown-list">
              <div class="f-item"><span>⚠ छूटे हुए शब्द (Omissions):</span> <strong>${missingCount}</strong></div>
              <div class="f-item"><span>➕ अतिरिक्त शब्द (Additions):</span> <strong>${extraCount}</strong></div>
              <div class="f-item"><span>❌ गलत/बदले हुए शब्द (Substitutions):</span> <strong>${wrongCount}</strong></div>
              ${((es.punctuation_mode || report.punctuation_mode) === 'full') ? `<div class="f-item" style="color:var(--accent-red); font-weight:700;"><span>। विराम चिह्न (Full Penalty):</span> <strong>${punctCount}</strong> (× 1.0)</div>` : ''}
            </div>
          </div>

          <!-- Half Mistakes Box -->
          <div class="formula-box box-half-mistake">
            <div class="f-box-top">
              <span class="f-badge f-badge-half">🟡 आधी गलतियां (HALF MISTAKES)</span>
              <span class="f-deduction">कटौती: <strong>0.5 अंक</strong> / शब्द</span>
            </div>
            <div class="f-total-count">${halfMistakes} <span class="f-calc">× 0.5 = <strong>${(halfMistakes * 0.5).toFixed(1)}</strong> गलती</span></div>
            <div class="f-breakdown-list">
              <div class="f-item"><span>✎ मात्रा अशुद्धि (Matra Errors):</span> <strong>${matraCount}</strong></div>
              <div class="f-item"><span>🔤 वर्तनी, वर्ण व हलन्त दोष (Spelling/Halant):</span> <strong>${spellingCount}</strong></div>
              ${(() => {
                const pm = ((es.punctuation_mode || report.punctuation_mode || 'half')).toLowerCase();
                if (pm === 'off') return `<div class="f-item" style="opacity:0.75;"><span>। विराम चिह्न अशुद्धि (Punctuation):</span> <strong>${punctCount}</strong> (छूट मान्य • 0 अंक)</div>`;
                if (pm === 'full') return `<div class="f-item" style="opacity:0.6;"><span>। विराम चिह्न अशुद्धि (Punctuation):</span> <strong>0</strong> (पूर्ण गलती में दर्ज)</div>`;
                return `<div class="f-item"><span>। विराम चिह्न अशुद्धि (Punctuation):</span> <strong>${punctCount}</strong></div>`;
              })()}
            </div>
          </div>
        </div>

        <!-- Formula Equation Bar -->
        <div class="formula-equation-bar">
          <div>
            <strong>आधिकारिक फॉर्मूला:</strong> 
            <span class="eq-chip">(${fullMistakes} Full × 1.0)</span> + 
            <span class="eq-chip">(${halfMistakes} Half × 0.5)</span> = 
            <span class="eq-chip eq-result">${totalEq} कुल दंड गलतियां</span>
            <span class="eq-divider">|</span>
            <span>आधिकारिक त्रुटि प्रतिशत = (${totalEq} ÷ ${totalWords}) × 100 = <strong style="color:var(--accent-red); font-size:1.05rem;">${mistakePct}%</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  renderKeystrokeEfficiencyCard(report) {
    const totalKeys = report.total_keystrokes || (report.student_text ? report.student_text.length : 0);
    const backspaces = report.backspace_count || 0;
    const tabSwitches = report.tab_switches || 0;
    const efficiency = totalKeys > 0 ? Math.max(0, Math.min(100, Math.round(((totalKeys - (backspaces * 2)) / totalKeys) * 100))) : 100;
    const paceSamples = report.pace_history || [];

    // Sparkline SVG / Pace Graph
    let paceGraphHtml = '';
    if (paceSamples.length >= 2) {
      const maxWpm = Math.max(...paceSamples.map(p => p.wpm), 40);
      const minWpm = Math.min(...paceSamples.map(p => p.wpm), 0);
      const range = Math.max(10, maxWpm - minWpm);
      const width = 360;
      const height = 50;

      const points = paceSamples.map((p, idx) => {
        const x = Math.round((idx / (paceSamples.length - 1)) * width);
        const y = Math.round(height - (((p.wpm - minWpm) / range) * (height - 10)) - 5);
        return `${x},${y}`;
      }).join(' ');

      paceGraphHtml = `
        <div style="margin-top:12px; background:var(--bg-subtle); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.78rem; color:var(--text-secondary);">
            <span>📈 गति स्थिरता ग्राफ़ (WPM vs Time Consistency)</span>
            <span>उच्चतम: <strong>${maxWpm} WPM</strong></span>
          </div>
          <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:45px; overflow:visible;">
            <polyline fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
          </svg>
        </div>
      `;
    }

    return `
      <div class="chart-card" style="margin-bottom:20px; padding:16px 20px; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-card);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.15rem;">🎯</span>
            <strong style="font-size:0.95rem; color:var(--text-primary);">कीस्ट्रोक क्षमता व निरंतरता (Keystroke & Input Efficiency)</strong>
          </div>
          <span class="badge" style="background:${efficiency >= 85 ? '#d1fae5' : (efficiency >= 70 ? '#fef3c7' : '#fee2e2')}; color:${efficiency >= 85 ? '#065f46' : (efficiency >= 70 ? '#92400e' : '#991b1b')}; font-weight:700;">
            ${efficiency >= 85 ? '✓ उत्कृष्ट गति नियंत्रण' : (efficiency >= 70 ? '⚠️ औसत सुधार संभव' : '❌ अत्यधिक बैकस्पेस')}
          </span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
          <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--text-muted);">कुल कीस्ट्रोक्स (Total Keys)</div>
            <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${totalKeys}</div>
          </div>
          <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--text-muted);">बैकस्पेस उपयोग (Backspaces)</div>
            <div style="font-size:1.15rem; font-weight:800; color:${backspaces > 20 ? 'var(--accent-red)' : '#10b981'}; margin-top:2px;">
              ${backspaces} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">बार</span>
            </div>
          </div>
          <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--text-muted);">इनपुट क्षमता (Key Efficiency)</div>
            <div style="font-size:1.15rem; font-weight:800; color:${efficiency >= 80 ? '#10b981' : 'var(--accent-amber)'}; margin-top:2px;">
              ${efficiency}%
            </div>
          </div>
          <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--text-muted);">विंडो विचलन (Tab Switches)</div>
            <div style="font-size:1.15rem; font-weight:800; color:${tabSwitches === 0 ? '#10b981' : 'var(--accent-red)'}; margin-top:2px;">
              ${tabSwitches} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">${tabSwitches === 0 ? '✓ स्वच्छ' : 'चेतावनी'}</span>
            </div>
          </div>
        </div>

        ${paceGraphHtml}
      </div>
    `;
  }

  generateWeakWordsFromTokens(report) {
    const tokens = report.aligned_tokens || [];
    const list = [];
    const seen = new Set();

    // Priority 1: Words the student actually typed but got wrong (substitutions, matra, spelling)
    for (const t of tokens) {
      if (t.student && (t.status === 'wrong' || t.error_type === 'matra' || t.error_type === 'spelling' || t.error_type === 'character')) {
        const off = (t.official || '').trim().replace(/[.,!?।]/g, '');
        const cleanOff = off.replace(/[^\u0900-\u097F]/g, '');
        if (cleanOff.length >= 2 && !seen.has(cleanOff)) {
          seen.add(cleanOff);
          let reason = t.detail || 'शब्द टंकण अशुद्धि';
          if (t.error_type === 'matra') reason = 'मात्रा अशुद्धि';
          else if (t.error_type === 'spelling') reason = 'वर्तनी दोष';
          else if (t.status === 'wrong') reason = 'गलत शब्द प्रतिस्थापन';

          list.push({
            word: cleanOff,
            student_word: t.student,
            error_type: t.error_type || t.status,
            reason: reason,
            practice_tip: `‘${cleanOff}’ की स्टेनो आउटलाइन 5 बार बनाएं।`
          });
          if (list.length >= 6) break;
        }
      }
    }

    // Priority 2: If list is still small (< 6), add up to 3 missed words
    if (list.length < 6) {
      for (const t of tokens) {
        if (t.status === 'missing' && !t.student) {
          const off = (t.official || '').trim().replace(/[.,!?।]/g, '');
          const cleanOff = off.replace(/[^\u0900-\u097F]/g, '');
          if (cleanOff.length >= 3 && !seen.has(cleanOff)) {
            seen.add(cleanOff);
            list.push({
              word: cleanOff,
              student_word: '— (छूट गया)',
              error_type: 'missing',
              reason: 'डिक्टेशन में छूटा शब्द',
              practice_tip: `‘${cleanOff}’ की स्टेनो आउटलाइन 5 बार बनाएं।`
            });
            if (list.length >= 6) break;
          }
        }
      }
    }

    return list;
  }

  renderPersonalWeakWordsBank(report) {
    const rawWords = (report.weak_words_bank && report.weak_words_bank.length > 0)
      ? report.weak_words_bank
      : this.generateWeakWordsFromTokens(report);

    // Limit to top 6 most important words so it never overwhelms the screen
    const words = rawWords.slice(0, 6);
    this.currentWeakWords = words;

    if (words.length === 0) {
      return '';
    }

    return `
      <div class="weak-words-bank-card">
        <div class="ww-header">
          <div>
            <span class="ww-tag">🎯 स्टेनो अभ्यास फोकस</span>
            <h3 class="ww-title">📝 कमजोर शब्दों की स्टेनो आउटलाइन व गलतियों की डायरी</h3>
            <p class="ww-subtitle">इस अभ्यास में इन मुख्य शब्दों में त्रुटि हुई—आउटलाइन देखने के लिए बटन दबाएं या अपनी डायरी में सहेजें:</p>
          </div>
          <div class="ww-actions" style="display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="btn-save-mistakes-bank" onclick="stenoComparisonView.saveToMistakesBank()">
              ⭐ डायरी में सहेजें
            </button>
            <button type="button" class="btn-practice-mistakes" onclick="stenoComparisonView.startMistakesDrill()">
              ⚡ इन गलतियों का टेस्ट दें
            </button>
            <button type="button" class="btn-copy-weak-words" onclick="stenoComparisonView.copyWeakWords()">
              📋 कॉपी करें
            </button>
          </div>
        </div>

        <div class="weak-words-grid">
          ${words.map(w => `
            <div class="weak-word-card">
              <div class="ww-card-top">
                <span class="ww-target-word">${w.word}</span>
                <span class="ww-error-chip">${w.reason}</span>
              </div>
              <div class="ww-card-body">
                <div class="ww-input-row">
                  <span>आपने लिखा:</span> <span class="ww-student-val">${w.student_word}</span>
                </div>
                <div class="ww-tip-row">
                  <span>💡</span> <span>${w.practice_tip}</span>
                </div>
                <div style="margin-top:8px;">
                  <button type="button" class="btn-view-steno-outline" onclick="stenoComparisonView.openOutline('${this.escapeHtml(w.word)}')">
                    🖋️ आउटलाइन देखें
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  openOutline(word) {
    if (window.stenoDictionary) {
      stenoDictionary.showOutlineModal(word);
    }
  }

  saveToMistakesBank() {
    if (window.stenoDictionary) {
      stenoDictionary.saveAllMistakes(this.currentWeakWords || []);
    }
  }

  startMistakesDrill() {
    if (window.stenoDictionary) {
      stenoDictionary.startMistakesDrill();
    }
  }

  copyWeakWords() {
    const list = this.currentWeakWords || [];
    if (!list || list.length === 0) {
      if (window.stenoApp) stenoApp.showToast('कॉपी करने के लिए कोई कमजोर शब्द नहीं हैं।', 'info');
      return;
    }
    const text = list.map((w, i) => `${i + 1}. ${w.word} (कारण: ${w.reason})`).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.stenoApp) stenoApp.showToast(`📋 ${list.length} कठिन शब्द क्लिपबोर्ड पर कॉपी हो गए! अपनी नोटबुक में अभ्यास करें।`, 'success');
      }).catch(() => {
        if (window.stenoApp) stenoApp.showToast('कॉपी करने में समस्या हुई।', 'error');
      });
    } else {
      if (window.stenoApp) stenoApp.showToast('क्लिपबोर्ड एक्सेस उपलब्ध नहीं है।', 'info');
    }
  }

  /* ============================================================
     STENOSHALA-STYLE HERO CARD
     ============================================================ */
  renderHeroCard(report) {
    const es = report.exam_summary || {};
    const m = report.metrics || {};
    const rule = (es.active_rule || report.exam_rule || 'ssc_steno');
    const mistakePct = parseFloat(es.mistake_percent ?? m.mistake_percent ?? 0);

    // Determine pass/fail status
    let heroClass = 'hero-fail';
    let verdictIcon = '&#10060;';
    let verdictText = 'अयोग्य (NOT QUALIFIED)';
    let verdictSub = 'त्रुटि दर 10% से अधिक — अभ्यास जारी रखें!';
    let examLabel = 'SSC STENOGRAPHER';

    if (rule === 'upsssc') {
      const u = es.upsssc || {};
      examLabel = 'UPSSSC SKILL TEST';
      if (u.is_qualified) {
        heroClass = 'hero-pass';
        verdictIcon = '&#127942;';
        verdictText = 'सफल (QUALIFIED)';
        verdictSub = `गति ${u.achieved_wpm || m.net_wpm || 0} WPM &#38; त्रुटियां ${mistakePct}% — मानक उत्तीर्ण!`;
      } else if ((u.speed_qualified || false) || mistakePct <= 10) {
        heroClass = 'hero-warn';
        verdictIcon = '&#9888;';
        verdictText = 'आंशिक (PARTIAL)';
        verdictSub = u.status_reason || 'गति या त्रुटि सीमा पूर्ण नहीं हुई।';
      } else {
        verdictSub = u.status_reason || 'गति या त्रुटि मानक पूर्ण नहीं हुए।';
      }
    } else {
      // SSC
      if (mistakePct <= 5.0) {
        heroClass = 'hero-pass'; verdictIcon = '&#127942;';
        verdictText = 'योग्य (QUALIFIED)';
        verdictSub = 'Grade C &#38; D दोनों में सफल!';
      } else if (mistakePct <= 7.0) {
        heroClass = 'hero-pass'; verdictIcon = '&#9989;';
        verdictText = 'योग्य — Grade D + C (Reserved)';
        verdictSub = 'ग्रेड D (UR) &#38; ग्रेड C (Reserved) उत्तीर्ण।';
      } else if (mistakePct <= 10.0) {
        heroClass = 'hero-warn'; verdictIcon = '&#9888;';
        verdictText = 'आंशिक — Grade D (Reserved)';
        verdictSub = 'केवल ग्रेड D आरक्षित वर्ग में योग्य।';
      } else {
        verdictSub = `त्रुटि दर ${mistakePct}% — 10% से कम करना आवश्यक है।`;
      }
    }

    // Build conic-gradient ring for mistake %
    const ringPct = Math.min(100, Math.max(0, mistakePct));
    const passColor = heroClass === 'hero-pass' ? '#34d399' : (heroClass === 'hero-warn' ? '#fbbf24' : '#f87171');
    const failColor = 'rgba(255,255,255,0.12)';
    const ringDeg = Math.round((ringPct / 100) * 360);
    const ringGrad = `conic-gradient(${passColor} 0deg, ${passColor} ${ringDeg}deg, ${failColor} ${ringDeg}deg 360deg)`;

    return `
      <div class="sm-hero-card ${heroClass}">
        <div class="sm-hero-ring-wrap">
          <div class="sm-status-ring" style="background:${ringGrad};">
            <div class="sm-status-ring-inner">
              <div class="sm-ring-pct">${mistakePct}%</div>
              <div class="sm-ring-label">त्रुटि दर</div>
            </div>
          </div>
          <div class="sm-hero-verdict">${verdictIcon} ${heroClass === 'hero-pass' ? 'PASS' : (heroClass === 'hero-warn' ? 'PARTIAL' : 'FAIL')}</div>
        </div>
        <div class="sm-hero-body">
          <div class="sm-hero-exam-badge">&#127919; ${examLabel}</div>
          <h2 class="sm-hero-title">${verdictText}</h2>
          <p class="sm-hero-subtitle">${verdictSub}</p>
          <div class="sm-hero-actions">
            <button class="sm-btn-retry" onclick="stenoApp.retryPractice()">&#128260; पुनः अभ्यास करें</button>
            <button class="sm-btn-retry" onclick="stenoApp.goBack()">&#8592; वापस जाएं</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     PREMIUM METRICS GRID
     ============================================================ */
  renderPremiumMetricsGrid(report) {
    const m = report.metrics || {};
    const ec = report.error_counts || {};
    const es = report.exam_summary || {};
    const fullM = es.full_mistakes !== undefined ? es.full_mistakes : (ec.wrong || 0) + (ec.missing || 0) + (ec.extra || 0);
    const halfM = es.half_mistakes !== undefined ? es.half_mistakes : (ec.matra || 0) + (ec.spelling || 0) + (ec.punctuation || 0);

    return `
      <div class="sm-metrics-grid">
        <div class="sm-stat-card sm-card-accent-blue">
          <div class="sm-stat-label">Net Speed (नेट गति)</div>
          <div class="sm-stat-value">${m.net_wpm || 0}<span class="sm-stat-unit">WPM</span></div>
          <div class="sm-stat-sub">Gross: ${m.gross_wpm || 0} WPM</div>
        </div>
        <div class="sm-stat-card sm-card-accent-emerald">
          <div class="sm-stat-label">Accuracy (सटीकता)</div>
          <div class="sm-stat-value">${m.accuracy || 0}<span class="sm-stat-unit">%</span></div>
          <div class="sm-stat-sub">Time: ${m.time_formatted || '00:00'}</div>
        </div>
        <div class="sm-stat-card sm-card-accent-rose">
          <div class="sm-stat-label">Full Mistakes (पूर्ण)</div>
          <div class="sm-stat-value" style="color:var(--accent-red)">${fullM}</div>
          <div class="sm-stat-sub">गलत + छूटे + अतिरिक्त</div>
        </div>
        <div class="sm-stat-card sm-card-accent-amber">
          <div class="sm-stat-label">Half Mistakes (आधी)</div>
          <div class="sm-stat-value" style="color:var(--accent-amber)">${halfM}</div>
          <div class="sm-stat-sub">मात्रा + वर्तनी + विराम</div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     MISTAKE BREAKDOWN BAR
     ============================================================ */
  renderBreakdownBar(report) {
    const ec = report.error_counts || {};
    const m = report.metrics || {};
    const totalWords = m.total_words_official || 100;
    const fullMistakes = (ec.wrong || 0) + (ec.missing || 0) + (ec.extra || 0);
    const halfMistakes = (ec.matra || 0) + (ec.spelling || 0) + (ec.character || 0);
    const punctMistakes = ec.punctuation || 0;
    const correct = Math.max(0, totalWords - fullMistakes - halfMistakes - punctMistakes);

    const total = fullMistakes + halfMistakes + punctMistakes + correct || 1;
    const fullPct  = Math.round((fullMistakes / total) * 100);
    const halfPct  = Math.round((halfMistakes / total) * 100);
    const punctPct = Math.round((punctMistakes / total) * 100);
    const corrPct  = Math.max(0, 100 - fullPct - halfPct - punctPct);

    return `
      <div class="sm-breakdown-card">
        <div class="sm-breakdown-title">त्रुटि वितरण (Error Distribution)</div>
        <div class="sm-breakdown-bar">
          <div class="sm-seg-full"    style="width:${fullPct}%"  title="Full Mistakes: ${fullMistakes}"></div>
          <div class="sm-seg-half"    style="width:${halfPct}%"  title="Half Mistakes: ${halfMistakes}"></div>
          <div class="sm-seg-punct"   style="width:${punctPct}%" title="Punctuation: ${punctMistakes}"></div>
          <div class="sm-seg-correct" style="width:${corrPct}%"  title="Correct: ${correct}"></div>
        </div>
        <div class="sm-breakdown-legend">
          <div class="sm-legend-item"><div class="sm-legend-dot sm-dot-full"></div> पूर्ण गलती — ${fullMistakes} (${fullPct}%)</div>
          <div class="sm-legend-item"><div class="sm-legend-dot sm-dot-half"></div> आधी गलती — ${halfMistakes} (${halfPct}%)</div>
          <div class="sm-legend-item"><div class="sm-legend-dot sm-dot-punct"></div> विराम चिह्न — ${punctMistakes} (${punctPct}%)</div>
          <div class="sm-legend-item"><div class="sm-legend-dot sm-dot-correct"></div> शुद्ध शब्द — ${correct} (${corrPct}%)</div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     TOKEN STREAM FILTER (Stenoshala-style tabs)
     ============================================================ */
  filterTokens(type, btnEl) {
    // Update active tab
    const tabBar = btnEl.closest('.sm-tab-bar');
    if (tabBar) {
      tabBar.querySelectorAll('.sm-comp-tab').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }

    const box = document.getElementById('tokenStreamBox');
    if (!box) return;
    const tokens = box.querySelectorAll('.eval-token');

    tokens.forEach(tok => {
      let show = true;
      if (type === 'mistakes') {
        show = tok.classList.contains('eval-token-wrong') || tok.classList.contains('eval-token-extra');
      } else if (type === 'missing') {
        show = tok.classList.contains('eval-token-missing');
      } else if (type === 'punct') {
        // punctuation tokens have data-error-type="punctuation"
        show = (tok.dataset.errorType === 'punctuation') || tok.classList.contains('eval-token-wrong');
      }
      // type === 'all' → show all
      tok.classList.toggle('sm-token-hide', !show);
    });
  }
  renderResult(report, container) {
    this.currentReport = report;
    const m = report.metrics || {};
    const ec = report.error_counts || {};
    const es = report.exam_summary || {};

    const html = `
      <!-- ========== STENOSHALA-STYLE HERO CARD ========== -->
      ${this.renderHeroCard(report)}

      <!-- ========== PREMIUM METRICS GRID ========== -->
      ${this.renderPremiumMetricsGrid(report)}

      <!-- ========== OFFICIAL MISTAKE FORMULA CARD ========== -->
      ${this.renderOfficialMistakeFormulaCard(report)}

      <!-- ========== MISTAKE BREAKDOWN BAR ========== -->
      ${this.renderBreakdownBar(report)}

      <!-- ========== KEYSTROKE EFFICIENCY CARD ========== -->
      ${this.renderKeystrokeEfficiencyCard(report)}

      <!-- ========== STENO NOTES CARD ========== -->
      ${this.renderStenoNotesSection(report)}

      <!-- ========== WORD-BY-WORD COMPARISON ========== -->
      <div class="comparison-section">
        <div class="sm-comp-header">
          <div>
            <div class="sm-comp-title">मूल आलेख बनाम आपका टंकण</div>
            <div class="sm-comp-subtitle">Word-by-Word Comparison — शब्द पर क्लिक करें विवरण देखने के लिए</div>
          </div>
          <div class="sm-tab-bar">
            <button class="sm-comp-tab active" onclick="stenoComparisonView.filterTokens('all', this)">सभी शब्द</button>
            <button class="sm-comp-tab tab-mistakes" onclick="stenoComparisonView.filterTokens('mistakes', this)">&#10060; गलतियां</button>
            <button class="sm-comp-tab tab-punct" onclick="stenoComparisonView.filterTokens('punct', this)">। विराम</button>
            <button class="sm-comp-tab tab-missing" onclick="stenoComparisonView.filterTokens('missing', this)">&#9888; छूटे</button>
          </div>
        </div>
        <div class="comparison-legend">
          <div class="legend-item"><span class="legend-dot dot-correct"></span> &#10003; शुद्ध (Correct)</div>
          <div class="legend-item"><span class="legend-dot dot-wrong"></span> &#10060; गलत / मात्रा दोष (Wrong)</div>
          <div class="legend-item"><span class="legend-dot dot-missing"></span> &#9888; छूटा हुआ (Missing)</div>
          <div class="legend-item"><span class="legend-dot dot-extra"></span> &#10133; अतिरिक्त (Extra)</div>
        </div>
        <div class="token-stream-box notranslate" id="tokenStreamBox" translate="no">
          ${this.renderTokenStream(report.aligned_tokens || [])}
        </div>
      </div>

      <!-- ========== WEAK WORDS BANK ========== -->
      ${this.renderPersonalWeakWordsBank(report)}

      <!-- ========== DETAILED ERROR TABLE ========== -->
      ${(report.error_table && report.error_table.length > 0) ? `
        <details class="error-table-accordion" style="margin-top:20px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:16px;">
          <summary style="font-weight:700; font-size:1.05rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; padding:4px 0;">
            <span>&#128203; विस्तृत त्रुटि तालिका देखें (Detailed Error Table — ${report.error_table.length} त्रुटियां दर्ज)</span>
            <span style="font-size:0.85rem; color:var(--primary); font-weight:600;">क्लिक करके खोलें / बंद करें &#9660;</span>
          </summary>
          <div style="margin-top:16px;">
            <div class="table-filter-bar">
              <button class="cat-pill active" onclick="stenoComparisonView.filterTable('all', this)">सभी (All)</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('wrong', this)">गलत शब्द</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('missing', this)">छूटे हुए शब्द</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('extra', this)">अतिरिक्त शब्द</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('matra', this)">मात्रा अशुद्धि</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('spelling', this)">वर्तनी / वर्ण</button>
              <button class="cat-pill" onclick="stenoComparisonView.filterTable('punctuation', this)">विराम चिह्न</button>
            </div>
            <div style="overflow-x: auto; max-height: 480px;">
              <table class="data-table notranslate" id="errorTable" translate="no">
                <thead>
                  <tr>
                    <th style="width: 50px;">#</th>
                    <th>आपका इनपुट (Your Text)</th>
                    <th>सही शब्द (Correct Text)</th>
                    <th>त्रुटि का प्रकार (Error Type)</th>
                    <th>विवरण (Detail)</th>
                  </tr>
                </thead>
                <tbody class="notranslate" translate="no">
                  ${this.renderErrorTableRows(report.error_table || [], 'all')}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ` : ''}

      <!-- ========== MASTER PASSAGE SECTION ========== -->
      ${this.renderMasterPassageSection(report)}

      <!-- Bottom Action Buttons -->
      <div style="display:flex; justify-content:center; gap:16px; margin-top:30px; margin-bottom:40px; flex-wrap:wrap;">
        <button class="btn-secondary" onclick="stenoApp.goBack()">&#8592; वापस जाएं (Back)</button>
        <button class="btn-primary" onclick="stenoApp.retryPractice()">&#128260; पुनः अभ्यास करें (Retry)</button>
      </div>
    `;    container.innerHTML = html;
    this.attachTokenListeners();
  }

  renderTokenStream(alignedTokens) {
    if (!alignedTokens || alignedTokens.length === 0) {
      return '<p style="color:var(--text-muted)">कोई तुलना डेटा उपलब्ध नहीं है।</p>';
    }

    return alignedTokens.map((t, idx) => {
      let cssClass = 'eval-token-correct';
      let displayText = t.official || t.student || '';
      let tooltipText = '';

      if (t.status === 'wrong') {
        if (t.error_type === 'punctuation') {
          cssClass = 'eval-token-wrong eval-token-punct';
          displayText = t.student || t.official || '(विराम)';
          tooltipText = `विराम चिह्न भेद (अपेक्षित: '${t.official || '—'}', आपका इनपुट: '${t.student || '—'}')`;
        } else {
          cssClass = 'eval-token-wrong';
          displayText = t.student || '(रिक्त)';
          tooltipText = `अपेक्षित: ${t.official || '—'}`;
        }
      } else if (t.status === 'missing') {
        cssClass = 'eval-token-missing';
        displayText = t.official || '';
        tooltipText = 'छूटा हुआ शब्द';
      } else if (t.status === 'extra') {
        cssClass = 'eval-token-extra';
        displayText = t.student || '';
        tooltipText = 'अतिरिक्त शब्द (Unwanted)';
      }

      // Sanitize display and tooltip: ensure & is never shown as a character between Hindi words (Shift+7 dash artifact)
      if (displayText && /[\u0900-\u097F]&[\u0900-\u097F]/.test(displayText)) {
        displayText = displayText.replace(/&/g, '-');
      }
      if (tooltipText && /[\u0900-\u097F]&[\u0900-\u097F]/.test(tooltipText)) {
        tooltipText = tooltipText.replace(/&/g, '-');
      }

      // Sanitize display: clean dotted circle artifacts & inverted rephs
      if (displayText && typeof displayText === 'string') {
        displayText = displayText.replace(/\u25CC/g, '');
        if (/[\u0900-\u097F]/.test(displayText)) {
          displayText = displayText
            .replace(/((?:[\u0915-\u0939][\u094D])*[\u0915-\u0939])\u0930\u094D([\u093E-\u094C])([\u0901\u0902])?/g, '\u0930\u094D')
            .replace(/((?:[\u0915-\u0939][\u094D])*[\u0915-\u0939](?:[\u093E-\u094C])?(?:[\u0901\u0902])?)\u0930\u094D(?=[^\u0915-\u0939]|$)/g, '\u0930\u094D');
        }
      }

      // If token is in Kruti Dev ASCII, apply font-krutidev; if Hindi Devanagari, apply font-mangal
      const isTokenKruti = !/[\u0900-\u097F]/.test(displayText) && /[a-zA-Z]/.test(displayText);
      const fontClass = isTokenKruti ? ' font-krutidev' : ' font-mangal';
      const titleAttr = tooltipText ? ` title="${this.escapeHtml(tooltipText)}"` : '';

      return `<span class="eval-token ${cssClass}${fontClass} notranslate skiptranslate" translate="no" data-idx="${idx}" data-error-type="${this.escapeHtml(t.error_type || '')}"${titleAttr}><hindi-root text="${this.escapeHtml(displayText)}"></hindi-root></span>`;
    }).join(' ');
  }

  attachTokenListeners() {
    const tokens = document.querySelectorAll('.eval-token');
    tokens.forEach(el => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(el.getAttribute('data-idx'));
        if (this.currentReport && this.currentReport.aligned_tokens) {
          const t = this.currentReport.aligned_tokens[idx];
          if (t) {
            this.showPopover(e, t);
          }
        }
      });
    });
  }

  showPopover(e, token) {
    const rect = e.target.getBoundingClientRect();
    const statusLabels = {
      correct: '✓ शुद्ध शब्द (Correct)',
      wrong: '❌ गलत शब्द (Wrong)',
      missing: '⚠ छूटा हुआ शब्द (Missing)',
      extra: '➕ अतिरिक्त शब्द (Extra)'
    };

    let stuDisplay = token.student || '— (रिक्त)';
    let offDisplay = token.official || '— (अनावश्यक)';

    if (token.student && !/[\u0900-\u097F]/.test(token.student) && typeof krutiDevToUnicodeJS === 'function') {
      stuDisplay = `<span class="font-krutidev notranslate" translate="no">${token.student}</span> (<span class="notranslate" translate="no">${krutiDevToUnicodeJS(token.student)}</span>)`;
    }
    if (token.official && !/[\u0900-\u097F]/.test(token.official) && typeof krutiDevToUnicodeJS === 'function') {
      offDisplay = `<span class="font-krutidev notranslate" translate="no">${token.official}</span> (<span class="notranslate" translate="no">${krutiDevToUnicodeJS(token.official)}</span>)`;
    }

    this.popoverEl.innerHTML = `
      <div class="popover-header">${statusLabels[token.status] || token.status}</div>
      <div class="popover-field notranslate" translate="no"><strong>आपका टंकण:</strong> <span class="notranslate" translate="no">${stuDisplay}</span></div>
      <div class="popover-field notranslate" translate="no"><strong>अपेक्षित शब्द:</strong> <span class="notranslate" translate="no">${offDisplay}</span></div>
      <div class="popover-field"><strong>त्रुटि का प्रकार:</strong> ${token.error_type}</div>
      <div class="popover-field" style="margin-top:8px; font-size:0.82rem; color:var(--text-secondary); line-height:1.4">
        ${token.detail || 'मानक रूप से मिलान किया गया।'}
      </div>
    `;

    this.popoverEl.style.display = 'block';
    const popRect = this.popoverEl.getBoundingClientRect();

    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    if (left + popRect.width > window.innerWidth) {
      left = window.innerWidth - popRect.width - 16;
    }
    this.popoverEl.style.left = `${Math.max(10, left)}px`;
    this.popoverEl.style.top = `${top}px`;
  }

  renderErrorTableRows(errors, filter) {
    if (!errors || errors.length === 0) {
      return `<tr><td colspan="5" style="text-align:center; color:var(--accent-green); padding:24px;">🎉 बधाई! कोई त्रुटि दर्ज नहीं हुई।</td></tr>`;
    }

    const filtered = errors.filter(e => {
      if (filter === 'all') return true;
      if (filter === 'wrong') return e.category === 'wrong';
      if (filter === 'missing') return e.category === 'missing';
      if (filter === 'extra') return e.category === 'extra';
      if (filter === 'matra') return e.category === 'matra';
      if (filter === 'spelling') return e.category === 'spelling' || e.category === 'character';
      if (filter === 'punctuation') return e.category === 'punctuation';
      return true;
    });

    if (filtered.length === 0) {
      return `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">इस श्रेणी में कोई त्रुटि नहीं है।</td></tr>`;
    }

    return filtered.map(e => {
      let yourDisplay = e.your_text;
      let correctDisplay = e.correct_text;

      const isYourKruti = e.your_text && !/[\u0900-\u097F]/.test(e.your_text) && /[a-zA-Z]/.test(e.your_text);
      const isCorrectKruti = e.correct_text && !/[\u0900-\u097F]/.test(e.correct_text) && /[a-zA-Z]/.test(e.correct_text);

      if (isYourKruti && typeof krutiDevToUnicodeJS === 'function') {
        yourDisplay = `<span class="font-krutidev notranslate" translate="no">${e.your_text}</span> <span class="notranslate" translate="no" style="font-family:var(--font-hindi); font-size:0.85rem; color:var(--text-muted)">(${krutiDevToUnicodeJS(e.your_text)})</span>`;
      }
      if (isCorrectKruti && typeof krutiDevToUnicodeJS === 'function') {
        correctDisplay = `<span class="font-krutidev notranslate" translate="no">${e.correct_text}</span> <span class="notranslate" translate="no" style="font-family:var(--font-hindi); font-size:0.85rem; color:var(--text-muted)">(${krutiDevToUnicodeJS(e.correct_text)})</span>`;
      }

      return `
        <tr>
          <td><strong>${e.id}</strong></td>
          <td class="notranslate" translate="no" style="color:var(--accent-red); font-size:1.05rem;">${yourDisplay}</td>
          <td class="notranslate" translate="no" style="color:var(--accent-green); font-size:1.05rem; font-weight:600;">${correctDisplay}</td>
          <td><span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary)">${e.error_type}</span></td>
          <td style="font-size:0.85rem; color:var(--text-secondary)">${e.detail}</td>
        </tr>
      `;
    }).join('');
  }

  filterTable(category, btnEl) {
    this.activeFilter = category;
    if (btnEl) {
      document.querySelectorAll('.table-filter-bar .cat-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }

    const tbody = document.querySelector('#errorTable tbody');
    if (tbody && this.currentReport) {
      tbody.innerHTML = this.renderErrorTableRows(this.currentReport.error_table || [], category);
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

  renderStenoNotesSection(report) {
    const url = report.steno_notes_url;
    if (!url) return '';

    const type = report.steno_notes_type || (url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    const filename = url.split('/').pop() || 'steno_notes';
    const title = report.passage_title || 'स्टेनो डिक्टेशन';

    if (type === 'pdf') {
      return `
        <div class="result-steno-notes-card">
          <div class="result-steno-header">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="steno-icon-badge" style="background:#fee2e2; color:#ef4444;">📄</div>
              <div>
                <h3 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">
                  स्टेनो आउटलाइन व पीडीएफ़ नोट्स (Shorthand Outlines PDF)
                </h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin:3px 0 0 0;">
                  इस डिक्टेशन की आधिकारिक हस्तलिखित स्टेनो आउटलाइन्स पीडीएफ़ रूप में संलग्न हैं।
                </p>
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn-sm btn-primary" onclick="stenoComparisonView.openStenoLightbox('${url}', 'pdf', '${this.escapeHtml(title)}')" style="font-size:0.82rem; padding:6px 12px; background:#ef4444; border-color:#ef4444;">
                👁️ PDF यहीं देखें
              </button>
              <a href="${url}" target="_blank" class="btn-sm btn-secondary" style="font-size:0.82rem; padding:6px 12px; text-decoration:none; display:inline-flex; align-items:center;">
                ↗️ नए टैब में खोलें
              </a>
              <a href="${url}" download="${filename}" class="btn-sm btn-secondary" style="font-size:0.82rem; padding:6px 12px; text-decoration:none; display:inline-flex; align-items:center;">
                ⬇️ डाउनलोड PDF
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // Image mode
    return `
      <div class="result-steno-notes-card">
        <div class="result-steno-header">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="steno-icon-badge" style="background:#e0e7ff; color:#4338ca;">✍️</div>
            <div>
              <h3 style="font-size:1.1rem; font-weight:700; margin:0; color:var(--text-main);">
                स्टेनो हस्तलिखित आउटलाइन्स (Official Shorthand Outlines)
              </h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:3px 0 0 0;">
                प्रशिक्षक द्वारा तैयार की गई स्टेनो आउटलाइन—चित्र पर क्लिक करके या बड़ा बटन दबाकर HD में देखें:
              </p>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <button type="button" class="btn-sm btn-primary" onclick="stenoComparisonView.openStenoLightbox('${url}', 'image', '${this.escapeHtml(title)}')" style="font-size:0.82rem; padding:6px 12px; background:#4338ca; border-color:#4338ca;">
              🔍 पूरी स्टेनो आउटलाइन बड़ी करके देखें (Zoom)
            </button>
            <a href="${url}" download="${filename}" class="btn-sm btn-secondary" style="font-size:0.82rem; padding:6px 12px; text-decoration:none; display:inline-flex; align-items:center;">
              ⬇️ इमेज डाउनलोड
            </a>
          </div>
        </div>

        <div class="steno-preview-banner" onclick="stenoComparisonView.openStenoLightbox('${url}', 'image', '${this.escapeHtml(title)}')" title="बड़ा करके देखने के लिए क्लिक करें">
          <img src="${url}" alt="Steno Outlines" style="max-height:220px; max-width:100%; object-fit:contain; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div class="steno-preview-hover-hint">
            <span>🔍 क्लिक करके पूरी स्क्रीन में HD ज़ूम करें</span>
          </div>
        </div>
      </div>
    `;
  }

  renderMasterPassageSection(report) {
    const mangalText = (report.official_text || '').trim();
    const krutiText = (report.official_text_krutidev || '').trim();
    const studentText = (report.student_text || '').trim();
    const activeText = mangalText || krutiText;

    if (!activeText) return '';

    const wordCount = activeText ? activeText.split(/\s+/).filter(Boolean).length : 0;
    const charCount = activeText.length;
    const hasDual = !!(mangalText && krutiText);

    return `
      <div class="result-master-passage-card notranslate" translate="no">
        <div class="result-master-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">📖</span>
              <h3 style="font-size:1.12rem; font-weight:700; margin:0; color:var(--text-main);" class="notranslate" translate="no">
                मास्टर संदर्भ आलेख (Official Uploaded Passage)
              </h3>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0 0;">
              परीक्षा आयोजक / एडमिन द्वारा अपलोड किया गया वास्तविक मानक पाठ
            </p>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge notranslate" translate="no" style="background:#e0f2fe; color:#0284c7; font-weight:600; font-size:0.78rem;">
              📝 ${wordCount} शब्द • ${charCount} वर्ण
            </span>

            ${hasDual ? `
              <div class="result-font-toggle-group">
                <button type="button" id="resFontMangalBtn" class="btn-sm active" onclick="stenoComparisonView.toggleResultPassageFont('mangal')" title="मंगल यूनिकोड में देखें">
                  🅰️ मंगल
                </button>
                <button type="button" id="resFontKrutiBtn" class="btn-sm" onclick="stenoComparisonView.toggleResultPassageFont('kruti')" title="कृति देव 010 में देखें">
                  ⌨️ कृति देव
                </button>
              </div>
            ` : ''}

            ${studentText ? `
              <button type="button" id="btnToggleStudentCompare" class="btn-sm btn-secondary" onclick="stenoComparisonView.toggleStudentCompareBox()">
                ⚖️ आपका टंकण देखें
              </button>
            ` : ''}

            <button type="button" class="btn-sm btn-secondary" onclick="stenoComparisonView.copyMasterPassage()" title="आलेख कॉपी करें">
              📋 कॉपी
            </button>
          </div>
        </div>

        <div class="result-master-passage-grid notranslate" id="resultMasterPassageGrid" translate="no">
          <!-- Official Reference Passage Box -->
          <div class="result-passage-box-wrap notranslate" id="officialPassageWrap" translate="no">
            <div class="result-box-tag notranslate" translate="no" style="color:#0284c7; background:#e0f2fe;">
              ${document.documentElement.getAttribute('data-app-lang') === 'en' ? '✓ Official Reference Text' : '✓ आधिकारिक मूल पाठ'}
            </div>
            <div class="result-passage-text-content font-mangal notranslate skiptranslate" id="masterOfficialTextDisplay" translate="no">
              <hindi-root text="${this.escapeHtml(mangalText || krutiText)}"></hindi-root>
            </div>
          </div>

          <!-- Student's Typed Passage Box (Collapsible/Toggleable) -->
          ${studentText ? `
            <div class="result-passage-box-wrap notranslate" id="studentPassageWrap" translate="no" style="display:none;">
              <div class="result-box-tag notranslate" translate="no" style="color:#7c3aed; background:#f3e8ff;">
                ${document.documentElement.getAttribute('data-app-lang') === 'en' ? '⌨️ Your Raw Typed Text' : '⌨️ आपका टाइप किया हुआ पाठ'}
              </div>
              <div class="result-passage-text-content font-mangal notranslate skiptranslate" id="studentRawTextDisplay" translate="no">
                <hindi-root text="${this.escapeHtml(studentText)}"></hindi-root>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  toggleResultPassageFont(font) {
    if (!this.currentReport) return;
    const btnM = document.getElementById('resFontMangalBtn');
    const btnK = document.getElementById('resFontKrutiBtn');
    const display = document.getElementById('masterOfficialTextDisplay');
    if (!display) return;

    if (font === 'kruti') {
      if (btnM) btnM.classList.remove('active');
      if (btnK) btnK.classList.add('active');
      const text = this.currentReport.official_text_krutidev || this.currentReport.official_text || '';
      display.innerHTML = `<hindi-root text="${this.escapeHtml(text)}"></hindi-root>`;
      display.classList.remove('font-mangal');
      display.classList.add('font-krutidev');
    } else {
      if (btnK) btnK.classList.remove('active');
      if (btnM) btnM.classList.add('active');
      const text = this.currentReport.official_text || this.currentReport.official_text_krutidev || '';
      display.innerHTML = `<hindi-root text="${this.escapeHtml(text)}"></hindi-root>`;
      display.classList.remove('font-krutidev');
      display.classList.add('font-mangal');
    }
  }

  toggleStudentCompareBox() {
    const wrap = document.getElementById('studentPassageWrap');
    const grid = document.getElementById('resultMasterPassageGrid');
    const btn = document.getElementById('btnToggleStudentCompare');
    if (!wrap || !grid) return;

    if (wrap.style.display === 'none' || wrap.style.display === '') {
      wrap.style.display = 'block';
      grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
      if (btn) btn.innerHTML = '⚖️ केवल मूल आलेख देखें';
    } else {
      wrap.style.display = 'none';
      grid.style.gridTemplateColumns = '1fr';
      if (btn) btn.innerHTML = '⚖️ आपका टंकण देखें';
    }
  }

  copyMasterPassage() {
    const display = document.getElementById('masterOfficialTextDisplay');
    if (!display) return;
    const text = display.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        stenoApp.showToast('मास्टर आलेख क्लिपबोर्ड में कॉपी हो गया! 📋', 'success');
      }).catch(() => {
        stenoApp.showToast('कॉपी करने में असमर्थ।', 'warning');
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      stenoApp.showToast('मास्टर आलेख कॉपी हो गया! 📋', 'success');
    }
  }

  openStenoLightbox(url, type, title) {
    if (!url) return;
    type = type || (url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    title = title || 'स्टेनो आउटलाइन व नोट्स';

    const titleEl = document.getElementById('stenoLightboxTitle');
    const dlBtn = document.getElementById('stenoLightboxDownloadBtn');
    const contentEl = document.getElementById('stenoLightboxContent');
    if (!contentEl) return;

    if (titleEl) titleEl.textContent = `📝 ${title}`;
    if (dlBtn) {
      dlBtn.href = url;
      dlBtn.download = url.split('/').pop() || 'steno_outline';
      dlBtn.style.display = 'inline-flex';
    }

    if (type === 'pdf') {
      contentEl.innerHTML = `
        <iframe src="${url}" style="width:100%; height:75vh; border:none; border-radius:6px; background:#fff;" title="Steno PDF Document"></iframe>
      `;
    } else {
      contentEl.innerHTML = `
        <div style="max-height:75vh; width:100%; overflow:auto; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">💡 चित्र पर क्लिक करके 1.75x ज़ूम करें या ज़ूम आउट करें</div>
          <img src="${url}" style="max-width:100%; max-height:68vh; object-fit:contain; border-radius:6px; cursor:zoom-in; transition:transform 0.25s ease;"
               onclick="this.style.transform = (this.style.transform === 'scale(1.75)' ? 'scale(1)' : 'scale(1.75)'); this.style.cursor = (this.style.transform === 'scale(1.75)' ? 'zoom-out' : 'zoom-in');"
               alt="Steno Shorthand HD Outline">
        </div>
      `;
    }

    stenoApp.openModal('stenoAttachmentLightboxModal');
  }
}

window.stenoComparisonView = new StenoComparisonView();
