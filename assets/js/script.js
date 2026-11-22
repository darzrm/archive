'use strict';

// ==========================================
// 1. SUPABASE & CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uendrdxiixmikkeanlod.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IdPLjwQhVQwXGGxUnBVblg_oIQ5Zz89';
const STORAGE_BUCKET = 'media-assets';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let allMediaLogs = [];
let allBlogPosts = [];
let allCollections = [];
let allCollectionItems = [];
let allActivityLogs = [];
let lastApiResults = [];
let pendingUploadedUrls = [];

let currentCategory = 'all';
let currentMainView = 'overview';
let libraryViewMode = 'grid'; // 'grid' | 'list' | 'compact'
let itemsPerPage = 20;
let visibleMediaLimit = 20;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;

let currentSortField = 'rating';
let currentSortDir = 'desc';

let currentProfile = {
  name: 'Archive',
  bio: '',
  avatar_url: '',
  banner_url: '',
  social_links: [],
  is_library_private: false
};

let dashboardWidgets = {
  stats: true,
  currently_consuming: true,
  recently_completed: true,
  recently_added: true,
  recent_notes: true,
  category_overview: true,
  activity_timeline: true
};

// ==========================================
// 2. 12 MEDIA CATEGORIES DEFINITIONS
// ==========================================
const CATEGORY_LABELS = {
  movie: 'Movies',
  tv_show: 'TV Shows',
  anime: 'Anime',
  manga: 'Manga',
  comic: 'Comics',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  book: 'Books',
  game: 'Video Games',
  visual_novel: 'Visual Novels',
  music: 'Music',
  other: 'Other Media'
};

const DEFAULT_UNITS_BY_CAT = {
  movie: 'movie',
  tv_show: 'eps',
  anime: 'eps',
  manga: 'ch',
  comic: 'ch',
  manhwa: 'ch',
  manhua: 'ch',
  book: 'pages',
  game: 'item',
  visual_novel: 'item',
  music: 'track',
  other: 'item'
};

const UNIT_SHORT_LABELS = {
  eps: 'EPS',
  ch: 'CH',
  movie: 'MOVIE',
  vol: 'VOL',
  pages: 'PAGES',
  track: 'TRACK',
  item: 'ITEM'
};

const STATUS_LABELS = {
  planned: 'Planning',
  ongoing: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped'
};

const SEASON_PART_OPTIONS = [
  'Main', 'Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5',
  'Season 6', 'Season 7', 'Season 8', 'Part 1', 'Part 2', 'Part 3',
  'OVA', 'ONA', 'Movie', 'Special', 'Arc'
];

// Category-Specific Metadata Schema
const CATEGORY_SPECIFIC_SCHEMA = {
  movie: [
    { key: 'runtime', label: 'Runtime (mins)', type: 'number', placeholder: '142' },
    { key: 'watch_date', label: 'Watch Date', type: 'date' },
    { key: 'studio', label: 'Production Studio', type: 'text', placeholder: 'A24, Warner Bros...' }
  ],
  tv_show: [
    { key: 'total_seasons', label: 'Total Seasons', type: 'number', placeholder: '4' },
    { key: 'network', label: 'Network / Platform', type: 'text', placeholder: 'HBO, Netflix...' }
  ],
  anime: [
    { key: 'anime_type', label: 'Anime Type', type: 'select', options: ['TV', 'Movie', 'OVA', 'ONA', 'Special'] },
    { key: 'airing_status', label: 'Airing Status', type: 'select', options: ['Finished Airing', 'Currently Airing', 'Not Yet Aired'] },
    { key: 'season_premiered', label: 'Season / Year', type: 'text', placeholder: 'Spring 2024' }
  ],
  manga: [
    { key: 'pub_status', label: 'Publication Status', type: 'select', options: ['Finished', 'Publishing', 'Hiatus', 'Cancelled'] },
    { key: 'serialization', label: 'Magazine / Publisher', type: 'text', placeholder: 'Weekly Shonen Jump' }
  ],
  comic: [
    { key: 'pub_status', label: 'Publication Status', type: 'select', options: ['Finished', 'Ongoing', 'Limited Series'] },
    { key: 'publisher', label: 'Publisher', type: 'text', placeholder: 'Image, DC, Marvel...' }
  ],
  manhwa: [
    { key: 'pub_status', label: 'Publication Status', type: 'select', options: ['Finished', 'Publishing', 'Hiatus'] },
    { key: 'platform', label: 'Platform', type: 'text', placeholder: 'Naver Webtoon, Kakao...' }
  ],
  manhua: [
    { key: 'pub_status', label: 'Publication Status', type: 'select', options: ['Finished', 'Publishing', 'Hiatus'] },
    { key: 'platform', label: 'Platform', type: 'text', placeholder: 'Bilibili Comics...' }
  ],
  book: [
    { key: 'publisher', label: 'Publisher', type: 'text', placeholder: 'Penguin Classics' },
    { key: 'isbn', label: 'ISBN', type: 'text', placeholder: '978-...' },
    { key: 'format', label: 'Format', type: 'select', options: ['Paperback', 'Hardcover', 'E-Book', 'Audiobook'] }
  ],
  game: [
    { key: 'platform', label: 'Platform', type: 'text', placeholder: 'PC, PS5, Switch...' },
    { key: 'publisher', label: 'Publisher', type: 'text', placeholder: 'FromSoftware, Sony...' },
    { key: 'playtime_hours', label: 'Playtime (Hours)', type: 'number', placeholder: '65' },
    { key: 'achievements', label: 'Achievements / Trophies', type: 'text', placeholder: '42 / 50' }
  ],
  visual_novel: [
    { key: 'platform', label: 'Platform', type: 'text', placeholder: 'PC, Switch...' },
    { key: 'routes', label: 'Total / Completed Routes', type: 'text', placeholder: '5 / 5 Routes' },
    { key: 'endings', label: 'Endings Unlocked', type: 'text', placeholder: 'True End, Good End' },
    { key: 'playtime_hours', label: 'Playtime (Hours)', type: 'number', placeholder: '48' }
  ],
  music: [
    { key: 'release_type', label: 'Release Type', type: 'select', options: ['Album', 'EP', 'Single', 'Live Album', 'Compilation'] },
    { key: 'record_label', label: 'Record Label', type: 'text', placeholder: '4AD, Sub Pop...' },
    { key: 'tracklist', label: 'Favorite Tracks / Tracklist', type: 'text', placeholder: '1. Only Shallow, 2. Loomer...' }
  ],
  other: [
    { key: 'medium_type', label: 'Medium Type', type: 'text', placeholder: 'Podcast, Stage Play, Documentary...' }
  ]
};

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function showToast(message, type = 'success', duration = 2600) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'checkmark-circle-outline',
    error: 'alert-circle-outline',
    info: 'information-circle-outline'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <ion-icon name="${iconMap[type] || iconMap.info}"></ion-icon>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

window.showPhaseNotice = function (moduleName, phaseNum) {
  showToast(`${moduleName} is scheduled for Phase ${phaseNum}.`, 'info', 3000);
};

// ==========================================
// 3. INITIALIZATION & NAVIGATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    updateHeaderDateDisplay();
    setupScrollListeners();
    setupOutsidePopoverCloser();
    setupFilterListeners();
    setupKeyboardShortcuts();
    updateSortUIControls();

    await checkAdminSession();
    await Promise.all([
      fetchProfileSettings(),
      fetchUserPreferences()
    ]);

    await Promise.all([
      fetchBlogPosts(),
      fetchMediaLogs(),
      fetchCollections(),
      fetchActivityLogs()
    ]);

    renderOverviewDashboard();
    renderCollectionsView();
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Init error: ' + err.message, 'error', 5000);
  }
});

function updateHeaderDateDisplay() {
  const now = new Date();
  const formatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  setElText('topbar-date-label', formatted);
  setElText('dashboard-welcome-date', formatted);
}

function setupScrollListeners() {
  const backToTopBtn = document.getElementById('btn-back-to-top');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    if (backToTopBtn) {
      backToTopBtn.classList.toggle('visible', scrollY > 320);
    }
  }, { passive: true });
}

window.scrollToTopSmooth = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleSidebarCollapse = function () {
  const shell = document.getElementById('app-shell');
  const icon = document.getElementById('sidebar-collapse-icon');
  if (!shell) return;
  const collapsed = shell.classList.toggle('sidebar-collapsed');
  if (icon) {
    icon.setAttribute('name', collapsed ? 'chevron-forward-outline' : 'chevron-back-outline');
  }
};

window.toggleMobileSidebar = function (open) {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.toggle('mobile-open', open);
  if (backdrop) backdrop.classList.toggle('active', open);
};

window.switchMainView = function (viewName) {
  if ((viewName === 'library' || viewName === 'collections') && currentProfile.is_library_private && !isAdminLoggedIn) {
    viewName = 'overview';
  }

  currentMainView = viewName;
  toggleMobileSidebar(false);

  document.querySelectorAll('.sidebar-nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const viewMap = {
    overview: { el: 'view-overview', title: 'Overview' },
    library: { el: 'view-library', title: 'Media Library' },
    notes: { el: 'view-notes', title: 'Notes & Feed' },
    collections: { el: 'view-collections', title: 'Collections' }
  };

  Object.entries(viewMap).forEach(([key, cfg]) => {
    const section = document.getElementById(cfg.el);
    if (!section) return;
    section.classList.remove('active-view');
    if (key === viewName) {
      section.style.display = 'block';
      void section.offsetWidth;
      section.classList.add('active-view');
      setElText('topbar-view-title', cfg.title);
    } else {
      section.style.display = 'none';
    }
  });

  updateAdminActionButtons();
};

window.openLibraryWithStatus = function (statusKey) {
  switchMainView('library');
  const statusEl = document.getElementById('filter-status');
  if (statusEl) {
    statusEl.value = statusKey;
    resetPaginationAndRender();
  }
};

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearchModal();
      return;
    }

    if (e.key === 'Escape') {
      closeGlobalSearchModal();
      closeQuickCaptureModal();
      closeWidgetCustomizerModal();
      closeMediaDetailModal();
      return;
    }

    if (!isInput && isAdminLoggedIn && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      openQuickCaptureModal();
    }
  });
}

// ==========================================
// 4. AUTHENTICATION & ADMIN UI
// ==========================================
async function checkAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  isAdminLoggedIn = !!session;
  updateAdminUI();
}

function updateAdminUI() {
  const editProfileBtn = document.getElementById('btn-edit-profile');
  const lockIcon = document.getElementById('admin-lock-icon');
  const btnText = document.getElementById('admin-btn-text');
  const quickWrap = document.getElementById('sidebar-quick-wrap');
  const dashQuick = document.getElementById('dashboard-quick-actions');
  const dashWidgetsBtn = document.getElementById('btn-customize-dashboard');
  const newColBtn = document.getElementById('btn-new-collection');

  if (isAdminLoggedIn) {
    if (editProfileBtn) editProfileBtn.style.display = 'flex';
    if (quickWrap) quickWrap.style.display = 'block';
    if (dashQuick) dashQuick.style.display = 'flex';
    if (dashWidgetsBtn) dashWidgetsBtn.style.display = 'inline-flex';
    if (newColBtn) newColBtn.style.display = 'inline-flex';
    if (lockIcon) lockIcon.setAttribute('name', 'log-out-outline');
    if (btnText) btnText.textContent = 'Logout';
  } else {
    if (editProfileBtn) editProfileBtn.style.display = 'none';
    if (quickWrap) quickWrap.style.display = 'none';
    if (dashQuick) dashQuick.style.display = 'none';
    if (dashWidgetsBtn) dashWidgetsBtn.style.display = 'none';
    if (newColBtn) newColBtn.style.display = 'none';
    if (lockIcon) lockIcon.setAttribute('name', 'lock-closed-outline');
    if (btnText) btnText.textContent = 'Admin';
  }

  updateLibraryTabVisibility();
  updateAdminActionButtons();
  renderMediaGrid();
  renderCollectionsView();
  if (isProfileLoaded) renderBlogPosts();
}

function updateLibraryTabVisibility() {
  const isPrivate = Boolean(currentProfile.is_library_private);
  const canView = !isPrivate || isAdminLoggedIn;

  const navLib = document.getElementById('nav-item-library');
  const lockBadge = document.getElementById('library-private-lock');

  if (navLib) navLib.style.display = canView ? 'flex' : 'none';
  if (lockBadge) lockBadge.style.display = (isPrivate && isAdminLoggedIn) ? 'inline-flex' : 'none';

  if (!canView && (currentMainView === 'library' || currentMainView === 'collections')) {
    switchMainView('overview');
  }
}

function updateAdminActionButtons() {
  const btn = document.getElementById('btn-primary-context-action');
  const icon = document.getElementById('primary-action-icon');
  const label = document.getElementById('primary-action-label');

  if (!btn) return;
  if (!isAdminLoggedIn) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';
  if (currentMainView === 'notes') {
    if (icon) icon.setAttribute('name', 'create-outline');
    if (label) label.textContent = 'New Note';
  } else if (currentMainView === 'collections') {
    if (icon) icon.setAttribute('name', 'add-outline');
    if (label) label.textContent = 'New Collection';
  } else {
    if (icon) icon.setAttribute('name', 'add-outline');
    if (label) label.textContent = 'Add Media';
  }
}

window.handlePrimaryContextAction = function () {
  if (!isAdminLoggedIn) return;
  if (currentMainView === 'notes') openPostModal();
  else if (currentMainView === 'collections') openCollectionModal();
  else openMediaModal();
};

window.handleAdminAuthClick = async function () {
  if (isAdminLoggedIn) {
    const confirm = await Swal.fire({
      text: 'Exit Admin mode?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Logout',
      cancelButtonText: 'Cancel',
      background: '#1a1a1c',
      color: '#fff'
    });
    if (confirm.isConfirmed) {
      await supabaseClient.auth.signOut();
      isAdminLoggedIn = false;
      updateAdminUI();
      showToast('Logged out', 'info');
    }
  } else {
    document.getElementById('login-modal').classList.add('active');
  }
};

window.closeLoginModal = function () {
  document.getElementById('login-modal').classList.remove('active');
};

document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message, 'error');
  } else {
    isAdminLoggedIn = true;
    closeLoginModal();
    updateAdminUI();
    showToast('Admin session active', 'success');
  }
});

// ==========================================
// 5. ACTIVITY LOGGING & DASHBOARD WIDGETS
// ==========================================
async function logPersonalActivity(actionType, entityType, entityId, entityTitle, details = '') {
  if (!isAdminLoggedIn) return;
  try {
    await supabaseClient.from('activity_logs').insert([{
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      entity_title: entityTitle,
      details
    }]);
    await fetchActivityLogs();
  } catch (err) {
    console.warn('Activity log skipped:', err.message);
  }
}

async function fetchActivityLogs() {
  const { data, error } = await supabaseClient
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12);

  if (!error && data) {
    allActivityLogs = data;
  }
}

async function fetchUserPreferences() {
  const { data, error } = await supabaseClient
    .from('user_preferences')
    .select('*')
    .eq('id', 1)
    .single();

  if (!error && data && data.dashboard_widgets) {
    dashboardWidgets = { ...dashboardWidgets, ...data.dashboard_widgets };
  }
  applyDashboardWidgetVisibility();
}

function applyDashboardWidgetVisibility() {
  Object.entries(dashboardWidgets).forEach(([key, isVisible]) => {
    const el = document.getElementById(`widget-${key}`);
    if (el) el.style.display = isVisible ? '' : 'none';
  });
}

window.openWidgetCustomizerModal = function () {
  const labels = {
    stats: 'KPI Summary Strip',
    currently_consuming: 'Currently Consuming Media',
    recently_completed: 'Recently Completed Media',
    recently_added: 'Recently Added Media',
    recent_notes: 'Recent Notes',
    category_overview: 'Media Consumption by Category',
    activity_timeline: 'Recent Activity Timeline'
  };

  const container = document.getElementById('widget-toggles-list');
  if (container) {
    container.innerHTML = Object.entries(labels).map(([key, label]) => `
      <div class="settings-card-row">
        <span class="settings-card-title">${escapeHtml(label)}</span>
        <label class="toggle-switch">
          <input type="checkbox" ${dashboardWidgets[key] ? 'checked' : ''} onchange="toggleDashboardWidget('${key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');
  }
  document.getElementById('widget-modal').classList.add('active');
};

window.closeWidgetCustomizerModal = function () {
  document.getElementById('widget-modal').classList.remove('active');
};

window.toggleDashboardWidget = async function (key, checked) {
  dashboardWidgets[key] = checked;
  applyDashboardWidgetVisibility();
  if (isAdminLoggedIn) {
    await supabaseClient.from('user_preferences').upsert([{
      id: 1,
      dashboard_widgets: dashboardWidgets,
      updated_at: new Date().toISOString()
    }]);
  }
};

function renderOverviewDashboard() {
  const activeMedia = allMediaLogs.filter(m => !m.is_archived && !m.deleted_at);
  const activeNotes = allBlogPosts.filter(p => !p.is_archived && !p.deleted_at && (!p.is_private || isAdminLoggedIn));

  setElText('nav-media-count', String(activeMedia.length));
  setElText('nav-notes-count', String(activeNotes.length));

  // KPIs
  const consuming = activeMedia.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'ongoing');
  const completed = activeMedia.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'completed');
  const rated = activeMedia.filter(m => m.rating !== null && m.rating !== undefined && m.rating !== '');
  const meanRating = rated.length
    ? (rated.reduce((acc, m) => acc + Number(m.rating), 0) / rated.length).toFixed(2)
    : '—';

  const usedCats = new Set();
  activeMedia.forEach(m => getItemCategories(m).forEach(c => usedCats.add(c)));

  const compRate = activeMedia.length ? Math.round((completed.length / activeMedia.length) * 100) : 0;

  setElText('dash-total-media', activeMedia.length.toLocaleString('en-US'));
  setElText('dash-categories-used', `${usedCats.size} of 12 categories`);
  setElText('dash-consuming-count', consuming.length.toLocaleString('en-US'));
  setElText('dash-completed-count', completed.length.toLocaleString('en-US'));
  setElText('dash-completion-rate', `${compRate}% completion rate`);
  setElText('dash-mean-rating', meanRating);
  setElText('dash-rated-count', `${rated.length} rated entries`);
  setElText('dash-total-notes', activeNotes.length.toLocaleString('en-US'));
  setElText('dash-pinned-notes', `${activeNotes.filter(n => n.is_pinned).length} pinned`);

  // Helper for compact media rows
  const buildMiniMediaRows = (list, emptyMsg) => {
    if (!list.length) return `<p class="empty-state-compact">${emptyMsg}</p>`;
    return list.slice(0, 5).map(item => {
      const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/80x120/1e1e1f/888?text=?';
      const tracks = getItemTracks(item);
      const t0 = tracks[0];
      const catLbl = CATEGORY_LABELS[t0.category] || t0.category;
      const progLbl = t0.total_units ? `${t0.progress}/${t0.total_units}` : `${t0.progress}`;
      const badge = item.rating !== null && item.rating !== undefined
        ? `★ ${Number(item.rating).toFixed(1)}`
        : progLbl;

      return `
        <div class="dash-media-row" onclick="openMediaDetailModal('${escapeHtml(String(item.id))}')">
          <img src="${cover}" alt="" loading="lazy" onerror="this.src='https://placehold.co/80x120/1e1e1f/888?text=?'">
          <div class="dash-media-info">
            <div class="dash-media-title">${escapeHtml(item.title)}</div>
            <div class="dash-media-meta">${escapeHtml(catLbl)} · ${escapeHtml(STATUS_LABELS[t0.status] || t0.status)}</div>
          </div>
          <span class="dash-media-badge">${escapeHtml(badge)}</span>
        </div>
      `;
    }).join('');
  };

  const consumingEl = document.getElementById('dash-list-consuming');
  if (consumingEl) consumingEl.innerHTML = buildMiniMediaRows(consuming, 'No media currently in progress.');

  const completedSorted = [...completed].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const completedEl = document.getElementById('dash-list-completed');
  if (completedEl) completedEl.innerHTML = buildMiniMediaRows(completedSorted, 'No completed media yet.');

  const recentAdded = [...activeMedia].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const recentAddedEl = document.getElementById('dash-list-recent-media');
  if (recentAddedEl) recentAddedEl.innerHTML = buildMiniMediaRows(recentAdded, 'No media added yet.');

  // Recent Notes
  const recentNotesEl = document.getElementById('dash-list-recent-notes');
  if (recentNotesEl) {
    if (!activeNotes.length) {
      recentNotesEl.innerHTML = `<p class="empty-state-compact">No personal notes yet.</p>`;
    } else {
      recentNotesEl.innerHTML = activeNotes.slice(0, 5).map(n => {
        const title = n.title || (n.content || '').slice(0, 48) + ((n.content || '').length > 48 ? '...' : '');
        return `
          <div class="dash-media-row" onclick="switchMainView('notes')">
            <div class="dash-media-info">
              <div class="dash-media-title">${escapeHtml(title)}</div>
              <div class="dash-media-meta">${escapeHtml(n.folder || 'General')} · ${formatStatusDate(n.created_at)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Category Breakdown
  const catBreakdownEl = document.getElementById('dash-category-breakdown');
  if (catBreakdownEl) {
    const counts = {};
    Object.keys(CATEGORY_LABELS).forEach(k => counts[k] = 0);
    activeMedia.forEach(m => {
      const primary = getLegacyCategory(m);
      if (counts[primary] !== undefined) counts[primary] += 1;
      else counts.other += 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));

    catBreakdownEl.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
      const cnt = counts[key] || 0;
      const pct = Math.round((cnt / maxCount) * 100);
      return `
        <div class="cat-bar-item" onclick="switchMainView('library'); selectCategoryTab('${key}');">
          <div class="cat-bar-top">
            <span>${escapeHtml(label)}</span>
            <strong>${cnt}</strong>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Activity Timeline
  const actEl = document.getElementById('dash-activity-list');
  if (actEl) {
    if (!allActivityLogs.length) {
      actEl.innerHTML = `<p class="empty-state-compact">Activity will appear here as you add and update records.</p>`;
    } else {
      actEl.innerHTML = allActivityLogs.slice(0, 8).map(act => `
        <div class="activity-row-item">
          <div class="activity-row-left">
            <span class="activity-dot"></span>
            <span><strong>${escapeHtml(act.entity_title)}</strong> — ${escapeHtml(act.details || act.action_type)}</span>
          </div>
          <span class="activity-time">${formatStatusDate(act.created_at)}</span>
        </div>
      `).join('');
    }
  }
}

// ==========================================
// 6. IMAGE COMPRESSION, STORAGE & CAROUSEL
// ==========================================
function normalizeImageUrl(url) {
  if (!url) return '';
  return url.trim().replace(/^http:\/\//i, 'https://');
}

function compressImageFile(file, maxWidth = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Image compression failed')),
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function uploadImageToSupabase(file, folder = 'covers') {
  const maxWidth = folder === 'avatars' ? 400 : (folder === 'banners' ? 1200 : 800);
  const compressedBlob = await compressImageFile(file, maxWidth, 0.82);
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, compressedBlob, { contentType: 'image/webp', upsert: false });

  if (error) throw error;

  const { data: publicData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  pendingUploadedUrls.push(publicData.publicUrl);
  return publicData.publicUrl;
}

async function deleteOldStorageFile(fileUrl) {
  if (!fileUrl) return;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;
  const filePath = decodeURIComponent(fileUrl.substring(idx + marker.length).split('?')[0]);
  if (filePath) await supabaseClient.storage.from(STORAGE_BUCKET).remove([filePath]);
}

async function cleanupPendingUploads(keepUrls = []) {
  const keepSet = new Set((Array.isArray(keepUrls) ? keepUrls : [keepUrls]).filter(Boolean));
  for (const tempUrl of pendingUploadedUrls) {
    if (!keepSet.has(tempUrl)) await deleteOldStorageFile(tempUrl);
  }
  pendingUploadedUrls = [];
}

function buildImageCarouselHtml(urls, extraClass = '') {
  const cleanUrls = (Array.isArray(urls) ? urls : []).map(normalizeImageUrl).filter(Boolean);
  if (!cleanUrls.length) return '';
  const total = cleanUrls.length;
  const slidesHtml = cleanUrls.map((src, i) => `
    <div class="carousel-slide">
      <img src="${src}" alt="Slide ${i + 1}" loading="lazy" onerror="this.src='https://placehold.co/300x450/1e1e1f/888?text=Image'">
    </div>
  `).join('');

  if (total === 1) {
    return `<div class="image-carousel ${extraClass}" data-index="0" data-total="1"><div class="carousel-track">${slidesHtml}</div></div>`;
  }

  return `
    <div class="image-carousel ${extraClass}" data-index="0" data-total="${total}">
      <div class="carousel-track">${slidesHtml}</div>
      <span class="carousel-counter">1 / ${total}</span>
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); stepCarouselSlide(this, -1)">
        <ion-icon name="chevron-back-outline"></ion-icon>
      </button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); stepCarouselSlide(this, 1)">
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </button>
    </div>
  `;
}

window.stepCarouselSlide = function (btnEl, delta) {
  const carousel = btnEl.closest('.image-carousel');
  if (!carousel) return;
  const total = parseInt(carousel.dataset.total || '1', 10);
  const current = parseInt(carousel.dataset.index || '0', 10);
  const next = (current + delta + total) % total;
  carousel.dataset.index = String(next);
  const track = carousel.querySelector('.carousel-track');
  if (track) track.style.transform = `translateX(-${next * 100}%)`;
  const counter = carousel.querySelector('.carousel-counter');
  if (counter) counter.textContent = `${next + 1} / ${total}`;
};

// ==========================================
// 7. PROFILE SETTINGS
// ==========================================
function detectSocialIcon(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('github.com')) return 'logo-github';
  if (lower.includes('youtube.com')) return 'logo-youtube';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'logo-twitter';
  if (lower.includes('instagram.com')) return 'logo-instagram';
  if (lower.includes('letterboxd.com')) return 'film-outline';
  if (lower.includes('anilist.co') || lower.includes('myanimelist.net')) return 'tv-outline';
  return 'link-outline';
}

async function fetchProfileSettings() {
  const { data, error } = await supabaseClient
    .from('profile_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (!error && data) {
    currentProfile = {
      name: data.name || 'Archive',
      bio: data.bio || '',
      avatar_url: data.avatar_url || '',
      banner_url: data.banner_url || '',
      social_links: Array.isArray(data.social_links) ? data.social_links : [],
      is_library_private: Boolean(data.is_library_private)
    };
  }
  isProfileLoaded = true;
  applyProfileToUI();
}

function applyProfileToUI() {
  setElText('profile-name-text', currentProfile.name);
  setElText('profile-bio-text', currentProfile.bio);
  setElText('sidebar-name-text', currentProfile.name);

  if (currentProfile.name) {
    document.title = `${currentProfile.name} — Archive`;
    setElText('footer-brand-name', currentProfile.name.toUpperCase());
  }

  const headerCard = document.getElementById('profile-header-card');
  const bannerWrap = document.getElementById('profile-banner-wrap');
  const bannerImg = document.getElementById('profile-banner-img');

  if (headerCard && bannerWrap && bannerImg) {
    if (currentProfile.banner_url) {
      bannerImg.src = normalizeImageUrl(currentProfile.banner_url);
      bannerWrap.style.display = 'block';
      headerCard.classList.add('has-banner');
    } else {
      bannerWrap.style.display = 'none';
      headerCard.classList.remove('has-banner');
    }
  }

  const avatarEl = document.getElementById('profile-avatar-img');
  const sideAvatarEl = document.getElementById('sidebar-avatar-img');
  const faviconEl = document.getElementById('favicon-link');
  const cleanAvatar = normalizeImageUrl(currentProfile.avatar_url) || TRANSPARENT_PIXEL;

  if (avatarEl) avatarEl.src = cleanAvatar;
  if (sideAvatarEl) sideAvatarEl.src = cleanAvatar;
  if (faviconEl && currentProfile.avatar_url) faviconEl.href = cleanAvatar;

  const socialsBar = document.getElementById('profile-socials-bar');
  if (socialsBar) {
    const validLinks = (currentProfile.social_links || []).filter(s => s && s.url);
    if (validLinks.length > 0) {
      socialsBar.style.display = 'flex';
      socialsBar.innerHTML = validLinks.map(s => {
        const href = s.url.startsWith('http') ? s.url : `https://${s.url}`;
        const label = escapeHtml(s.label || s.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
        return `
          <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="social-chip">
            <ion-icon name="${detectSocialIcon(href)}"></ion-icon>
            <span>${label}</span>
          </a>
        `;
      }).join('');
    } else {
      socialsBar.style.display = 'none';
    }
  }

  updateLibraryTabVisibility();
}

window.navigateSettingsStep = function (step) {
  const rootPanel = document.getElementById('settings-step-root');
  const profilePanel = document.getElementById('settings-step-profile');
  const backBtn = document.getElementById('btn-settings-back');
  const headerIcon = document.getElementById('settings-header-icon');
  const titleEl = document.getElementById('settings-modal-title');

  if (step === 'profile') {
    rootPanel.style.display = 'none';
    profilePanel.style.display = 'flex';
    backBtn.style.display = 'inline-flex';
    headerIcon.style.display = 'none';
    titleEl.textContent = 'Profile';
  } else {
    profilePanel.style.display = 'none';
    rootPanel.style.display = 'flex';
    backBtn.style.display = 'none';
    headerIcon.style.display = 'inline-flex';
    titleEl.textContent = 'Settings';
  }
};

window.openSettingsRoot = function () {
  navigateSettingsStep('root');
  pendingUploadedUrls = [];
  document.getElementById('edit-profile-name').value = currentProfile.name;
  document.getElementById('edit-profile-bio').value = currentProfile.bio;
  document.getElementById('edit-profile-avatar').value = currentProfile.avatar_url;
  document.getElementById('edit-profile-banner').value = currentProfile.banner_url;
  document.getElementById('edit-library-private').checked = Boolean(currentProfile.is_library_private);

  const editor = document.getElementById('social-links-editor');
  editor.innerHTML = '';
  (currentProfile.social_links || []).forEach(l => addSocialLinkRow(l.label || '', l.url || ''));

  document.getElementById('profile-modal').classList.add('active');
};

window.closeProfileModal = async function () {
  document.getElementById('profile-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

window.addSocialLinkRow = function (label = '', url = '') {
  const container = document.getElementById('social-links-editor');
  const row = document.createElement('div');
  row.className = 'split-equal-row';
  row.innerHTML = `
    <input type="text" class="form-input social-label-input" placeholder="Label" value="${escapeHtml(label)}">
    <div class="row-right-controls">
      <input type="url" class="form-input social-url-input" placeholder="https://..." value="${escapeHtml(url)}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.split-equal-row').remove()">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.clearBannerInput = function () {
  document.getElementById('edit-profile-banner').value = '';
};

window.handleBannerImageUpload = async function (event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const url = await uploadImageToSupabase(file, 'banners');
    document.getElementById('edit-profile-banner').value = url;
    showToast('Banner uploaded', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const url = await uploadImageToSupabase(file, 'avatars');
    document.getElementById('edit-profile-avatar').value = url;
    showToast('Avatar uploaded', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newAvatar = document.getElementById('edit-profile-avatar').value.trim();
  const newBanner = document.getElementById('edit-profile-banner').value.trim();
  const collectedLinks = [];

  document.querySelectorAll('#social-links-editor .split-equal-row').forEach(row => {
    const label = row.querySelector('.social-label-input')?.value.trim() || '';
    const url = row.querySelector('.social-url-input')?.value.trim() || '';
    if (url) collectedLinks.push({ label, url });
  });

  const updatedProfile = {
    id: 1,
    name: document.getElementById('edit-profile-name').value.trim(),
    bio: document.getElementById('edit-profile-bio').value.trim(),
    avatar_url: newAvatar,
    banner_url: newBanner,
    social_links: collectedLinks,
    is_library_private: Boolean(document.getElementById('edit-library-private')?.checked),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('profile_settings').upsert([updatedProfile]);
  if (error) {
    showToast(error.message, 'error');
  } else {
    await cleanupPendingUploads([newAvatar, newBanner]);
    currentProfile = updatedProfile;
    applyProfileToUI();
    document.getElementById('profile-modal').classList.remove('active');
    showToast('Settings saved', 'success');
  }
});

// ==========================================
// 8. MEDIA DATA HELPERS (BACKWARD COMPATIBLE)
// ==========================================
function getLegacyCategory(item) {
  const raw = (item.category || '').toLowerCase().trim();
  if (raw === 'series' || raw === 'tv_show') return 'tv_show';
  if (raw === 'other') {
    if (item.sub_category === 'light_novel') return 'book';
    if (item.sub_category === 'game') return 'game';
  }
  if (raw === 'novel') return 'book';
  return CATEGORY_LABELS[raw] ? raw : 'other';
}

function normalizeStatusKey(rawStatus) {
  const s = (rawStatus || 'planned').toLowerCase().trim();
  if (s === 'planning') return 'planned';
  if (s === 'in_progress') return 'ongoing';
  return STATUS_LABELS[s] ? s : 'planned';
}

function getItemTracks(item) {
  if (Array.isArray(item.tracks) && item.tracks.length > 0) {
    return item.tracks.map(t => ({
      category: getLegacyCategory({ category: t.category || item.category, sub_category: item.sub_category }),
      status: normalizeStatusKey(t.status || item.status),
      progress: Number(t.progress) || 0,
      total_units: (t.total_units !== null && t.total_units !== undefined && t.total_units !== '') ? Number(t.total_units) : null,
      unit_label: t.unit_label || DEFAULT_UNITS_BY_CAT[t.category] || 'eps',
      season_label: t.season_label || 'Main'
    }));
  }

  const cat = getLegacyCategory(item);
  return [{
    category: cat,
    status: normalizeStatusKey(item.status),
    progress: Number(item.progress) || 0,
    total_units: (item.total_units !== null && item.total_units !== undefined && item.total_units !== '') ? Number(item.total_units) : null,
    unit_label: item.unit_label || DEFAULT_UNITS_BY_CAT[cat] || 'item',
    season_label: 'Main'
  }];
}

function getItemCategories(item) {
  const tracks = getItemTracks(item);
  const cats = new Set(tracks.map(t => t.category));
  cats.add(getLegacyCategory(item));
  return Array.from(cats);
}

function getItemGalleryUrls(item) {
  const urls = [];
  if (Array.isArray(item.gallery_urls)) {
    item.gallery_urls.forEach(u => {
      const clean = normalizeImageUrl(u);
      if (clean && !urls.includes(clean)) urls.push(clean);
    });
  }
  const cover = normalizeImageUrl(item.cover_url);
  if (cover && !urls.includes(cover)) urls.unshift(cover);
  return urls;
}

function getItemEpisodeReviews(item) {
  if (!Array.isArray(item.episode_reviews)) return [];
  return item.episode_reviews.filter(r => r && (r.number || r.rating !== null || r.note || r.title));
}

function computeSyncedStatus(tracks) {
  const statuses = tracks.map(t => normalizeStatusKey(t.status));
  if (statuses.includes('ongoing')) return { key: 'ongoing', label: 'In Progress' };
  if (statuses.length > 0 && statuses.every(s => s === 'completed')) return { key: 'completed', label: 'Completed' };
  if (statuses.includes('on_hold')) return { key: 'on_hold', label: 'On Hold' };
  if (statuses.includes('dropped')) return { key: 'dropped', label: 'Dropped' };
  return { key: 'planned', label: 'Planning' };
}

function getItemTotalUnitsValue(item) {
  const tracks = getItemTracks(item);
  const sumTot = tracks.reduce((s, t) => s + (Number(t.total_units) || 0), 0);
  return sumTot > 0 ? sumTot : tracks.reduce((s, t) => s + (Number(t.progress) || 0), 0);
}

function formatStatusDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ==========================================
// 9. FETCH & RENDER MEDIA LIBRARY
// ==========================================
async function fetchMediaLogs() {
  const { data, error } = await supabaseClient
    .from('media_logs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    const grid = document.getElementById('media-grid');
    if (grid) grid.innerHTML = `<p class="empty-state">Failed to load library: ${escapeHtml(error.message)}</p>`;
    return;
  }

  allMediaLogs = data || [];
  updateLibraryStatsUI();
  renderMediaGrid();
  renderOverviewDashboard();
}

function updateLibraryStatsUI() {
  const active = allMediaLogs.filter(m => !m.is_archived && !m.deleted_at);
  setElText('total-entries-label', `${active.length} Entries`);

  const completed = active.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'completed');
  const rate = active.length ? Math.round((completed.length / active.length) * 100) : 0;
  setElText('stat-completed-total', String(completed.length));
  setElText('stat-completion-rate', `${rate}% Rate`);

  const rated = active.filter(m => m.rating !== null && m.rating !== undefined && m.rating !== '');
  const avg = rated.length ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(2) : '0.0';
  setElText('stat-avg-rating', avg);
  setElText('stat-rated-count', `${rated.length} Rated`);

  const statsGrid = document.getElementById('library-category-stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
      const catItems = active.filter(m => getItemCategories(m).includes(key));
      const catDone = catItems.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'completed');
      return `
        <div class="stat-bento-card">
          <span class="stat-label">${escapeHtml(label)}</span>
          <span class="stat-value">${catItems.length}</span>
          <span class="stat-sub">${catDone.length} Completed</span>
        </div>
      `;
    }).join('');
  }
}

window.toggleLibraryStats = function () {
  isStatsExpanded = !isStatsExpanded;
  const panel = document.getElementById('collapsible-stats-panel');
  const textEl = document.getElementById('stats-toggle-text');
  const iconEl = document.getElementById('stats-chevron-icon');
  if (panel) panel.style.display = isStatsExpanded ? 'flex' : 'none';
  if (textEl) textEl.textContent = isStatsExpanded ? 'Hide Stats' : 'Show Stats';
  if (iconEl) iconEl.setAttribute('name', isStatsExpanded ? 'chevron-up-outline' : 'chevron-down-outline');
};

window.selectCategoryTab = function (catKey) {
  currentCategory = catKey;
  document.querySelectorAll('.cat-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.category === catKey);
  });
  resetPaginationAndRender();
};

function setupFilterListeners() {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => selectCategoryTab(btn.dataset.category));
  });

  ['search-library', 'filter-genre', 'filter-year', 'filter-rating-min', 'filter-rating-max'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', resetPaginationAndRender);
  });

  ['filter-status', 'filter-collection', 'filter-favorites-only', 'filter-unrated-only'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', resetPaginationAndRender);
  });
}

function closeAllToolbarPopovers() {
  ['filter-popover-menu', 'sort-popover-menu'].forEach(id => document.getElementById(id)?.classList.remove('open'));
  ['btn-filter-toggle', 'btn-sort-toggle'].forEach(id => document.getElementById(id)?.classList.remove('active'));
}

function setupOutsidePopoverCloser() {
  document.addEventListener('click', (e) => {
    const inFilter = document.getElementById('filter-popover-wrap')?.contains(e.target);
    const inSort = document.getElementById('sort-popover-wrap')?.contains(e.target);
    if (!inFilter && !inSort) closeAllToolbarPopovers();
  });
}

window.toggleToolbarPopover = function (type) {
  const menuId = type === 'filter' ? 'filter-popover-menu' : 'sort-popover-menu';
  const btnId = type === 'filter' ? 'btn-filter-toggle' : 'btn-sort-toggle';
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(btnId);
  const willOpen = menu && !menu.classList.contains('open');
  closeAllToolbarPopovers();
  if (willOpen) {
    menu.classList.add('open');
    btn?.classList.add('active');
  }
};

window.resetLibraryFilters = function () {
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-collection').value = 'all';
  document.getElementById('filter-genre').value = '';
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-rating-min').value = '';
  document.getElementById('filter-rating-max').value = '';
  document.getElementById('filter-favorites-only').checked = false;
  document.getElementById('filter-unrated-only').checked = false;
  resetPaginationAndRender();
};

function updateSortUIControls() {
  const labelMap = {
    rating: currentSortDir === 'desc' ? 'Rating (Best)' : 'Rating (Worst)',
    updated: currentSortDir === 'desc' ? 'Recently Updated' : 'Oldest Updated',
    created: currentSortDir === 'desc' ? 'Recently Added' : 'Oldest Added',
    year: currentSortDir === 'desc' ? 'Year (Newest)' : 'Year (Oldest)',
    units: currentSortDir === 'desc' ? 'Count (High)' : 'Count (Low)',
    title: currentSortDir === 'asc' ? 'Title (A–Z)' : 'Title (Z–A)'
  };
  setElText('sort-btn-label', labelMap[currentSortField] || 'Sort');
  document.getElementById('btn-sort-desc')?.classList.toggle('active', currentSortDir === 'desc');
  document.getElementById('btn-sort-asc')?.classList.toggle('active', currentSortDir === 'asc');
}

window.onSortOptionChange = function () {
  currentSortField = document.getElementById('sort-library-field').value;
  currentSortDir = currentSortField === 'title' ? 'asc' : 'desc';
  updateSortUIControls();
  resetPaginationAndRender();
};

window.setSortDirection = function (dir) {
  currentSortDir = dir;
  updateSortUIControls();
  resetPaginationAndRender();
};

window.setLibraryViewMode = function (mode) {
  libraryViewMode = mode;
  document.querySelectorAll('.view-seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderMediaGrid();
};

window.loadMoreMedia = function () {
  visibleMediaLimit += itemsPerPage;
  renderMediaGrid();
};

function resetPaginationAndRender() {
  visibleMediaLimit = itemsPerPage;
  renderMediaGrid();
}

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;

  const query = (document.getElementById('search-library')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const colFilter = document.getElementById('filter-collection')?.value || 'all';
  const genreFilter = (document.getElementById('filter-genre')?.value || '').toLowerCase().trim();
  const yearFilter = document.getElementById('filter-year')?.value || '';
  const rMin = document.getElementById('filter-rating-min')?.value || '';
  const rMax = document.getElementById('filter-rating-max')?.value || '';
  const favOnly = document.getElementById('filter-favorites-only')?.checked || false;
  const unratedOnly = document.getElementById('filter-unrated-only')?.checked || false;

  const isFiltered = statusFilter !== 'all' || colFilter !== 'all' || genreFilter || yearFilter || rMin || rMax || favOnly || unratedOnly;
  const dot = document.getElementById('filter-active-dot');
  if (dot) dot.style.display = isFiltered ? 'inline-block' : 'none';

  const colMediaIds = colFilter !== 'all'
    ? new Set(allCollectionItems.filter(ci => String(ci.collection_id) === colFilter).map(ci => String(ci.media_id)))
    : null;

  let filtered = allMediaLogs.filter(item => {
    if (item.is_archived || item.deleted_at) return false;
    const cats = getItemCategories(item);
    const tracks = getItemTracks(item);
    const synced = computeSyncedStatus(tracks);

    if (currentCategory !== 'all' && !cats.includes(currentCategory)) return false;
    if (statusFilter !== 'all' && synced.key !== statusFilter && !tracks.some(t => t.status === statusFilter)) return false;
    if (colMediaIds && !colMediaIds.has(String(item.id))) return false;
    if (favOnly && !item.is_favorite) return false;
    if (yearFilter && String(item.release_year || '') !== String(yearFilter)) return false;

    const genresArr = Array.isArray(item.genres) ? item.genres : [];
    const tagsArr = Array.isArray(item.tags) ? item.tags : [];
    if (genreFilter) {
      const combined = [...genresArr, ...tagsArr].join(' ').toLowerCase();
      if (!combined.includes(genreFilter)) return false;
    }

    const hasRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
    if (unratedOnly && hasRating) return false;
    if (!unratedOnly && (rMin !== '' || rMax !== '')) {
      if (!hasRating) return false;
      const rv = Number(item.rating);
      if (rMin !== '' && rv < parseFloat(rMin)) return false;
      if (rMax !== '' && rv > parseFloat(rMax)) return false;
    }

    if (query) {
      const hay = [
        item.title,
        item.original_title,
        item.creator,
        ...genresArr,
        ...tagsArr
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (currentSortField === 'rating') {
      const aHas = a.rating !== null && a.rating !== undefined && a.rating !== '';
      const bHas = b.rating !== null && b.rating !== undefined && b.rating !== '';
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1;
      if (!bHas) return -1;
      const diff = Number(a.rating) - Number(b.rating);
      return currentSortDir === 'desc' ? -diff : diff;
    }
    if (currentSortField === 'year') {
      const diff = (Number(a.release_year) || 0) - (Number(b.release_year) || 0);
      return currentSortDir === 'desc' ? -diff : diff;
    }
    if (currentSortField === 'units') {
      const diff = getItemTotalUnitsValue(a) - getItemTotalUnitsValue(b);
      return currentSortDir === 'desc' ? -diff : diff;
    }
    if (currentSortField === 'title') {
      const cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      return currentSortDir === 'asc' ? cmp : -cmp;
    }
    const field = currentSortField === 'created' ? 'created_at' : 'updated_at';
    const diff = new Date(a[field] || 0).getTime() - new Date(b[field] || 0).getTime();
    return currentSortDir === 'desc' ? -diff : diff;
  });

  grid.classList.remove('list-view', 'compact-view');
  if (libraryViewMode === 'list') grid.classList.add('list-view');
  if (libraryViewMode === 'compact') grid.classList.add('compact-view');

  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">No media entries match your current filters.</p>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  const displayed = filtered.slice(0, visibleMediaLimit);
  const remaining = filtered.length - displayed.length;
  if (loadMoreWrap) {
    loadMoreWrap.style.display = remaining > 0 ? 'flex' : 'none';
    setElText('load-more-text', `Load More (${remaining} remaining)`);
  }

  // 1. COMPACT TABLE VIEW
  if (libraryViewMode === 'compact') {
    grid.innerHTML = `
      <div class="compact-table-wrap">
        <table class="compact-media-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Year</th>
              <th>Rating</th>
              ${isAdminLoggedIn ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${displayed.map(item => {
              const tracks = getItemTracks(item);
              const t0 = tracks[0];
              const synced = computeSyncedStatus(tracks);
              const catLbl = CATEGORY_LABELS[getLegacyCategory(item)] || item.category;
              const progStr = t0.total_units ? `${t0.progress} / ${t0.total_units}` : `${t0.progress}`;
              const ratingStr = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
              return `
                <tr onclick="openMediaDetailModal('${escapeHtml(String(item.id))}')">
                  <td><strong>${escapeHtml(item.title)}</strong> ${item.is_favorite ? '♥' : ''}</td>
                  <td>${escapeHtml(catLbl)}</td>
                  <td>${escapeHtml(synced.label)}</td>
                  <td>${escapeHtml(progStr)}</td>
                  <td>${item.release_year || '—'}</td>
                  <td>${ratingStr}</td>
                  ${isAdminLoggedIn ? `<td><button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditModal('${escapeHtml(String(item.id))}')"><ion-icon name="create-outline"></ion-icon></button></td>` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  // 2. LIST VIEW
  if (libraryViewMode === 'list') {
    grid.innerHTML = displayed.map(item => {
      const safeId = escapeHtml(String(item.id));
      const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/120x180/1e1e1f/888?text=?';
      const tracks = getItemTracks(item);
      const t0 = tracks[0];
      const synced = computeSyncedStatus(tracks);
      const catLbl = CATEGORY_LABELS[getLegacyCategory(item)] || item.category;
      const progStr = t0.total_units ? `${t0.progress}/${t0.total_units}` : `${t0.progress}`;
      const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';

      return `
        <div class="media-list-row" onclick="openMediaDetailModal('${safeId}')">
          <img class="list-thumb" src="${cover}" alt="" loading="lazy" onerror="this.src='https://placehold.co/120x180/1e1e1f/888?text=?'">
          <div class="list-main-info">
            <div class="list-title">${escapeHtml(item.title)} ${item.is_favorite ? '♥' : ''}</div>
            <div class="list-sub-meta">
              <span>${escapeHtml(catLbl)}</span> · <span>${escapeHtml(synced.label)}</span> · <span>${escapeHtml(progStr)}</span>
              ${item.release_year ? ` · <span>${item.release_year}</span>` : ''}
            </div>
          </div>
          <div class="list-right-meta">
            <span class="list-rating-pill">${ratingText}</span>
            ${isAdminLoggedIn ? `<button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditModal('${safeId}')"><ion-icon name="create-outline"></ion-icon></button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // 3. GRID VIEW (DEFAULT)
  grid.innerHTML = displayed.map(item => {
    const safeId = escapeHtml(String(item.id));
    const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888?text=No+Cover';
    const catLbl = CATEGORY_LABELS[getLegacyCategory(item)] || item.category;
    const ratingChip = (item.rating !== null && item.rating !== undefined)
      ? `<span class="poster-chip">★ ${Number(item.rating).toFixed(1)}</span>`
      : '<span></span>';
    const favChip = item.is_favorite ? `<span class="poster-chip">♥</span>` : '';

    return `
      <div class="media-card" onclick="openMediaDetailModal('${safeId}')">
        <div class="media-cover-wrap">
          <div class="poster-top-badges">${ratingChip}${favChip}</div>
          <img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://placehold.co/300x450/1e1e1f/888?text=No+Cover'">
          <div class="poster-bottom-overlay">
            <h3 class="poster-title">${escapeHtml(item.title)}</h3>
            <div class="poster-sub-cat">${escapeHtml(catLbl)}${item.release_year ? ` · ${item.release_year}` : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 10. MEDIA DETAIL MODAL
// ==========================================
window.openMediaDetailModal = function (id) {
  const item = allMediaLogs.find(m => String(m.id) === String(id));
  if (!item) return;

  const safeId = escapeHtml(String(item.id));
  const gallery = getItemGalleryUrls(item);
  const fallback = 'https://placehold.co/300x450/1e1e1f/888?text=No+Cover';
  const slides = gallery.length ? gallery : [fallback];

  const tracks = getItemTracks(item);
  const synced = computeSyncedStatus(tracks);
  const catLbl = CATEGORY_LABELS[getLegacyCategory(item)] || item.category;
  const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)} / 10` : 'Unrated';
  const genres = Array.isArray(item.genres) ? item.genres : [];
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const catMeta = item.category_meta && typeof item.category_meta === 'object' ? item.category_meta : {};
  const epReviews = getItemEpisodeReviews(item);

  setElText('detail-modal-title', item.title);

  const heroVisual = slides.length > 1
    ? buildImageCarouselHtml(slides, 'detail-gallery-carousel')
    : `<img class="detail-poster" src="${slides[0]}" alt="" onerror="this.src='${fallback}'">`;

  const metaEntries = [];
  if (item.original_title) metaEntries.push({ k: 'Original Title', v: item.original_title });
  if (item.creator) metaEntries.push({ k: 'Creator / Studio', v: item.creator });
  if (item.release_year) metaEntries.push({ k: 'Release Year', v: item.release_year });
  if (item.start_date) metaEntries.push({ k: 'Started', v: item.start_date });
  if (item.completion_date) metaEntries.push({ k: 'Completed', v: item.completion_date });

  Object.entries(catMeta).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') {
      metaEntries.push({ k: k.replace(/_/g, ' '), v: String(v) });
    }
  });

  const tracksHtml = tracks.map(t => {
    const hasTot = t.total_units !== null && t.total_units > 0;
    const pct = hasTot ? Math.min(100, Math.round((t.progress / t.total_units) * 100)) : (t.status === 'completed' ? 100 : 35);
    const progStr = hasTot ? `${t.progress} / ${t.total_units} ${UNIT_SHORT_LABELS[t.unit_label] || ''}` : `${t.progress} ${UNIT_SHORT_LABELS[t.unit_label] || ''}`;
    return `
      <div class="detail-progress-card">
        <div class="detail-progress-top">
          <strong>${escapeHtml(CATEGORY_LABELS[t.category] || t.category)} · ${escapeHtml(t.season_label || 'Main')}</strong>
          <span class="detail-pill-badge">${escapeHtml(STATUS_LABELS[t.status] || t.status)}</span>
        </div>
        <div class="detail-progress-bar-track"><div class="detail-progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="detail-progress-bottom"><span>${escapeHtml(progStr)}</span><span>${pct}%</span></div>
      </div>
    `;
  }).join('');

  document.getElementById('media-detail-body').innerHTML = `
    <div class="detail-hero">
      ${heroVisual}
      <div class="detail-meta-col">
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="detail-pill-badge">${escapeHtml(catLbl)}</span>
          <span class="detail-pill-badge">${escapeHtml(synced.label)}</span>
          <span class="detail-pill-badge">${escapeHtml(ratingText)}</span>
          ${item.is_favorite ? `<span class="detail-pill-badge">♥ Favorite</span>` : ''}
        </div>
        ${genres.length ? `<div class="note-tags-row">${genres.map(g => `<span class="tag-pill">${escapeHtml(g)}</span>`).join('')}</div>` : ''}
        ${tags.length ? `<div class="note-tags-row">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${item.external_url ? `<a href="${escapeHtml(item.external_url)}" target="_blank" rel="noopener noreferrer" class="dash-link-btn">Open External Reference ↗</a>` : ''}
      </div>
    </div>

    ${metaEntries.length ? `
      <div class="detail-meta-grid">
        ${metaEntries.map(m => `<div class="detail-meta-item"><span>${escapeHtml(m.k)}</span>${escapeHtml(m.v)}</div>`).join('')}
      </div>
    ` : ''}

    ${item.description ? `<div><div class="detail-section-title">Synopsis</div><p style="font-size:12.5px; color:var(--light-gray); line-height:1.55;">${escapeHtml(item.description)}</p></div>` : ''}

    <div>
      <div class="detail-section-title">Progress & Tracking</div>
      <div class="detail-progress-list">${tracksHtml}</div>
    </div>

    ${item.review ? `<div><div class="detail-section-title">Personal Review</div><div class="ep-review-card" style="font-size:12.5px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(item.review)}</div></div>` : ''}

    ${epReviews.length ? `
      <div>
        <div class="detail-section-title">Episode / Chapter / Route Logs (${epReviews.length})</div>
        <div class="ep-review-cards-list">
          ${epReviews.map((ep, i) => `
            <div class="ep-review-card">
              <div class="ep-review-main">
                <strong>${escapeHtml(ep.number || `Entry ${i + 1}`)}</strong>
                ${ep.rating !== null && ep.rating !== undefined ? `<span class="detail-pill-badge">★ ${Number(ep.rating).toFixed(1)}</span>` : ''}
              </div>
              ${ep.note ? `<div class="ep-review-note">${escapeHtml(ep.note)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${isAdminLoggedIn ? `
      <div class="modal-submit-row">
        <button type="button" class="form-btn primary-submit" onclick="closeMediaDetailModal(); openEditModal('${safeId}');">
          <ion-icon name="create-outline"></ion-icon>
          <span>Edit Media</span>
        </button>
      </div>
    ` : ''}
  `;

  document.getElementById('media-detail-modal').classList.add('active');
};

window.closeMediaDetailModal = function () {
  document.getElementById('media-detail-modal').classList.remove('active');
};

// ==========================================
// 11. ADD / EDIT MEDIA MODAL & DYNAMIC FIELDS
// ==========================================
window.onPrimaryCategoryModalChange = function (existingMeta = {}) {
  const cat = document.getElementById('media-primary-cat').value;
  renderCategorySpecificFields(cat, existingMeta);
};

function renderCategorySpecificFields(catKey, existingMeta = {}) {
  const box = document.getElementById('category-specific-fields-box');
  if (!box) return;
  const schema = CATEGORY_SPECIFIC_SCHEMA[catKey] || [];
  if (!schema.length) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `<div class="form-row">${schema.map(field => {
    const val = existingMeta[field.key] ?? '';
    if (field.type === 'select') {
      return `
        <div class="form-group">
          <label>${escapeHtml(field.label)}</label>
          <select class="form-input cat-meta-input" data-meta-key="${field.key}">
            ${field.options.map(opt => `<option value="${escapeHtml(opt)}" ${val === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    return `
      <div class="form-group">
        <label>${escapeHtml(field.label)}</label>
        <input type="${field.type}" class="form-input cat-meta-input" data-meta-key="${field.key}" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(field.placeholder || '')}">
      </div>
    `;
  }).join('')}</div>`;
}

function renderCollectionCheckboxes(mediaId = null) {
  const group = document.getElementById('media-collections-assign-group');
  const grid = document.getElementById('media-collections-checkboxes');
  if (!group || !grid) return;

  if (!allCollections.length) {
    group.style.display = 'none';
    return;
  }

  group.style.display = 'flex';
  const assignedIds = mediaId
    ? new Set(allCollectionItems.filter(ci => String(ci.media_id) === String(mediaId)).map(ci => String(ci.collection_id)))
    : new Set();

  grid.innerHTML = allCollections.map(col => `
    <label class="collection-check-pill">
      <input type="checkbox" class="media-col-checkbox" value="${escapeHtml(String(col.id))}" ${assignedIds.has(String(col.id)) ? 'checked' : ''}>
      <span>${escapeHtml(col.name)}</span>
    </label>
  `).join('');
}

window.addMediaImageRow = function (url = '') {
  const container = document.getElementById('media-gallery-editor');
  const row = document.createElement('div');
  row.className = 'cover-split-row';
  row.innerHTML = `
    <input type="url" class="form-input media-gallery-url-input" placeholder="Cover URL" value="${escapeHtml(url)}">
    <div class="row-right-controls">
      <label class="equal-upload-btn">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        <span>Upload</span>
        <input type="file" accept="image/*" hidden onchange="handleSingleCoverRowUpload(event, this)">
      </label>
      <button type="button" class="social-remove-btn" onclick="this.closest('.cover-split-row').remove()">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.handleSingleCoverRowUpload = async function (event, fileInput) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const row = fileInput.closest('.cover-split-row');
  const urlInput = row?.querySelector('.media-gallery-url-input');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'covers');
    if (urlInput) urlInput.value = publicUrl;
    showToast('Cover uploaded', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.addMediaTrackRow = function (track = null) {
  const container = document.getElementById('media-tracks-editor');
  const cat = track?.category || document.getElementById('media-primary-cat')?.value || 'movie';
  const status = track?.status || 'completed';
  const progress = track?.progress ?? 0;
  const total = track?.total_units ?? '';
  const unit = track?.unit_label || DEFAULT_UNITS_BY_CAT[cat] || 'item';
  const season = track?.season_label || 'Main';

  const card = document.createElement('div');
  card.className = 'track-edit-card';
  card.innerHTML = `
    <div class="clean-card-row-cat">
      <select class="form-input track-cat-select">
        ${Object.entries(CATEGORY_LABELS).map(([k, lbl]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${escapeHtml(lbl)}</option>`).join('')}
      </select>
      <button type="button" class="social-remove-btn" onclick="this.closest('.track-edit-card').remove()">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="clean-card-row-3col">
      <select class="form-input track-unit-select">
        <option value="movie" ${unit === 'movie' ? 'selected' : ''}>Movie</option>
        <option value="eps" ${unit === 'eps' ? 'selected' : ''}>Episode</option>
        <option value="ch" ${unit === 'ch' ? 'selected' : ''}>Chapter</option>
        <option value="vol" ${unit === 'vol' ? 'selected' : ''}>Volume</option>
        <option value="pages" ${unit === 'pages' ? 'selected' : ''}>Pages</option>
        <option value="track" ${unit === 'track' ? 'selected' : ''}>Track</option>
        <option value="item" ${unit === 'item' ? 'selected' : ''}>Item</option>
      </select>
      <select class="form-input track-status-select">
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planning</option>
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>In Progress</option>
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="on_hold" ${status === 'on_hold' ? 'selected' : ''}>On Hold</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <select class="form-input track-season-select">
        ${SEASON_PART_OPTIONS.map(opt => `<option value="${opt}" ${season === opt ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    </div>
    <div class="clean-card-row-eps">
      <input type="number" class="form-input track-progress-input" min="0" value="${progress}" placeholder="Current">
      <span>/</span>
      <input type="number" class="form-input track-total-input" min="0" value="${total}" placeholder="Total">
    </div>
  `;
  container.appendChild(card);
};

window.addEpisodeReviewRow = function (ep = null) {
  const container = document.getElementById('media-ep-reviews-editor');
  const row = document.createElement('div');
  row.className = 'review-split-row';
  row.innerHTML = `
    <div class="review-part-group">
      <input type="text" class="form-input ep-num-input" placeholder="Ep / Ch / Route" value="${escapeHtml(ep?.number || '')}">
      <input type="number" class="form-input ep-rating-input" step="0.5" min="0" max="10" placeholder="0–10" value="${ep?.rating ?? ''}">
    </div>
    <div class="row-right-controls">
      <input type="text" class="form-input ep-note-input" placeholder="Notes / Impressions" value="${escapeHtml(ep?.note || ep?.title || '')}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.review-split-row').remove()">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.stepModalRepeat = function () {
  const inp = document.getElementById('media-repeat');
  inp.value = (parseInt(inp.value, 10) || 0) + 1;
};

window.openMediaModal = function () {
  pendingUploadedUrls = [];
  setElText('media-modal-title', 'Add Media');
  document.getElementById('media-form').reset();
  document.getElementById('media-id').value = '';
  document.getElementById('btn-modal-delete').style.display = 'none';
  document.getElementById('api-search-results').style.display = 'none';

  const defaultCat = currentCategory !== 'all' ? currentCategory : 'movie';
  document.getElementById('media-primary-cat').value = defaultCat;
  onPrimaryCategoryModalChange({});

  document.getElementById('media-gallery-editor').innerHTML = '';
  addMediaImageRow('');

  document.getElementById('media-tracks-editor').innerHTML = '';
  addMediaTrackRow({ category: defaultCat, status: 'planned', progress: 0, unit_label: DEFAULT_UNITS_BY_CAT[defaultCat] });

  document.getElementById('media-ep-reviews-editor').innerHTML = '';
  renderCollectionCheckboxes(null);

  document.getElementById('media-modal').classList.add('active');
};

window.openEditModal = function (id) {
  const item = allMediaLogs.find(m => String(m.id) === String(id));
  if (!item) return;

  pendingUploadedUrls = [];
  setElText('media-modal-title', 'Edit Media');
  document.getElementById('media-id').value = item.id;
  document.getElementById('btn-modal-delete').style.display = 'inline-flex';

  const primaryCat = getLegacyCategory(item);
  document.getElementById('media-title').value = item.title || '';
  document.getElementById('media-original-title').value = item.original_title || '';
  document.getElementById('media-primary-cat').value = primaryCat;
  document.getElementById('media-release-year').value = item.release_year || '';
  document.getElementById('media-creator').value = item.creator || '';
  document.getElementById('media-genres').value = Array.isArray(item.genres) ? item.genres.join(', ') : '';
  document.getElementById('media-tags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  document.getElementById('media-rating').value = item.rating ?? '';
  document.getElementById('media-start-date').value = item.start_date || '';
  document.getElementById('media-completion-date').value = item.completion_date || '';
  document.getElementById('media-repeat').value = Number(item.repeat_count) || 0;
  document.getElementById('media-external-url').value = item.external_url || '';
  document.getElementById('media-description').value = item.description || '';
  document.getElementById('media-review').value = item.review || '';
  document.getElementById('media-is-favorite').checked = Boolean(item.is_favorite);
  document.getElementById('media-is-archived').checked = Boolean(item.is_archived);

  onPrimaryCategoryModalChange(item.category_meta || {});

  const galleryEditor = document.getElementById('media-gallery-editor');
  galleryEditor.innerHTML = '';
  const urls = getItemGalleryUrls(item);
  (urls.length ? urls : ['']).forEach(u => addMediaImageRow(u));

  const tracksEditor = document.getElementById('media-tracks-editor');
  tracksEditor.innerHTML = '';
  getItemTracks(item).forEach(t => addMediaTrackRow(t));

  const epEditor = document.getElementById('media-ep-reviews-editor');
  epEditor.innerHTML = '';
  getItemEpisodeReviews(item).forEach(ep => addEpisodeReviewRow(ep));

  renderCollectionCheckboxes(item.id);
  document.getElementById('media-modal').classList.add('active');
};

window.closeMediaModal = async function () {
  document.getElementById('media-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

// Save Media Entry
document.getElementById('media-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('media-id').value;
  const primaryCat = document.getElementById('media-primary-cat').value;
  const titleVal = document.getElementById('media-title').value.trim();

  const galleryUrls = [];
  document.querySelectorAll('#media-gallery-editor .media-gallery-url-input').forEach(inp => {
    const clean = normalizeImageUrl(inp.value);
    if (clean && !galleryUrls.includes(clean)) galleryUrls.push(clean);
  });

  const tracks = [];
  document.querySelectorAll('#media-tracks-editor .track-edit-card').forEach(card => {
    const cat = card.querySelector('.track-cat-select').value;
    const status = card.querySelector('.track-status-select').value;
    const totalRaw = card.querySelector('.track-total-input').value;
    const totalUnits = totalRaw !== '' ? parseInt(totalRaw, 10) : null;
    let progress = parseInt(card.querySelector('.track-progress-input').value, 10) || 0;
    if (status === 'completed' && totalUnits > 0 && progress === 0) progress = totalUnits;

    tracks.push({
      category: cat,
      status,
      season_label: card.querySelector('.track-season-select').value,
      progress,
      total_units: totalUnits,
      unit_label: card.querySelector('.track-unit-select').value
    });
  });

  if (!tracks.length) {
    tracks.push({
      category: primaryCat,
      status: 'planned',
      season_label: 'Main',
      progress: 0,
      total_units: null,
      unit_label: DEFAULT_UNITS_BY_CAT[primaryCat] || 'item'
    });
  }

  const episodeReviews = [];
  document.querySelectorAll('#media-ep-reviews-editor .review-split-row').forEach(row => {
    const num = row.querySelector('.ep-num-input')?.value.trim() || '';
    const rRaw = row.querySelector('.ep-rating-input')?.value ?? '';
    const note = row.querySelector('.ep-note-input')?.value.trim() || '';
    if (num || rRaw !== '' || note) {
      episodeReviews.push({
        number: num,
        rating: rRaw !== '' ? parseFloat(rRaw) : null,
        note
      });
    }
  });

  const categoryMeta = {};
  document.querySelectorAll('#category-specific-fields-box .cat-meta-input').forEach(inp => {
    if (inp.value !== '') categoryMeta[inp.dataset.metaKey] = inp.value;
  });

  const genres = document.getElementById('media-genres').value.split(',').map(s => s.trim()).filter(Boolean);
  const tags = document.getElementById('media-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  const ratingRaw = document.getElementById('media-rating').value;
  const synced = computeSyncedStatus(tracks);
  const categories = Array.from(new Set([primaryCat, ...tracks.map(t => t.category)]));

  const payload = {
    title: titleVal,
    original_title: document.getElementById('media-original-title').value.trim() || null,
    category: primaryCat,
    categories,
    tracks,
    episode_reviews: episodeReviews,
    gallery_urls: galleryUrls,
    cover_url: galleryUrls[0] || null,
    status: synced.key,
    progress: tracks[0].progress,
    total_units: tracks[0].total_units,
    unit_label: tracks[0].unit_label,
    rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null,
    release_year: document.getElementById('media-release-year').value ? parseInt(document.getElementById('media-release-year').value, 10) : null,
    creator: document.getElementById('media-creator').value.trim() || null,
    genres,
    tags,
    start_date: document.getElementById('media-start-date').value || null,
    completion_date: document.getElementById('media-completion-date').value || null,
    repeat_count: Math.max(0, parseInt(document.getElementById('media-repeat').value, 10) || 0),
    external_url: document.getElementById('media-external-url').value.trim() || null,
    description: document.getElementById('media-description').value.trim() || null,
    review: document.getElementById('media-review').value.trim() || null,
    category_meta: categoryMeta,
    is_favorite: document.getElementById('media-is-favorite').checked,
    is_archived: document.getElementById('media-is-archived').checked,
    updated_at: new Date().toISOString()
  };

  let savedId = id;
  let error;
  if (id) {
    ({ error } = await supabaseClient.from('media_logs').update(payload).eq('id', id));
  } else {
    const res = await supabaseClient.from('media_logs').insert([payload]).select('id').single();
    error = res.error;
    if (res.data) savedId = res.data.id;
  }

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  // Sync collection assignments
  if (savedId && allCollections.length) {
    const selectedColIds = Array.from(document.querySelectorAll('.media-col-checkbox:checked')).map(cb => cb.value);
    await supabaseClient.from('media_collection_items').delete().eq('media_id', savedId);
    if (selectedColIds.length) {
      await supabaseClient.from('media_collection_items').insert(
        selectedColIds.map(cid => ({ collection_id: cid, media_id: savedId }))
      );
    }
    await fetchCollections();
  }

  await cleanupPendingUploads(galleryUrls);
  document.getElementById('media-modal').classList.remove('active');

  await logPersonalActivity(
    id ? 'media_updated' : 'media_added',
    'media',
    savedId,
    titleVal,
    `${id ? 'Updated' : 'Added'} (${CATEGORY_LABELS[primaryCat]} · ${synced.label})`
  );

  await fetchMediaLogs();
  showToast(id ? 'Media updated' : 'Media added', 'success');
});

window.deleteCurrentModalMedia = async function () {
  const id = document.getElementById('media-id').value;
  if (!id) return;
  const confirm = await Swal.fire({
    text: 'Delete this media entry permanently?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    background: '#1a1a1c',
    color: '#fff'
  });
  if (confirm.isConfirmed) {
    const { error } = await supabaseClient.from('media_logs').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else {
      document.getElementById('media-modal').classList.remove('active');
      await fetchMediaLogs();
      showToast('Deleted', 'info');
    }
  }
};

// ==========================================
// 12. EXTERNAL API METADATA AUTO-FILL (PUBLIC ENDPOINTS)
// ==========================================
window.searchExternalAPI = async function () {
  const query = document.getElementById('api-search-input').value.trim();
  const cat = document.getElementById('api-search-cat').value;
  const resultsBox = document.getElementById('api-search-results');
  if (!query) return;

  resultsBox.style.display = 'block';
  resultsBox.innerHTML = `<p style="padding:10px; font-size:12px; color:var(--mono-muted);">Searching...</p>`;

  let items = [];
  try {
    if (cat === 'anime') {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=6&sfw=true`);
      const data = await res.json();
      items = (data.data || []).map(a => ({
        title: a.title_english || a.title,
        original_title: a.title_japanese || '',
        cover: normalizeImageUrl(a.images?.jpg?.large_image_url || ''),
        year: a.year || null,
        creator: (a.studios || []).map(s => s.name).join(', '),
        genres: (a.genres || []).map(g => g.name),
        total: a.episodes || null,
        unit: 'eps',
        meta: `Anime · ${a.episodes || '?'} eps · ${a.year || ''}`
      }));
    } else if (['manga', 'manhwa', 'manhua'].includes(cat)) {
      const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=6&sfw=true`);
      const data = await res.json();
      items = (data.data || []).map(m => ({
        title: m.title_english || m.title,
        original_title: m.title_japanese || '',
        cover: normalizeImageUrl(m.images?.jpg?.large_image_url || ''),
        year: m.published?.prop?.from?.year || null,
        creator: (m.authors || []).map(a => a.name).join(', '),
        genres: (m.genres || []).map(g => g.name),
        total: m.chapters || null,
        unit: 'ch',
        meta: `${m.type || 'Manga'} · ${m.chapters || '?'} ch`
      }));
    } else if (cat === 'book') {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`);
      const data = await res.json();
      items = (data.docs || []).map(b => ({
        title: b.title,
        cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '',
        year: b.first_publish_year || null,
        creator: b.author_name ? b.author_name.join(', ') : '',
        total: b.number_of_pages_median || null,
        unit: 'pages',
        meta: `Book · ${b.first_publish_year || ''}`
      }));
    } else if (cat === 'tv_show') {
      const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      items = (data || []).slice(0, 6).map(e => ({
        title: e.show.name,
        cover: normalizeImageUrl(e.show.image?.original || e.show.image?.medium || ''),
        year: e.show.premiered ? parseInt(e.show.premiered.slice(0, 4), 10) : null,
        genres: e.show.genres || [],
        unit: 'eps',
        meta: `TV Show · ${e.show.premiered ? e.show.premiered.slice(0, 4) : ''}`
      }));
    } else if (cat === 'movie' || cat === 'music') {
      const entity = cat === 'music' ? 'album' : 'movie';
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=${cat === 'music' ? 'music' : 'movie'}&entity=${entity}&limit=6`);
      const data = await res.json();
      items = (data.results || []).map(r => ({
        title: cat === 'music' ? r.collectionName : r.trackName,
        cover: normalizeImageUrl((r.artworkUrl100 || '').replace('100x100bb', '600x600bb')),
        year: r.releaseDate ? parseInt(r.releaseDate.slice(0, 4), 10) : null,
        creator: r.artistName || '',
        genres: r.primaryGenreName ? [r.primaryGenreName] : [],
        total: cat === 'music' ? (r.trackCount || 1) : 1,
        unit: cat === 'music' ? 'track' : 'movie',
        meta: `${cat === 'music' ? 'Album' : 'Movie'} · ${r.artistName || ''}`
      }));
    } else if (cat === 'visual_novel') {
      const res = await fetch('https://api.vndb.org/kana/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: ['search', '=', query], fields: 'title, image.url, released', results: 6 })
      });
      const data = await res.json();
      items = (data.results || []).map(g => ({
        title: g.title,
        cover: normalizeImageUrl(g.image?.url || ''),
        year: g.released ? parseInt(g.released.slice(0, 4), 10) : null,
        unit: 'item',
        meta: `Visual Novel · ${g.released || ''}`
      }));
    }
  } catch (err) {
    console.warn('Metadata lookup error:', err);
  }

  lastApiResults = items;
  if (!items.length) {
    resultsBox.innerHTML = `<p style="padding:10px; font-size:12px; color:var(--mono-muted);">No matches found. You can enter details manually below.</p>`;
    return;
  }

  resultsBox.innerHTML = items.map((it, idx) => `
    <div class="api-result-item" onclick="applyApiResult(${idx})">
      <img src="${it.cover || 'https://placehold.co/60x90/1e1e1f/888?text=?'}" alt="">
      <div class="api-result-info">
        <h4>${escapeHtml(it.title)}</h4>
        <p>${escapeHtml(it.meta)}</p>
      </div>
    </div>
  `).join('');
};

window.applyApiResult = function (idx) {
  const item = lastApiResults[idx];
  const searchedCat = document.getElementById('api-search-cat').value;
  if (!item) return;

  document.getElementById('media-title').value = item.title || '';
  if (item.original_title) document.getElementById('media-original-title').value = item.original_title;
  document.getElementById('media-primary-cat').value = searchedCat;
  onPrimaryCategoryModalChange({});
  if (item.year) document.getElementById('media-release-year').value = item.year;
  if (item.creator) document.getElementById('media-creator').value = item.creator;
  if (item.genres?.length) document.getElementById('media-genres').value = item.genres.join(', ');

  if (item.cover) {
    const firstCover = document.querySelector('#media-gallery-editor .media-gallery-url-input');
    if (firstCover) firstCover.value = item.cover;
  }

  const firstTrack = document.querySelector('#media-tracks-editor .track-edit-card');
  if (firstTrack) {
    firstTrack.querySelector('.track-cat-select').value = searchedCat;
    if (item.total) firstTrack.querySelector('.track-total-input').value = item.total;
    if (item.unit) firstTrack.querySelector('.track-unit-select').value = item.unit;
  }

  document.getElementById('api-search-results').style.display = 'none';
};

// ==========================================
// 13. NOTES & MARKDOWN RENDERING (PRESERVING BLOG_POSTS)
// ==========================================
function renderSafeMarkdown(rawText) {
  let html = escapeHtml(rawText || '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/(https?:\/\/[^\s<>"']+)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">$1</a>');
  return html;
}

async function fetchBlogPosts() {
  const { data, error } = await supabaseClient
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const listEl = document.getElementById('blog-feed-list');
    if (listEl) listEl.innerHTML = `<p class="empty-state">Failed to load notes: ${escapeHtml(error.message)}</p>`;
    return;
  }

  allBlogPosts = data || [];
  updateFolderFilterDropdown();
  renderBlogPosts();
  renderOverviewDashboard();
}

function updateFolderFilterDropdown() {
  const select = document.getElementById('filter-note-folder');
  if (!select) return;
  const folders = new Set(['General']);
  allBlogPosts.forEach(p => { if (p.folder) folders.add(p.folder); });
  const currentVal = select.value;
  select.innerHTML = `<option value="all">All Folders</option>` +
    Array.from(folders).map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  if ([...folders, 'all'].includes(currentVal)) select.value = currentVal;
}

function renderBlogPosts() {
  const listEl = document.getElementById('blog-feed-list');
  if (!listEl) return;

  const query = (document.getElementById('search-notes')?.value || '').toLowerCase().trim();
  const folderFilter = document.getElementById('filter-note-folder')?.value || 'all';

  let visible = allBlogPosts.filter(p => {
    if (p.is_archived || p.deleted_at) return false;
    if (p.is_private && !isAdminLoggedIn) return false;
    if (folderFilter !== 'all' && (p.folder || 'General') !== folderFilter) return false;
    if (query) {
      const hay = [p.title, p.content, p.folder, ...(Array.isArray(p.tags) ? p.tags : [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // Pinned first
  visible.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

  if (!visible.length) {
    listEl.innerHTML = `<p class="empty-state">No notes found.</p>`;
    return;
  }

  const avatarSrc = normalizeImageUrl(currentProfile.avatar_url) || TRANSPARENT_PIXEL;
  const authorName = escapeHtml(currentProfile.name || 'Archive');

  listEl.innerHTML = visible.map(post => {
    const safeId = escapeHtml(String(post.id));
    const imgs = [];
    if (Array.isArray(post.image_urls)) post.image_urls.forEach(u => { if (u) imgs.push(u); });
    if (post.image_url && !imgs.includes(post.image_url)) imgs.unshift(post.image_url);
    const tags = Array.isArray(post.tags) ? post.tags : [];

    return `
      <article class="blog-post-card ${post.is_pinned ? 'is-pinned' : ''}">
        <div class="blog-post-header">
          <div class="blog-post-author">
            <img class="blog-post-avatar" src="${avatarSrc}" alt="" onerror="this.src='${TRANSPARENT_PIXEL}'">
            <div>
              <span class="blog-post-name">${authorName} ${post.is_pinned ? '· Pinned' : ''}</span>
              <span class="blog-post-time">${escapeHtml(post.folder || 'General')} · ${formatStatusDate(post.created_at)}</span>
            </div>
          </div>
          ${isAdminLoggedIn ? `
            <div class="blog-post-actions">
              <button type="button" class="blog-icon-btn" onclick="openEditPostModal('${safeId}')"><ion-icon name="create-outline"></ion-icon></button>
              <button type="button" class="blog-icon-btn" onclick="deleteBlogPost('${safeId}')"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
          ` : ''}
        </div>
        ${post.title ? `<h3 class="note-card-title">${escapeHtml(post.title)}</h3>` : ''}
        <div class="blog-post-text">${renderSafeMarkdown(post.content)}</div>
        ${tags.length ? `<div class="note-tags-row">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${imgs.length ? buildImageCarouselHtml(imgs, 'blog-post-carousel') : ''}
      </article>
    `;
  }).join('');
}

window.addPostImageRow = function (url = '') {
  const container = document.getElementById('post-images-editor');
  const row = document.createElement('div');
  row.className = 'post-img-split-row';
  row.innerHTML = `
    <input type="url" class="form-input post-image-url-input" placeholder="Image URL" value="${escapeHtml(url)}">
    <div class="row-right-controls">
      <label class="equal-upload-btn">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        <span>Upload</span>
        <input type="file" accept="image/*" hidden onchange="handleSinglePostRowUpload(event, this)">
      </label>
      <button type="button" class="social-remove-btn" onclick="this.closest('.post-img-split-row').remove()">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.handleSinglePostRowUpload = async function (event, fileInput) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const row = fileInput.closest('.post-img-split-row');
  const urlInput = row?.querySelector('.post-image-url-input');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'posts');
    if (urlInput) urlInput.value = publicUrl;
    showToast('Image uploaded', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Local Autosave for Note Drafts
document.getElementById('post-content')?.addEventListener('input', (e) => {
  if (!document.getElementById('post-id').value) {
    localStorage.setItem('archive_note_draft', e.target.value);
    setElText('note-autosave-status', 'Draft autosaved locally');
  }
});

window.openPostModal = function () {
  pendingUploadedUrls = [];
  setElText('post-modal-title', 'New Note');
  document.getElementById('post-form').reset();
  document.getElementById('post-id').value = '';
  document.getElementById('post-folder').value = 'General';
  const savedDraft = localStorage.getItem('archive_note_draft');
  if (savedDraft) {
    document.getElementById('post-content').value = savedDraft;
    setElText('note-autosave-status', 'Restored local draft');
  } else {
    setElText('note-autosave-status', '');
  }
  document.getElementById('post-images-editor').innerHTML = '';
  addPostImageRow('');
  document.getElementById('post-modal').classList.add('active');
};

window.openEditPostModal = function (id) {
  const post = allBlogPosts.find(p => String(p.id) === String(id));
  if (!post) return;

  pendingUploadedUrls = [];
  setElText('post-modal-title', 'Edit Note');
  document.getElementById('post-id').value = post.id;
  document.getElementById('post-title').value = post.title || '';
  document.getElementById('post-folder').value = post.folder || 'General';
  document.getElementById('post-content').value = post.content || '';
  document.getElementById('post-tags').value = Array.isArray(post.tags) ? post.tags.join(', ') : '';
  document.getElementById('post-is-pinned').checked = Boolean(post.is_pinned);
  document.getElementById('post-is-private').checked = Boolean(post.is_private);
  setElText('note-autosave-status', '');

  const editor = document.getElementById('post-images-editor');
  editor.innerHTML = '';
  const imgs = Array.isArray(post.image_urls) && post.image_urls.length ? post.image_urls : (post.image_url ? [post.image_url] : ['']);
  imgs.forEach(u => addPostImageRow(u));

  document.getElementById('post-modal').classList.add('active');
};

window.closePostModal = async function () {
  document.getElementById('post-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

document.getElementById('post-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('post-id').value;
  const contentVal = document.getElementById('post-content').value.trim();
  if (!contentVal) return;

  const imageUrls = [];
  document.querySelectorAll('#post-images-editor .post-image-url-input').forEach(inp => {
    const clean = normalizeImageUrl(inp.value);
    if (clean && !imageUrls.includes(clean)) imageUrls.push(clean);
  });

  const tags = document.getElementById('post-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  const titleVal = document.getElementById('post-title').value.trim() || null;
  const nowIso = new Date().toISOString();

  const payload = {
    title: titleVal,
    folder: document.getElementById('post-folder').value.trim() || 'General',
    content: contentVal,
    tags,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    is_pinned: document.getElementById('post-is-pinned').checked,
    is_private: document.getElementById('post-is-private').checked,
    updated_at: nowIso
  };

  const res = id
    ? await supabaseClient.from('blog_posts').update(payload).eq('id', id)
    : await supabaseClient.from('blog_posts').insert([{ ...payload, created_at: nowIso }]);

  if (res.error) {
    showToast(res.error.message, 'error');
    return;
  }

  if (!id) localStorage.removeItem('archive_note_draft');
  await cleanupPendingUploads(imageUrls);
  document.getElementById('post-modal').classList.remove('active');

  await logPersonalActivity(
    id ? 'note_updated' : 'note_created',
    'note',
    id || null,
    titleVal || contentVal.slice(0, 40),
    id ? 'Updated note' : 'Created note'
  );

  await fetchBlogPosts();
  showToast(id ? 'Note updated' : 'Note published', 'success');
});

window.deleteBlogPost = async function (id) {
  const confirm = await Swal.fire({
    text: 'Delete this note permanently?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    background: '#1a1a1c',
    color: '#fff'
  });
  if (confirm.isConfirmed) {
    const { error } = await supabaseClient.from('blog_posts').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else {
      await fetchBlogPosts();
      showToast('Deleted', 'info');
    }
  }
};

// ==========================================
// 14. CUSTOM MEDIA COLLECTIONS
// ==========================================
async function fetchCollections() {
  const [colRes, itemsRes] = await Promise.all([
    supabaseClient.from('media_collections').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('media_collection_items').select('*')
  ]);

  if (!colRes.error) allCollections = colRes.data || [];
  if (!itemsRes.error) allCollectionItems = itemsRes.data || [];

  const filterSelect = document.getElementById('filter-collection');
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="all">All Collections</option>` +
      allCollections.map(c => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name)}</option>`).join('');
  }
}

function renderCollectionsView() {
  const grid = document.getElementById('collections-grid');
  if (!grid) return;

  if (!allCollections.length) {
    grid.innerHTML = `<p class="empty-state">No collections yet. Create custom lists to group your favorite works.</p>`;
    return;
  }

  grid.innerHTML = allCollections.map(col => {
    const safeId = escapeHtml(String(col.id));
    const itemIds = allCollectionItems.filter(ci => String(ci.collection_id) === String(col.id)).map(ci => String(ci.media_id));
    const matchedMedia = allMediaLogs.filter(m => itemIds.includes(String(m.id)));
    const thumbs = matchedMedia.slice(0, 5).map(m => normalizeImageUrl(m.cover_url)).filter(Boolean);

    return `
      <div class="collection-card" onclick="openCollectionInLibrary('${safeId}')">
        <div class="collection-card-top">
          <div>
            <h3>${escapeHtml(col.name)}</h3>
            <span style="font-size:11px; color:var(--mono-dim);">${matchedMedia.length} items</span>
          </div>
          ${isAdminLoggedIn ? `
            <button type="button" class="blog-icon-btn" onclick="event.stopPropagation(); openEditCollectionModal('${safeId}')">
              <ion-icon name="create-outline"></ion-icon>
            </button>
          ` : ''}
        </div>
        ${col.description ? `<p>${escapeHtml(col.description)}</p>` : ''}
        ${thumbs.length ? `<div class="collection-thumbs-strip">${thumbs.map(src => `<img src="${src}" alt="">`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');
}

window.openCollectionInLibrary = function (colId) {
  switchMainView('library');
  const filterSelect = document.getElementById('filter-collection');
  if (filterSelect) {
    filterSelect.value = colId;
    resetPaginationAndRender();
  }
};

window.openCollectionModal = function () {
  setElText('collection-modal-title', 'New Collection');
  document.getElementById('collection-form').reset();
  document.getElementById('collection-id').value = '';
  document.getElementById('btn-delete-collection').style.display = 'none';
  document.getElementById('collection-modal').classList.add('active');
};

window.openEditCollectionModal = function (id) {
  const col = allCollections.find(c => String(c.id) === String(id));
  if (!col) return;
  setElText('collection-modal-title', 'Edit Collection');
  document.getElementById('collection-id').value = col.id;
  document.getElementById('collection-name').value = col.name;
  document.getElementById('collection-desc').value = col.description || '';
  document.getElementById('btn-delete-collection').style.display = 'inline-flex';
  document.getElementById('collection-modal').classList.add('active');
};

window.closeCollectionModal = function () {
  document.getElementById('collection-modal').classList.remove('active');
};

document.getElementById('collection-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('collection-id').value;
  const payload = {
    name: document.getElementById('collection-name').value.trim(),
    description: document.getElementById('collection-desc').value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('media_collections').update(payload).eq('id', id)
    : await supabaseClient.from('media_collections').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeCollectionModal();
    await fetchCollections();
    renderCollectionsView();
    showToast(id ? 'Collection updated' : 'Collection created', 'success');
  }
});

window.deleteCurrentCollection = async function () {
  const id = document.getElementById('collection-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('media_collections').delete().eq('id', id);
  if (error) showToast(error.message, 'error');
  else {
    closeCollectionModal();
    await fetchCollections();
    renderCollectionsView();
    showToast('Collection deleted', 'info');
  }
};

// ==========================================
// 15. GLOBAL SEARCH / COMMAND PALETTE & QUICK CAPTURE
// ==========================================
window.openGlobalSearchModal = function () {
  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  modal.classList.add('active');
  input.value = '';
  handleGlobalSearchInput();
  setTimeout(() => input.focus(), 40);
};

window.closeGlobalSearchModal = function () {
  document.getElementById('global-search-modal').classList.remove('active');
};

window.handleGlobalSearchInput = function () {
  const q = (document.getElementById('global-search-input')?.value || '').toLowerCase().trim();
  const body = document.getElementById('global-search-results');
  if (!body) return;

  const navItems = [
    { label: 'Go to Overview Dashboard', meta: 'View', action: "closeGlobalSearchModal(); switchMainView('overview');" },
    { label: 'Go to Media Library', meta: 'View', action: "closeGlobalSearchModal(); switchMainView('library');" },
    { label: 'Go to Notes & Feed', meta: 'View', action: "closeGlobalSearchModal(); switchMainView('notes');" },
    { label: 'Go to Collections', meta: 'View', action: "closeGlobalSearchModal(); switchMainView('collections');" }
  ];

  if (isAdminLoggedIn) {
    navItems.unshift(
      { label: 'Add New Media Entry', meta: 'Action', action: 'closeGlobalSearchModal(); openMediaModal();' },
      { label: 'Create New Note', meta: 'Action', action: 'closeGlobalSearchModal(); openPostModal();' }
    );
  }

  const matchedNav = navItems.filter(n => !q || n.label.toLowerCase().includes(q));
  const matchedMedia = q
    ? allMediaLogs.filter(m => !m.is_archived && !m.deleted_at && [m.title, m.original_title, m.creator].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 6)
    : [];
  const matchedNotes = q
    ? allBlogPosts.filter(p => !p.is_archived && (!p.is_private || isAdminLoggedIn) && [p.title, p.content, p.folder].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 4)
    : [];

  let html = '';
  if (matchedNav.length) {
    html += `<div class="cmd-group-label">Navigation & Commands</div>` + matchedNav.map(n => `
      <button type="button" class="cmd-item" onclick="${n.action}">
        <span class="cmd-item-left"><ion-icon name="arrow-forward-circle-outline"></ion-icon><span>${escapeHtml(n.label)}</span></span>
        <span class="cmd-item-meta">${escapeHtml(n.meta)}</span>
      </button>
    `).join('');
  }

  if (matchedMedia.length) {
    html += `<div class="cmd-group-label">Media Library</div>` + matchedMedia.map(m => `
      <button type="button" class="cmd-item" onclick="closeGlobalSearchModal(); openMediaDetailModal('${escapeHtml(String(m.id))}');">
        <span class="cmd-item-left"><ion-icon name="albums-outline"></ion-icon><span>${escapeHtml(m.title)}</span></span>
        <span class="cmd-item-meta">${escapeHtml(CATEGORY_LABELS[getLegacyCategory(m)] || '')}</span>
      </button>
    `).join('');
  }

  if (matchedNotes.length) {
    html += `<div class="cmd-group-label">Notes</div>` + matchedNotes.map(p => `
      <button type="button" class="cmd-item" onclick="closeGlobalSearchModal(); switchMainView('notes');">
        <span class="cmd-item-left"><ion-icon name="document-text-outline"></ion-icon><span>${escapeHtml(p.title || (p.content || '').slice(0, 45))}</span></span>
        <span class="cmd-item-meta">${escapeHtml(p.folder || 'General')}</span>
      </button>
    `).join('');
  }

  if (!html) {
    html = `<p class="empty-state-compact">No matching results for "${escapeHtml(q)}"</p>`;
  }
  body.innerHTML = html;
};

window.openQuickCaptureModal = function () {
  document.getElementById('quick-capture-modal').classList.add('active');
};

window.closeQuickCaptureModal = function () {
  document.getElementById('quick-capture-modal').classList.remove('active');
};
