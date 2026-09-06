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

      return `
        <div class="chart-card" style="border: 2px solid ${isQual ? '#10b981' : '#ef4444'}; background: ${isQual ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)'}; margin-bottom: 24px; padding: 22px; border-radius: var(--radius-lg);">
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

    return `
      <div class="chart-card" style="border: 2px solid #0284c7; background: rgba(2, 132, 199, 0.04); margin-bottom: 24px; padding: 22px; border-radius: var(--radius-lg);">
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

      <!-- Official Exam Qualification Card (SSC vs UPSSSC) -->
      ${this.renderExamQualificationCard(report)}

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

      <!-- 1. Official Steno Shorthand Notes & Outlines Card -->
      ${this.renderStenoNotesSection(report)}

      <!-- 2. Master Reference Passage Box (Official Uploaded Passage Text) -->
      ${this.renderMasterPassageSection(report)}

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
      <div class="result-master-passage-card">
        <div class="result-master-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">📖</span>
              <h3 style="font-size:1.12rem; font-weight:700; margin:0; color:var(--text-main);">
                मास्टर संदर्भ आलेख (Official Uploaded Passage)
              </h3>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0 0;">
              परीक्षा आयोजक / एडमिन द्वारा अपलोड किया गया वास्तविक मानक पाठ
            </p>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge" style="background:#e0f2fe; color:#0284c7; font-weight:600; font-size:0.78rem;">
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

        <div class="result-master-passage-grid" id="resultMasterPassageGrid">
          <!-- Official Reference Passage Box -->
          <div class="result-passage-box-wrap" id="officialPassageWrap">
            <div class="result-box-tag" style="color:#0284c7; background:#e0f2fe;">
              ✓ आधिकारिक मूल पाठ (Official Reference Text)
            </div>
            <div class="result-passage-text-content font-mangal" id="masterOfficialTextDisplay">
              ${this.escapeHtml(mangalText || krutiText)}
            </div>
          </div>

          <!-- Student's Typed Passage Box (Collapsible/Toggleable) -->
          ${studentText ? `
            <div class="result-passage-box-wrap" id="studentPassageWrap" style="display:none;">
              <div class="result-box-tag" style="color:#7c3aed; background:#f3e8ff;">
                ⌨️ आपका टाइप किया हुआ पाठ (Your Raw Typing)
              </div>
              <div class="result-passage-text-content font-mangal" id="studentRawTextDisplay">
                ${this.escapeHtml(studentText)}
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
      display.textContent = text;
      display.classList.remove('font-mangal');
      display.classList.add('font-krutidev');
    } else {
      if (btnK) btnK.classList.remove('active');
      if (btnM) btnM.classList.add('active');
      const text = this.currentReport.official_text || this.currentReport.official_text_krutidev || '';
      display.textContent = text;
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
