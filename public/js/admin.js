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
      'withdrawals': 'छात्र UPI निकासी (Withdrawals) — StenoMaster',
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

    // 2. Hide all admin sub-panels (both via class selector and explicit panel IDs)
    document.querySelectorAll('.admin-sub-panel').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('active');
    });

    const panelIds = [
      'adminOverviewPanel',
      'adminPassagesPanel',
      'adminSubscribersPanel',
      'adminReferralsPanel',
      'adminPaymentsPanel',
      'adminWithdrawalsPanel',
      'adminPricingPanel',
      'adminScoringPanel',
      'adminBrandingPanel',
      'adminCustomClassesPanel',
      'adminAivoicePanel'
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
      'referrals': 'adminReferralsPanel',
      'payments': 'adminPaymentsPanel',
      'withdrawals': 'adminWithdrawalsPanel',
      'adminWithdrawalsPanel',
      'pricing': 'adminPricingPanel',
      'scoring': 'adminScoringPanel',
      'branding': 'adminBrandingPanel',
      'customclasses': 'adminCustomClassesPanel',
      'aivoice': 'adminAivoicePanel'
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
        this.loadCategoriesTable();
        this.loadPassages();
      } else if (tabId === 'payments') {
        this.loadPayments();
      }
      if (tabId === 'withdrawals') {
        this.loadWithdrawals();
      } else if (tabId === 'pricing') {
        this.loadSubscriptionSettings();
        this.loadCategoryPricingTable();
      } else if (tabId === 'scoring') {
        this.loadScoringConfig();
      } else if (tabId === 'branding') {
        this.loadSystemSettings();
      } else if (tabId === 'aivoice') {
        this.initAiVoiceStudio();
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

  populateCategoryDropdown(targetId = null) {
    const sel = document.getElementById('passageCategorySelect');
    if (!sel) return;
    const cats = (this._allCategoriesCache && this._allCategoriesCache.length)
      ? this._allCategoriesCache
      : ((stenoApp && stenoApp.categories && stenoApp.categories.length) ? stenoApp.categories : (this.categoriesList || []));

    if (cats && cats.length) {
      sel.innerHTML = '<option value="">-- श्रेणी चुनें (Select Category) --</option>' + cats.map(c => `
        <option value="${c.id}">${this.escapeHtml(c.name)} (ID: #${c.id})</option>
      `).join('');
      if (targetId) {
        sel.value = String(targetId);
      }
    }
  }

  onPassageCategoryChange(val) {
    const noticeEl = document.getElementById('passageCategoryNotice');
    const noticeNameEl = document.getElementById('passageCategoryNoticeName');
    const sel = document.getElementById('passageCategorySelect');
    if (!sel) return;
    const selectedText = sel.options[sel.selectedIndex]?.text || '';
    if (val && noticeEl && noticeNameEl) {
      noticeEl.style.display = 'flex';
      noticeNameEl.textContent = selectedText;
    } else if (noticeEl) {
      noticeEl.style.display = 'none';
    }
  }

  openNewPassageModal(mode = 'dual', targetCategoryId = null, targetCategoryName = '') {
    const sys = (mode === 'krutidev' || mode === 'kruti_dev_010')
      ? 'kruti_dev_010'
      : ((mode === 'mangal' || mode === 'mangal_unicode') ? 'mangal_unicode' : 'dual');

    const noticeEl = document.getElementById('passageCategoryNotice');
    const noticeNameEl = document.getElementById('passageCategoryNoticeName');
    const titleEl = document.getElementById('passageModalTitle');

    if (targetCategoryId) {
      if (titleEl) titleEl.textContent = `📝 नई क्लास जोड़ें ➔ ${targetCategoryName || 'चयनित श्रेणी'}`;
      if (noticeEl) noticeEl.style.display = 'flex';
      if (noticeNameEl) noticeNameEl.textContent = targetCategoryName || `ID: #${targetCategoryId}`;
    } else {
      if (titleEl) titleEl.textContent = '📝 नया स्टेनो आलेख जोड़ें (Add Passage)';
      if (noticeEl) noticeEl.style.display = 'none';
    }

    document.getElementById('passageEditId').value = '';
    document.getElementById('passageForm').reset();
    this.populateCategoryDropdown(targetCategoryId);

    if (targetCategoryId) {
      const sel = document.getElementById('passageCategorySelect');
      if (sel) sel.value = String(targetCategoryId);
    }

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

      const hostEl = document.getElementById('settingSmtpHost');
      if (hostEl) hostEl.value = this.settings.smtp_host || 'smtp.gmail.com';

      const portEl = document.getElementById('settingSmtpPort');
      if (portEl) portEl.value = this.settings.smtp_port || '587';

      const userEl = document.getElementById('settingSmtpUser');
      if (userEl) userEl.value = this.settings.smtp_user || '';

      const passEl = document.getElementById('settingSmtpPass');
      if (passEl) passEl.value = this.settings.smtp_pass || '';

      const fromEl = document.getElementById('settingSmtpFromName');
      if (fromEl) fromEl.value = this.settings.smtp_from_name || 'StenoMaster Support';
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

  // -------------------------------------------------------------------------
  // Passage Categories Management (Table, Edit, Add, Delete)
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

  async loadCategoriesTable() {
    const tbody = document.getElementById('adminCategoriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>श्रेणियां लोड हो रही हैं...</td></tr>';

    try {
      const res = await stenoApp.apiCall(`/api/categories?_t=${Date.now()}`);
      const cats = res.categories || [];
      if (!cats.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">कोई श्रेणी उपलब्ध नहीं है। ऊपर "➕ नई श्रेणी जोड़ें" पर क्लिक करें।</td></tr>`;
        return;
      }

      this._allCategoriesCache = cats;
      tbody.innerHTML = cats.map(c => {
        const iconDisplay = this.getCategoryIconDisplay(c.icon, c.slug, c.name);
        const pCount = parseInt(c.passage_count || 0, 10);
        const freeCount = parseInt(c.free_count || 0, 10);
        const price = c.price || 49;
        const catJson = JSON.stringify(c).replace(/"/g, '&quot;');

        return `
          <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s;">
            <td style="padding:10px; font-weight:700; color:var(--text-muted);">#${c.id}</td>
            <td style="padding:10px; text-align:center;">
              <div style="width:36px; height:36px; border-radius:10px; background:rgba(99,102,241,0.12); display:inline-flex; align-items:center; justify-content:center; font-size:1.3rem; border:1px solid rgba(99,102,241,0.25);">
                ${iconDisplay}
              </div>
            </td>
            <td style="padding:10px; text-align:center; background:rgba(99,102,241,0.03);">
              <div style="display:inline-flex; align-items:center; gap:5px;">
                <input type="number" id="catOrder_${c.id}" class="cat-sort-order-input form-input" data-cat-id="${c.id}" value="${c.sort_order !== undefined && c.sort_order !== null ? c.sort_order : 0}" min="0" max="9999" style="width:65px; padding:4px 6px; font-weight:800; text-align:center; border:1.5px solid #6366f1; border-radius:8px; font-size:0.92rem; background:#fff;" title="छात्र पोर्टल पर किस नंबर पर दिखेगी (1 = सबसे ऊपर)">
                <button type="button" class="btn-sm btn-primary" onclick="stenoAdmin.saveCategoryOrder(${c.id})" style="padding:5px 8px; font-size:0.75rem; font-weight:700; background:#4f46e5; border-color:#4f46e5; border-radius:8px; cursor:pointer;" title="इस श्रेणी का क्रम नंबर सेव करें">
                  💾
                </button>
              </div>
            </td>
            <td style="padding:10px; font-weight:800; color:var(--text-main); font-size:0.95rem;">
              <div>${stenoApp.escapeHtml(c.name)}</div>
              ${c.description ? `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">${stenoApp.escapeHtml(c.description)}</div>` : ''}
            </td>
            <td style="padding:10px;">
              <code style="font-size:0.78rem; background:var(--bg-subtle); padding:3px 8px; border-radius:6px; color:var(--primary); font-family:monospace;">${stenoApp.escapeHtml(c.slug || '')}</code>
            </td>
            <td style="padding:10px; text-align:center;">
              <span class="badge" style="background:rgba(2,132,199,0.12); color:#0284c7; font-weight:700; padding:3px 10px; border-radius:10px; font-size:0.8rem;">${pCount} डिक्टेशन</span>
            </td>
            <td style="padding:10px; text-align:center;">
              <span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; font-weight:700; padding:3px 10px; border-radius:10px; font-size:0.8rem;">${freeCount} फ्री</span>
            </td>
            <td style="padding:10px; font-weight:800; color:#0284c7; font-size:0.95rem;">
              ₹${price}
            </td>
            <td style="padding:10px; text-align:right;">
              <div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                <button type="button" class="btn-sm btn-primary" onclick="stenoAdmin.openCategoryClassesModal(${c.id}, '${stenoApp.escapeHtml(c.name).replace(/'/g, "\'")}', '${c.icon || ''}')" style="padding:4px 10px; font-size:0.78rem; font-weight:800; background:linear-gradient(135deg, #0284c7, #2563eb); border:none; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(2,132,199,0.3);">
                  <span>📂</span> <span>कक्षाएं (${pCount})</span>
                </button>
                <button type="button" class="btn-sm btn-secondary" onclick="stenoAdmin.openNewPassageModal('dual', ${c.id}, '${stenoApp.escapeHtml(c.name).replace(/'/g, "\'")}')" style="padding:4px 10px; font-size:0.78rem; font-weight:800; border-color:#059669; color:#059669; display:inline-flex; align-items:center; gap:4px;">
                  <span>➕</span> <span>क्लास जोड़ें</span>
                </button>
                <button type="button" class="btn-sm btn-secondary" onclick="stenoAdmin.editCategory(${catJson})" style="padding:4px 8px; font-size:0.78rem; font-weight:700; border-color:#6366f1; color:#4f46e5;">
                  ✏️
                </button>
                <button type="button" class="btn-sm btn-secondary" onclick="stenoAdmin.deleteCategory(${c.id}, '${stenoApp.escapeHtml(c.name).replace(/'/g, "\'")}')" style="padding:4px 8px; font-size:0.78rem; font-weight:700; border-color:#ef4444; color:#ef4444;">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading categories table:', err);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:16px; color:#ef4444;">त्रुटि: ${stenoApp.escapeHtml(err.message || 'लोड करने में विफल')}</td></tr>`;
    }
  }

  openCategoryClassesModal(categoryId, categoryName, categoryIcon) {
    this.activeCategoryModalId = categoryId;
    this.activeCategoryModalName = categoryName;

    const titleEl = document.getElementById('catClassesModalTitle');
    if (titleEl) titleEl.textContent = '📂 ' + categoryName + ' — कक्षाएं प्रबंधन';
    const iconEl = document.getElementById('catClassesModalIcon');
    if (iconEl) iconEl.textContent = this.getCategoryIconDisplay(categoryIcon, '', categoryName);

    stenoApp.openModal('adminCategoryClassesModal');
    this.loadCategoryClasses(categoryId);
  }

  addPassageToCurrentCategory() {
    if (!this.activeCategoryModalId) return;
    stenoApp.closeModal('adminCategoryClassesModal');
    this.openNewPassageModal('dual', this.activeCategoryModalId, this.activeCategoryModalName);
  }

  editCategoryClass(passageId) {
    stenoApp.closeModal('adminCategoryClassesModal');
    this.openEditPassage(passageId);
  }

  async loadCategoryClasses(categoryId) {
    const tbody = document.getElementById('adminCategoryPassagesTableBody');
    const statsEl = document.getElementById('catClassesModalStats');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>कक्षाएं लोड हो रही हैं...</td></tr>';

    try {
      const res = await stenoApp.apiCall('/api/categories/detail?id=' + categoryId + '&_t=' + Date.now());
      const passages = res.passages || [];

      if (statsEl) {
        statsEl.innerHTML = '📊 कुल <strong>' + passages.length + '</strong> कक्षाएं उपलब्ध हैं';
      }

      if (!passages.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px 20px;"><div style="font-size:2rem; margin-bottom:8px;">📭</div><div style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin-bottom:4px;">इस श्रेणी में अभी कोई क्लास नहीं है</div><div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:14px;">छात्रों के लिए अभ्यास कक्षाएं अपलोड करने हेतु नीचे बटन दबाएं</div><button type="button" class="btn-primary" onclick="stenoAdmin.addPassageToCurrentCategory()" style="padding:6px 16px; font-size:0.84rem; font-weight:800;">➕ पहली क्लास अपलोड करें</button></td></tr>';
        return;
      }

      tbody.innerHTML = passages.map(p => {
        const titleSafe = stenoApp.escapeHtml(p.title);
        const durationMins = p.duration_seconds ? Math.round(p.duration_seconds / 60) : 5;
        const words = p.word_count || 400;

        return '<tr style="border-bottom: 1px solid var(--border-subtle);">' +
          '<td style="padding:10px; font-weight:700; color:var(--text-muted);">#' + p.id + '</td>' +
          '<td style="padding:10px; font-weight:800; color:var(--text-main);">' +
            '<div>' + titleSafe + '</div>' +
            (p.is_free_tier ? '<span class="badge" style="background:#10b981; color:#fff; font-size:0.65rem; padding:1px 6px; border-radius:4px;">फ्री डेमो</span>' : '') +
          '</td>' +
          '<td style="padding:10px; text-align:center;">' +
            '<span class="badge" style="background:rgba(2,132,199,0.12); color:#0284c7; font-weight:800; padding:2px 8px; border-radius:6px;">⚡ ' + (p.target_wpm || 80) + ' WPM</span>' +
          '</td>' +
          '<td style="padding:10px; text-align:center; font-size:0.82rem; color:var(--text-muted);">' +
            '⏱️ ' + durationMins + ' मिनट' +
          '</td>' +
          '<td style="padding:10px; text-align:center; font-size:0.82rem; font-weight:600;">' +
            '📝 ' + words + ' शब्द' +
          '</td>' +
          '<td style="padding:10px; text-align:center; font-size:0.8rem;">' +
            (p.audio_url ? '<span style="color:#10b981; font-weight:700;">🎵 ऑडियो सहित</span>' : '<span style="color:var(--text-muted);">म्यूट</span>') +
          '</td>' +
          '<td style="padding:10px; text-align:right;">' +
            '<div style="display:inline-flex; gap:6px;">' +
              '<button type="button" class="btn-sm btn-secondary" onclick="stenoAdmin.editCategoryClass(' + p.id + ')" style="padding:3px 8px; font-size:0.75rem; font-weight:700; border-color:#0284c7; color:#0284c7;">✏️ एडिट</button>' +
              '<button type="button" class="btn-sm btn-secondary" onclick="stenoAdmin.deletePassage(' + p.id + ')" style="padding:3px 8px; font-size:0.75rem; font-weight:700; border-color:#ef4444; color:#ef4444;">🗑️</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    } catch (err) {
      console.error('Error loading category classes:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#ef4444;">त्रुटि: ' + stenoApp.escapeHtml(err.message || 'कक्षाएं लोड नहीं हो सकीं') + '</td></tr>';
    }
  }

  openCategoryModal() {
    document.getElementById('catIdInput').value = '';
    document.getElementById('catNameInput').value = '';
    document.getElementById('catSlugInput').value = '';
    if (document.getElementById('catPriceInput')) document.getElementById('catPriceInput').value = '49';
    if (document.getElementById('catSortOrderInputModal')) document.getElementById('catSortOrderInputModal').value = '1';
    if (document.getElementById('catIconInput')) document.getElementById('catIconInput').value = '🪶';
    document.getElementById('catDescInput').value = '';
    document.getElementById('catLanguageSelect').value = 'both';

    const titleEl = document.getElementById('catModalTitle');
    if (titleEl) titleEl.textContent = '➕ नई श्रेणी जोड़ें (Create Category)';
    const btnEl = document.getElementById('catModalSubmitBtn');
    if (btnEl) btnEl.textContent = '💾 श्रेणी जोड़ें (Create)';

    stenoApp.openModal('categoryModal');
  }

  editCategory(cat) {
    if (!cat) return;
    document.getElementById('catIdInput').value = cat.id || '';
    document.getElementById('catNameInput').value = cat.name || '';
    document.getElementById('catSlugInput').value = cat.slug || '';
    if (document.getElementById('catPriceInput')) document.getElementById('catPriceInput').value = cat.price !== undefined ? cat.price : 49;
    if (document.getElementById('catSortOrderInputModal')) document.getElementById('catSortOrderInputModal').value = cat.sort_order !== undefined ? cat.sort_order : 0;
    if (document.getElementById('catIconInput')) document.getElementById('catIconInput').value = cat.icon || cat.icon_emoji || '🪶';
    document.getElementById('catDescInput').value = cat.description || '';
    document.getElementById('catLanguageSelect').value = cat.language || 'both';

    const titleEl = document.getElementById('catModalTitle');
    if (titleEl) titleEl.textContent = `✏️ श्रेणी संपादित करें: ${cat.name}`;
    const btnEl = document.getElementById('catModalSubmitBtn');
    if (btnEl) btnEl.textContent = '💾 परिवर्तन सहेजें (Update)';

    stenoApp.openModal('categoryModal');
  }

  async saveCategory(e) {
    e.preventDefault();
    const catId = document.getElementById('catIdInput')?.value.trim();
    const name = document.getElementById('catNameInput').value.trim();
    let slug = document.getElementById('catSlugInput').value.trim();
    const description = document.getElementById('catDescInput').value.trim();
    const language = document.getElementById('catLanguageSelect').value;
    const price = parseInt(document.getElementById('catPriceInput')?.value || '49', 10);
    const icon = document.getElementById('catIconInput')?.value.trim() || 'book';

    if (!name) {
      stenoApp.showToast('श्रेणी नाम आवश्यक है।', 'error');
      return;
    }
    if (!slug) {
      slug = 'cat-' + Date.now();
    }

    const sortOrderVal = parseInt(document.getElementById('catSortOrderInputModal')?.value || '0', 10);
    const sort_order = isNaN(sortOrderVal) ? 0 : sortOrderVal;

    try {
      const payload = {
        name,
        slug,
        description,
        language,
        icon,
        price,
        sort_order
      };
      if (catId) {
        payload.category_id = parseInt(catId, 10);
      }

      stenoApp.showToast(catId ? 'श्रेणी अपडेट हो रही है...' : 'श्रेणी जोड़ी जा रही है...', 'info');
      const res = await stenoApp.apiCall('/api/admin/categories/save', 'POST', payload);
      if (res && res.success) {
        stenoApp.showToast(`✓ श्रेणी '${name}' सफलतापूर्वक सहेजी गई! 📁`, 'success');
        stenoApp.closeModal('categoryModal');
        await this.loadCategoriesTable();
        if (typeof this.loadCategoryPricingTable === 'function') {
          this.loadCategoryPricingTable();
        }
        await stenoApp.loadCategories();
      } else {
        throw new Error(res.error || 'सहेजने में विफल');
      }
    } catch (err) {
      stenoApp.showToast('श्रेणी सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  async deleteCategory(catId, catName) {
    if (!catId) return;
    const ok = confirm(`क्या आप श्रेणी "${catName}" (ID: #${catId}) को हटाना चाहते हैं?

ध्यान दें: यदि इस श्रेणी में पहले से डिक्टेशन्स हैं तो यह डिलीट नहीं होगी।`);
    if (!ok) return;

    try {
      stenoApp.showToast('श्रेणी हटाई जा रही है...', 'info');
      const res = await stenoApp.apiCall('/api/admin/categories/delete', 'POST', { id: catId, category_id: catId });
      if (res && res.success) {
        stenoApp.showToast(`✓ श्रेणी "${catName}" सफलतापूर्वक हटा दी गई!`, 'success');
        await this.loadCategoriesTable();
        if (typeof this.loadCategoryPricingTable === 'function') {
          this.loadCategoryPricingTable();
        }
        await stenoApp.loadCategories();
      } else {
        throw new Error(res.error || 'डिलीट करने में विफल');
      }
    } catch (err) {
      stenoApp.showToast(err.message || 'त्रुटि हुई', 'error');
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
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="badge" style="background:var(--bg-subtle); color:var(--text-main); font-weight:700;">
                ${u.attempts_count || 0} अभ्यास
              </span>
              <button type="button" class="btn-sm btn-secondary" style="padding:2px 8px; font-size:0.75rem; color:#dc2626; border-color:rgba(220,38,38,0.3); font-weight:600;" onclick="adminApp.openResetPasswordModal(${u.id}, '${this.escapeHtml(u.display_name || u.username)}')">
                🔑 पासवर्ड
              </button>
            </div>
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

      const days = u.subscription_days_left || 0;
      if (isFreeAccess) {
        statusBadge = `<span class="sub-status-badge active-pro" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;">🎁 30D फ्री प्रो</span>`;
        daysBadge = `<span style="font-weight:700; color:#059669;">${days > 0 ? `${days} दिन शेष` : 'समाप्त'}</span>`;
      } else if (isPro) {
        statusBadge = `<span class="sub-status-badge active-pro">👑 Active Pro</span>`;
        daysBadge = `<span style="font-weight:700; color:#d97706;">${days >= 9999 ? 'असीमित' : (days > 0 ? `${days} दिन शेष` : 'समाप्त')}</span>`;
      } else if (isExpired) {
        statusBadge = `<span class="sub-status-badge expired">⏳ Expired</span>`;
        daysBadge = `<span style="color:#dc2626; font-size:0.8rem; font-weight:600;">समाप्त</span>`;
      }

      const freeToggleCol = `
        <div style="display:flex; align-items:center; justify-content:center;">
          <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:${isFreeAccess ? 'rgba(16,185,129,0.14)' : 'var(--bg-subtle)'}; border:1.5px solid ${isFreeAccess ? '#10b981' : 'var(--border)'}; padding:4px 10px; border-radius:20px; transition:all 0.2s;" title="इस छात्र को 30 दिन का प्रो प्लान फ्री दें">
            <input type="checkbox" ${isFreeAccess ? 'checked' : ''} 
                   onchange="stenoAdmin.toggleUserFreeAccess(${u.id}, this.checked, '${this.escapeHtml(u.display_name || u.username).replace(/'/g, "\\'")}')" 
                   style="width:16px; height:16px; cursor:pointer; accent-color:#059669;">
            <span style="font-size:0.78rem; font-weight:700; color:${isFreeAccess ? '#059669' : 'var(--text-secondary)'};">
              ${isFreeAccess ? '✓ 30D फ्री' : 'फ्री टिक करें'}
            </span>
          </label>
        </div>
      `;

      let endDateStr = '—';
      if (u.subscription_end) {
        const d = new Date(u.subscription_end);
        if (!isNaN(d.getTime())) {
          endDateStr = d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }

      const planName = u.subscription_plan || (isFreeAccess ? 'StenoMaster Pro (30 दिन फ्री)' : (isPro ? 'StenoMaster Pro' : 'Free Tier'));

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-main);">${this.escapeHtml(u.display_name || u.username)}</div>
            <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${this.escapeHtml(u.student_code || `#${u.id}`)}</div>
            <div style="display:flex; gap:6px; align-items:center; margin-top:3px; flex-wrap:wrap;">
              ${u.referral_code ? `<span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; font-size:0.7rem; font-weight:700;" title="छात्र का रेफरल कोड">🔑 ${this.escapeHtml(u.referral_code)}</span>` : ''}
              ${u.referrals_count > 0 ? `<span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; font-size:0.7rem; font-weight:700;" title="सफल रेफरल्स">👥 ${u.referrals_count} रेफरल (+${u.referral_points_earned || 0} Pts)</span>` : ''}
            </div>
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
          ? `🎉 ${userName} को 30 दिन का प्रो प्लान फ्री दिया गया!` 
          : `ℹ️ ${userName} की फ्री प्रो एक्सेस हटा दी गई।`, 'success');
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
      const googleClientIdInput = document.getElementById('adminGoogleClientIdInput');
      const googleAuthEnabled = document.getElementById('adminGoogleAuthEnabled');

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
      if (googleClientIdInput && settings.google_client_id !== undefined) googleClientIdInput.value = settings.google_client_id || '';
      if (googleAuthEnabled && settings.google_auth_enabled !== undefined) {
        googleAuthEnabled.checked = (settings.google_auth_enabled === '1' || settings.google_auth_enabled === true || settings.google_auth_enabled === 'true');
      }
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
    const smtp_host = document.getElementById('settingSmtpHost')?.value.trim() || 'smtp.gmail.com';
    const smtp_port = document.getElementById('settingSmtpPort')?.value.trim() || '587';
    const smtp_user = document.getElementById('settingSmtpUser')?.value.trim() || '';
    const smtp_pass = document.getElementById('settingSmtpPass')?.value.trim() || '';
    const smtp_from_name = document.getElementById('settingSmtpFromName')?.value.trim() || 'StenoMaster Support';
    const google_client_id = document.getElementById('adminGoogleClientIdInput')?.value.trim();
    const google_auth_enabled = document.getElementById('adminGoogleAuthEnabled')?.checked ? '1' : '0';

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
        cashfree_env,
        google_client_id,
        google_auth_enabled
      });
      stenoApp.showToast('सदस्यता एवं Google सेटिंग्स सफलतापूर्वक सहेजी गईं! ✅', 'success');
      await this.loadSubscriptionSettings();
        this.loadCategoryPricingTable();
    } catch (err) {
      stenoApp.showToast('सेटिंग्स सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

  async loadCategoryPricingTable() {
    const tbody = document.getElementById('adminCategoryPricingTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">लोड हो रहा है...</td></tr>';
    try {
      const res = await stenoApp.apiCall(`/api/categories?_t=${Date.now()}`);
      const cats = res.categories || [];
      if (!cats.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">कोई श्रेणी उपलब्ध नहीं है।</td></tr>';
        return;
      }
      tbody.innerHTML = cats.map(c => `
        <tr style="border-bottom:1px solid var(--border-subtle);">
          <td style="padding:10px; font-weight:600;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.2rem;">${c.icon || '📂'}</span>
              <div>
                <div>${stenoApp.escapeHtml(c.name)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${c.slug || ''}</div>
              </div>
            </div>
          </td>
          <td style="padding:10px;"><span class="badge" style="background:rgba(59,130,246,0.1); color:#2563eb; padding:2px 8px; border-radius:12px; font-weight:600;">${c.passage_count || 0} टेस्ट</span></td>
          <td style="padding:10px;"><span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; padding:2px 8px; border-radius:12px; font-weight:600;">${c.free_count || 0} फ्री</span></td>
          <td style="padding:10px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-weight:700;">₹</span>
              <input type="number" id="catPriceInput_${c.id}" class="form-input" value="${c.price || 49}" min="0" max="9999" style="width:90px; padding:4px 8px; font-weight:700;">
            </div>
          </td>
          <td style="padding:10px; text-align:right;">
            <button type="button" class="btn-sm btn-primary" onclick="stenoAdmin.saveCategoryPrice(${c.id})" style="padding:4px 12px; font-size:0.8rem; font-weight:600;">
              💾 सेव मूल्य
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error loading category pricing:', err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:#ef4444;">त्रुटि: ${stenoApp.escapeHtml(err.message || 'लोड करने में विफल')}</td></tr>`;
    }
  }

    async saveCategoryOrder(catId) {
    const input = document.getElementById(`catOrder_${catId}`);
    if (!input) return;
    const order = parseInt(input.value, 10);
    if (isNaN(order) || order < 0) {
      stenoApp.showToast('कृपया वैध क्रम संख्या (0 या अधिक) दर्ज करें!', 'error');
      return;
    }
    try {
      stenoApp.showToast('श्रेणी क्रम अपडेट हो रहा है...', 'info');
      const res = await stenoApp.apiCall('/api/admin/categories/update-order', 'POST', {
        category_id: catId,
        sort_order: order
      });
      if (res && res.success) {
        stenoApp.showToast(`✓ श्रेणी का क्रम #${order} सफलतापूर्वक सेव हो गया! 🎯`, 'success');
        await this.loadCategoriesTable();
        if (typeof stenoApp.loadCategories === 'function') {
          await stenoApp.loadCategories();
        }
      } else {
        throw new Error(res.error || 'अपडेट विफल');
      }
    } catch (err) {
      stenoApp.showToast('क्रम सेव करने में त्रुटि: ' + err.message, 'error');
    }
  }

  async saveAllCategoryOrders() {
    const inputs = document.querySelectorAll('.cat-sort-order-input');
    if (!inputs.length) {
      stenoApp.showToast('कोई श्रेणी उपलब्ध नहीं है!', 'warning');
      return;
    }
    const orders = [];
    inputs.forEach(inp => {
      const catId = parseInt(inp.getAttribute('data-cat-id'), 10);
      const order = parseInt(inp.value, 10);
      if (!isNaN(catId) && !isNaN(order)) {
        orders.push({ category_id: catId, sort_order: order });
      }
    });

    try {
      stenoApp.showToast('सभी श्रेणियों का क्रम अपडेट हो रहा है...', 'info');
      const res = await stenoApp.apiCall('/api/admin/categories/update-order', 'POST', {
        orders: orders
      });
      if (res && res.success) {
        stenoApp.showToast('✓ सभी श्रेणियों का क्रम सफलतापूर्वक सुरक्षित हो गया! 🎯', 'success');
        await this.loadCategoriesTable();
        if (typeof stenoApp.loadCategories === 'function') {
          await stenoApp.loadCategories();
        }
      } else {
        throw new Error(res.error || 'क्रम सेव करने में विफल');
      }
    } catch (err) {
      stenoApp.showToast('क्रम सेव करने में त्रुटि: ' + err.message, 'error');
    }
  }

  async saveCategoryPrice(catId) {
    const input = document.getElementById(`catPriceInput_${catId}`);
    if (!input) return;
    const price = parseInt(input.value, 10);
    if (isNaN(price) || price < 0) {
      stenoApp.showToast('कृपया वैध मूल्य (0 या अधिक) दर्ज करें!', 'error');
      return;
    }
    try {
      stenoApp.showToast('मूल्य अपडेट हो रहा है...', 'info');
      const res = await stenoApp.apiCall('/api/admin/categories/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: catId, price })
      });
      if (res && res.success) {
        stenoApp.showToast(`श्रेणी मूल्य सफलतापूर्वक ₹${price} सेट किया गया!`, 'success');
      } else {
        stenoApp.showToast(res.error || 'मूल्य अपडेट नहीं हो सका', 'error');
      }
    } catch (err) {
      console.error('Save category price error:', err);
      stenoApp.showToast(err.message || 'त्रुटि हुई', 'error');
    }
  }


  async handleQrUpload(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      stenoApp.showToast('केवल .png, .jpg, .jpeg, .webp फ़ाइलें स्वीकृत हैं।', 'error');
      inputEl.value = '';
      return;
    }

    try {
      stenoApp.showToast('QR कोड प्रोसेस एवं अपलोड किया जा रहा है... 📤', 'info');

      // Downscale large camera photos safely via canvas to keep payload small (<100KB) and fast
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 800;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(e.target.result);
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await stenoApp.apiCall('/api/admin/subscription/upload-qr', 'POST', {
        filename: file.name,
        data: base64Data
      });

      stenoApp.showToast('QR कोड सफलतापूर्वक अपडेट किया गया! 🎉', 'success');
      const qrPreview = document.getElementById('adminQrPreviewImg');
      if (qrPreview) qrPreview.src = `${res.qr_url}?t=${Date.now()}`;
      inputEl.value = '';
    } catch (err) {
      stenoApp.showToast('QR कोड अपलोड में त्रुटि: ' + err.message, 'error');
    }
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



  // -------------------------------------------------------------------------
  // Referrals & Rewards Audit Panel
  // -------------------------------------------------------------------------
  async loadReferralsAudit() {
    this.loadWalletSettings();
    const topTbody = document.getElementById('adminTopReferrersTableBody');
    const allTbody = document.getElementById('adminReferralsTableBody');
    if (topTbody) topTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>रेफरल डेटा लोड हो रहा है...</td></tr>';
    if (allTbody) allTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px;"></div>रेफरल ऑडिट लॉग लोड हो रहा है...</td></tr>';

    try {
      const res = await stenoApp.apiCall(`/api/admin/referrals?_t=${Date.now()}`);
      this.adminReferralsData = res || { summary: {}, referrals: [], top_referrers: [] };

      // Update Summary Cards
      const summary = this.adminReferralsData.summary || {};
      const totRefEl = document.getElementById('adminTotalReferralsCount');
      if (totRefEl) totRefEl.textContent = summary.total_referrals || 0;

      const totPtsEl = document.getElementById('adminTotalReferralPoints');
      if (totPtsEl) totPtsEl.textContent = `${summary.total_points_distributed || 0} Pts`;

      const uniqEl = document.getElementById('adminUniqueReferrersCount');
      if (uniqEl) uniqEl.textContent = summary.unique_referrers || 0;

      const topRef = summary.top_referrer;
      const topNameEl = document.getElementById('adminTopReferrerName');
      const topStatsEl = document.getElementById('adminTopReferrerStats');
      if (topRef) {
        if (topNameEl) topNameEl.textContent = topRef.display_name || topRef.username || '—';
        if (topStatsEl) topStatsEl.textContent = `${topRef.total_referrals || 0} रेफरल • ${topRef.total_earned || 0} Pts`;
      } else {
        if (topNameEl) topNameEl.textContent = 'कोई नहीं';
        if (topStatsEl) topStatsEl.textContent = '0 रेफरल';
      }

      const topBadge = document.getElementById('adminTopReferrersBadge');
      if (topBadge) topBadge.textContent = `${(this.adminReferralsData.top_referrers || []).length} छात्र`;

      this.renderAdminReferralsTables();
    } catch (err) {
      console.error('Failed to load admin referrals:', err);
      if (topTbody) topTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
      if (allTbody) allTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  renderAdminReferralsTables(searchQuery = '') {
    const topTbody = document.getElementById('adminTopReferrersTableBody');
    const allTbody = document.getElementById('adminReferralsTableBody');
    if (!this.adminReferralsData) return;

    const topList = this.adminReferralsData.top_referrers || [];
    const allList = this.adminReferralsData.referrals || [];

    // Render Top Referrers Table
    if (topTbody) {
      if (topList.length === 0) {
        topTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">अभी तक किसी छात्र ने रेफरल नहीं किया है।</td></tr>';
      } else {
        topTbody.innerHTML = topList.map((st, idx) => {
          const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx+1}`));
          return `
            <tr style="border-bottom: 1px solid var(--border-subtle);">
              <td style="padding:10px 12px; font-weight:700;">${medal}</td>
              <td style="padding:10px 12px;">
                <div style="font-weight:700; color:var(--text-main);">${this.escapeHtml(st.display_name || st.username)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(st.student_code || '')} • ${this.escapeHtml(st.email || '')}</div>
              </td>
              <td style="padding:10px 12px;">
                <code style="background:var(--bg-subtle); padding:2px 6px; border-radius:4px; font-weight:700; color:var(--primary);">${this.escapeHtml(st.referral_code || '—')}</code>
              </td>
              <td style="padding:10px 12px; font-weight:700; color:#059669;">
                👥 ${st.total_referrals} छात्र
              </td>
              <td style="padding:10px 12px; font-weight:700; color:#10b981;">
                +${st.total_earned} Pts
              </td>
              <td style="padding:10px 12px; font-weight:600; color:var(--text-secondary);">
                💰 ${st.current_balance || 0} Pts
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Filter & Render All Referrals Audit Log Table
    if (allTbody) {
      const q = (searchQuery || document.getElementById('adminReferralSearchInput')?.value || '').trim().toLowerCase();
      let filtered = allList;
      if (q) {
        filtered = allList.filter(r => {
          const rName = (r.referrer_display_name || r.referrer_username || '').toLowerCase();
          const rEmail = (r.referrer_email || '').toLowerCase();
          const rCode = (r.referral_code || '').toLowerCase();
          const fName = (r.referred_display_name || r.referred_username || '').toLowerCase();
          const fEmail = (r.referred_email || '').toLowerCase();
          return rName.includes(q) || rEmail.includes(q) || rCode.includes(q) || fName.includes(q) || fEmail.includes(q);
        });
      }

      if (filtered.length === 0) {
        allTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">कोई रेफरल रिकॉर्ड नहीं मिला।</td></tr>';
      } else {
        allTbody.innerHTML = filtered.map((r, idx) => {
          const dateStr = r.created_at ? new Date(r.created_at).toLocaleString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
          return `
            <tr style="border-bottom: 1px solid var(--border-subtle);">
              <td style="padding:10px 12px; color:var(--text-muted);">${idx + 1}</td>
              <td style="padding:10px 12px;">
                <div style="font-weight:700; color:var(--text-main);">${this.escapeHtml(r.referrer_display_name || r.referrer_username || 'छात्र')}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(r.referrer_student_code || '')} • ${this.escapeHtml(r.referrer_email || '')}</div>
              </td>
              <td style="padding:10px 12px;">
                <code style="background:var(--bg-subtle); padding:2px 6px; border-radius:4px; font-weight:700; color:var(--primary);">${this.escapeHtml(r.referral_code || '')}</code>
              </td>
              <td style="padding:10px 12px;">
                <div style="font-weight:700; color:#0284c7;">🎓 ${this.escapeHtml(r.referred_display_name || r.referred_username || 'नया छात्र')}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(r.referred_student_code || '')} • ${this.escapeHtml(r.referred_email || '')}</div>
              </td>
              <td style="padding:10px 12px; font-weight:700; color:#10b981;">
                +${r.reward_points || 100} Pts
              </td>
              <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-secondary);">
                ${dateStr}
              </td>
              <td style="padding:10px 12px;">
                <span class="badge badge-success" style="background:#dcfce7; color:#15803d; font-size:0.75rem; padding:3px 8px; border-radius:12px;">
                  ✓ क्रेडिटेड (${r.status || 'completed'})
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  searchReferrals(query) {
    this.renderAdminReferralsTables(query);
  }

  // =========================================================================
  // AI VOICE DICTATION STUDIO METHODS
  // =========================================================================
  async populateAiStudioCategories(targetId = null) {
    const sel = document.getElementById('aiStudioCategorySelect');
    if (!sel) return;

    let cats = (this._allCategoriesCache && this._allCategoriesCache.length)
      ? this._allCategoriesCache
      : (this.categoriesList && this.categoriesList.length ? this.categoriesList : []);

    if (!cats.length) {
      try {
        const res = await stenoApp.apiCall('/api/categories');
        cats = res.categories || [];
        this._allCategoriesCache = cats;
      } catch (e) {
        console.warn('Could not fetch categories for AI studio:', e);
      }
    }

    if (cats && cats.length) {
      sel.innerHTML = '<option value="">-- श्रेणी चुनें (Select Category) --</option>' + cats.map(c => `
        <option value="${c.id}">${this.escapeHtml(c.name)} (ID: #${c.id})</option>
      `).join('');
      if (targetId) {
        sel.value = String(targetId);
      } else if (this.activeCategoryModalId) {
        sel.value = String(this.activeCategoryModalId);
      }
    } else {
      sel.innerHTML = '<option value="1">रामधारी सिंह दिनकर (ID: #1)</option>';
    }
  }

  initAiVoiceStudio() {
    this.populateAiStudioCategories();
    this.updateAiStudioStats();
  }

  setAiStudioVoice(voice, btnEl) {
    const hidden = document.getElementById('aiStudioVoiceVal');
    if (hidden) hidden.value = voice;

    const pills = document.querySelectorAll('#aiStudioVoicePills .sub-filter-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    stenoApp.showToast(`डिक्टेटर स्वर: ${voice === 'female' ? '👩 महिला (Swara)' : '👨 पुरुष (Madhur)'} चुना गया`, 'info');
  }

  setAiStudioSpeed(wpm, btnEl) {
    const hidden = document.getElementById('aiStudioSpeedVal');
    if (hidden) hidden.value = wpm;

    const pills = document.querySelectorAll('#aiStudioSpeedPills .sub-filter-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const badge = document.getElementById('aiStudioSpeedBadge');
    if (badge) {
      const descriptions = {
        60: '60 WPM (शुरुआती अभ्यास)',
        80: '80 WPM (मानक SSC / UPSSSC / कोर्ट)',
        100: "100 WPM (SSC 'C' / हाई कोर्ट)",
        120: '120 WPM (संसदीय रिपोर्टर)',
        140: '140 WPM (सुपर स्पीड)'
      };
      badge.textContent = descriptions[wpm] || `${wpm} WPM`;
    }

    this.updateAiStudioStats();
  }

  updateAiStudioStats() {
    const textInput = document.getElementById('aiStudioTextInput');
    const wordCountEl = document.getElementById('aiStudioWordCount');
    const estTimeEl = document.getElementById('aiStudioEstTime');
    if (!textInput || !wordCountEl || !estTimeEl) return;

    const text = textInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const wpm = parseInt(document.getElementById('aiStudioSpeedVal')?.value || 80, 10);

    const totalSeconds = words > 0 ? Math.max(10, Math.round((words / wpm) * 60)) : 0;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    wordCountEl.textContent = `कुल शब्द: ${words}`;
    estTimeEl.textContent = `⏱️ अनुमानित समय: ${timeStr}`;
  }

  previewAiSpeechLive() {
    if (!('speechSynthesis' in window)) {
      stenoApp.showToast('आपके ब्राउज़र में स्पीच सिंथेसिस समर्थित नहीं है।', 'warning');
      return;
    }

    const text = document.getElementById('aiStudioTextInput')?.value.trim();
    if (!text) {
      stenoApp.showToast('कृपया पहले हिंदी आलेख पेस्ट करें।', 'warning');
      return;
    }

    window.speechSynthesis.cancel();

    // Take first 1-2 sentences for preview
    const sentences = text.split(/[।\n!?]/).filter(s => s.trim());
    const sampleText = sentences.slice(0, 2).join('। ') + '।';

    const wpm = parseInt(document.getElementById('aiStudioSpeedVal')?.value || 80, 10);
    const rateMap = { 60: 0.65, 80: 0.82, 100: 0.98, 120: 1.15, 140: 1.3 };
    const speechRate = rateMap[wpm] || 0.85;

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = 'hi-IN';
    utterance.rate = speechRate;

    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
    if (hindiVoice) utterance.voice = hindiVoice;

    stenoApp.showToast(`लाइव आवाज़ टेस्ट शुरू (${wpm} WPM)... 🔊`, 'info');
    window.speechSynthesis.speak(utterance);
  }

  stopLiveSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      stenoApp.showToast('लाइव आवाज़ रोकी गई।', 'info');
    }
  }

  async handleAiStudioPhotoUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    input.value = '';

    const progressBox = document.getElementById('aiStudioOcrProgressBox');
    const statusText = document.getElementById('aiStudioOcrStatusText');
    const percentText = document.getElementById('aiStudioOcrPercentText');
    const progressBar = document.getElementById('aiStudioOcrProgressBar');
    const photoBtn = document.getElementById('aiStudioPhotoBtn');

    if (progressBox) progressBox.style.display = 'block';
    if (photoBtn) photoBtn.disabled = true;

    try {
      stenoApp.showToast('📷 फोटो स्कैन की जा रही है (OCR)...', 'info');

      if (!window.stenoOcr) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/js/ocr_service.js?v=1.1';
          s.onload = resolve;
          s.onerror = () => reject(new Error('OCR इंजन लोड करने में असमर्थ'));
          document.head.appendChild(s);
        });
      }

      const result = await window.stenoOcr.extractText(file, ({ status, percent }) => {
        if (statusText) statusText.textContent = `🔍 ${status}`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;
      });

      if (!result.text || result.text.length < 5) {
        stenoApp.showToast('फोटो में कोई स्पष्ट टेक्स्ट नहीं मिला। कृपया साफ फोटो अपलोड करें।', 'warning');
        return;
      }

      const ta = document.getElementById('aiStudioTextInput');
      if (ta) {
        if (ta.value.trim().length > 0) {
          ta.value = ta.value.trim() + '\n\n' + result.text;
        } else {
          ta.value = result.text;
        }
        this.updateAiStudioStats();
        ta.focus();
      }

      stenoApp.showToast(`✓ फोटो से ${result.wordCount} शब्द आलेख में जोड़ दिए गए! 🎉`, 'success');

      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
      }, 2500);

    } catch (err) {
      console.error('Admin Photo OCR error:', err);
      stenoApp.showToast(`OCR स्कैन त्रुटि: ${err.message}`, 'error');
      if (statusText) statusText.textContent = '❌ स्कैन विफल: ' + (err.message || 'त्रुटि');
    } finally {
      if (photoBtn) photoBtn.disabled = false;
    }
  }

  async generateAiStudioAudio() {
    const text = document.getElementById('aiStudioTextInput')?.value.trim();
    if (!text) {
      stenoApp.showToast('कृपया हिंदी आलेख टेक्स्ट दर्ज करें।', 'error');
      return;
    }

    const title = document.getElementById('aiStudioTitleInput')?.value.trim() || 'AI Dictation';
    const wpm = parseInt(document.getElementById('aiStudioSpeedVal')?.value || 80, 10);
    const voice = document.getElementById('aiStudioVoiceVal')?.value || 'male';
    const addIntro = document.getElementById('aiStudioIntroCheck') ? document.getElementById('aiStudioIntroCheck').checked : true;
    const btn = document.getElementById('btnAiStudioGenerate');
    const origText = btn ? btn.innerHTML : '';

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> <span>AI प्राकृतिक आवाज़ तैयार हो रही है...</span>';
      }
      stenoApp.showToast(`AI प्राकृतिक हिंदी ऑडियो जनरेट हो रहा है (${wpm} WPM)... 🎙️⚡`, 'info');

      const res = await stenoApp.apiCall('/api/admin/generate-ai-audio', 'POST', {
        text: text,
        speed_wpm: wpm,
        title: title,
        voice: voice,
        add_intro: addIntro,
        pause_mode: 'exam'
      });

      if (res && res.success && res.audio_url) {
        this.lastGeneratedAiAudio = {
          audio_url: res.audio_url,
          title: title,
          text: text,
          speed_wpm: wpm,
          duration_seconds: res.duration_seconds,
          word_count: res.word_count,
          category_id: parseInt(document.getElementById('aiStudioCategorySelect')?.value || 1, 10),
          category_name: document.getElementById('aiStudioCategorySelect')?.options[document.getElementById('aiStudioCategorySelect')?.selectedIndex]?.text || ''
        };

        const resultCard = document.getElementById('aiStudioResultCard');
        const detailsEl = document.getElementById('aiStudioResultDetails');
        const player = document.getElementById('aiStudioAudioPlayer');
        const downloadBtn = document.getElementById('aiStudioDownloadBtn');

        const mins = Math.floor(res.duration_seconds / 60);
        const secs = res.duration_seconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (detailsEl) {
          const vLabel = (res.voice === 'female' || voice === 'female') ? '👩 महिला (Swara)' : '👨 पुरुष (Madhur)';
          const introLabel = (res.add_intro !== false && addIntro) ? ' | 🔔 5s इंट्रो' : '';
          detailsEl.textContent = `गति: ${res.target_wpm} WPM | स्वर: ${vLabel} | शब्द: ${res.word_count} | कुल अवधि: ${timeStr}${introLabel}`;
        }
        if (player) {
          player.src = res.audio_url;
          player.load();
          player.play().catch(() => {});
        }
        if (downloadBtn) {
          downloadBtn.href = res.audio_url;
          downloadBtn.download = `${title.replace(/\s+/g, '_')}_${wpm}wpm.mp3`;
        }
        if (resultCard) {
          resultCard.style.display = 'block';
        }

        stenoApp.showToast('AI ऑडियो डिक्टेशन 100% तैयार हो गया! 🎵🎉', 'success');
      } else {
        throw new Error(res?.error || 'ऑडियो जनरेशन असफल');
      }
    } catch (err) {
      console.error('AI Voice Generation error:', err);
      stenoApp.showToast('ऑडियो तैयार करने में त्रुटि: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }

  createPassageFromAiStudio() {
    if (!this.lastGeneratedAiAudio) {
      stenoApp.showToast('कृपया पहले AI ऑडियो तैयार करें।', 'warning');
      return;
    }

    const d = this.lastGeneratedAiAudio;
    const catSel = document.getElementById('aiStudioCategorySelect');
    const selectedCatId = catSel ? parseInt(catSel.value || d.category_id || 1, 10) : (d.category_id || 1);
    const selectedCatName = catSel && catSel.selectedIndex >= 0 ? catSel.options[catSel.selectedIndex].text : (d.category_name || '');

    this.openNewPassageModal('dual', selectedCatId, selectedCatName);

    document.getElementById('passageTitleInput').value = d.title || 'AI डिक्टेशन अभ्यास';
    const sel = document.getElementById('passageCategorySelect');
    if (sel && selectedCatId) sel.value = String(selectedCatId);
    document.getElementById('passageTargetWpmInput').value = d.speed_wpm || 80;
    document.getElementById('passageDurationInput').value = d.duration_seconds || 180;
    document.getElementById('passageAudioUrlInput').value = d.audio_url || '';
    document.getElementById('passageOfficialTextInput').value = d.text || '';

    this.renderAudioPreview(d.audio_url || '');

    // Auto-convert to Kruti Dev so passage works for both fonts
    this.convertMangalToKrutiModal();

    stenoApp.showToast(`आलेख विवरण व AI ऑडियो श्रेणी [${selectedCatName || selectedCatId}] हेतु लोड कर दिया गया! 📝⚡`, 'success');
  }

  async directPublishAiAudio() {
    if (!this.lastGeneratedAiAudio) {
      stenoApp.showToast('कृपया पहले AI ऑडियो तैयार करें।', 'warning');
      return;
    }

    const d = this.lastGeneratedAiAudio;
    const catSel = document.getElementById('aiStudioCategorySelect');
    const categoryId = catSel ? parseInt(catSel.value || d.category_id || 1, 10) : (d.category_id || 1);
    if (!categoryId) {
      stenoApp.showToast('कृपया श्रेणी (Category) चुनें।', 'warning');
      if (catSel) catSel.focus();
      return;
    }
    const categoryName = catSel && catSel.selectedIndex >= 0 ? catSel.options[catSel.selectedIndex].text : (d.category_name || `ID #${categoryId}`);

    // Convert text to Kruti Dev if converter available
    let krutiText = '';
    try {
      if (typeof window.mangalToKrutiDev === 'function') {
        krutiText = window.mangalToKrutiDev(d.text);
      }
    } catch (e) {}

    const payload = {
      title: d.title || 'AI डिक्टेशन अभ्यास',
      category_id: categoryId,
      target_wpm: d.speed_wpm || 80,
      duration_seconds: d.duration_seconds || 180,
      word_count: d.word_count || 400,
      audio_url: d.audio_url,
      official_text: d.text,
      official_kruti_text: krutiText || d.text,
      difficulty: (d.speed_wpm >= 100) ? 'hard' : ((d.speed_wpm <= 60) ? 'easy' : 'medium'),
      language: 'hindi',
      status: 'published',
      is_free_tier: 0
    };

    try {
      stenoApp.showToast(`श्रेणी [${categoryName}] में क्लास प्रकाशित हो रही है... ⏳`, 'info');
      const res = await stenoApp.apiCall('/api/admin/passages/save', 'POST', payload);
      if (res && res.success) {
        stenoApp.showToast(`🎉 क्लास सफलतापूर्वक श्रेणी [${categoryName}] में जुड़ गई! छात्रों को तुरंत उपलब्ध होगी।`, 'success');
        if (typeof this.loadPassagesTable === 'function') this.loadPassagesTable();
        if (typeof this.loadCategoriesTable === 'function') this.loadCategoriesTable();
        if (this.activeCategoryModalId && typeof this.loadCategoryClasses === 'function') {
          this.loadCategoryClasses(this.activeCategoryModalId);
        }
      } else {
        stenoApp.showToast(res.error || 'क्लास सेव नहीं हो सकी', 'error');
      }
    } catch (err) {
      stenoApp.showToast(`त्रुटि: ${err.message}`, 'error');
    }
  }

  async generateAudioForCurrentPassage(wpm = 80) {
    const mangalText = document.getElementById('passageOfficialTextInput')?.value.trim();
    const krutiText = document.getElementById('passageOfficialKrutiInput')?.value.trim();
    let textToUse = mangalText;

    if (!textToUse && krutiText) {
      await this.convertKrutiToMangalModal();
      textToUse = document.getElementById('passageOfficialTextInput')?.value.trim();
    }

    if (!textToUse) {
      stenoApp.showToast('कृपया पहले नीचे आलेख का आधिकारिक संदर्भ पाठ दर्ज करें।', 'warning');
      return;
    }

    const title = document.getElementById('passageTitleInput')?.value.trim() || 'Passage Dictation';

    const voice = document.getElementById('modalAiVoiceSelect')?.value || 'male';
    const addIntro = document.getElementById('modalAiIntroCheck') ? document.getElementById('modalAiIntroCheck').checked : true;
    const vName = voice === 'female' ? 'महिला (Swara)' : 'पुरुष (Madhur)';

    stenoApp.showToast(`नीचे लिखे टेक्स्ट से ${wpm} WPM (${vName}) AI ऑडियो तैयार हो रहा है... 🎙️`, 'info');

    try {
      const res = await stenoApp.apiCall('/api/admin/generate-ai-audio', 'POST', {
        text: textToUse,
        speed_wpm: wpm,
        title: title,
        voice: voice,
        add_intro: addIntro,
        pause_mode: 'exam'
      });

      if (res && res.success && res.audio_url) {
        document.getElementById('passageAudioUrlInput').value = res.audio_url;
        document.getElementById('passageDurationInput').value = res.duration_seconds;
        document.getElementById('passageTargetWpmInput').value = wpm;

        this.renderAudioPreview(res.audio_url);
        stenoApp.showToast(`AI डिक्टेशन ऑडियो (${wpm} WPM) सफलतापूर्वक तैयार और लोड हुआ! 🎵🎉`, 'success');
      } else {
        throw new Error(res?.error || 'ऑडियो जनरेशन असफल');
      }
    } catch (err) {
      stenoApp.showToast('AI ऑडियो बनाने में त्रुटि: ' + err.message, 'error');
    }
  }


  // -------------------------------------------------------------------------
  // Student Custom Classes & 1-Click Publishing Workflow
  // -------------------------------------------------------------------------
  async loadCustomClasses() {
    const loadingEl = document.getElementById('adminCustomLoading');
    const emptyEl = document.getElementById('adminCustomEmpty');
    const tableWrap = document.getElementById('adminCustomTableWrap');
    const tbody = document.getElementById('adminCustomTbody');

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'none';

    try {
      const res = await stenoApp.apiCall('/api/admin/custom-classes');
      this.customClassesList = res.custom_classes || [];

      // Update counters
      const total = this.customClassesList.length;
      const published = this.customClassesList.filter(x => x.status === 'published').length;
      const pending = total - published;

      const totalEl = document.getElementById('adminCustomTotalCount');
      const pendEl = document.getElementById('adminCustomPendingCount');
      const pubEl = document.getElementById('adminCustomPublishedCount');
      if (totalEl) totalEl.textContent = total;
      if (pendEl) pendEl.textContent = pending;
      if (pubEl) pubEl.textContent = published;

      if (loadingEl) loadingEl.style.display = 'none';

      if (!this.customClassesList.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (tableWrap) tableWrap.style.display = 'block';
      if (tbody) {
        tbody.innerHTML = this.customClassesList.map(item => {
          const isPub = item.status === 'published';
          const studentName = stenoApp.escapeHtml(item.student_display || item.username || 'विद्यार्थी');
          const studentCode = item.student_code ? `<span style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${item.student_code}</span>` : '';
          const phone = item.phone ? `<div style="font-size:0.7rem; color:var(--text-muted);">📞 ${item.phone}</div>` : '';
          const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('hi-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
          const textExcerpt = (item.official_text || '').substring(0, 70) + (item.official_text?.length > 70 ? '...' : '');

          return `
            <tr style="border-bottom:1px solid var(--border-subtle, #e2e8f0);">
              <td style="padding:10px 12px; vertical-align:top;">
                <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">${studentName}</div>
                ${studentCode}
                ${phone}
              </td>
              <td style="padding:10px 12px; vertical-align:top;">
                <div style="font-weight:700; font-size:0.86rem; color:var(--text-main);">${stenoApp.escapeHtml(item.title)}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                  <span>📝 ${item.word_count || 0} शब्द</span>
                  ${dateStr ? `<span style="margin-left:8px;">📅 ${dateStr}</span>` : ''}
                </div>
              </td>
              <td style="padding:10px 12px; vertical-align:top;">
                <span class="badge badge-primary" style="font-size:0.75rem; font-weight:700;">${item.target_wpm || 80} WPM</span>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
                  ${item.typing_system === 'kruti_dev_010' ? 'कृति देव' : 'मंगल'}
                </div>
              </td>
              <td style="padding:10px 12px; vertical-align:top; min-width:180px;">
                ${item.audio_url ? `
                  <audio controls src="${item.audio_url}" style="width:100%; height:32px;" preload="none"></audio>
                ` : `<span style="font-size:0.75rem; color:var(--text-muted);">साइलेंट (कोई ऑडियो नहीं)</span>`}
              </td>
              <td style="padding:10px 12px; vertical-align:top; max-width:220px;">
                <div style="font-size:0.78rem; line-height:1.4; color:var(--text-secondary); max-height:45px; overflow:hidden; text-overflow:ellipsis;">
                  ${stenoApp.escapeHtml(textExcerpt)}
                </div>
                <button type="button" class="btn-link" style="font-size:0.7rem; padding:0; margin-top:2px; color:var(--primary);" onclick="alert(${JSON.stringify(item.official_text || '')})">
                  पूरा आलेख देखें
                </button>
              </td>
              <td style="padding:10px 12px; vertical-align:top;">
                <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}" style="font-size:0.72rem; padding:4px 8px; border-radius:12px; font-weight:700; white-space:nowrap;">
                  ${isPub ? '🟢 सभी के लिए सक्रिय' : '🟡 समीक्षाधीन'}
                </span>
                ${item.category_name ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">📂 ${item.category_name}</div>` : ''}
              </td>
              <td style="padding:10px 12px; vertical-align:top; text-align:center;">
                <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                  ${!isPub ? `
                    <button type="button" class="btn-sm btn-success" style="padding:6px 14px; font-size:0.78rem; font-weight:700; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:20px; box-shadow:0 2px 8px rgba(16,185,129,0.3); cursor:pointer; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" onclick="stenoAdmin.openPublishCustomModal(${item.id})">
                      <span>🚀</span> <span>सभी को भेजें</span>
                    </button>
                  ` : `
                    <span style="font-size:0.75rem; color:#059669; font-weight:700;">✓ प्रकाशित</span>
                  `}
                  <button type="button" class="btn-sm btn-secondary" style="padding:4px 10px; font-size:0.72rem; color:#ef4444; border-color:rgba(239,68,68,0.2);" onclick="stenoAdmin.deleteCustomSubmission(${item.id})" title="क्लास हटाएं">
                    <span>🗑️ हटाएं</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      stenoApp.showToast(`कस्टम क्लासेस लोड करने में त्रुटि: ${err.message}`, 'danger');
    }
  }

  openPublishCustomModal(passageId) {
    if (!this.customClassesList) return;
    const item = this.customClassesList.find(x => x.id === passageId);
    if (!item) return;

    const modal = document.getElementById('publishCustomModal');
    const idInput = document.getElementById('pubCustomPassageId');
    const titleInput = document.getElementById('pubCustomTitle');
    const catSelect = document.getElementById('pubCustomCategory');
    const isPrem = document.getElementById('pubCustomIsPremium');

    if (idInput) idInput.value = item.id;
    if (titleInput) titleInput.value = item.title;
    if (isPrem) isPrem.checked = Boolean(item.is_premium);

    if (catSelect) {
      catSelect.innerHTML = (this.categoriesList || []).map(cat => `
        <option value="${cat.id}" ${cat.id === item.category_id ? 'selected' : ''}>${stenoApp.escapeHtml(cat.name)}</option>
      `).join('');
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  }

  closePublishCustomModal() {
    const modal = document.getElementById('publishCustomModal');
    if (modal) modal.style.display = 'none';
  }

  async confirmPublishCustomToAll() {
    const passageId = document.getElementById('pubCustomPassageId')?.value;
    const title = document.getElementById('pubCustomTitle')?.value;
    const categoryId = document.getElementById('pubCustomCategory')?.value;
    const isPremium = document.getElementById('pubCustomIsPremium')?.checked ? 1 : 0;

    if (!passageId) return;

    try {
      const res = await stenoApp.apiCall('/api/admin/custom-classes/publish', 'POST', {
        passage_id: parseInt(passageId),
        title: title,
        category_id: parseInt(categoryId || 1),
        is_premium: isPremium
      });

      if (res && res.success) {
        stenoApp.showToast(res.message || '✓ क्लास सभी छात्रों के लिए प्रकाशित हो गई!', 'success');
        this.closePublishCustomModal();
        await this.loadCustomClasses();
      }
    } catch (err) {
      stenoApp.showToast(`प्रकाशन में त्रुटि: ${err.message}`, 'danger');
    }
  }

  async deleteCustomSubmission(passageId) {
    if (!confirm('क्या आप वाकई इस छात्र की सबमिशन को हटाना चाहते हैं?')) return;
    try {
      const res = await stenoApp.apiCall('/api/admin/custom-classes/delete', 'POST', { passage_id: passageId });
      if (res && res.success) {
        stenoApp.showToast('क्लास सफलतापूर्वक हटा दी गई।', 'info');
        await this.loadCustomClasses();
      }
    } catch (err) {
      stenoApp.showToast(`हटाने में त्रुटि: ${err.message}`, 'danger');
    }
  }

}


window.stenoAdmin = new StenoAdmin();
window.adminApp = window.stenoAdmin;

// Cross-compatibility bridge between stenoAdmin and stenoApp
if (typeof window !== 'undefined') {
  if (window.stenoApp) {
    window.stenoAdmin.handleDirectAdminLogin = function(e) { return window.stenoApp.handleDirectAdminLogin(e); };
    window.stenoAdmin.closeResetPasswordModal = function() { return window.stenoApp.closeResetPasswordModal(); };
    window.stenoAdmin.sendTestEmail = function() { return window.stenoApp.sendTestEmail(); };
    window.stenoAdmin.submitResetPassword = function() { return window.stenoApp.submitResetPassword(); };
  }

  // =========================================================================
  // STUDENT UPI WITHDRAWALS (10% REAL CASH COMMISSION PAYOUTS)
  // =========================================================================
  async loadWithdrawals() {
    const tbody = document.getElementById('adminWithdrawalsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">निकासी अनुरोध लोड हो रहे हैं...</td></tr>';
    try {
      const res = await stenoApp.apiCall('/api/admin/withdrawals');
      const withdrawals = res.withdrawals || [];
      if (withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">अभी कोई निकासी अनुरोध दर्ज नहीं है।</td></tr>';
        return;
      }
      tbody.innerHTML = withdrawals.map(w => {
        const dt = new Date(w.created_at).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let statusBadge = '<span class="badge badge-warning">⏳ Pending</span>';
        if (w.status === 'approved') statusBadge = '<span class="badge badge-success">✅ Paid</span>';
        if (w.status === 'rejected') statusBadge = '<span class="badge badge-hard">❌ Rejected</span>';

        const actionBtns = w.status === 'pending' ? `
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; background:#10b981;" onclick="stenoAdmin.reviewWithdrawal(${w.id}, 'approve')">✓ Mark Paid</button>
            <button class="btn-secondary" style="padding:4px 10px; font-size:0.75rem; color:#ef4444;" onclick="stenoAdmin.reviewWithdrawal(${w.id}, 'reject')">✕ Reject</button>
          </div>
        ` : `<span style="font-size:0.8rem; color:var(--text-muted);">${this.escapeHtml(w.admin_notes || 'संपन्न')}</span>`;

        return `
          <tr>
            <td style="font-weight:700;">#${w.id}</td>
            <td>
              <div style="font-weight:600;">${this.escapeHtml(w.display_name || w.username)}</div>
              <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${this.escapeHtml(w.student_code || '')}</div>
            </td>
            <td>
              <div style="font-size:0.8rem;">${this.escapeHtml(w.email || '—')}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(w.phone || '—')}</div>
            </td>
            <td><strong style="color:#059669; font-size:1.05rem;">₹${Number(w.amount).toFixed(2)}</strong></td>
            <td>
              <code style="font-size:0.9rem; font-weight:700; color:#2563eb; background:rgba(37,99,235,0.08); padding:3px 8px; border-radius:6px;">${this.escapeHtml(w.upi_id)}</code>
            </td>
            <td>${statusBadge}</td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${dt}</td>
            <td>${actionBtns}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--accent-red);">त्रुटि: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async reviewWithdrawal(reqId, action) {
    const notes = prompt(`टिप्पणी दर्ज करें (${action === 'approve' ? 'भुगतान सफल मार्क करें (Paid)' : 'अस्वीकार कर राशि छात्र के वॉलेट में वापस करें'}):`, action === 'approve' ? 'UPI भुगतान सफल (Marked as Paid)' : 'अमान्य UPI आईडी');
    if (notes === null) return;

    try {
      const res = await stenoApp.apiCall('/api/admin/withdrawals/review', 'POST', {
        request_id: reqId,
        action,
        notes
      });
      stenoApp.showToast(res.message || 'अनुरोध अद्यतित हुआ!', 'success');
      await this.loadWithdrawals();
    } catch (err) {
      stenoApp.showToast('समीक्षा विफल: ' + err.message, 'error');
    }
  }


  // =========================================================================
  // WALLET & COMMISSION LIVE CONTROLS (ADMIN SETTINGS)
  // =========================================================================
  async loadWalletSettings() {
    try {
      const res = await stenoApp.apiCall('/api/settings');
      const s = (res && res.settings) || {};

      const gEnabled = document.getElementById('setGoldCoinsEnabled');
      if (gEnabled) gEnabled.value = s.gold_coins_enabled !== undefined ? String(s.gold_coins_enabled) : '1';

      const cPerShare = document.getElementById('setCoinsPerShare');
      if (cPerShare) cPerShare.value = s.coins_per_share || '1';

      const maxShares = document.getElementById('setMaxDailyShares');
      if (maxShares) maxShares.value = s.max_daily_shares || '3';

      const refCoins = document.getElementById('setCoinsPerSignupReferrer');
      if (refCoins) refCoins.value = s.coins_per_signup_referrer || '5';

      const welcomeCoins = document.getElementById('setCoinsWelcomeBonus');
      if (welcomeCoins) welcomeCoins.value = s.coins_welcome_bonus || '5';

      const coinVal = document.getElementById('setCoinValueInr');
      if (coinVal) coinVal.value = s.coin_value_inr || '1.0';

      const commEnabled = document.getElementById('setCommissionEnabled');
      if (commEnabled) commEnabled.value = s.commission_enabled !== undefined ? String(s.commission_enabled) : '1';

      const commPct = document.getElementById('setCommissionPercent');
      if (commPct) commPct.value = s.course_commission_percent || '10.0';

      const withEnabled = document.getElementById('setWithdrawalsEnabled');
      if (withEnabled) withEnabled.value = s.withdrawals_enabled !== undefined ? String(s.withdrawals_enabled) : '1';

      const minWith = document.getElementById('setMinWithdrawalAmount');
      if (minWith) minWith.value = s.min_withdrawal_amount || '50';
    } catch (err) {
      console.warn('Failed to load wallet settings:', err);
    }
  }

  async saveWalletSettings(e) {
    if (e) e.preventDefault();
    const payload = {
      gold_coins_enabled: document.getElementById('setGoldCoinsEnabled')?.value || '1',
      coins_per_share: document.getElementById('setCoinsPerShare')?.value || '1',
      max_daily_shares: document.getElementById('setMaxDailyShares')?.value || '3',
      coins_per_signup_referrer: document.getElementById('setCoinsPerSignupReferrer')?.value || '5',
      coins_welcome_bonus: document.getElementById('setCoinsWelcomeBonus')?.value || '5',
      coin_value_inr: document.getElementById('setCoinValueInr')?.value || '1.0',
      commission_enabled: document.getElementById('setCommissionEnabled')?.value || '1',
      course_commission_percent: document.getElementById('setCommissionPercent')?.value || '10.0',
      withdrawals_enabled: document.getElementById('setWithdrawalsEnabled')?.value || '1',
      min_withdrawal_amount: document.getElementById('setMinWithdrawalAmount')?.value || '50'
    };

    try {
      await stenoApp.apiCall('/api/admin/settings/update', 'POST', payload);
      stenoApp.showToast('गोल्ड कॉइन्स एवं नकद कमीशन सेटिंग्स सफलतापूर्वक लाइव सहेजी गईं! 🎉', 'success');
      await this.loadWalletSettings();
    } catch (err) {
      stenoApp.showToast('सेटिंग्स सहेजने में त्रुटि: ' + err.message, 'error');
    }
  }

}
