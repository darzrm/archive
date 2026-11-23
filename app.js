// ==============================================================================
// 1. SUPABASE CONFIGURATION
// ==============================================================================
const SUPABASE_URL = 'https://uendrdxiixmikkeanlod.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbmRyZHhpaXhtaWtrZWFubG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NDY2MDQsImV4cCI6MjExMDUyMjYwNH0.RDOdaZ9qtcF9oFyvLqQLAHPYQUJLsBfFmGVQa0BLAnI';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================================================================
// 2. STATE, PROFILE & TAXONOMY
// ==============================================================================
let mediaItems = [];
let workspaceItems = [];
let activityLogs = [];
let activePage = 'home';
let activeCategory = 'all';
let activeStatus = 'all';
let sortField = 'updated';
let sortDir = 'desc';
let viewMode = 'grid';
let visibleLimit = 36;
let isAdmin = false;
let adminUser = null;
let searchResults = [];
let draftMeta = null;

let analyticsState = {
  tab: 'overview',
  range: 'all',
  customStart: '',
  customEnd: '',
  selectedMediaCat: 'anime',
  wrappedYear: new Date().getFullYear()
};

const DEFAULT_PROFILE = {
  name: '',
  handle: '',
  avatar: 'https://placehold.co/160x160/18181b/52525b?text=+',
  banner: '',
  bio: '',
  socials: []
};

let userProfile = loadProfileFromStorage();
let homeWidgets = JSON.parse(localStorage.getItem('mv_home_widgets') || '{"stats":true,"ongoing":true,"notes":true,"todos":true,"goals":true}');
let autoDeleteStorage = localStorage.getItem('mv_auto_delete_storage') !== 'false';

const TYPE_LABELS = {
  anime: 'Anime',
  donghua: 'Donghua',
  movie: 'Movie',
  tv: 'TV Show',
  manga: 'Manga',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  comic: 'Comic',
  light_novel: 'Light Novel',
  web_novel: 'Web Novel',
  novel: 'Novel',
  book: 'Book',
  game: 'Game',
  vn: 'Visual Novel',
  music: 'Music'
};

const DB_BASE_CATEGORY_MAP = {
  anime: 'anime', donghua: 'anime', movie: 'movie', tv: 'tv',
  manga: 'manga', manhwa: 'manga', manhua: 'manga', comic: 'manga',
  light_novel: 'book', web_novel: 'book', novel: 'book', book: 'book',
  game: 'game', vn: 'vn', music: 'music'
};

const FULL_UNIT_OPTIONS = ['Episode', 'Chapter', 'Volume', 'Movie', 'Page', 'Route', 'Track', 'Percent', 'Issue', 'Hour', 'Stage'];

const DEFAULT_UNIT_BY_TYPE = {
  anime: 'Episode', donghua: 'Episode', movie: 'Movie', tv: 'Episode',
  manga: 'Chapter', manhwa: 'Chapter', manhua: 'Chapter', comic: 'Issue',
  light_novel: 'Volume', web_novel: 'Chapter', novel: 'Chapter', book: 'Page',
  game: 'Percent', vn: 'Route', music: 'Track'
};

const DEFAULT_PROVIDERS = {
  anime: ['anilist', 'jikan'], donghua: ['anilist', 'jikan'],
  movie: ['tmdb', 'tvmaze'], tv: ['tvmaze', 'tmdb'],
  manga: ['anilist', 'mangadex', 'jikan'], manhwa: ['mangadex', 'anilist'], manhua: ['mangadex', 'anilist'],
  comic: ['openlibrary'], light_novel: ['anilist', 'jikan', 'openlibrary'],
  web_novel: ['anilist', 'openlibrary'], novel: ['openlibrary', 'anilist'], book: ['openlibrary'],
  game: ['rawg'], vn: ['vndb'], music: ['musicbrainz']
};

// ==============================================================================
// 3. UTILITIES & SCROLL LOCK
// ==============================================================================
function syncBodyScrollLock() {
  const anyOverlayOpen = Boolean(
    document.querySelector('.modal-backdrop.active, .drawer-overlay.active')
  );
  document.body.classList.toggle('modal-open', anyOverlayOpen);
}

function esc(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function cleanUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (s.startsWith('data:image/')) return s;
  return s.startsWith('http://') ? s.replace('http://', 'https://') : s;
}

function stripTags(str) {
  if (!str) return '';
  return String(str).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim();
}

function parseCsv(str) {
  if (!str) return [];
  return String(str).split(',').map(x => x.trim()).filter(Boolean);
}

function uniqueList(arr) {
  return [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];
}

function normalizeUnitName(rawUnit, fallbackSub = 'anime') {
  const s = String(rawUnit || '').trim().toLowerCase();
  const map = {
    ep: 'Episode', eps: 'Episode', episode: 'Episode', episodes: 'Episode',
    ch: 'Chapter', chap: 'Chapter', chapter: 'Chapter', chapters: 'Chapter',
    vol: 'Volume', volume: 'Volume', volumes: 'Volume',
    movie: 'Movie', movies: 'Movie', page: 'Page', pages: 'Page',
    route: 'Route', routes: 'Route', track: 'Track', tracks: 'Track',
    '%': 'Percent', percent: 'Percent', issue: 'Issue', issues: 'Issue',
    hr: 'Hour', hour: 'Hour', hours: 'Hour', stage: 'Stage'
  };
  return map[s] || (FULL_UNIT_OPTIONS.includes(rawUnit) ? rawUnit : (DEFAULT_UNIT_BY_TYPE[fallbackSub] || 'Episode'));
}

function getSubtype(item) {
  const raw = (item.media_subtype || item.metadata_json?.specific_category || item.category || 'anime').toLowerCase().replace(/\s+/g, '_');
  if (raw === 'tv_show' || raw === 'series') return 'tv';
  if (raw === 'visual_novel') return 'vn';
  return raw;
}

function formatTrackLabel(subtypeKey, title) {
  const catLabel = TYPE_LABELS[subtypeKey] || 'Media';
  const cleanTitle = String(title || '').trim();
  return cleanTitle ? `${catLabel}: ${cleanTitle}` : catLabel;
}

function extractRawTitleFromTrack(label) {
  const s = String(label || '').trim();
  const idx = s.indexOf(':');
  return idx !== -1 ? s.slice(idx + 1).trim() : s;
}

function getTracks(item) {
  const meta = item.metadata_json || {};
  const sub = getSubtype(item);
  const primaryLabel = formatTrackLabel(sub, item.title);

  if (Array.isArray(meta.tracks) && meta.tracks.length > 0) {
    return meta.tracks.map((t, i) => {
      const tSub = t.subtype || sub;
      return {
        ...t,
        subtype: tSub,
        label: (i === 0 && (!t.label || t.label === 'Main')) ? primaryLabel : (t.label || primaryLabel),
        unit_label: normalizeUnitName(t.unit_label, tSub),
        progress: Number(t.progress) || 0,
        total_units: Number(t.total_units) || 0
      };
    });
  }

  return [{
    subtype: sub,
    label: primaryLabel,
    status: item.status || 'planned',
    progress: Number(item.progress) || 0,
    total_units: Number(item.total_units) || 0,
    unit_label: normalizeUnitName(item.unit_label, sub)
  }];
}

function getPosterCategoryBadge(item) {
  const primarySub = getSubtype(item);
  const cats = [TYPE_LABELS[primarySub] || 'Media'];
  const tracks = getTracks(item);
  tracks.forEach(t => {
    if (t.subtype && TYPE_LABELS[t.subtype] && !cats.includes(TYPE_LABELS[t.subtype])) {
      cats.push(TYPE_LABELS[t.subtype]);
    }
  });
  return cats.join(' · ');
}

function getAggregateProgress(tracks) {
  let done = 0, total = 0;
  const unitsSet = new Set();
  (tracks || []).forEach(t => {
    done += Number(t.progress) || 0;
    total += Number(t.total_units) || 0;
    if (t.unit_label) unitsSet.add(t.unit_label);
  });
  const unitLabel = unitsSet.size === 1 ? [...unitsSet][0] : (tracks.length > 1 ? 'Units' : (tracks[0]?.unit_label || 'Episode'));
  const text = total > 0 ? `${done} / ${total}` : `${done} ${unitLabel}`;
  const fullText = total > 0 ? `${done} / ${total} ${unitLabel}` : `${done} ${unitLabel}`;
  return { done, total, unitLabel, text, fullText };
}

function getSyncedStatus(tracks) {
  if (!tracks || !tracks.length) return { key: 'planned', label: 'Planned' };
  const list = tracks.map(t => t.status);
  if (list.includes('ongoing')) return { key: 'ongoing', label: 'In Progress' };
  if (list.every(s => s === 'completed')) return { key: 'completed', label: 'Completed' };
  if (list.includes('on_hold')) return { key: 'on_hold', label: 'On Hold' };
  if (list.every(s => s === 'dropped')) return { key: 'dropped', label: 'Dropped' };
  return { key: 'planned', label: 'Planned' };
}

function formatExternalScoreLabel(rawKey) {
  const k = String(rawKey || '').toLowerCase().replace(/_score$/i, '').replace(/_rating$/i, '').trim();
  const map = {
    tmdb: 'TMDB', anilist: 'AniList', mal: 'MAL', jikan: 'MAL', imdb: 'IMDb',
    vndb: 'VNDB', rawg: 'RAWG', tvmaze: 'TVmaze', openlibrary: 'OpenLibrary',
    mangadex: 'MangaDex', musicbrainz: 'MusicBrainz'
  };
  return map[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderExternalRatingsHtml(extObj) {
  if (!extObj || typeof extObj !== 'object') return '';
  return Object.entries(extObj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<span class="badge-pill">${esc(formatExternalScoreLabel(k))} ${esc(String(v))}</span>`)
    .join('');
}

function computeCompleteness(rec) {
  const checks = [
    { label: 'Title', ok: Boolean(rec.title) },
    { label: 'Poster', ok: Boolean(rec.cover_url) },
    { label: 'Synopsis', ok: Boolean(rec.synopsis && rec.synopsis.length > 20) },
    { label: 'Year', ok: Boolean(rec.release_year) },
    { label: 'Genres', ok: Array.isArray(rec.genres) && rec.genres.length > 0 },
    { label: 'Creators', ok: Array.isArray(rec.creators) && rec.creators.length > 0 },
    { label: 'Units', ok: Number(rec.total_units) > 0 },
    { label: 'External Score', ok: rec.external_ratings && Object.keys(rec.external_ratings).length > 0 },
    { label: 'Banner', ok: Boolean(rec.banner_url) }
  ];
  const passed = checks.filter(c => c.ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    missing: checks.filter(c => !c.ok).map(c => c.label)
  };
}

// ==============================================================================
// 4. ACCORDION & SUPABASE IMAGE UPLOAD
// ==============================================================================
window.toggleAccordion = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('collapsed');
};

function extractStoragePathFromUrl(url) {
  if (!url || !url.includes('/storage/v1/object/public/')) return null;
  const bucket = (localStorage.getItem('mv_storage_bucket') || 'media-images').trim();
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

async function deleteOldStorageImage(oldUrl) {
  if (!autoDeleteStorage || !oldUrl) return;
  const path = extractStoragePathFromUrl(oldUrl);
  if (!path) return;
  const bucket = (localStorage.getItem('mv_storage_bucket') || 'media-images').trim();
  try { await db.storage.from(bucket).remove([path]); } catch {}
}

function compressImageToDataUrl(file, maxWidth = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.84));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.handleImageUpload = async function (fileInput, targetInputId, folder = 'general', autoSaveProfile = false) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const targetInput = document.getElementById(targetInputId);
  const oldUrl = targetInput.value.trim();
  const labelBtn = fileInput.closest('.upload-trigger');
  const textSpan = labelBtn?.querySelector('span');
  const prevText = textSpan ? textSpan.textContent : 'Upload';
  if (textSpan) textSpan.textContent = 'Uploading...';

  try {
    const bucket = (localStorage.getItem('mv_storage_bucket') || 'media-images').trim();
    const ext = (file.name.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await db.storage.from(bucket).upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (uploadErr) throw uploadErr;
    const { data: pub } = db.storage.from(bucket).getPublicUrl(filePath);
    if (pub?.publicUrl) {
      targetInput.value = pub.publicUrl;
      if (oldUrl && oldUrl !== pub.publicUrl) await deleteOldStorageImage(oldUrl);
      if (autoSaveProfile) {
        if (targetInputId === 'set-avatar') userProfile.avatar = pub.publicUrl;
        if (targetInputId === 'set-banner') userProfile.banner = pub.publicUrl;
        localStorage.setItem('mv_user_profile', JSON.stringify(userProfile));
        renderProfileUI();
        if (isAdmin) await db.from('site_profile').upsert({ id: 'main', ...userProfile, updated_at: new Date().toISOString() });
      }
    }
  } catch (err) {
    try {
      const dataUrl = await compressImageToDataUrl(file, folder === 'banners' ? 1200 : 720);
      targetInput.value = dataUrl;
      if (oldUrl) await deleteOldStorageImage(oldUrl);
      if (autoSaveProfile) {
        if (targetInputId === 'set-avatar') userProfile.avatar = dataUrl;
        if (targetInputId === 'set-banner') userProfile.banner = dataUrl;
        localStorage.setItem('mv_user_profile', JSON.stringify(userProfile));
        renderProfileUI();
        if (isAdmin) await db.from('site_profile').upsert({ id: 'main', ...userProfile, updated_at: new Date().toISOString() });
      }
    } catch { alert('Failed to process image: ' + err.message); }
  } finally {
    if (textSpan) textSpan.textContent = prevText;
    fileInput.value = '';
  }
};

// ==============================================================================
// 5. PROFILE, DRAWER, NAVIGATION & SETTINGS
// ==============================================================================
function loadProfileFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('mv_user_profile') || 'null');
    return saved ? { ...DEFAULT_PROFILE, ...saved } : { ...DEFAULT_PROFILE };
  } catch { return { ...DEFAULT_PROFILE }; }
}

async function loadProfileFromDb() {
  try {
    const { data, error } = await db.from('site_profile').select('*').eq('id', 'main').single();
    if (!error && data) {
      userProfile = {
        name: data.name || '',
        handle: data.handle || '',
        avatar: data.avatar || '',
        banner: data.banner || '',
        bio: data.bio || '',
        socials: Array.isArray(data.socials) ? data.socials : []
      };
      localStorage.setItem('mv_user_profile', JSON.stringify(userProfile));
      renderProfileUI();
    }
  } catch {}
}

function getSocialIconName(label, url) {
  const str = `${label} ${url}`.toLowerCase();
  if (str.includes('github')) return 'logo-github';
  if (str.includes('twitter') || str.includes('x.com')) return 'logo-twitter';
  if (str.includes('instagram')) return 'logo-instagram';
  if (str.includes('youtube')) return 'logo-youtube';
  if (str.includes('discord')) return 'logo-discord';
  return 'link-outline';
}

function renderProfileUI() {
  const avatar = cleanUrl(userProfile.avatar) || DEFAULT_PROFILE.avatar;
  const banner = cleanUrl(userProfile.banner);
  const name = userProfile.name || '';
  const handle = userProfile.handle || '';
  const bio = userProfile.bio || '';

  document.getElementById('nav-avatar').src = avatar;
  document.getElementById('nav-name').textContent = name || 'Library';
  document.getElementById('drawer-avatar').src = avatar;
  document.getElementById('drawer-name').textContent = name || 'Menu';
  document.getElementById('home-avatar').src = avatar;

  const bannerEl = document.getElementById('home-banner');
  if (banner) { bannerEl.src = banner; bannerEl.style.display = 'block'; }
  else { bannerEl.removeAttribute('src'); bannerEl.style.display = 'none'; }

  const nameEl = document.getElementById('home-name');
  nameEl.textContent = name; nameEl.style.display = name ? 'block' : 'none';

  const handleEl = document.getElementById('home-handle');
  handleEl.textContent = handle; handleEl.style.display = handle ? 'block' : 'none';

  const bioEl = document.getElementById('home-bio');
  bioEl.textContent = bio; bioEl.style.display = bio ? 'block' : 'none';

  const socials = Array.isArray(userProfile.socials) ? userProfile.socials.filter(s => s.url) : [];
  const socialsEl = document.getElementById('home-socials');
  socialsEl.style.display = socials.length ? 'flex' : 'none';
  socialsEl.innerHTML = socials.map(s => `
    <a href="${esc(cleanUrl(s.url))}" target="_blank" rel="noopener" class="social-chip">
      <ion-icon name="${getSocialIconName(s.label, s.url)}"></ion-icon>
      <span>${esc(s.label || 'Link')}</span>
    </a>
  `).join('');

  document.getElementById('set-name').value = name;
  document.getElementById('set-handle').value = handle;
  document.getElementById('set-avatar').value = userProfile.avatar || '';
  document.getElementById('set-banner').value = userProfile.banner || '';
  document.getElementById('set-bio').value = bio;

  const socialListEl = document.getElementById('set-socials-list');
  socialListEl.innerHTML = '';
  (socials.length ? socials : [{ label: '', url: '' }]).forEach(s => addSocialInputRow(s));
}

window.addSocialInputRow = function (s = { label: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'social-input-row';
  row.innerHTML = `
    <input type="text" class="input s-label" placeholder="Platform (e.g. GitHub)" value="${esc(s.label)}">
    <input type="url" class="input s-url" placeholder="https://..." value="${esc(s.url)}">
    <button type="button" class="btn btn-mono-trash btn-icon" onclick="this.parentElement.remove()">
      <ion-icon name="trash-outline"></ion-icon>
    </button>
  `;
  document.getElementById('set-socials-list').appendChild(row);
};

window.saveProfileSettings = async function (e) {
  e.preventDefault();
  const newAvatar = document.getElementById('set-avatar').value.trim();
  const newBanner = document.getElementById('set-banner').value.trim();
  if (userProfile.avatar && userProfile.avatar !== newAvatar) await deleteOldStorageImage(userProfile.avatar);
  if (userProfile.banner && userProfile.banner !== newBanner) await deleteOldStorageImage(userProfile.banner);

  const socials = [];
  document.querySelectorAll('#set-socials-list .social-input-row').forEach(r => {
    const label = r.querySelector('.s-label').value.trim();
    const url = r.querySelector('.s-url').value.trim();
    if (url) socials.push({ label: label || 'Link', url });
  });

  userProfile = {
    name: document.getElementById('set-name').value.trim(),
    handle: document.getElementById('set-handle').value.trim(),
    avatar: newAvatar,
    banner: newBanner,
    bio: document.getElementById('set-bio').value.trim(),
    socials
  };

  localStorage.setItem('mv_user_profile', JSON.stringify(userProfile));
  renderProfileUI();

  if (isAdmin) {
    const { error } = await db.from('site_profile').upsert({ id: 'main', ...userProfile, updated_at: new Date().toISOString() });
    if (error) return alert('Saved locally, DB sync failed: ' + error.message);
    alert('Profile saved to database.');
  } else {
    alert('Profile saved locally (Sign in as Admin to sync to database).');
  }
};

window.toggleNavDrawer = function (open) {
  document.getElementById('nav-drawer-overlay').classList.toggle('active', open);
  syncBodyScrollLock();
};

window.navigatePage = async function (page) {
  activePage = page;
  const pageNames = { home: 'Home', library: 'Library', analytics: 'Analytics', workspace: 'Workspace', settings: 'Settings' };
  document.getElementById('nav-sub').textContent = pageNames[page] || 'Home';
  document.querySelectorAll('.page-view').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  document.querySelectorAll('#main-nav .drawer-link').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));

  if (page === 'settings') {
    document.querySelectorAll('#page-settings .accordion-card').forEach(c => c.classList.add('collapsed'));
  }
  if (page === 'analytics') {
    if (!activityLogs.length) await loadActivityLogs();
    renderAnalyticsPage();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
};

window.jumpToLibraryStatus = function (statusKey) {
  pickOption('status', statusKey, statusKey === 'ongoing' ? 'In Progress' : 'All Status');
  navigatePage('library');
};

function applyHomeWidgetsUI() {
  document.querySelectorAll('#home-widget-pills .switch-pill').forEach(pill => {
    pill.classList.toggle('active', Boolean(homeWidgets[pill.dataset.widget]));
  });
  document.querySelectorAll('.home-widget').forEach(box => {
    box.classList.toggle('hidden', !homeWidgets[box.dataset.wBox]);
  });
  const autoDelSwitch = document.getElementById('switch-auto-delete');
  if (autoDelSwitch) {
    autoDelSwitch.classList.toggle('active', autoDeleteStorage);
    autoDelSwitch.textContent = `Auto-Delete Old Storage Images: ${autoDeleteStorage ? 'ON' : 'OFF'}`;
  }
}

window.toggleHomeWidget = function (key) {
  homeWidgets[key] = !homeWidgets[key];
  localStorage.setItem('mv_home_widgets', JSON.stringify(homeWidgets));
  applyHomeWidgetsUI();
};

window.toggleAutoDeleteStorage = function () {
  autoDeleteStorage = !autoDeleteStorage;
  localStorage.setItem('mv_auto_delete_storage', String(autoDeleteStorage));
  applyHomeWidgetsUI();
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select')) {
    document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  }
});

window.toggleDropdown = function (name) {
  const target = document.querySelector(`.custom-select[data-select="${name}"]`);
  if (!target) return;
  const isOpen = target.classList.contains('open');
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) target.classList.add('open');
};

window.pickOption = function (name, val, label) {
  const wrap = document.querySelector(`.custom-select[data-select="${name}"]`);
  if (wrap) {
    wrap.classList.remove('open');
    wrap.querySelectorAll('.custom-option').forEach(opt => opt.classList.toggle('active', opt.dataset.val === val));
  }
  const labelEl = document.getElementById(`label-${name}`);
  if (labelEl) labelEl.textContent = label;
  if (name === 'status') { activeStatus = val; renderMediaGrid(); }
  else if (name === 'sort') { sortField = val; renderMediaGrid(); }
};

window.pickFormSubtype = function (val, label) {
  document.getElementById('form-subtype').value = val;
  pickOption('subtype', val, label);
  pickFormProvider('auto', 'Auto Provider');
  syncPrimaryTrackLabel();
  const firstCard = document.querySelector('#tracks-list .track-card[data-primary="true"]');
  if (firstCard) {
    const catDropId = firstCard.dataset.catDrop;
    const unitDropId = firstCard.dataset.unitDrop;
    const defaultUnit = DEFAULT_UNIT_BY_TYPE[val] || 'Episode';
    if (catDropId) pickTrackCategory(catDropId, val, label, true);
    if (unitDropId) pickTrackDropdown(unitDropId, '.t-unit', defaultUnit, defaultUnit);
  }
};

window.pickFormProvider = function (val, label) {
  document.getElementById('form-provider').value = val;
  pickOption('provider', val, label);
};

window.pickTodoPrio = function (val, label) {
  document.getElementById('todo-prio').value = val;
  pickOption('todoPrio', val, label);
};

// ==============================================================================
// 6. INIT & AUTH
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  renderProfileUI();
  applyHomeWidgetsUI();
  await checkSession();
  await Promise.all([loadProfileFromDb(), loadLibrary(), loadWorkspace(), loadActivityLogs()]);
});

async function checkSession() {
  const { data } = await db.auth.getSession();
  isAdmin = Boolean(data?.session?.user);
  adminUser = data?.session?.user || null;
  syncAdminUI();
}

function syncAdminUI() {
  const addBtn = document.getElementById('btn-add-entry');
  const roleLabel = document.getElementById('drawer-role');
  const authStatus = document.getElementById('acc-auth-status');
  const loginView = document.getElementById('login-view');
  const loggedView = document.getElementById('logged-view');

  document.getElementById('key-bucket').value = localStorage.getItem('mv_storage_bucket') || 'media-images';
  document.getElementById('key-tmdb').value = localStorage.getItem('opt_tmdb_key') || '';
  document.getElementById('key-rawg').value = localStorage.getItem('opt_rawg_key') || '';

  if (isAdmin) {
    addBtn.style.display = 'inline-flex';
    roleLabel.textContent = 'Admin Signed In';
    if (authStatus) authStatus.textContent = `Signed in as ${adminUser?.email || 'Admin'}`;
    loginView.style.display = 'none';
    loggedView.style.display = 'flex';
    document.getElementById('admin-email-text').textContent = adminUser?.email || '';
  } else {
    addBtn.style.display = 'none';
    roleLabel.textContent = 'Guest Mode';
    if (authStatus) authStatus.textContent = 'Sign in to manage archive & cloud storage';
    loginView.style.display = 'flex';
    loggedView.style.display = 'none';
  }
}

window.handleLogin = async function (e) {
  e.preventDefault();
  const { data, error } = await db.auth.signInWithPassword({
    email: document.getElementById('admin-email').value.trim(),
    password: document.getElementById('admin-password').value
  });
  if (error) return alert(error.message);
  isAdmin = true;
  adminUser = data.user;
  syncAdminUI();
  renderMediaGrid();
};

window.handleLogout = async function () {
  await db.auth.signOut();
  isAdmin = false;
  adminUser = null;
  syncAdminUI();
  renderMediaGrid();
};

window.saveApiKeys = function () {
  localStorage.setItem('mv_storage_bucket', document.getElementById('key-bucket').value.trim() || 'media-images');
  localStorage.setItem('opt_tmdb_key', document.getElementById('key-tmdb').value.trim());
  localStorage.setItem('opt_rawg_key', document.getElementById('key-rawg').value.trim());
  alert('Configuration saved.');
};

window.exportArchiveJson = function () {
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: userProfile, media: mediaItems, workspace: workspaceItems, activity_logs: activityLogs }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mediavault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};

// ==============================================================================
// 7. LIBRARY & HOME TELEMETRY
// ==============================================================================
async function loadLibrary() {
  const { data, error } = await db.from('media_logs').select('*').order('updated_at', { ascending: false });
  if (error) {
    document.getElementById('media-grid').innerHTML = `<div class="state-message">Database error: ${esc(error.message)}</div>`;
    return;
  }
  mediaItems = data || [];
  renderHomeWidgets();
  renderMediaGrid();
  if (activePage === 'analytics') renderAnalyticsPage();
}

function renderHomeWidgets() {
  const rated = mediaItems.filter(m => m.rating !== null && m.rating !== undefined && m.rating !== '' && Number(m.rating) > 0);
  const avg = rated.length ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(2) : '—';
  const ongoingList = mediaItems.filter(m => getSyncedStatus(getTracks(m)).key === 'ongoing');

  let totalMinutesWatched = 0, totalEpisodesWatched = 0, totalChaptersRead = 0, totalPagesOrVolumes = 0, totalTracksCount = 0, totalRewatches = 0, totalFavorites = 0;
  const categoryCounts = {}, genreCounts = {}, yearCounts = {};
  const statusCounts = { ongoing: 0, completed: 0, planned: 0, on_hold: 0, dropped: 0 };
  const ratingBuckets = { 10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  mediaItems.forEach(item => {
    const sub = getSubtype(item);
    const catLabel = TYPE_LABELS[sub] || 'Other';
    categoryCounts[catLabel] = (categoryCounts[catLabel] || 0) + 1;
    if (item.is_favorite) totalFavorites++;
    totalRewatches += Number(item.repeat_count) || 0;
    if (item.release_year) yearCounts[String(item.release_year)] = (yearCounts[String(item.release_year)] || 0) + 1;
    if (Number(item.rating) > 0) {
      const bucket = Math.min(10, Math.max(1, Math.round(Number(item.rating))));
      ratingBuckets[bucket]++;
    }
    const meta = item.metadata_json || {};
    (meta.genres || []).forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });

    const tracks = getTracks(item);
    totalTracksCount += tracks.length;
    const synced = getSyncedStatus(tracks);
    if (statusCounts[synced.key] !== undefined) statusCounts[synced.key]++;

    const repeatMult = 1 + (Number(item.repeat_count) || 0);
    const defaultMins = Number(meta.runtime_minutes) || (['anime', 'donghua', 'tv'].includes(sub) ? 24 : (sub === 'movie' ? 115 : 0));

    tracks.forEach(t => {
      const done = (Number(t.progress) || 0) * repeatMult;
      const u = normalizeUnitName(t.unit_label, t.subtype || sub);
      if (u === 'Episode' || u === 'Movie') { totalEpisodesWatched += done; totalMinutesWatched += done * defaultMins; }
      else if (u === 'Hour') totalMinutesWatched += done * 60;
      else if (u === 'Chapter') totalChaptersRead += done;
      else if (u === 'Page' || u === 'Volume' || u === 'Issue') totalPagesOrVolumes += done;
    });
  });

  const totalHours = (totalMinutesWatched / 60).toFixed(1).replace(/\.0$/, '');
  const totalDays = (totalMinutesWatched / 1440).toFixed(1);

  document.getElementById('drawer-count').textContent = mediaItems.length;
  document.getElementById('stat-summary').textContent = `${mediaItems.length} items · ★ ${avg}`;
  document.getElementById('kpi-total').textContent = mediaItems.length.toLocaleString();
  document.getElementById('kpi-total-foot').textContent = `${totalTracksCount} tracks · ${totalFavorites} favorites`;
  document.getElementById('kpi-avg').textContent = `★ ${avg}`;
  document.getElementById('kpi-rated-foot').textContent = `${rated.length} rated · ${totalRewatches} rewatches`;
  document.getElementById('kpi-watch-time').textContent = `${totalHours}h`;
  document.getElementById('kpi-episodes-foot').textContent = `${totalEpisodesWatched.toLocaleString()} eps · ${totalDays} days`;
  document.getElementById('kpi-chapters').textContent = totalChaptersRead.toLocaleString();
  document.getElementById('kpi-pages-foot').textContent = `${totalPagesOrVolumes.toLocaleString()} vols/pages`;

  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  document.getElementById('stats-cat-count').textContent = `${sortedCats.length} categories`;
  document.getElementById('stats-category-bars').innerHTML = sortedCats.length ? sortedCats.map(([cat, count]) => {
    const pct = mediaItems.length ? Math.round((count / mediaItems.length) * 100) : 0;
    return `<div class="stat-bar-row"><div class="stat-bar-top"><span>${esc(cat)}</span><span class="subtle-meta">${count} (${pct}%)</span></div><div class="prog-line"><div style="width:${pct}%"></div></div></div>`;
  }).join('') : `<div class="subtle-meta">No entries archived yet.</div>`;

  const maxRatingBucket = Math.max(1, ...Object.values(ratingBuckets));
  document.getElementById('stats-rating-summary').textContent = `${rated.length} rated · Avg ★ ${avg}`;
  document.getElementById('stats-rating-bars').innerHTML = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(scoreNum => {
    const cnt = ratingBuckets[scoreNum] || 0;
    return `<div class="rating-dist-row"><span>★ ${scoreNum}</span><div class="prog-line"><div style="width:${cnt > 0 ? Math.round((cnt / maxRatingBucket) * 100) : 0}%"></div></div><span class="rating-dist-count">${cnt}</span></div>`;
  }).join('');

  const statusDisplayOrder = [
    { key: 'completed', label: 'Completed' }, { key: 'ongoing', label: 'In Progress' },
    { key: 'planned', label: 'Planned' }, { key: 'on_hold', label: 'On Hold' }, { key: 'dropped', label: 'Dropped' }
  ];
  const compRate = mediaItems.length ? Math.round((statusCounts.completed / mediaItems.length) * 100) : 0;
  document.getElementById('stats-completion-rate').textContent = `${compRate}% completed`;
  document.getElementById('stats-status-bars').innerHTML = statusDisplayOrder.map(st => {
    const cnt = statusCounts[st.key] || 0;
    const pct = mediaItems.length ? Math.round((cnt / mediaItems.length) * 100) : 0;
    return `<div class="stat-bar-row"><div class="stat-bar-top"><span>${st.label}</span><span class="subtle-meta">${cnt} (${pct}%)</span></div><div class="prog-line"><div style="width:${pct}%"></div></div></div>`;
  }).join('');

  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const maxGenre = sortedGenres[0]?.[1] || 1;
  document.getElementById('stats-genre-bars').innerHTML = sortedGenres.length ? sortedGenres.slice(0, 6).map(([genre, count]) =>
    `<div class="stat-bar-row"><div class="stat-bar-top"><span>${esc(genre)}</span><span class="subtle-meta">${count}</span></div><div class="prog-line"><div style="width:${Math.round((count / maxGenre) * 100)}%"></div></div></div>`
  ).join('') : `<div class="subtle-meta">No genres recorded yet.</div>`;

  const sortedYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]);
  const maxYear = sortedYears[0]?.[1] || 1;
  const doneTodos = workspaceItems.filter(x => x.kind === 'todo' && x.status === 'done').length;
  const totalTodos = workspaceItems.filter(x => x.kind === 'todo').length;
  document.getElementById('stats-year-bars').innerHTML = `
    ${sortedYears.slice(0, 4).map(([yr, count]) => `<div class="stat-bar-row"><div class="stat-bar-top"><span>Year ${esc(yr)}</span><span class="subtle-meta">${count} titles</span></div><div class="prog-line"><div style="width:${Math.round((count / maxYear) * 100)}%"></div></div></div>`).join('') || '<div class="subtle-meta">No release years recorded.</div>'}
    <div class="spec-cell" style="margin-top:4px;"><div class="spec-key">Workspace Summary</div><div class="spec-val">${workspaceItems.filter(x => x.kind === 'note').length} Notes · ${doneTodos}/${totalTodos} Tasks · ${workspaceItems.filter(x => x.kind === 'goal').length} Goals</div></div>
  `;

  const activeBox = document.getElementById('home-active-media');
  activeBox.innerHTML = ongoingList.length ? ongoingList.slice(0, 7).map(item => {
    const cover = cleanUrl(item.cover_url) || 'https://placehold.co/300x450/19191f/727280?text=NO+COVER';
    const agg = getAggregateProgress(getTracks(item));
    return `
      <article class="card" onclick="openDetailModal('${esc(item.id)}')">
        <div class="card-poster">
          <div class="card-top-row"><span class="chip-dark">${esc(getPosterCategoryBadge(item))}</span>${Number(item.rating) > 0 ? `<span class="chip-dark chip-rating">★ ${Number(item.rating).toFixed(1)}</span>` : ''}</div>
          <img src="${cover}" alt="" loading="lazy">
        </div>
        <div class="card-info"><div class="card-title">${esc(item.title)}</div><div class="card-sub"><span>Ongoing</span><span>${esc(agg.text)}</span></div></div>
      </article>
    `;
  }).join('') : `<div class="subtle-meta">No titles currently in progress.</div>`;
}

window.selectCategory = function (cat, el) {
  activeCategory = cat;
  visibleLimit = 36;
  document.querySelectorAll('#page-library .tab-item').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderMediaGrid();
};

window.toggleSortDir = function () {
  sortDir = sortDir === 'desc' ? 'asc' : 'desc';
  document.getElementById('sort-dir-icon').setAttribute('name', sortDir === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline');
  renderMediaGrid();
};

window.setViewMode = function (mode) {
  viewMode = mode;
  document.getElementById('view-grid-btn').classList.toggle('active', mode === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  renderMediaGrid();
};

window.loadMoreMedia = function () { visibleLimit += 36; renderMediaGrid(); };

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  const loadWrap = document.getElementById('load-more-wrap');
  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  grid.classList.toggle('is-list', viewMode === 'list');

  let list = mediaItems.filter(item => {
    const sub = getSubtype(item);
    const synced = getSyncedStatus(getTracks(item));
    const meta = item.metadata_json || {};
    if (activeCategory !== 'all' && sub !== activeCategory) return false;
    if (activeStatus !== 'all' && synced.key !== activeStatus) return false;
    if (q) {
      const hay = [item.title, item.original_title, item.english_title, ...(item.alt_titles || []), ...(meta.creators || []), ...(meta.genres || []), ...(meta.tags || [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    if (sortField === 'rating') return sortDir === 'desc' ? (b.rating ?? -1) - (a.rating ?? -1) : (a.rating ?? -1) - (b.rating ?? -1);
    if (sortField === 'year') return sortDir === 'desc' ? (Number(b.release_year) || 0) - (Number(a.release_year) || 0) : (Number(a.release_year) || 0) - (Number(b.release_year) || 0);
    if (sortField === 'units') {
      const uA = getAggregateProgress(getTracks(a)).total || getAggregateProgress(getTracks(a)).done;
      const uB = getAggregateProgress(getTracks(b)).total || getAggregateProgress(getTracks(b)).done;
      return sortDir === 'desc' ? uB - uA : uA - uB;
    }
    if (sortField === 'title') {
      const cmp = (a.title || '').localeCompare(b.title || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return sortDir === 'desc' ? new Date(b.updated_at || 0) - new Date(a.updated_at || 0) : new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
  });

  if (!list.length) {
    grid.innerHTML = `<div class="state-message">No entries match current filters.</div>`;
    loadWrap.style.display = 'none';
    return;
  }

  const shown = list.slice(0, visibleLimit);
  const rest = list.length - shown.length;
  loadWrap.style.display = rest > 0 ? 'flex' : 'none';
  if (rest > 0) document.getElementById('load-more-text').textContent = `Load More (${rest})`;

  if (viewMode === 'list') {
    grid.innerHTML = shown.map(item => {
      const id = esc(item.id);
      const cover = cleanUrl(item.cover_url) || 'https://placehold.co/80x120/19191f/727280?text=—';
      const synced = getSyncedStatus(getTracks(item));
      const agg = getAggregateProgress(getTracks(item));
      const score = Number(item.rating) > 0 ? `★ ${Number(item.rating).toFixed(2).replace(/\.00$/, '.0')}` : '—';
      return `
        <div class="list-row" onclick="openDetailModal('${id}')">
          <div class="list-left">
            <img class="list-thumb" src="${cover}" alt="" loading="lazy">
            <div style="min-width:0;">
              <div class="list-title">${esc(item.title)}</div>
              <div class="list-meta">${esc(getPosterCategoryBadge(item))} · ${esc(synced.label)} · ${esc(agg.fullText)}</div>
            </div>
          </div>
          <div class="list-right">
            <span class="badge-pill">${score}</span>
            ${isAdmin ? `<button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openEditModal('${id}')">Edit</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  grid.innerHTML = shown.map(item => {
    const id = esc(item.id);
    const cover = cleanUrl(item.cover_url) || 'https://placehold.co/300x450/19191f/727280?text=NO+COVER';
    const synced = getSyncedStatus(getTracks(item));
    const agg = getAggregateProgress(getTracks(item));
    return `
      <article class="card" onclick="openDetailModal('${id}')">
        <div class="card-poster">
          <div class="card-top-row">
            <span class="chip-dark">${esc(getPosterCategoryBadge(item))}</span>
            ${Number(item.rating) > 0 ? `<span class="chip-dark chip-rating">★ ${Number(item.rating).toFixed(1)}</span>` : ''}
          </div>
          <img src="${cover}" alt="${esc(item.title)}" loading="lazy">
        </div>
        <div class="card-info">
          <h3 class="card-title">${esc(item.title)}</h3>
          <div class="card-sub"><span>${esc(synced.label)}</span><span>${esc(agg.text)}</span></div>
        </div>
      </article>
    `;
  }).join('');
}

// ==============================================================================
// 8. DETAIL MODAL
// ==============================================================================
window.switchSubTab = function (tab) {
  document.querySelectorAll('#detail-content .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('#detail-content .sub-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
};

window.openDetailModal = function (id) {
  const item = mediaItems.find(m => String(m.id) === String(id));
  if (!item) return;
  const safeId = esc(item.id);
  const catBadge = getPosterCategoryBadge(item);
  const cover = cleanUrl(item.cover_url) || 'https://placehold.co/300x450/19191f/727280?text=NO+COVER';
  const banner = cleanUrl(item.banner_url);
  const tracks = getTracks(item);
  const synced = getSyncedStatus(tracks);
  const meta = item.metadata_json || {};
  const score = Number(item.rating) > 0 ? `★ ${Number(item.rating).toFixed(2).replace(/\.00$/, '.0')} / 10` : 'Unrated';

  const specs = [
    { k: 'Category', v: [catBadge, meta.season_name].filter(Boolean).join(' · ') },
    { k: 'Release', v: [item.release_date || item.release_year, item.content_rating].filter(Boolean).join(' · ') },
    { k: 'Duration', v: meta.runtime_minutes ? `${meta.runtime_minutes} min / unit` : '' },
    { k: 'Source / ISBN', v: meta.source_isbn || '' },
    { k: 'Creators', v: (meta.creators || []).join(', ') },
    { k: 'Producers / Platform', v: (meta.producers || []).join(', ') },
    { k: 'Cast / Staff', v: (meta.cast || []).join(', ') },
    { k: 'Timeline', v: [item.start_date ? `Start ${item.start_date}` : '', item.finish_date ? `End ${item.finish_date}` : ''].filter(Boolean).join(' → ') }
  ].filter(x => x.v);

  document.getElementById('detail-type-tag').textContent = catBadge;
  document.getElementById('detail-content').innerHTML = `
    <div class="hero-card ${banner ? 'with-banner' : ''}">
      ${banner ? `<img class="hero-banner" src="${banner}" alt="" onerror="this.style.display='none'">` : ''}
      <div class="hero-main">
        <div class="hero-poster"><img src="${cover}" alt=""></div>
        <div>
          <h2 class="hero-title">${esc(item.title)}</h2>
          ${item.original_title && item.original_title !== item.title ? `<div class="hero-native">${esc(item.original_title)}</div>` : ''}
          <div class="badge-row">
            <span class="chip-light">${esc(score)}</span>
            <span class="badge-pill">${esc(synced.label)}</span>
            ${item.is_favorite ? `<span class="badge-pill">★ Favorite</span>` : ''}
            ${renderExternalRatingsHtml(item.external_ratings)}
          </div>
        </div>
      </div>
    </div>

    <div class="sub-tabs">
      <button type="button" class="sub-tab active" data-tab="overview" onclick="switchSubTab('overview')">Overview</button>
      <button type="button" class="sub-tab" data-tab="specs" onclick="switchSubTab('specs')">Specifications</button>
    </div>

    <div class="sub-pane active" data-pane="overview">
      ${item.synopsis ? `<div class="prose-box">${esc(item.synopsis)}</div>` : ''}
      ${(meta.genres?.length || meta.tags?.length) ? `<div class="badge-row">${(meta.genres || []).map(g => `<span class="genre-chip">${esc(g)}</span>`).join('')}${(meta.tags || []).map(t => `<span class="genre-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="field">
        <span class="field-label">Progress Tracks</span>
        ${tracks.map(t => {
          const pct = t.total_units > 0 ? Math.min(100, Math.round((t.progress / t.total_units) * 100)) : (t.status === 'completed' ? 100 : 0);
          return `<div class="ws-item-card"><div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;"><span>${esc(t.label)}</span><span class="subtle-meta">${t.progress}${t.total_units ? ` / ${t.total_units}` : ''} ${esc(t.unit_label || '')} · ${pct}%</span></div><div class="prog-line"><div style="width:${pct}%"></div></div></div>`;
        }).join('')}
      </div>
      ${item.personal_notes ? `<div class="field"><span class="field-label">Personal Notes</span><div class="prose-box">${esc(item.personal_notes)}</div></div>` : ''}
    </div>

    <div class="sub-pane" data-pane="specs">
      ${specs.length ? `<div class="spec-grid">${specs.map(s => `<div class="spec-cell"><div class="spec-key">${esc(s.k)}</div><div class="spec-val">${esc(s.v)}</div></div>`).join('')}</div>` : '<div class="subtle-meta">No specifications recorded.</div>'}
    </div>

    ${isAdmin ? `<div class="dialog-footer" style="padding:12px 0 0; background:transparent;"><button type="button" class="btn btn-solid" onclick="closeDetailModal(); openEditModal('${safeId}')">Edit Entry</button></div>` : ''}
  `;
  document.getElementById('detail-modal').classList.add('active');
  syncBodyScrollLock();
};

window.closeDetailModal = () => {
  document.getElementById('detail-modal').classList.remove('active');
  syncBodyScrollLock();
};

// ==============================================================================
// 9. WORKSPACE (NOTES, TO-DO & GOALS)
// ==============================================================================
async function loadWorkspace() {
  const { data, error } = await db.from('workspace_items').select('*').order('created_at', { ascending: false });
  if (!error && Array.isArray(data)) {
    workspaceItems = data;
    localStorage.setItem('mv_workspace_cache', JSON.stringify(workspaceItems));
  } else {
    try { workspaceItems = JSON.parse(localStorage.getItem('mv_workspace_cache') || '[]'); } catch { workspaceItems = []; }
  }
  renderWorkspace();
  renderHomeWidgets();
}

async function persistWorkspaceRecord(record, isUpdate = false) {
  localStorage.setItem('mv_workspace_cache', JSON.stringify(workspaceItems));
  if (!isAdmin) return;
  try {
    if (isUpdate) await db.from('workspace_items').update(record).eq('id', record.id);
    else await db.from('workspace_items').insert([record]);
  } catch {}
}

async function removeWorkspaceRecord(id) {
  workspaceItems = workspaceItems.filter(x => String(x.id) !== String(id));
  localStorage.setItem('mv_workspace_cache', JSON.stringify(workspaceItems));
  if (!isAdmin) return;
  try { await db.from('workspace_items').delete().eq('id', id); } catch {}
}

window.switchWorkspaceTab = function (tab, el) {
  document.querySelectorAll('#page-workspace .seg-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const layout = document.querySelector('.workspace-layout');
  layout.classList.toggle('single-col', tab !== 'all');
  document.querySelectorAll('.ws-col').forEach(col => {
    col.style.display = (tab === 'all' || col.dataset.wsCol === tab) ? 'flex' : 'none';
  });
};

function renderWorkspace() {
  const notes = workspaceItems.filter(x => x.kind === 'note').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const todos = workspaceItems.filter(x => x.kind === 'todo');
  const goals = workspaceItems.filter(x => x.kind === 'goal');

  const noteQuery = (document.getElementById('note-search')?.value || '').toLowerCase().trim();
  const filteredNotes = noteQuery ? notes.filter(n => `${n.title} ${n.content || ''} ${n.tag || ''}`.toLowerCase().includes(noteQuery)) : notes;

  document.getElementById('ws-notes-list').innerHTML = filteredNotes.length ? filteredNotes.map(n => `
    <div class="ws-item-card" style="cursor:pointer;" onclick="openNoteEditor('${esc(n.id)}')">
      <div style="display:flex; justify-content:space-between; gap:8px;"><strong>${n.pinned ? '★ ' : ''}${esc(n.title)}</strong>${n.tag ? `<span class="badge-pill">${esc(n.tag)}</span>` : ''}</div>
      ${n.content ? `<div class="subtle-meta">${esc(n.content.slice(0, 120))}</div>` : ''}
    </div>
  `).join('') : `<div class="subtle-meta">No notes yet.</div>`;

  const doneCount = todos.filter(t => t.status === 'done').length;
  document.getElementById('todo-counter').textContent = `${doneCount}/${todos.length} done`;
  document.getElementById('ws-todos-list').innerHTML = todos.length ? todos.map(t => `
    <div class="todo-item ${t.status === 'done' ? 'is-done' : ''}">
      <div class="todo-check-wrap" onclick="toggleTodo('${esc(t.id)}')"><span class="custom-checkbox">${t.status === 'done' ? '✓' : ''}</span><span class="todo-text">${esc(t.title)}</span></div>
      <div style="display:flex; gap:6px; align-items:center;">${t.tag === 'high' ? `<span class="badge-pill">High</span>` : ''}<button type="button" class="btn-close" onclick="deleteTodo('${esc(t.id)}')"><ion-icon name="trash-outline"></ion-icon></button></div>
    </div>
  `).join('') : `<div class="subtle-meta">No tasks in queue.</div>`;

  document.getElementById('ws-goals-list').innerHTML = goals.length ? goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
    return `
      <div class="ws-item-card" style="cursor:pointer;" onclick="openGoalEditor('${esc(g.id)}')">
        <div style="display:flex; justify-content:space-between;"><strong>${esc(g.title)}</strong><span class="badge-pill">${pct}%</span></div>
        <div class="prog-line"><div style="width:${pct}%"></div></div>
        <div style="display:flex; justify-content:space-between; align-items:center;" class="subtle-meta">
          <span>${g.progress} / ${g.target} ${esc(g.tag || '')}</span>
          <div style="display:flex; gap:6px;" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-ghost btn-sm" onclick="stepGoal('${esc(g.id)}', -1)">-1</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="stepGoal('${esc(g.id)}', 1)">+1</button>
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div class="subtle-meta">No goals defined.</div>`;

  document.getElementById('home-notes-preview').innerHTML = notes.slice(0, 4).map(n => `<div class="ws-item-card" style="cursor:pointer;" onclick="openNoteEditor('${esc(n.id)}')"><strong>${n.pinned ? '★ ' : ''}${esc(n.title)}</strong><div class="subtle-meta">${esc((n.content || '').slice(0, 80) || 'Empty note')}</div></div>`).join('') || `<div class="subtle-meta">No notes yet.</div>`;
  document.getElementById('home-todos-preview').innerHTML = todos.filter(t => t.status !== 'done').slice(0, 4).map(t => `<div class="todo-item"><div class="todo-check-wrap" onclick="toggleTodo('${esc(t.id)}')"><span class="custom-checkbox"></span><span class="todo-text">${esc(t.title)}</span></div></div>`).join('') || `<div class="subtle-meta">All tasks completed.</div>`;
  document.getElementById('home-goals-preview').innerHTML = goals.slice(0, 3).map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
    return `<div class="ws-item-card" style="cursor:pointer;" onclick="openGoalEditor('${esc(g.id)}')"><div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;"><span>${esc(g.title)}</span><span>${pct}%</span></div><div class="prog-line"><div style="width:${pct}%"></div></div></div>`;
  }).join('') || `<div class="subtle-meta">No active goals.</div>`;
}

window.openNoteEditor = function (id = null) {
  const note = id ? workspaceItems.find(x => String(x.id) === String(id)) : null;
  document.getElementById('note-edit-id').value = note ? note.id : '';
  document.getElementById('note-modal-heading').textContent = note ? 'Edit Note' : 'New Note';
  document.getElementById('note-title').value = note ? note.title : '';
  document.getElementById('note-tag').value = note ? (note.tag || '') : '';
  document.getElementById('note-content').value = note ? (note.content || '') : '';
  document.getElementById('note-pinned').value = note?.pinned ? 'true' : 'false';
  document.getElementById('btn-pin-note').textContent = note?.pinned ? 'Pin: On ★' : 'Pin: Off';
  document.getElementById('btn-delete-note').style.display = note ? 'inline-flex' : 'none';
  document.getElementById('note-modal').classList.add('active');
  syncBodyScrollLock();
};
window.closeNoteModal = () => {
  document.getElementById('note-modal').classList.remove('active');
  syncBodyScrollLock();
};
window.toggleNotePin = function () {
  const el = document.getElementById('note-pinned');
  const next = el.value === 'true' ? 'false' : 'true';
  el.value = next;
  document.getElementById('btn-pin-note').textContent = next === 'true' ? 'Pin: On ★' : 'Pin: Off';
};
window.saveNoteItem = async function (e) {
  e.preventDefault();
  const id = document.getElementById('note-edit-id').value;
  const rec = { id: id || crypto.randomUUID(), kind: 'note', title: document.getElementById('note-title').value.trim(), tag: document.getElementById('note-tag').value.trim(), content: document.getElementById('note-content').value, pinned: document.getElementById('note-pinned').value === 'true', updated_at: new Date().toISOString() };
  if (id) workspaceItems = workspaceItems.map(x => String(x.id) === String(id) ? { ...x, ...rec } : x);
  else workspaceItems.unshift({ ...rec, created_at: new Date().toISOString() });
  await persistWorkspaceRecord(rec, Boolean(id));
  closeNoteModal(); renderWorkspace(); renderHomeWidgets();
};
window.deleteNoteItem = async function () {
  const id = document.getElementById('note-edit-id').value;
  if (!id) return;
  await removeWorkspaceRecord(id);
  closeNoteModal(); renderWorkspace(); renderHomeWidgets();
};
window.addTodoItem = async function (e) {
  e.preventDefault();
  const input = document.getElementById('todo-input');
  const title = input.value.trim();
  if (!title) return;
  const rec = { id: crypto.randomUUID(), kind: 'todo', title, tag: document.getElementById('todo-prio').value, status: 'active', created_at: new Date().toISOString() };
  workspaceItems.unshift(rec); input.value = '';
  await persistWorkspaceRecord(rec, false);
  renderWorkspace(); renderHomeWidgets();
};
window.toggleTodo = async function (id) {
  const item = workspaceItems.find(x => String(x.id) === String(id));
  if (!item) return;
  item.status = item.status === 'done' ? 'active' : 'done';
  await persistWorkspaceRecord(item, true);
  renderWorkspace(); renderHomeWidgets();
};
window.deleteTodo = async function (id) { await removeWorkspaceRecord(id); renderWorkspace(); renderHomeWidgets(); };

window.openGoalEditor = function (id = null) {
  const g = id ? workspaceItems.find(x => String(x.id) === String(id)) : null;
  document.getElementById('goal-edit-id').value = g ? g.id : '';
  document.getElementById('goal-modal-heading').textContent = g ? 'Edit Goal' : 'New Goal';
  document.getElementById('goal-title').value = g ? g.title : '';
  document.getElementById('goal-progress').value = g ? g.progress : 0;
  document.getElementById('goal-target').value = g ? g.target : 100;
  document.getElementById('goal-tag').value = g ? (g.tag || '') : '';
  document.getElementById('goal-due').value = g ? (g.due_date || '') : '';
  document.getElementById('btn-delete-goal').style.display = g ? 'inline-flex' : 'none';
  document.getElementById('goal-modal').classList.add('active');
  syncBodyScrollLock();
};
window.closeGoalModal = () => {
  document.getElementById('goal-modal').classList.remove('active');
  syncBodyScrollLock();
};
window.saveGoalItem = async function (e) {
  e.preventDefault();
  const id = document.getElementById('goal-edit-id').value;
  const rec = { id: id || crypto.randomUUID(), kind: 'goal', title: document.getElementById('goal-title').value.trim(), progress: Number(document.getElementById('goal-progress').value) || 0, target: Math.max(1, Number(document.getElementById('goal-target').value) || 100), tag: document.getElementById('goal-tag').value.trim(), due_date: document.getElementById('goal-due').value.trim(), updated_at: new Date().toISOString() };
  if (id) workspaceItems = workspaceItems.map(x => String(x.id) === String(id) ? { ...x, ...rec } : x);
  else workspaceItems.unshift({ ...rec, created_at: new Date().toISOString() });
  await persistWorkspaceRecord(rec, Boolean(id));
  closeGoalModal(); renderWorkspace(); renderHomeWidgets();
};
window.stepGoal = async function (id, delta) {
  const g = workspaceItems.find(x => String(x.id) === String(id));
  if (!g) return;
  g.progress = Math.max(0, (Number(g.progress) || 0) + delta);
  await persistWorkspaceRecord(g, true);
  renderWorkspace(); renderHomeWidgets();
};
window.deleteGoalItem = async function () {
  const id = document.getElementById('goal-edit-id').value;
  if (!id) return;
  await removeWorkspaceRecord(id);
  closeGoalModal(); renderWorkspace(); renderHomeWidgets();
};

// ==============================================================================
// 10. MULTI-PROVIDER METADATA FETCH ENGINE
// ==============================================================================
async function fetchAniList(query, type = 'ANIME', desiredSubtype = null) {
  const gql = `query($s:String,$t:MediaType){Page(perPage:8){media(search:$s,type:$t,sort:SEARCH_MATCH){id idMal title{romaji english native} synonyms format countryOfOrigin description(asHtml:false) season seasonYear startDate{year month day} episodes chapters volumes duration source genres tags{name isMediaSpoiler} averageScore coverImage{extraLarge large} bannerImage studios(isMain:true){nodes{name}} staff(perPage:8){edges{role node{name{full}}}} characters(perPage:8,sort:ROLE){nodes{name{full}}} relations{edges{relationType node{title{romaji english}}}} siteUrl}}}`;
  const res = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gql, variables: { s: query, t: type } }) });
  const json = await res.json();
  return (json?.data?.Page?.media || []).map(m => {
    const isManga = type === 'MANGA';
    let sub = desiredSubtype || (isManga ? 'manga' : 'anime');
    if (!desiredSubtype) {
      if (m.format === 'NOVEL') sub = 'light_novel';
      else if (!isManga && m.countryOfOrigin === 'CN') sub = 'donghua';
      else if (isManga && m.countryOfOrigin === 'KR') sub = 'manhwa';
      else if (isManga && m.countryOfOrigin === 'CN') sub = 'manhua';
    }
    const y = m.seasonYear || m.startDate?.year || null;
    const creators = isManga
      ? (m.staff?.edges || []).filter(e => /story|art|author/i.test(e.role)).map(e => e.node?.name?.full).filter(Boolean)
      : (m.studios?.nodes || []).map(s => s.name).filter(Boolean);
    return {
      provider: 'AniList', media_subtype: sub,
      title: m.title?.romaji || m.title?.english || m.title?.native || 'Untitled',
      original_title: m.title?.native || '', english_title: m.title?.english || '',
      alt_titles: m.synonyms || [], cover_url: m.coverImage?.extraLarge || m.coverImage?.large || '',
      banner_url: m.bannerImage || '', synopsis: stripTags(m.description),
      release_date: y ? `${y}-${String(m.startDate?.month || 1).padStart(2, '0')}-${String(m.startDate?.day || 1).padStart(2, '0')}` : '',
      release_year: y, runtime_minutes: m.duration || null,
      season_name: m.season && m.seasonYear ? `${m.season} ${m.seasonYear}` : '',
      source_isbn: m.source || '', genres: m.genres || [],
      tags: (m.tags || []).filter(t => !t.isMediaSpoiler).slice(0, 12).map(t => t.name),
      creators: uniqueList(creators), producers: [],
      cast: (m.characters?.nodes || []).map(c => c.name?.full).filter(Boolean),
      total_units: isManga ? (m.chapters || m.volumes || 0) : (m.episodes || 0),
      unit_label: DEFAULT_UNIT_BY_TYPE[sub] || (isManga ? 'Chapter' : 'Episode'),
      external_ratings: m.averageScore ? { AniList: `${(m.averageScore / 10).toFixed(1)}` } : {},
      relations: (m.relations?.edges || []).map(r => ({ relation: r.relationType, title: r.node?.title?.romaji || r.node?.title?.english || '' })),
      external_links: [{ name: 'AniList', url: m.siteUrl }]
    };
  });
}

async function fetchJikan(query, endpoint = 'anime', desiredSubtype = null) {
  let url = `https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(query)}&limit=10`;
  if (endpoint === 'manga') {
    if (desiredSubtype === 'light_novel' || desiredSubtype === 'novel') url += '&type=lightnovel';
    else if (desiredSubtype === 'manhwa') url += '&type=manhwa';
    else if (desiredSubtype === 'manhua') url += '&type=manhua';
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 429 ? 'MAL rate limited, wait 2 seconds.' : `MAL API error (${res.status})`);
  const json = await res.json();
  return (json?.data || []).map(m => {
    const isManga = endpoint === 'manga';
    const sub = desiredSubtype || (isManga ? 'manga' : 'anime');
    const durMatch = String(m.duration || '').match(/(\d+)\s*min/i);
    return {
      provider: 'MAL', media_subtype: sub, title: m.title || 'Untitled',
      original_title: m.title_japanese || '', english_title: m.title_english || '',
      alt_titles: m.title_synonyms || [],
      cover_url: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || '',
      banner_url: m.trailer?.images?.maximum_image_url || '',
      synopsis: m.synopsis || '',
      release_date: (m.aired?.from || m.published?.from || '').slice(0, 10),
      release_year: m.year || m.aired?.prop?.from?.year || m.published?.prop?.from?.year || null,
      content_rating: m.rating || '', runtime_minutes: durMatch ? Number(durMatch[1]) : null,
      season_name: m.season && m.year ? `${m.season.toUpperCase()} ${m.year}` : '',
      source_isbn: m.source || '',
      genres: (m.genres || []).map(g => g.name),
      tags: [...(m.themes || []).map(t => t.name), ...(m.demographics || []).map(d => d.name)],
      creators: (isManga ? (m.authors || []) : (m.studios || [])).map(x => x.name),
      producers: (isManga ? (m.serializations || []) : (m.producers || [])).map(p => p.name),
      cast: [], total_units: isManga ? (m.chapters || m.volumes || 0) : (m.episodes || 0),
      unit_label: DEFAULT_UNIT_BY_TYPE[sub] || (isManga ? 'Chapter' : 'Episode'),
      external_ratings: m.score ? { MAL: `${Number(m.score).toFixed(2)}` } : {},
      relations: [], external_links: [{ name: 'MyAnimeList', url: m.url }]
    };
  });
}

async function fetchMangaDex(query, desiredSubtype = null) {
  const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=8&includes[]=cover_art&includes[]=author&includes[]=artist`);
  const json = await res.json();
  return (json?.data || []).map(m => {
    const a = m.attributes || {};
    const t = a.title || {};
    const cov = (m.relationships || []).find(r => r.type === 'cover_art')?.attributes?.fileName;
    let sub = desiredSubtype || 'manga';
    if (!desiredSubtype) {
      if (a.originalLanguage === 'ko') sub = 'manhwa';
      else if (a.originalLanguage === 'zh' || a.originalLanguage === 'zh-hk') sub = 'manhua';
    }
    return {
      provider: 'MangaDex', media_subtype: sub,
      title: t.en || t['ja-ro'] || Object.values(t)[0] || 'Untitled',
      original_title: t.ja || t.ko || t.zh || '', english_title: t.en || '', alt_titles: [],
      cover_url: cov ? `https://uploads.mangadex.org/covers/${m.id}/${cov}.512.jpg` : '',
      banner_url: '', synopsis: a.description?.en || '',
      release_date: a.year ? `${a.year}-01-01` : '', release_year: a.year || null,
      genres: (a.tags || []).filter(x => x.attributes?.group === 'genre').map(x => x.attributes?.name?.en).filter(Boolean),
      tags: (a.tags || []).filter(x => x.attributes?.group === 'theme').map(x => x.attributes?.name?.en).filter(Boolean),
      creators: uniqueList((m.relationships || []).filter(r => r.type === 'author' || r.type === 'artist').map(r => r.attributes?.name)),
      producers: [], cast: [], total_units: Number(a.lastChapter) || Number(a.lastVolume) || 0,
      unit_label: a.lastChapter ? 'Chapter' : 'Volume',
      external_ratings: {}, relations: [], external_links: [{ name: 'MangaDex', url: `https://mangadex.org/title/${m.id}` }]
    };
  });
}

async function fetchOpenLibrary(query, desiredSubtype = 'book') {
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
  const json = await res.json();
  return (json?.docs || []).map(b => ({
    provider: 'OpenLibrary', media_subtype: desiredSubtype || 'book', title: b.title || 'Untitled',
    original_title: b.title || '', english_title: b.title || '', alt_titles: [],
    cover_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '', banner_url: '',
    synopsis: Array.isArray(b.first_sentence) ? b.first_sentence.join(' ') : (b.first_sentence || ''),
    release_date: b.first_publish_year ? `${b.first_publish_year}-01-01` : '', release_year: b.first_publish_year || null,
    source_isbn: (b.isbn || [])[0] || '', genres: (b.subject || []).slice(0, 6), tags: [],
    creators: b.author_name || [], producers: (b.publisher || []).slice(0, 3), cast: [],
    total_units: b.number_of_pages_median || 1, unit_label: DEFAULT_UNIT_BY_TYPE[desiredSubtype] || 'Page',
    external_ratings: b.ratings_average ? { OpenLibrary: `${Number(b.ratings_average).toFixed(1)}/5` } : {},
    relations: [], external_links: [{ name: 'Open Library', url: `https://openlibrary.org${b.key}` }]
  }));
}

async function fetchTVmaze(query) {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
  const list = await res.json();
  return (list || []).slice(0, 8).map(({ show: s }) => ({
    provider: 'TVmaze', media_subtype: 'tv', title: s.name || 'Untitled',
    original_title: s.name || '', english_title: s.name || '', alt_titles: [],
    cover_url: s.image?.original || s.image?.medium || '', banner_url: s.image?.original || '',
    synopsis: stripTags(s.summary), release_date: s.premiered || '',
    release_year: s.premiered ? Number(s.premiered.slice(0, 4)) : null,
    runtime_minutes: s.averageRuntime || s.runtime || null, genres: s.genres || [], tags: [],
    creators: s.network?.name ? [s.network.name] : (s.webChannel?.name ? [s.webChannel.name] : []),
    producers: [], cast: [], total_units: 0, unit_label: 'Episode',
    external_ratings: s.rating?.average ? { TVmaze: `${s.rating.average}` } : {},
    relations: [], external_links: [{ name: 'TVmaze', url: s.url }]
  }));
}

async function fetchVNDB(query) {
  const res = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: ['search', '=', query], fields: 'id,title,alttitle,released,rating,length_minutes,description,image.url,developers.name,publishers.name,tags.name', results: 8 })
  });
  const json = await res.json();
  return (json?.results || []).map(v => ({
    provider: 'VNDB', media_subtype: 'vn', title: v.title || 'Untitled',
    original_title: v.alttitle || '', english_title: v.title || '', alt_titles: [],
    cover_url: v.image?.url || '', banner_url: v.image?.url || '', synopsis: stripTags(v.description),
    release_date: v.released && v.released !== 'TBA' ? v.released : '',
    release_year: v.released && v.released !== 'TBA' ? Number(v.released.slice(0, 4)) : null,
    runtime_minutes: v.length_minutes || null,
    genres: (v.tags || []).slice(0, 5).map(t => t.name), tags: (v.tags || []).slice(5, 12).map(t => t.name),
    creators: (v.developers || []).map(d => d.name), producers: (v.publishers || []).map(p => p.name),
    cast: [], total_units: 1, unit_label: 'Route',
    external_ratings: v.rating ? { VNDB: `${(v.rating / 10).toFixed(2)}` } : {},
    relations: [], external_links: [{ name: 'VNDB', url: `https://vndb.org/${v.id}` }]
  }));
}

async function fetchMusicBrainz(query) {
  const res = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=8`, { headers: { Accept: 'application/json' } });
  const json = await res.json();
  return (json?.releases || []).map(r => {
    const artist = (r['artist-credit'] || []).map(a => a.name).join(', ');
    const tracks = (r.media || []).reduce((s, m) => s + (m['track-count'] || 0), 0);
    return {
      provider: 'MusicBrainz', media_subtype: 'music', title: r.title || 'Untitled',
      original_title: r.title || '', english_title: r.title || '', alt_titles: [],
      cover_url: `https://coverartarchive.org/release/${r.id}/front-500`, banner_url: '',
      synopsis: artist ? `Album / Release by ${artist}` : '',
      release_date: r.date || '', release_year: r.date ? Number(r.date.slice(0, 4)) : null,
      genres: (r.tags || []).map(t => t.name), tags: [],
      creators: artist ? [artist] : [], producers: [], cast: [],
      total_units: tracks || 1, unit_label: 'Track', external_ratings: {}, relations: [],
      external_links: [{ name: 'MusicBrainz', url: `https://musicbrainz.org/release/${r.id}` }]
    };
  });
}

async function fetchRAWG(query) {
  const key = localStorage.getItem('opt_rawg_key') || '';
  if (!key) throw new Error('Set RAWG API key in Settings first.');
  const res = await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=8`);
  const json = await res.json();
  return (json?.results || []).map(g => ({
    provider: 'RAWG', media_subtype: 'game', title: g.name,
    original_title: g.name, english_title: g.name, alt_titles: [],
    cover_url: g.background_image || '', banner_url: g.background_image || '', synopsis: '',
    release_date: g.released || '', release_year: g.released ? Number(g.released.slice(0, 4)) : null,
    genres: (g.genres || []).map(x => x.name), tags: (g.tags || []).slice(0, 8).map(x => x.name),
    creators: [], producers: (g.platforms || []).map(p => p.platform?.name).filter(Boolean),
    cast: [], total_units: 100, unit_label: 'Percent',
    external_ratings: g.rating ? { RAWG: `${g.rating}/5` } : {},
    relations: [], external_links: [{ name: 'RAWG', url: `https://rawg.io/games/${g.slug}` }]
  }));
}

async function fetchTMDB(query, subtype = 'movie') {
  const key = localStorage.getItem('opt_tmdb_key') || '';
  if (!key) throw new Error('Set TMDB API key in Settings first.');
  const ep = subtype === 'tv' ? 'tv' : 'movie';
  const res = await fetch(`https://api.themoviedb.org/3/search/${ep}?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}`);
  const json = await res.json();
  return (json?.results || []).slice(0, 8).map(item => {
    const title = item.title || item.name || 'Untitled';
    const rel = item.release_date || item.first_air_date || '';
    return {
      provider: 'TMDB', media_subtype: ep, title,
      original_title: item.original_title || item.original_name || '', english_title: title, alt_titles: [],
      cover_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
      banner_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
      synopsis: item.overview || '', release_date: rel, release_year: rel ? Number(rel.slice(0, 4)) : null,
      genres: [], tags: [], creators: [], producers: [], cast: [],
      total_units: ep === 'movie' ? 1 : 0, unit_label: ep === 'movie' ? 'Movie' : 'Episode',
      external_ratings: item.vote_average ? { TMDB: `${Number(item.vote_average).toFixed(2)}` } : {},
      relations: [], external_links: [{ name: 'TMDB', url: `https://www.themoviedb.org/${ep}/${item.id}` }]
    };
  });
}

async function runSingleProvider(provider, query, subtype) {
  const isMangaLike = ['manga', 'manhwa', 'manhua', 'comic', 'light_novel', 'web_novel', 'novel', 'book'].includes(subtype);
  if (provider === 'anilist') return await fetchAniList(query, isMangaLike ? 'MANGA' : 'ANIME', subtype);
  if (provider === 'jikan') return await fetchJikan(query, isMangaLike ? 'manga' : 'anime', subtype);
  if (provider === 'mangadex') return await fetchMangaDex(query, subtype);
  if (provider === 'openlibrary') return await fetchOpenLibrary(query, subtype);
  if (provider === 'tvmaze') return await fetchTVmaze(query);
  if (provider === 'vndb') return await fetchVNDB(query);
  if (provider === 'musicbrainz') return await fetchMusicBrainz(query);
  if (provider === 'rawg') return await fetchRAWG(query);
  if (provider === 'tmdb') return await fetchTMDB(query, subtype);
  return [];
}

window.searchMetadata = async function () {
  const query = document.getElementById('api-query').value.trim();
  const subtype = document.getElementById('form-subtype').value;
  const selectedProvider = document.getElementById('form-provider').value;
  if (!query) return;

  const drawer = document.getElementById('api-results');
  const btn = document.getElementById('btn-fetch');
  btn.disabled = true;
  drawer.style.display = 'block';
  const providerQueue = selectedProvider === 'auto' ? (DEFAULT_PROVIDERS[subtype] || ['anilist', 'jikan']) : [selectedProvider];

  try {
    let res = [], lastError = null;
    for (const prov of providerQueue) {
      drawer.innerHTML = `<div style="padding:12px;" class="subtle-meta">Searching ${esc(prov)}...</div>`;
      try {
        const found = await runSingleProvider(prov, query, subtype);
        if (found && found.length > 0) { res = found; break; }
      } catch (err) {
        lastError = err;
        if (selectedProvider !== 'auto') throw err;
      }
    }
    searchResults = res;
    if (!res.length) {
      drawer.innerHTML = `<div style="padding:12px;" class="subtle-meta">${lastError ? esc(lastError.message) : 'No matches found.'}</div>`;
      return;
    }
    drawer.innerHTML = res.map((r, i) => `
      <div class="result-row">
        <img src="${esc(r.cover_url || 'https://placehold.co/80x120/19191f/727280?text=—')}" alt="">
        <div style="min-width:0; flex:1;">
          <div style="font-weight:700; font-size:13px;">${esc(r.title)}</div>
          <div class="subtle-meta">${esc(TYPE_LABELS[r.media_subtype] || r.media_subtype)} · ${esc(r.provider)} ${r.release_year ? `· ${r.release_year}` : ''}</div>
        </div>
        <div class="result-actions">
          <button type="button" class="btn btn-solid btn-sm" onclick="applyMetadata(${i}, 'replace')">Replace</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="applyMetadata(${i}, 'merge')">+ Merge</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    drawer.innerHTML = `<div style="padding:12px; color:var(--text-2); font-size:12px;">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
};

window.applyMetadata = function (idx, mode = 'replace') {
  const m = searchResults[idx];
  if (!m) return;
  const drawer = document.getElementById('api-results');

  if (mode === 'merge') {
    addTrackRow({
      subtype: m.media_subtype,
      label: formatTrackLabel(m.media_subtype, m.title),
      status: 'planned',
      progress: 0,
      total_units: m.total_units || 0,
      unit_label: normalizeUnitName(m.unit_label, m.media_subtype)
    });
    drawer.style.display = 'none';
    return;
  }

  draftMeta = m;
  const sub = m.media_subtype || 'anime';
  document.getElementById('f-title').value = m.title || '';
  document.getElementById('f-orig-title').value = m.original_title || '';
  document.getElementById('f-eng-title').value = m.english_title || '';
  document.getElementById('f-alt-titles').value = (m.alt_titles || []).join(', ');
  document.getElementById('f-cover').value = m.cover_url || '';
  document.getElementById('f-banner').value = m.banner_url || '';
  document.getElementById('f-synopsis').value = m.synopsis || '';
  document.getElementById('f-release-date').value = m.release_date || '';
  document.getElementById('f-year').value = m.release_year || '';
  document.getElementById('f-age-rating').value = m.content_rating || '';
  document.getElementById('f-runtime').value = m.runtime_minutes || '';
  document.getElementById('f-season').value = m.season_name || '';
  document.getElementById('f-source').value = m.source_isbn || '';
  document.getElementById('f-creators').value = (m.creators || []).join(', ');
  document.getElementById('f-producers').value = (m.producers || []).join(', ');
  document.getElementById('f-genres').value = (m.genres || []).join(', ');
  document.getElementById('f-tags').value = (m.tags || []).join(', ');
  document.getElementById('f-cast').value = (m.cast || []).join(', ');

  pickFormSubtype(sub, TYPE_LABELS[sub] || 'Anime');
  const firstTrack = document.querySelector('#tracks-list .track-card');
  if (firstTrack) {
    firstTrack.dataset.subtype = sub;
    firstTrack.querySelector('.t-total').value = m.total_units || 0;
    const uName = normalizeUnitName(m.unit_label, sub);
    if (firstTrack.dataset.unitDrop) pickTrackDropdown(firstTrack.dataset.unitDrop, '.t-unit', uName, uName);
  }
  drawer.style.display = 'none';
};

// ==============================================================================
// 11. PROGRESS TRACKS & FORM SUBMISSION
// ==============================================================================
window.toggleFavoriteField = function () {
  const input = document.getElementById('form-favorite');
  const next = input.value === 'true' ? 'false' : 'true';
  input.value = next;
  document.getElementById('btn-fav-toggle').textContent = next === 'true' ? 'Yes ★' : 'No';
};

window.syncPrimaryTrackLabel = function () {
  const sub = document.getElementById('form-subtype').value;
  const title = document.getElementById('f-title').value.trim();
  const label = formatTrackLabel(sub, title || 'Primary Entry');
  const firstCard = document.querySelector('#tracks-list .track-card[data-primary="true"]');
  if (firstCard) {
    firstCard.dataset.subtype = sub;
    firstCard.querySelector('.t-label').value = label;
    firstCard.querySelector('.track-title-badge').textContent = label;
  }
};

window.pickTrackCategory = function (catDropId, catVal, catLabel, skipTopSync = false) {
  const wrap = document.querySelector(`.custom-select[data-select="${catDropId}"]`);
  if (!wrap) return;
  const card = wrap.closest('.track-card');
  wrap.querySelector('.t-subtype').value = catVal;
  wrap.classList.remove('open');
  wrap.querySelectorAll('.custom-option').forEach(o => o.classList.toggle('active', o.dataset.val === catVal));
  document.getElementById(`label-${catDropId}`).textContent = catLabel;

  if (card) {
    card.dataset.subtype = catVal;
    const rawPartTitle = card.dataset.primary === 'true'
      ? (document.getElementById('f-title')?.value.trim() || 'Primary Entry')
      : (extractRawTitleFromTrack(card.querySelector('.t-label').value) || 'Additional Part');
    const newLabel = formatTrackLabel(catVal, rawPartTitle);
    card.querySelector('.t-label').value = newLabel;
    card.querySelector('.track-title-badge').textContent = newLabel;
    if (card.dataset.primary === 'true' && !skipTopSync) {
      document.getElementById('form-subtype').value = catVal;
      pickOption('subtype', catVal, catLabel);
    }
  }
};

window.addTrackRow = function (t = {}, isPrimary = false) {
  const statusVal = t.status || 'ongoing';
  const statusLabels = { planned: 'Planned', ongoing: 'In Progress', completed: 'Completed', on_hold: 'On Hold', dropped: 'Dropped' };
  const sub = t.subtype || document.getElementById('form-subtype')?.value || 'anime';
  const unitVal = normalizeUnitName(t.unit_label, sub);
  const labelText = t.label || formatTrackLabel(sub, document.getElementById('f-title')?.value.trim() || 'Additional Part');

  const catDropId = 'trc_' + Math.random().toString(36).slice(2, 8);
  const statusDropId = 'trs_' + Math.random().toString(36).slice(2, 8);
  const unitDropId = 'tru_' + Math.random().toString(36).slice(2, 8);

  const card = document.createElement('div');
  card.className = 'track-card';
  card.dataset.subtype = sub;
  card.dataset.catDrop = catDropId;
  card.dataset.statusDrop = statusDropId;
  card.dataset.unitDrop = unitDropId;
  if (isPrimary) card.dataset.primary = 'true';

  card.innerHTML = `
    <div class="track-card-top">
      <input type="hidden" class="t-label" value="${esc(labelText)}">
      <span class="track-title-badge">${esc(labelText)}</span>
      <span class="subtle-meta">${isPrimary ? 'Primary Entry' : 'Merged Part'}</span>
    </div>
    <div class="track-row-top">
      <div class="custom-select" style="min-width:0; width:100%;" data-select="${catDropId}">
        <input type="hidden" class="t-subtype" value="${esc(sub)}">
        <button type="button" class="custom-select-trigger" onclick="toggleDropdown('${catDropId}')">
          <span id="label-${catDropId}">${esc(TYPE_LABELS[sub] || 'Anime')}</span>
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
        <div class="custom-select-menu scrollable-menu">
          ${Object.entries(TYPE_LABELS).map(([k, v]) => `<div class="custom-option ${k === sub ? 'active' : ''}" data-val="${k}" onclick="pickTrackCategory('${catDropId}', '${k}', '${v}')">${v}</div>`).join('')}
        </div>
      </div>
      <div class="custom-select" style="min-width:0; width:100%;" data-select="${statusDropId}">
        <input type="hidden" class="t-status" value="${esc(statusVal)}">
        <button type="button" class="custom-select-trigger" onclick="toggleDropdown('${statusDropId}')">
          <span id="label-${statusDropId}">${esc(statusLabels[statusVal] || 'In Progress')}</span>
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
        <div class="custom-select-menu">
          ${Object.entries(statusLabels).map(([k, v]) => `<div class="custom-option ${k === statusVal ? 'active' : ''}" data-val="${k}" onclick="pickTrackDropdown('${statusDropId}', '.t-status', '${k}', '${v}')">${v}</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="track-row-bottom ${isPrimary ? 'no-delete' : ''}">
      <div class="custom-select" style="min-width:0; width:100%;" data-select="${unitDropId}">
        <input type="hidden" class="t-unit" value="${esc(unitVal)}">
        <button type="button" class="custom-select-trigger" onclick="toggleDropdown('${unitDropId}')">
          <span id="label-${unitDropId}">${esc(unitVal)}</span>
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
        <div class="custom-select-menu scrollable-menu">
          ${FULL_UNIT_OPTIONS.map(u => `<div class="custom-option ${u === unitVal ? 'active' : ''}" data-val="${u}" onclick="pickTrackDropdown('${unitDropId}', '.t-unit', '${u}', '${u}')">${u}</div>`).join('')}
        </div>
      </div>
      <div class="ratio-input-box">
        <input type="number" class="t-prog" placeholder="0" min="0" value="${Number(t.progress) || 0}">
        <span>/</span>
        <input type="number" class="t-total" placeholder="Total" min="0" value="${Number(t.total_units) || 0}">
      </div>
      ${isPrimary ? '' : `<button type="button" class="btn btn-mono-trash btn-icon" onclick="this.closest('.track-card').remove()"><ion-icon name="trash-outline"></ion-icon></button>`}
    </div>
  `;
  document.getElementById('tracks-list').appendChild(card);
};

window.pickTrackDropdown = function (dropId, inputSelector, val, label) {
  const wrap = document.querySelector(`.custom-select[data-select="${dropId}"]`);
  if (!wrap) return;
  wrap.querySelector(inputSelector).value = val;
  wrap.classList.remove('open');
  wrap.querySelectorAll('.custom-option').forEach(o => o.classList.toggle('active', o.dataset.val === val));
  document.getElementById(`label-${dropId}`).textContent = label;
};

window.openAddModal = function () {
  draftMeta = null;
  document.getElementById('entry-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('form-heading').textContent = 'New Media Entry';
  document.getElementById('btn-delete').style.display = 'none';
  document.getElementById('api-results').style.display = 'none';
  document.getElementById('form-favorite').value = 'false';
  document.getElementById('btn-fav-toggle').textContent = 'No';

  const defaultCat = activeCategory !== 'all' ? activeCategory : 'anime';
  const box = document.getElementById('tracks-list');
  box.innerHTML = '';
  addTrackRow({ subtype: defaultCat, label: formatTrackLabel(defaultCat, 'Primary Entry'), status: 'ongoing', progress: 0, total_units: 0, unit_label: DEFAULT_UNIT_BY_TYPE[defaultCat] || 'Episode' }, true);
  pickFormSubtype(defaultCat, TYPE_LABELS[defaultCat] || 'Anime');
  const modal = document.getElementById('form-modal');
  modal.classList.add('active');
  const body = modal.querySelector('.dialog-body');
  if (body) body.scrollTop = 0;
  syncBodyScrollLock();
};

window.openEditModal = function (id) {
  const item = mediaItems.find(m => String(m.id) === String(id));
  if (!item) return;
  const meta = item.metadata_json || {};
  draftMeta = { external_ratings: item.external_ratings || {}, relations: meta.relations || [], external_links: meta.external_links || [] };
  const sub = getSubtype(item);

  document.getElementById('edit-id').value = item.id;
  document.getElementById('form-heading').textContent = 'Edit Media Entry';
  document.getElementById('btn-delete').style.display = 'inline-flex';
  document.getElementById('api-results').style.display = 'none';

  document.getElementById('f-title').value = item.title || '';
  document.getElementById('f-orig-title').value = item.original_title || '';
  document.getElementById('f-eng-title').value = item.english_title || '';
  document.getElementById('f-alt-titles').value = (item.alt_titles || []).join(', ');
  document.getElementById('f-cover').value = item.cover_url || '';
  document.getElementById('f-banner').value = item.banner_url || '';
  document.getElementById('f-extra-covers').value = (meta.extra_covers || []).join('\n');
  document.getElementById('f-synopsis').value = item.synopsis || '';
  document.getElementById('f-release-date').value = item.release_date || '';
  document.getElementById('f-year').value = item.release_year || '';
  document.getElementById('f-age-rating').value = item.content_rating || '';
  document.getElementById('f-runtime').value = meta.runtime_minutes || '';
  document.getElementById('f-season').value = meta.season_name || '';
  document.getElementById('f-source').value = meta.source_isbn || '';
  document.getElementById('f-creators').value = (meta.creators || []).join(', ');
  document.getElementById('f-producers').value = (meta.producers || []).join(', ');
  document.getElementById('f-genres').value = (meta.genres || []).join(', ');
  document.getElementById('f-tags').value = (meta.tags || []).join(', ');
  document.getElementById('f-cast').value = (meta.cast || []).join(', ');
  document.getElementById('f-rating').value = item.rating ?? '';
  document.getElementById('f-repeat').value = item.repeat_count || 0;
  document.getElementById('form-favorite').value = item.is_favorite ? 'true' : 'false';
  document.getElementById('btn-fav-toggle').textContent = item.is_favorite ? 'Yes ★' : 'No';
  document.getElementById('f-start-date').value = item.start_date || '';
  document.getElementById('f-finish-date').value = item.finish_date || '';
  document.getElementById('f-notes').value = item.personal_notes || '';

  const box = document.getElementById('tracks-list');
  box.innerHTML = '';
  getTracks(item).forEach((t, idx) => addTrackRow(t, idx === 0));
  document.getElementById('form-subtype').value = sub;
  pickOption('subtype', sub, TYPE_LABELS[sub] || 'Anime');
  syncPrimaryTrackLabel();
  const modal = document.getElementById('form-modal');
  modal.classList.add('active');
  const body = modal.querySelector('.dialog-body');
  if (body) body.scrollTop = 0;
  syncBodyScrollLock();
};

window.closeFormModal = () => {
  document.getElementById('form-modal').classList.remove('active');
  syncBodyScrollLock();
};

window.handleFormSubmit = async function (e) {
  e.preventDefault();
  if (!isAdmin) return alert('Sign in as Admin in Settings first.');

  const editId = document.getElementById('edit-id').value;
  const existingItem = editId ? mediaItems.find(m => String(m.id) === String(editId)) : null;
  const primaryCard = document.querySelector('#tracks-list .track-card[data-primary="true"]');
  const sub = primaryCard?.querySelector('.t-subtype')?.value || document.getElementById('form-subtype').value;
  const title = document.getElementById('f-title').value.trim();
  const newCoverUrl = document.getElementById('f-cover').value.trim() || null;
  const newBannerUrl = document.getElementById('f-banner').value.trim() || null;

  if (existingItem) {
    if (existingItem.cover_url && existingItem.cover_url !== newCoverUrl) await deleteOldStorageImage(existingItem.cover_url);
    if (existingItem.banner_url && existingItem.banner_url !== newBannerUrl) await deleteOldStorageImage(existingItem.banner_url);
  }

  const tracks = [];
  document.querySelectorAll('#tracks-list .track-card').forEach((card, idx) => {
    const cardSub = card.querySelector('.t-subtype')?.value || sub;
    tracks.push({
      subtype: cardSub,
      label: idx === 0 ? formatTrackLabel(cardSub, title) : (card.querySelector('.t-label').value.trim() || formatTrackLabel(cardSub, title)),
      status: card.querySelector('.t-status').value,
      progress: Number(card.querySelector('.t-prog').value) || 0,
      total_units: Number(card.querySelector('.t-total').value) || 0,
      unit_label: normalizeUnitName(card.querySelector('.t-unit').value, cardSub)
    });
  });

  const synced = getSyncedStatus(tracks);
  const first = tracks[0] || { progress: 0, total_units: 0, unit_label: DEFAULT_UNIT_BY_TYPE[sub] || 'Episode' };
  const ratingVal = document.getElementById('f-rating').value;

  const payload = {
    category: DB_BASE_CATEGORY_MAP[sub] || 'anime',
    media_subtype: sub,
    title,
    original_title: document.getElementById('f-orig-title').value.trim() || null,
    english_title: document.getElementById('f-eng-title').value.trim() || null,
    alt_titles: parseCsv(document.getElementById('f-alt-titles').value),
    cover_url: newCoverUrl,
    banner_url: newBannerUrl,
    synopsis: document.getElementById('f-synopsis').value.trim() || null,
    release_date: document.getElementById('f-release-date').value.trim() || null,
    release_year: Number(document.getElementById('f-year').value) || null,
    content_rating: document.getElementById('f-age-rating').value.trim() || null,
    rating: ratingVal !== '' ? Number(ratingVal) : null,
    status: synced.key,
    progress: first.progress,
    total_units: first.total_units,
    unit_label: first.unit_label,
    repeat_count: Number(document.getElementById('f-repeat').value) || 0,
    is_favorite: document.getElementById('form-favorite').value === 'true',
    start_date: document.getElementById('f-start-date').value || null,
    finish_date: document.getElementById('f-finish-date').value || null,
    personal_notes: document.getElementById('f-notes').value.trim() || null,
    external_ratings: draftMeta?.external_ratings || existingItem?.external_ratings || {},
    metadata_json: {
      specific_category: sub,
      tracks,
      extra_covers: document.getElementById('f-extra-covers').value.split('\n').map(s => s.trim()).filter(Boolean),
      runtime_minutes: Number(document.getElementById('f-runtime').value) || null,
      season_name: document.getElementById('f-season').value.trim(),
      source_isbn: document.getElementById('f-source').value.trim(),
      creators: parseCsv(document.getElementById('f-creators').value),
      producers: parseCsv(document.getElementById('f-producers').value),
      genres: parseCsv(document.getElementById('f-genres').value),
      tags: parseCsv(document.getElementById('f-tags').value),
      cast: parseCsv(document.getElementById('f-cast').value),
      relations: draftMeta?.relations || existingItem?.metadata_json?.relations || [],
      external_links: draftMeta?.external_links || existingItem?.metadata_json?.external_links || []
    },
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById('btn-save');
  btn.disabled = true;

  try {
    if (editId) {
      const { error } = await db.from('media_logs').update(payload).eq('id', editId);
      if (error) throw error;
    } else {
      const { error } = await db.from('media_logs').insert([payload]);
      if (error) throw error;
    }
    await recordMediaActivity(payload, existingItem);
    closeFormModal();
    await loadLibrary();
  } catch (err) {
    alert('Save error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
};

window.deleteEntry = async function () {
  const id = document.getElementById('edit-id').value;
  if (!id || !confirm('Delete this entry permanently?')) return;
  const item = mediaItems.find(m => String(m.id) === String(id));
  if (item) {
    await deleteOldStorageImage(item.cover_url);
    await deleteOldStorageImage(item.banner_url);
  }
  const { error } = await db.from('media_logs').delete().eq('id', id);
  if (error) return alert(error.message);
  closeFormModal();
  await loadLibrary();
};

// ==============================================================================
// 12. PERSONAL MEDIA ANALYTICS ENGINE (7 SUBPAGES, HEATMAP, DRILL-DOWN, WRAPPED)
// ==============================================================================
async function loadActivityLogs() {
  try {
    const { data, error } = await db.from('media_activity_logs').select('*').order('logged_at', { ascending: false }).limit(2000);
    if (!error && Array.isArray(data)) activityLogs = data;
  } catch {}
}

async function recordMediaActivity(payload, existingItem = null) {
  if (!isAdmin) return;
  try {
    const sub = payload.media_subtype || 'anime';
    const newProg = Number(payload.progress) || 0;
    const oldProg = existingItem ? (Number(existingItem.progress) || 0) : 0;
    const delta = existingItem ? Math.max(0, newProg - oldProg) : newProg;
    const minsPerUnit = Number(payload.metadata_json?.runtime_minutes) || (['anime', 'donghua', 'tv'].includes(sub) ? 24 : (sub === 'movie' ? 115 : 0));

    let actionType = existingItem ? 'progress' : 'added';
    if (payload.status === 'completed' && existingItem?.status !== 'completed') actionType = 'completed';
    else if ((Number(payload.repeat_count) || 0) > (Number(existingItem?.repeat_count) || 0)) actionType = 'repeat';

    const row = {
      media_id: existingItem?.id || null,
      media_title: payload.title,
      media_subtype: sub,
      action_type: actionType,
      units_delta: delta,
      unit_label: payload.unit_label || '',
      minutes_delta: delta * minsPerUnit,
      rating_value: payload.rating ?? null,
      logged_at: new Date().toISOString()
    };
    const { data } = await db.from('media_activity_logs').insert([row]).select();
    if (data?.[0]) activityLogs.unshift(data[0]);
  } catch {}
}

function getDateWindow() {
  const now = new Date();
  if (analyticsState.range === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  if (analyticsState.range === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  if (analyticsState.range === 'week') { const s = new Date(now); s.setDate(now.getDate() - 7); s.setHours(0, 0, 0, 0); return { start: s, end: now }; }
  if (analyticsState.range === 'custom') return { start: analyticsState.customStart ? new Date(analyticsState.customStart + 'T00:00:00') : null, end: analyticsState.customEnd ? new Date(analyticsState.customEnd + 'T23:59:59') : null };
  return { start: null, end: null };
}

function getFilteredMedia() {
  const { start, end } = getDateWindow();
  if (!start && !end) return [...mediaItems];
  return mediaItems.filter(item => {
    const dates = [item.finish_date, item.start_date, item.updated_at, item.created_at].filter(Boolean).map(d => new Date(d));
    return dates.some(d => (!start || d >= start) && (!end || d <= end));
  });
}

function computeItemConsumptionTime(item) {
  const sub = getSubtype(item);
  const meta = item.metadata_json || {};
  const tracks = getTracks(item);
  const repeatMult = 1 + (Number(item.repeat_count) || 0);
  const recordedRuntime = Number(meta.runtime_minutes) || 0;
  let actualMinutes = 0, estimatedMinutes = 0, watchMins = 0, readMins = 0, gameMins = 0, listenMins = 0;

  tracks.forEach(t => {
    const done = (Number(t.progress) || 0) * repeatMult;
    const u = normalizeUnitName(t.unit_label, t.subtype || sub);
    const tSub = t.subtype || sub;
    if (u === 'Hour') { const m = done * 60; actualMinutes += m; if (['game', 'vn'].includes(tSub)) gameMins += m; else watchMins += m; }
    else if (u === 'Episode' || u === 'Movie') {
      if (recordedRuntime > 0) { const m = done * recordedRuntime; actualMinutes += m; watchMins += m; }
      else { const m = done * (tSub === 'movie' ? 110 : 24); estimatedMinutes += m; watchMins += m; }
    } else if (u === 'Chapter') { const m = done * 7; estimatedMinutes += m; readMins += m; }
    else if (u === 'Page') { const m = done * 1.5; estimatedMinutes += m; readMins += m; }
    else if (u === 'Volume' || u === 'Issue') { const m = done * 65; estimatedMinutes += m; readMins += m; }
    else if (u === 'Track') { const m = done * 3.8; estimatedMinutes += m; listenMins += m; }
    else if (u === 'Route') {
      const m = recordedRuntime > 0 ? done * recordedRuntime : done * 240;
      if (recordedRuntime > 0) actualMinutes += m; else estimatedMinutes += m;
      gameMins += m;
    }
  });
  return { actualMinutes, estimatedMinutes, watchMins, readMins, gameMins, listenMins };
}

function getUnifiedActivityStream() {
  const { start, end } = getDateWindow();
  const stream = [];
  if (activityLogs.length > 0) {
    activityLogs.forEach(l => {
      const dt = new Date(l.logged_at);
      if ((!start || dt >= start) && (!end || dt <= end)) {
        stream.push({ date: dt, dateKey: dt.toISOString().slice(0, 10), monthKey: dt.toISOString().slice(0, 7), title: l.media_title, subtype: l.media_subtype, action: l.action_type, units: Number(l.units_delta) || 0, minutes: Number(l.minutes_delta) || 0 });
      }
    });
  } else {
    mediaItems.forEach(item => {
      const sub = getSubtype(item);
      const synced = getSyncedStatus(getTracks(item));
      const agg = getAggregateProgress(getTracks(item));
      const tm = computeItemConsumptionTime(item);
      if (item.created_at) {
        const dt = new Date(item.created_at);
        if ((!start || dt >= start) && (!end || dt <= end)) stream.push({ date: dt, dateKey: dt.toISOString().slice(0, 10), monthKey: dt.toISOString().slice(0, 7), title: item.title, subtype: sub, action: 'added', units: 0, minutes: 0 });
      }
      const actRaw = item.finish_date || item.updated_at || item.start_date;
      if (actRaw) {
        const dt = new Date(actRaw);
        if ((!start || dt >= start) && (!end || dt <= end)) stream.push({ date: dt, dateKey: dt.toISOString().slice(0, 10), monthKey: dt.toISOString().slice(0, 7), title: item.title, subtype: sub, action: synced.key === 'completed' ? 'completed' : 'progress', units: agg.done, minutes: tm.actualMinutes || tm.estimatedMinutes });
      }
    });
  }
  return stream.sort((a, b) => b.date - a.date);
}

function normalizeGenreName(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const map = { 'sci-fi': 'Sci-Fi', 'science fiction': 'Sci-Fi', 'slice of life': 'Slice of Life', 'action & adventure': 'Action' };
  return map[s.toLowerCase()] || s.replace(/\b\w/g, c => c.toUpperCase());
}

function calcAverage(nums) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; }
function calcMedian(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function formatHours(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = mins / 60;
  return h >= 10 ? `${Math.round(h).toLocaleString()}h` : `${h.toFixed(1)}h`;
}

window.drillDownToLibrary = function ({ category = 'all', status = 'all', search = '', sort = 'rating' }) {
  const tabBtn = document.querySelector(`#page-library .tab-item[onclick*="'${category}'"]`);
  selectCategory(category || 'all', tabBtn || null);
  const statusLabels = { all: 'All Status', ongoing: 'In Progress', completed: 'Completed', planned: 'Planned', on_hold: 'On Hold', dropped: 'Dropped' };
  pickOption('status', status || 'all', statusLabels[status] || 'All Status');
  const sortLabels = { updated: 'Recently Updated', rating: 'Highest Rating', year: 'Release Year', units: 'Progress / Units', title: 'Title A–Z' };
  pickOption('sort', sort || 'rating', sortLabels[sort] || 'Highest Rating');
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = search || '';
  navigatePage('library');
  renderMediaGrid();
};

window.switchAnalyticsTab = function (tab, btn) {
  analyticsState.tab = tab;
  document.querySelectorAll('#analytics-subnav .tab-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAnalyticsPage();
};

window.setAnalyticsDateRange = function (range, btn) {
  analyticsState.range = range;
  document.querySelectorAll('#analytics-date-presets .seg-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('analytics-custom-dates').style.display = range === 'custom' ? 'flex' : 'none';
  if (range !== 'custom') renderAnalyticsPage();
};

window.applyCustomAnalyticsDates = function () {
  analyticsState.customStart = document.getElementById('an-date-start').value;
  analyticsState.customEnd = document.getElementById('an-date-end').value;
  renderAnalyticsPage();
};

window.selectMediaStatCategory = function (cat) { analyticsState.selectedMediaCat = cat; renderAnalyticsPage(); };
window.changeWrappedYear = function (yr) { analyticsState.wrappedYear = Number(yr); renderAnalyticsPage(); };

function renderSvgDonut(segments, centerLabel, centerSub) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return `<div class="subtle-meta">No data available for current filter.</div>`;
  const palette = ['#fafafa', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a'];
  let cumulative = 0;
  const r = 52, c = 2 * Math.PI * r;
  const circles = segments.map((seg, i) => {
    const pct = seg.value / total;
    const dash = pct * c, offset = -cumulative * c;
    cumulative += pct;
    return `<circle r="${r}" cx="68" cy="68" fill="transparent" stroke="${seg.color || palette[i % palette.length]}" stroke-width="18" stroke-dasharray="${dash} ${c}" stroke-dashoffset="${offset}" transform="rotate(-90 68 68)"><title>${esc(seg.label)}: ${seg.value} (${(pct * 100).toFixed(1)}%)</title></circle>`;
  }).join('');

  return `
    <div class="an-donut-wrap">
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle r="${r}" cx="68" cy="68" fill="transparent" stroke="#1f1f26" stroke-width="18"></circle>
        ${circles}
        <text x="68" y="65" text-anchor="middle" fill="#fafafa" font-size="16" font-weight="700">${esc(centerLabel)}</text>
        <text x="68" y="81" text-anchor="middle" fill="#8e8e9a" font-size="10">${esc(centerSub)}</text>
      </svg>
      <div class="an-donut-legend">
        ${segments.map((seg, i) => `
          <div class="an-legend-item" ${seg.onclick ? `onclick="${seg.onclick}"` : ''}>
            <span><span class="an-dot" style="background:${seg.color || palette[i % palette.length]};"></span>${esc(seg.label)}</span>
            <span class="subtle-meta">${seg.value} (${((seg.value / total) * 100).toFixed(1)}%)</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSvgLineChart(points, unitSuffix = '') {
  if (!points.length) return `<div class="subtle-meta">No timeline records for this period.</div>`;
  const w = 560, h = 175, padX = 34, padY = 22;
  const maxVal = Math.max(1, ...points.map(p => p.value));
  const coords = points.map((p, idx) => ({
    x: points.length === 1 ? w / 2 : padX + (idx / (points.length - 1)) * (w - padX * 2),
    y: h - padY - ((p.value / maxVal) * (h - padY * 2)),
    ...p
  }));
  const pathD = coords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padY} L ${coords[0].x.toFixed(1)} ${h - padY} Z`;

  return `
    <div class="an-svg-wrap">
      <svg class="an-svg-chart" viewBox="0 0 ${w} ${h}">
        <line x1="${padX}" y1="${h - padY}" x2="${w - padX}" y2="${h - padY}" stroke="#27272a"/>
        <line x1="${padX}" y1="${padY}" x2="${w - padX}" y2="${padY}" stroke="#27272a" stroke-dasharray="3 3"/>
        <path d="${areaD}" fill="rgba(250,250,250,0.06)"/>
        <path d="${pathD}" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round"/>
        ${coords.map((pt, idx) => `
          <g>
            <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4" fill="#fafafa"><title>${esc(pt.label)}: ${pt.value}${esc(unitSuffix)}</title></circle>
            ${(points.length <= 12 || idx % Math.ceil(points.length / 8) === 0) ? `<text x="${pt.x.toFixed(1)}" y="${h - 6}" text-anchor="middle" fill="#8e8e9a" font-size="9.5">${esc(pt.shortLabel || pt.label)}</text>` : ''}
          </g>
        `).join('')}
      </svg>
    </div>
  `;
}

function renderAnalyticsPage() {
  const viewport = document.getElementById('analytics-viewport');
  if (!viewport) return;
  const items = getFilteredMedia();
  const stream = getUnifiedActivityStream();

  if (analyticsState.tab === 'overview') viewport.innerHTML = buildOverviewView(items, stream);
  else if (analyticsState.tab === 'media') viewport.innerHTML = buildMediaStatsView(items);
  else if (analyticsState.tab === 'ratings') viewport.innerHTML = buildRatingAnalyticsView(items);
  else if (analyticsState.tab === 'genres') viewport.innerHTML = buildGenreAnalyticsView(items);
  else if (analyticsState.tab === 'activity') viewport.innerHTML = buildActivityTimeView(items, stream);
  else if (analyticsState.tab === 'taste') viewport.innerHTML = buildPersonalTasteView(items);
  else if (analyticsState.tab === 'wrapped') viewport.innerHTML = buildYearlyWrappedView();
}

function buildOverviewView(items, stream) {
  const total = items.length;
  let completed = 0, ongoing = 0, planned = 0, onHold = 0, dropped = 0, favorites = 0, totalActualMins = 0, totalEstMins = 0;
  const ratings = [], catCounts = {};
  const ratingBuckets = { '10.0': 0, '9.0–9.9': 0, '8.0–8.9': 0, '7.0–7.9': 0, '6.0–6.9': 0, '4.0–5.9': 0, '2.0–3.9': 0, '0.0–1.9': 0 };

  items.forEach(item => {
    const sub = getSubtype(item);
    catCounts[sub] = (catCounts[sub] || 0) + 1;
    if (item.is_favorite) favorites++;
    const st = getSyncedStatus(getTracks(item)).key;
    if (st === 'completed') completed++; else if (st === 'ongoing') ongoing++; else if (st === 'planned') planned++; else if (st === 'on_hold') onHold++; else if (st === 'dropped') dropped++;
    if (Number(item.rating) > 0) {
      const r = Number(item.rating); ratings.push(r);
      if (r === 10) ratingBuckets['10.0']++; else if (r >= 9) ratingBuckets['9.0–9.9']++; else if (r >= 8) ratingBuckets['8.0–8.9']++; else if (r >= 7) ratingBuckets['7.0–7.9']++; else if (r >= 6) ratingBuckets['6.0–6.9']++; else if (r >= 4) ratingBuckets['4.0–5.9']++; else if (r >= 2) ratingBuckets['2.0–3.9']++; else ratingBuckets['0.0–1.9']++;
    }
    const t = computeItemConsumptionTime(item);
    totalActualMins += t.actualMinutes; totalEstMins += t.estimatedMinutes;
  });

  const avgRating = calcAverage(ratings);
  const eligible = completed + ongoing + onHold + dropped;
  const completionRate = eligible > 0 ? ((completed / eligible) * 100).toFixed(1) : '0.0';
  const topCatEntry = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

  const monthlyMap = {};
  stream.forEach(ev => {
    if (!monthlyMap[ev.monthKey]) monthlyMap[ev.monthKey] = { added: 0, completed: 0 };
    if (ev.action === 'added') monthlyMap[ev.monthKey].added++;
    if (ev.action === 'completed') monthlyMap[ev.monthKey].completed++;
  });
  const sortedMonths = Object.keys(monthlyMap).sort().slice(-12);
  const top10Rated = [...items].filter(m => Number(m.rating) > 0).sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 10);
  const recentlyCompleted = [...items].filter(m => getSyncedStatus(getTracks(m)).key === 'completed').sort((a, b) => new Date(b.finish_date || b.updated_at || 0) - new Date(a.finish_date || a.updated_at || 0)).slice(0, 8);
  const maxBucket = Math.max(1, ...Object.values(ratingBuckets));

  return `
    <div class="an-kpi-grid">
      <div class="an-kpi-card clickable" onclick="drillDownToLibrary({status:'all'})"><span class="an-kpi-label">Total Media</span><span class="an-kpi-val">${total.toLocaleString()}</span><span class="an-kpi-sub">Top: ${topCatEntry ? `${TYPE_LABELS[topCatEntry[0]] || topCatEntry[0]} (${topCatEntry[1]})` : 'N/A'}</span></div>
      <div class="an-kpi-card clickable" onclick="drillDownToLibrary({status:'completed'})"><span class="an-kpi-label">Completed</span><span class="an-kpi-val">${completed.toLocaleString()}</span><span class="an-kpi-sub">${completionRate}% completion rate</span></div>
      <div class="an-kpi-card clickable" onclick="drillDownToLibrary({status:'ongoing'})"><span class="an-kpi-label">In Progress</span><span class="an-kpi-val">${ongoing.toLocaleString()}</span><span class="an-kpi-sub">${planned} planned · ${onHold} on hold</span></div>
      <div class="an-kpi-card clickable" onclick="drillDownToLibrary({status:'dropped'})"><span class="an-kpi-label">Dropped</span><span class="an-kpi-val">${dropped.toLocaleString()}</span><span class="an-kpi-sub">${favorites} favorites ★</span></div>
      <div class="an-kpi-card clickable" onclick="switchAnalyticsTab('ratings', document.querySelector('[data-an-tab=ratings]'))"><span class="an-kpi-label">Average Rating</span><span class="an-kpi-val">${avgRating !== null ? `★ ${avgRating.toFixed(2)}` : 'N/A'}</span><span class="an-kpi-sub">${ratings.length} rated entries</span></div>
      <div class="an-kpi-card clickable" onclick="switchAnalyticsTab('activity', document.querySelector('[data-an-tab=activity]'))"><span class="an-kpi-label">Consumption Time</span><span class="an-kpi-val">${formatHours(totalActualMins + totalEstMins)}</span><span class="an-kpi-sub">${formatHours(totalActualMins)} actual · ${formatHours(totalEstMins)} est.</span></div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Status Distribution</span></div>${renderSvgDonut([
        { label: 'Completed', value: completed, color: '#fafafa', onclick: `drillDownToLibrary({status:'completed'})` },
        { label: 'In Progress', value: ongoing, color: '#a1a1aa', onclick: `drillDownToLibrary({status:'ongoing'})` },
        { label: 'Planning', value: planned, color: '#71717a', onclick: `drillDownToLibrary({status:'planned'})` },
        { label: 'On Hold', value: onHold, color: '#52525b', onclick: `drillDownToLibrary({status:'on_hold'})` },
        { label: 'Dropped', value: dropped, color: '#3f3f46', onclick: `drillDownToLibrary({status:'dropped'})` }
      ].filter(s => s.value > 0), String(total), 'Entries')}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Media Distribution by Type</span></div>${renderSvgDonut(Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: TYPE_LABELS[k] || k, value: v, onclick: `drillDownToLibrary({category:'${k}'})` })), String(Object.keys(catCounts).length), 'Types')}</div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Monthly Media Additions</span></div>${renderSvgLineChart(sortedMonths.map(m => ({ label: m, shortLabel: m.slice(5), value: monthlyMap[m].added })), ' added')}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Monthly Completed Media</span></div>${renderSvgLineChart(sortedMonths.map(m => ({ label: m, shortLabel: m.slice(5), value: monthlyMap[m].completed })), ' completed')}</div>
    </div>
    <div class="an-grid-3">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Rating Distribution</span></div>${Object.entries(ratingBuckets).map(([lbl, cnt]) => `<div class="an-bar-row"><div class="an-bar-meta"><span>★ ${lbl}</span><span class="subtle-meta">${cnt}</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(cnt / maxBucket) * 100}%"></div></div></div>`).join('')}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Top 10 Highest-Rated</span></div>${top10Rated.length ? top10Rated.map((m, i) => `<div class="an-rank-row" onclick="openDetailModal('${esc(m.id)}')"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span class="an-rank-num">#${i + 1}</span> ${esc(m.title)}</span><span class="badge-pill">★ ${Number(m.rating).toFixed(2)}</span></div>`).join('') : `<div class="subtle-meta">No rated entries.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Recently Completed</span></div>${recentlyCompleted.length ? recentlyCompleted.map(m => `<div class="an-rank-row" onclick="openDetailModal('${esc(m.id)}')"><div style="min-width:0;"><div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;">${esc(m.title)}</div><div class="subtle-meta">${esc(TYPE_LABELS[getSubtype(m)] || '')} · ${(m.finish_date || m.updated_at || '').slice(0, 10)}</div></div><span class="badge-pill">${Number(m.rating) > 0 ? `★ ${Number(m.rating).toFixed(1)}` : 'Done'}</span></div>`).join('') : `<div class="subtle-meta">No completed entries.</div>`}</div>
    </div>
  `;
}

function buildMediaStatsView(items) {
  const groups = [
    { key: 'anime', label: 'Anime & Donghua', subs: ['anime', 'donghua'] },
    { key: 'tv', label: 'TV Series', subs: ['tv'] },
    { key: 'movie', label: 'Movies', subs: ['movie'] },
    { key: 'manga', label: 'Manga / Manhwa / Manhua', subs: ['manga', 'manhwa', 'manhua', 'comic'] },
    { key: 'novel', label: 'Light & Web Novels', subs: ['light_novel', 'web_novel', 'novel', 'book'] },
    { key: 'vn', label: 'Visual Novels', subs: ['vn'] },
    { key: 'game', label: 'Video Games', subs: ['game'] },
    { key: 'music', label: 'Music', subs: ['music'] }
  ];
  const activeGrp = groups.find(g => g.key === analyticsState.selectedMediaCat) || groups[0];
  const subset = items.filter(m => activeGrp.subs.includes(getSubtype(m)));
  const ratings = subset.filter(m => Number(m.rating) > 0).map(m => Number(m.rating));
  const avgRating = calcAverage(ratings);
  const completedCount = subset.filter(m => getSyncedStatus(getTracks(m)).key === 'completed').length;
  let totalUnits = 0, totalTracks = 0, totalActualMins = 0, totalEstMins = 0;
  const creatorCounts = {}, genreCounts = {}, yearCounts = {}, runtimes = [];

  subset.forEach(m => {
    const meta = m.metadata_json || {};
    const tracks = getTracks(m);
    totalTracks += tracks.length;
    tracks.forEach(t => { totalUnits += (Number(t.progress) || 0) * (1 + (Number(m.repeat_count) || 0)); });
    const tm = computeItemConsumptionTime(m);
    totalActualMins += tm.actualMinutes; totalEstMins += tm.estimatedMinutes;
    if (Number(meta.runtime_minutes) > 0) runtimes.push(Number(meta.runtime_minutes));
    if (m.release_year) yearCounts[m.release_year] = (yearCounts[m.release_year] || 0) + 1;
    (meta.creators || []).forEach(c => { creatorCounts[c] = (creatorCounts[c] || 0) + 1; });
    (meta.genres || []).forEach(g => { const ng = normalizeGenreName(g); if (ng) genreCounts[ng] = (genreCounts[ng] || 0) + 1; });
  });

  const topOf = (obj) => { const s = Object.entries(obj).sort((a, b) => b[1] - a[1]); return s[0] ? `${s[0][0]} (${s[0][1]})` : 'N/A'; };
  const topRatedSubset = [...subset].filter(m => Number(m.rating) > 0).sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 8);
  const topYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxYr = topYears[0]?.[1] || 1;

  return `
    <div class="analytics-subnav" style="border-bottom:none; margin-bottom:14px;">
      ${groups.map(g => `<button type="button" class="tab-item ${g.key === activeGrp.key ? 'active' : ''}" onclick="selectMediaStatCategory('${g.key}')">${esc(g.label)}</button>`).join('')}
    </div>
    <div class="an-kpi-grid">
      <div class="an-kpi-card clickable" onclick="drillDownToLibrary({category:'${activeGrp.subs[0]}'})"><span class="an-kpi-label">${esc(activeGrp.label)} Entries</span><span class="an-kpi-val">${subset.length}</span><span class="an-kpi-sub">${completedCount} completed (${subset.length ? Math.round((completedCount / subset.length) * 100) : 0}%)</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Total Units / Tracks</span><span class="an-kpi-val">${totalUnits.toLocaleString()}</span><span class="an-kpi-sub">${totalTracks} seasons / volumes / parts</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Average Score</span><span class="an-kpi-val">${avgRating !== null ? `★ ${avgRating.toFixed(2)}` : 'N/A'}</span><span class="an-kpi-sub">${ratings.length} rated entries</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Time Spent</span><span class="an-kpi-val">${formatHours(totalActualMins + totalEstMins)}</span><span class="an-kpi-sub">${totalActualMins > 0 ? `${formatHours(totalActualMins)} recorded` : `${formatHours(totalEstMins)} estimated`}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Top Creator / Studio</span><span class="an-kpi-val" style="font-size:15px;">${esc(topOf(creatorCounts))}</span><span class="an-kpi-sub">Avg duration: ${runtimes.length ? `${Math.round(calcAverage(runtimes))}m` : 'N/A'}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Top Genre</span><span class="an-kpi-val" style="font-size:15px;">${esc(topOf(genreCounts))}</span><span class="an-kpi-sub">Most frequent tag</span></div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Release Year Distribution</span></div>${topYears.length ? topYears.map(([yr, cnt]) => `<div class="an-bar-row"><div class="an-bar-meta"><span>${esc(yr)}</span><span class="subtle-meta">${cnt} titles</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(cnt / maxYr) * 100}%"></div></div></div>`).join('') : `<div class="subtle-meta">No release year metadata recorded.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Highest Rated in ${esc(activeGrp.label)}</span></div>${topRatedSubset.length ? topRatedSubset.map((m, i) => `<div class="an-rank-row" onclick="openDetailModal('${esc(m.id)}')"><span><span class="an-rank-num">#${i + 1}</span> ${esc(m.title)}</span><span class="badge-pill">★ ${Number(m.rating).toFixed(2)}</span></div>`).join('') : `<div class="subtle-meta">No rated entries in this category.</div>`}</div>
    </div>
  `;
}

function buildRatingAnalyticsView(items) {
  const ratedItems = items.filter(m => Number(m.rating) > 0);
  const scores = ratedItems.map(m => Number(m.rating));
  const avg = calcAverage(scores), med = calcMedian(scores);
  const variance = scores.length ? scores.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / scores.length : null;
  const stdDev = variance !== null ? Math.sqrt(variance) : null;
  let persona = 'Balanced Critic';
  if (avg !== null) { if (avg >= 8.3) persona = 'Generous Enthusiast'; else if (avg <= 6.2) persona = 'Strict Connoisseur'; else if (stdDev !== null && stdDev >= 1.8) persona = 'Polarized Purist'; }

  const byCat = {}, byYear = {};
  const extDiffs = [];
  ratedItems.forEach(m => {
    const sub = getSubtype(m), r = Number(m.rating);
    if (!byCat[sub]) byCat[sub] = [];
    byCat[sub].push(r);
    if (m.release_year) { if (!byYear[m.release_year]) byYear[m.release_year] = []; byYear[m.release_year].push(r); }
    const ext = m.external_ratings || {};
    const firstExtKey = Object.keys(ext)[0];
    if (firstExtKey) {
      const parsed = parseFloat(String(ext[firstExtKey]).replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) {
        const normalizedExt = String(ext[firstExtKey]).includes('/5') ? parsed * 2 : parsed;
        extDiffs.push({ id: m.id, title: m.title, personal: r, external: normalizedExt, provider: formatExternalScoreLabel(firstExtKey), diff: r - normalizedExt });
      }
    }
  });

  const sortedYears = Object.keys(byYear).sort();
  const mostLoved = [...extDiffs].sort((a, b) => b.diff - a.diff).slice(0, 6);
  const mostCritical = [...extDiffs].sort((a, b) => a.diff - b.diff).slice(0, 6);

  return `
    <div class="an-kpi-grid">
      <div class="an-kpi-card"><span class="an-kpi-label">Mean Rating</span><span class="an-kpi-val">${avg !== null ? `★ ${avg.toFixed(2)}` : 'N/A'}</span><span class="an-kpi-sub">${ratedItems.length} of ${items.length} rated (${items.length ? Math.round((ratedItems.length / items.length) * 100) : 0}%)</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Median Score</span><span class="an-kpi-val">${med !== null ? `★ ${med.toFixed(2)}` : 'N/A'}</span><span class="an-kpi-sub">50th percentile</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Score Spread (StdDev)</span><span class="an-kpi-val">${stdDev !== null ? stdDev.toFixed(2) : 'N/A'}</span><span class="an-kpi-sub">Persona: ${persona}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Masterpieces (9.0+)</span><span class="an-kpi-val">${scores.filter(s => s >= 9).length}</span><span class="an-kpi-sub">${scores.filter(s => s === 10).length} scored 10.0</span></div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Average Rating by Media Category</span></div>${Object.entries(byCat).map(([sub, arr]) => ({ sub, avg: calcAverage(arr), count: arr.length })).sort((a, b) => b.avg - a.avg).map(x => `<div class="an-bar-row clickable" onclick="drillDownToLibrary({category:'${x.sub}',sort:'rating'})"><div class="an-bar-meta"><span>${esc(TYPE_LABELS[x.sub] || x.sub)} (${x.count})</span><span class="badge-pill">★ ${x.avg.toFixed(2)}</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(x.avg / 10) * 100}%"></div></div></div>`).join('') || `<div class="subtle-meta">No rated entries yet.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Average Score by Release Year</span></div>${renderSvgLineChart(sortedYears.slice(-14).map(yr => ({ label: yr, shortLabel: yr.slice(2), value: Number(calcAverage(byYear[yr]).toFixed(2)) })), ' ★')}</div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Rated Higher Than Public Consensus</span></div>${mostLoved.length ? mostLoved.map(x => `<div class="an-rank-row" onclick="openDetailModal('${esc(x.id)}')"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(x.title)}</span><span class="subtle-meta">You ${x.personal.toFixed(1)} vs ${x.provider} ${x.external.toFixed(1)} (+${x.diff.toFixed(1)})</span></div>`).join('') : `<div class="subtle-meta">Fetch external ratings via metadata search to unlock comparison.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Rated Lower Than Public Consensus</span></div>${mostCritical.length ? mostCritical.map(x => `<div class="an-rank-row" onclick="openDetailModal('${esc(x.id)}')"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(x.title)}</span><span class="subtle-meta">You ${x.personal.toFixed(1)} vs ${x.provider} ${x.external.toFixed(1)} (${x.diff.toFixed(1)})</span></div>`).join('') : `<div class="subtle-meta">No external score deltas available yet.</div>`}</div>
    </div>
  `;
}

function buildGenreAnalyticsView(items) {
  const genreMap = {};
  items.forEach(item => {
    const meta = item.metadata_json || {};
    const synced = getSyncedStatus(getTracks(item)).key;
    const rating = Number(item.rating) > 0 ? Number(item.rating) : null;
    const tm = computeItemConsumptionTime(item);
    const totalMins = tm.actualMinutes + tm.estimatedMinutes;
    uniqueList([...(meta.genres || []), ...(meta.tags || [])].map(normalizeGenreName)).forEach(g => {
      if (!genreMap[g]) genreMap[g] = { name: g, count: 0, completed: 0, dropped: 0, ratings: [], mins: 0 };
      genreMap[g].count++;
      if (synced === 'completed') genreMap[g].completed++;
      if (synced === 'dropped') genreMap[g].dropped++;
      if (rating !== null) genreMap[g].ratings.push(rating);
      genreMap[g].mins += totalMins;
    });
  });

  const allGenres = Object.values(genreMap);
  const byFreq = [...allGenres].sort((a, b) => b.count - a.count);
  const byRating = [...allGenres].filter(g => g.ratings.length >= 1).sort((a, b) => calcAverage(b.ratings) - calcAverage(a.ratings));
  const byTime = [...allGenres].sort((a, b) => b.mins - a.mins);
  const maxFreq = byFreq[0]?.count || 1, maxTime = byTime[0]?.mins || 1;

  return `
    <div class="an-kpi-grid">
      <div class="an-kpi-card"><span class="an-kpi-label">Distinct Genres &amp; Tags</span><span class="an-kpi-val">${allGenres.length}</span><span class="an-kpi-sub">Normalized across library</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Most Consumed Genre</span><span class="an-kpi-val" style="font-size:17px;">${esc(byFreq[0]?.name || 'N/A')}</span><span class="an-kpi-sub">${byFreq[0] ? `${byFreq[0].count} entries` : 'No genres'}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Highest Rated Genre</span><span class="an-kpi-val" style="font-size:17px;">${esc(byRating[0]?.name || 'N/A')}</span><span class="an-kpi-sub">${byRating[0] ? `★ ${calcAverage(byRating[0].ratings).toFixed(2)} avg` : 'No ratings'}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Most Time Invested</span><span class="an-kpi-val" style="font-size:17px;">${esc(byTime[0]?.name || 'N/A')}</span><span class="an-kpi-sub">${byTime[0] ? formatHours(byTime[0].mins) : '0h'}</span></div>
    </div>
    <div class="an-grid-3">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Most Consumed (Click to Filter)</span></div>${byFreq.slice(0, 12).map(g => `<div class="an-bar-row clickable" onclick="drillDownToLibrary({search:'${esc(g.name)}'})"><div class="an-bar-meta"><span>${esc(g.name)}</span><span class="subtle-meta">${g.count}</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(g.count / maxFreq) * 100}%"></div></div></div>`).join('') || `<div class="subtle-meta">No genre data.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Highest Rated Genres</span></div>${byRating.slice(0, 12).map(g => { const a = calcAverage(g.ratings); return `<div class="an-bar-row clickable" onclick="drillDownToLibrary({search:'${esc(g.name)}',sort:'rating'})"><div class="an-bar-meta"><span>${esc(g.name)} (${g.ratings.length})</span><span class="badge-pill">★ ${a.toFixed(2)}</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(a / 10) * 100}%"></div></div></div>`; }).join('') || `<div class="subtle-meta">No rated genres.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Time &amp; Completion by Genre</span></div>${byTime.slice(0, 12).map(g => { const rate = g.count ? Math.round((g.completed / g.count) * 100) : 0; return `<div class="an-bar-row clickable" onclick="drillDownToLibrary({search:'${esc(g.name)}'})"><div class="an-bar-meta"><span>${esc(g.name)}</span><span class="subtle-meta">${formatHours(g.mins)} · ${rate}% done</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(g.mins / maxTime) * 100}%"></div></div></div>`; }).join('') || `<div class="subtle-meta">No time data.</div>`}</div>
    </div>
  `;
}

function buildActivityTimeView(items, stream) {
  let watchMins = 0, readMins = 0, gameMins = 0, listenMins = 0, actualMins = 0, estMins = 0;
  items.forEach(m => {
    const t = computeItemConsumptionTime(m);
    watchMins += t.watchMins; readMins += t.readMins; gameMins += t.gameMins; listenMins += t.listenMins;
    actualMins += t.actualMinutes; estMins += t.estimatedMinutes;
  });

  const dayCounts = {};
  stream.forEach(ev => { dayCounts[ev.dateKey] = (dayCounts[ev.dateKey] || 0) + Math.max(1, ev.units || 1); });
  const activeDaysSet = new Set(Object.keys(dayCounts));
  const sortedDates = [...activeDaysSet].sort();

  let longestStreak = 0, runningStreak = 0, prevDate = null;
  sortedDates.forEach(dStr => {
    const cur = new Date(dStr + 'T00:00:00');
    if (prevDate && Math.round((cur - prevDate) / 86400000) === 1) runningStreak++;
    else runningStreak = 1;
    if (runningStreak > longestStreak) longestStreak = runningStreak;
    prevDate = cur;
  });

  let currentStreak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const k = cursor.toISOString().slice(0, 10);
    if (activeDaysSet.has(k)) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }
    else if (i === 0) cursor.setDate(cursor.getDate() - 1);
    else break;
  }

  const cells = [];
  const today = new Date();
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const val = dayCounts[k] || 0;
    const lvl = val === 0 ? 0 : val <= 2 ? 1 : val <= 6 ? 2 : val <= 15 ? 3 : 4;
    cells.push(`<div class="an-hm-cell" data-lvl="${lvl}" title="${k}: ${val} logged units/actions"></div>`);
  }

  return `
    <div class="an-disclaimer"><strong>Time Calculation Notice:</strong> Recorded duration (${formatHours(actualMins)}) uses exact runtime/hours stored on entries. Estimated duration (${formatHours(estMins)}) applies fallback averages (24m/anime ep, 110m/movie, 7m/chapter, 1.5m/page) when runtime is unrecorded.</div>
    <div class="an-kpi-grid" style="margin-top:16px;">
      <div class="an-kpi-card"><span class="an-kpi-label">Total Time Invested</span><span class="an-kpi-val">${formatHours(actualMins + estMins)}</span><span class="an-kpi-sub">${((actualMins + estMins) / 1440).toFixed(1)} full days</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Current Streak</span><span class="an-kpi-val">${currentStreak}d</span><span class="an-kpi-sub">Longest streak: ${longestStreak} days</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Active Logged Days</span><span class="an-kpi-val">${activeDaysSet.size}</span><span class="an-kpi-sub">${stream.length} total activity events</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Watch vs Read Split</span><span class="an-kpi-val" style="font-size:18px;">${formatHours(watchMins)} / ${formatHours(readMins)}</span><span class="an-kpi-sub">Games: ${formatHours(gameMins)} · Music: ${formatHours(listenMins)}</span></div>
    </div>
    <div class="an-card" style="margin-bottom:16px;">
      <div class="an-card-head"><span class="an-card-title">365-Day Consumption Activity Heatmap</span><span class="subtle-meta">Less ░ ▒ ▓ █ More</span></div>
      <div class="an-heatmap-scroll"><div class="an-heatmap-grid">${cells.join('')}</div></div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Time Allocation by Medium</span></div>${renderSvgDonut([
        { label: 'Watching (Anime/TV/Movie)', value: Math.round(watchMins / 60), color: '#fafafa' },
        { label: 'Reading (Manga/Novels/Books)', value: Math.round(readMins / 60), color: '#a1a1aa' },
        { label: 'Gaming & Visual Novels', value: Math.round(gameMins / 60), color: '#71717a' },
        { label: 'Listening (Music)', value: Math.round(listenMins / 60), color: '#3f3f46' }
      ].filter(x => x.value > 0), formatHours(actualMins + estMins), 'Total')}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Recent Activity Feed</span></div>${stream.slice(0, 10).map(ev => `<div class="an-rank-row"><div><div style="font-weight:600;">${esc(ev.title)}</div><div class="subtle-meta">${esc(TYPE_LABELS[ev.subtype] || ev.subtype)} · ${esc(ev.action)} ${ev.units > 0 ? `(+${ev.units} units)` : ''}</div></div><span class="subtle-meta">${ev.dateKey}</span></div>`).join('') || `<div class="subtle-meta">No activity logged yet.</div>`}</div>
    </div>
  `;
}

function buildPersonalTasteView(items) {
  const creatorStats = {}, eraCounts = { '2020s': 0, '2010s': 0, '2000s': 0, '1990s & Earlier': 0 };
  let totalScoreSum = 0, scoreCount = 0, repeatTitles = 0, totalRepeats = 0;

  items.forEach(m => {
    const meta = m.metadata_json || {};
    const r = Number(m.rating) > 0 ? Number(m.rating) : null;
    if (r !== null) { totalScoreSum += r; scoreCount++; }
    if ((Number(m.repeat_count) || 0) > 0) { repeatTitles++; totalRepeats += Number(m.repeat_count); }
    const yr = Number(m.release_year);
    if (yr >= 2020) eraCounts['2020s']++; else if (yr >= 2010) eraCounts['2010s']++; else if (yr >= 2000) eraCounts['2000s']++; else if (yr > 0) eraCounts['1990s & Earlier']++;
    (meta.creators || []).forEach(c => {
      if (!creatorStats[c]) creatorStats[c] = { name: c, count: 0, ratings: [] };
      creatorStats[c].count++;
      if (r !== null) creatorStats[c].ratings.push(r);
    });
  });

  const favCreators = Object.values(creatorStats).sort((a, b) => b.count - a.count).slice(0, 10);
  const topEra = Object.entries(eraCounts).sort((a, b) => b[1] - a[1])[0];
  const favoritesList = items.filter(m => m.is_favorite);
  const maxEra = Math.max(1, ...Object.values(eraCounts));

  return `
    <div class="an-kpi-grid">
      <div class="an-kpi-card"><span class="an-kpi-label">Favorite Era</span><span class="an-kpi-val" style="font-size:20px;">${topEra && topEra[1] > 0 ? topEra[0] : 'N/A'}</span><span class="an-kpi-sub">${topEra ? `${topEra[1]} titles from this era` : ''}</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Rewatch / Reread Loyalty</span><span class="an-kpi-val">${repeatTitles}</span><span class="an-kpi-sub">${totalRepeats} total repeat runs</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Curated Favorites</span><span class="an-kpi-val">${favoritesList.length}</span><span class="an-kpi-sub">${items.length ? Math.round((favoritesList.length / items.length) * 100) : 0}% of archive</span></div>
      <div class="an-kpi-card"><span class="an-kpi-label">Taste Baseline</span><span class="an-kpi-val">${scoreCount ? `★ ${(totalScoreSum / scoreCount).toFixed(2)}` : 'N/A'}</span><span class="an-kpi-sub">Personal rating center</span></div>
    </div>
    <div class="an-grid-2">
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Top Creators, Studios &amp; Authors</span></div>${favCreators.length ? favCreators.map(c => `<div class="an-rank-row" onclick="drillDownToLibrary({search:'${esc(c.name)}'})"><span>${esc(c.name)} (${c.count} works)</span><span class="badge-pill">${c.ratings.length ? `★ ${calcAverage(c.ratings).toFixed(2)}` : 'Unrated'}</span></div>`).join('') : `<div class="subtle-meta">No creator/studio data recorded.</div>`}</div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Release Era Affinity</span></div>${Object.entries(eraCounts).map(([era, cnt]) => `<div class="an-bar-row"><div class="an-bar-meta"><span>${era}</span><span class="subtle-meta">${cnt} titles</span></div><div class="an-bar-track"><div class="an-bar-fill" style="width:${(cnt / maxEra) * 100}%"></div></div></div>`).join('')}</div>
    </div>
  `;
}

function buildYearlyWrappedView() {
  const yearsSet = new Set([new Date().getFullYear()]);
  mediaItems.forEach(m => { [m.finish_date, m.start_date, m.updated_at].forEach(d => { if (d && d.length >= 4) yearsSet.add(Number(d.slice(0, 4))); }); });
  const years = [...yearsSet].filter(y => y > 1990).sort((a, b) => b - a);
  const yr = analyticsState.wrappedYear;

  const yrItems = mediaItems.filter(m => [m.finish_date, m.start_date, m.updated_at].some(d => d && d.startsWith(String(yr))));
  const completedInYr = yrItems.filter(m => getSyncedStatus(getTracks(m)).key === 'completed');
  let totalMins = 0, totalUnits = 0;
  const genreCounts = {}, catCounts = {};

  yrItems.forEach(m => {
    const tm = computeItemConsumptionTime(m);
    totalMins += tm.actualMinutes + tm.estimatedMinutes;
    totalUnits += getAggregateProgress(getTracks(m)).done;
    const sub = getSubtype(m);
    catCounts[sub] = (catCounts[sub] || 0) + 1;
    (m.metadata_json?.genres || []).forEach(g => { const ng = normalizeGenreName(g); if (ng) genreCounts[ng] = (genreCounts[ng] || 0) + 1; });
  });

  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  const top5Yr = [...yrItems].filter(m => Number(m.rating) > 0).sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 5);

  return `
    <div class="wrapped-stage">
      <div class="wrapped-hero">
        <div><div class="subtle-meta" style="text-transform:uppercase; letter-spacing:0.1em;">Annual Archive Recap</div><div class="wrapped-year-badge">${yr} WRAPPED</div></div>
        <div class="seg-tabs">${years.map(y => `<button type="button" class="seg-tab ${y === yr ? 'active' : ''}" onclick="changeWrappedYear(${y})">${y}</button>`).join('')}</div>
      </div>
      <div class="an-kpi-grid" style="margin-bottom:0;">
        <div class="an-kpi-card"><span class="an-kpi-label">Titles Engaged</span><span class="an-kpi-val">${yrItems.length}</span><span class="an-kpi-sub">${completedInYr.length} completed in ${yr}</span></div>
        <div class="an-kpi-card"><span class="an-kpi-label">Units Logged</span><span class="an-kpi-val">${totalUnits.toLocaleString()}</span><span class="an-kpi-sub">Episodes, chapters &amp; hours</span></div>
        <div class="an-kpi-card"><span class="an-kpi-label">Time Invested</span><span class="an-kpi-val">${formatHours(totalMins)}</span><span class="an-kpi-sub">${(totalMins / 1440).toFixed(1)} days total</span></div>
        <div class="an-kpi-card"><span class="an-kpi-label">Signature Genre</span><span class="an-kpi-val" style="font-size:18px;">${esc(topGenre ? topGenre[0] : 'N/A')}</span><span class="an-kpi-sub">Top format: ${topCat ? (TYPE_LABELS[topCat[0]] || topCat[0]) : 'N/A'}</span></div>
      </div>
      <div class="an-card"><div class="an-card-head"><span class="an-card-title">Top 5 Defining Titles of ${yr}</span></div>${top5Yr.length ? top5Yr.map((m, i) => `<div class="an-rank-row" onclick="openDetailModal('${esc(m.id)}')"><span><span class="an-rank-num">#${i + 1}</span> <strong>${esc(m.title)}</strong> <span class="subtle-meta">(${esc(TYPE_LABELS[getSubtype(m)] || '')})</span></span><span class="badge-pill">★ ${Number(m.rating).toFixed(2)}</span></div>`).join('') : `<div class="subtle-meta">No rated entries recorded for ${yr}.</div>`}</div>
    </div>
  `;
}
