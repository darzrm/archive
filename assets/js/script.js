'use strict';

// ==========================================
// 1. SUPABASE & EXTERNAL API CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uendrdxiixmikkeanlod.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IdPLjwQhVQwXGGxUnBVblg_oIQ5Zz89';
const TMDB_API_KEY = '727a00da59cd2b9873f7636a5bde9561';
const RAWG_API_KEY = ''; // Optional: add free RAWG API key for PC/Mobile games

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let allMediaLogs = [];
let lastApiResults = [];
let currentCategory = 'all';
let currentSubCategory = 'all';
let isAdminLoggedIn = false;

// ==========================================
// 2. INITIALIZATION & ADMIN AUTH
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminSession();
  await fetchMediaLogs();
  setupFilterListeners();
});

async function checkAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  isAdminLoggedIn = !!session;
  updateAdminUI();
}

function updateAdminUI() {
  const addBtn = document.getElementById('btn-add-media');
  const lockIcon = document.getElementById('admin-lock-icon');
  const btnText = document.getElementById('admin-btn-text');

  if (isAdminLoggedIn) {
    addBtn.style.display = 'inline-flex';
    lockIcon.setAttribute('name', 'log-out-outline');
    btnText.textContent = 'Logout';
  } else {
    addBtn.style.display = 'none';
    lockIcon.setAttribute('name', 'lock-closed-outline');
    btnText.textContent = 'Admin';
  }
  renderMediaGrid();
}

window.handleAdminAuthClick = async function () {
  if (isAdminLoggedIn) {
    const confirm = await Swal.fire({
      text: 'Exit Admin mode?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Logout',
      cancelButtonText: 'Cancel',
      background: '#1e1e1f',
      color: '#fff'
    });
    if (confirm.isConfirmed) {
      await supabaseClient.auth.signOut();
      isAdminLoggedIn = false;
      updateAdminUI();
    }
  } else {
    document.getElementById('login-modal').classList.add('active');
  }
};

window.closeLoginModal = function () {
  document.getElementById('login-modal').classList.remove('active');
};

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
  } else {
    isAdminLoggedIn = true;
    closeLoginModal();
    updateAdminUI();
    Swal.fire({
      icon: 'success',
      text: 'Admin login successful',
      timer: 1200,
      showConfirmButton: false,
      background: '#1e1e1f',
      color: '#fff'
    });
  }
});

// ==========================================
// 3. LOAD DATA & AUTO-CALCULATE STATS
// ==========================================
async function fetchMediaLogs() {
  const { data, error } = await supabaseClient
    .from('media_logs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    document.getElementById('media-grid').innerHTML = `<p class="empty-state">Failed to load data: ${error.message}</p>`;
    return;
  }

  allMediaLogs = data || [];
  updateStatsUI();
  renderMediaGrid();
}

function updateStatsUI() {
  const seriesItems = allMediaLogs.filter(i => i.category === 'series');
  const movieItems = allMediaLogs.filter(i => i.category === 'movie');
  const comicItems = allMediaLogs.filter(i => i.category === 'comic');
  const otherItems = allMediaLogs.filter(i => i.category === 'other');

  const totalSeriesEps = seriesItems.reduce((sum, i) => sum + (i.progress || 0), 0);
  const completedMovies = movieItems.filter(i => i.status === 'completed').length;
  const totalComicCh = comicItems.reduce((sum, i) => sum + (i.progress || 0), 0);

  const lnCount = otherItems.filter(i => i.sub_category === 'light_novel').length;
  const gameCount = otherItems.filter(i => i.sub_category === 'game').length;

  const ratedItems = allMediaLogs.filter(i => i.rating !== null && i.rating !== undefined);
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((sum, i) => sum + Number(i.rating), 0) / ratedItems.length).toFixed(2)
    : '0.0';

  document.getElementById('total-entries-label').textContent = `${allMediaLogs.length} Total Entries`;
  document.getElementById('stat-series-eps').textContent = totalSeriesEps.toLocaleString('en-US');
  document.getElementById('stat-series-count').textContent = `${seriesItems.length} Series`;

  document.getElementById('stat-movies').textContent = completedMovies.toLocaleString('en-US');
  document.getElementById('stat-movies-total').textContent = `${movieItems.length} Total`;

  document.getElementById('stat-comic-ch').textContent = totalComicCh.toLocaleString('en-US');
  document.getElementById('stat-comic-count').textContent = `${comicItems.length} Comics`;

  document.getElementById('stat-other-count').textContent = otherItems.length.toLocaleString('en-US');
  document.getElementById('stat-other-breakdown').textContent = `${lnCount} LN · ${gameCount} Game`;

  document.getElementById('stat-avg-rating').textContent = avgRating;
}

// ==========================================
// 4. FILTER, SEARCH & RENDER GRID
// ==========================================
function setupFilterListeners() {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;

      const subBar = document.getElementById('other-sub-bar');
      if (currentCategory === 'other') {
        subBar.style.display = 'flex';
      } else {
        subBar.style.display = 'none';
        currentSubCategory = 'all';
        document.querySelectorAll('.sub-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.sub-pill[data-sub="all"]').classList.add('active');
      }
      renderMediaGrid();
    });
  });

  document.querySelectorAll('.sub-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sub-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentSubCategory = pill.dataset.sub;
      renderMediaGrid();
    });
  });

  document.getElementById('search-library').addEventListener('input', renderMediaGrid);
  document.getElementById('filter-status').addEventListener('change', renderMediaGrid);
  document.getElementById('sort-library').addEventListener('change', renderMediaGrid);
}

function formatCategoryBadge(item) {
  if (item.category === 'other') {
    if (item.sub_category === 'light_novel') return 'Light Novel';
    if (item.sub_category === 'game') return 'Game';
    return 'Other';
  }
  return item.category;
}

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  const query = document.getElementById('search-library').value.toLowerCase().trim();
  const statusFilter = document.getElementById('filter-status').value;
  const sortBy = document.getElementById('sort-library').value;

  let filtered = allMediaLogs.filter(item => {
    const matchCat = currentCategory === 'all' || item.category === currentCategory;
    const matchSub = currentCategory !== 'other' || currentSubCategory === 'all' || item.sub_category === currentSubCategory;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchQuery = !query || item.title.toLowerCase().includes(query);
    return matchCat && matchSub && matchStatus && matchQuery;
  });

  if (sortBy === 'rating_desc') {
    filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sortBy === 'title_asc') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">No media found in this category.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const cover = item.cover_url || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
    const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
    const progressText = item.total_units
      ? `${item.progress || 0} / ${item.total_units} ${item.unit_label || ''}`
      : `${item.progress || 0} ${item.unit_label || ''}`;

    const percent = item.total_units
      ? Math.min(100, Math.round(((item.progress || 0) / item.total_units) * 100))
      : (item.status === 'completed' ? 100 : 35);

    const adminControls = isAdminLoggedIn ? `
      <div class="admin-card-actions">
        <button class="mini-btn" onclick="incrementProgress('${item.id}')">+1</button>
        <button class="mini-btn" onclick="openEditModal('${item.id}')">Edit</button>
        <button class="mini-btn danger" onclick="deleteMedia('${item.id}')">Delete</button>
      </div>
    ` : '';

    return `
      <div class="media-card">
        <div class="media-cover-wrap">
          <img src="${cover}" alt="${item.title}" loading="lazy">
          <span class="badge-cat">${formatCategoryBadge(item)}</span>
          <span class="badge-rating">${ratingText}</span>
        </div>
        <div class="media-body">
          <h3 class="media-title" title="${item.title}">${item.title}</h3>
          <div>
            <div class="media-meta-row">
              <span class="status-pill ${item.status}">${item.status}</span>
              <span>${progressText}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
          </div>
          ${adminControls}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 5. ADD / EDIT MODAL & MULTI-API SEARCH
// ==========================================
window.openMediaModal = function () {
  document.getElementById('media-modal-title').textContent = 'Add Media';
  document.getElementById('media-form').reset();
  document.getElementById('media-id').value = '';
  document.getElementById('api-search-results').style.display = 'none';
  handleCategoryFormChange();
  document.getElementById('media-modal').classList.add('active');
};

window.openEditModal = function (id) {
  const item = allMediaLogs.find(m => m.id === id);
  if (!item) return;

  document.getElementById('media-modal-title').textContent = 'Edit Media';
  document.getElementById('media-id').value = item.id;
  document.getElementById('media-category').value = item.category;
  handleCategoryFormChange();

  if (item.category === 'other' && item.sub_category) {
    document.getElementById('media-sub-category').value = item.sub_category;
  }

  document.getElementById('media-title').value = item.title;
  document.getElementById('media-cover').value = item.cover_url || '';
  document.getElementById('media-status').value = item.status;
  document.getElementById('media-progress').value = item.progress || 0;
  document.getElementById('media-total').value = item.total_units || '';
  document.getElementById('media-unit').value = item.unit_label || 'eps';
  document.getElementById('media-rating').value = (item.rating !== null && item.rating !== undefined) ? item.rating : '';
  document.getElementById('api-search-results').style.display = 'none';

  document.getElementById('media-modal').classList.add('active');
};

window.closeMediaModal = function () {
  document.getElementById('media-modal').classList.remove('active');
};

window.handleCategoryFormChange = function () {
  const cat = document.getElementById('media-category').value;
  const subGroup = document.getElementById('sub-category-group');
  const unitSelect = document.getElementById('media-unit');

  if (cat === 'other') {
    subGroup.style.display = 'flex';
    const sub = document.getElementById('media-sub-category').value;
    unitSelect.value = sub === 'light_novel' ? 'vol' : 'item';
  } else {
    subGroup.style.display = 'none';
    if (cat === 'series') unitSelect.value = 'eps';
    if (cat === 'movie') unitSelect.value = 'movie';
    if (cat === 'comic') unitSelect.value = 'ch';
  }
};

// Fetch helper with timeout so blocked domains never hang search
async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Helper: AniList GraphQL Search (Comic & Light Novel)
async function fetchAniListMedia(query, isNovel = false) {
  const gql = `
    query ($search: String) {
      Page(perPage: 6) {
        media(search: $search, type: MANGA, ${isNovel ? 'format: NOVEL' : 'format_not: NOVEL'}) {
          title { english romaji }
          coverImage { large }
          chapters
          volumes
          countryOfOrigin
        }
      }
    }
  `;
  const res = await fetchWithTimeout('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: gql, variables: { search: query } })
  });
  const json = await res.json();
  return (json.data?.Page?.media || []).map(m => {
    const originMap = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
    const label = isNovel ? 'Light Novel' : (originMap[m.countryOfOrigin] || 'Comic');
    return {
      title: m.title.english || m.title.romaji,
      cover: m.coverImage?.large || '',
      total: isNovel ? (m.volumes || m.chapters || null) : (m.chapters || null),
      unit: isNovel ? (m.volumes ? 'vol' : 'ch') : 'ch',
      meta: `${label} · ${isNovel ? (m.volumes || '?') + ' Vol' : (m.chapters || '?') + ' Ch'}`
    };
  });
}

// Deduplicate results with identical titles
function deduplicateResults(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

window.searchExternalAPI = async function () {
  const query = document.getElementById('api-search-input').value.trim();
  const cat = document.getElementById('media-category').value;
  const subCat = document.getElementById('media-sub-category').value;
  const resultsBox = document.getElementById('api-search-results');

  if (!query) return;
  resultsBox.style.display = 'block';
  resultsBox.innerHTML = `<p style="padding: 12px; font-size: 12px; color: var(--light-gray-70);">Searching...</p>`;

  let items = [];

  if (cat === 'series') {
    const [jikanRes, tvmazeRes, tmdbRes] = await Promise.allSettled([
      // 1. Jikan Anime TV (MyAnimeList - No key required)
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&type=tv&limit=5&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(a => ({
          title: a.title_english || a.title,
          cover: a.images?.jpg?.large_image_url || '',
          total: a.episodes || null,
          unit: 'eps',
          meta: `Anime Series · ${a.episodes || '?'} Eps`
        }));
      })(),
      // 2. TVMaze API (Global TV series - No key required)
      (async () => {
        const res = await fetchWithTimeout(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return (data || []).slice(0, 5).map(entry => ({
          tvmazeId: entry.show.id,
          title: entry.show.name,
          cover: entry.show.image?.original || entry.show.image?.medium || '',
          total: null,
          unit: 'eps',
          meta: `TV Series · ${entry.show.premiered?.slice(0, 4) || 'Show'}`
        }));
      })(),
      // 3. TMDB TV (Used if accessible)
      (async () => {
        if (!TMDB_API_KEY) return [];
        const res = await fetchWithTimeout(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).slice(0, 5).map(t => ({
          tmdbId: t.id,
          title: t.name,
          cover: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : '',
          total: null,
          unit: 'eps',
          meta: `TV Series · ${t.first_air_date?.slice(0, 4) || 'TMDB'}`
        }));
      })()
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (tvmazeRes.status === 'fulfilled') items.push(...tvmazeRes.value);
    if (tmdbRes.status === 'fulfilled') items.push(...tmdbRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'movie') {
    const [jikanRes, itunesRes, tmdbRes] = await Promise.allSettled([
      // 1. Jikan Anime Movie (MyAnimeList - No key required)
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&type=movie&limit=5&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(a => ({
          title: a.title_english || a.title,
          cover: a.images?.jpg?.large_image_url || '',
          total: 1,
          unit: 'movie',
          meta: `Anime Movie · ${a.year || 'Film'}`
        }));
      })(),
      // 2. iTunes Movie Search API (Global movies - No key required)
      (async () => {
        const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=movie&limit=5`);
        const data = await res.json();
        return (data.results || []).map(m => ({
          title: m.trackName,
          cover: m.artworkUrl100 ? m.artworkUrl100.replace('100x100bb', '600x600bb') : '',
          total: 1,
          unit: 'movie',
          meta: `Movie · ${m.releaseDate?.slice(0, 4) || 'Film'}`
        }));
      })(),
      // 3. TMDB Movie (Used if accessible)
      (async () => {
        if (!TMDB_API_KEY) return [];
        const res = await fetchWithTimeout(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).slice(0, 5).map(m => ({
          title: m.title,
          cover: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
          total: 1,
          unit: 'movie',
          meta: `Movie · ${m.release_date?.slice(0, 4) || 'TMDB'}`
        }));
      })()
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (itunesRes.status === 'fulfilled') items.push(...itunesRes.value);
    if (tmdbRes.status === 'fulfilled') items.push(...tmdbRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'comic') {
    const [jikanRes, aniRes] = await Promise.allSettled([
      // 1. Jikan Manga / Manhwa / Manhua
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=6&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || [])
          .filter(m => m.type !== 'Light Novel' && m.type !== 'Novel')
          .map(m => ({
            title: m.title_english || m.title,
            cover: m.images?.jpg?.large_image_url || '',
            total: m.chapters || null,
            unit: 'ch',
            meta: `${m.type} · ${m.chapters || '?'} Ch`
          }));
      })(),
      // 2. AniList Manga / Manhwa / Manhua
      fetchAniListMedia(query, false)
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (aniRes.status === 'fulfilled') items.push(...aniRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'other' && subCat === 'light_novel') {
    const [jikanRes, aniRes] = await Promise.allSettled([
      // 1. Jikan Light Novel
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&type=lightnovel&limit=5&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(ln => ({
          title: ln.title_english || ln.title,
          cover: ln.images?.jpg?.large_image_url || '',
          total: ln.volumes || ln.chapters || null,
          unit: ln.volumes ? 'vol' : 'ch',
          meta: `Light Novel · ${ln.volumes || '?'} Vol`
        }));
      })(),
      // 2. AniList Light Novel
      fetchAniListMedia(query, true)
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (aniRes.status === 'fulfilled') items.push(...aniRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'other' && subCat === 'game') {
    const [rawgRes, vndbRes] = await Promise.allSettled([
      (async () => {
        if (!RAWG_API_KEY) return [];
        const res = await fetchWithTimeout(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=5`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map(g => ({
          title: g.name,
          cover: g.background_image || '',
          total: 1,
          unit: 'item',
          meta: `Game · ${g.released?.slice(0, 4) || ''}`
        }));
      })(),
      (async () => {
        const res = await fetchWithTimeout('https://api.vndb.org/kana/vn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: ['search', '=', query],
            fields: 'title, image.url, released',
            results: 6
          })
        });
        const data = await res.json();
        return (data.results || []).map(g => ({
          title: g.title,
          cover: g.image?.url || '',
          total: 1,
          unit: 'item',
          meta: `Visual Novel · ${g.released || ''}`
        }));
      })()
    ]);

    if (rawgRes.status === 'fulfilled') items.push(...rawgRes.value);
    if (vndbRes.status === 'fulfilled') items.push(...vndbRes.value);
    items = deduplicateResults(items);
  }

  lastApiResults = items;

  if (items.length === 0) {
    resultsBox.innerHTML = `<p style="padding: 12px; font-size: 12px; color: var(--light-gray-70);">No results found. Please fill in the fields manually below.</p>`;
    return;
  }

  resultsBox.innerHTML = items.map((it, idx) => `
    <div class="api-result-item" onclick="applyApiResult(${idx})">
      <img src="${it.cover || 'https://placehold.co/60x90/1e1e1f/888?text=?'}" alt="" onerror="this.src='https://placehold.co/60x90/1e1e1f/888?text=?'">
      <div class="api-result-info">
        <h4>${it.title}</h4>
        <p>${it.meta}</p>
      </div>
    </div>
  `).join('');
};

window.applyApiResult = async function (idx) {
  const item = lastApiResults[idx];
  if (!item) return;

  document.getElementById('media-title').value = item.title;
  document.getElementById('media-cover').value = item.cover || '';
  if (item.total) document.getElementById('media-total').value = item.total;
  if (item.unit) document.getElementById('media-unit').value = item.unit;
  document.getElementById('api-search-results').style.display = 'none';

  // Auto-fetch total episodes from TVMaze
  if (item.tvmazeId) {
    try {
      const epRes = await fetchWithTimeout(`https://api.tvmaze.com/shows/${item.tvmazeId}/episodes`);
      const epData = await epRes.json();
      if (Array.isArray(epData) && epData.length > 0) {
        document.getElementById('media-total').value = epData.length;
      }
    } catch (e) {
      console.error('TVMaze episode count error:', e);
    }
  }

  // Auto-fetch total episodes from TMDB
  if (item.tmdbId && TMDB_API_KEY) {
    try {
      const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}`);
      const detailData = await detailRes.json();
      if (detailData.number_of_episodes) {
        document.getElementById('media-total').value = detailData.number_of_episodes;
      }
    } catch (e) {
      console.error('TMDB detail error:', e);
    }
  }
};

// ==========================================
// 6. SUPABASE CRUD (CREATE, UPDATE, DELETE)
// ==========================================
document.getElementById('media-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('media-id').value;
  const category = document.getElementById('media-category').value;
  const subCategory = category === 'other' ? document.getElementById('media-sub-category').value : null;
  const ratingRaw = document.getElementById('media-rating').value;
  const totalRaw = document.getElementById('media-total').value;

  const payload = {
    title: document.getElementById('media-title').value.trim(),
    category,
    sub_category: subCategory,
    cover_url: document.getElementById('media-cover').value.trim() || null,
    status: document.getElementById('media-status').value,
    progress: parseInt(document.getElementById('media-progress').value) || 0,
    total_units: totalRaw ? parseInt(totalRaw) : null,
    unit_label: document.getElementById('media-unit').value,
    rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null,
    updated_at: new Date().toISOString()
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('media_logs').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('media_logs').insert([payload]));
  }

  if (error) {
    Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
  } else {
    closeMediaModal();
    await fetchMediaLogs();
  }
});

window.incrementProgress = async function (id) {
  const item = allMediaLogs.find(m => m.id === id);
  if (!item) return;

  const nextProgress = (item.progress || 0) + 1;
  const nextStatus = (item.total_units && nextProgress >= item.total_units) ? 'completed' : item.status;

  const { error } = await supabaseClient
    .from('media_logs')
    .update({ progress: nextProgress, status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (!error) await fetchMediaLogs();
};

window.deleteMedia = async function (id) {
  const confirm = await Swal.fire({
    text: 'Remove this entry from your library?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (confirm.isConfirmed) {
    const { error } = await supabaseClient.from('media_logs').delete().eq('id', id);
    if (!error) await fetchMediaLogs();
  }
};
