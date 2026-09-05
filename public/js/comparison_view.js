/**
 * Comparison View & Error Diagnostics Renderer for StenoMaster
 * Renders:
 * - Dynamic aligned token sequence with color coding
 * - Click-to-inspect popover modal
 * - Interactive and filterable error list table
 * - Diagnostic weak-area recommendations
 * - Grammar & style suggestions
 */

class StenoComparisonView {
  constructor() {
    this.currentReport = null;
    this.activeFilter = 'all';
    this.popoverEl = null;
    this.initPopover();
  }

  initPopover() {
    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'token-popover';
    document.body.appendChild(this.popoverEl);

    document.addEventListener('click', (e) => {
      if (!this.popoverEl.contains(e.target) && !e.target.classList.contains('eval-token')) {
        this.popoverEl.style.display = 'none';
      }
    });
  }

  renderResult(report, container) {
    this.currentReport = report;
    const m = report.metrics || {};
    const ec = report.error_counts || {};

    const html = `
      <div class="result-header-banner">
        <div class="result-header-left">
          <h2>अभ्यास पूर्ण! 🎉 (Practice Completed)</h2>
          <p>${report.passage_title || 'Stenographer Dictation'} • ${report.language === 'hindi' ? 'हिंदी डिक्टेशन' : 'English Dictation'}</p>
        </div>
        <div class="result-header-right">
          <button class="btn-secondary" onclick="stenoApp.retryPractice()" style="color:#fff; border-color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.15)">
            🔄 पुनः अभ्यास करें (Retry)
          </button>
        </div>
      </div>

      <!-- Main Score Metrics Grid -->
      <div class="result-metrics-grid">
        <div class="metric-card highlight">
          <div class="metric-card-label">Net Speed (नेट गति)</div>
          <div class="metric-card-value">${m.net_wpm || 0} <span style="font-size:1rem; font-weight:600">WPM</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Gross Speed (सकल गति)</div>
          <div class="metric-card-value">${m.gross_wpm || 0} <span style="font-size:1rem; font-weight:600">WPM</span></div>
        </div>
        <div class="metric-card highlight">
          <div class="metric-card-label">Accuracy (सटीकता)</div>
          <div class="metric-card-value">${m.accuracy || 0}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Total Errors (कुल त्रुटियां)</div>
          <div class="metric-card-value" style="color:var(--accent-red)">${ec.total || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Time Taken (समय)</div>
          <div class="metric-card-value">${m.time_formatted || '00:00'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Words Typed (टाइप शब्द)</div>
          <div class="metric-card-value">${m.total_words_typed || 0} / ${m.total_words_official || 0}</div>
        </div>
      </div>

      <!-- Error Breakdown -->
      <div class="error-breakdown-card">
        <div class="error-breakdown-title">त्रुटि विश्लेषण (Error Breakdown)</div>
        <div class="error-pills-row">
          <div class="error-pill pill-wrong">❌ गलत शब्द (Wrong Words): <strong>${ec.wrong || 0}</strong></div>
          <div class="error-pill pill-missing">⚠ छूटे हुए शब्द (Missing Words): <strong>${ec.missing || 0}</strong></div>
          <div class="error-pill pill-extra">➕ अतिरिक्त शब्द (Extra Words): <strong>${ec.extra || 0}</strong></div>
          <div class="error-pill pill-matra">✎ मात्रा अशुद्धि (Matra Errors): <strong>${ec.matra || 0}</strong></div>
          <div class="error-pill pill-spelling">🔤 वर्तनी/वर्ण अशुद्धि (Spelling): <strong>${(ec.spelling || 0) + (ec.character || 0)}</strong></div>
          <div class="error-pill pill-punctuation" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd">
            । विराम चिह्न (Punctuation): <strong>${ec.punctuation || 0}</strong>
          </div>
        </div>
      </div>

      <!-- Aligned Stream Comparison Section -->
      <div class="comparison-section">
        <div class="section-header" style="margin-bottom: 12px;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:700">मूल आलेख बनाम आपका टंकण (Side-by-Side Comparison)</h3>
            <p class="section-subtitle">किसी भी शब्द पर क्लिक करके उसका विस्तृत विवरण देखें (Click any word for details)</p>
          </div>
        </div>

        <div class="comparison-legend">
          <div class="legend-item"><span class="legend-dot dot-correct"></span> ✓ शुद्ध (Correct)</div>
          <div class="legend-item"><span class="legend-dot dot-wrong"></span> ❌ गलत / मात्रा दोष (Wrong)</div>
          <div class="legend-item"><span class="legend-dot dot-missing"></span> ⚠ छूटा हुआ (Missing)</div>
          <div class="legend-item"><span class="legend-dot dot-extra"></span> ➕ अतिरिक्त (Extra)</div>
        </div>

        <div class="token-stream-box" id="tokenStreamBox">
          ${this.renderTokenStream(report.aligned_tokens || [])}
        </div>
      </div>

      <!-- Filterable Detailed Error Table -->
      <div class="error-table-card">
        <div class="section-header" style="margin-bottom: 16px;">
          <h3 style="font-size:1.15rem; font-weight:700">विस्तृत त्रुटि सूची (Detailed Error Log)</h3>
          <span style="font-size:0.85rem; color:var(--text-muted)">कुल ${report.error_table ? report.error_table.length : 0} त्रुटियां दर्ज</span>
        </div>

        <div class="table-filter-bar">
          <button class="cat-pill active" onclick="stenoComparisonView.filterTable('all', this)">सभी (All)</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('wrong', this)">गलत शब्द</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('missing', this)">छूटे हुए शब्द</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('extra', this)">अतिरिक्त शब्द</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('matra', this)">मात्रा अशुद्धि</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('spelling', this)">वर्तनी / वर्ण</button>
          <button class="cat-pill" onclick="stenoComparisonView.filterTable('punctuation', this)">विराम चिह्न</button>
        </div>

        <div style="overflow-x: auto;">
          <table class="data-table" id="errorTable">
            <thead>
              <tr>
                <th style="width: 60px;">#</th>
                <th>आपका इनपुट (Your Text)</th>
                <th>सही शब्द (Correct Text)</th>
                <th>त्रुटि का प्रकार (Error Type)</th>
                <th>मार्गदर्शन (Detail)</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderErrorTableRows(report.error_table || [], 'all')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Weak Area Diagnostics & Recommendations -->
      <div class="weak-areas-card">
        <h3 style="font-size:1.15rem; font-weight:700">कमजोर क्षेत्रों का विश्लेषण (Weak Area Diagnostics)</h3>
        <p class="section-subtitle">आपकी वास्तविक परीक्षा प्रदर्शन रिपोर्ट के आधार पर स्वचालित सुझाव:</p>
        <div class="weak-area-list">
          ${(report.weak_areas || []).map(wa => `
            <div class="weak-area-item severity-${wa.severity}">
              <div class="weak-area-item-top">
                <span class="weak-area-title">${wa.topic}</span>
                <span class="weak-area-severity">${wa.severity} Priority</span>
              </div>
              <p class="weak-area-rec">${wa.recommendation}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Linguistic Suggestions Layer (Non-penalizing) -->
      ${report.suggestions && report.suggestions.length > 0 ? `
        <div class="weak-areas-card" style="border-left: 4px solid var(--primary)">
          <h3 style="font-size:1.15rem; font-weight:700">भाषा एवं मानक वर्तनी सुझाव (Linguistic Suggestions)</h3>
          <p class="section-subtitle">नोट: ये AI/मानक वर्तनी सुझाव केवल आपके भाषा संवर्धन हेतु हैं, इनसे अंक नहीं काटे गए हैं।</p>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px; margin-top:14px;">
            ${report.suggestions.map(s => `
              <div style="background:var(--bg-subtle); padding:14px; border-radius:var(--radius-md)">
                <div style="font-size:0.85rem; font-weight:700; color:var(--primary); margin-bottom:4px;">💡 ${s.title}</div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">${s.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="display:flex; justify-content:center; gap:16px; margin-top:30px; margin-bottom:40px;">
        <button class="btn-secondary" onclick="stenoApp.navigate('classes')">← वापस क्लास सूची पर जाएं (Back to Classes)</button>
        <button class="btn-primary" onclick="stenoApp.retryPractice()">🔄 पुनः अभ्यास करें (Retry)</button>
      </div>
    `;

    container.innerHTML = html;
    this.attachTokenListeners();
  }

  renderTokenStream(alignedTokens) {
    if (!alignedTokens || alignedTokens.length === 0) {
      return '<p style="color:var(--text-muted)">कोई तुलना डेटा उपलब्ध नहीं है।</p>';
    }

    return alignedTokens.map((t, idx) => {
      let cssClass = 'eval-token-correct';
      let displayText = t.official || t.student;

      if (t.status === 'wrong') {
        cssClass = 'eval-token-wrong';
        displayText = t.student;
      } else if (t.status === 'missing') {
        cssClass = 'eval-token-missing';
        displayText = `[छूटा: ${t.official}]`;
      } else if (t.status === 'extra') {
        cssClass = 'eval-token-extra';
        displayText = `[+ ${t.student}]`;
      }

      // If token is in Kruti Dev ASCII, apply font-krutidev; if Hindi Devanagari, apply font-mangal
      const isTokenKruti = !/[\u0900-\u097F]/.test(displayText) && /[a-zA-Z]/.test(displayText);
      const fontClass = isTokenKruti ? ' font-krutidev' : ' font-mangal';

      return `<span class="eval-token ${cssClass}${fontClass}" data-idx="${idx}">${displayText}</span>`;
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
      stuDisplay = `<span class="font-krutidev">${token.student}</span> (${krutiDevToUnicodeJS(token.student)})`;
    }
    if (token.official && !/[\u0900-\u097F]/.test(token.official) && typeof krutiDevToUnicodeJS === 'function') {
      offDisplay = `<span class="font-krutidev">${token.official}</span> (${krutiDevToUnicodeJS(token.official)})`;
    }

    this.popoverEl.innerHTML = `
      <div class="popover-header">${statusLabels[token.status] || token.status}</div>
      <div class="popover-field"><strong>आपका टंकण:</strong> ${stuDisplay}</div>
      <div class="popover-field"><strong>अपेक्षित शब्द:</strong> ${offDisplay}</div>
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
        yourDisplay = `<span class="font-krutidev">${e.your_text}</span> <span style="font-family:var(--font-hindi); font-size:0.85rem; color:var(--text-muted)">(${krutiDevToUnicodeJS(e.your_text)})</span>`;
      }
      if (isCorrectKruti && typeof krutiDevToUnicodeJS === 'function') {
        correctDisplay = `<span class="font-krutidev">${e.correct_text}</span> <span style="font-family:var(--font-hindi); font-size:0.85rem; color:var(--text-muted)">(${krutiDevToUnicodeJS(e.correct_text)})</span>`;
      }

      return `
        <tr>
          <td><strong>${e.id}</strong></td>
          <td style="color:var(--accent-red); font-size:1.05rem;">${yourDisplay}</td>
          <td style="color:var(--accent-green); font-size:1.05rem; font-weight:600;">${correctDisplay}</td>
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
}

window.stenoComparisonView = new StenoComparisonView();
