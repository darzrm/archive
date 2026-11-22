/* ============================================================
   ARCHIVE — Personal Media & Life OS (Supabase Backend)
   ============================================================ */

'use strict';

// ==================== 1. SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://jwnfmbwctqejrbbqkhcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bmZtYndjdHFlanJiYnFraGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzQ0MTgsImV4cCI6MjA5MjI1MDQxOH0.2f343M0YShR_eJ4n3P3O6Z2iQ1aT7N3wV_fL0hR3K_k';
const STORAGE_BUCKET = 'media-assets';

let db = null;
try {
  if (window.supabase && SUPABASE_URL.startsWith('https://')) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.error('Supabase initialization error:', err);
}

// ==================== 2. CONSTANTS & STATE ====================
const MEDIA_CATEGORIES = [
  'Movies', 'TV Shows', 'Anime', 'Manga', 'Comics',
  'Manhwa', 'Manhua', 'Books', 'Video Games', 'Visual Novels', 'Music', 'Other Media'
];

const CATEGORY_MAP_LEGACY = {
  'Movie': 'Movies',
  'Series': 'TV Shows',
  'Comic': 'Comics',
  'Book': 'Books',
  'Game': 'Video Games',
  'Visual Novel': 'Visual Novels',
  'Novel': 'Books',
  'Donghua': 'Anime'
};

const CATEGORY_META_FIELDS = {
  'Movies': [
    { key: 'runtime', label: 'Runtime (mins)', placeholder: '148' },
    { key: 'rewatch_count', label: 'Rewatch Count', placeholder: '0' }
  ],
  'TV Shows': [
    { key: 'current_season', label: 'Current Season', placeholder: '1' },
    { key: 'total_seasons', label: 'Total Seasons', placeholder: '4' }
  ],
  'Anime': [
    { key: 'anime_type', label: 'Format (TV/Movie/OVA/ONA)', placeholder: 'TV' },
    { key: 'season', label: 'Airing Season', placeholder: 'Fall 2024' }
  ],
  'Manga': [
    { key: 'current_volume', label: 'Current Volume', placeholder: '5' },
    { key: 'total_volumes', label: 'Total Volumes', placeholder: '12' }
  ],
  'Comics': [
    { key: 'current_volume', label: 'Current Issue/Vol', placeholder: '1' },
    { key: 'publisher', label: 'Publisher', placeholder: 'Image / DC' }
  ],
  'Manhwa': [
    { key: 'pub_status', label: 'Publication Status', placeholder: 'Ongoing / Completed' },
    { key: 'platform', label: 'Platform', placeholder: 'Webtoon' }
  ],
  'Manhua': [
    { key: 'pub_status', label: 'Publication Status', placeholder: 'Ongoing' },
    { key: 'platform', label: 'Platform', placeholder: 'Bilibili' }
  ],
  'Books': [
    { key: 'isbn', label: 'ISBN', placeholder: '978-0441172719' },
    { key: 'publisher', label: 'Publisher', placeholder: 'Penguin Classics' }
  ],
  'Video Games': [
    { key: 'platform', label: 'Platform', placeholder: 'PC, PS5, Switch' },
    { key: 'playtime_hours', label: 'Playtime (Hours)', placeholder: '65' }
  ],
  'Visual Novels': [
    { key: 'routes_completed', label: 'Completed Routes', placeholder: '3 / 5' },
    { key: 'playtime_hours', label: 'Playtime (Hours)', placeholder: '42' }
  ],
  'Music': [
    { key: 'release_type', label: 'Type (Album/EP/Single)', placeholder: 'Album' },
    { key: 'tracklist_highlights', label: 'Favorite Tracks', placeholder: 'Track 1, Track 4' }
  ],
  'Other Media': [
    { key: 'format', label: 'Format / Medium', placeholder: 'Podcast, Documentary' },
    { key: 'notes', label: 'Extra Info', placeholder: '' }
  ]
};

const state = {
  isAdmin: false,
  user: null,
  currentView: 'overview',
  currentMediaCat: 'All',
  currentMediaStatus: 'All',
  currentMediaGenre: 'All',
  currentMediaRating: 'All',
  mediaFavOnly: false,
  mediaViewMode: 'grid',
  mediaSearch: '',
  mediaSort: 'updated_desc',
  noteCat: 'All',
  noteFolder: 'All',
  noteSearch: '',
  taskFilter: 'All',
  timelineFilter: 'All',
  timelineSearch: '',
  archiveTab: 'archived',
  statsCategoryFilter: 'All',
  journalMonth: new Date(),
  selectedJournalDate: toLocalDateStr(new Date()),

  // Data collections
  media: [],
  notes: [],
  collections: [],
  tasks: [],
  journal: [],
  goals: [],
  projects: [],
  bookmarks: [],
  quotes: [],
  vocabulary: [],
  concepts: [],
  learningNotes: [],
  references: [],
  activityLogs: [],

  // Pending file uploads
  pendingCoverFile: null,
  pendingNoteFiles: [],
  existingNoteImages: [],

  // Charts & preferences
  charts: {},
  hiddenWidgets: JSON.parse(localStorage.getItem('archive_hidden_widgets') || '[]')
};

// ==================== 3. UTILITIES ====================
function toLocalDateStr(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCategory(cat) {
  return CATEGORY_MAP_LEGACY[cat] || cat || 'Other Media';
}

function normalizeStatus(st) {
  if (['Reading', 'Watching', 'Playing'].includes(st)) return 'In Progress';
  if (st === 'Planned') return 'Planning';
  return st || 'Planning';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = '0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function renderRating(rating) {
  const r = Number(rating);
  if (rating === null || rating === undefined || rating === '' || isNaN(r) || r <= 0) {
    return '<span class="muted">Unrated</span>';
  }
  return `<span class="rating-pill">★ ${r.toFixed(1)}<span class="muted">/10</span></span>`;
}

function statusBadgeClass(status) {
  const s = normalizeStatus(status).toLowerCase();
  if (s === 'completed' || s === 'done') return 'badge badge-completed';
  if (s === 'in progress' || s === 'active') return 'badge badge-active';
  if (s === 'planning' || s === 'todo') return 'badge badge-planned';
  if (s === 'on hold') return 'badge badge-hold';
  if (s === 'dropped' || s === 'archived') return 'badge badge-dropped';
  return 'badge';
}

function parseNoteLinks(text) {
  const escaped = esc(text);
  return escaped.replace(/\[\[([^\]]+)\]\]/g, (_match, title) => {
    return `<a class="note-link" data-note-title="${esc(title)}">[[${esc(title)}]]</a>`;
  });
}

async function logActivity(actionType, entityType, entityId, entityTitle, details = '') {
  if (!db || !state.isAdmin) return;
  try {
    await db.from('activity_logs').insert([{
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_title: entityTitle,
      details
    }]);
  } catch (e) {
    console.warn('Activity log skipped:', e.message);
  }
}

async function compressImageToWebP(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
              resolve(new File([blob], newName, { type: 'image/webp' }));
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadImageToStorage(file, folder = 'misc') {
  if (!db) throw new Error('Supabase client not initialized');
  const compressed = await compressImageToWebP(file);
  const ext = compressed.name.split('.').pop() || 'webp';
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, compressed, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ==================== 4. AUTHENTICATION & ADMIN STATE ====================
function updateAdminUI() {
  document.body.classList.toggle('is-admin', state.isAdmin);
  const badge = document.getElementById('mode-badge');
  const text = document.getElementById('mode-text');
  const loginBtn = document.getElementById('btn-open-login');
  const logoutBtn = document.getElementById('btn-logout');

  if (state.isAdmin) {
    badge.classList.add('admin');
    text.textContent = 'Admin Mode';
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    badge.classList.remove('admin');
    text.textContent = 'Public View';
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    if (state.currentView === 'ai-assistant') switchView('overview');
  }
  renderAll();
}

async function initAuth() {
  if (!db) return;
  const { data } = await db.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
    state.isAdmin = true;
    updateAdminUI();
  }

  db.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    state.isAdmin = !!session?.user;
    updateAdminUI();
  });
}

// ==================== 5. DATA LOADING (SUPABASE) ====================
async function loadAllData() {
  if (!db) {
    showToast('Supabase configuration missing.', 'error');
    return;
  }

  try {
    const [
      mediaRes,
      notesRes,
      colRes,
      tasksRes,
      journalRes,
      goalsRes,
      projRes,
      bookRes,
      quotesRes,
      vocabRes,
      concRes,
      learnRes,
      refRes,
      actRes
    ] = await Promise.all([
      db.from('media_items').select('*').order('updated_at', { ascending: false }),
      db.from('notes').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      db.from('collections').select('*').order('created_at', { ascending: false }),
      db.from('tasks').select('*').order('is_completed', { ascending: true }).order('created_at', { ascending: false }),
      db.from('journal_entries').select('*').order('entry_date', { ascending: false }),
      db.from('goals').select('*').order('created_at', { ascending: false }),
      db.from('projects').select('*').order('updated_at', { ascending: false }),
      db.from('bookmarks').select('*').order('created_at', { ascending: false }),
      db.from('quotes').select('*').order('created_at', { ascending: false }),
      db.from('vocabulary').select('*').order('created_at', { ascending: false }),
      db.from('concepts').select('*').order('updated_at', { ascending: false }),
      db.from('learning_notes').select('*').order('created_at', { ascending: false }),
      db.from('references_lib').select('*').order('created_at', { ascending: false }),
      db.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(150)
    ]);

    state.media = (mediaRes.data || []).map(m => ({
      ...m,
      category: normalizeCategory(m.category),
      status: normalizeStatus(m.status)
    }));
    state.notes = notesRes.data || [];
    state.collections = colRes.data || [];
    state.tasks = tasksRes.data || [];
    state.journal = journalRes.data || [];
    state.goals = goalsRes.data || [];
    state.projects = projRes.data || [];
    state.bookmarks = bookRes.data || [];
    state.quotes = quotesRes.data || [];
    state.vocabulary = vocabRes.data || [];
    state.concepts = concRes.data || [];
    state.learningNotes = learnRes.data || [];
    state.references = refRes.data || [];
    state.activityLogs = actRes.data || [];

    updateNotifications();
    populateFilterDropdowns();
    renderAll();
  } catch (err) {
    console.error('Error loading archive data:', err);
    showToast('Failed to load archive data. Verify Supabase schema.', 'error');
  }
}

function getActiveMedia() {
  return state.media.filter(m => !m.is_archived && !m.deleted_at);
}

function getActiveNotes() {
  return state.notes.filter(n => !n.is_archived && !n.deleted_at);
}

function populateFilterDropdowns() {
  const genres = new Set();
  getActiveMedia().forEach(m => (m.genres || []).forEach(g => genres.add(g)));
  const genreSel = document.getElementById('media-genre-filter');
  if (genreSel) {
    const cur = genreSel.value;
    genreSel.innerHTML = `<option value="All">All Genres</option>` +
      Array.from(genres).sort().map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    genreSel.value = genres.has(cur) ? cur : 'All';
  }

  const folders = new Set(['General']);
  getActiveNotes().forEach(n => { if (n.folder) folders.add(n.folder); });
  const folderSel = document.getElementById('note-folder-filter');
  if (folderSel) {
    const cur = folderSel.value;
    folderSel.innerHTML = `<option value="All">All Folders</option>` +
      Array.from(folders).sort().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    folderSel.value = folders.has(cur) ? cur : 'All';
  }

  const statsCatSel = document.getElementById('stats-category-filter');
  if (statsCatSel && statsCatSel.options.length <= 1) {
    statsCatSel.innerHTML = `<option value="All">All Categories</option>` +
      MEDIA_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
}

function updateNotifications() {
  const today = toLocalDateStr(new Date());
  const upcoming = state.tasks.filter(t => !t.is_completed && t.due_date && t.due_date <= today);
  const dot = document.getElementById('notif-dot');
  const list = document.getElementById('notifications-list');

  if (dot) dot.classList.toggle('hidden', upcoming.length === 0);
  if (list) {
    if (!upcoming.length) {
      list.innerHTML = `<div class="empty-state">No overdue or due-today tasks.</div>`;
    } else {
      list.innerHTML = upcoming.map(t => `
        <div class="activity-item">
          <div>
            <strong>${esc(t.title)}</strong>
            <div class="muted" style="font-size:0.76rem">Due: ${formatDate(t.due_date)} • ${esc(t.priority)}</div>
          </div>
          <button class="btn-secondary btn-sm" onclick="closeModal('modal-notifications'); switchView('workspace')">Open</button>
        </div>
      `).join('');
    }
  }
}

function renderAll() {
  applyDashboardWidgetVisibility();
  renderOverview();
  renderMediaCategoryTabs();
  renderMediaLibrary();
  renderNotesFeed();
  renderCollections();
  renderWorkspace();
  renderKnowledgeBase();
  renderStatistics();
  renderTimeline();
  renderArchiveView();
}

// ==================== 6. OVERVIEW DASHBOARD ====================
function applyDashboardWidgetVisibility() {
  document.querySelectorAll('#view-overview [data-widget]').forEach(el => {
    el.classList.toggle('hidden', state.hiddenWidgets.includes(el.dataset.widget));
  });
}

function renderOverview() {
  const dateSub = document.getElementById('overview-date-subtitle');
  if (dateSub) {
    const todayFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    dateSub.textContent = `${todayFormatted} — Centralized personal media index, notes feed, and knowledge archive.`;
  }

  const activeMedia = getActiveMedia();
  const activeNotes = getActiveNotes();

  document.getElementById('stat-total-media').textContent = activeMedia.length;
  const inProgressCount = activeMedia.filter(m => m.status === 'In Progress').length;
  document.getElementById('stat-active-media').textContent = inProgressCount;
  document.getElementById('stat-total-notes').textContent = activeNotes.length;
  document.getElementById('stat-total-knowledge').textContent =
    state.quotes.length + state.vocabulary.length + state.concepts.length + state.learningNotes.length;

  // Currently In Progress
  const activeGrid = document.getElementById('overview-active-media');
  const inProgressItems = activeMedia.filter(m => m.status === 'In Progress').slice(0, 6);
  if (!inProgressItems.length) {
    activeGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No media currently in progress.</div>`;
  } else {
    activeGrid.innerHTML = inProgressItems.map(item => `
      <div class="mini-media-card" onclick="openMediaDetail('${item.id}')">
        <img class="mini-cover" src="${esc(item.cover_url || '')}" alt="" onerror="this.style.display='none'">
        <div class="mini-info">
          <div class="mini-title">${esc(item.title)}</div>
          <div class="mini-meta">${esc(item.category)} • ${renderRating(item.rating)}</div>
          <div class="mini-progress">${esc(item.progress_current || 0)}${item.progress_total ? ' / ' + esc(item.progress_total) : ''} ${esc(item.progress_unit || '')}</div>
        </div>
      </div>
    `).join('');
  }

  // Recently Completed
  const completedGrid = document.getElementById('overview-completed-media');
  const completedItems = activeMedia
    .filter(m => m.status === 'Completed')
    .sort((a, b) => new Date(b.finish_date || b.updated_at) - new Date(a.finish_date || a.updated_at))
    .slice(0, 4);

  if (!completedItems.length) {
    completedGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No completed entries recorded yet.</div>`;
  } else {
    completedGrid.innerHTML = completedItems.map(item => `
      <div class="mini-media-card" onclick="openMediaDetail('${item.id}')">
        <img class="mini-cover" src="${esc(item.cover_url || '')}" alt="" onerror="this.style.display='none'">
        <div class="mini-info">
          <div class="mini-title">${esc(item.title)}</div>
          <div class="mini-meta">${esc(item.category)} • ${renderRating(item.rating)}</div>
          <div class="mini-progress muted">${formatDate(item.finish_date || item.updated_at)}</div>
        </div>
      </div>
    `).join('');
  }

  // Upcoming Tasks & Goals
  const tgContainer = document.getElementById('overview-tasks-goals');
  const pendingTasks = state.tasks.filter(t => !t.is_completed).slice(0, 4);
  const activeGoals = state.goals.filter(g => !g.is_archived).slice(0, 2);
  if (!pendingTasks.length && !activeGoals.length) {
    tgContainer.innerHTML = `<div class="empty-state">All caught up on tasks and goals.</div>`;
  } else {
    const tasksHtml = pendingTasks.map(t => `
      <div class="activity-item">
        <span><span class="badge" style="margin-right:6px">${esc(t.priority)}</span>${esc(t.title)}</span>
        <span class="activity-time">${t.due_date ? formatDate(t.due_date) : 'No due date'}</span>
      </div>
    `).join('');
    const goalsHtml = activeGoals.map(g => `
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
          <span>Goal: <strong>${esc(g.title)}</strong></span>
          <span>${Number(g.progress_percent) || 0}%</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Number(g.progress_percent) || 0}%"></div></div>
      </div>
    `).join('');
    tgContainer.innerHTML = `<div class="activity-list">${tasksHtml}</div>${goalsHtml}`;
  }

  // Recent Activity
  const activityList = document.getElementById('overview-recent-activity');
  const combinedActs = buildTimelineEntries().slice(0, 6);
  if (!combinedActs.length) {
    activityList.innerHTML = `<div class="empty-state">No recent activity logged yet.</div>`;
  } else {
    activityList.innerHTML = combinedActs.map(act => `
      <div class="activity-item">
        <span>${act.html}</span>
        <span class="activity-time">${formatDate(act.date)}</span>
      </div>
    `).join('');
  }

  // Pinned & Recent Notes
  const pinnedContainer = document.getElementById('overview-pinned-notes');
  const topNotes = activeNotes.slice(0, 4);
  if (!topNotes.length) {
    pinnedContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No notes published yet.</div>`;
  } else {
    pinnedContainer.innerHTML = topNotes.map(n => `
      <div class="card" style="cursor:pointer" onclick="switchView('notes')">
        <div class="note-header">
          <span class="badge">${esc(n.category)}</span>
          <span class="muted" style="font-size:0.75rem">${formatDate(n.created_at)}</span>
        </div>
        <h3 style="margin-bottom:6px">${esc(n.title || 'Untitled Note')}</h3>
        <p class="muted" style="font-size:0.86rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(n.content)}</p>
      </div>
    `).join('');
  }
}

// ==================== 7. MEDIA LIBRARY ====================
function renderMediaCategoryTabs() {
  const container = document.getElementById('media-category-tabs');
  const activeMedia = getActiveMedia();
  const allCats = ['All', ...MEDIA_CATEGORIES];
  container.innerHTML = allCats.map(cat => {
    const count = cat === 'All'
      ? activeMedia.length
      : activeMedia.filter(m => m.category === cat).length;
    const active = state.currentMediaCat === cat ? 'active' : '';
    return `<button class="cat-pill ${active}" data-cat="${esc(cat)}">${esc(cat)} (${count})</button>`;
  }).join('');

  container.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentMediaCat = btn.dataset.cat;
      renderMediaCategoryTabs();
      renderMediaLibrary();
    });
  });
}

function getFilteredMedia() {
  let items = getActiveMedia();

  if (state.currentMediaCat !== 'All') {
    items = items.filter(m => m.category === state.currentMediaCat);
  }
  if (state.currentMediaStatus !== 'All') {
    items = items.filter(m => m.status === state.currentMediaStatus);
  }
  if (state.currentMediaGenre !== 'All') {
    items = items.filter(m => (m.genres || []).includes(state.currentMediaGenre));
  }
  if (state.currentMediaRating !== 'All') {
    if (state.currentMediaRating === 'unrated') {
      items = items.filter(m => !m.rating || Number(m.rating) <= 0);
    } else {
      const minR = Number(state.currentMediaRating);
      items = items.filter(m => Number(m.rating) >= minR);
    }
  }
  if (state.mediaFavOnly) {
    items = items.filter(m => !!m.is_favorite);
  }
  if (state.mediaSearch.trim()) {
    const q = state.mediaSearch.toLowerCase();
    items = items.filter(m =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.alt_title || '').toLowerCase().includes(q) ||
      (m.creator || '').toLowerCase().includes(q) ||
      (m.genres || []).some(g => g.toLowerCase().includes(q)) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  switch (state.mediaSort) {
    case 'rating_desc':
      items.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
      break;
    case 'year_desc':
      items.sort((a, b) => (Number(b.release_year) || 0) - (Number(a.release_year) || 0));
      break;
    case 'title_asc':
      items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'created_desc':
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case 'updated_desc':
    default:
      items.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      break;
  }
  return items;
}

function renderMediaLibrary() {
  const container = document.getElementById('media-container');
  const items = getFilteredMedia();

  if (!items.length) {
    container.className = 'media-grid';
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No media entries match your current filters.</div>`;
    return;
  }

  if (state.mediaViewMode === 'compact') {
    container.className = 'media-compact';
    container.innerHTML = `
      <table class="compact-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Rating</th>
            <th>Year</th>
            <th>Creator</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr onclick="openMediaDetail('${item.id}')">
              <td><strong>${item.is_favorite ? '★ ' : ''}${esc(item.title)}</strong></td>
              <td><span class="badge">${esc(item.category)}</span></td>
              <td><span class="${statusBadgeClass(item.status)}">${esc(item.status)}</span></td>
              <td class="muted">${esc(item.progress_current || 0)}${item.progress_total ? ' / ' + esc(item.progress_total) : ''} ${esc(item.progress_unit || '')}</td>
              <td>${renderRating(item.rating)}</td>
              <td class="muted">${esc(item.release_year || '—')}</td>
              <td class="muted">${esc(item.creator || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return;
  }

  container.className = state.mediaViewMode === 'list' ? 'media-list' : 'media-grid';
  container.innerHTML = items.map(item => {
    const pct = item.progress_total > 0
      ? Math.min(100, Math.round(((item.progress_current || 0) / item.progress_total) * 100))
      : null;

    const genresHtml = (item.genres || []).slice(0, 3).map(g => `<span class="tag">${esc(g)}</span>`).join('');

    return `
      <div class="media-card" onclick="openMediaDetail('${item.id}')">
        <div class="media-cover-wrap">
          ${item.cover_url
            ? `<img class="media-cover" src="${esc(item.cover_url)}" alt="${esc(item.title)}" loading="lazy">`
            : `<div class="media-cover-placeholder">${esc(item.category)}</div>`
          }
          <span class="media-cat-tag">${esc(item.category)}</span>
          ${item.is_favorite ? `<span class="media-fav-badge">★</span>` : ''}
        </div>
        <div class="media-body">
          <div class="media-title" title="${esc(item.title)}">${esc(item.title)}</div>
          <div class="media-creator">${esc(item.creator || 'Unknown Creator')}${item.release_year ? ` • ${esc(item.release_year)}` : ''}</div>
          ${genresHtml ? `<div class="tag-list">${genresHtml}</div>` : ''}
          <div class="media-meta-row">
            <span class="${statusBadgeClass(item.status)}">${esc(item.status)}</span>
            ${renderRating(item.rating)}
          </div>
          <div style="font-size:0.76rem;color:var(--silver-dust);margin-top:4px;display:flex;justify-content:space-between">
            <span>${esc(item.progress_current || 0)}${item.progress_total ? ' / ' + esc(item.progress_total) : ''} ${esc(item.progress_unit || '')}</span>
            ${pct !== null ? `<span>${pct}%</span>` : ''}
          </div>
          ${pct !== null ? `<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderDynamicMediaFields(category, existingMeta = {}) {
  const container = document.getElementById('media-dynamic-fields');
  if (!container) return;
  const defs = CATEGORY_META_FIELDS[category] || CATEGORY_META_FIELDS['Other Media'];
  container.innerHTML = defs.map(f => `
    <div class="form-group">
      <label>${esc(f.label)}</label>
      <input type="text" data-meta-key="${esc(f.key)}" value="${esc(existingMeta[f.key] || '')}" placeholder="${esc(f.placeholder)}" />
    </div>
  `).join('');
}

window.openMediaDetail = function (id) {
  const item = state.media.find(m => m.id === id);
  if (!item) return;

  const body = document.getElementById('media-detail-body');
  const genres = (item.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
  const tags = (item.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('');
  const metaEntries = Object.entries(item.metadata || {}).filter(([, v]) => v !== '' && v !== null);
  const revDetails = item.review_details || {};

  const related = getActiveMedia()
    .filter(m => m.id !== item.id && (m.genres || []).some(g => (item.genres || []).includes(g)))
    .slice(0, 3);

  body.innerHTML = `
    <div class="detail-layout">
      <div>
        ${item.cover_url
          ? `<img class="detail-cover" src="${esc(item.cover_url)}" alt="${esc(item.title)}">`
          : `<div class="media-cover-placeholder" style="aspect-ratio:2/3;border-radius:10px;border:1px solid var(--border)">No Cover</div>`
        }
      </div>
      <div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <span class="badge">${esc(item.category)}</span>
          <span class="${statusBadgeClass(item.status)}">${esc(item.status)}</span>
          ${item.release_year ? `<span class="badge">${esc(item.release_year)}</span>` : ''}
          ${item.is_favorite ? `<span class="badge badge-completed">★ Favorite</span>` : ''}
        </div>
        <h2 style="font-size:1.45rem;margin-bottom:4px">${esc(item.title)}</h2>
        ${item.alt_title ? `<div class="muted" style="font-size:0.88rem;margin-bottom:8px">${esc(item.alt_title)}</div>` : ''}
        <div style="margin-bottom:14px">${renderRating(item.rating)}</div>

        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <div class="detail-meta-label">Creator / Studio</div>
            <div class="detail-meta-val">${esc(item.creator || '—')}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Progress</div>
            <div class="detail-meta-val">${esc(item.progress_current || 0)}${item.progress_total ? ' / ' + esc(item.progress_total) : ''} ${esc(item.progress_unit || '')}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Start Date</div>
            <div class="detail-meta-val">${formatDate(item.start_date)}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Completion Date</div>
            <div class="detail-meta-val">${formatDate(item.finish_date)}</div>
          </div>
          ${metaEntries.map(([k, v]) => `
            <div class="detail-meta-item">
              <div class="detail-meta-label">${esc(k.replace(/_/g, ' ').toUpperCase())}</div>
              <div class="detail-meta-val">${esc(v)}</div>
            </div>
          `).join('')}
        </div>

        ${genres ? `<div style="margin-bottom:10px"><div class="detail-meta-label" style="margin-bottom:4px">Genres</div><div class="tag-list">${genres}</div></div>` : ''}
        ${tags ? `<div style="margin-bottom:14px"><div class="detail-meta-label" style="margin-bottom:4px">Tags</div><div class="tag-list">${tags}</div></div>` : ''}

        ${item.synopsis ? `
          <div style="margin-bottom:14px">
            <div class="detail-meta-label" style="margin-bottom:4px">Synopsis</div>
            <p style="font-size:0.88rem;color:var(--soft-ivory);white-space:pre-line">${esc(item.synopsis)}</p>
          </div>
        ` : ''}

        ${(revDetails.pros || revDetails.cons || item.review) ? `
          <div style="margin-bottom:14px;background:var(--carbon-surface);padding:12px;border-radius:8px;border:1px solid var(--border)">
            <div class="detail-meta-label" style="margin-bottom:6px">Personal Review &amp; Notes</div>
            ${revDetails.pros ? `<p style="font-size:0.84rem;color:#86efac;margin-bottom:4px"><strong>+ Pros:</strong> ${esc(revDetails.pros)}</p>` : ''}
            ${revDetails.cons ? `<p style="font-size:0.84rem;color:#fca5a5;margin-bottom:6px"><strong>− Cons:</strong> ${esc(revDetails.cons)}</p>` : ''}
            ${item.review ? `<p style="font-size:0.88rem;color:var(--pure-chalk);white-space:pre-line">${esc(item.review)}</p>` : ''}
          </div>
        ` : ''}

        ${related.length ? `
          <div style="margin-bottom:14px">
            <div class="detail-meta-label" style="margin-bottom:6px">Related in Library</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${related.map(r => `<button class="btn-secondary btn-sm" onclick="openMediaDetail('${r.id}')">${esc(r.title)}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        ${item.external_url ? `<a href="${esc(item.external_url)}" target="_blank" rel="noopener" class="btn-secondary btn-sm" style="display:inline-flex;margin-bottom:14px">Open External Link ↗</a>` : ''}

        <div class="admin-only" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <button class="btn-primary btn-sm" onclick="closeModal('modal-media-detail'); openMediaForm('${item.id}')">Edit Entry</button>
          <button class="btn-secondary btn-sm" onclick="toggleArchiveMedia('${item.id}', true)">Archive</button>
          <button class="btn-danger btn-sm" onclick="softDeleteMedia('${item.id}')">Move to Bin</button>
        </div>
      </div>
    </div>
  `;

  openModal('modal-media-detail');
};

window.openMediaForm = function (id = null) {
  const form = document.getElementById('form-media');
  form.reset();
  state.pendingCoverFile = null;
  document.getElementById('media-id').value = '';
  document.getElementById('media-cover-preview').innerHTML = '';
  document.getElementById('modal-media-title').textContent = id ? 'Edit Media Entry' : 'Add Media Entry';

  let currentCat = state.currentMediaCat !== 'All' ? state.currentMediaCat : 'Movies';
  document.getElementById('media-category').value = currentCat;
  let existingMeta = {};

  if (id) {
    const item = state.media.find(m => m.id === id);
    if (item) {
      currentCat = normalizeCategory(item.category);
      existingMeta = item.metadata || {};
      const revDetails = item.review_details || {};

      document.getElementById('media-id').value = item.id;
      document.getElementById('media-title').value = item.title || '';
      document.getElementById('media-alt-title').value = item.alt_title || '';
      document.getElementById('media-category').value = currentCat;
      document.getElementById('media-status').value = normalizeStatus(item.status);
      document.getElementById('media-rating').value = item.rating ?? '';
      document.getElementById('media-progress-current').value = item.progress_current || 0;
      document.getElementById('media-progress-total').value = item.progress_total || '';
      document.getElementById('media-progress-unit').value = item.progress_unit || '';
      document.getElementById('media-creator').value = item.creator || '';
      document.getElementById('media-year').value = item.release_year || '';
      document.getElementById('media-genres').value = (item.genres || []).join(', ');
      document.getElementById('media-tags').value = (item.tags || []).join(', ');
      document.getElementById('media-start-date').value = item.start_date || '';
      document.getElementById('media-finish-date').value = item.finish_date || '';
      document.getElementById('media-cover-url').value = item.cover_url || '';
      document.getElementById('media-external-url').value = item.external_url || '';
      document.getElementById('media-favorite').checked = !!item.is_favorite;
      document.getElementById('media-synopsis').value = item.synopsis || '';
      document.getElementById('media-pros').value = revDetails.pros || '';
      document.getElementById('media-cons').value = revDetails.cons || '';
      document.getElementById('media-review').value = item.review || '';

      if (item.cover_url) {
        document.getElementById('media-cover-preview').innerHTML =
          `<img src="${esc(item.cover_url)}" style="width:70px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`;
      }
    }
  }

  renderDynamicMediaFields(currentCat, existingMeta);
  openModal('modal-media');
};

window.toggleArchiveMedia = async function (id, archiveState) {
  const item = state.media.find(m => m.id === id);
  const { error } = await db.from('media_items').update({ is_archived: archiveState }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  closeModal('modal-media-detail');
  await logActivity(archiveState ? 'Archived' : 'Restored', 'media', id, item?.title || 'Media');
  showToast(archiveState ? 'Moved to Archive' : 'Restored to Library', 'success');
  await loadAllData();
};

window.softDeleteMedia = async function (id) {
  if (!confirm('Move this media entry to the Recycle Bin?')) return;
  const item = state.media.find(m => m.id === id);
  const { error } = await db.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  closeModal('modal-media-detail');
  await logActivity('Deleted', 'media', id, item?.title || 'Media');
  showToast('Moved to Recycle Bin', 'info');
  await loadAllData();
};

// ==================== 8. NOTES & FEED ====================
function renderNotesFeed() {
  const feed = document.getElementById('notes-feed');
  let notes = getActiveNotes();

  if (state.noteCat !== 'All') {
    notes = notes.filter(n => n.category === state.noteCat);
  }
  if (state.noteFolder !== 'All') {
    notes = notes.filter(n => (n.folder || 'General') === state.noteFolder);
  }
  if (state.noteSearch.trim()) {
    const q = state.noteSearch.toLowerCase();
    notes = notes.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (!notes.length) {
    feed.innerHTML = `<div class="empty-state">No notes found matching your current filter.</div>`;
    return;
  }

  feed.innerHTML = notes.map(note => {
    const imgs = note.image_urls || [];
    let galleryHtml = '';
    if (imgs.length === 1) {
      galleryHtml = `
        <div class="note-gallery single">
          <img src="${esc(imgs[0])}" alt="" loading="lazy" onclick="openImageLightbox('${esc(imgs[0])}')">
        </div>
      `;
    } else if (imgs.length > 1) {
      galleryHtml = `
        <div class="note-carousel-wrap" id="carousel-${note.id}">
          <div class="note-carousel-track">
            ${imgs.map(url => `<img src="${esc(url)}" alt="" loading="lazy" onclick="openImageLightbox('${esc(url)}')">`).join('')}
          </div>
          <button class="carousel-btn prev" onclick="scrollCarousel('${note.id}', -1)">‹</button>
          <button class="carousel-btn next" onclick="scrollCarousel('${note.id}', 1)">›</button>
        </div>
      `;
    }

    let backlinksHtml = '';
    if (note.title) {
      const needle = `[[${note.title.toLowerCase()}]]`;
      const linkingNotes = getActiveNotes().filter(other =>
        other.id !== note.id && (other.content || '').toLowerCase().includes(needle)
      );
      if (linkingNotes.length) {
        backlinksHtml = `
          <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);font-size:0.78rem;color:var(--silver-dust)">
            Linked from: ${linkingNotes.map(ln => `<a class="note-link" data-note-title="${esc(ln.title)}">${esc(ln.title)}</a>`).join(', ')}
          </div>
        `;
      }
    }

    const tagsHtml = (note.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('');

    return `
      <article class="note-card ${note.is_pinned ? 'pinned' : ''}">
        <div class="note-header">
          <div class="note-meta">
            ${note.is_pinned ? `<span class="badge badge-completed">Pinned</span>` : ''}
            <span class="badge">${esc(note.category)}</span>
            <span class="badge">${esc(note.folder || 'General')}</span>
            <span>${formatDate(note.created_at)}</span>
          </div>
          <div class="admin-only" style="display:flex;gap:6px">
            <button class="btn-ghost btn-sm" onclick="togglePinNote('${note.id}', ${!note.is_pinned})">${note.is_pinned ? 'Unpin' : 'Pin'}</button>
            <button class="btn-ghost btn-sm" onclick="openNoteForm('${note.id}')">Edit</button>
            <button class="btn-ghost btn-sm" onclick="archiveNote('${note.id}')">Archive</button>
            <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="softDeleteNote('${note.id}')">Bin</button>
          </div>
        </div>
        ${note.title ? `<h3 class="note-title">${esc(note.title)}</h3>` : ''}
        <div class="note-content">${parseNoteLinks(note.content || '')}</div>
        ${galleryHtml}
        ${tagsHtml ? `<div class="tag-list" style="margin-top:12px">${tagsHtml}</div>` : ''}
        ${backlinksHtml}
      </article>
    `;
  }).join('');

  feed.querySelectorAll('.note-link').forEach(link => {
    link.addEventListener('click', () => {
      const targetTitle = link.dataset.noteTitle;
      document.getElementById('note-search').value = targetTitle;
      state.noteSearch = targetTitle;
      renderNotesFeed();
    });
  });
}

window.scrollCarousel = function (noteId, dir) {
  const wrap = document.getElementById(`carousel-${noteId}`);
  if (!wrap) return;
  const track = wrap.querySelector('.note-carousel-track');
  track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
};

window.openImageLightbox = function (url) {
  document.getElementById('lightbox-img').src = url;
  openModal('modal-lightbox');
};

window.togglePinNote = async function (id, newState) {
  const { error } = await db.from('notes').update({ is_pinned: newState }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.archiveNote = async function (id) {
  const { error } = await db.from('notes').update({ is_archived: true }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Note moved to Archive', 'success');
  await loadAllData();
};

window.softDeleteNote = async function (id) {
  if (!confirm('Move this note to Recycle Bin?')) return;
  const { error } = await db.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Note moved to Recycle Bin', 'info');
  await loadAllData();
};

window.openNoteForm = function (id = null) {
  const form = document.getElementById('form-note');
  form.reset();
  state.pendingNoteFiles = [];
  state.existingNoteImages = [];
  document.getElementById('note-id').value = '';
  document.getElementById('note-images-preview').innerHTML = '';
  document.getElementById('modal-note-title').textContent = id ? 'Edit Note' : 'New Note';

  if (id) {
    const note = state.notes.find(n => n.id === id);
    if (note) {
      document.getElementById('note-id').value = note.id;
      document.getElementById('note-title').value = note.title || '';
      document.getElementById('note-category').value = note.category || 'Thoughts';
      document.getElementById('note-folder').value = note.folder || 'General';
      document.getElementById('note-pinned').checked = !!note.is_pinned;
      document.getElementById('note-content').value = note.content || '';
      document.getElementById('note-tags').value = (note.tags || []).join(', ');
      state.existingNoteImages = [...(note.image_urls || [])];
      renderNoteImagePreviews();
    }
  } else {
    const draft = localStorage.getItem('archive_note_draft');
    if (draft) document.getElementById('note-content').value = draft;
  }
  openModal('modal-note');
};

function renderNoteImagePreviews() {
  const box = document.getElementById('note-images-preview');
  const existingHtml = state.existingNoteImages.map((url, idx) => `
    <div style="position:relative;display:inline-block">
      <img src="${esc(url)}" style="width:68px;height:68px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
      <button type="button" onclick="removeExistingNoteImage(${idx})" style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;width:18px;height:18px;border-radius:50%;font-size:11px">✕</button>
    </div>
  `).join('');

  const pendingHtml = state.pendingNoteFiles.map((file, idx) => `
    <div style="position:relative;display:inline-block">
      <img src="${URL.createObjectURL(file)}" style="width:68px;height:68px;object-fit:cover;border-radius:6px;border:1px solid var(--silver-dust)">
      <button type="button" onclick="removePendingNoteImage(${idx})" style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;width:18px;height:18px;border-radius:50%;font-size:11px">✕</button>
    </div>
  `).join('');

  box.innerHTML = existingHtml + pendingHtml;
}

window.removeExistingNoteImage = function (idx) {
  state.existingNoteImages.splice(idx, 1);
  renderNoteImagePreviews();
};

window.removePendingNoteImage = function (idx) {
  state.pendingNoteFiles.splice(idx, 1);
  renderNoteImagePreviews();
};

// ==================== 9. COLLECTIONS ====================
function renderCollections() {
  const grid = document.getElementById('collections-grid');
  if (!state.collections.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No curated collections yet.</div>`;
    return;
  }

  grid.innerHTML = state.collections.map(col => {
    const ids = col.media_ids || [];
    const members = ids.map(mid => state.media.find(m => m.id === mid)).filter(Boolean);
    const thumbs = members.slice(0, 4).map(m =>
      m.cover_url
        ? `<img class="col-thumb" src="${esc(m.cover_url)}" alt="${esc(m.title)}" title="${esc(m.title)}">`
        : `<div class="col-thumb" style="display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:var(--ash-grey);text-align:center;padding:2px">${esc(m.title)}</div>`
    ).join('');

    return `
      <div class="collection-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <h3>${esc(col.title)}</h3>
            <p class="muted" style="font-size:0.84rem;margin-top:4px">${esc(col.description || '')}</p>
          </div>
          <span class="badge">${members.length} items</span>
        </div>
        <div class="collection-thumbs">${thumbs || '<span class="muted" style="font-size:0.8rem">Empty list</span>'}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
          <button class="btn-secondary btn-sm" onclick="viewCollectionItems('${col.id}')">View List</button>
          <div class="admin-only" style="display:flex;gap:6px">
            <button class="btn-ghost btn-sm" onclick="openCollectionForm('${col.id}')">Edit</button>
            <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteCollection('${col.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.viewCollectionItems = function (colId) {
  const col = state.collections.find(c => c.id === colId);
  if (!col) return;
  const members = (col.media_ids || []).map(id => state.media.find(m => m.id === id)).filter(Boolean);
  const body = document.getElementById('media-detail-body');
  body.innerHTML = `
    <h2 style="margin-bottom:4px">${esc(col.title)}</h2>
    <p class="muted" style="margin-bottom:16px">${esc(col.description || '')}</p>
    <div class="mini-grid">
      ${members.length ? members.map(m => `
        <div class="mini-media-card" onclick="closeModal('modal-media-detail'); openMediaDetail('${m.id}')">
          <img class="mini-cover" src="${esc(m.cover_url || '')}" alt="" onerror="this.style.display='none'">
          <div class="mini-info">
            <div class="mini-title">${esc(m.title)}</div>
            <div class="mini-meta">${esc(m.category)} • ${esc(m.status)}</div>
            <div>${renderRating(m.rating)}</div>
          </div>
        </div>
      `).join('') : '<div class="empty-state">No media items in this collection.</div>'}
    </div>
  `;
  openModal('modal-media-detail');
};

window.openCollectionForm = function (id = null) {
  document.getElementById('form-collection').reset();
  document.getElementById('collection-id').value = '';
  document.getElementById('modal-collection-title').textContent = id ? 'Edit Collection' : 'New Collection';

  let selectedIds = [];
  if (id) {
    const col = state.collections.find(c => c.id === id);
    if (col) {
      document.getElementById('collection-id').value = col.id;
      document.getElementById('collection-title').value = col.title || '';
      document.getElementById('collection-desc').value = col.description || '';
      selectedIds = col.media_ids || [];
    }
  }

  const picker = document.getElementById('collection-media-picker');
  picker.innerHTML = getActiveMedia().map(m => `
    <label class="picker-item">
      <input type="checkbox" value="${m.id}" ${selectedIds.includes(m.id) ? 'checked' : ''}>
      <span>${esc(m.title)} <span class="muted">(${esc(m.category)})</span></span>
    </label>
  `).join('') || '<div class="muted" style="padding:8px">Add some media items first.</div>';

  openModal('modal-collection');
};

window.deleteCollection = async function (id) {
  if (!confirm('Delete this collection?')) return;
  const { error } = await db.from('collections').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Collection deleted', 'success');
  await loadAllData();
};

// ==================== 10. PERSONAL WORKSPACE ====================
function renderWorkspace() {
  renderTasks();
  renderJournalCalendar();
  renderJournalDetail();
  renderGoals();
  renderProjects();
  renderBookmarks();
}

function renderTasks() {
  const list = document.getElementById('tasks-list');
  let items = [...state.tasks];
  if (state.taskFilter === 'Pending') items = items.filter(t => !t.is_completed);
  if (state.taskFilter === 'Completed') items = items.filter(t => t.is_completed);

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">No tasks in this view.</div>`;
    return;
  }

  list.innerHTML = items.map(t => `
    <div class="task-row ${t.is_completed ? 'done' : ''}">
      <input type="checkbox" class="task-check" ${t.is_completed ? 'checked' : ''} ${state.isAdmin ? '' : 'disabled'} onchange="toggleTask('${t.id}', this.checked)">
      <div class="task-text">${esc(t.title)}</div>
      ${t.category ? `<span class="badge">${esc(t.category)}</span>` : ''}
      <span class="badge">${esc(t.priority || 'Medium')}</span>
      ${t.due_date ? `<span class="muted" style="font-size:0.76rem">${formatDate(t.due_date)}</span>` : ''}
      <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteTask('${t.id}')">✕</button>
    </div>
  `).join('');
}

window.toggleTask = async function (id, done) {
  const t = state.tasks.find(x => x.id === id);
  const { error } = await db.from('tasks').update({
    is_completed: done,
    completed_at: done ? new Date().toISOString() : null
  }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  if (done && t) await logActivity('Completed', 'task', id, t.title);
  await loadAllData();
};

window.deleteTask = async function (id) {
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

function renderJournalCalendar() {
  const dt = state.journalMonth;
  const year = dt.getFullYear();
  const month = dt.getMonth();
  document.getElementById('cal-month-label').textContent =
    dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryDates = new Set(state.journal.map(j => j.entry_date));

  const grid = document.getElementById('journal-calendar-grid');
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += `<div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasEntry = entryDates.has(dateStr) ? 'has-entry' : '';
    const active = state.selectedJournalDate === dateStr ? 'active' : '';
    html += `<div class="cal-cell ${hasEntry} ${active}" onclick="selectJournalDate('${dateStr}')">${d}</div>`;
  }
  grid.innerHTML = html;
}

window.selectJournalDate = function (dateStr) {
  state.selectedJournalDate = dateStr;
  renderJournalCalendar();
  renderJournalDetail();
};

function renderJournalDetail() {
  const container = document.getElementById('journal-entry-detail');
  const entry = state.journal.find(j => j.entry_date === state.selectedJournalDate);

  if (!entry) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No journal entry recorded for <strong>${esc(state.selectedJournalDate)}</strong>.</p>
        <button class="btn-primary btn-sm admin-only" style="margin-top:12px" onclick="openJournalForm('${esc(state.selectedJournalDate)}')">Write Entry for This Date</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge">${esc(entry.entry_date)}</span>
        <span class="badge">${esc(entry.entry_type || 'Daily')}</span>
        ${entry.mood ? `<span class="badge badge-completed">Mood: ${esc(entry.mood)}</span>` : ''}
      </div>
      <div class="admin-only" style="display:flex;gap:6px">
        <button class="btn-ghost btn-sm" onclick="openJournalForm('${esc(entry.entry_date)}')">Edit</button>
        <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteJournal('${entry.id}')">Delete</button>
      </div>
    </div>
    <h3 style="margin-bottom:10px">${esc(entry.title || 'Journal Log')}</h3>
    <div style="white-space:pre-line;color:var(--soft-ivory);font-size:0.92rem;line-height:1.7">${esc(entry.content)}</div>
    ${(entry.tags || []).length ? `<div class="tag-list" style="margin-top:12px">${entry.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
  `;
}

window.openJournalForm = function (dateStr = null) {
  document.getElementById('form-journal').reset();
  const targetDate = dateStr || state.selectedJournalDate || toLocalDateStr(new Date());
  document.getElementById('journal-date').value = targetDate;

  const existing = state.journal.find(j => j.entry_date === targetDate);
  if (existing) {
    document.getElementById('journal-id').value = existing.id;
    document.getElementById('journal-type').value = existing.entry_type || 'Daily';
    document.getElementById('journal-mood').value = existing.mood || '';
    document.getElementById('journal-tags').value = (existing.tags || []).join(', ');
    document.getElementById('journal-title').value = existing.title || '';
    document.getElementById('journal-content').value = existing.content || '';
  } else {
    document.getElementById('journal-id').value = '';
  }
  openModal('modal-journal');
};

window.deleteJournal = async function (id) {
  if (!confirm('Delete this journal entry?')) return;
  const { error } = await db.from('journal_entries').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Journal entry deleted', 'success');
  await loadAllData();
};

function renderGoals() {
  const grid = document.getElementById('goals-grid');
  if (!state.goals.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No goals tracked yet.</div>`;
    return;
  }
  grid.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.max(0, Number(g.progress_percent) || 0));
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="badge">${esc(g.category || 'Personal')}</span>
          <span class="muted" style="font-size:0.78rem">${g.target_date ? 'Target: ' + formatDate(g.target_date) : ''}</span>
        </div>
        <h3 style="margin-bottom:6px">${esc(g.title)}</h3>
        <p class="muted" style="font-size:0.84rem;margin-bottom:12px">${esc(g.description || '')}</p>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
          <span>Progress</span>
          <strong>${pct}%</strong>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="admin-only" style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-secondary btn-sm" onclick="updateGoalProgress('${g.id}', ${pct})">Update %</button>
          <button class="btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteGoal('${g.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

window.updateGoalProgress = async function (id, current) {
  const val = prompt('Enter new progress percentage (0 - 100):', current);
  if (val === null) return;
  const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
  const { error } = await db.from('goals').update({
    progress_percent: num,
    status: num >= 100 ? 'Completed' : 'In Progress'
  }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.deleteGoal = async function (id) {
  if (!confirm('Delete this goal?')) return;
  const { error } = await db.from('goals').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No active or archived projects yet.</div>`;
    return;
  }
  grid.innerHTML = state.projects.map(p => {
    const pct = Math.min(100, Math.max(0, Number(p.progress_percent) || 0));
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="${statusBadgeClass(p.status)}">${esc(p.status)}</span>
          <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteProject('${p.id}')">✕</button>
        </div>
        <h3 style="margin-bottom:6px">${esc(p.title)}</h3>
        <p class="muted" style="font-size:0.85rem;margin-bottom:10px">${esc(p.description || '')}</p>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
          <span class="muted">${p.deadline ? 'Due: ' + formatDate(p.deadline) : 'No deadline'}</span>
          <strong>${pct}%</strong>
        </div>
        <div class="progress-bar-bg" style="margin-bottom:10px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="tag-list" style="margin-bottom:12px">
          ${(p.tech_stack || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener" class="btn-secondary btn-sm">Repository ↗</a>` : ''}
          ${p.live_url ? `<a href="${esc(p.live_url)}" target="_blank" rel="noopener" class="btn-secondary btn-sm">Live Demo ↗</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.deleteProject = async function (id) {
  if (!confirm('Delete this project?')) return;
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

function renderBookmarks(filterQuery = '') {
  const list = document.getElementById('bookmarks-list');
  let items = [...state.bookmarks];
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    items = items.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">No bookmarks saved yet.</div>`;
    return;
  }
  list.innerHTML = items.map(b => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span class="badge">${esc(b.category || 'Resource')}</span>
          <a href="${esc(b.url)}" target="_blank" rel="noopener" style="font-weight:600;color:var(--pure-chalk)">${esc(b.title)} ↗</a>
        </div>
        ${b.description ? `<p class="muted" style="font-size:0.84rem">${esc(b.description)}</p>` : ''}
        ${(b.tags || []).length ? `<div class="tag-list">${b.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteBookmark('${b.id}')">Delete</button>
    </div>
  `).join('');
}

window.deleteBookmark = async function (id) {
  const { error } = await db.from('bookmarks').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

// ==================== 11. KNOWLEDGE BASE & GRAPH ====================
function renderKnowledgeBase() {
  const qGrid = document.getElementById('quotes-grid');
  if (!state.quotes.length) {
    qGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No quotes archived yet.</div>`;
  } else {
    qGrid.innerHTML = state.quotes.map(q => `
      <div class="quote-card">
        <div>
          <div class="quote-text">“${esc(q.quote_text)}”</div>
          ${q.interpretation ? `<p class="muted" style="font-size:0.8rem;margin-top:8px">${esc(q.interpretation)}</p>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="quote-author">— ${esc(q.author || 'Unknown')}${q.source ? ` (${esc(q.source)})` : ''}</div>
          <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteQuote('${q.id}')">✕</button>
        </div>
      </div>
    `).join('');
  }

  const vList = document.getElementById('vocabulary-list');
  if (!state.vocabulary.length) {
    vList.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No vocabulary terms saved yet.</div>`;
  } else {
    vList.innerHTML = state.vocabulary.map(v => `
      <div class="vocab-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="vocab-word">${esc(v.word)}</span>
            ${v.reading ? `<span class="vocab-reading">(${esc(v.reading)})</span>` : ''}
            <span class="badge" style="margin-left:8px">${esc(v.language || 'English')}</span>
          </div>
          <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteVocab('${v.id}')">✕</button>
        </div>
        <div style="margin-top:8px;color:var(--soft-ivory);font-size:0.9rem">${esc(v.meaning)}</div>
        ${v.example_sentence ? `<div class="muted" style="font-size:0.82rem;margin-top:6px;font-style:italic">"${esc(v.example_sentence)}"</div>` : ''}
      </div>
    `).join('');
  }

  const cGrid = document.getElementById('concepts-grid');
  if (!state.concepts.length) {
    cGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No concept notes yet.</div>`;
  } else {
    cGrid.innerHTML = state.concepts.map(c => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="badge">${esc(c.domain || 'General')}</span>
          <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteConcept('${c.id}')">✕</button>
        </div>
        <h3 style="margin-bottom:8px">${esc(c.title)}</h3>
        <div style="font-size:0.88rem;color:var(--soft-ivory);white-space:pre-line">${parseNoteLinks(c.summary)}</div>
        ${c.interpretation ? `<p class="muted" style="font-size:0.8rem;margin-top:8px">${esc(c.interpretation)}</p>` : ''}
      </div>
    `).join('');
  }

  const lGrid = document.getElementById('learning-grid');
  if (lGrid) {
    if (!state.learningNotes.length) {
      lGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No learning notes recorded yet.</div>`;
    } else {
      lGrid.innerHTML = state.learningNotes.map(l => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="badge">${esc(l.subject)}</span>
            <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteLearningNote('${l.id}')">✕</button>
          </div>
          <h3 style="margin-bottom:6px">${esc(l.topic)}</h3>
          <p style="font-size:0.88rem;color:var(--soft-ivory);white-space:pre-line">${esc(l.content)}</p>
          ${l.reference_url ? `<a href="${esc(l.reference_url)}" target="_blank" rel="noopener" class="btn-secondary btn-sm" style="display:inline-flex;margin-top:10px">Source ↗</a>` : ''}
        </div>
      `).join('');
    }
  }

  const rList = document.getElementById('references-list');
  if (rList) {
    if (!state.references.length) {
      rList.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No references archived yet.</div>`;
    } else {
      rList.innerHTML = state.references.map(r => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span class="badge">${esc(r.ref_type || 'Article')}</span>
              <strong>${esc(r.title)}</strong>
              ${r.author ? `<span class="muted">by ${esc(r.author)}</span>` : ''}
            </div>
            ${r.notes ? `<p class="muted" style="font-size:0.84rem">${esc(r.notes)}</p>` : ''}
            ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="font-size:0.8rem">Open Link ↗</a>` : ''}
          </div>
          <button class="btn-ghost btn-sm admin-only" style="color:var(--danger)" onclick="deleteReference('${r.id}')">✕</button>
        </div>
      `).join('');
    }
  }
}

window.deleteQuote = async function (id) {
  const { error } = await db.from('quotes').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.deleteVocab = async function (id) {
  const { error } = await db.from('vocabulary').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.deleteConcept = async function (id) {
  const { error } = await db.from('concepts').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.deleteLearningNote = async function (id) {
  const { error } = await db.from('learning_notes').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

window.deleteReference = async function (id) {
  const { error } = await db.from('references_lib').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  await loadAllData();
};

function renderKnowledgeGraph() {
  const canvas = document.getElementById('knowledge-graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const nodes = [];
  state.concepts.forEach(c => nodes.push({ id: `c-${c.id}`, title: c.title, text: c.summary || '', type: 'Concept' }));
  getActiveNotes().filter(n => n.title).slice(0, 20).forEach(n =>
    nodes.push({ id: `n-${n.id}`, title: n.title, text: n.content || '', type: 'Note' })
  );

  if (!nodes.length) {
    ctx.fillStyle = '#71717a';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add titled Notes or Concepts with [[Wiki Links]] to populate the graph.', w / 2, h / 2);
    return;
  }

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.36;
  nodes.forEach((node, idx) => {
    const angle = (idx / nodes.length) * Math.PI * 2;
    node.x = cx + Math.cos(angle) * radius;
    node.y = cy + Math.sin(angle) * radius;
  });

  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.2;
  nodes.forEach(src => {
    const lowerText = src.text.toLowerCase();
    nodes.forEach(dst => {
      if (src.id !== dst.id && dst.title && lowerText.includes(`[[${dst.title.toLowerCase()}]]`)) {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(dst.x, dst.y);
        ctx.stroke();
      }
    });
  });

  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.type === 'Concept' ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = node.type === 'Concept' ? '#fafafa' : '#a1a1aa';
    ctx.fill();

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.title.slice(0, 22), node.x, node.y - 11);
  });
}

// ==================== 12. STATISTICS & ANALYTICS ====================
function renderStatistics() {
  let mediaPool = getActiveMedia();
  if (state.statsCategoryFilter !== 'All') {
    mediaPool = mediaPool.filter(m => m.category === state.statsCategoryFilter);
  }

  const total = mediaPool.length;
  const completed = mediaPool.filter(m => m.status === 'Completed').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const ratedItems = mediaPool.filter(m => Number(m.rating) > 0);
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((acc, m) => acc + Number(m.rating), 0) / ratedItems.length).toFixed(2)
    : '0.0';

  const totalChapters = mediaPool
    .filter(m => ['Manga', 'Manhwa', 'Manhua', 'Comics', 'Books'].includes(m.category))
    .reduce((acc, m) => acc + (Number(m.progress_current) || 0), 0);

  const totalEpisodes = mediaPool
    .filter(m => ['Anime', 'TV Shows', 'Movies'].includes(m.category))
    .reduce((acc, m) => acc + (Number(m.progress_current) || 0), 0);

  document.getElementById('stat-completion-rate').textContent = `${completionRate}%`;
  document.getElementById('stat-avg-rating').textContent = avgRating;
  document.getElementById('stat-total-chapters').textContent = totalChapters.toLocaleString();
  document.getElementById('stat-total-episodes').textContent = totalEpisodes.toLocaleString();

  document.getElementById('stat-total-journal').textContent = state.journal.length;
  document.getElementById('stat-tasks-done').textContent = state.tasks.filter(t => t.is_completed).length;
  document.getElementById('stat-goals-done').textContent = state.goals.filter(g => g.progress_percent >= 100).length;
  document.getElementById('stat-projects-active').textContent = state.projects.filter(p => p.status === 'Active').length;

  renderCharts(mediaPool);
}

function renderCharts(mediaPool = getActiveMedia()) {
  if (!window.Chart) return;

  const palette = [
    '#fafafa', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b',
    '#3f3f46', '#e4e4e7', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937'
  ];

  const catCounts = MEDIA_CATEGORIES.map(c => getActiveMedia().filter(m => m.category === c).length);
  if (state.charts.cat) state.charts.cat.destroy();
  const ctxCat = document.getElementById('chart-categories');
  if (ctxCat) {
    state.charts.cat = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: MEDIA_CATEGORIES,
        datasets: [{
          data: catCounts,
          backgroundColor: palette,
          borderColor: '#121214',
          borderWidth: 2
        }]
      },
      options: {
        plugins: {
          legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 11 } } }
        }
      }
    });
  }

  const statuses = ['In Progress', 'Completed', 'Planning', 'On Hold', 'Dropped'];
  const statusCounts = statuses.map(s => mediaPool.filter(m => m.status === s).length);
  if (state.charts.status) state.charts.status.destroy();
  const ctxStatus = document.getElementById('chart-status');
  if (ctxStatus) {
    state.charts.status = new Chart(ctxStatus, {
      type: 'bar',
      data: {
        labels: statuses,
        datasets: [{
          label: 'Entries',
          data: statusCounts,
          backgroundColor: '#e4e4e7',
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { display: false } },
          y: { ticks: { color: '#a1a1aa', precision: 0 }, grid: { color: '#27272a' } }
        }
      }
    });
  }

  const ratingLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const ratingBuckets = ratingLabels.map((_, idx) =>
    mediaPool.filter(m => Math.round(Number(m.rating)) === idx + 1).length
  );
  if (state.charts.rating) state.charts.rating.destroy();
  const ctxRating = document.getElementById('chart-ratings');
  if (ctxRating) {
    state.charts.rating = new Chart(ctxRating, {
      type: 'bar',
      data: {
        labels: ratingLabels,
        datasets: [{
          label: 'Count',
          data: ratingBuckets,
          backgroundColor: '#a1a1aa',
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { display: false } },
          y: { ticks: { color: '#a1a1aa', precision: 0 }, grid: { color: '#27272a' } }
        }
      }
    });
  }

  const genreMap = {};
  mediaPool.forEach(m => {
    (m.genres || []).forEach(g => {
      genreMap[g] = (genreMap[g] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (state.charts.genre) state.charts.genre.destroy();
  const ctxGenre = document.getElementById('chart-genres');
  if (ctxGenre) {
    state.charts.genre = new Chart(ctxGenre, {
      type: 'bar',
      data: {
        labels: topGenres.map(g => g[0]),
        datasets: [{
          label: 'Titles',
          data: topGenres.map(g => g[1]),
          backgroundColor: '#d4d4d8',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa', precision: 0 }, grid: { color: '#27272a' } },
          y: { ticks: { color: '#a1a1aa' }, grid: { display: false } }
        }
      }
    });
  }
}

// ==================== 13. ACTIVITY TIMELINE & ARCHIVE ====================
function buildTimelineEntries() {
  const entries = [];
  state.activityLogs.forEach(log => {
    entries.push({
      type: log.entity_type,
      date: log.created_at,
      plain: `${log.action_type} ${log.entity_title}`,
      html: `<span class="badge" style="margin-right:6px">${esc(log.action_type)}</span><strong>${esc(log.entity_title)}</strong> <span class="muted">(${esc(log.entity_type)})</span>`
    });
  });

  state.media.slice(0, 20).forEach(m => {
    entries.push({
      type: 'media',
      date: m.updated_at || m.created_at,
      plain: `${m.title} ${m.category} ${m.status}`,
      html: `Updated <strong>${esc(m.title)}</strong> <span class="muted">(${esc(m.category)} — ${esc(m.status)})</span>`
    });
  });
  state.notes.slice(0, 15).forEach(n => {
    entries.push({
      type: 'note',
      date: n.created_at,
      plain: `${n.title || 'Note'} ${n.category}`,
      html: `Published note <strong>${esc(n.title || 'Untitled Note')}</strong> <span class="muted">[${esc(n.category)}]</span>`
    });
  });
  state.journal.slice(0, 10).forEach(j => {
    entries.push({
      type: 'journal',
      date: j.created_at || j.entry_date,
      plain: `${j.title || 'Journal'} ${j.entry_date}`,
      html: `Logged journal entry <strong>${esc(j.title || j.entry_date)}</strong>`
    });
  });

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  return entries;
}

function renderTimeline() {
  const container = document.getElementById('full-timeline-list');
  if (!container) return;
  let items = buildTimelineEntries();

  if (state.timelineFilter !== 'All') {
    items = items.filter(i => i.type === state.timelineFilter);
  }
  if (state.timelineSearch.trim()) {
    const q = state.timelineSearch.toLowerCase();
    items = items.filter(i => i.plain.toLowerCase().includes(q));
  }

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No timeline events found.</div>`;
    return;
  }

  container.innerHTML = items.slice(0, 80).map(act => `
    <div class="activity-item">
      <span>${act.html}</span>
      <span class="activity-time">${formatDate(act.date)}</span>
    </div>
  `).join('');
}

function renderArchiveView() {
  const container = document.getElementById('archive-list-container');
  if (!container) return;

  if (state.archiveTab === 'archived') {
    const archMedia = state.media.filter(m => m.is_archived && !m.deleted_at);
    const archNotes = state.notes.filter(n => n.is_archived && !n.deleted_at);

    if (!archMedia.length && !archNotes.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No archived records yet.</div>`;
      return;
    }

    container.innerHTML = [
      ...archMedia.map(m => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="badge">${esc(m.category)}</span>
            <span class="badge">Archived</span>
          </div>
          <h3>${esc(m.title)}</h3>
          <p class="muted" style="font-size:0.82rem;margin:6px 0 12px">${esc(m.status)} • ${renderRating(m.rating)}</p>
          <button class="btn-secondary btn-sm admin-only" onclick="toggleArchiveMedia('${m.id}', false)">Restore to Library</button>
        </div>
      `),
      ...archNotes.map(n => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="badge">Note • ${esc(n.category)}</span>
            <span class="badge">Archived</span>
          </div>
          <h3>${esc(n.title || 'Untitled Note')}</h3>
          <p class="muted" style="font-size:0.82rem;margin:6px 0 12px">${esc((n.content || '').slice(0, 100))}...</p>
          <button class="btn-secondary btn-sm admin-only" onclick="restoreNote('${n.id}')">Restore to Feed</button>
        </div>
      `)
    ].join('');
  } else {
    const binMedia = state.media.filter(m => !!m.deleted_at);
    const binNotes = state.notes.filter(n => !!n.deleted_at);

    if (!binMedia.length && !binNotes.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Recycle Bin is empty.</div>`;
      return;
    }

    container.innerHTML = [
      ...binMedia.map(m => `
        <div class="card">
          <span class="badge badge-dropped">Deleted Media</span>
          <h3 style="margin-top:8px">${esc(m.title)}</h3>
          <div class="admin-only" style="display:flex;gap:8px;margin-top:12px">
            <button class="btn-secondary btn-sm" onclick="restoreDeletedMedia('${m.id}')">Restore</button>
            <button class="btn-danger btn-sm" onclick="permanentDeleteMedia('${m.id}')">Delete Forever</button>
          </div>
        </div>
      `),
      ...binNotes.map(n => `
        <div class="card">
          <span class="badge badge-dropped">Deleted Note</span>
          <h3 style="margin-top:8px">${esc(n.title || 'Untitled Note')}</h3>
          <div class="admin-only" style="display:flex;gap:8px;margin-top:12px">
            <button class="btn-secondary btn-sm" onclick="restoreNote('${n.id}')">Restore</button>
            <button class="btn-danger btn-sm" onclick="permanentDeleteNote('${n.id}')">Delete Forever</button>
          </div>
        </div>
      `)
    ].join('');
  }
}

window.restoreDeletedMedia = async function (id) {
  const { error } = await db.from('media_items').update({ deleted_at: null }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Media restored', 'success');
  await loadAllData();
};

window.permanentDeleteMedia = async function (id) {
  if (!confirm('Permanently delete this media record? This cannot be undone.')) return;
  const { error } = await db.from('media_items').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Permanently deleted', 'info');
  await loadAllData();
};

window.restoreNote = async function (id) {
  const { error } = await db.from('notes').update({ is_archived: false, deleted_at: null }).eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Note restored', 'success');
  await loadAllData();
};

window.permanentDeleteNote = async function (id) {
  if (!confirm('Permanently delete this note? This cannot be undone.')) return;
  const { error } = await db.from('notes').delete().eq('id', id);
  if (error) return showToast(error.message, 'error');
  showToast('Permanently deleted', 'info');
  await loadAllData();
};

// ==================== 14. GLOBAL SEARCH, EXPORT, & NAVIGATION ====================
function handleGlobalSearch(query) {
  const box = document.getElementById('global-search-results');
  const q = query.trim().toLowerCase();
  if (!q) {
    box.classList.add('hidden');
    return;
  }

  const results = [];
  getActiveMedia().forEach(m => {
    if ((m.title || '').toLowerCase().includes(q) || (m.creator || '').toLowerCase().includes(q)) {
      results.push({ type: m.category, title: m.title, action: () => openMediaDetail(m.id) });
    }
  });
  getActiveNotes().forEach(n => {
    if ((n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)) {
      results.push({ type: 'Note', title: n.title || n.content.slice(0, 40), action: () => switchView('notes') });
    }
  });
  state.quotes.forEach(qt => {
    if ((qt.quote_text || '').toLowerCase().includes(q) || (qt.author || '').toLowerCase().includes(q)) {
      results.push({ type: 'Quote', title: qt.quote_text.slice(0, 45) + '...', action: () => switchView('knowledge') });
    }
  });
  state.vocabulary.forEach(v => {
    if ((v.word || '').toLowerCase().includes(q) || (v.meaning || '').toLowerCase().includes(q)) {
      results.push({ type: 'Vocab', title: `${v.word} — ${v.meaning}`, action: () => switchView('knowledge') });
    }
  });
  state.tasks.forEach(t => {
    if ((t.title || '').toLowerCase().includes(q)) {
      results.push({ type: 'Task', title: t.title, action: () => switchView('workspace') });
    }
  });

  if (!results.length) {
    box.innerHTML = `<div class="search-result-item"><span class="muted">No matching records found</span></div>`;
  } else {
    box.innerHTML = results.slice(0, 12).map((r, i) => `
      <div class="search-result-item" data-idx="${i}">
        <span>${esc(r.title)}</span>
        <span class="badge">${esc(r.type)}</span>
      </div>
    `).join('');
    box.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        box.classList.add('hidden');
        results[i].action();
      });
    });
  }
  box.classList.remove('hidden');
}

function exportArchiveJSON() {
  const payload = {
    exported_at: new Date().toISOString(),
    media: state.media,
    notes: state.notes,
    collections: state.collections,
    tasks: state.tasks,
    journal: state.journal,
    goals: state.goals,
    projects: state.projects,
    bookmarks: state.bookmarks,
    quotes: state.quotes,
    vocabulary: state.vocabulary,
    concepts: state.concepts,
    learning_notes: state.learningNotes,
    references: state.references
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archive-backup-${toLocalDateStr(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Full JSON backup exported', 'success');
}

function exportMediaCSV() {
  const rows = [
    ['Title', 'Category', 'Status', 'Rating', 'Progress Current', 'Progress Total', 'Unit', 'Creator', 'Release Year', 'Genres']
  ];
  getActiveMedia().forEach(m => {
    rows.push([
      `"${(m.title || '').replace(/"/g, '""')}"`,
      `"${m.category || ''}"`,
      `"${m.status || ''}"`,
      m.rating ?? '',
      m.progress_current ?? 0,
      m.progress_total ?? '',
      `"${m.progress_unit || ''}"`,
      `"${(m.creator || '').replace(/"/g, '""')}"`,
      m.release_year ?? '',
      `"${(m.genres || []).join(', ')}"`
    ]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archive-media-${toLocalDateStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Media CSV exported', 'success');
}

window.switchView = function (viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.view').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  if (viewName === 'statistics') {
    renderStatistics();
  }
  document.getElementById('sidebar').classList.remove('open');
};

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('mobile-close-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  const sidebarEl = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  if (localStorage.getItem('archive_sidebar_collapsed') === 'true') {
    sidebarEl.classList.add('collapsed');
  }
  collapseBtn?.addEventListener('click', () => {
    sidebarEl.classList.toggle('collapsed');
    localStorage.setItem('archive_sidebar_collapsed', sidebarEl.classList.contains('collapsed'));
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  document.getElementById('btn-open-login').addEventListener('click', () => openModal('modal-login'));
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    closeModal('modal-login');
    showToast('Signed in as Admin', 'success');
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    showToast('Signed out to Public View', 'info');
  });

  const gSearch = document.getElementById('global-search');
  gSearch.addEventListener('input', (e) => handleGlobalSearch(e.target.value));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      gSearch.focus();
    }
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      openModal('modal-shortcuts');
    }
    if (e.key === 'Escape') {
      document.getElementById('global-search-results').classList.add('hidden');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }
  });

  document.getElementById('btn-quick-capture')?.addEventListener('click', () => openModal('modal-quick-capture'));
  document.getElementById('btn-notifications')?.addEventListener('click', () => openModal('modal-notifications'));
  document.getElementById('btn-shortcuts')?.addEventListener('click', () => openModal('modal-shortcuts'));
  document.getElementById('btn-export-json').addEventListener('click', exportArchiveJSON);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportMediaCSV);

  document.getElementById('btn-customize-dashboard')?.addEventListener('click', () => {
    const widgets = [
      { id: 'stats', label: 'Top Summary Counters' },
      { id: 'active-media', label: 'Currently In Progress' },
      { id: 'recent-activity', label: 'Recent Activity Feed' },
      { id: 'recent-completed', label: 'Recently Completed' },
      { id: 'upcoming-tasks', label: 'Upcoming Tasks & Goals' },
      { id: 'pinned-notes', label: 'Pinned & Recent Notes' }
    ];
    const list = document.getElementById('widget-toggles-list');
    list.innerHTML = widgets.map(w => `
      <label class="picker-item">
        <input type="checkbox" value="${w.id}" ${!state.hiddenWidgets.includes(w.id) ? 'checked' : ''}>
        <span>${w.label}</span>
      </label>
    `).join('');
    list.querySelectorAll('input').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          state.hiddenWidgets = state.hiddenWidgets.filter(x => x !== cb.value);
        } else if (!state.hiddenWidgets.includes(cb.value)) {
          state.hiddenWidgets.push(cb.value);
        }
        localStorage.setItem('archive_hidden_widgets', JSON.stringify(state.hiddenWidgets));
        applyDashboardWidgetVisibility();
      });
    });
    openModal('modal-dashboard-widgets');
  });

  document.getElementById('btn-add-media').addEventListener('click', () => openMediaForm());
  document.getElementById('media-category').addEventListener('change', (e) => {
    renderDynamicMediaFields(e.target.value, {});
  });
  document.getElementById('media-search').addEventListener('input', (e) => {
    state.mediaSearch = e.target.value;
    renderMediaLibrary();
  });
  document.getElementById('media-status-filter').addEventListener('change', (e) => {
    state.currentMediaStatus = e.target.value;
    renderMediaLibrary();
  });
  document.getElementById('media-genre-filter').addEventListener('change', (e) => {
    state.currentMediaGenre = e.target.value;
    renderMediaLibrary();
  });
  document.getElementById('media-rating-filter').addEventListener('change', (e) => {
    state.currentMediaRating = e.target.value;
    renderMediaLibrary();
  });
  document.getElementById('media-sort').addEventListener('change', (e) => {
    state.mediaSort = e.target.value;
    renderMediaLibrary();
  });
  document.getElementById('btn-media-fav-only').addEventListener('click', (e) => {
    state.mediaFavOnly = !state.mediaFavOnly;
    e.target.classList.toggle('btn-primary', state.mediaFavOnly);
    renderMediaLibrary();
  });
  document.querySelectorAll('#media-view-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#media-view-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mediaViewMode = btn.dataset.mode;
      renderMediaLibrary();
    });
  });

  document.getElementById('media-cover-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      state.pendingCoverFile = file;
      document.getElementById('media-cover-preview').innerHTML =
        `<img src="${URL.createObjectURL(file)}" style="width:70px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`;
    }
  });

  document.getElementById('form-media').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-media');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      let coverUrl = document.getElementById('media-cover-url').value.trim();
      if (state.pendingCoverFile) {
        coverUrl = await uploadImageToStorage(state.pendingCoverFile, 'covers');
      }

      const dynamicMeta = {};
      document.querySelectorAll('#media-dynamic-fields [data-meta-key]').forEach(inp => {
        if (inp.value.trim()) dynamicMeta[inp.dataset.metaKey] = inp.value.trim();
      });

      const id = document.getElementById('media-id').value;
      const title = document.getElementById('media-title').value.trim();
      const status = document.getElementById('media-status').value;

      const payload = {
        title,
        alt_title: document.getElementById('media-alt-title').value.trim() || null,
        category: document.getElementById('media-category').value,
        status,
        rating: document.getElementById('media-rating').value !== '' ? Number(document.getElementById('media-rating').value) : null,
        progress_current: Number(document.getElementById('media-progress-current').value) || 0,
        progress_total: document.getElementById('media-progress-total').value ? Number(document.getElementById('media-progress-total').value) : null,
        progress_unit: document.getElementById('media-progress-unit').value.trim() || null,
        creator: document.getElementById('media-creator').value.trim() || null,
        release_year: document.getElementById('media-year').value ? Number(document.getElementById('media-year').value) : null,
        genres: document.getElementById('media-genres').value.split(',').map(s => s.trim()).filter(Boolean),
        tags: document.getElementById('media-tags').value.split(',').map(s => s.trim()).filter(Boolean),
        start_date: document.getElementById('media-start-date').value || null,
        finish_date: document.getElementById('media-finish-date').value || null,
        cover_url: coverUrl || null,
        external_url: document.getElementById('media-external-url').value.trim() || null,
        is_favorite: document.getElementById('media-favorite').checked,
        synopsis: document.getElementById('media-synopsis').value.trim() || null,
        review: document.getElementById('media-review').value.trim() || null,
        metadata: dynamicMeta,
        review_details: {
          pros: document.getElementById('media-pros').value.trim() || '',
          cons: document.getElementById('media-cons').value.trim() || ''
        },
        updated_at: new Date().toISOString()
      };

      const res = id
        ? await db.from('media_items').update(payload).eq('id', id)
        : await db.from('media_items').insert([payload]);

      if (res.error) throw res.error;

      await logActivity(id ? 'Updated' : 'Added', 'media', id, title, status);
      closeModal('modal-media');
      showToast(id ? 'Media entry updated!' : 'Media added to archive!', 'success');
      await loadAllData();
    } catch (err) {
      showToast(err.message || 'Error saving media entry', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Entry';
    }
  });

  document.getElementById('btn-add-note').addEventListener('click', () => openNoteForm());
  document.getElementById('note-content').addEventListener('input', (e) => {
    if (!document.getElementById('note-id').value) {
      localStorage.setItem('archive_note_draft', e.target.value);
    }
  });
  document.querySelectorAll('#note-category-tabs .cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#note-category-tabs .cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.noteCat = btn.dataset.noteCat;
      renderNotesFeed();
    });
  });
  document.getElementById('note-folder-filter').addEventListener('change', (e) => {
    state.noteFolder = e.target.value;
    renderNotesFeed();
  });
  document.getElementById('note-search').addEventListener('input', (e) => {
    state.noteSearch = e.target.value;
    renderNotesFeed();
  });
  document.getElementById('note-images-file').addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    state.pendingNoteFiles.push(...files);
    renderNoteImagePreviews();
  });

  document.getElementById('form-note').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-note');
    btn.disabled = true;
    btn.textContent = 'Publishing...';

    try {
      const uploadedUrls = [];
      for (const file of state.pendingNoteFiles) {
        const url = await uploadImageToStorage(file, 'notes');
        uploadedUrls.push(url);
      }

      const id = document.getElementById('note-id').value;
      const title = document.getElementById('note-title').value.trim() || null;
      const payload = {
        title,
        category: document.getElementById('note-category').value,
        folder: document.getElementById('note-folder').value.trim() || 'General',
        is_pinned: document.getElementById('note-pinned').checked,
        content: document.getElementById('note-content').value.trim(),
        tags: document.getElementById('note-tags').value.split(',').map(s => s.trim()).filter(Boolean),
        image_urls: [...state.existingNoteImages, ...uploadedUrls],
        updated_at: new Date().toISOString()
      };

      const res = id
        ? await db.from('notes').update(payload).eq('id', id)
        : await db.from('notes').insert([payload]);

      if (res.error) throw res.error;

      localStorage.removeItem('archive_note_draft');
      await logActivity(id ? 'Updated' : 'Created', 'note', id, title || 'Note');
      closeModal('modal-note');
      showToast(id ? 'Note updated!' : 'Note published!', 'success');
      await loadAllData();
    } catch (err) {
      showToast(err.message || 'Failed to publish note', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish Note';
    }
  });

  document.getElementById('btn-add-collection').addEventListener('click', () => openCollectionForm());
  document.getElementById('form-collection').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('collection-id').value;
    const checkedIds = Array.from(document.querySelectorAll('#collection-media-picker input:checked')).map(cb => cb.value);
    const payload = {
      title: document.getElementById('collection-title').value.trim(),
      description: document.getElementById('collection-desc').value.trim() || null,
      media_ids: checkedIds
    };
    const res = id
      ? await db.from('collections').update(payload).eq('id', id)
      : await db.from('collections').insert([payload]);

    if (res.error) return showToast(res.error.message, 'error');
    closeModal('modal-collection');
    showToast('Collection saved', 'success');
    await loadAllData();
  });

  document.querySelectorAll('[data-ws-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-ws-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.wsTab;
      document.querySelectorAll('#view-workspace .subview').forEach(sv => {
        sv.classList.toggle('active', sv.id === `ws-${tab}`);
      });
    });
  });

  document.getElementById('form-quick-task').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) return;
    const payload = {
      title,
      category: document.getElementById('task-cat-input').value.trim() || 'General',
      priority: document.getElementById('task-priority-input').value,
      due_date: document.getElementById('task-due-input').value || null,
      is_completed: false
    };
    const { error } = await db.from('tasks').insert([payload]);
    if (error) return showToast(error.message, 'error');
    e.target.reset();
    await loadAllData();
  });

  document.querySelectorAll('[data-task-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-task-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskFilter = btn.dataset.taskFilter;
      renderTasks();
    });
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    state.journalMonth = new Date(state.journalMonth.getFullYear(), state.journalMonth.getMonth() - 1, 1);
    renderJournalCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    state.journalMonth = new Date(state.journalMonth.getFullYear(), state.journalMonth.getMonth() + 1, 1);
    renderJournalCalendar();
  });
  document.getElementById('btn-add-journal').addEventListener('click', () => openJournalForm());
  document.getElementById('form-journal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('journal-id').value;
    const payload = {
      entry_date: document.getElementById('journal-date').value,
      entry_type: document.getElementById('journal-type').value,
      mood: document.getElementById('journal-mood').value.trim() || null,
      tags: document.getElementById('journal-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      title: document.getElementById('journal-title').value.trim() || null,
      content: document.getElementById('journal-content').value.trim()
    };
    const res = id
      ? await db.from('journal_entries').update(payload).eq('id', id)
      : await db.from('journal_entries').upsert([payload], { onConflict: 'entry_date' });

    if (res.error) return showToast(res.error.message, 'error');
    state.selectedJournalDate = payload.entry_date;
    await logActivity('Logged', 'journal', id, payload.title || payload.entry_date);
    closeModal('modal-journal');
    showToast('Journal entry saved', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-goal').addEventListener('click', () => {
    document.getElementById('form-goal').reset();
    openModal('modal-goal');
  });
  document.getElementById('form-goal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('goal-title').value.trim(),
      category: document.getElementById('goal-category').value.trim() || 'Personal',
      progress_percent: Number(document.getElementById('goal-progress').value) || 0,
      target_date: document.getElementById('goal-date').value || null,
      description: document.getElementById('goal-desc').value.trim() || null
    };
    const { error } = await db.from('goals').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-goal');
    showToast('Goal created', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-project').addEventListener('click', () => {
    document.getElementById('form-project').reset();
    openModal('modal-project');
  });
  document.getElementById('form-project').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('project-title').value.trim(),
      status: document.getElementById('project-status').value,
      progress_percent: Number(document.getElementById('project-progress').value) || 0,
      deadline: document.getElementById('project-deadline').value || null,
      tech_stack: document.getElementById('project-tech').value.split(',').map(s => s.trim()).filter(Boolean),
      repo_url: document.getElementById('project-repo').value.trim() || null,
      live_url: document.getElementById('project-live').value.trim() || null,
      description: document.getElementById('project-desc').value.trim() || null
    };
    const { error } = await db.from('projects').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-project');
    showToast('Project saved', 'success');
    await loadAllData();
  });

  document.getElementById('bookmark-search')?.addEventListener('input', (e) => renderBookmarks(e.target.value));
  document.getElementById('btn-add-bookmark').addEventListener('click', () => {
    document.getElementById('form-bookmark').reset();
    openModal('modal-bookmark');
  });
  document.getElementById('form-bookmark').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('bookmark-title').value.trim(),
      url: document.getElementById('bookmark-url').value.trim(),
      category: document.getElementById('bookmark-category').value.trim() || 'Resource',
      tags: document.getElementById('bookmark-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      description: document.getElementById('bookmark-desc').value.trim() || null
    };
    const { error } = await db.from('bookmarks').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-bookmark');
    showToast('Bookmark saved', 'success');
    await loadAllData();
  });

  document.querySelectorAll('[data-kb-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kb-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.kbTab;
      document.querySelectorAll('#view-knowledge .subview').forEach(sv => {
        sv.classList.toggle('active', sv.id === `kb-${tab}`);
      });
    });
  });

  document.getElementById('btn-open-knowledge-graph')?.addEventListener('click', () => {
    openModal('modal-knowledge-graph');
    renderKnowledgeGraph();
  });

  document.getElementById('btn-add-quote').addEventListener('click', () => {
    document.getElementById('form-quote').reset();
    openModal('modal-quote');
  });
  document.getElementById('form-quote').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      quote_text: document.getElementById('quote-text').value.trim(),
      author: document.getElementById('quote-author').value.trim() || null,
      source: document.getElementById('quote-source').value.trim() || null,
      interpretation: document.getElementById('quote-interpretation').value.trim() || null
    };
    const { error } = await db.from('quotes').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-quote');
    showToast('Quote saved', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-vocab').addEventListener('click', () => {
    document.getElementById('form-vocab').reset();
    openModal('modal-vocab');
  });
  document.getElementById('form-vocab').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      word: document.getElementById('vocab-word').value.trim(),
      reading: document.getElementById('vocab-reading').value.trim() || null,
      language: document.getElementById('vocab-lang').value.trim() || 'English',
      meaning: document.getElementById('vocab-meaning').value.trim(),
      example_sentence: document.getElementById('vocab-example').value.trim() || null
    };
    const { error } = await db.from('vocabulary').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-vocab');
    showToast('Vocabulary saved', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-concept').addEventListener('click', () => {
    document.getElementById('form-concept').reset();
    openModal('modal-concept');
  });
  document.getElementById('form-concept').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('concept-title').value.trim(),
      domain: document.getElementById('concept-domain').value.trim() || 'General',
      summary: document.getElementById('concept-summary').value.trim(),
      interpretation: document.getElementById('concept-interpretation').value.trim() || null
    };
    const { error } = await db.from('concepts').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-concept');
    showToast('Concept saved', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-learning')?.addEventListener('click', () => {
    document.getElementById('form-learning').reset();
    openModal('modal-learning');
  });
  document.getElementById('form-learning')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      subject: document.getElementById('learning-subject').value.trim(),
      topic: document.getElementById('learning-topic').value.trim(),
      content: document.getElementById('learning-content').value.trim(),
      reference_url: document.getElementById('learning-ref').value.trim() || null,
      tags: document.getElementById('learning-tags').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    const { error } = await db.from('learning_notes').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-learning');
    showToast('Learning note saved', 'success');
    await loadAllData();
  });

  document.getElementById('btn-add-reference')?.addEventListener('click', () => {
    document.getElementById('form-reference').reset();
    openModal('modal-reference');
  });
  document.getElementById('form-reference')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('ref-title').value.trim(),
      ref_type: document.getElementById('ref-type').value,
      author: document.getElementById('ref-author').value.trim() || null,
      url: document.getElementById('ref-url').value.trim() || null,
      notes: document.getElementById('ref-notes').value.trim() || null
    };
    const { error } = await db.from('references_lib').insert([payload]);
    if (error) return showToast(error.message, 'error');
    closeModal('modal-reference');
    showToast('Reference saved', 'success');
    await loadAllData();
  });

  document.getElementById('stats-category-filter')?.addEventListener('change', (e) => {
    state.statsCategoryFilter = e.target.value;
    renderStatistics();
  });

  document.getElementById('timeline-type-filter')?.addEventListener('change', (e) => {
    state.timelineFilter = e.target.value;
    renderTimeline();
  });
  document.getElementById('timeline-search')?.addEventListener('input', (e) => {
    state.timelineSearch = e.target.value;
    renderTimeline();
  });
  document.querySelectorAll('[data-arch-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-arch-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.archiveTab = btn.dataset.archTab;
      renderArchiveView();
    });
  });
}

// ==================== 15. METADATA AUTO-FILL LOOKUP ====================
async function searchExternalMetadata(query, category) {
  const resultsBox = document.getElementById('api-search-results');
  resultsBox.classList.remove('hidden');
  resultsBox.innerHTML = `<div class="api-loading">Searching metadata for "${esc(query)}"...</div>`;

  try {
    let items = [];

    if (['Anime', 'Manga', 'Manhwa', 'Manhua'].includes(category)) {
      const anilistType = category === 'Anime' ? 'ANIME' : 'MANGA';
      const gql = `
        query ($search: String, $type: MediaType) {
          Page(perPage: 6) {
            media(search: $search, type: $type) {
              title { romaji english native }
              coverImage { large }
              startDate { year }
              chapters
              episodes
              genres
              description(asHtml: false)
              siteUrl
              studios(isMain: true) { nodes { name } }
              staff(perPage: 2) { nodes { name { full } } }
            }
          }
        }
      `;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: gql, variables: { search: query, type: anilistType } })
      });
      const json = await res.json();
      const mediaList = json?.data?.Page?.media || [];

      items = mediaList.map(m => {
        const creator = category === 'Anime'
          ? (m.studios?.nodes?.[0]?.name || '')
          : (m.staff?.nodes?.[0]?.name?.full || '');
        return {
          title: m.title.english || m.title.romaji,
          alt_title: m.title.native || m.title.romaji || '',
          year: m.startDate?.year || '',
          creator,
          cover_url: m.coverImage?.large || '',
          total: category === 'Anime' ? (m.episodes || '') : (m.chapters || ''),
          unit: category === 'Anime' ? 'ep' : 'ch',
          genres: (m.genres || []).join(', '),
          synopsis: (m.description || '').replace(/<[^>]*>/g, '').trim(),
          external_url: m.siteUrl || ''
        };
      });
    } else if (category === 'Books') {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`);
      const json = await res.json();
      items = (json.docs || []).map(b => ({
        title: b.title || '',
        alt_title: b.subtitle || '',
        year: b.first_publish_year || '',
        creator: (b.author_name || []).slice(0, 2).join(', '),
        cover_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '',
        total: b.number_of_pages_median || '',
        unit: 'pages',
        genres: (b.subject || []).slice(0, 4).join(', '),
        synopsis: '',
        external_url: b.key ? `https://openlibrary.org${b.key}` : ''
      }));
    } else if (['Movies', 'TV Shows', 'Video Games'].includes(category)) {
      const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      items = (json || []).slice(0, 6).map(entry => {
        const s = entry.show;
        return {
          title: s.name || '',
          alt_title: '',
          year: s.premiered ? s.premiered.slice(0, 4) : '',
          creator: s.network?.name || s.webChannel?.name || '',
          cover_url: s.image?.original || s.image?.medium || '',
          total: '',
          unit: category === 'Movies' ? 'mins' : 'ep',
          genres: (s.genres || []).join(', '),
          synopsis: (s.summary || '').replace(/<[^>]*>/g, '').trim(),
          external_url: s.url || ''
        };
      });
    } else if (category === 'Visual Novels') {
      const res = await fetch('https://api.vndb.org/kana/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['search', '=', query],
          fields: 'title, alttitle, released, image.url, description, developers.name',
          results: 6
        })
      });
      const json = await res.json();
      items = (json.results || []).map(v => ({
        title: v.title || '',
        alt_title: v.alttitle || '',
        year: v.released ? v.released.slice(0, 4) : '',
        creator: (v.developers || []).map(d => d.name).join(', '),
        cover_url: v.image?.url || '',
        total: '',
        unit: 'hrs',
        genres: 'Visual Novel',
        synopsis: (v.description || '').replace(/\[[^\]]*\]/g, '').trim(),
        external_url: v.id ? `https://vndb.org/${v.id}` : ''
      }));
    }

    if (!items.length) {
      resultsBox.innerHTML = `<div class="api-loading">No results found. Try a different keyword.</div>`;
      return;
    }

    resultsBox.innerHTML = items.map((item, idx) => `
      <div class="api-result-item" data-idx="${idx}">
        ${item.cover_url
          ? `<img class="api-result-thumb" src="${esc(item.cover_url)}" alt="">`
          : `<div class="api-result-thumb"></div>`
        }
        <div class="api-result-info">
          <div class="api-result-title">${esc(item.title)}</div>
          <div class="api-result-sub">${esc(item.year || '—')} • ${esc(item.creator || category)}</div>
        </div>
        <span class="badge">Select</span>
      </div>
    `).join('');

    resultsBox.querySelectorAll('.api-result-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        const chosen = items[idx];
        document.getElementById('media-title').value = chosen.title;
        document.getElementById('media-alt-title').value = chosen.alt_title;
        document.getElementById('media-year').value = chosen.year;
        document.getElementById('media-creator').value = chosen.creator;
        document.getElementById('media-cover-url').value = chosen.cover_url;
        document.getElementById('media-progress-total').value = chosen.total;
        document.getElementById('media-progress-unit').value = chosen.unit;
        document.getElementById('media-genres').value = chosen.genres;
        document.getElementById('media-synopsis').value = chosen.synopsis;
        document.getElementById('media-external-url').value = chosen.external_url;

        if (chosen.cover_url) {
          document.getElementById('media-cover-preview').innerHTML =
            `<img src="${esc(chosen.cover_url)}" style="width:70px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`;
        }
        resultsBox.classList.add('hidden');
        showToast(`Metadata loaded: ${chosen.title}`, 'success');
      });
    });
  } catch (err) {
    console.error('Metadata lookup error:', err);
    resultsBox.innerHTML = `<div class="api-loading">Failed to fetch external metadata.</div>`;
  }
}

function initMetadataLookup() {
  const btn = document.getElementById('btn-api-search');
  const input = document.getElementById('api-search-query');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const q = input.value.trim();
    const cat = document.getElementById('media-category').value;
    if (!q) {
      showToast('Enter a title to search first.', 'info');
      return;
    }
    searchExternalMetadata(q, cat);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btn.click();
    }
  });
}

// ==================== 16. AI ARCHIVE ASSISTANT (GROQ EDGE FUNCTION) ====================
let aiChatHistory = [];

function buildArchiveContextSummary() {
  const activeMedia = getActiveMedia();
  const mediaSummary = activeMedia.slice(0, 60).map(m =>
    `- [${m.category}] "${m.title}" | Status: ${m.status} | Rating: ${m.rating || 'Unrated'}/10 | Progress: ${m.progress_current || 0}/${m.progress_total || '?'} | Genres: ${(m.genres || []).join(', ')}`
  ).join('\n');

  const notesSummary = getActiveNotes().slice(0, 25).map(n =>
    `- [${n.category}] ${n.title || 'Note'}: ${(n.content || '').slice(0, 140)}...`
  ).join('\n');

  const goalsSummary = state.goals.slice(0, 10).map(g =>
    `- ${g.title} (${g.progress_percent || 0}%)`
  ).join('\n');

  const tasksSummary = state.tasks.filter(t => !t.is_completed).slice(0, 15).map(t =>
    `- [${t.priority}] ${t.title}`
  ).join('\n');

  return `
TOTAL MEDIA: ${activeMedia.length}
MEDIA LIST:
${mediaSummary || 'No media entries yet.'}

RECENT NOTES:
${notesSummary || 'No notes yet.'}

ACTIVE GOALS:
${goalsSummary || 'No goals yet.'}

PENDING TASKS:
${tasksSummary || 'No pending tasks.'}
  `.trim();
}

function formatAiMarkdown(text) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--onyx);padding:2px 5px;border-radius:4px">$1</code>')
    .replace(/\n/g, '<br>');
}

function appendAiMessage(role, content, isTyping = false) {
  const container = document.getElementById('ai-chat-messages');
  const welcome = container.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="ai-avatar">${role === 'user' ? 'YOU' : 'AI'}</div>
    <div class="ai-bubble">
      ${isTyping
        ? `<div class="typing-dots"><span></span><span></span><span></span></div>`
        : formatAiMarkdown(content)
      }
    </div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return msgDiv;
}

async function sendAiPrompt(promptText) {
  if (!state.isAdmin) {
    showToast('Sign in as Admin to use the AI Assistant.', 'error');
    return;
  }

  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-send-btn');
  const includeContext = document.getElementById('ai-include-context').checked;

  appendAiMessage('user', promptText);
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  const typingNode = appendAiMessage('ai', '', true);

  try {
    const contextStr = includeContext ? buildArchiveContextSummary() : '';
    const messagesPayload = [
      ...aiChatHistory.slice(-8),
      { role: 'user', content: promptText }
    ];

    const { data, error } = await db.functions.invoke('archive-ai', {
      body: {
        messages: messagesPayload,
        archiveContext: contextStr
      }
    });

    typingNode.remove();

    if (error) throw error;
    const reply = data?.reply || 'No response received from AI Assistant.';
    aiChatHistory.push({ role: 'user', content: promptText });
    aiChatHistory.push({ role: 'assistant', content: reply });
    appendAiMessage('ai', reply);
  } catch (err) {
    typingNode.remove();
    console.error('AI Assistant error:', err);
    appendAiMessage(
      'ai',
      '⚠️ Failed to connect to the `archive-ai` Edge Function. Make sure the Edge Function is deployed in Supabase with your `GROQ_API_KEY` secret.'
    );
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function initAiAssistant() {
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const clearBtn = document.getElementById('btn-clear-ai-chat');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) sendAiPrompt(q);
  });

  document.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.aiPrompt;
      if (prompt) sendAiPrompt(prompt);
    });
  });

  clearBtn?.addEventListener('click', () => {
    aiChatHistory = [];
    document.getElementById('ai-chat-messages').innerHTML = `
      <div class="ai-welcome">
        <h3>Conversation Cleared</h3>
        <p>Start a new question about your personal archive.</p>
      </div>
    `;
  });
}

// ==================== 17. INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  initMetadataLookup();
  initAiAssistant();
  await initAuth();
  await loadAllData();
});
