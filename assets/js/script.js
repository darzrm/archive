'use strict';

// ==========================================
// 1. SUPABASE & CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uendrdxiixmikkeanlod.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbmRyZHhpaXhtaWtrZWFubG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NDY2MDQsImV4cCI6MjExMDUyMjYwNH0.RDOdaZ9qtcF9oFyvLqQLAHPYQUJLsBfFmGVQa0BLAnI';
const STORAGE_BUCKET = 'media-assets';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global Application State
let allMediaLogs = [];
let allBlogPosts = [];
let allCollections = [];
let allCollectionItems = [];
let allActivityLogs = [];

// Phase 2 Workspace State
let allProjects = [];
let allTasks = [];
let allGoals = [];
let allJournalEntries = [];
let allBookmarks = [];

// Phase 3 Knowledge Base State
let allQuotes = [];
let allVocabulary = [];
let allConcepts = [];
let isVocabStudyMode = false;

// Phase 4 & 5 State
let categoryChartInstance = null;
let ratingChartInstance = null;
let allAiMessages = [];

let lastApiResults = [];
let pendingUploadedUrls = [];

let currentCategory = 'all';
let currentMainView = 'overview';
let currentWorkspaceTab = 'tasks';
let currentKnowledgeTab = 'quotes';
let libraryViewMode = 'grid';
let itemsPerPage = 20;
let visibleMediaLimit = 20;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;

let currentSortField = 'rating';
let currentSortDir = 'desc';

let journalCalYear = new Date().getFullYear();
let journalCalMonth = new Date().getMonth();
let selectedJournalDate = null;

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
  upcoming_tasks: true,
  recently_completed: true,
  recent_notes: true,
  active_goals: true,
  recently_added: true,
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
      fetchActivityLogs(),
      fetchWorkspaceData(),
      fetchKnowledgeData(),
      fetchAiConversations()
    ]);

    renderOverviewDashboard();
    renderCollectionsView();
    renderAllWorkspaceViews();
    renderAllKnowledgeViews();
    renderAiChatFeed();
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
    if (backToTopBtn) backToTopBtn.classList.toggle('visible', scrollY > 320);
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
    collections: { el: 'view-collections', title: 'Collections' },
    workspace: { el: 'view-workspace', title: 'Personal Workspace' },
    knowledge: { el: 'view-knowledge', title: 'Knowledge Base' },
    statistics: { el: 'view-statistics', title: 'Statistics & Analytics' },
    ai: { el: 'view-ai', title: 'AI Assistant' }
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

  if (viewName === 'workspace') renderAllWorkspaceViews();
  if (viewName === 'knowledge') renderAllKnowledgeViews();
  if (viewName === 'statistics') renderStatisticsAnalytics();
  if (viewName === 'ai') renderAiChatFeed();

  updateAdminActionButtons();
};

window.switchWorkspaceTab = function (tabKey) {
  currentWorkspaceTab = tabKey;
  document.querySelectorAll('.ws-tab[data-ws]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ws === tabKey);
  });
  ['tasks', 'journal', 'goals', 'projects', 'bookmarks'].forEach(k => {
    const panel = document.getElementById(`ws-panel-${k}`);
    if (panel) panel.style.display = k === tabKey ? 'block' : 'none';
  });
  updateAdminActionButtons();
};

window.switchKnowledgeTab = function (tabKey) {
  currentKnowledgeTab = tabKey;
  document.querySelectorAll('.kb-tab[data-kb]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kb === tabKey);
  });
  ['quotes', 'vocabulary', 'concepts'].forEach(k => {
    const panel = document.getElementById(`kb-panel-${k}`);
    if (panel) panel.style.display = k === tabKey ? 'block' : 'none';
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

  const wsLocked = document.getElementById('workspace-locked-notice');
  const wsActive = document.getElementById('workspace-active-shell');
  const kbLocked = document.getElementById('knowledge-locked-notice');
  const kbActive = document.getElementById('knowledge-active-shell');
  const aiLocked = document.getElementById('ai-locked-notice');
  const aiActive = document.getElementById('ai-active-shell');

  if (isAdminLoggedIn) {
    if (editProfileBtn) editProfileBtn.style.display = 'flex';
    if (quickWrap) quickWrap.style.display = 'block';
    if (dashQuick) dashQuick.style.display = 'flex';
    if (dashWidgetsBtn) dashWidgetsBtn.style.display = 'inline-flex';
    if (newColBtn) newColBtn.style.display = 'inline-flex';
    if (wsLocked) wsLocked.style.display = 'none';
    if (wsActive) wsActive.style.display = 'block';
    if (kbLocked) kbLocked.style.display = 'none';
    if (kbActive) kbActive.style.display = 'block';
    if (aiLocked) aiLocked.style.display = 'none';
    if (aiActive) aiActive.style.display = 'flex';
    if (lockIcon) lockIcon.setAttribute('name', 'log-out-outline');
    if (btnText) btnText.textContent = 'Logout';
  } else {
    if (editProfileBtn) editProfileBtn.style.display = 'none';
    if (quickWrap) quickWrap.style.display = 'none';
    if (dashQuick) dashQuick.style.display = 'none';
    if (dashWidgetsBtn) dashWidgetsBtn.style.display = 'none';
    if (newColBtn) newColBtn.style.display = 'none';
    if (wsLocked) wsLocked.style.display = 'flex';
    if (wsActive) wsActive.style.display = 'none';
    if (kbLocked) kbLocked.style.display = 'flex';
    if (kbActive) kbActive.style.display = 'none';
    if (aiLocked) aiLocked.style.display = 'flex';
    if (aiActive) aiActive.style.display = 'none';
    if (lockIcon) lockIcon.setAttribute('name', 'lock-closed-outline');
    if (btnText) btnText.textContent = 'Admin';
  }

  updateLibraryTabVisibility();
  updateAdminActionButtons();
  renderMediaGrid();
  renderCollectionsView();
  if (isProfileLoaded) renderBlogPosts();
  renderOverviewDashboard();
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
  if (!isAdminLoggedIn || currentMainView === 'statistics' || currentMainView === 'ai') {
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
  } else if (currentMainView === 'workspace') {
    const wsLabels = {
      tasks: 'New Task',
      journal: 'New Journal',
      goals: 'New Goal',
      projects: 'New Project',
      bookmarks: 'Save Bookmark'
    };
    if (icon) icon.setAttribute('name', 'add-outline');
    if (label) label.textContent = wsLabels[currentWorkspaceTab] || 'Add Item';
  } else if (currentMainView === 'knowledge') {
    const kbLabels = {
      quotes: 'Add Quote',
      vocabulary: 'Add Word',
      concepts: 'New Concept'
    };
    if (icon) icon.setAttribute('name', 'add-outline');
    if (label) label.textContent = kbLabels[currentKnowledgeTab] || 'Add Entry';
  } else {
    if (icon) icon.setAttribute('name', 'add-outline');
    if (label) label.textContent = 'Add Media';
  }
}

window.handlePrimaryContextAction = function () {
  if (!isAdminLoggedIn) return;
  if (currentMainView === 'notes') openPostModal();
  else if (currentMainView === 'collections') openCollectionModal();
  else if (currentMainView === 'workspace') {
    if (currentWorkspaceTab === 'journal') openJournalModal();
    else if (currentWorkspaceTab === 'goals') openGoalModal();
    else if (currentWorkspaceTab === 'projects') openProjectModal();
    else if (currentWorkspaceTab === 'bookmarks') openBookmarkModal();
    else openTaskModal();
  } else if (currentMainView === 'knowledge') {
    if (currentKnowledgeTab === 'vocabulary') openVocabModal();
    else if (currentKnowledgeTab === 'concepts') openConceptModal();
    else openQuoteModal();
  } else {
    openMediaModal();
  }
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
      allProjects = [];
      allTasks = [];
      allGoals = [];
      allJournalEntries = [];
      allBookmarks = [];
      allQuotes = [];
      allVocabulary = [];
      allConcepts = [];
      allAiMessages = [];
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
    await Promise.all([
      fetchWorkspaceData(),
      fetchKnowledgeData(),
      fetchAiConversations()
    ]);
    updateAdminUI();
    renderAllWorkspaceViews();
    renderAllKnowledgeViews();
    renderAiChatFeed();
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
    upcoming_tasks: 'Upcoming Tasks',
    recently_completed: 'Recently Completed Media',
    recent_notes: 'Recent Notes',
    active_goals: 'Active Goals',
    recently_added: 'Recently Added Media',
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
  const openTasks = allTasks.filter(t => !t.is_archived && t.status !== 'done');
  const activeGoals = allGoals.filter(g => !g.is_archived && g.status === 'active');

  setElText('nav-media-count', String(activeMedia.length));
  setElText('nav-notes-count', String(activeNotes.length));
  setElText('nav-tasks-count', String(openTasks.length));

  const consuming = activeMedia.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'ongoing');
  const completed = activeMedia.filter(m => computeSyncedStatus(getItemTracks(m)).key === 'completed');

  const usedCats = new Set();
  activeMedia.forEach(m => getItemCategories(m).forEach(c => usedCats.add(c)));
  const compRate = activeMedia.length ? Math.round((completed.length / activeMedia.length) * 100) : 0;

  setElText('dash-total-media', activeMedia.length.toLocaleString('en-US'));
  setElText('dash-categories-used', `${usedCats.size} of 12 categories`);
  setElText('dash-consuming-count', consuming.length.toLocaleString('en-US'));
  setElText('dash-completed-count', completed.length.toLocaleString('en-US'));
  setElText('dash-completion-rate', `${compRate}% completion rate`);
  setElText('dash-total-notes', activeNotes.length.toLocaleString('en-US'));
  setElText('dash-pinned-notes', `${activeNotes.filter(n => n.is_pinned).length} pinned`);
  setElText('dash-open-tasks', isAdminLoggedIn ? String(openTasks.length) : '—');
  setElText('dash-active-goals', isAdminLoggedIn ? `${activeGoals.length} active goals` : 'Admin only');

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

  const dashTasksEl = document.getElementById('dash-list-tasks');
  if (dashTasksEl) {
    if (!isAdminLoggedIn) {
      dashTasksEl.innerHTML = `<p class="empty-state-compact">Sign in as Admin to view personal tasks.</p>`;
    } else if (!openTasks.length) {
      dashTasksEl.innerHTML = `<p class="empty-state-compact">All tasks completed. Nice work.</p>`;
    } else {
      dashTasksEl.innerHTML = openTasks.slice(0, 5).map(t => `
        <div class="dash-media-row" onclick="toggleTaskDone('${escapeHtml(String(t.id))}')">
          <div class="dash-media-info">
            <div class="dash-media-title">${escapeHtml(t.title)}</div>
            <div class="dash-media-meta">${escapeHtml(t.priority.toUpperCase())}${t.due_date ? ` · Due ${t.due_date}` : ''}</div>
          </div>
          <span class="dash-media-badge">Done ✓</span>
        </div>
      `).join('');
    }
  }

  const dashGoalsEl = document.getElementById('dash-list-goals');
  if (dashGoalsEl) {
    if (!isAdminLoggedIn || !activeGoals.length) {
      dashGoalsEl.innerHTML = `<p class="empty-state-compact">${isAdminLoggedIn ? 'No active goals tracked.' : 'Admin only.'}</p>`;
    } else {
      dashGoalsEl.innerHTML = activeGoals.slice(0, 4).map(g => {
        const pct = Math.min(100, Math.round((Number(g.current_value) / Math.max(1, Number(g.target_value))) * 100));
        return `
          <div class="dash-media-row" onclick="switchMainView('workspace'); switchWorkspaceTab('goals');">
            <div class="dash-media-info">
              <div class="dash-media-title">${escapeHtml(g.title)}</div>
              <div class="cat-bar-track" style="margin-top:6px;"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <span class="dash-media-badge">${g.current_value}/${g.target_value} ${escapeHtml(g.unit || '')}</span>
          </div>
        `;
      }).join('');
    }
  }

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
// 7. PROFILE SETTINGS & FULL BACKUP EXPORT
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

window.exportFullArchiveJson = function () {
  const backupData = {
    exported_at: new Date().toISOString(),
    profile: currentProfile,
    media_logs: allMediaLogs,
    blog_posts: allBlogPosts,
    collections: allCollections,
    collection_items: allCollectionItems,
    projects: allProjects,
    tasks: allTasks,
    goals: allGoals,
    journal_entries: allJournalEntries,
    bookmarks: allBookmarks,
    quotes: allQuotes,
    vocabulary: allVocabulary,
    concepts: allConcepts
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Full JSON backup downloaded', 'success');
};

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
// 8. MEDIA DATA HELPERS & LIBRARY
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
// 9. MEDIA DETAIL MODAL & ADD/EDIT MODAL
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
// 10. EXTERNAL API METADATA AUTO-FILL
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
    resultsBox.innerHTML = `<p style="padding:10px; font-size:12px; color:var(--mono-muted);">No matches found.</p>`;
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
// 11. NOTES, MARKDOWN & [[INTERNAL NOTE LINKS]]
// ==========================================
function renderSafeMarkdown(rawText) {
  let html = escapeHtml(rawText || '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, targetTitle) => {
    const cleanTarget = targetTitle.trim();
    return `<span class="internal-note-link" onclick="jumpToLinkedNote('${escapeHtml(cleanTarget)}')">[[${escapeHtml(cleanTarget)}]]</span>`;
  });

  html = html.replace(/(https?:\/\/[^\s<>"']+)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">$1</a>');
  return html;
}

window.jumpToLinkedNote = function (targetTitle) {
  const searchEl = document.getElementById('search-notes');
  if (searchEl) {
    searchEl.value = targetTitle;
    renderBlogPosts();
    showToast(`Filtered by "${targetTitle}"`, 'info', 2000);
  }
};

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

function populateProjectDropdowns() {
  const optionsHtml = `<option value="">None</option>` +
    allProjects.filter(p => !p.is_archived).map(p => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.title)}</option>`).join('');

  const postProj = document.getElementById('post-project-id');
  const taskProj = document.getElementById('task-project-id');
  if (postProj) postProj.innerHTML = optionsHtml;
  if (taskProj) taskProj.innerHTML = optionsHtml;
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
    const linkedProj = post.project_id ? allProjects.find(pr => String(pr.id) === String(post.project_id)) : null;

    const backlinks = post.title
      ? allBlogPosts.filter(other => other.id !== post.id && (other.content || '').toLowerCase().includes(`[[${post.title.toLowerCase()}]]`))
      : [];

    return `
      <article class="blog-post-card ${post.is_pinned ? 'is-pinned' : ''}">
        <div class="blog-post-header">
          <div class="blog-post-author">
            <img class="blog-post-avatar" src="${avatarSrc}" alt="" onerror="this.src='${TRANSPARENT_PIXEL}'">
            <div>
              <span class="blog-post-name">${authorName} ${post.is_pinned ? '· Pinned' : ''}</span>
              <span class="blog-post-time">${escapeHtml(post.folder || 'General')}${linkedProj ? ` · Project: ${escapeHtml(linkedProj.title)}` : ''} · ${formatStatusDate(post.created_at)}</span>
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
        ${backlinks.length ? `<div class="note-tags-row"><span style="font-size:11px; color:var(--mono-dim);">Referenced by:</span>${backlinks.map(b => `<span class="internal-note-link" style="font-size:11px;" onclick="jumpToLinkedNote('${escapeHtml(b.title || '')}')">${escapeHtml(b.title || 'Untitled')}</span>`).join('')}</div>` : ''}
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

document.getElementById('post-content')?.addEventListener('input', (e) => {
  if (!document.getElementById('post-id').value) {
    localStorage.setItem('archive_note_draft', e.target.value);
    setElText('note-autosave-status', 'Draft autosaved locally');
  }
});

window.openPostModal = function () {
  pendingUploadedUrls = [];
  populateProjectDropdowns();
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
  populateProjectDropdowns();
  setElText('post-modal-title', 'Edit Note');
  document.getElementById('post-id').value = post.id;
  document.getElementById('post-title').value = post.title || '';
  document.getElementById('post-folder').value = post.folder || 'General';
  document.getElementById('post-project-id').value = post.project_id || '';
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
  const projVal = document.getElementById('post-project-id').value || null;
  const nowIso = new Date().toISOString();

  const payload = {
    title: titleVal,
    folder: document.getElementById('post-folder').value.trim() || 'General',
    project_id: projVal,
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
// 12. CUSTOM MEDIA COLLECTIONS
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
// 13. PHASE 2: PERSONAL WORKSPACE (TASKS, JOURNAL, GOALS, PROJECTS, BOOKMARKS)
// ==========================================
async function fetchWorkspaceData() {
  if (!isAdminLoggedIn) return;
  const [projRes, taskRes, goalRes, jourRes, bookRes] = await Promise.all([
    supabaseClient.from('projects').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('tasks').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('goals').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('journal_entries').select('*').order('entry_date', { ascending: false }),
    supabaseClient.from('bookmarks').select('*').order('created_at', { ascending: false })
  ]);

  if (!projRes.error) allProjects = projRes.data || [];
  if (!taskRes.error) allTasks = taskRes.data || [];
  if (!goalRes.error) allGoals = goalRes.data || [];
  if (!jourRes.error) allJournalEntries = jourRes.data || [];
  if (!bookRes.error) allBookmarks = bookRes.data || [];
}

function renderAllWorkspaceViews() {
  renderWorkspaceTasks();
  renderJournalCalendar();
  renderJournalEntries();
  renderGoals();
  renderProjects();
  renderBookmarks();
  renderOverviewDashboard();
}

function renderWorkspaceTasks() {
  const container = document.getElementById('workspace-tasks-list');
  if (!container) return;

  const q = (document.getElementById('search-tasks')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('filter-task-status')?.value || 'open';
  const prioFilter = document.getElementById('filter-task-priority')?.value || 'all';

  let filtered = allTasks.filter(t => {
    if (t.is_archived) return false;
    if (statusFilter === 'open' && t.status === 'done') return false;
    if (!['all', 'open'].includes(statusFilter) && t.status !== statusFilter) return false;
    if (prioFilter !== 'all' && t.priority !== prioFilter) return false;
    if (q) {
      const hay = [t.title, t.description, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state">No tasks match your filter.</p>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const safeId = escapeHtml(String(t.id));
    const isDone = t.status === 'done';
    const proj = t.project_id ? allProjects.find(p => String(p.id) === String(t.project_id)) : null;
    const tags = Array.isArray(t.tags) ? t.tags : [];
    return `
      <div class="task-row-card ${isDone ? 'is-done' : ''}">
        <div class="task-row-left">
          <button type="button" class="task-check-btn" onclick="toggleTaskDone('${safeId}')" title="Toggle Completed">
            ${isDone ? '<ion-icon name="checkmark-outline"></ion-icon>' : ''}
          </button>
          <div>
            <div class="task-title-text">${escapeHtml(t.title)}</div>
            <div class="task-meta-line">
              <span class="priority-badge ${t.priority}">${escapeHtml(t.priority)}</span>
              ${t.due_date ? `<span>Due: ${t.due_date}</span>` : ''}
              ${proj ? `<span>Project: ${escapeHtml(proj.title)}</span>` : ''}
              ${tags.map(tg => `<span>#${escapeHtml(tg)}</span>`).join('')}
            </div>
          </div>
        </div>
        <button type="button" class="blog-icon-btn" onclick="openEditTaskModal('${safeId}')">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      </div>
    `;
  }).join('');
}

window.toggleTaskDone = async function (id) {
  const task = allTasks.find(t => String(t.id) === String(id));
  if (!task || !isAdminLoggedIn) return;
  const nextStatus = task.status === 'done' ? 'todo' : 'done';
  const { error } = await supabaseClient.from('tasks').update({
    status: nextStatus,
    completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (!error) {
    if (nextStatus === 'done') {
      await logPersonalActivity('task_completed', 'task', id, task.title, 'Completed task');
    }
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(nextStatus === 'done' ? 'Task completed' : 'Task reopened', 'success');
  }
};

window.openTaskModal = function () {
  populateProjectDropdowns();
  setElText('task-modal-title', 'New Task');
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('btn-delete-task').style.display = 'none';
  document.getElementById('task-modal').classList.add('active');
};

window.openEditTaskModal = function (id) {
  const t = allTasks.find(x => String(x.id) === String(id));
  if (!t) return;
  populateProjectDropdowns();
  setElText('task-modal-title', 'Edit Task');
  document.getElementById('task-id').value = t.id;
  document.getElementById('task-title').value = t.title;
  document.getElementById('task-priority').value = t.priority || 'medium';
  document.getElementById('task-status').value = t.status || 'todo';
  document.getElementById('task-due-date').value = t.due_date || '';
  document.getElementById('task-project-id').value = t.project_id || '';
  document.getElementById('task-tags').value = Array.isArray(t.tags) ? t.tags.join(', ') : '';
  document.getElementById('task-desc').value = t.description || '';
  document.getElementById('btn-delete-task').style.display = 'inline-flex';
  document.getElementById('task-modal').classList.add('active');
};

window.closeTaskModal = function () {
  document.getElementById('task-modal').classList.remove('active');
};

document.getElementById('task-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const statusVal = document.getElementById('task-status').value;
  const titleVal = document.getElementById('task-title').value.trim();

  const payload = {
    title: titleVal,
    priority: document.getElementById('task-priority').value,
    status: statusVal,
    due_date: document.getElementById('task-due-date').value || null,
    project_id: document.getElementById('task-project-id').value || null,
    tags: document.getElementById('task-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    description: document.getElementById('task-desc').value.trim() || null,
    completed_at: statusVal === 'done' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('tasks').update(payload).eq('id', id)
    : await supabaseClient.from('tasks').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeTaskModal();
    await logPersonalActivity(id ? 'task_updated' : 'task_created', 'task', id || null, titleVal, id ? 'Updated task' : 'Added task');
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(id ? 'Task updated' : 'Task created', 'success');
  }
});

window.deleteCurrentTask = async function () {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
  if (!error) {
    closeTaskModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Task deleted', 'info');
  }
};

function renderJournalCalendar() {
  const grid = document.getElementById('journal-calendar-grid');
  if (!grid) return;

  const monthDate = new Date(journalCalYear, journalCalMonth, 1);
  setElText('journal-cal-month-label', monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  const firstDay = monthDate.getDay();
  const daysInMonth = new Date(journalCalYear, journalCalMonth + 1, 0).getDate();
  const entryDates = new Set(allJournalEntries.map(j => j.entry_date));

  let cells = '';
  for (let i = 0; i < firstDay; i++) {
    cells += `<div class="cal-day-cell is-empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${journalCalYear}-${String(journalCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEntry = entryDates.has(iso);
    const isSelected = selectedJournalDate === iso;
    cells += `
      <button type="button" class="cal-day-cell ${hasEntry ? 'has-entry' : ''} ${isSelected ? 'is-selected' : ''}" onclick="selectJournalCalendarDate('${iso}')">
        <span>${day}</span>
        ${hasEntry ? '<span class="cal-entry-dot"></span>' : ''}
      </button>
    `;
  }
  grid.innerHTML = cells;
}

window.stepJournalCalendarMonth = function (delta) {
  journalCalMonth += delta;
  if (journalCalMonth < 0) { journalCalMonth = 11; journalCalYear -= 1; }
  if (journalCalMonth > 11) { journalCalMonth = 0; journalCalYear += 1; }
  renderJournalCalendar();
};

window.selectJournalCalendarDate = function (isoDate) {
  selectedJournalDate = selectedJournalDate === isoDate ? null : isoDate;
  renderJournalCalendar();
  renderJournalEntries();
};

window.clearJournalDateFilter = function () {
  selectedJournalDate = null;
  renderJournalCalendar();
  renderJournalEntries();
};

function renderJournalEntries() {
  const list = document.getElementById('journal-entries-list');
  if (!list) return;

  const q = (document.getElementById('search-journal')?.value || '').toLowerCase().trim();
  const period = document.getElementById('filter-journal-period')?.value || 'all';

  const filtered = allJournalEntries.filter(j => {
    if (j.is_archived) return false;
    if (selectedJournalDate && j.entry_date !== selectedJournalDate) return false;
    if (period !== 'all' && j.period_type !== period) return false;
    if (q) {
      const hay = [j.title, j.content, j.mood, ...(Array.isArray(j.tags) ? j.tags : [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">${selectedJournalDate ? `No journal entries on ${selectedJournalDate}.` : 'No journal entries yet.'}</p>`;
    return;
  }

  list.innerHTML = filtered.map(j => {
    const safeId = escapeHtml(String(j.id));
    const tags = Array.isArray(j.tags) ? j.tags : [];
    return `
      <article class="blog-post-card">
        <div class="blog-post-header">
          <div>
            <span class="blog-post-name">${escapeHtml(j.entry_date)} · ${escapeHtml((j.period_type || 'daily').toUpperCase())}</span>
            ${j.mood ? `<span class="blog-post-time">Mood: ${escapeHtml(j.mood)}</span>` : ''}
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditJournalModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        ${j.title ? `<h3 class="note-card-title">${escapeHtml(j.title)}</h3>` : ''}
        <div class="blog-post-text">${renderSafeMarkdown(j.content)}</div>
        ${tags.length ? `<div class="note-tags-row">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </article>
    `;
  }).join('');
}

window.openJournalModal = function () {
  setElText('journal-modal-title', 'New Journal Entry');
  document.getElementById('journal-form').reset();
  document.getElementById('journal-id').value = '';
  document.getElementById('journal-date').value = selectedJournalDate || new Date().toISOString().slice(0, 10);
  document.getElementById('btn-delete-journal').style.display = 'none';
  document.getElementById('journal-modal').classList.add('active');
};

window.openEditJournalModal = function (id) {
  const j = allJournalEntries.find(x => String(x.id) === String(id));
  if (!j) return;
  setElText('journal-modal-title', 'Edit Journal Entry');
  document.getElementById('journal-id').value = j.id;
  document.getElementById('journal-date').value = j.entry_date;
  document.getElementById('journal-period').value = j.period_type || 'daily';
  document.getElementById('journal-mood').value = j.mood || '';
  document.getElementById('journal-title').value = j.title || '';
  document.getElementById('journal-content').value = j.content || '';
  document.getElementById('journal-tags').value = Array.isArray(j.tags) ? j.tags.join(', ') : '';
  document.getElementById('btn-delete-journal').style.display = 'inline-flex';
  document.getElementById('journal-modal').classList.add('active');
};

window.closeJournalModal = function () {
  document.getElementById('journal-modal').classList.remove('active');
};

document.getElementById('journal-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('journal-id').value;
  const dateVal = document.getElementById('journal-date').value;
  const titleVal = document.getElementById('journal-title').value.trim() || null;

  const payload = {
    entry_date: dateVal,
    period_type: document.getElementById('journal-period').value,
    mood: document.getElementById('journal-mood').value.trim() || null,
    title: titleVal,
    content: document.getElementById('journal-content').value.trim(),
    tags: document.getElementById('journal-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('journal_entries').update(payload).eq('id', id)
    : await supabaseClient.from('journal_entries').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeJournalModal();
    await logPersonalActivity('journal_saved', 'journal', id || null, titleVal || `Journal (${dateVal})`, 'Saved journal entry');
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Journal saved', 'success');
  }
});

window.deleteCurrentJournal = async function () {
  const id = document.getElementById('journal-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('journal_entries').delete().eq('id', id);
  if (!error) {
    closeJournalModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Journal deleted', 'info');
  }
};

function renderGoals() {
  const grid = document.getElementById('workspace-goals-grid');
  if (!grid) return;

  const active = allGoals.filter(g => !g.is_archived);
  if (!active.length) {
    grid.innerHTML = `<p class="empty-state">No goals defined yet.</p>`;
    return;
  }

  grid.innerHTML = active.map(g => {
    const safeId = escapeHtml(String(g.id));
    const cur = Number(g.current_value) || 0;
    const tgt = Math.max(1, Number(g.target_value) || 100);
    const pct = Math.min(100, Math.round((cur / tgt) * 100));

    return `
      <div class="collection-card" style="cursor:default;">
        <div class="collection-card-top">
          <div>
            <h3>${escapeHtml(g.title)}</h3>
            <span style="font-size:11px; color:var(--mono-dim);">${escapeHtml(g.category || 'Personal')}${g.target_date ? ` · Target ${g.target_date}` : ''}</span>
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditGoalModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        ${g.description ? `<p>${escapeHtml(g.description)}</p>` : ''}
        <div class="goal-progress-wrap">
          <div class="goal-numbers-row">
            <span>${cur} / ${tgt} ${escapeHtml(g.unit || '')}</span>
            <strong>${pct}%</strong>
          </div>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
          <div class="goal-step-actions">
            <button type="button" class="mini-step-btn" onclick="incrementGoalProgress('${safeId}', 1)">+1</button>
            <button type="button" class="mini-step-btn" onclick="incrementGoalProgress('${safeId}', 5)">+5</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.incrementGoalProgress = async function (id, delta) {
  const goal = allGoals.find(g => String(g.id) === String(id));
  if (!goal || !isAdminLoggedIn) return;
  const nextVal = Number(goal.current_value || 0) + delta;
  const nextStatus = nextVal >= Number(goal.target_value) ? 'completed' : 'active';

  const { error } = await supabaseClient.from('goals').update({
    current_value: nextVal,
    status: nextStatus,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (!error) {
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(`Progress updated (${nextVal}/${goal.target_value})`, 'success');
  }
};

window.openGoalModal = function () {
  setElText('goal-modal-title', 'New Goal');
  document.getElementById('goal-form').reset();
  document.getElementById('goal-id').value = '';
  document.getElementById('btn-delete-goal').style.display = 'none';
  document.getElementById('goal-modal').classList.add('active');
};

window.openEditGoalModal = function (id) {
  const g = allGoals.find(x => String(x.id) === String(id));
  if (!g) return;
  setElText('goal-modal-title', 'Edit Goal');
  document.getElementById('goal-id').value = g.id;
  document.getElementById('goal-title').value = g.title;
  document.getElementById('goal-current').value = g.current_value;
  document.getElementById('goal-target').value = g.target_value;
  document.getElementById('goal-unit').value = g.unit || '%';
  document.getElementById('goal-category').value = g.category || 'Personal';
  document.getElementById('goal-target-date').value = g.target_date || '';
  document.getElementById('goal-desc').value = g.description || '';
  document.getElementById('btn-delete-goal').style.display = 'inline-flex';
  document.getElementById('goal-modal').classList.add('active');
};

window.closeGoalModal = function () {
  document.getElementById('goal-modal').classList.remove('active');
};

document.getElementById('goal-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('goal-id').value;
  const cur = parseFloat(document.getElementById('goal-current').value) || 0;
  const tgt = parseFloat(document.getElementById('goal-target').value) || 100;
  const titleVal = document.getElementById('goal-title').value.trim();

  const payload = {
    title: titleVal,
    current_value: cur,
    target_value: tgt,
    unit: document.getElementById('goal-unit').value.trim() || '%',
    category: document.getElementById('goal-category').value.trim() || 'Personal',
    target_date: document.getElementById('goal-target-date').value || null,
    description: document.getElementById('goal-desc').value.trim() || null,
    status: cur >= tgt ? 'completed' : 'active',
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('goals').update(payload).eq('id', id)
    : await supabaseClient.from('goals').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeGoalModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(id ? 'Goal updated' : 'Goal created', 'success');
  }
});

window.deleteCurrentGoal = async function () {
  const id = document.getElementById('goal-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('goals').delete().eq('id', id);
  if (!error) {
    closeGoalModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Goal deleted', 'info');
  }
};

function renderProjects() {
  const grid = document.getElementById('workspace-projects-grid');
  if (!grid) return;

  const active = allProjects.filter(p => !p.is_archived);
  if (!active.length) {
    grid.innerHTML = `<p class="empty-state">No projects created yet.</p>`;
    return;
  }

  grid.innerHTML = active.map(p => {
    const safeId = escapeHtml(String(p.id));
    const projTasks = allTasks.filter(t => String(t.project_id) === String(p.id));
    const doneTasks = projTasks.filter(t => t.status === 'done').length;
    const projNotes = allBlogPosts.filter(n => String(n.project_id) === String(p.id)).length;

    return `
      <div class="collection-card" style="cursor:default;">
        <div class="collection-card-top">
          <div>
            <h3>${escapeHtml(p.title)}</h3>
            <span style="font-size:11px; color:var(--mono-dim); text-transform:uppercase;">${escapeHtml(p.status || 'active')}${p.deadline ? ` · Due ${p.deadline}` : ''}</span>
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditProjectModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
        <div class="note-tags-row" style="margin-top:auto;">
          <span class="tag-pill">${doneTasks}/${projTasks.length} Tasks</span>
          <span class="tag-pill">${projNotes} Linked Notes</span>
        </div>
      </div>
    `;
  }).join('');
}

window.openProjectModal = function () {
  setElText('project-modal-title', 'New Project');
  document.getElementById('project-form').reset();
  document.getElementById('project-id').value = '';
  document.getElementById('btn-delete-project').style.display = 'none';
  document.getElementById('project-modal').classList.add('active');
};

window.openEditProjectModal = function (id) {
  const p = allProjects.find(x => String(x.id) === String(id));
  if (!p) return;
  setElText('project-modal-title', 'Edit Project');
  document.getElementById('project-id').value = p.id;
  document.getElementById('project-title').value = p.title;
  document.getElementById('project-status').value = p.status || 'active';
  document.getElementById('project-deadline').value = p.deadline || '';
  document.getElementById('project-desc').value = p.description || '';
  document.getElementById('btn-delete-project').style.display = 'inline-flex';
  document.getElementById('project-modal').classList.add('active');
};

window.closeProjectModal = function () {
  document.getElementById('project-modal').classList.remove('active');
};

document.getElementById('project-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('project-id').value;
  const payload = {
    title: document.getElementById('project-title').value.trim(),
    status: document.getElementById('project-status').value,
    deadline: document.getElementById('project-deadline').value || null,
    description: document.getElementById('project-desc').value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('projects').update(payload).eq('id', id)
    : await supabaseClient.from('projects').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeProjectModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(id ? 'Project updated' : 'Project created', 'success');
  }
});

window.deleteCurrentProject = async function () {
  const id = document.getElementById('project-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('projects').delete().eq('id', id);
  if (!error) {
    closeProjectModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Project deleted', 'info');
  }
};

function renderBookmarks() {
  const grid = document.getElementById('workspace-bookmarks-grid');
  const catSelect = document.getElementById('filter-bookmark-cat');
  if (!grid) return;

  if (catSelect) {
    const cats = new Set(['General']);
    allBookmarks.forEach(b => { if (b.category) cats.add(b.category); });
    const prev = catSelect.value;
    catSelect.innerHTML = `<option value="all">All Categories</option>` +
      Array.from(cats).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if ([...cats, 'all'].includes(prev)) catSelect.value = prev;
  }

  const q = (document.getElementById('search-bookmarks')?.value || '').toLowerCase().trim();
  const catFilter = catSelect?.value || 'all';

  const filtered = allBookmarks.filter(b => {
    if (b.is_archived) return false;
    if (catFilter !== 'all' && (b.category || 'General') !== catFilter) return false;
    if (q) {
      const hay = [b.title, b.url, b.description, b.category, ...(Array.isArray(b.tags) ? b.tags : [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">No bookmarks saved yet.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(b => {
    const safeId = escapeHtml(String(b.id));
    let domain = b.url;
    try { domain = new URL(b.url).hostname.replace(/^www\./, ''); } catch (_) {}
    const tags = Array.isArray(b.tags) ? b.tags : [];

    return `
      <div class="collection-card" style="cursor:default;">
        <div class="collection-card-top">
          <div style="min-width:0;">
            <h3 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(b.title)}</h3>
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-domain-link">${escapeHtml(domain)} ↗</a>
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditBookmarkModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        ${b.description ? `<p>${escapeHtml(b.description)}</p>` : ''}
        <div class="note-tags-row" style="margin-top:auto;">
          <span class="tag-pill">${escapeHtml(b.category || 'General')}</span>
          ${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.openBookmarkModal = function () {
  setElText('bookmark-modal-title', 'Save Bookmark');
  document.getElementById('bookmark-form').reset();
  document.getElementById('bookmark-id').value = '';
  document.getElementById('btn-delete-bookmark').style.display = 'none';
  document.getElementById('bookmark-modal').classList.add('active');
};

window.openEditBookmarkModal = function (id) {
  const b = allBookmarks.find(x => String(x.id) === String(id));
  if (!b) return;
  setElText('bookmark-modal-title', 'Edit Bookmark');
  document.getElementById('bookmark-id').value = b.id;
  document.getElementById('bookmark-title').value = b.title;
  document.getElementById('bookmark-url').value = b.url;
  document.getElementById('bookmark-category').value = b.category || 'General';
  document.getElementById('bookmark-tags').value = Array.isArray(b.tags) ? b.tags.join(', ') : '';
  document.getElementById('bookmark-desc').value = b.description || '';
  document.getElementById('btn-delete-bookmark').style.display = 'inline-flex';
  document.getElementById('bookmark-modal').classList.add('active');
};

window.closeBookmarkModal = function () {
  document.getElementById('bookmark-modal').classList.remove('active');
};

document.getElementById('bookmark-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('bookmark-id').value;
  const payload = {
    title: document.getElementById('bookmark-title').value.trim(),
    url: document.getElementById('bookmark-url').value.trim(),
    category: document.getElementById('bookmark-category').value.trim() || 'General',
    tags: document.getElementById('bookmark-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    description: document.getElementById('bookmark-desc').value.trim() || null
  };

  const res = id
    ? await supabaseClient.from('bookmarks').update(payload).eq('id', id)
    : await supabaseClient.from('bookmarks').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeBookmarkModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast(id ? 'Bookmark updated' : 'Bookmark saved', 'success');
  }
});

window.deleteCurrentBookmark = async function () {
  const id = document.getElementById('bookmark-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('bookmarks').delete().eq('id', id);
  if (!error) {
    closeBookmarkModal();
    await fetchWorkspaceData();
    renderAllWorkspaceViews();
    showToast('Bookmark deleted', 'info');
  }
};

// ==========================================
// 14. PHASE 3: KNOWLEDGE BASE (QUOTES, VOCABULARY, CONCEPTS)
// ==========================================
async function fetchKnowledgeData() {
  if (!isAdminLoggedIn) return;
  const [qRes, vRes, cRes] = await Promise.all([
    supabaseClient.from('quotes').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('vocabulary').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('concepts').select('*').order('created_at', { ascending: false })
  ]);

  if (!qRes.error) allQuotes = qRes.data || [];
  if (!vRes.error) allVocabulary = vRes.data || [];
  if (!cRes.error) allConcepts = cRes.data || [];
}

function renderAllKnowledgeViews() {
  renderQuotes();
  renderVocabulary();
  renderConcepts();
}

function renderQuotes() {
  const list = document.getElementById('kb-quotes-list');
  if (!list) return;

  const q = (document.getElementById('search-quotes')?.value || '').toLowerCase().trim();
  const filtered = allQuotes.filter(item => {
    if (!q) return true;
    const hay = [item.quote_text, item.author, item.source_title, ...(Array.isArray(item.tags) ? item.tags : [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">No quotes saved yet.</p>`;
    return;
  }

  list.innerHTML = filtered.map(item => {
    const safeId = escapeHtml(String(item.id));
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const attrParts = [item.author, item.source_title].filter(Boolean).join(' — ');
    return `
      <div class="quote-card">
        <div class="quote-text-body">“${escapeHtml(item.quote_text)}”</div>
        <div class="quote-attribution">
          <span>${escapeHtml(attrParts || 'Unknown Source')}</span>
          <button type="button" class="blog-icon-btn" onclick="openEditQuoteModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        ${tags.length ? `<div class="note-tags-row">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');
}

window.openQuoteModal = function () {
  setElText('quote-modal-title', 'Save Quote');
  document.getElementById('quote-form').reset();
  document.getElementById('quote-id').value = '';
  document.getElementById('btn-delete-quote').style.display = 'none';
  document.getElementById('quote-modal').classList.add('active');
};

window.openEditQuoteModal = function (id) {
  const item = allQuotes.find(x => String(x.id) === String(id));
  if (!item) return;
  setElText('quote-modal-title', 'Edit Quote');
  document.getElementById('quote-id').value = item.id;
  document.getElementById('quote-text').value = item.quote_text;
  document.getElementById('quote-author').value = item.author || '';
  document.getElementById('quote-source').value = item.source_title || '';
  document.getElementById('quote-tags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  document.getElementById('btn-delete-quote').style.display = 'inline-flex';
  document.getElementById('quote-modal').classList.add('active');
};

window.closeQuoteModal = function () {
  document.getElementById('quote-modal').classList.remove('active');
};

document.getElementById('quote-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('quote-id').value;
  const payload = {
    quote_text: document.getElementById('quote-text').value.trim(),
    author: document.getElementById('quote-author').value.trim() || null,
    source_title: document.getElementById('quote-source').value.trim() || null,
    tags: document.getElementById('quote-tags').value.split(',').map(s => s.trim()).filter(Boolean)
  };

  const res = id
    ? await supabaseClient.from('quotes').update(payload).eq('id', id)
    : await supabaseClient.from('quotes').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeQuoteModal();
    await fetchKnowledgeData();
    renderQuotes();
    showToast('Quote saved', 'success');
  }
});

window.deleteCurrentQuote = async function () {
  const id = document.getElementById('quote-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('quotes').delete().eq('id', id);
  if (!error) {
    closeQuoteModal();
    await fetchKnowledgeData();
    renderQuotes();
    showToast('Quote deleted', 'info');
  }
};

window.toggleVocabStudyMode = function () {
  isVocabStudyMode = !isVocabStudyMode;
  setElText('vocab-study-label', isVocabStudyMode ? 'Exit Study' : 'Study Mode');
  renderVocabulary();
};

function renderVocabulary() {
  const grid = document.getElementById('kb-vocab-grid');
  const langSelect = document.getElementById('filter-vocab-lang');
  if (!grid) return;

  if (langSelect) {
    const langs = new Set();
    allVocabulary.forEach(v => { if (v.language) langs.add(v.language); });
    const prev = langSelect.value;
    langSelect.innerHTML = `<option value="all">All Languages</option>` +
      Array.from(langs).map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    if ([...langs, 'all'].includes(prev)) langSelect.value = prev;
  }

  const q = (document.getElementById('search-vocab')?.value || '').toLowerCase().trim();
  const langFilter = langSelect?.value || 'all';

  const filtered = allVocabulary.filter(v => {
    if (langFilter !== 'all' && v.language !== langFilter) return false;
    if (q) {
      const hay = [v.term, v.reading, v.meaning, v.example_sentence].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">No vocabulary words added yet.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(v => {
    const safeId = escapeHtml(String(v.id));
    return `
      <div class="collection-card" style="cursor:default;">
        <div class="collection-card-top">
          <div>
            <h3 style="font-size:15px;">${escapeHtml(v.term)}</h3>
            ${v.reading ? `<span style="font-size:11.5px; color:var(--mono-muted);">${escapeHtml(v.reading)}</span>` : ''}
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditVocabModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        <p class="${isVocabStudyMode ? 'vocab-blurred' : ''}" style="color:var(--white-1); font-weight:500;">${escapeHtml(v.meaning)}</p>
        ${v.example_sentence ? `<p style="font-size:11.5px; font-style:italic;">${escapeHtml(v.example_sentence)}</p>` : ''}
        <div class="note-tags-row" style="margin-top:auto;">
          <span class="tag-pill">${escapeHtml(v.language || 'Language')}</span>
          <span class="tag-pill">${escapeHtml((v.mastery_level || 'learning').toUpperCase())}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.openVocabModal = function () {
  setElText('vocab-modal-title', 'Add Vocabulary');
  document.getElementById('vocab-form').reset();
  document.getElementById('vocab-id').value = '';
  document.getElementById('btn-delete-vocab').style.display = 'none';
  document.getElementById('vocab-modal').classList.add('active');
};

window.openEditVocabModal = function (id) {
  const v = allVocabulary.find(x => String(x.id) === String(id));
  if (!v) return;
  setElText('vocab-modal-title', 'Edit Vocabulary');
  document.getElementById('vocab-id').value = v.id;
  document.getElementById('vocab-term').value = v.term;
  document.getElementById('vocab-reading').value = v.reading || '';
  document.getElementById('vocab-meaning').value = v.meaning;
  document.getElementById('vocab-language').value = v.language || 'Japanese';
  document.getElementById('vocab-mastery').value = v.mastery_level || 'learning';
  document.getElementById('vocab-example').value = v.example_sentence || '';
  document.getElementById('btn-delete-vocab').style.display = 'inline-flex';
  document.getElementById('vocab-modal').classList.add('active');
};

window.closeVocabModal = function () {
  document.getElementById('vocab-modal').classList.remove('active');
};

document.getElementById('vocab-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('vocab-id').value;
  const payload = {
    term: document.getElementById('vocab-term').value.trim(),
    reading: document.getElementById('vocab-reading').value.trim() || null,
    meaning: document.getElementById('vocab-meaning').value.trim(),
    language: document.getElementById('vocab-language').value.trim() || 'Japanese',
    mastery_level: document.getElementById('vocab-mastery').value,
    example_sentence: document.getElementById('vocab-example').value.trim() || null
  };

  const res = id
    ? await supabaseClient.from('vocabulary').update(payload).eq('id', id)
    : await supabaseClient.from('vocabulary').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeVocabModal();
    await fetchKnowledgeData();
    renderVocabulary();
    showToast('Vocabulary saved', 'success');
  }
});

window.deleteCurrentVocab = async function () {
  const id = document.getElementById('vocab-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('vocabulary').delete().eq('id', id);
  if (!error) {
    closeVocabModal();
    await fetchKnowledgeData();
    renderVocabulary();
    showToast('Deleted', 'info');
  }
};

function renderConcepts() {
  const grid = document.getElementById('kb-concepts-grid');
  if (!grid) return;

  const q = (document.getElementById('search-concepts')?.value || '').toLowerCase().trim();
  const filtered = allConcepts.filter(c => {
    if (!q) return true;
    const hay = [c.title, c.category, c.summary, c.details, ...(Array.isArray(c.tags) ? c.tags : [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">No concepts documented yet.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(c => {
    const safeId = escapeHtml(String(c.id));
    const tags = Array.isArray(c.tags) ? c.tags : [];
    return `
      <div class="collection-card" style="cursor:default;">
        <div class="collection-card-top">
          <div>
            <h3>${escapeHtml(c.title)}</h3>
            <span style="font-size:11px; color:var(--mono-dim);">${escapeHtml(c.category || 'General')}</span>
          </div>
          <button type="button" class="blog-icon-btn" onclick="openEditConceptModal('${safeId}')">
            <ion-icon name="create-outline"></ion-icon>
          </button>
        </div>
        <p style="color:var(--white-1);">${escapeHtml(c.summary)}</p>
        ${c.details ? `<p style="font-size:11.5px; white-space:pre-wrap;">${escapeHtml(c.details)}</p>` : ''}
        ${tags.length ? `<div class="note-tags-row" style="margin-top:auto;">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');
}

window.openConceptModal = function () {
  setElText('concept-modal-title', 'New Concept');
  document.getElementById('concept-form').reset();
  document.getElementById('concept-id').value = '';
  document.getElementById('btn-delete-concept').style.display = 'none';
  document.getElementById('concept-modal').classList.add('active');
};

window.openEditConceptModal = function (id) {
  const c = allConcepts.find(x => String(x.id) === String(id));
  if (!c) return;
  setElText('concept-modal-title', 'Edit Concept');
  document.getElementById('concept-id').value = c.id;
  document.getElementById('concept-title').value = c.title;
  document.getElementById('concept-category').value = c.category || 'General';
  document.getElementById('concept-summary').value = c.summary;
  document.getElementById('concept-details').value = c.details || '';
  document.getElementById('concept-tags').value = Array.isArray(c.tags) ? c.tags.join(', ') : '';
  document.getElementById('btn-delete-concept').style.display = 'inline-flex';
  document.getElementById('concept-modal').classList.add('active');
};

window.closeConceptModal = function () {
  document.getElementById('concept-modal').classList.remove('active');
};

document.getElementById('concept-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('concept-id').value;
  const payload = {
    title: document.getElementById('concept-title').value.trim(),
    category: document.getElementById('concept-category').value.trim() || 'General',
    summary: document.getElementById('concept-summary').value.trim(),
    details: document.getElementById('concept-details').value.trim() || null,
    tags: document.getElementById('concept-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    updated_at: new Date().toISOString()
  };

  const res = id
    ? await supabaseClient.from('concepts').update(payload).eq('id', id)
    : await supabaseClient.from('concepts').insert([payload]);

  if (res.error) showToast(res.error.message, 'error');
  else {
    closeConceptModal();
    await fetchKnowledgeData();
    renderConcepts();
    showToast('Concept saved', 'success');
  }
});

window.deleteCurrentConcept = async function () {
  const id = document.getElementById('concept-id').value;
  if (!id) return;
  const { error } = await supabaseClient.from('concepts').delete().eq('id', id);
  if (!error) {
    closeConceptModal();
    await fetchKnowledgeData();
    renderConcepts();
    showToast('Deleted', 'info');
  }
};

// ==========================================
// 15. PHASE 4: DEEP STATISTICS & ANALYTICS (CHART.JS)
// ==========================================
function renderStatisticsAnalytics() {
  const activeMedia = allMediaLogs.filter(m => !m.is_archived && !m.deleted_at);
  const rated = activeMedia.filter(m => m.rating !== null && m.rating !== undefined && m.rating !== '');
  const meanScore = rated.length ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(2) : '0.0';
  const totalUnits = activeMedia.reduce((s, m) => s + getItemTracks(m).reduce((ts, t) => ts + (Number(t.progress) || 0), 0), 0);

  const doneTasks = allTasks.filter(t => t.status === 'done').length;
  const taskRate = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  const kbTotal = allQuotes.length + allVocabulary.length + allConcepts.length + allJournalEntries.length;

  setElText('analytics-mean-score', meanScore);
  setElText('analytics-rated-sub', `Across ${rated.length} rated entries`);
  setElText('analytics-total-units', totalUnits.toLocaleString('en-US'));
  setElText('analytics-task-rate', `${taskRate}%`);
  setElText('analytics-task-sub', `${doneTasks} of ${allTasks.length} tasks done`);
  setElText('analytics-kb-total', String(kbTotal));
  setElText('analytics-kb-sub', `${allQuotes.length} quotes · ${allVocabulary.length} words · ${allConcepts.length} concepts`);

  // Top Rated List
  const topListEl = document.getElementById('analytics-top-rated-list');
  if (topListEl) {
    const topRated = [...rated].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 6);
    if (!topRated.length) {
      topListEl.innerHTML = `<p class="empty-state-compact">Rate your media entries to populate top highlights.</p>`;
    } else {
      topListEl.innerHTML = topRated.map(m => `
        <div class="dash-media-row" onclick="openMediaDetailModal('${escapeHtml(String(m.id))}')">
          <div class="dash-media-info">
            <div class="dash-media-title">${escapeHtml(m.title)}</div>
            <div class="dash-media-meta">${escapeHtml(CATEGORY_LABELS[getLegacyCategory(m)] || m.category)}${m.release_year ? ` · ${m.release_year}` : ''}</div>
          </div>
          <span class="dash-media-badge">★ ${Number(m.rating).toFixed(1)}</span>
        </div>
      `).join('');
    }
  }

  if (typeof window.Chart === 'undefined') return;

  // Chart 1: Category Breakdown
  const catCounts = Object.keys(CATEGORY_LABELS).map(k => activeMedia.filter(m => getLegacyCategory(m) === k).length);
  const ctx1 = document.getElementById('chart-media-categories');
  if (ctx1) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: Object.values(CATEGORY_LABELS),
        datasets: [{
          label: 'Entries',
          data: catCounts,
          backgroundColor: '#e4e4e7',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#a1a1aa', precision: 0 }, grid: { color: '#27272a' } }
        }
      }
    });
  }

  // Chart 2: Rating Distribution (1-10)
  const buckets = ['≤4', '5', '6', '7', '8', '9', '10'];
  const bucketCounts = [0, 0, 0, 0, 0, 0, 0];
  rated.forEach(m => {
    const r = Math.round(Number(m.rating));
    if (r <= 4) bucketCounts[0]++;
    else if (r === 5) bucketCounts[1]++;
    else if (r === 6) bucketCounts[2]++;
    else if (r === 7) bucketCounts[3]++;
    else if (r === 8) bucketCounts[4]++;
    else if (r === 9) bucketCounts[5]++;
    else bucketCounts[6]++;
  });

  const ctx2 = document.getElementById('chart-rating-distribution');
  if (ctx2) {
    if (ratingChartInstance) ratingChartInstance.destroy();
    ratingChartInstance = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: buckets,
        datasets: [{
          label: 'Rated Media',
          data: bucketCounts,
          backgroundColor: '#a1a1aa',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { display: false } },
          y: { ticks: { color: '#a1a1aa', precision: 0 }, grid: { color: '#27272a' } }
        }
      }
    });
  }
}

// ==========================================
// 16. PHASE 5: AI ASSISTANT (GROQ EDGE FUNCTION)
// ==========================================
async function fetchAiConversations() {
  if (!isAdminLoggedIn) return;
  const { data, error } = await supabaseClient
    .from('ai_conversations')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(40);

  if (!error && data) {
    allAiMessages = data;
  }
}

function buildArchiveContextSummary() {
  const topRated = allMediaLogs
    .filter(m => m.rating !== null && m.rating !== undefined)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 12)
    .map(m => `${m.title} (${CATEGORY_LABELS[getLegacyCategory(m)]}, Rating: ${m.rating}/10)`);

  const ongoing = allMediaLogs
    .filter(m => computeSyncedStatus(getItemTracks(m)).key === 'ongoing')
    .slice(0, 10)
    .map(m => m.title);

  const openTasks = allTasks.filter(t => t.status !== 'done').slice(0, 10).map(t => `[${t.priority}] ${t.title}`);
  const activeGoals = allGoals.filter(g => g.status === 'active').slice(0, 6).map(g => `${g.title} (${g.current_value}/${g.target_value} ${g.unit})`);
  const recentNotes = allBlogPosts.slice(0, 5).map(n => `${n.title || 'Note'}: ${(n.content || '').slice(0, 120)}`);
  const vocabSample = allVocabulary.slice(0, 10).map(v => `${v.term} (${v.reading || ''}): ${v.meaning}`);
  const conceptSample = allConcepts.slice(0, 6).map(c => `${c.title}: ${c.summary}`);

  return [
    `Total Media: ${allMediaLogs.length}. Top Rated: ${topRated.join('; ') || 'None'}.`,
    `In Progress Media: ${ongoing.join(', ') || 'None'}.`,
    `Open Tasks: ${openTasks.join('; ') || 'None'}.`,
    `Active Goals: ${activeGoals.join('; ') || 'None'}.`,
    `Recent Notes: ${recentNotes.join(' | ') || 'None'}.`,
    `Vocabulary Sample: ${vocabSample.join('; ') || 'None'}.`,
    `Concepts Sample: ${conceptSample.join('; ') || 'None'}.`
  ].join('\n');
}

function renderAiChatFeed() {
  const feed = document.getElementById('ai-chat-feed');
  if (!feed) return;

  if (!allAiMessages.length) {
    feed.innerHTML = `<div class="ai-msg-bubble assistant">Hello! I am connected to your Personal Archive & Life OS. Ask me for media recommendations based on your top ratings, a weekly task review, note summaries, or a vocabulary quiz.</div>`;
    return;
  }

  feed.innerHTML = allAiMessages.map(m => `
    <div class="ai-msg-bubble ${m.role === 'user' ? 'user' : 'assistant'}">${escapeHtml(m.content)}</div>
  `).join('');
  feed.scrollTop = feed.scrollHeight;
}

window.sendQuickAiPrompt = function (promptText) {
  const input = document.getElementById('ai-prompt-input');
  if (input) {
    input.value = promptText;
    document.getElementById('ai-chat-form')?.dispatchEvent(new Event('submit'));
  }
};

document.getElementById('ai-chat-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return;

  const input = document.getElementById('ai-prompt-input');
  const sendBtn = document.getElementById('btn-ai-send');
  const promptText = input.value.trim();
  if (!promptText) return;

  input.value = '';
  sendBtn.disabled = true;

  allAiMessages.push({ role: 'user', content: promptText });
  renderAiChatFeed();

  await supabaseClient.from('ai_conversations').insert([{ role: 'user', content: promptText }]);

  const feed = document.getElementById('ai-chat-feed');
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'ai-msg-bubble assistant';
  thinkingEl.textContent = 'Thinking...';
  feed.appendChild(thinkingEl);
  feed.scrollTop = feed.scrollHeight;

  try {
    const { data, error } = await supabaseClient.functions.invoke('groq-assistant', {
      body: {
        prompt: promptText,
        contextSummary: buildArchiveContextSummary(),
        history: allAiMessages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      }
    });

    if (error) throw error;
    const reply = data?.reply || 'No response received.';

    allAiMessages.push({ role: 'assistant', content: reply });
    await supabaseClient.from('ai_conversations').insert([{ role: 'assistant', content: reply }]);
    renderAiChatFeed();
  } catch (err) {
    let detailedMsg = err.message || 'Unknown error';
    if (err.context && typeof err.context.json === 'function') {
      try {
        const errBody = await err.context.json();
        if (errBody?.error) detailedMsg = errBody.error;
      } catch (_) {}
    }
    thinkingEl.textContent = `AI Error: ${detailedMsg}`;
    showToast('AI request failed', 'error');
  } finally {
});

window.clearAiConversation = async function () {
  if (!isAdminLoggedIn) return;
  await supabaseClient.from('ai_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  allAiMessages = [];
  renderAiChatFeed();
  showToast('Chat cleared', 'info');
};

// ==========================================
// 17. GLOBAL SEARCH & QUICK CAPTURE
// ==========================================
window.openGlobalSearchModal = function () {
  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  if (modal) modal.classList.add('active');
  if (input) {
    input.value = '';
    handleGlobalSearchInput();
    setTimeout(() => input.focus(), 40);
  }
};

window.closeGlobalSearchModal = function () {
  document.getElementById('global-search-modal')?.classList.remove('active');
};

window.handleGlobalSearchInput = function () {
  const q = (document.getElementById('global-search-input')?.value || '').toLowerCase().trim();
  const container = document.getElementById('global-search-results');
  if (!container) return;

  const results = [];

  if (!currentProfile.is_library_private || isAdminLoggedIn) {
    allMediaLogs.filter(m => !m.is_archived && !m.deleted_at).forEach(m => {
      const hay = [m.title, m.original_title, m.creator, ...(m.genres || []), ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase();
      if (!q || hay.includes(q)) {
        results.push({
          type: 'Media',
          title: m.title,
          sub: `${CATEGORY_LABELS[getLegacyCategory(m)] || m.category}${m.release_year ? ` · ${m.release_year}` : ''}`,
          action: () => { closeGlobalSearchModal(); openMediaDetailModal(String(m.id)); }
        });
      }
    });
  }

  allBlogPosts.filter(p => !p.is_archived && !p.deleted_at && (!p.is_private || isAdminLoggedIn)).forEach(p => {
    const title = p.title || (p.content || '').slice(0, 44);
    const hay = [p.title, p.content, p.folder, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
    if (!q || hay.includes(q)) {
      results.push({
        type: 'Note',
        title,
        sub: p.folder || 'General',
        action: () => { closeGlobalSearchModal(); switchMainView('notes'); }
      });
    }
  });

  if (isAdminLoggedIn) {
    allTasks.filter(t => !t.is_archived).forEach(t => {
      if (!q || (t.title || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Task',
          title: t.title,
          sub: `${t.priority.toUpperCase()} · ${t.status}`,
          action: () => { closeGlobalSearchModal(); switchMainView('workspace'); switchWorkspaceTab('tasks'); }
        });
      }
    });

    allQuotes.forEach(qt => {
      if (!q || [qt.quote_text, qt.author, qt.source_title].filter(Boolean).join(' ').toLowerCase().includes(q)) {
        results.push({
          type: 'Quote',
          title: (qt.quote_text || '').slice(0, 52) + '...',
          sub: qt.author || qt.source_title || 'Quote',
          action: () => { closeGlobalSearchModal(); switchMainView('knowledge'); switchKnowledgeTab('quotes'); }
        });
      }
    });

    allVocabulary.forEach(v => {
      if (!q || [v.term, v.reading, v.meaning].filter(Boolean).join(' ').toLowerCase().includes(q)) {
        results.push({
          type: 'Vocab',
          title: `${v.term} — ${v.meaning}`,
          sub: v.language || 'Language',
          action: () => { closeGlobalSearchModal(); switchMainView('knowledge'); switchKnowledgeTab('vocabulary'); }
        });
      }
    });
  }

  if (!results.length) {
    container.innerHTML = `<p class="empty-state-compact" style="padding:16px;">No matching items across your archive.</p>`;
    return;
  }

  window._cmdResults = results.slice(0, 14);
  container.innerHTML = window._cmdResults.map((r, i) => `
    <div class="cmd-result-row" onclick="window._cmdResults[${i}].action()">
      <div>
        <div class="cmd-result-title">${escapeHtml(r.title)}</div>
        <div class="cmd-result-sub">${escapeHtml(r.sub)}</div>
      </div>
      <span class="cmd-type-pill">${escapeHtml(r.type)}</span>
    </div>
  `).join('');
};

window.openQuickCaptureModal = function () {
  if (!isAdminLoggedIn) return;
  document.getElementById('quick-capture-modal')?.classList.add('active');
};

window.closeQuickCaptureModal = function () {
  document.getElementById('quick-capture-modal')?.classList.remove('active');
};
