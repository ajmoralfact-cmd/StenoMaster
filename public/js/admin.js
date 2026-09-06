/**
 * Admin Dashboard & Management Controller for StenoMaster
 * Provides:
 * - Admin Overview & Analytics
 * - Passage CRUD (Create, Edit, Delete, Publish)
 * - Audio File Upload & Integration
 * - Bulk Import via JSON
 * - Category Management
 * - Exam Scoring System Configuration (SSC Steno, High Court, Standard)
 * - Platform Branding Settings
 */

class StenoAdmin {
  constructor() {
    this.activeTab = 'overview';
    this.passagesList = [];
    this.categoriesList = [];
    this.subscribersList = [];
    this.currentSubFilter = 'all';
    this.settings = {};
    this.subscribersPollInterval = null;
    this.prevStudentCount = null;

    // Cross-tab broadcast listener for instant live update when a student registers
    window.addEventListener('storage', (e) => {
      if (e.key === 'stenomaster_student_registry_updated' || e.key === 'stenomaster_users_version') {
        if (this.activeTab === 'subscribers') {
          this.loadSubscribers(this.currentSubFilter, true);
        }
        if (this.activeTab === 'overview') {
          this.loadOverviewMetricsOnly();
        }
      }
    });
  }

  startSubscribersLiveSync() {
    this.stopSubscribersLiveSync();
    this.subscribersPollInterval = setInterval(async () => {
      if (document.hidden) return;
      if (window.stenoApp && window.stenoApp.activeView === 'admin' && this.activeTab === 'subscribers') {
        await this.loadSubscribers(this.currentSubFilter, true);
      } else {
        this.stopSubscribersLiveSync();
      }
    }, 10000);
  }

  stopSubscribersLiveSync() {
    if (this.subscribersPollInterval) {
      clearInterval(this.subscribersPollInterval);
      this.subscribersPollInterval = null;
    }
  }

  switchTab(tabId, updateHash = true) {
    this.activeTab = tabId;
    localStorage.setItem('stenomaster_last_admin_tab', tabId);

    if (window.stenoApp && typeof window.stenoApp.startTopLoading === 'function') {
      window.stenoApp.startTopLoading();
    }

    if (updateHash) {
      const targetHash = `#/admin/${tabId}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
    localStorage.setItem('stenomaster_last_route', `admin/${tabId}`);

    // Dynamic document title for Admin sub-tabs
    const tabTitles = {
      'overview': 'एडमिन ओवरव्यू (Overview) — StenoMaster',
      'passages': 'आलेख प्रबंधन (Passages) — StenoMaster',
      'subscribers': 'छात्र व फ्री एक्सेस (Students) — StenoMaster',
      'payments': 'भुगतान सत्यापन (Payments) — StenoMaster',
      'pricing': 'सब्सक्रिप्शन सेटिंग्स (Pricing) — StenoMaster',
      'scoring': 'परीक्षा मूल्यांकन नियम (Scoring) — StenoMaster',
      'branding': 'सिस्टम सेटिंग्स (Branding) — StenoMaster'
    };
    if (tabTitles[tabId]) {
      document.title = tabTitles[tabId];
    }

    // 1. Update active state on left tab buttons
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.adminTab === tabId);
    });

    // 2. Hide all admin sub-panels
    const panelIds = [
      'adminOverviewPanel',
      'adminPassagesPanel',
      'adminSubscribersPanel',
      'adminPaymentsPanel',
      'adminPricingPanel',
      'adminScoringPanel',
      'adminBrandingPanel'
    ];

    panelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    });

    // 3. Display only the selected panel
    const targetMap = {
      'overview': 'adminOverviewPanel',
      'passages': 'adminPassagesPanel',
      'subscribers': 'adminSubscribersPanel',
      'payments': 'adminPaymentsPanel',
      'pricing': 'adminPricingPanel',
      'scoring': 'adminScoringPanel',
      'branding': 'adminBrandingPanel'
    };

    const targetId = targetMap[tabId] || 'adminOverviewPanel';
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.style.display = 'block';
      targetEl.classList.add('active');
    }

    // 4. Lazy refresh corresponding data and manage live sync
    if (tabId === 'subscribers') {
      this.loadSubscribers();
      this.startSubscribersLiveSync();
    } else {
      this.stopSubscribersLiveSync();
      if (tabId === 'passages') {
        this.loadPassages();
      } else if (tabId === 'payments') {
        this.loadPayments();
      } else if (tabId === 'pricing') {
        this.loadSubscriptionSettings();
      } else if (tabId === 'scoring') {
        this.loadScoringConfig();
      } else if (tabId === 'branding') {
        this.loadSystemSettings();
      } else if (tabId === 'overview') {
        this.loadOverview();
      }
    }

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.stenoApp && typeof window.stenoApp.finishTopLoading === 'function') {
      setTimeout(() => window.stenoApp.finishTopLoading(), 200);
    }
  }

  async loadOverviewMetricsOnly() {
    try {
      const res = await stenoApp.apiCall(`/api/admin/overview?_t=${Date.now()}`);
      this.renderOverviewMetrics(res);
    } catch (err) {
      console.warn('Silent overview metrics refresh notice:', err);
    }
  }

  async loadOverview() {
    await this.loadOverviewMetricsOnly();

    // Load panel data in parallel without blocking each other
    await Promise.allSettled([
      this.loadPassages().catch(e => console.warn('Passages load notice:', e)),
      this.loadSubscribers().catch(e => console.warn('Subscribers load notice:', e)),
      this.loadPayments().catch(e => console.warn('Payments load notice:', e)),
      this.loadRewardsLedger().catch(e => console.warn('Rewards load notice:', e)),
      this.loadSubscriptionSettings().catch(e => console.warn('Settings load notice:', e))
    ]);
  }

  renderOverviewMetrics(data) {
    const el = document.getElementById('adminOverviewMetrics');
    if (!el) return;

    el.innerHTML = `
      <!-- 1. Key 4 Highlight Metrics Cards -->
      <div class="stats-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
        <div class="stat-card" style="cursor:pointer;" onclick="stenoAdmin.switchTab('subscribers')" title="छात्र सूची देखें">
          <div class="stat-icon-wrap stat-icon-blue">👥</div>
          <div>
            <div class="stat-info-title">कुल छात्र (Students)</div>
            <div class="stat-info-num">${data.total_users || 0}</div>
            <div style="font-size:0.75rem; color:#0284c7; margin-top:3px; font-weight:600;">छात्र सूची देखें →</div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="stenoAdmin.switchTab('passages')" title="आलेख सूची देखें">
          <div class="stat-icon-wrap stat-icon-amber">📝</div>
          <div>
            <div class="stat-info-title">सक्रिय आलेख (Passages)</div>
            <div class="stat-info-num">${data.total_passages || 0}</div>
            <div style="font-size:0.75rem; color:#d97706; margin-top:3px; font-weight:600;">आलेख प्रबंध →</div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="stenoAdmin.switchTab('subscribers')" title="प्रो सदस्य देखें">
          <div class="stat-icon-wrap stat-icon-green">👑</div>
          <div>
            <div class="stat-info-title">सक्रिय प्रो (Active Pro)</div>
            <div class="stat-info-num">${data.active_users || 0}</div>
            <div style="font-size:0.75rem; color:#10b981; margin-top:3px; font-weight:600;">सदस्यता स्थिति →</div>
          </div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="stenoAdmin.switchTab('payments')" title="भुगतान सत्यापन देखें">
          <div class="stat-icon-wrap stat-icon-purple">💳</div>
          <div>
            <div class="stat-info-title">लंबित सत्यापन (UTR)</div>
            <div class="stat-info-num">${data.pending_payments || 0}</div>
            <div style="font-size:0.75rem; color:#7c3aed; margin-top:3px; font-weight:600;">सत्यापित करें →</div>
          </div>
        </div>
      </div>

      <!-- 2. Quick Action Shortcuts Grid (1-Click Easy Actions) -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:12px; color:var(--text-main);">⚡ त्वरित कार्य शॉर्टकट (Quick Actions)</h3>
        <div class="admin-quick-actions-grid">
          <div class="admin-action-card" onclick="stenoAdmin.openNewPassageModal('mangal')">
            <div class="admin-action-card-icon" style="background:#e0f2fe; color:#0284c7;">🅰️</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">नया मंगल आलेख</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">Unicode / Remington डिक्टेशन</div>
            </div>
          </div>

          <div class="admin-action-card" onclick="stenoAdmin.openNewPassageModal('krutidev')">
            <div class="admin-action-card-icon" style="background:#fef3c7; color:#d97706;">⌨️</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">नया कृति देव आलेख</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">Kruti Dev 010 आलेख व ऑडियो</div>
            </div>
          </div>

          <div class="admin-action-card" onclick="stenoAdmin.switchTab('subscribers')">
            <div class="admin-action-card-icon" style="background:#dcfce7; color:#16a34a;">🎁</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">छात्र व ऑल फ्री एक्सेस</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">किसी भी छात्र को 1-क्लिक में फ्री करें</div>
            </div>
          </div>

          <div class="admin-action-card" onclick="stenoAdmin.switchTab('payments')">
            <div class="admin-action-card-icon" style="background:#f3e8ff; color:#9333ea;">💳</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">भुगतान सत्यापन (UTR)</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">UPI ट्रांजेक्शन चेक व प्रो अनलॉक</div>
            </div>
          </div>

          <div class="admin-action-card" onclick="stenoAdmin.switchTab('pricing')">
            <div class="admin-action-card-icon" style="background:#fee2e2; color:#ef4444;">💎</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">प्लान व QR सेटिंग्स</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">UPI QR इमेज व प्लान मूल्य बदलें</div>
            </div>
          </div>

          <div class="admin-action-card" onclick="stenoAdmin.switchTab('scoring')">
            <div class="admin-action-card-icon" style="background:#ccfbf1; color:#0d9488;">🎯</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">परीक्षा नियम व कटऑफ</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">UPSSSC 2026 व SSC Steno नियम</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. System Status & Real-time Connectivity Info -->
      <div class="admin-system-health-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>
            <strong style="font-size:0.95rem; color:var(--text-main);">प्लेटफ़ॉर्म स्थिति (System Status):</strong>
            <span style="font-size:0.85rem; color:#10b981; font-weight:700;">सक्रिय एवं सुरक्षित (Operational)</span>
          </div>
          <span style="font-size:0.78rem; color:var(--text-muted);">Single-Device Security Active 🔒</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:0.84rem; color:var(--text-secondary);">
          <div>🔤 <strong>टाइपिंग मोड:</strong> मंगल व कृति देव 010 (Dual Font Engine)</div>
          <div>🏛️ <strong>परीक्षा नियम:</strong> UPSSSC 2026 (25 WPM, 5% Error) + SSC Steno</div>
          <div>💾 <strong>डेटाबेस:</strong> केवल प्रामाणिक डेटा (0 फ़ेक रिकॉर्ड्स)</div>
        </div>
      </div>
    `;
  }

  async loadPassages() {
    try {
      const res = await stenoApp.apiCall('/api/admin/passages');
      this.passagesList = res.passages || [];
      this.renderPassagesTable();
    } catch (err) {
      console.error('Failed to load admin passages:', err);
    }
  }

  renderPassagesTable() {
    const tbody = document.querySelector('#adminPassagesTable tbody');
    if (!tbody) return;

    if (this.passagesList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">कोई आलेख नहीं मिला। नया जोड़ें!</td></tr>';
      return;
    }

    tbody.innerHTML = this.passagesList.map(p => {
      const hasMangal = !!(p.official_text && p.official_text.trim());
      const hasKruti = !!(p.official_text_krutidev && p.official_text_krutidev.trim());
      const fontBadges = `
        <div style="display:flex; flex-direction:column; gap:3px;">
          <span class="badge" style="background:${hasMangal ? '#e0f2fe' : '#fee2e2'}; color:${hasMangal ? '#0284c7' : '#ef4444'}; font-size:0.75rem;">
            🅰️ Mangal ${hasMangal ? '✓' : '✗'}
          </span>
          <span class="badge" style="background:${hasKruti ? '#fef3c7' : '#fee2e2'}; color:${hasKruti ? '#d97706' : '#ef4444'}; font-size:0.75rem;">
            ⌨️ Kruti Dev ${hasKruti ? '✓' : '✗'}
          </span>
        </div>
      `;

      return `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td>
          <div style="font-weight:600;">${this.escapeHtml(p.title)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin-top:2px; flex-wrap:wrap;">
            <span>${this.escapeHtml(p.category_name || '')}</span>
            ${p.steno_notes_url ? `
              <span class="badge" style="background:#e0e7ff; color:#4338ca; font-size:0.7rem; cursor:pointer; padding:2px 6px;" onclick="stenoComparisonView.openStenoLightbox('${p.steno_notes_url}', '${p.steno_notes_type || 'image'}', '${this.escapeHtml(p.title)}')" title="स्टेनो आउटलाइन पूर्वावलोकन">
                📎 स्टेनो ${p.steno_notes_type === 'pdf' ? 'PDF' : 'आउटलाइन'}
              </span>
            ` : ''}
          </div>
        </td>
        <td><span class="badge badge-${p.language}">${p.language}</span></td>
        <td><span class="badge badge-${p.difficulty}">${p.difficulty}</span></td>
        <td>${p.target_wpm} WPM</td>
        <td>${fontBadges}</td>
        <td><span class="badge" style="background:${p.status === 'published' ? 'var(--accent-green-subtle)' : 'var(--bg-subtle)'}; color:${p.status === 'published' ? 'var(--accent-green)' : 'var(--text-muted)'}">${p.status}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="stenoAdmin.togglePassageStatus(${p.id})" title="स्थिति बदलें">
              ${p.status === 'published' ? '👁️ ड्राफ्ट' : '🚀 पब्लिश'}
            </button>
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="stenoAdmin.openEditPassage(${p.id})">✏️ एडिट</button>
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; color:var(--accent-red);" onclick="stenoAdmin.deletePassage(${p.id})">🗑️ हटाएं</button>
          </div>
        </td>
      </tr>
      `;
    }).join('');
  }

  async togglePassageStatus(id) {
    try {
      const res = await stenoApp.apiCall('/api/admin/passages/toggle-status', 'POST', { id });
      stenoApp.showToast(`आलेख स्थिति बदली गई: ${res.status.toUpperCase()}`, 'info');
      localStorage.removeItem('stenomaster_cached_passages');
      localStorage.setItem('stenomaster_passages_version', Date.now().toString());
      this.loadPassages();
      await stenoApp.loadPassages(true);
    } catch (err) {
      stenoApp.showToast('स्थिति बदलने में त्रुटि: ' + err.message, 'error');
    }
  }

  setTypingSystem(sys) {
    this.currentTypingSystem = sys;
    const sysInput = document.getElementById('passageTypingSystem');
    if (sysInput) sysInput.value = sys;

    const btnMangal = document.getElementById('tabSysMangal');
    const btnKruti = document.getElementById('tabSysKruti');
    const btnDual = document.getElementById('tabSysDual');
    const badge = document.getElementById('currentTypingSystemBadge');
    const wrapMangal = document.getElementById('mangalBoxWrapper');
    const wrapKruti = document.getElementById('krutiBoxWrapper');
    const asteriskMangal = document.getElementById('mangalReqAsterisk');
    const asteriskKruti = document.getElementById('krutiReqAsterisk');

    [btnMangal, btnKruti, btnDual].forEach(b => {
      if (b) {
        b.style.background = 'transparent';
        b.style.color = 'var(--text-primary)';
        b.style.borderColor = 'var(--border)';
      }
    });

    if (sys === 'mangal_unicode') {
      if (btnMangal) { btnMangal.style.background = '#0284c7'; btnMangal.style.color = '#fff'; btnMangal.style.borderColor = '#0284c7'; }
      if (badge) { badge.textContent = 'Mangal / Unicode Only'; badge.style.background = '#e0f2fe'; badge.style.color = '#0284c7'; }
      if (wrapMangal) wrapMangal.style.display = 'block';
      if (wrapKruti) wrapKruti.style.display = 'none';
      if (asteriskMangal) asteriskMangal.style.display = 'inline';
      if (asteriskKruti) asteriskKruti.style.display = 'none';
    } else if (sys === 'kruti_dev_010') {
      if (btnKruti) { btnKruti.style.background = '#d97706'; btnKruti.style.color = '#fff'; btnKruti.style.borderColor = '#d97706'; }
      if (badge) { badge.textContent = 'Kruti Dev 010 Only'; badge.style.background = '#fef3c7'; badge.style.color = '#d97706'; }
      if (wrapMangal) wrapMangal.style.display = 'none';
      if (wrapKruti) wrapKruti.style.display = 'block';
      if (asteriskMangal) asteriskMangal.style.display = 'none';
      if (asteriskKruti) asteriskKruti.style.display = 'inline';
    } else {
      this.currentTypingSystem = 'dual';
      if (sysInput) sysInput.value = 'dual';
      if (btnDual) { btnDual.style.background = '#7c3aed'; btnDual.style.color = '#fff'; btnDual.style.borderColor = '#7c3aed'; }
      if (badge) { badge.textContent = 'Dual Mode (Both)'; badge.style.background = '#f3e8ff'; badge.style.color = '#7c3aed'; }
      if (wrapMangal) wrapMangal.style.display = 'block';
      if (wrapKruti) wrapKruti.style.display = 'block';
      if (asteriskMangal) asteriskMangal.style.display = 'inline';
      if (asteriskKruti) asteriskKruti.style.display = 'inline';
    }
  }

  switchUploadFontTab(mode) {
    if (mode === 'mangal' || mode === 'mangal_unicode') this.setTypingSystem('mangal_unicode');
    else if (mode === 'krutidev' || mode === 'kruti_dev_010') this.setTypingSystem('kruti_dev_010');
    else this.setTypingSystem('dual');
  }

  onMangalInput(val) {
    // Admin reference is authoritative - no silent automatic overwrite on input
  }

  onKrutiInput(val) {
    // Admin reference is authoritative - no silent automatic overwrite on input
  }

  populateCategoryDropdown() {
    const sel = document.getElementById('passageCategorySelect');
    if (!sel) return;
    const cats = (stenoApp && stenoApp.categories && stenoApp.categories.length) ? stenoApp.categories : this.categoriesList;
    if (cats && cats.length) {
      const currentVal = sel.value;
      sel.innerHTML = cats.map(c => `
        <option value="${c.id}">${this.escapeHtml(c.name)}</option>
      `).join('');
      if (currentVal) sel.value = currentVal;
    }
  }

  openNewPassageModal(mode = 'dual') {
    const sys = (mode === 'krutidev' || mode === 'kruti_dev_010')
      ? 'kruti_dev_010'
      : ((mode === 'mangal' || mode === 'mangal_unicode') ? 'mangal_unicode' : 'dual');
    document.getElementById('passageModalTitle').textContent = '📝 नया स्टेनो आलेख जोड़ें (Add Passage)';
    document.getElementById('passageEditId').value = '';
    document.getElementById('passageForm').reset();
    this.populateCategoryDropdown();
    const krutiInput = document.getElementById('passageOfficialKrutiInput');
    if (krutiInput) krutiInput.value = '';
    const mangalInput = document.getElementById('passageOfficialTextInput');
    if (mangalInput) mangalInput.value = '';
    this.clearStenoNotesFile();
    this.renderAudioPreview('');
    this.setTypingSystem(sys);
    stenoApp.openModal('passageEditModal');
  }

  openEditPassage(id) {
    const p = this.passagesList.find(item => item.id === id);
    if (!p) return;

    this.populateCategoryDropdown();
    document.getElementById('passageModalTitle').textContent = 'स्टेनो आलेख संशोधित करें (Edit Passage)';
    document.getElementById('passageEditId').value = p.id;
    document.getElementById('passageTitleInput').value = p.title;
    const catSel = document.getElementById('passageCategorySelect');
    if (catSel) catSel.value = p.category_id;
    document.getElementById('passageLanguageSelect').value = p.language || 'hindi';
    document.getElementById('passageDifficultySelect').value = p.difficulty || 'medium';
    document.getElementById('passageTargetWpmInput').value = p.target_wpm || 40;
    document.getElementById('passageDurationInput').value = p.duration_seconds || 180;
    document.getElementById('passageAudioUrlInput').value = p.audio_url || '';
    this.renderAudioPreview(p.audio_url || '');
    document.getElementById('passageInstructionsInput').value = p.instructions || '';
    document.getElementById('passageOfficialTextInput').value = p.official_text || p.official_mangal_text || '';
    const krutiInput = document.getElementById('passageOfficialKrutiInput');
    if (krutiInput) krutiInput.value = p.official_text_krutidev || p.official_kruti_dev_text || '';
    document.getElementById('passageTagsInput').value = p.tags || '';

    // Steno Notes / Outline attachment
    if (p.steno_notes_url) {
      const urlInput = document.getElementById('passageStenoNotesUrlInput');
      if (urlInput) urlInput.value = p.steno_notes_url;
      const type = p.steno_notes_type || (p.steno_notes_url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
      const typeInput = document.getElementById('passageStenoNotesType');
      if (typeInput) typeInput.value = type;
      this.renderStenoNotesPreview(p.steno_notes_url, p.steno_notes_url.split('/').pop(), type);
    } else {
      this.clearStenoNotesFile();
    }

    const pSys = p.typing_system || (p.official_text && p.official_text_krutidev ? 'dual' : (p.official_text_krutidev ? 'kruti_dev_010' : 'mangal_unicode'));
    this.setTypingSystem(pSys);
    stenoApp.openModal('passageEditModal');
  }

  async convertMangalToKrutiModal() {
    const mangalText = document.getElementById('passageOfficialTextInput').value.trim();
    if (!mangalText) {
      stenoApp.showToast('कृपया पहले मंगल / यूनिकोड टेक्स्ट दर्ज करें।', 'warning');
      return;
    }
    try {
      const res = await stenoApp.apiCall('/api/admin/convert-font', 'POST', {
        text: mangalText,
        direction: 'to_kruti'
      });
      if (res && res.result) {
        document.getElementById('passageOfficialKrutiInput').value = res.result;
        stenoApp.showToast('कृति देव 010 संदर्भ पाठ स्वतः तैयार हो गया! ⚡', 'success');
      }
    } catch (err) {
      stenoApp.showToast('फॉन्ट बदलने में त्रुटि: ' + err.message, 'error');
    }
  }

  async convertKrutiToMangalModal() {
    const krutiText = document.getElementById('passageOfficialKrutiInput').value.trim();
    if (!krutiText) {
      stenoApp.showToast('कृपया पहले कृति देव 010 टेक्स्ट दर्ज करें।', 'warning');
      return;
    }
    try {
      const res = await stenoApp.apiCall('/api/admin/convert-font', 'POST', {
        text: krutiText,
        direction: 'to_mangal'
      });
      if (res && res.result) {
        document.getElementById('passageOfficialTextInput').value = res.result;
        stenoApp.showToast('मंगल (यूनिकोड) संदर्भ पाठ स्वतः तैयार हो गया! ⚡', 'success');
      }
    } catch (err) {
      stenoApp.showToast('फॉन्ट बदलने में त्रुटि: ' + err.message, 'error');
    }
  }

  async savePassage(e) {
    e.preventDefault();
    const id = document.getElementById('passageEditId')?.value;
    const title = document.getElementById('passageTitleInput')?.value.trim();
    const category_id = parseInt(document.getElementById('passageCategorySelect')?.value) || 1;
    const language = document.getElementById('passageLanguageSelect')?.value || 'hindi';
    const difficulty = document.getElementById('passageDifficultySelect')?.value || 'medium';
    const target_wpm = parseInt(document.getElementById('passageTargetWpmInput')?.value) || 40;
    const duration_seconds = parseInt(document.getElementById('passageDurationInput')?.value) || 180;
    const audio_url = document.getElementById('passageAudioUrlInput')?.value.trim() || '';
    const instructions = document.getElementById('passageInstructionsInput')?.value.trim() || '';
    let official_mangal = document.getElementById('passageOfficialTextInput')?.value.trim() || '';
    const krutiInput = document.getElementById('passageOfficialKrutiInput');
    let official_kruti = krutiInput ? krutiInput.value.trim() : '';
    let typing_system = document.getElementById('passageTypingSystem')?.value || this.currentTypingSystem || 'dual';
    const tags = document.getElementById('passageTagsInput')?.value.trim() || '';
    const steno_notes_url = document.getElementById('passageStenoNotesUrlInput')?.value.trim() || '';
    let steno_notes_type = document.getElementById('passageStenoNotesType')?.value || '';
    if (steno_notes_url && !steno_notes_type) {
      steno_notes_type = steno_notes_url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
    }

    if (!title) {
      stenoApp.showToast('आलेख का शीर्षक आवश्यक है।', 'error');
      return;
    }

    // Auto-convert if in Dual mode and user only provided one font text
    if (typing_system === 'dual') {
      if (official_mangal && !official_kruti) {
        try {
          const convRes = await stenoApp.apiCall('/api/admin/convert-font', 'POST', {
            text: official_mangal,
            direction: 'to_kruti'
          });
          if (convRes && convRes.result) {
            official_kruti = convRes.result;
            if (krutiInput) krutiInput.value = official_kruti;
          }
        } catch (cErr) {
          console.warn('Auto convert to kruti fallback:', cErr);
          official_kruti = official_mangal;
        }
      } else if (official_kruti && !official_mangal) {
        try {
          const convRes = await stenoApp.apiCall('/api/admin/convert-font', 'POST', {
            text: official_kruti,
            direction: 'to_mangal'
          });
          if (convRes && convRes.result) {
            official_mangal = convRes.result;
            const mangalInput = document.getElementById('passageOfficialTextInput');
            if (mangalInput) mangalInput.value = official_mangal;
          }
        } catch (cErr) {
          console.warn('Auto convert to mangal fallback:', cErr);
          official_mangal = official_kruti;
        }
      }
    }

    if (!official_mangal && !official_kruti) {
      stenoApp.showToast('कृपया आलेख का संदर्भ पाठ (Text) दर्ज करें।', 'error');
      return;
    }

    // Ensure non-empty text for single font modes
    if (typing_system === 'mangal_unicode' && !official_mangal) {
      official_mangal = official_kruti;
    }
    if (typing_system === 'kruti_dev_010' && !official_kruti) {
      official_kruti = official_mangal;
    }

    const payload = {
      title,
      category_id,
      language,
      difficulty,
      target_wpm,
      duration_seconds,
      audio_url,
      instructions,
      typing_system,
      official_mangal_text: official_mangal,
      official_kruti_dev_text: official_kruti,
      official_text: official_mangal,
      official_text_krutidev: official_kruti,
      steno_notes_url,
      steno_notes_type,
      tags,
      status: 'published'
    };
    if (id) payload.id = parseInt(id);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origBtnText = submitBtn ? submitBtn.innerHTML : '';
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ सहेजा जा रहा है...</span>';
      }
      await stenoApp.apiCall('/api/admin/passages/save', 'POST', payload);
      stenoApp.showToast('आलेख सफलतापूर्ण सहेजा गया! 🎉', 'success');
      stenoApp.closeModal('passageEditModal');
      localStorage.removeItem('stenomaster_cached_passages');
      localStorage.setItem('stenomaster_passages_version', Date.now().toString());
      await this.loadPassages();
      await stenoApp.loadPassages(true);
    } catch (err) {
      stenoApp.showToast('आलेख सहेजने में त्रुटि: ' + (err.message || 'अज्ञात त्रुटि'), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnText || 'आलेख सहेजें (Save)';
      }
    }
  }

  async deletePassage(id) {
    if (!confirm('क्या आप वाकई इस आलेख को हटाना चाहते हैं?')) return;
    try {
      await stenoApp.apiCall('/api/admin/passages/delete', 'POST', { id });
      stenoApp.showToast('आलेख हटा दिया गया।', 'info');
      localStorage.removeItem('stenomaster_cached_passages');
      localStorage.setItem('stenomaster_passages_version', Date.now().toString());
      await this.loadPassages();
      await stenoApp.loadPassages(true);
    } catch (err) {
      stenoApp.showToast('आलेख हटाने में त्रुटि: ' + err.message, 'error');
    }
  }

  async handleAudioFileUpload(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5MB per chunk (safely under Vercel's 4.5MB limit)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    stenoApp.showToast(`ऑडियो अपलोड शुरू (0/${totalChunks})... 🎵`, 'info');

    try {
      let finalAudioUrl = '';
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        // Read chunk as Base64
        const chunkBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result;
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(chunkBlob);
        });

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        stenoApp.showToast(`ऑडियो अपलोड प्रगति: ${percent}% (${i + 1}/${totalChunks})...`, 'info');

        const res = await stenoApp.apiCall('/api/admin/audio-upload-chunk', 'POST', {
          upload_id: uploadId,
          chunk_index: i,
          total_chunks: totalChunks,
          filename: file.name,
          data: chunkBase64
        });

        if (res && res.audio_url) {
          finalAudioUrl = res.audio_url;
        }
      }

      if (finalAudioUrl) {
        const urlInput = document.getElementById('passageAudioUrlInput');
        if (urlInput) urlInput.value = finalAudioUrl;
        this.renderAudioPreview(finalAudioUrl);
        stenoApp.showToast('ऑडियो 100% सफलतापूर्वक अपलोड हुआ! 🎵🎉', 'success');
      } else {
        stenoApp.showToast('ऑडियो अपलोड पूर्ण हुआ, URL सत्यापित करें।', 'info');
      }
    } catch (err) {
      console.error('Audio upload error:', err);
      stenoApp.showToast('ऑडियो अपलोड में विफलता: ' + (err.message || 'त्रुटि'), 'error');
    }
  }

  renderAudioPreview(audioUrl) {
    const wrap = document.getElementById('passageAudioPreviewWrap');
    const player = document.getElementById('passageAudioPreview');
    const badge = document.getElementById('passageAudioDurationBadge');
    if (!wrap || !player) return;

    if (!audioUrl || !audioUrl.trim()) {
      wrap.style.display = 'none';
      player.removeAttribute('src');
      player.load();
      if (badge) badge.textContent = '00:00';
      return;
    }

    wrap.style.display = 'block';
    player.src = audioUrl;
    player.load();

    player.onloadedmetadata = () => {
      if (player.duration && !isNaN(player.duration)) {
        const dur = Math.round(player.duration);
        const mins = Math.floor(dur / 60);
        const secs = dur % 60;
        if (badge) {
          badge.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s (${dur}s)`;
        }
        const durInput = document.getElementById('passageDurationInput');
        if (durInput && (!durInput.value || durInput.value === '180')) {
          durInput.value = dur;
        }
      }
    };
  }

  async handleStenoNotesFileUpload(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(ext)) {
      stenoApp.showToast('अनुमति प्राप्त फ़ाइलें: PNG, JPG, JPEG, WEBP, PDF', 'warning');
      return;
    }

    stenoApp.showToast('स्टेनो फ़ाइल अपलोड हो रही है...', 'info');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const res = await stenoApp.apiCall('/api/admin/steno-notes-upload', 'POST', {
          filename: file.name,
          data: base64Data
        });
        if (res && res.file_url) {
          const urlInput = document.getElementById('passageStenoNotesUrlInput');
          if (urlInput) urlInput.value = res.file_url;
          const type = res.file_type || (ext === 'pdf' ? 'pdf' : 'image');
          const typeInput = document.getElementById('passageStenoNotesType');
          if (typeInput) typeInput.value = type;
          this.renderStenoNotesPreview(res.file_url, res.filename || file.name, type);
          stenoApp.showToast('स्टेनो आउटलाइन फ़ाइल सफलतापूर्वक अपलोड हुई! 📝', 'success');
        }
      } catch (err) {
        stenoApp.showToast('स्टेनो फ़ाइल अपलोड विफल: ' + err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  updateStenoPreviewFromUrl(url) {
    url = (url || '').trim();
    if (!url) {
      this.clearStenoNotesFile();
      return;
    }
    const type = url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
    const typeInput = document.getElementById('passageStenoNotesType');
    if (typeInput) typeInput.value = type;
    this.renderStenoNotesPreview(url, url.split('/').pop(), type);
  }

  renderStenoNotesPreview(url, name, type) {
    const wrap = document.getElementById('stenoNotesPreviewWrap');
    const thumb = document.getElementById('stenoNotesPreviewThumb');
    const nameEl = document.getElementById('stenoNotesPreviewName');
    const typeEl = document.getElementById('stenoNotesPreviewType');
    if (!wrap) return;

    wrap.style.display = 'flex';
    if (nameEl) nameEl.textContent = name || url.split('/').pop() || 'steno_attachment';

    if (type === 'pdf') {
      if (thumb) thumb.innerHTML = '<span style="font-size:1.5rem;">📄</span>';
      if (typeEl) typeEl.textContent = 'PDF दस्तावेज़ (Shorthand Notes)';
    } else {
      if (thumb) {
        thumb.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" alt="preview" onerror="this.parentElement.innerHTML='🖼️'">`;
      }
      if (typeEl) typeEl.textContent = 'इमेज फ़ाइल (Shorthand Image)';
    }
  }

  clearStenoNotesFile() {
    const fileInput = document.getElementById('passageStenoNotesFileInput');
    if (fileInput) fileInput.value = '';
    const urlInput = document.getElementById('passageStenoNotesUrlInput');
    if (urlInput) urlInput.value = '';
    const typeInput = document.getElementById('passageStenoNotesType');
    if (typeInput) typeInput.value = 'image';
    const wrap = document.getElementById('stenoNotesPreviewWrap');
    if (wrap) wrap.style.display = 'none';
  }

  previewStenoNotesFile() {
    const url = document.getElementById('passageStenoNotesUrlInput')?.value.trim();
    const type = document.getElementById('passageStenoNotesType')?.value || (url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    if (!url) {
      stenoApp.showToast('कोई फ़ाइल अपलोड नहीं की गई है।', 'warning');
      return;
    }
    stenoComparisonView.openStenoLightbox(url, type, 'स्टेनो आउटलाइन पूर्वावलोकन');
  }

  openBulkImportModal() {
    stenoApp.openModal('bulkImportModal');
  }

  async processBulkImport() {
    const text = document.getElementById('bulkJsonInput').value.trim();
    if (!text) {
      stenoApp.showToast('कृपया मान्य JSON डेटा दर्ज करें।', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const passages = Array.isArray(parsed) ? parsed : (parsed.passages || []);
      const res = await stenoApp.apiCall('/api/admin/bulk-import', 'POST', { passages });
      stenoApp.showToast(`सफलतापूर्वक ${res.imported_count} आलेख आयात किए गए!`, 'success');
      stenoApp.closeModal('bulkImportModal');
      this.loadPassages();
      stenoApp.loadPassages();
    } catch (err) {
      stenoApp.showToast('अमान्य JSON प्रारूप: ' + err.message, 'error');
    }
  }

  async loadScoringConfig() {
    try {
      const res = await stenoApp.apiCall('/api/settings');
      this.settings = res.settings || {};
      const scoringMode = this.settings.scoring_mode || 'ssc';
      const modeSelect = document.getElementById('adminScoringModeSelect');
      if (modeSelect) modeSelect.value = scoringMode;

      const sscFactor = document.getElementById('adminSscFactorInput');
      if (sscFactor) sscFactor.value = this.settings.ssc_error_factor || '1.0';

      const courtFactor = document.getElementById('adminCourtFactorInput');
      if (courtFactor) courtFactor.value = this.settings.court_error_factor || '1.2';

      const sscGradeC = document.getElementById('adminSscGradeCInput');
      if (sscGradeC) sscGradeC.value = this.settings.ssc_grade_c_cutoff_ur || '5.0';

      const sscGradeD = document.getElementById('adminSscGradeDInput');
      if (sscGradeD) sscGradeD.value = this.settings.ssc_grade_d_cutoff_ur || '7.0';

      const upssscMinWpm = document.getElementById('adminUpssscMinWpmInput');
      if (upssscMinWpm) upssscMinWpm.value = this.settings.upsssc_min_wpm_hindi || '25';

      const upssscMaxErr = document.getElementById('adminUpssscMaxErrInput');
      if (upssscMaxErr) upssscMaxErr.value = this.settings.upsssc_max_error_percent || '5.0';
    } catch (err) {
      console.error('Failed to load scoring config:', err);
    }
  }

  async saveScoringConfig(e) {
    e.preventDefault();
    const scoring_mode = document.getElementById('adminScoringModeSelect').value;
    const ssc_error_factor = document.getElementById('adminSscFactorInput').value;
    const court_error_factor = document.getElementById('adminCourtFactorInput').value;
    const ssc_grade_c_cutoff_ur = document.getElementById('adminSscGradeCInput') ? document.getElementById('adminSscGradeCInput').value : '5.0';
    const ssc_grade_d_cutoff_ur = document.getElementById('adminSscGradeDInput') ? document.getElementById('adminSscGradeDInput').value : '7.0';
    const upsssc_min_wpm_hindi = document.getElementById('adminUpssscMinWpmInput') ? document.getElementById('adminUpssscMinWpmInput').value : '25';
    const upsssc_max_error_percent = document.getElementById('adminUpssscMaxErrInput') ? document.getElementById('adminUpssscMaxErrInput').value : '5.0';

    try {
      await stenoApp.apiCall('/api/admin/settings/update', 'POST', {
        scoring_mode,
        ssc_error_factor,
        court_error_factor,
        ssc_grade_c_cutoff_ur,
        ssc_grade_d_cutoff_ur,
        upsssc_min_wpm_hindi,
        upsssc_max_error_percent
      });
      stenoApp.showToast('परीक्षा मूल्यांकन नियम सफलतापूर्वक सहेजे गए! ✅', 'success');
    } catch (err) {
      stenoApp.showToast('नियम सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  async loadSystemSettings() {
    try {
      const res = await stenoApp.apiCall('/api/settings');
      this.settings = res.settings || {};

      const appNameEl = document.getElementById('adminAppNameInput');
      if (appNameEl) appNameEl.value = this.settings.app_name || 'StenoMaster';

      const taglineEl = document.getElementById('adminTaglineInput');
      if (taglineEl) taglineEl.value = this.settings.tagline || 'Listen. Type. Improve. Master Steno.';

      const dictEl = document.getElementById('adminDailyDictInput');
      if (dictEl) dictEl.value = this.settings.daily_target_dictations || '3';

      const minEl = document.getElementById('adminDailyMinInput');
      if (minEl) minEl.value = this.settings.daily_target_minutes || '15';

      const wpmEl = document.getElementById('adminDailyWpmInput');
      if (wpmEl) wpmEl.value = this.settings.daily_target_wpm || '40';
    } catch (err) {
      console.error('Failed to load system settings:', err);
    }
  }

  async saveSystemSettings(e) {
    e.preventDefault();
    const app_name = document.getElementById('adminAppNameInput').value.trim();
    const tagline = document.getElementById('adminTaglineInput').value.trim();
    const daily_target_dictations = document.getElementById('adminDailyDictInput').value;
    const daily_target_minutes = document.getElementById('adminDailyMinInput').value;
    const daily_target_wpm = document.getElementById('adminDailyWpmInput').value;

    try {
      await stenoApp.apiCall('/api/admin/settings/update', 'POST', {
        app_name,
        tagline,
        daily_target_dictations,
        daily_target_minutes,
        daily_target_wpm
      });
      stenoApp.showToast('सिस्टम ब्रांडिंग व सेटिंग्स सहेजी गईं! 🎉', 'success');
      // Update UI title immediately
      document.querySelectorAll('.brand-name-text').forEach(el => el.textContent = app_name);
      document.querySelectorAll('.brand-tagline-text').forEach(el => el.textContent = tagline);
    } catch (err) {
      stenoApp.showToast('सेटिंग्स सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  openCategoryModal() {
    document.getElementById('catNameInput').value = '';
    document.getElementById('catSlugInput').value = '';
    document.getElementById('catDescInput').value = '';
    stenoApp.openModal('categoryModal');
  }

  async saveCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catNameInput').value.trim();
    let slug = document.getElementById('catSlugInput').value.trim();
    const description = document.getElementById('catDescInput').value.trim();
    const language = document.getElementById('catLanguageSelect').value;

    if (!name) {
      stenoApp.showToast('श्रेणी नाम आवश्यक है।', 'error');
      return;
    }
    if (!slug) {
      slug = 'cat-' + Date.now();
    }

    try {
      await stenoApp.apiCall('/api/admin/categories/save', 'POST', { name, slug, description, language });
      stenoApp.showToast(`श्रेणी '${name}' सफलतापूर्ण जोड़ी गई! 📁`, 'success');
      stenoApp.closeModal('categoryModal');
      await stenoApp.loadCategories();
    } catch (err) {
      stenoApp.showToast('श्रेणी सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  async openUsersModal() {
    stenoApp.openModal('adminUsersModal');
    await this.loadUsers();
  }

  async loadUsers() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">छात्र सूची लोड हो रही है...</td></tr>';
    try {
      const res = await stenoApp.apiCall(`/api/admin/users?_t=${Date.now()}`);
      const rawUsers = res.users || [];
      const users = rawUsers.filter(u => u.role !== 'admin');
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">कोई छात्र पंजीकृत नहीं है।</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => `
        <tr>
          <td style="font-weight:700;">#${u.id}</td>
          <td>
            <div style="font-weight:600; color:var(--text-main);">${this.escapeHtml(u.display_name || u.username)}</div>
            <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${this.escapeHtml(u.student_code || '')}</div>
          </td>
          <td>
            <div>${this.escapeHtml(u.email)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(u.phone || '—')}</div>
          </td>
          <td>
            <span class="badge badge-easy" style="font-size:0.72rem;">
              👨‍🎓 Student
            </span>
            ${u.effective_status === 'active' || u.is_free_access ? '<div style="margin-top:2px;"><span class="badge badge-success" style="font-size:0.65rem;">👑 PRO</span></div>' : ''}
          </td>
          <td>${this.escapeHtml(u.target_exam || 'SSC Stenographer')}</td>
          <td>
            <div style="font-weight:600;">🔥 ${u.streak_days || 0} दिन</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">⭐ ${u.points || 0} अंक</div>
          </td>
          <td>
            <span class="badge" style="background:var(--bg-subtle); color:var(--text-main); font-weight:700;">
              ${u.attempts_count || 0} अभ्यास
            </span>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  // -------------------------------------------------------------------------
  // Subscribers Management & Manual Pro Grant / Revocation
  // -------------------------------------------------------------------------
  async loadSubscribers(filter = 'all', silent = false) {
    if (filter) this.currentSubFilter = filter;
    const tbody = document.getElementById('adminSubscribersTableBody');
    if (!tbody) return;
    if (!silent) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>सब्सक्राइबर सूची लोड हो रही है...</td></tr>';
    }
    try {
      const res = await stenoApp.apiCall(`/api/admin/users?_t=${Date.now()}`);
      const rawUsers = res.users || [];
      // Strictly exclude Admin account from student list
      const studentsOnly = rawUsers.filter(u => u.role !== 'admin');

      // Detect real-time student additions
      if (this.prevStudentCount !== null && studentsOnly.length > this.prevStudentCount) {
        const diff = studentsOnly.length - this.prevStudentCount;
        stenoApp.showToast(`🎉 ${diff} नया छात्र सर्वर पर पंजीकृत हुआ! कुल छात्र: ${studentsOnly.length}`, 'success');
        this.loadOverviewMetricsOnly();
      }
      this.prevStudentCount = studentsOnly.length;
      this.subscribersList = studentsOnly;

      const countBadge = document.getElementById('adminStudentCountBadge');
      if (countBadge) {
        countBadge.textContent = `${this.subscribersList.length} छात्र (लाइव)`;
      }

      this.renderSubscribersTable();
    } catch (err) {
      if (!silent) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  filterSubscribers(filter, btnEl) {
    this.currentSubFilter = filter;
    if (btnEl) {
      document.querySelectorAll('#subscribersFilterPills .sub-filter-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    this.renderSubscribersTable();
  }

  searchSubscribers(query) {
    this.renderSubscribersTable(query);
  }

  renderSubscribersTable(searchQuery = '') {
    const tbody = document.getElementById('adminSubscribersTableBody');
    if (!tbody) return;

    const q = (searchQuery || document.getElementById('subscriberSearchInput')?.value || '').trim().toLowerCase();

    // Ensure Admin is never in student subscribers list
    let filtered = (this.subscribersList || []).filter(u => {
      if (u.role === 'admin') return false;

      // 1. Status filter
      if (this.currentSubFilter === 'active') {
        if (u.effective_status !== 'active' && !u.is_free_access) return false;
      } else if (this.currentSubFilter === 'free_access') {
        if (!u.is_free_access) return false;
      } else if (this.currentSubFilter === 'expired') {
        if (u.effective_status !== 'expired') return false;
      } else if (this.currentSubFilter === 'free') {
        if (u.is_free_access || u.effective_status === 'active') return false;
      }

      // 2. Search filter
      if (q) {
        const name = (u.display_name || u.username || '').toLowerCase();
        const code = (u.student_code || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:28px; color:var(--text-muted);">कोई छात्र/सब्सक्राइबर नहीं मिला।</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const isFreeAccess = !!u.is_free_access;
      const isPro = u.effective_status === 'active' || isFreeAccess;
      const isExpired = u.effective_status === 'expired';

      let statusBadge = `<span class="sub-status-badge free">🆓 Free Tier</span>`;
      let daysBadge = `<span style="color:var(--text-muted);">—</span>`;

      if (isFreeAccess) {
        statusBadge = `<span class="sub-status-badge active-pro" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;">🎁 ऑल फ्री (All Free)</span>`;
        daysBadge = `<span style="font-weight:700; color:#059669;">असीमित (फ्री)</span>`;
      } else if (isPro) {
        const days = u.subscription_days_left;
        statusBadge = `<span class="sub-status-badge active-pro">👑 Active Pro</span>`;
        daysBadge = `<span style="font-weight:700; color:#d97706;">${days >= 9999 ? 'असीमित' : `${days} दिन शेष`}</span>`;
      } else if (isExpired) {
        statusBadge = `<span class="sub-status-badge expired">⏳ Expired</span>`;
        daysBadge = `<span style="color:#dc2626; font-size:0.8rem; font-weight:600;">समाप्त</span>`;
      }

      const freeToggleCol = `
        <div style="display:flex; align-items:center; justify-content:center;">
          <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:${isFreeAccess ? 'rgba(16,185,129,0.14)' : 'var(--bg-subtle)'}; border:1.5px solid ${isFreeAccess ? '#10b981' : 'var(--border)'}; padding:4px 10px; border-radius:20px; transition:all 0.2s;" title="इस छात्र के लिए सभी 24+ एक्सरसाइज फ्री अनलॉक करें">
            <input type="checkbox" ${isFreeAccess ? 'checked' : ''} 
                   onchange="stenoAdmin.toggleUserFreeAccess(${u.id}, this.checked, '${this.escapeHtml(u.display_name || u.username).replace(/'/g, "\\'")}')" 
                   style="width:16px; height:16px; cursor:pointer; accent-color:#059669;">
            <span style="font-size:0.78rem; font-weight:700; color:${isFreeAccess ? '#059669' : 'var(--text-secondary)'};">
              ${isFreeAccess ? '✓ ऑल फ्री' : 'फ्री टिक करें'}
            </span>
          </label>
        </div>
      `;

      let endDateStr = '—';
      if (isFreeAccess) {
        endDateStr = 'लाइफटाइम (असीमित)';
      } else if (u.subscription_end) {
        const d = new Date(u.subscription_end);
        if (!isNaN(d.getTime())) {
          endDateStr = d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }

      const planName = isFreeAccess ? 'All Exercises Free (लाइफटाइम छूट)' : (u.subscription_plan || (isPro ? 'StenoMaster Pro' : 'Free Tier'));

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-main);">${this.escapeHtml(u.display_name || u.username)}</div>
            <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${this.escapeHtml(u.student_code || `#${u.id}`)}</div>
          </td>
          <td>
            <div style="font-size:0.82rem;">${this.escapeHtml(u.email)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(u.phone || '—')}</div>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align:center;">${freeToggleCol}</td>
          <td><span style="font-size:0.8rem; font-weight:600;">${this.escapeHtml(planName)}</span></td>
          <td>${daysBadge}</td>
          <td>
            <span class="badge" style="background:var(--bg-subtle); color:var(--text-main); font-weight:700; font-size:0.75rem;">
              ${u.attempts_count || 0} अभ्यास
            </span>
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:6px;">
              <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; background:linear-gradient(135deg, #10b981, #059669); border-color:#059669;"
                      onclick="stenoAdmin.openGrantProModal(${u.id}, '${this.escapeHtml(u.display_name || u.username).replace(/'/g, "\\'")}', '${this.escapeHtml(u.student_code || '')}', '${u.effective_status}', ${u.subscription_days_left || 0})">
                👑 Pro दें
              </button>
              ${isPro && !isFreeAccess ? `
                <button class="btn-secondary" style="padding:4px 10px; font-size:0.75rem; color:var(--accent-red);"
                        onclick="stenoAdmin.revokePro(${u.id}, '${this.escapeHtml(u.display_name || u.username).replace(/'/g, "\\'")}')">
                  ✕ रद्द
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async toggleUserFreeAccess(userId, isChecked, userName = 'छात्र') {
    try {
      const res = await stenoApp.apiCall('/api/admin/users/toggle-free-access', 'POST', {
        user_id: userId,
        is_free_access: isChecked
      });
      if (res.success) {
        stenoApp.showToast(isChecked 
          ? `🎉 ${userName} के लिए सभी एक्सरसाइज फ्री अनलॉक कर दी गईं!` 
          : `ℹ️ ${userName} की फ्री एक्सेस स्थिति हटा दी गई।`, 'success');
        await this.loadSubscribers(this.currentSubFilter);
      } else {
        stenoApp.showToast(res.error || 'अपडेट विफल रहा', 'error');
        await this.loadSubscribers(this.currentSubFilter);
      }
    } catch (err) {
      stenoApp.showToast('त्रुटि: ' + (err.message || 'फ्री एक्सेस टॉगल विफल'), 'error');
      await this.loadSubscribers(this.currentSubFilter);
    }
  }

  openGrantProModal(userId, userName, studentCode, currentStatus, daysLeft) {
    const infoBox = document.getElementById('grantProStudentInfo');
    const idInput = document.getElementById('grantProUserId');
    const daysSelect = document.getElementById('grantProDaysSelect');
    const customDaysGroup = document.getElementById('grantProCustomDaysGroup');
    const planInput = document.getElementById('grantProPlanNameInput');

    if (idInput) idInput.value = userId;
    if (daysSelect) daysSelect.value = '30';
    if (customDaysGroup) customDaysGroup.style.display = 'none';
    if (planInput) planInput.value = 'StenoMaster Pro';

    if (infoBox) {
      const statusText = currentStatus === 'active' ? `<span style="color:#d97706; font-weight:700;">👑 Pro सक्रिय (${daysLeft} दिन शेष)</span>` : `<span style="color:var(--text-muted);">निःशुल्क टियर (Free Tier)</span>`;
      infoBox.innerHTML = `
        <div><strong>छात्र:</strong> ${this.escapeHtml(userName)} (${this.escapeHtml(studentCode)})</div>
        <div style="margin-top:2px;"><strong>वर्तमान स्थिति:</strong> ${statusText}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
          💡 <em>नोट: यदि छात्र के पास पहले से सक्रिय दिन शेष हैं, तो नए दिन वर्तमान समाप्ति तिथि के आगे स्वतः जुड़ जाएंगे।</em>
        </div>
      `;
    }

    stenoApp.openModal('adminGrantProModal');
  }

  onGrantDaysChange(val) {
    const group = document.getElementById('grantProCustomDaysGroup');
    if (group) group.style.display = val === 'custom' ? 'block' : 'none';
  }

  async submitGrantPro(e) {
    e.preventDefault();
    const userId = document.getElementById('grantProUserId')?.value;
    const daysSelect = document.getElementById('grantProDaysSelect')?.value;
    const customInput = document.getElementById('grantProCustomDaysInput')?.value;
    const planName = document.getElementById('grantProPlanNameInput')?.value.trim() || 'StenoMaster Pro';
    const notes = document.getElementById('grantProNotesInput')?.value.trim();

    let days = parseInt(daysSelect);
    if (daysSelect === 'custom') {
      days = parseInt(customInput);
      if (!days || days <= 0) {
        stenoApp.showToast('कृपया मान्य दिनों की संख्या दर्ज करें', 'error');
        return;
      }
    }

    try {
      const res = await stenoApp.apiCall('/api/admin/users/grant-subscription', 'POST', {
        user_id: parseInt(userId),
        plan_name: planName,
        days: days,
        notes: notes
      });
      stenoApp.closeModal('adminGrantProModal');
      stenoApp.showToast(res.message || 'प्रो सदस्यता सफलतापूर्वक प्रदान की गई! 🎉', 'success');
      await this.loadSubscribers(this.currentSubFilter);
      await this.loadUsers();
    } catch (err) {
      stenoApp.showToast('प्रो सक्रियण विफल: ' + err.message, 'error');
    }
  }

  async revokePro(userId, userName) {
    const reason = prompt(`क्या आप निश्चित रूप से ${userName} की प्रो सदस्यता रद्द करना चाहते हैं?\nकारण दर्ज करें (वैकल्पिक):`, 'एडमिन द्वारा रद्द');
    if (reason === null) return;

    try {
      const res = await stenoApp.apiCall('/api/admin/users/revoke-subscription', 'POST', {
        user_id: parseInt(userId),
        reason: reason
      });
      stenoApp.showToast(res.message || 'सदस्यता रद्द की गई।', 'info');
      await this.loadSubscribers(this.currentSubFilter);
      await this.loadUsers();
    } catch (err) {
      stenoApp.showToast('रद्द करने में त्रुटि: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Payment Verification & Subscription Management
  // -------------------------------------------------------------------------
  async loadPayments() {
    const tbody = document.getElementById('adminPaymentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--text-muted);">भुगतान अनुरोध लोड हो रहे हैं...</td></tr>';
    try {
      const res = await stenoApp.apiCall('/api/admin/payments');
      const payments = res.payments || [];
      if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">कोई भुगतान अनुरोध लंबित नहीं है।</td></tr>';
        return;
      }
      tbody.innerHTML = payments.map(p => {
        const dt = new Date(p.created_at).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let statusBadge = '<span class="badge badge-warning">⏳ Pending</span>';
        if (p.status === 'approved') statusBadge = '<span class="badge badge-success">✅ Approved</span>';
        if (p.status === 'rejected') statusBadge = '<span class="badge badge-hard">❌ Rejected</span>';

        const actionBtns = p.status === 'pending' ? `
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; background:var(--accent-green);" onclick="stenoAdmin.reviewPayment(${p.id}, 'approve')">स्वीकृत करें</button>
            <button class="btn-secondary" style="padding:4px 10px; font-size:0.75rem; color:var(--accent-red);" onclick="stenoAdmin.reviewPayment(${p.id}, 'reject')">अस्वीकृत</button>
          </div>
        ` : `<span style="font-size:0.8rem; color:var(--text-muted);">सत्यापित</span>`;

        return `
          <tr>
            <td style="font-weight:700;">#${p.id}</td>
            <td>
              <div style="font-weight:600;">${this.escapeHtml(p.display_name || p.username)}</div>
              <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${this.escapeHtml(p.student_code || '')}</div>
            </td>
            <td>
              <div style="font-size:0.8rem;">${this.escapeHtml(p.email)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(p.phone || '—')}</div>
            </td>
            <td><span class="badge badge-primary">${this.escapeHtml(p.plan_name)}</span></td>
            <td><strong style="color:var(--primary);">₹${p.amount}</strong></td>
            <td><code>${this.escapeHtml(p.transaction_id)}</code></td>
            <td>${statusBadge}</td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${dt}</td>
            <td>${actionBtns}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async reviewPayment(requestId, action) {
    const notes = prompt(`टिप्पणी दर्ज करें (${action === 'approve' ? 'सदस्यता 30 दिनों के लिए सक्रिय होगी' : 'अनुरोध अस्वीकार होगा'}):`, action === 'approve' ? 'भुगतान सत्यापित एवं स्वीकृत' : 'अमान्य ट्रांजेक्शन आईडी');
    if (notes === null) return;

    try {
      await stenoApp.apiCall('/api/admin/payments/review', 'POST', {
        request_id: requestId,
        action,
        notes
      });
      stenoApp.showToast(`भुगतान #${requestId} को ${action === 'approve' ? 'स्वीकृत' : 'अस्वीकृत'} किया गया! 🎉`, 'success');
      await this.loadPayments();
      await this.loadUsers();
    } catch (err) {
      stenoApp.showToast('समीक्षा विफल: ' + err.message, 'error');
    }
  }

  async loadRewardsLedger() {
    const tbody = document.getElementById('adminRewardsTableBody');
    if (!tbody) return;
    try {
      const res = await stenoApp.apiCall('/api/admin/rewards');
      const txs = res.transactions || [];
      if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">कोई रिवॉर्ड ट्रांजेक्शन नहीं है।</td></tr>';
        return;
      }
      tbody.innerHTML = txs.map(t => {
        const dt = new Date(t.created_at).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
          <tr>
            <td style="font-weight:700;">#${t.id}</td>
            <td>
              <div style="font-weight:600;">${this.escapeHtml(t.display_name || t.username)}</div>
              <div style="font-size:0.72rem; color:var(--primary);">${this.escapeHtml(t.student_code || '')}</div>
            </td>
            <td><strong style="color:#b45309;">+${t.points} Pts</strong></td>
            <td><span class="badge" style="font-size:0.7rem; background:var(--bg-subtle);">${this.escapeHtml(t.type)}</span></td>
            <td><code>${this.escapeHtml(t.reference_id || '—')}</code></td>
            <td style="font-size:0.75rem; color:var(--text-muted);">${dt}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load rewards ledger:', err);
    }
  }

  async loadSubscriptionSettings() {
    try {
      const res = await stenoApp.apiCall('/api/settings');
      const settings = res.settings || {};
      const planNameInput = document.getElementById('adminSubPlanNameInput');
      const planPriceInput = document.getElementById('adminSubPlanPriceInput');
      const p1mInput = document.getElementById('adminSubPrice1m');
      const p3mInput = document.getElementById('adminSubPrice3m');
      const p6mInput = document.getElementById('adminSubPrice6m');
      const p1yInput = document.getElementById('adminSubPrice1y');
      const upiIdInput = document.getElementById('adminSubUpiIdInput');
      const qrPreview = document.getElementById('adminQrPreviewImg');
      const cfAppIdInput = document.getElementById('adminCashfreeAppIdInput');
      const cfSecretInput = document.getElementById('adminCashfreeSecretInput');
      const cfEnvSelect = document.getElementById('adminCashfreeEnvSelect');

      if (planNameInput && settings.subscription_plan_name) planNameInput.value = settings.subscription_plan_name;
      if (planPriceInput && settings.subscription_plan_price) planPriceInput.value = settings.subscription_plan_price;
      if (p1mInput && settings.subscription_price_1m) p1mInput.value = settings.subscription_price_1m;
      if (p3mInput && settings.subscription_price_3m) p3mInput.value = settings.subscription_price_3m;
      if (p6mInput && settings.subscription_price_6m) p6mInput.value = settings.subscription_price_6m;
      if (p1yInput && settings.subscription_price_1y) p1yInput.value = settings.subscription_price_1y;
      if (upiIdInput && settings.subscription_upi_id) upiIdInput.value = settings.subscription_upi_id;
      if (qrPreview && settings.subscription_qr_url) qrPreview.src = `${settings.subscription_qr_url}?t=${Date.now()}`;
      if (cfAppIdInput && settings.cashfree_app_id) cfAppIdInput.value = settings.cashfree_app_id;
      if (cfSecretInput && settings.cashfree_secret_key) cfSecretInput.value = settings.cashfree_secret_key;
      if (cfEnvSelect && settings.cashfree_env) cfEnvSelect.value = settings.cashfree_env;
    } catch (err) {
      console.error('Failed to load subscription settings:', err);
    }
  }

  async saveSubscriptionSettings(e) {
    e.preventDefault();
    const plan_name = document.getElementById('adminSubPlanNameInput')?.value.trim();
    const plan_price = document.getElementById('adminSubPlanPriceInput')?.value.trim();
    const subscription_price_1m = document.getElementById('adminSubPrice1m')?.value.trim();
    const subscription_price_3m = document.getElementById('adminSubPrice3m')?.value.trim();
    const subscription_price_6m = document.getElementById('adminSubPrice6m')?.value.trim();
    const subscription_price_1y = document.getElementById('adminSubPrice1y')?.value.trim();
    const subscription_upi_id = document.getElementById('adminSubUpiIdInput')?.value.trim();
    const cashfree_app_id = document.getElementById('adminCashfreeAppIdInput')?.value.trim();
    const cashfree_secret_key = document.getElementById('adminCashfreeSecretInput')?.value.trim();
    const cashfree_env = document.getElementById('adminCashfreeEnvSelect')?.value || 'SANDBOX';

    try {
      await stenoApp.apiCall('/api/admin/subscription/settings', 'POST', {
        plan_name,
        plan_price,
        subscription_price_1m,
        subscription_price_3m,
        subscription_price_6m,
        subscription_price_1y,
        subscription_upi_id,
        cashfree_app_id,
        cashfree_secret_key,
        cashfree_env
      });
      stenoApp.showToast('सदस्यता सेटिंग्स सफलतापूर्वक सहेजी गईं! ✅', 'success');
      await this.loadSubscriptionSettings();
    } catch (err) {
      stenoApp.showToast('सेटिंग्स सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  handleQrUpload(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      stenoApp.showToast('केवल .png, .jpg, .jpeg, .webp फ़ाइलें स्वीकृत हैं।', 'error');
      inputEl.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      try {
        stenoApp.showToast('QR कोड अपलोड किया जा रहा है... 📤', 'info');
        const res = await stenoApp.apiCall('/api/admin/subscription/upload-qr', 'POST', {
          filename: file.name,
          data: base64Data
        });
        stenoApp.showToast('QR कोड सफलतापूर्वक अपडेट किया गया! 🎉', 'success');
        const qrPreview = document.getElementById('adminQrPreviewImg');
        if (qrPreview) qrPreview.src = `${res.qr_url}?t=${Date.now()}`;
      } catch (err) {
        stenoApp.showToast('QR कोड अपलोड में त्रुटि: ' + err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

window.stenoAdmin = new StenoAdmin();

