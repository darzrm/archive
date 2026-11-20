'use strict';

// ==========================================
// 1. SUPABASE & EXTERNAL API CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uendrdxiixmikkeanlod.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IdPLjwQhVQwXGGxUnBVblg_oIQ5Zz89';
const TMDB_API_KEY = '727a00da59cd2b9873f7636a5bde9561';
const RAWG_API_KEY = '';
const STORAGE_BUCKET = 'media-assets';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/*-----------------------------------*\
  #GLOBAL STATE & CONSTANTS
\*-----------------------------------*/

let isAdmin = false;
let currentPrimaryView = 'notes';
let allEntries = [];
let allNotes = [];

// Library Filters & View State
let selectedCategory = 'all';
let selectedStatus = 'all';
let ratingMin = null;
let ratingMax = null;
let rewatchedOnly = false;
let sortField = 'updated';
let sortDir = 'desc';
let itemsPerPage = 24;
let currentPageMultiplier = 1;
let viewMode = 'grid';

// News State
const DEFAULT_RSS_SOURCES = [
  { name: 'CNN Indonesia', topic: 'indonesia', url: 'https://www.cnnindonesia.com/nasional/rss' },
  { name: 'Antara News', topic: 'indonesia', url: 'https://www.antaranews.com/rss/terkini.xml' },
  { name: 'The Verge', topic: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'IGN', topic: 'gaming', url: 'https://feeds.feedburner.com/ign/all' }
];
let rssSources = JSON.parse(localStorage.getItem('archive_rss_sources')) || DEFAULT_RSS_SOURCES;
let allNewsItems = [];
let currentNewsTopic = 'all';
let newsSearchQuery = '';

let profileData = {
  name: 'Personal Archive',
  bio: 'Notes, movies, shows, comics, novels, games & music log.',
  avatar: './assets/images/my-avatar.png',
  banner: '',
  socials: []
};

const CATEGORY_LABELS = {
  tv: 'TV Show',
  movie: 'Movie',
  comic: 'Comic',
  novel: 'Novel',
  game: 'Game',
  music: 'Music'
};

const CATEGORY_UNITS = {
  tv: 'eps',
  movie: 'watched',
  comic: 'ch',
  novel: 'ch',
  game: 'done',
  music: 'tracks'
};

/*-----------------------------------*\
  #UTILITIES & TOAST
\*-----------------------------------*/

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${isError ? 'error' : ''}`;
  toast.innerHTML = `
    <ion-icon name="${isError ? 'alert-circle-outline' : 'checkmark-circle-outline'}"></ion-icon>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 240);
  }, 2800);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

/*-----------------------------------*\
  #STICKY MINI HEADER & SCROLL
\*-----------------------------------*/

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const miniHeader = document.getElementById('sticky-mini-header');
  const backTopBtn = document.getElementById('back-to-top-btn');

  if (miniHeader) {
    miniHeader.classList.toggle('visible', scrollY > 190);
  }
  if (backTopBtn) {
    backTopBtn.classList.toggle('visible', scrollY > 360);
  }
});

document.getElementById('sticky-scroll-top')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('back-to-top-btn')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/*-----------------------------------*\
  #VIEW SWITCHING (NOTES / LIBRARY / NEWS)
\*-----------------------------------*/

function switchPrimaryView(view) {
  currentPrimaryView = view;

  document.querySelectorAll('.main-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.mini-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.miniView === view);
  });

  document.getElementById('notes-view').style.display = view === 'notes' ? 'block' : 'none';
  document.getElementById('library-view').style.display = view === 'library' ? 'block' : 'none';
  document.getElementById('news-view').style.display = view === 'news' ? 'block' : 'none';

  updateAdminUI();

  if (view === 'news' && allNewsItems.length === 0) {
    fetchAllNews();
  }
}

document.querySelectorAll('.main-view-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPrimaryView(btn.dataset.view));
});

document.querySelectorAll('.mini-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPrimaryView(btn.dataset.miniView));
});

/*-----------------------------------*\
  #ADMIN AUTHENTICATION
\*-----------------------------------*/

function updateAdminUI() {
  const adminBtn = document.getElementById('admin-toggle-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const newNoteBtn = document.getElementById('new-note-btn');
  const exportBtn = document.getElementById('export-library-btn');
  const addMediaBtn = document.getElementById('open-add-modal-btn');
  const manageRssBtn = document.getElementById('manage-rss-btn');

  if (adminBtn) {
    adminBtn.innerHTML = isAdmin
      ? '<ion-icon name="lock-open-outline"></ion-icon><span>Logout</span>'
      : '<ion-icon name="lock-closed-outline"></ion-icon><span>Admin</span>';
  }

  if (editProfileBtn) editProfileBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  if (newNoteBtn) newNoteBtn.style.display = (isAdmin && currentPrimaryView === 'notes') ? 'inline-flex' : 'none';
  if (exportBtn) exportBtn.style.display = (isAdmin && currentPrimaryView === 'library') ? 'inline-flex' : 'none';
  if (addMediaBtn) addMediaBtn.style.display = (isAdmin && currentPrimaryView === 'library') ? 'inline-flex' : 'none';
  if (manageRssBtn) manageRssBtn.style.display = (isAdmin && currentPrimaryView === 'news') ? 'inline-flex' : 'none';

  renderNotesFeed();
  renderMediaGrid();
}

async function checkAuthSession() {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  isAdmin = !!data?.session;
  updateAdminUI();
}

document.getElementById('admin-toggle-btn')?.addEventListener('click', async () => {
  if (isAdmin) {
    if (sb) await sb.auth.signOut();
    isAdmin = false;
    updateAdminUI();
    showToast('Signed out from Admin mode');
  } else {
    openModal('login-modal');
  }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sb) return showToast('Supabase is not configured yet', true);

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message, true);
  } else {
    isAdmin = true;
    closeModal('login-modal');
    updateAdminUI();
    showToast('Welcome back, Admin');
  }
});

/*-----------------------------------*\
  #IMAGE UPLOAD HELPER (SUPABASE STORAGE)
\*-----------------------------------*/

async function compressAndUploadImage(file, folder = 'images') {
  if (!sb) {
    showToast('Configure Supabase first to upload files', true);
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1280;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          if (!blob) return resolve(null);
          const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
          const { error } = await sb.storage.from(STORAGE_BUCKET).upload(fileName, blob, {
            contentType: 'image/webp',
            upsert: true
          });

          if (error) {
            showToast('Upload failed: ' + error.message, true);
            return resolve(null);
          }

          const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
          resolve(pub?.publicUrl || null);
        }, 'image/webp', 0.82);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/*-----------------------------------*\
  #PROFILE MANAGEMENT
\*-----------------------------------*/

function renderProfileHeader() {
  const card = document.getElementById('profile-header-card');
  const bannerWrap = document.getElementById('profile-banner-wrap');
  const bannerImg = document.getElementById('display-banner');
  const avatarImg = document.getElementById('display-avatar');
  const miniAvatar = document.getElementById('mini-avatar');
  const nameEl = document.getElementById('display-name');
  const miniName = document.getElementById('mini-name');
  const bioEl = document.getElementById('display-bio');
  const socialsBar = document.getElementById('profile-socials-bar');
  const footerText = document.getElementById('footer-text');

  if (nameEl) nameEl.textContent = profileData.name || 'Personal Archive';
  if (miniName) miniName.textContent = profileData.name || 'Personal Archive';
  if (bioEl) bioEl.textContent = profileData.bio || '';
  if (avatarImg) avatarImg.src = profileData.avatar || './assets/images/my-avatar.png';
  if (miniAvatar) miniAvatar.src = profileData.avatar || './assets/images/my-avatar.png';
  if (footerText) footerText.textContent = `© ${new Date().getFullYear()} ${profileData.name || 'Personal Archive'} — All rights reserved.`;

  if (profileData.banner && profileData.banner.trim() !== '') {
    bannerWrap.style.display = 'block';
    bannerImg.src = profileData.banner;
    card.classList.add('has-banner');
  } else {
    bannerWrap.style.display = 'none';
    card.classList.remove('has-banner');
  }

  const socials = Array.isArray(profileData.socials) ? profileData.socials : [];
  if (socials.length > 0) {
    socialsBar.style.display = 'flex';
    socialsBar.innerHTML = socials.map(s => `
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="social-chip">
        <ion-icon name="link-outline"></ion-icon>
        <span>${escapeHtml(s.label || 'Link')}</span>
      </a>
    `).join('');
  } else {
    socialsBar.style.display = 'none';
  }
}

async function loadProfile() {
  const localSaved = localStorage.getItem('archive_profile_data');
  if (localSaved) {
    try {
      profileData = { ...profileData, ...JSON.parse(localSaved) };
    } catch (_) {}
  }
  renderProfileHeader();

  if (!sb) return;
  const { data } = await sb.from('profile_settings').select('*').eq('id', 1).maybeSingle();
  if (data) {
    profileData = {
      name: data.name || profileData.name,
      bio: data.bio || profileData.bio,
      avatar: data.avatar || profileData.avatar,
      banner: data.banner || '',
      socials: Array.isArray(data.socials) ? data.socials : []
    };
    localStorage.setItem('archive_profile_data', JSON.stringify(profileData));
    renderProfileHeader();
  }
}

function addSocialEditorRow(label = '', url = '') {
  const container = document.getElementById('social-links-editor');
  const row = document.createElement('div');
  row.className = 'social-edit-row';
  row.innerHTML = `
    <input type="text" class="form-input social-label-input" placeholder="Platform" value="${escapeHtml(label)}">
    <input type="url" class="form-input social-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="social-remove-btn" title="Remove"><ion-icon name="trash-outline"></ion-icon></button>
  `;
  row.querySelector('.social-remove-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
  document.getElementById('profile-name-input').value = profileData.name || '';
  document.getElementById('profile-bio-input').value = profileData.bio || '';
  document.getElementById('profile-avatar-input').value = profileData.avatar || '';
  document.getElementById('profile-banner-input').value = profileData.banner || '';
  document.getElementById('profile-upload-status').textContent = '';

  const editor = document.getElementById('social-links-editor');
  editor.innerHTML = '';
  (profileData.socials || []).forEach(s => addSocialEditorRow(s.label, s.url));
  openModal('profile-modal');
});

document.getElementById('add-social-row-btn')?.addEventListener('click', () => addSocialEditorRow());

document.getElementById('profile-avatar-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('profile-upload-status');
  status.textContent = 'Uploading avatar...';
  const url = await compressAndUploadImage(file, 'avatars');
  if (url) {
    document.getElementById('profile-avatar-input').value = url;
    status.textContent = 'Avatar uploaded!';
  } else {
    status.textContent = '';
  }
});

document.getElementById('profile-banner-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('profile-upload-status');
  status.textContent = 'Uploading banner...';
  const url = await compressAndUploadImage(file, 'banners');
  if (url) {
    document.getElementById('profile-banner-input').value = url;
    status.textContent = 'Banner uploaded!';
  } else {
    status.textContent = '';
  }
});

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const socials = [];
  document.querySelectorAll('#social-links-editor .social-edit-row').forEach(row => {
    const label = row.querySelector('.social-label-input').value.trim();
    const url = row.querySelector('.social-url-input').value.trim();
    if (label && url) socials.push({ label, url });
  });

  profileData = {
    name: document.getElementById('profile-name-input').value.trim() || 'Personal Archive',
    bio: document.getElementById('profile-bio-input').value.trim(),
    avatar: document.getElementById('profile-avatar-input').value.trim() || './assets/images/my-avatar.png',
    banner: document.getElementById('profile-banner-input').value.trim(),
    socials
  };

  localStorage.setItem('archive_profile_data', JSON.stringify(profileData));
  renderProfileHeader();

  if (sb) {
    await sb.from('profile_settings').upsert({
      id: 1,
      name: profileData.name,
      bio: profileData.bio,
      avatar: profileData.avatar,
      banner: profileData.banner,
      socials: profileData.socials
    });
  }

  closeModal('profile-modal');
  showToast('Profile updated');
});

/*-----------------------------------*\
  #PERSONAL NOTES / MICRO-BLOG
\*-----------------------------------*/

function formatNoteContentWithLinks(text) {
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-note-link">${url}</a>`;
  });
}

function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(/(https?:\/\/[^\s]+)/);
  return match ? match[1] : null;
}

function renderNotesFeed() {
  const container = document.getElementById('blog-feed-container');
  if (!container) return;

  if (allNotes.length === 0) {
    container.innerHTML = '<div class="empty-state">No notes posted yet.</div>';
    return;
  }

  container.innerHTML = allNotes.map(note => {
    const timeStr = new Date(note.created_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const firstUrl = extractFirstUrl(note.content);
    let domain = '';
    if (firstUrl) {
      try { domain = new URL(firstUrl).hostname.replace(/^www\./, ''); } catch (_) {}
    }

    return `
      <article class="blog-post-card">
        <div class="blog-post-header">
          <div class="blog-post-author">
            <img src="${escapeHtml(profileData.avatar || './assets/images/my-avatar.png')}" alt="Avatar" class="blog-post-avatar">
            <div class="blog-post-meta">
              <span class="blog-post-name">${escapeHtml(profileData.name || 'Personal Archive')}</span>
              <span class="blog-post-time">${timeStr}</span>
            </div>
          </div>
          ${isAdmin ? `
            <div class="blog-post-actions">
              <button type="button" class="blog-icon-btn" onclick="editNote('${note.id}')" title="Edit Note">
                <ion-icon name="create-outline"></ion-icon>
              </button>
              <button type="button" class="blog-icon-btn delete" onclick="deleteNote('${note.id}')" title="Delete Note">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>
          ` : ''}
        </div>
        ${note.content ? `<div class="blog-post-text">${formatNoteContentWithLinks(note.content)}</div>` : ''}
        ${firstUrl && domain ? `
          <a href="${escapeHtml(firstUrl)}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
            <div class="link-preview-icon"><ion-icon name="globe-outline"></ion-icon></div>
            <div class="link-preview-info">
              <span class="link-preview-domain">${escapeHtml(domain)}</span>
              <span class="link-preview-title">${escapeHtml(firstUrl)}</span>
            </div>
            <ion-icon name="open-outline"></ion-icon>
          </a>
        ` : ''}
        ${note.image_url ? `
          <div class="blog-post-image-wrap">
            <img src="${escapeHtml(note.image_url)}" alt="Attachment" loading="lazy">
          </div>
        ` : ''}
      </article>
    `;
  }).join('');
}

async function loadNotes() {
  if (!sb) {
    allNotes = JSON.parse(localStorage.getItem('archive_notes_local') || '[]');
    renderNotesFeed();
    return;
  }

  const { data, error } = await sb
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    allNotes = data;
    renderNotesFeed();
  }
}

document.getElementById('new-note-btn')?.addEventListener('click', () => {
  document.getElementById('note-modal-title').textContent = 'New Note';
  document.getElementById('note-id').value = '';
  document.getElementById('note-content-input').value = '';
  document.getElementById('note-image-input').value = '';
  document.getElementById('note-upload-status').textContent = '';
  openModal('note-modal');
});

window.editNote = function(id) {
  const note = allNotes.find(n => String(n.id) === String(id));
  if (!note) return;
  document.getElementById('note-modal-title').textContent = 'Edit Note';
  document.getElementById('note-id').value = note.id;
  document.getElementById('note-content-input').value = note.content || '';
  document.getElementById('note-image-input').value = note.image_url || '';
  document.getElementById('note-upload-status').textContent = '';
  openModal('note-modal');
};

window.deleteNote = async function(id) {
  if (!confirm('Delete this note?')) return;
  if (sb) {
    await sb.from('notes').delete().eq('id', id);
    await loadNotes();
  } else {
    allNotes = allNotes.filter(n => String(n.id) !== String(id));
    localStorage.setItem('archive_notes_local', JSON.stringify(allNotes));
    renderNotesFeed();
  }
  showToast('Note deleted');
};

document.getElementById('note-image-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('note-upload-status');
  status.textContent = 'Uploading photo...';
  const url = await compressAndUploadImage(file, 'notes');
  if (url) {
    document.getElementById('note-image-input').value = url;
    status.textContent = 'Photo attached!';
  } else {
    status.textContent = '';
  }
});

document.getElementById('note-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('note-id').value;
  const content = document.getElementById('note-content-input').value.trim();
  const image_url = document.getElementById('note-image-input').value.trim();

  if (!content && !image_url) return showToast('Write something or attach an image', true);

  if (sb) {
    if (id) {
      await sb.from('notes').update({ content, image_url }).eq('id', id);
    } else {
      await sb.from('notes').insert([{ content, image_url }]);
    }
    await loadNotes();
  } else {
    if (id) {
      const idx = allNotes.findIndex(n => String(n.id) === String(id));
      if (idx > -1) allNotes[idx] = { ...allNotes[idx], content, image_url };
    } else {
      allNotes.unshift({ id: Date.now(), content, image_url, created_at: new Date().toISOString() });
    }
    localStorage.setItem('archive_notes_local', JSON.stringify(allNotes));
    renderNotesFeed();
  }

  closeModal('note-modal');
  showToast(id ? 'Note updated' : 'Note posted');
});

/*-----------------------------------*\
  #MEDIA LIBRARY & BENTO STATISTICS
\*-----------------------------------*/

function updateLibraryStats() {
  const counts = { tv: 0, movie: 0, comic: 0, novel: 0, game: 0, music: 0 };
  let tvEps = 0, movieDone = 0, comicCh = 0, novelCh = 0, gameDone = 0, musicTracks = 0;
  let totalEps = 0, totalMovies = 0, totalCh = 0, totalVol = 0, totalGames = 0, totalTracks = 0;
  let completedCount = 0, ratingSum = 0, ratedCount = 0;

  allEntries.forEach(item => {
    const cat = item.category || 'tv';
    if (counts[cat] !== undefined) counts[cat]++;

    const prog = Number(item.progress) || 0;
    const vols = Number(item.volumes) || 0;
    const rating = Number(item.rating) || 0;

    if (item.status === 'completed') completedCount++;
    if (rating > 0) {
      ratingSum += rating;
      ratedCount++;
    }

    if (cat === 'tv') { tvEps += prog; totalEps += prog; }
    if (cat === 'movie') { if (item.status === 'completed') movieDone++; totalMovies += (prog || (item.status === 'completed' ? 1 : 0)); }
    if (cat === 'comic') { comicCh += prog; totalCh += prog; totalVol += vols; }
    if (cat === 'novel') { novelCh += prog; totalCh += prog; totalVol += vols; }
    if (cat === 'game') { if (item.status === 'completed') gameDone++; totalGames++; }
    if (cat === 'music') { musicTracks += prog; totalTracks += prog; }

    if (Array.isArray(item.extra_tracks)) {
      item.extra_tracks.forEach(tr => {
        const tProg = Number(tr.progress) || 0;
        if (tr.category === 'tv') totalEps += tProg;
        if (tr.category === 'comic' || tr.category === 'novel') totalCh += tProg;
        if (tr.category === 'music') totalTracks += tProg;
      });
    }
  });

  const totalEntries = allEntries.length;
  document.getElementById('stats-quick-pill').textContent = `${totalEntries} Entries`;
  document.getElementById('stat-tv-count').textContent = counts.tv;
  document.getElementById('stat-tv-eps').textContent = `${tvEps} eps`;
  document.getElementById('stat-movie-count').textContent = counts.movie;
  document.getElementById('stat-movie-sub').textContent = `${movieDone} watched`;
  document.getElementById('stat-comic-count').textContent = counts.comic;
  document.getElementById('stat-comic-ch').textContent = `${comicCh} ch`;
  document.getElementById('stat-novel-count').textContent = counts.novel;
  document.getElementById('stat-novel-ch').textContent = `${novelCh} ch`;
  document.getElementById('stat-game-count').textContent = counts.game;
  document.getElementById('stat-game-sub').textContent = `${gameDone} completed`;
  document.getElementById('stat-music-count').textContent = counts.music;
  document.getElementById('stat-music-tracks').textContent = `${musicTracks} tracks`;

  document.getElementById('unit-total-entries').textContent = totalEntries;
  document.getElementById('unit-total-eps').textContent = totalEps;
  document.getElementById('unit-total-movies').textContent = totalMovies;
  document.getElementById('unit-total-ch').textContent = totalCh;
  document.getElementById('unit-total-vol').textContent = totalVol;
  document.getElementById('unit-total-games').textContent = totalGames;
  document.getElementById('unit-total-tracks').textContent = totalTracks;

  const rate = totalEntries > 0 ? Math.round((completedCount / totalEntries) * 100) : 0;
  const avg = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : '0.0';

  document.getElementById('stat-completed-count').textContent = completedCount;
  document.getElementById('stat-completion-rate').textContent = `${rate}% rate`;
  document.getElementById('stat-avg-rating').textContent = avg;
  document.getElementById('stat-rated-sub').textContent = `${ratedCount} rated entries`;
}

document.getElementById('stats-toggle-bar')?.addEventListener('click', () => {
  const panel = document.getElementById('collapsible-stats-panel');
  const label = document.getElementById('stats-toggle-label');
  const icon = document.getElementById('stats-toggle-icon');
  const isOpen = panel.style.display !== 'none';

  panel.style.display = isOpen ? 'none' : 'flex';
  label.textContent = isOpen ? 'Show Details' : 'Hide Details';
  icon.setAttribute('name', isOpen ? 'chevron-down-outline' : 'chevron-up-outline');
});

function getFilteredAndSortedMedia() {
  const query = (document.getElementById('library-search')?.value || '').toLowerCase().trim();

  const filtered = allEntries.filter(item => {
    const matchCat = selectedCategory === 'all'
      || item.category === selectedCategory
      || (Array.isArray(item.extra_tracks) && item.extra_tracks.some(t => t.category === selectedCategory));

    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const r = Number(item.rating) || 0;
    const matchMin = ratingMin === null || r >= ratingMin;
    const matchMax = ratingMax === null || r <= ratingMax;
    const matchRewatch = !rewatchedOnly || (Number(item.repeat_count) || 0) > 0;
    const matchSearch = !query
      || (item.title || '').toLowerCase().includes(query)
      || (item.notes || '').toLowerCase().includes(query);

    return matchCat && matchStatus && matchMin && matchMax && matchRewatch && matchSearch;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') {
      cmp = (a.title || '').localeCompare(b.title || '');
    } else if (sortField === 'rating') {
      cmp = (Number(a.rating) || 0) - (Number(b.rating) || 0);
    } else if (sortField === 'status') {
      cmp = (a.status || '').localeCompare(b.status || '');
    } else if (sortField === 'progress') {
      cmp = (Number(a.progress) || 0) - (Number(b.progress) || 0);
    } else {
      cmp = new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return filtered;
}

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (!grid) return;

  grid.classList.toggle('list-view', viewMode === 'list');
  const items = getFilteredAndSortedMedia();

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">No media entries match your current filter.</div>';
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  const limit = itemsPerPage === 'all' ? items.length : itemsPerPage * currentPageMultiplier;
  const visibleItems = items.slice(0, limit);

  if (loadMoreWrap) {
    if (visibleItems.length < items.length) {
      loadMoreWrap.style.display = 'flex';
      document.getElementById('load-more-label').textContent = `Load More (${items.length - visibleItems.length} remaining)`;
    } else {
      loadMoreWrap.style.display = 'none';
    }
  }

  if (viewMode === 'list') {
    grid.innerHTML = visibleItems.map(item => {
      const prog = Number(item.progress) || 0;
      const total = Number(item.total) || 0;
      const unit = CATEGORY_UNITS[item.category] || '';
      const progText = total > 0 ? `${prog}/${total} ${unit}` : `${prog} ${unit}`;
      const rating = Number(item.rating) > 0 ? `★ ${Number(item.rating).toFixed(1)}` : '—';

      return `
        <div class="media-list-row" onclick="openDetailModal('${item.id}')">
          <img src="${escapeHtml(item.image_url || TRANSPARENT_PIXEL)}" alt="" class="list-thumb" loading="lazy">
          <div class="list-main-info">
            <div class="list-title">${escapeHtml(item.title)}</div>
            <div class="list-sub-meta">
              <span class="list-cat-tag">${CATEGORY_LABELS[item.category] || item.category}</span>
              <span>•</span>
              <span class="status-pill ${item.status}">${item.status}</span>
              <span>•</span>
              <span>${progText}</span>
              ${Number(item.repeat_count) > 0 ? `<span class="list-repeat-tag">• ↻ ${item.repeat_count}x</span>` : ''}
            </div>
          </div>
          <div class="list-right-meta">
            <span class="list-rating-pill">${rating}</span>
            ${isAdmin ? `
              <button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditMediaModal('${item.id}')" title="Edit">
                <ion-icon name="create-outline"></ion-icon>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  grid.innerHTML = visibleItems.map(item => {
    const prog = Number(item.progress) || 0;
    const total = Number(item.total) || 0;
    const unit = CATEGORY_UNITS[item.category] || '';
    const progText = total > 0 ? `${prog}/${total}` : `${prog} ${unit}`;

    let pct = 0;
    if (item.status === 'completed') pct = 100;
    else if (total > 0) pct = Math.min(100, Math.round((prog / total) * 100));
    else if (prog > 0) pct = 50;

    const extraSeasonsCount = Array.isArray(item.seasons) ? item.seasons.length : 0;
    const dateLabel = item.finish_date
      ? `Finished ${formatDateDisplay(item.finish_date)}`
      : item.start_date
        ? `Started ${formatDateDisplay(item.start_date)}`
        : `Updated ${formatDateDisplay(item.updated_at || item.created_at)}`;

    return `
      <article class="media-card" onclick="openDetailModal('${item.id}')">
        <div class="media-cover-wrap">
          <img src="${escapeHtml(item.image_url || TRANSPARENT_PIXEL)}" alt="${escapeHtml(item.title)}" loading="lazy">
          <div class="cover-left-badges">
            <div class="badge-cat-row">
              <span class="badge-cat">${CATEGORY_LABELS[item.category] || item.category}</span>
              ${(item.extra_tracks || []).map(tr => `<span class="badge-cat">+${CATEGORY_LABELS[tr.category] || tr.category}</span>`).join('')}
            </div>
            ${Number(item.rating) > 0 ? `<span class="badge-rating">★ ${Number(item.rating).toFixed(1)}</span>` : ''}
            ${Number(item.repeat_count) > 0 ? `<span class="badge-repeat">↻ ${item.repeat_count}x</span>` : ''}
          </div>
          ${extraSeasonsCount > 0 ? `<span class="badge-seasons">+${extraSeasonsCount} more</span>` : ''}
          ${isAdmin ? `
            <button type="button" class="cover-edit-btn" onclick="event.stopPropagation(); openEditMediaModal('${item.id}')" title="Edit Entry">
              <ion-icon name="create-outline"></ion-icon>
            </button>
          ` : ''}
        </div>

        <div class="media-body">
          <h3 class="media-title">${escapeHtml(item.title)}</h3>
          <div class="media-bottom-stack">
            <div class="media-meta-row">
              <span class="status-pill ${item.status}">${item.status}</span>
              <span class="progress-pill ${item.status}">${progText}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${item.status}" style="width: ${pct}%;"></div>
            </div>
            <div class="media-footer-row">
              <span class="status-date-item">
                <ion-icon name="calendar-outline"></ion-icon>
                <span>${dateLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function loadMediaLibrary() {
  if (!sb) {
    allEntries = JSON.parse(localStorage.getItem('archive_media_local') || '[]');
    updateLibraryStats();
    renderMediaGrid();
    return;
  }

  const { data, error } = await sb
    .from('media_logs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!error && data) {
    allEntries = data;
    updateLibraryStats();
    renderMediaGrid();
  }
}

/*-----------------------------------*\
  #DETAIL MODAL PREVIEW
\*-----------------------------------*/

window.openDetailModal = function(id) {
  const item = allEntries.find(e => String(e.id) === String(id));
  if (!item) return;

  document.getElementById('detail-modal-title').textContent = item.title;
  const body = document.getElementById('detail-modal-body');
  const unit = CATEGORY_UNITS[item.category] || '';
  const progText = Number(item.total) > 0 ? `${item.progress} / ${item.total} ${unit}` : `${item.progress} ${unit}`;

  body.innerHTML = `
    <div class="detail-hero">
      <img src="${escapeHtml(item.image_url || TRANSPARENT_PIXEL)}" alt="" class="detail-poster">
      <div class="detail-meta-col">
        <div class="badge-cat-row">
          <span class="badge-cat">${CATEGORY_LABELS[item.category] || item.category}</span>
          <span class="status-pill ${item.status}">${item.status}</span>
          ${Number(item.rating) > 0 ? `<span class="badge-rating">★ ${Number(item.rating).toFixed(1)} / 10</span>` : ''}
        </div>
        <div style="font-size: 13px; color: var(--light-gray);">
          <strong>Progress:</strong> ${progText}
          ${Number(item.volumes) > 0 ? ` • <strong>Volumes:</strong> ${item.volumes}` : ''}
          ${Number(item.repeat_count) > 0 ? ` • <strong>Repeat:</strong> ${item.repeat_count}x` : ''}
        </div>
        ${item.start_date || item.finish_date ? `
          <div style="font-size: 12px; color: var(--light-gray-70);">
            ${item.start_date ? `Started: ${formatDateDisplay(item.start_date)}` : ''}
            ${item.start_date && item.finish_date ? ' • ' : ''}
            ${item.finish_date ? `Finished: ${formatDateDisplay(item.finish_date)}` : ''}
          </div>
        ` : ''}
      </div>
    </div>

    ${Array.isArray(item.extra_tracks) && item.extra_tracks.length > 0 ? `
      <div>
        <div class="detail-section-title">Cross-Category Progress</div>
        <div class="detail-list">
          ${item.extra_tracks.map(tr => `
            <div class="detail-row-item">
              <span><strong>${CATEGORY_LABELS[tr.category] || tr.category}</strong> (${tr.status})</span>
              <span>${tr.progress}${tr.total > 0 ? '/' + tr.total : ''} ${CATEGORY_UNITS[tr.category] || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${Array.isArray(item.seasons) && item.seasons.length > 0 ? `
      <div>
        <div class="detail-section-title">Additional Seasons / Entries</div>
        <div class="detail-list">
          ${item.seasons.map(s => `
            <div class="detail-row-item">
              <span><strong>${escapeHtml(s.name || 'Season')}</strong> (${s.status})</span>
              <span>${s.progress}${s.total > 0 ? '/' + s.total : ''} • ★ ${s.rating || 0}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${item.notes ? `
      <div>
        <div class="detail-section-title">Personal Notes</div>
        <div style="background: var(--onyx); border: 1px solid var(--jet); border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.6; color: var(--light-gray); white-space: pre-wrap;">${escapeHtml(item.notes)}</div>
      </div>
    ` : ''}

    ${isAdmin ? `
      <div class="modal-submit-row">
        <button type="button" class="form-btn primary-submit" onclick="closeModal('detail-modal'); openEditMediaModal('${item.id}')">Edit Entry</button>
      </div>
    ` : ''}
  `;

  openModal('detail-modal');
};

/*-----------------------------------*\
  #ADD / EDIT MEDIA FORM & AUTO-FILL API
\*-----------------------------------*/

function updateCategoryFormLabels(cat) {
  const progLbl = document.getElementById('progress-label');
  const totalLbl = document.getElementById('total-label');
  const volLbl = document.getElementById('volumes-label');

  if (cat === 'tv') {
    progLbl.textContent = 'Episodes Watched';
    totalLbl.textContent = 'Total Episodes (0 = Ongoing)';
    volLbl.textContent = 'Seasons / Parts (Optional)';
  } else if (cat === 'movie') {
    progLbl.textContent = 'Movies Watched';
    totalLbl.textContent = 'Total Movies (1 = Single)';
    volLbl.textContent = 'Part / Series (Optional)';
  } else if (cat === 'comic' || cat === 'novel') {
    progLbl.textContent = 'Chapters Read';
    totalLbl.textContent = 'Total Chapters (0 = Ongoing)';
    volLbl.textContent = 'Volumes Read (Optional)';
  } else if (cat === 'game') {
    progLbl.textContent = 'Hours / Missions';
    totalLbl.textContent = 'Target Hours / Total (Optional)';
    volLbl.textContent = 'DLCs Completed (Optional)';
  } else if (cat === 'music') {
    progLbl.textContent = 'Tracks Listened';
    totalLbl.textContent = 'Total Tracks';
    volLbl.textContent = 'Albums / Discs (Optional)';
  }
}

document.getElementById('entry-category')?.addEventListener('change', (e) => {
  updateCategoryFormLabels(e.target.value);
});

document.getElementById('step-progress-btn')?.addEventListener('click', () => {
  const input = document.getElementById('entry-progress');
  input.value = (parseInt(input.value, 10) || 0) + 1;
});

function addExtraTrackCard(data = {}) {
  const list = document.getElementById('tracks-editor-list');
  const card = document.createElement('div');
  card.className = 'track-edit-card';
  card.innerHTML = `
    <div class="track-edit-top">
      <select class="form-input tr-cat">
        <option value="comic" ${data.category === 'comic' ? 'selected' : ''}>Comic</option>
        <option value="novel" ${data.category === 'novel' ? 'selected' : ''}>Novel</option>
        <option value="tv" ${data.category === 'tv' ? 'selected' : ''}>TV Show</option>
        <option value="movie" ${data.category === 'movie' ? 'selected' : ''}>Movie</option>
        <option value="game" ${data.category === 'game' ? 'selected' : ''}>Game</option>
        <option value="music" ${data.category === 'music' ? 'selected' : ''}>Music</option>
      </select>
      <select class="form-input tr-status">
        <option value="ongoing" ${data.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="planned" ${data.status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${data.status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <button type="button" class="social-remove-btn"><ion-icon name="trash-outline"></ion-icon></button>
    </div>
    <div class="form-row">
      <input type="number" class="form-input tr-prog" min="0" placeholder="Progress" value="${data.progress || 0}">
      <input type="number" class="form-input tr-total" min="0" placeholder="Total" value="${data.total || 0}">
    </div>
  `;
  card.querySelector('.social-remove-btn').addEventListener('click', () => card.remove());
  list.appendChild(card);
}

function addSeasonCard(data = {}) {
  const list = document.getElementById('seasons-editor-list');
  const card = document.createElement('div');
  card.className = 'season-edit-card';
  card.innerHTML = `
    <div class="season-edit-top">
      <input type="text" class="form-input sn-name" placeholder="Season / Sequel Name" value="${escapeHtml(data.name || '')}">
      <button type="button" class="social-remove-btn"><ion-icon name="trash-outline"></ion-icon></button>
    </div>
    <div class="season-edit-grid">
      <select class="form-input sn-status">
        <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="ongoing" ${data.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="planned" ${data.status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${data.status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <input type="number" class="form-input sn-prog" min="0" placeholder="Prog" value="${data.progress || 0}">
      <input type="number" class="form-input sn-total" min="0" placeholder="Total" value="${data.total || 0}">
      <input type="number" class="form-input sn-rating" step="0.1" min="0" max="10" placeholder="Rating" value="${data.rating || 0}">
    </div>
  `;
  card.querySelector('.social-remove-btn').addEventListener('click', () => card.remove());
  list.appendChild(card);
}

document.getElementById('add-track-btn')?.addEventListener('click', () => addExtraTrackCard());
document.getElementById('add-season-btn')?.addEventListener('click', () => addSeasonCard());

document.getElementById('open-add-modal-btn')?.addEventListener('click', () => {
  document.getElementById('media-modal-title').textContent = 'Add New Entry';
  document.getElementById('media-form').reset();
  document.getElementById('entry-id').value = '';
  document.getElementById('delete-entry-btn').style.display = 'none';
  document.getElementById('tracks-editor-list').innerHTML = '';
  document.getElementById('seasons-editor-list').innerHTML = '';
  document.getElementById('api-results-list').style.display = 'none';
  updateCategoryFormLabels('tv');
  openModal('media-modal');
});

window.openEditMediaModal = function(id) {
  const item = allEntries.find(e => String(e.id) === String(id));
  if (!item) return;

  document.getElementById('media-modal-title').textContent = 'Edit Entry';
  document.getElementById('entry-id').value = item.id;
  document.getElementById('entry-title').value = item.title || '';
  document.getElementById('entry-category').value = item.category || 'tv';
  document.getElementById('entry-status').value = item.status || 'ongoing';
  document.getElementById('entry-progress').value = item.progress || 0;
  document.getElementById('entry-total').value = item.total || 0;
  document.getElementById('entry-volumes').value = item.volumes || 0;
  document.getElementById('entry-repeat').value = item.repeat_count || 0;
  document.getElementById('entry-rating').value = item.rating || 0;
  document.getElementById('entry-start-date').value = item.start_date || '';
  document.getElementById('entry-finish-date').value = item.finish_date || '';
  document.getElementById('entry-image').value = item.image_url || '';
  document.getElementById('entry-notes').value = item.notes || '';
  document.getElementById('delete-entry-btn').style.display = 'inline-block';
  document.getElementById('api-results-list').style.display = 'none';

  updateCategoryFormLabels(item.category || 'tv');

  const trList = document.getElementById('tracks-editor-list');
  trList.innerHTML = '';
  (item.extra_tracks || []).forEach(tr => addExtraTrackCard(tr));

  const snList = document.getElementById('seasons-editor-list');
  snList.innerHTML = '';
  (item.seasons || []).forEach(sn => addSeasonCard(sn));

  openModal('media-modal');
};

document.getElementById('entry-image-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast('Uploading cover image...');
  const url = await compressAndUploadImage(file, 'covers');
  if (url) {
    document.getElementById('entry-image').value = url;
    showToast('Cover uploaded');
  }
});

document.getElementById('media-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const extra_tracks = [];
  document.querySelectorAll('#tracks-editor-list .track-edit-card').forEach(card => {
    extra_tracks.push({
      category: card.querySelector('.tr-cat').value,
      status: card.querySelector('.tr-status').value,
      progress: parseInt(card.querySelector('.tr-prog').value, 10) || 0,
      total: parseInt(card.querySelector('.tr-total').value, 10) || 0
    });
  });

  const seasons = [];
  document.querySelectorAll('#seasons-editor-list .season-edit-card').forEach(card => {
    const name = card.querySelector('.sn-name').value.trim();
    if (name) {
      seasons.push({
        name,
        status: card.querySelector('.sn-status').value,
        progress: parseInt(card.querySelector('.sn-prog').value, 10) || 0,
        total: parseInt(card.querySelector('.sn-total').value, 10) || 0,
        rating: parseFloat(card.querySelector('.sn-rating').value) || 0
      });
    }
  });

  const id = document.getElementById('entry-id').value;
  const payload = {
    title: document.getElementById('entry-title').value.trim(),
    category: document.getElementById('entry-category').value,
    status: document.getElementById('entry-status').value,
    progress: parseInt(document.getElementById('entry-progress').value, 10) || 0,
    total: parseInt(document.getElementById('entry-total').value, 10) || 0,
    volumes: parseInt(document.getElementById('entry-volumes').value, 10) || 0,
    repeat_count: parseInt(document.getElementById('entry-repeat').value, 10) || 0,
    rating: parseFloat(document.getElementById('entry-rating').value) || 0,
    start_date: document.getElementById('entry-start-date').value || null,
    finish_date: document.getElementById('entry-finish-date').value || null,
    image_url: document.getElementById('entry-image').value.trim(),
    notes: document.getElementById('entry-notes').value.trim(),
    extra_tracks,
    seasons,
    updated_at: new Date().toISOString()
  };

  if (sb) {
    if (id) {
      await sb.from('media_logs').update(payload).eq('id', id);
    } else {
      await sb.from('media_logs').insert([payload]);
    }
    await loadMediaLibrary();
  } else {
    if (id) {
      const idx = allEntries.findIndex(item => String(item.id) === String(id));
      if (idx > -1) allEntries[idx] = { ...allEntries[idx], ...payload };
    } else {
      allEntries.unshift({ id: Date.now(), created_at: new Date().toISOString(), ...payload });
    }
    localStorage.setItem('archive_media_local', JSON.stringify(allEntries));
    updateLibraryStats();
    renderMediaGrid();
  }

  closeModal('media-modal');
  showToast(id ? 'Entry updated' : 'Entry added');
});

document.getElementById('delete-entry-btn')?.addEventListener('click', async () => {
  const id = document.getElementById('entry-id').value;
  if (!id || !confirm('Delete this library entry?')) return;

  if (sb) {
    await sb.from('media_logs').delete().eq('id', id);
    await loadMediaLibrary();
  } else {
    allEntries = allEntries.filter(item => String(item.id) !== String(id));
    localStorage.setItem('archive_media_local', JSON.stringify(allEntries));
    updateLibraryStats();
    renderMediaGrid();
  }

  closeModal('media-modal');
  showToast('Entry deleted');
});

// Auto-Fill Metadata Search (TMDB + Jikan + iTunes + RAWG/CheapShark)
document.getElementById('api-search-btn')?.addEventListener('click', async () => {
  const q = document.getElementById('api-search-input').value.trim();
  const cat = document.getElementById('entry-category').value;
  const resultsBox = document.getElementById('api-results-list');
  if (!q) return;

  resultsBox.style.display = 'block';
  resultsBox.innerHTML = '<div style="font-size:12px; color:var(--light-gray-70); padding:6px;">Searching...</div>';

  try {
    let results = [];
    if (cat === 'tv') {
      if (TMDB_API_KEY) {
        const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
        const data = await res.json();
        results = (data.results || []).slice(0, 6).map(d => ({
          title: d.name,
          image: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : '',
          sub: `${d.first_air_date ? d.first_air_date.slice(0, 4) : ''} • TV Show`,
          total: 0
        }));
      } else {
        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        results = data.slice(0, 6).map(d => ({
          title: d.show.name,
          image: d.show.image?.medium || '',
          sub: `${d.show.premiered ? d.show.premiered.slice(0, 4) : ''} • TV`,
          total: 0
        }));
      }
    } else if (cat === 'movie') {
      if (TMDB_API_KEY) {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
        const data = await res.json();
        results = (data.results || []).slice(0, 6).map(d => ({
          title: d.title,
          image: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : '',
          sub: `${d.release_date ? d.release_date.slice(0, 4) : ''} • Movie`,
          total: 1
        }));
      } else {
        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        results = data.slice(0, 6).map(d => ({
          title: d.show.name,
          image: d.show.image?.medium || '',
          sub: 'Movie',
          total: 1
        }));
      }
    } else if (cat === 'comic' || cat === 'novel') {
      const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      results = (data.data || []).map(m => ({
        title: m.title_english || m.title,
        image: m.images?.jpg?.image_url || '',
        sub: `${m.type || 'Manga'} • ${m.chapters || '?'} ch`,
        total: m.chapters || 0
      }));
    } else if (cat === 'music') {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=6`);
      const data = await res.json();
      results = (data.results || []).map(a => ({
        title: `${a.collectionName} — ${a.artistName}`,
        image: (a.artworkUrl100 || '').replace('100x100', '400x400'),
        sub: `${a.trackCount || 0} tracks • ${a.releaseDate ? a.releaseDate.slice(0, 4) : ''}`,
        total: a.trackCount || 0
      }));
    } else if (cat === 'game') {
      if (RAWG_API_KEY) {
        const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(q)}&page_size=6`);
        const data = await res.json();
        results = (data.results || []).map(g => ({
          title: g.name,
          image: g.background_image || '',
          sub: `${g.released ? g.released.slice(0, 4) : ''} • Game`,
          total: 0
        }));
      } else {
        const res = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(q)}&limit=6`);
        const data = await res.json();
        results = (data || []).map(g => ({
          title: g.external,
          image: g.thumb || '',
          sub: 'Game',
          total: 0
        }));
      }
    }

    if (results.length === 0) {
      resultsBox.innerHTML = '<div style="font-size:12px; color:var(--light-gray-70); padding:6px;">No results found.</div>';
      return;
    }

    resultsBox.innerHTML = results.map((r, i) => `
      <div class="api-result-item" data-idx="${i}">
        <img src="${escapeHtml(r.image || TRANSPARENT_PIXEL)}" alt="">
        <div class="api-result-info">
          <h4>${escapeHtml(r.title)}</h4>
          <p>${escapeHtml(r.sub)}</p>
        </div>
      </div>
    `).join('');

    resultsBox.querySelectorAll('.api-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const picked = results[parseInt(el.dataset.idx, 10)];
        document.getElementById('entry-title').value = picked.title;
        if (picked.image) document.getElementById('entry-image').value = picked.image;
        if (picked.total > 0) document.getElementById('entry-total').value = picked.total;
        resultsBox.style.display = 'none';
      });
    });
  } catch (_) {
    resultsBox.innerHTML = '<div style="font-size:12px; color:#ff7b7b; padding:6px;">Search failed.</div>';
  }
});

/*-----------------------------------*\
  #TOOLBAR CONTROLS, POPOVERS & EXPORT
\*-----------------------------------*/

document.querySelectorAll('#category-tabs .cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#category-tabs .cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.category;
    currentPageMultiplier = 1;
    renderMediaGrid();
  });
});

document.getElementById('library-search')?.addEventListener('input', () => {
  currentPageMultiplier = 1;
  renderMediaGrid();
});

function togglePopover(menuId) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu.classList.contains('open');
  document.querySelectorAll('.toolbar-popover-menu').forEach(m => m.classList.remove('open'));
  if (!wasOpen) menu.classList.add('open');
}

document.getElementById('filter-popover-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopover('filter-popover-menu');
});

document.getElementById('sort-popover-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopover('sort-popover-menu');
});

document.getElementById('page-popover-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopover('page-popover-menu');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.popover-wrapper')) {
    document.querySelectorAll('.toolbar-popover-menu').forEach(m => m.classList.remove('open'));
  }
});

function syncFilterDot() {
  const active = selectedStatus !== 'all' || ratingMin !== null || ratingMax !== null || rewatchedOnly;
  const dot = document.getElementById('filter-active-dot');
  if (dot) dot.style.display = active ? 'inline-block' : 'none';
}

document.getElementById('status-filter')?.addEventListener('change', (e) => {
  selectedStatus = e.target.value;
  syncFilterDot();
  renderMediaGrid();
});

document.getElementById('rating-min-filter')?.addEventListener('input', (e) => {
  ratingMin = e.target.value !== '' ? parseFloat(e.target.value) : null;
  syncFilterDot();
  renderMediaGrid();
});

document.getElementById('rating-max-filter')?.addEventListener('input', (e) => {
  ratingMax = e.target.value !== '' ? parseFloat(e.target.value) : null;
  syncFilterDot();
  renderMediaGrid();
});

document.getElementById('rewatched-only-filter')?.addEventListener('change', (e) => {
  rewatchedOnly = e.target.checked;
  syncFilterDot();
  renderMediaGrid();
});

document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
  selectedStatus = 'all';
  ratingMin = null;
  ratingMax = null;
  rewatchedOnly = false;
  document.getElementById('status-filter').value = 'all';
  document.getElementById('rating-min-filter').value = '';
  document.getElementById('rating-max-filter').value = '';
  document.getElementById('rewatched-only-filter').checked = false;
  syncFilterDot();
  renderMediaGrid();
});

document.getElementById('sort-field-select')?.addEventListener('change', (e) => {
  sortField = e.target.value;
  renderMediaGrid();
});

document.querySelectorAll('.sort-dir-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortDir = btn.dataset.dir;
    renderMediaGrid();
  });
});

document.querySelectorAll('.page-option-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.page-option-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.limit;
    itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
    document.getElementById('page-limit-label').textContent = val === 'all' ? 'All' : `${val} / page`;
    currentPageMultiplier = 1;
    document.getElementById('page-popover-menu').classList.remove('open');
    renderMediaGrid();
  });
});

document.getElementById('load-more-btn')?.addEventListener('click', () => {
  currentPageMultiplier++;
  renderMediaGrid();
});

document.getElementById('random-pick-btn')?.addEventListener('click', () => {
  const pool = getFilteredAndSortedMedia();
  if (pool.length === 0) return showToast('No entries available to pick', true);
  const randomItem = pool[Math.floor(Math.random() * pool.length)];
  openDetailModal(randomItem.id);
});

document.getElementById('view-grid-btn')?.addEventListener('click', () => {
  viewMode = 'grid';
  document.getElementById('view-grid-btn').classList.add('active');
  document.getElementById('view-list-btn').classList.remove('active');
  renderMediaGrid();
});

document.getElementById('view-list-btn')?.addEventListener('click', () => {
  viewMode = 'list';
  document.getElementById('view-list-btn').classList.add('active');
  document.getElementById('view-grid-btn').classList.remove('active');
  renderMediaGrid();
});

document.getElementById('export-library-btn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(allEntries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Library exported as JSON');
});

/*-----------------------------------*\
  #AUTO WEB NEWS FEED (RSS TO JSON)
\*-----------------------------------*/

function saveRssSources() {
  localStorage.setItem('archive_rss_sources', JSON.stringify(rssSources));
}

function stripHtmlTags(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return (tmp.textContent || tmp.innerText || '').trim();
}

function extractImageFromItem(item) {
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  if (item.enclosure && item.enclosure.link && item.enclosure.link.startsWith('http')) return item.enclosure.link;
  const match = (item.description || item.content || '').match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : '';
}

async function fetchAllNews(forceRefresh = false) {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  const cacheKey = 'archive_news_cache_v1';
  if (!forceRefresh) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 10 * 60 * 1000 && parsed.items.length > 0) {
          allNewsItems = parsed.items;
          renderNewsGrid();
          return;
        }
      } catch (_) {}
    }
  }

  grid.innerHTML = '<div class="empty-state">Fetching latest news from web feeds...</div>';

  const requests = rssSources.map(async (src) => {
    try {
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.url)}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) return [];

      return data.items.slice(0, 8).map(item => ({
        title: stripHtmlTags(item.title),
        link: item.link,
        pubDate: item.pubDate,
        timestamp: new Date(item.pubDate).getTime() || Date.now(),
        snippet: stripHtmlTags(item.description).slice(0, 180),
        image: extractImageFromItem(item),
        source: src.name,
        topic: src.topic
      }));
    } catch (_) {
      return [];
    }
  });

  const results = await Promise.all(requests);
  allNewsItems = results
    .flat()
    .sort((a, b) => b.timestamp - a.timestamp);

  if (allNewsItems.length > 0) {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      items: allNewsItems
    }));
  }

  renderNewsGrid();
}

function renderNewsGrid() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  const filtered = allNewsItems.filter(item => {
    const matchTopic = currentNewsTopic === 'all' || item.topic === currentNewsTopic;
    const q = newsSearchQuery.toLowerCase();
    const matchQuery = !q || item.title.toLowerCase().includes(q) || item.source.toLowerCase().includes(q);
    return matchTopic && matchQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No news headlines found for this filter.</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const dateStr = new Date(item.timestamp).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return `
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="news-card">
        ${item.image ? `
          <div class="news-thumb-wrap">
            <img src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
        <div class="news-body">
          <div class="news-meta-top">
            <span class="news-source-badge">${escapeHtml(item.source)}</span>
            <span class="news-date-text">${dateStr}</span>
          </div>
          <h3 class="news-title">${escapeHtml(item.title)}</h3>
          ${item.snippet ? `<p class="news-snippet">${escapeHtml(item.snippet)}...</p>` : ''}
        </div>
      </a>
    `;
  }).join('');
}

function renderRssSourcesManager() {
  const list = document.getElementById('rss-sources-list');
  if (!list) return;

  list.innerHTML = rssSources.map((src, idx) => `
    <div class="detail-row-item">
      <div style="min-width:0; flex:1;">
        <strong style="color:var(--white-1); display:block;">${escapeHtml(src.name)} <span style="opacity:0.6; font-weight:400;">(${src.topic})</span></strong>
        <span style="font-size:11px; color:var(--light-gray-70); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(src.url)}</span>
      </div>
      <button type="button" class="social-remove-btn" data-remove-rss="${idx}" title="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('[data-remove-rss]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removeRss, 10);
      rssSources.splice(idx, 1);
      saveRssSources();
      renderRssSourcesManager();
      fetchAllNews(true);
    });
  });
}

document.querySelectorAll('#news-topic-tabs .cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#news-topic-tabs .cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentNewsTopic = btn.dataset.topic;
    renderNewsGrid();
  });
});

document.getElementById('news-search-input')?.addEventListener('input', (e) => {
  newsSearchQuery = e.target.value;
  renderNewsGrid();
});

document.getElementById('refresh-news-btn')?.addEventListener('click', () => {
  fetchAllNews(true);
  showToast('News feed refreshed');
});

document.getElementById('manage-rss-btn')?.addEventListener('click', () => {
  renderRssSourcesManager();
  openModal('rss-modal');
});

document.getElementById('add-rss-btn')?.addEventListener('click', () => {
  const name = document.getElementById('rss-name-input').value.trim();
  const topic = document.getElementById('rss-topic-input').value;
  const url = document.getElementById('rss-url-input').value.trim();
  if (!name || !url) return showToast('Enter source name and RSS URL', true);

  rssSources.push({ name, topic, url });
  saveRssSources();
  document.getElementById('rss-name-input').value = '';
  document.getElementById('rss-url-input').value = '';
  renderRssSourcesManager();
  fetchAllNews(true);
  showToast('RSS source added');
});

document.getElementById('reset-rss-btn')?.addEventListener('click', () => {
  rssSources = [...DEFAULT_RSS_SOURCES];
  saveRssSources();
  renderRssSourcesManager();
  fetchAllNews(true);
  showToast('Reset to default news sources');
});

/*-----------------------------------*\
  #MODAL CLOSE HANDLERS & INIT
\*-----------------------------------*/

document.querySelectorAll('.close-modal-btn').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  await checkAuthSession();
  await loadNotes();
  await loadMediaLibrary();
});
