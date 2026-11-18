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
const ITEMS_PER_PAGE = 8;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let allMediaLogs = [];
let allBlogPosts = [];
let lastApiResults = [];
let pendingUploadedUrls = [];
let currentCategory = 'all';
let currentMainView = 'blog'; // Default tab priority: Notes
let libraryViewMode = 'grid'; // 'grid' or 'list'
let visibleMediaLimit = ITEMS_PER_PAGE;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;

let currentProfile = {
  name: '',
  bio: '',
  avatar_url: '',
  banner_url: '',
  social_links: []
};

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ==========================================
// 2. INITIALIZATION, SCROLL LISTENERS & VIEW TABS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupScrollListeners();
  await checkAdminSession();
  await fetchProfileSettings();
  await Promise.all([fetchBlogPosts(), fetchMediaLogs()]);
  setupFilterListeners();
});

function setupScrollListeners() {
  const stickyHeader = document.getElementById('sticky-mini-header');
  const backToTopBtn = document.getElementById('btn-back-to-top');
  const profileCard = document.getElementById('profile-header-card');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const triggerHeight = profileCard ? (profileCard.offsetTop + profileCard.offsetHeight - 20) : 180;

    if (stickyHeader) {
      stickyHeader.classList.toggle('visible', scrollY > triggerHeight);
    }

    if (backToTopBtn) {
      backToTopBtn.classList.toggle('visible', scrollY > 360);
    }
  }, { passive: true });
}

window.scrollToTopSmooth = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.switchMainView = function (viewName) {
  currentMainView = viewName;

  document.querySelectorAll('.main-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.mini-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const libView = document.getElementById('view-library');
  const blogView = document.getElementById('view-blog');

  if (libView && blogView) {
    libView.classList.remove('active-view');
    blogView.classList.remove('active-view');

    if (viewName === 'library') {
      blogView.style.display = 'none';
      libView.style.display = 'block';
      void libView.offsetWidth;
      libView.classList.add('active-view');
    } else {
      libView.style.display = 'none';
      blogView.style.display = 'block';
      void blogView.offsetWidth;
      blogView.classList.add('active-view');
    }
  }

  updateAdminActionButtons();
};

window.setLibraryViewMode = function (mode) {
  libraryViewMode = mode;
  document.getElementById('btn-view-grid')?.classList.toggle('active', mode === 'grid');
  document.getElementById('btn-view-list')?.classList.toggle('active', mode === 'list');
  renderMediaGrid();
};

window.loadMoreMedia = function () {
  visibleMediaLimit += ITEMS_PER_PAGE;
  renderMediaGrid();
};

window.toggleLibraryStats = function () {
  isStatsExpanded = !isStatsExpanded;
  const panel = document.getElementById('collapsible-stats-panel');
  const toggleBtn = document.getElementById('btn-toggle-stats');
  const textEl = document.getElementById('stats-toggle-text');
  const iconEl = document.getElementById('stats-chevron-icon');

  if (panel) panel.style.display = isStatsExpanded ? 'block' : 'none';
  if (toggleBtn) toggleBtn.classList.toggle('active', isStatsExpanded);
  if (textEl) textEl.textContent = isStatsExpanded ? 'Hide Stats' : 'Show Stats';
  if (iconEl) iconEl.setAttribute('name', isStatsExpanded ? 'chevron-up-outline' : 'chevron-down-outline');
};

function updateAdminActionButtons() {
  const addMediaBtn = document.getElementById('btn-add-media');
  const addPostBtn = document.getElementById('btn-add-post');

  if (!isAdminLoggedIn) {
    if (addMediaBtn) addMediaBtn.style.display = 'none';
    if (addPostBtn) addPostBtn.style.display = 'none';
    return;
  }

  if (addMediaBtn) addMediaBtn.style.display = currentMainView === 'library' ? 'inline-flex' : 'none';
  if (addPostBtn) addPostBtn.style.display = currentMainView === 'blog' ? 'inline-flex' : 'none';
}

async function checkAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  isAdminLoggedIn = !!session;
  updateAdminUI();
}

function updateAdminUI() {
  const editProfileBtn = document.getElementById('btn-edit-profile');
  const lockIcon = document.getElementById('admin-lock-icon');
  const btnText = document.getElementById('admin-btn-text');

  if (isAdminLoggedIn) {
    if (editProfileBtn) editProfileBtn.style.display = 'inline-flex';
    if (lockIcon) lockIcon.setAttribute('name', 'log-out-outline');
    if (btnText) btnText.textContent = 'Logout';
  } else {
    if (editProfileBtn) editProfileBtn.style.display = 'none';
    if (lockIcon) lockIcon.setAttribute('name', 'lock-closed-outline');
    if (btnText) btnText.textContent = 'Admin';
  }

  updateAdminActionButtons();
  renderMediaGrid();
  if (isProfileLoaded) renderBlogPosts();
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
// 2B. IMAGE COMPRESSION & STORAGE UPLOAD/CLEANUP
// ==========================================
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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Image compression failed'));
          },
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
  const maxWidth = folder === 'avatars' ? 400 : (folder === 'banners' ? 1200 : (folder === 'posts' ? 900 : 600));
  const compressedBlob = await compressImageFile(file, maxWidth, 0.82);
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, compressedBlob, {
      contentType: 'image/webp',
      upsert: false
    });

  if (error) throw error;

  const { data: publicData } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  pendingUploadedUrls.push(publicData.publicUrl);
  return publicData.publicUrl;
}

async function deleteOldStorageFile(fileUrl) {
  if (!fileUrl) return;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;

  const filePath = decodeURIComponent(fileUrl.substring(idx + marker.length).split('?')[0]);
  if (!filePath) return;

  const { data, error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn('Storage delete warning:', error.message);
  } else if (!data || data.length === 0) {
    console.warn('File not found or blocked by RLS policy:', filePath);
  }
}

async function cleanupPendingUploads(keepUrls = []) {
  const keepSet = new Set((Array.isArray(keepUrls) ? keepUrls : [keepUrls]).filter(Boolean));
  for (const tempUrl of pendingUploadedUrls) {
    if (!keepSet.has(tempUrl)) {
      await deleteOldStorageFile(tempUrl);
    }
  }
  pendingUploadedUrls = [];
}

// ==========================================
// 2C. PROFILE SETTINGS, BANNER & SOCIAL LINKS
// ==========================================
function detectSocialIcon(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('instagram.com')) return 'logo-instagram';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'logo-twitter';
  if (lower.includes('github.com')) return 'logo-github';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'logo-youtube';
  if (lower.includes('tiktok.com')) return 'logo-tiktok';
  if (lower.includes('discord.gg') || lower.includes('discord.com')) return 'logo-discord';
  if (lower.includes('twitch.tv')) return 'logo-twitch';
  if (lower.includes('linkedin.com')) return 'logo-linkedin';
  if (lower.includes('reddit.com')) return 'logo-reddit';
  if (lower.includes('facebook.com')) return 'logo-facebook';
  if (lower.includes('spotify.com')) return 'musical-notes-outline';
  if (lower.includes('steamcommunity.com') || lower.includes('store.steampowered.com')) return 'logo-steam';
  if (lower.includes('letterboxd.com')) return 'film-outline';
  if (lower.includes('myanimelist.net') || lower.includes('anilist.co')) return 'tv-outline';
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
      name: data.name || '',
      bio: data.bio || '',
      avatar_url: data.avatar_url || '',
      banner_url: data.banner_url || '',
      social_links: Array.isArray(data.social_links) ? data.social_links : []
    };
  }
  isProfileLoaded = true;
  applyProfileToUI();
}

function applyProfileToUI() {
  setElText('profile-name-text', currentProfile.name);
  setElText('profile-bio-text', currentProfile.bio);
  setElText('sticky-name-text', currentProfile.name);

  if (currentProfile.name) {
    document.title = `${currentProfile.name} — Archive`;
    setElText('footer-brand-name', currentProfile.name.toUpperCase());
  }

  // Banner Header
  const headerCard = document.getElementById('profile-header-card');
  const bannerWrap = document.getElementById('profile-banner-wrap');
  const bannerImg = document.getElementById('profile-banner-img');

  if (headerCard && bannerWrap && bannerImg) {
    if (currentProfile.banner_url) {
      const cleanBanner = normalizeImageUrl(currentProfile.banner_url);
      bannerImg.onerror = () => {
        bannerWrap.style.display = 'none';
        headerCard.classList.remove('has-banner');
      };
      bannerImg.src = cleanBanner;
      bannerWrap.style.display = 'block';
      headerCard.classList.add('has-banner');
    } else {
      bannerImg.src = '';
      bannerWrap.style.display = 'none';
      headerCard.classList.remove('has-banner');
    }
  }

  // Avatar & Sticky Avatar & Favicon
  const avatarEl = document.getElementById('profile-avatar-img');
  const stickyAvatarEl = document.getElementById('sticky-avatar-img');
  const faviconEl = document.getElementById('favicon-link');

  if (avatarEl) {
    if (currentProfile.avatar_url) {
      const cleanUrl = normalizeImageUrl(currentProfile.avatar_url);
      avatarEl.onerror = () => {
        avatarEl.src = 'https://placehold.co/200x200/1e1e1f/ffffff?text=?';
      };
      avatarEl.src = cleanUrl;
      if (stickyAvatarEl) stickyAvatarEl.src = cleanUrl;
      if (faviconEl) faviconEl.href = cleanUrl;
    } else {
      avatarEl.src = TRANSPARENT_PIXEL;
      if (stickyAvatarEl) stickyAvatarEl.src = TRANSPARENT_PIXEL;
    }
  }

  // Social Links Bar
  const socialsBar = document.getElementById('profile-socials-bar');
  if (socialsBar) {
    const validLinks = (currentProfile.social_links || []).filter(s => s && s.url);
    if (validLinks.length > 0) {
      socialsBar.style.display = 'flex';
      socialsBar.innerHTML = validLinks.map(s => {
        const href = s.url.startsWith('http') ? s.url : `https://${s.url}`;
        const label = escapeHtml(s.label || s.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
        const iconName = detectSocialIcon(href);
        return `
          <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="social-chip">
            <ion-icon name="${iconName}"></ion-icon>
            <span>${label}</span>
          </a>
        `;
      }).join('');
    } else {
      socialsBar.style.display = 'none';
      socialsBar.innerHTML = '';
    }
  }

  renderBlogPosts();
}

window.addSocialLinkRow = function (label = '', url = '') {
  const container = document.getElementById('social-links-editor');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'social-edit-row';
  row.innerHTML = `
    <input type="text" class="form-input social-label-input" placeholder="Label (e.g. GitHub)" value="${escapeHtml(label)}">
    <input type="url" class="form-input social-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="social-remove-btn" onclick="this.parentElement.remove()" title="Remove">
      <ion-icon name="trash-outline"></ion-icon>
    </button>
  `;
  container.appendChild(row);
};

window.openProfileModal = function () {
  pendingUploadedUrls = [];
  document.getElementById('edit-profile-name').value = currentProfile.name;
  document.getElementById('edit-profile-bio').value = currentProfile.bio;
  document.getElementById('edit-profile-avatar').value = currentProfile.avatar_url;
  document.getElementById('edit-profile-banner').value = currentProfile.banner_url;
  setElText('profile-upload-status', '');
  setElText('banner-upload-status', '');

  const editor = document.getElementById('social-links-editor');
  if (editor) {
    editor.innerHTML = '';
    (currentProfile.social_links || []).forEach(link => {
      addSocialLinkRow(link.label || '', link.url || '');
    });
  }

  document.getElementById('profile-modal').classList.add('active');
};

window.closeProfileModal = async function () {
  document.getElementById('profile-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

window.clearBannerInput = function () {
  document.getElementById('edit-profile-banner').value = '';
  setElText('banner-upload-status', 'Banner removed (click Save Profile).');
};

window.handleBannerImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setElText('banner-upload-status', 'Uploading banner...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'banners');
    document.getElementById('edit-profile-banner').value = publicUrl;
    setElText('banner-upload-status', 'Banner uploaded! Click Save Profile.');
  } catch (err) {
    setElText('banner-upload-status', `Upload failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setElText('profile-upload-status', 'Uploading avatar...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'avatars');
    document.getElementById('edit-profile-avatar').value = publicUrl;
    setElText('profile-upload-status', 'Avatar uploaded! Click Save Profile.');
  } catch (err) {
    setElText('profile-upload-status', `Upload failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
};

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const oldAvatar = currentProfile.avatar_url;
  const oldBanner = currentProfile.banner_url;
  const newAvatar = document.getElementById('edit-profile-avatar').value.trim();
  const newBanner = document.getElementById('edit-profile-banner').value.trim();

  const socialRows = document.querySelectorAll('#social-links-editor .social-edit-row');
  const collectedLinks = [];
  socialRows.forEach(row => {
    const label = row.querySelector('.social-label-input')?.value.trim() || '';
    const url = row.querySelector('.social-url-input')?.value.trim() || '';
    if (url) {
      collectedLinks.push({ label, url });
    }
  });

  const updatedProfile = {
    id: 1,
    name: document.getElementById('edit-profile-name').value.trim(),
    bio: document.getElementById('edit-profile-bio').value.trim(),
    avatar_url: newAvatar,
    banner_url: newBanner,
    social_links: collectedLinks,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('profile_settings')
    .upsert([updatedProfile]);

  if (error) {
    Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
  } else {
    await cleanupPendingUploads([newAvatar, newBanner]);
    if (oldAvatar && oldAvatar !== newAvatar) {
      await deleteOldStorageFile(oldAvatar);
    }
    if (oldBanner && oldBanner !== newBanner) {
      await deleteOldStorageFile(oldBanner);
    }
    currentProfile = updatedProfile;
    applyProfileToUI();
    document.getElementById('profile-modal').classList.remove('active');
    Swal.fire({
      icon: 'success',
      text: 'Profile updated',
      timer: 1200,
      showConfirmButton: false,
      background: '#1e1e1f',
      color: '#fff'
    });
  }
});

// ==========================================
// 3. LOAD MEDIA DATA & AUTO-CALCULATE STATS
// ==========================================
function getNormalizedCategory(item) {
  const rawCat = (item.category || '').toLowerCase().trim();
  if (rawCat === 'series' || rawCat === 'tv_show') return 'tv_show';
  if (rawCat === 'other') {
    if (item.sub_category === 'light_novel') return 'novel';
    if (item.sub_category === 'game') return 'game';
  }
  return rawCat || 'tv_show';
}

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
  const tvItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'tv_show');
  const movieItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'movie');
  const comicItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'comic');
  const novelItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'novel');
  const gameItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'game');
  const musicItems = allMediaLogs.filter(i => getNormalizedCategory(i) === 'music');

  const totalTvEps = tvItems.reduce((sum, i) => sum + (i.progress || 0), 0);
  const completedMovies = movieItems.filter(i => (i.status || '').toLowerCase().trim() === 'completed').length;
  const totalComicCh = comicItems.reduce((sum, i) => sum + (i.progress || 0), 0);
  const completedNovels = novelItems.filter(i => (i.status || '').toLowerCase().trim() === 'completed').length;
  const completedGames = gameItems.filter(i => (i.status || '').toLowerCase().trim() === 'completed').length;
  const totalMusicTracks = musicItems.reduce((sum, i) => sum + (i.progress || 0), 0);

  const totalEntries = allMediaLogs.length;
  const totalCompleted = allMediaLogs.filter(i => (i.status || '').toLowerCase().trim() === 'completed').length;
  const completionRate = totalEntries > 0 ? Math.round((totalCompleted / totalEntries) * 100) : 0;

  const ratedItems = allMediaLogs.filter(i => i.rating !== null && i.rating !== undefined);
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((sum, i) => sum + Number(i.rating), 0) / ratedItems.length).toFixed(2)
    : '0.0';

  setElText('total-entries-label', `${totalEntries} Entries`);

  setElText('stat-tv-eps', totalTvEps.toLocaleString('en-US'));
  setElText('stat-tv-count', `${tvItems.length} Show`);

  setElText('stat-movies-total', movieItems.length.toLocaleString('en-US'));
  setElText('stat-movies-done', `${completedMovies} Completed`);

  setElText('stat-comic-ch', totalComicCh.toLocaleString('en-US'));
  setElText('stat-comic-count', `${comicItems.length} Comic`);

  setElText('stat-novel-total', novelItems.length.toLocaleString('en-US'));
  setElText('stat-novel-done', `${completedNovels} Completed`);

  setElText('stat-game-total', gameItems.length.toLocaleString('en-US'));
  setElText('stat-game-done', `${completedGames} Completed`);

  setElText('stat-music-total', musicItems.length.toLocaleString('en-US'));
  setElText('stat-music-tracks', `${totalMusicTracks.toLocaleString('en-US')} Track`);

  setElText('stat-completed-total', totalCompleted.toLocaleString('en-US'));
  setElText('stat-completion-rate', `${completionRate}% Rate`);

  setElText('stat-avg-rating', avgRating);
  setElText('stat-rated-count', `${ratedItems.length} Rated`);
}

// ==========================================
// 4. FILTER, SEARCH, PAGINATION & RENDER MEDIA
// ==========================================
function resetPaginationAndRender() {
  visibleMediaLimit = ITEMS_PER_PAGE;
  renderMediaGrid();
}

function setupFilterListeners() {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      resetPaginationAndRender();
    });
  });

  document.getElementById('search-library').addEventListener('input', resetPaginationAndRender);
  document.getElementById('filter-status').addEventListener('change', resetPaginationAndRender);
  document.getElementById('filter-rating').addEventListener('change', resetPaginationAndRender);
  document.getElementById('sort-library').addEventListener('change', resetPaginationAndRender);
}

function formatCategoryBadge(item) {
  const cat = getNormalizedCategory(item);
  const labelMap = {
    tv_show: 'TV Show',
    movie: 'Movie',
    comic: 'Comic',
    novel: 'Novel',
    game: 'Game',
    music: 'Music'
  };
  return labelMap[cat] || cat;
}

function normalizeImageUrl(url) {
  if (!url) return '';
  return url.trim().replace(/^http:\/\//i, 'https://');
}

function formatStatusDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function matchesRatingFilter(item, ratingFilter) {
  if (ratingFilter === 'all') return true;
  const hasRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
  const r = Number(item.rating);

  if (ratingFilter === 'unrated') return !hasRating;
  if (!hasRating || Number.isNaN(r)) return false;

  if (ratingFilter === 'under_5') return r < 5;
  if (ratingFilter === '5_plus') return r >= 5;
  if (ratingFilter === '6_plus') return r >= 6;
  if (ratingFilter === '7_plus') return r >= 7;
  if (ratingFilter === '8_plus') return r >= 8;
  if (ratingFilter === '9_plus') return r >= 9;
  if (ratingFilter === 'exact_10') return r === 10;
  return true;
}

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  const loadMoreText = document.getElementById('load-more-text');

  const query = document.getElementById('search-library').value.toLowerCase().trim();
  const statusFilter = document.getElementById('filter-status').value;
  const ratingFilter = document.getElementById('filter-rating').value;
  const sortBy = document.getElementById('sort-library').value;

  grid.classList.toggle('list-view', libraryViewMode === 'list');

  let filtered = allMediaLogs.filter(item => {
    const normCat = getNormalizedCategory(item);
    const normStatus = (item.status || '').toLowerCase().trim();
    const matchCat = currentCategory === 'all' || normCat === currentCategory;
    const matchStatus = statusFilter === 'all' || normStatus === statusFilter;
    const matchRating = matchesRatingFilter(item, ratingFilter);
    const matchQuery = !query || item.title.toLowerCase().includes(query);
    return matchCat && matchStatus && matchRating && matchQuery;
  });

  if (sortBy === 'rating_desc') {
    filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sortBy === 'title_asc') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">No media found matching these filters.</p>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  const displayedItems = filtered.slice(0, visibleMediaLimit);
  const remainingCount = filtered.length - displayedItems.length;

  if (loadMoreWrap) {
    if (remainingCount > 0) {
      loadMoreWrap.style.display = 'flex';
      if (loadMoreText) loadMoreText.textContent = `Load More (${remainingCount} remaining)`;
    } else {
      loadMoreWrap.style.display = 'none';
    }
  }

  // COMPACT LIST VIEW RENDER
  if (libraryViewMode === 'list') {
    grid.innerHTML = displayedItems.map(item => {
      const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/120x180/1e1e1f/888888?text=?';
      const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
      const hasTotal = item.total_units !== null && item.total_units !== undefined && Number(item.total_units) > 0;
      const progressText = hasTotal ? `${item.progress || 0}/${item.total_units}` : `${item.progress || 0}/?`;
      const statusKey = (item.status || 'planned').toLowerCase().trim();
      const repeatCount = Number(item.repeat_count) || 0;
      const statusDateText = formatStatusDate(item.status_updated_at || item.updated_at || item.created_at);

      const repeatHtml = repeatCount > 0
        ? `<span class="list-repeat-tag" title="Rewatch / Reread count">↻ ${repeatCount}x</span>`
        : '';

      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="list-edit-btn" onclick="openEditModal('${item.id}')" title="Edit Entry">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      return `
        <div class="media-list-row">
          <img class="list-thumb" src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/120x180/1e1e1f/888888?text=?'">
          <div class="list-main-info">
            <div class="list-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="list-sub-meta">
              <span class="list-cat-tag">${formatCategoryBadge(item)}</span>
              <span>•</span>
              <span>${statusDateText}</span>
              ${repeatHtml}
            </div>
          </div>
          <div class="list-right-meta">
            <span class="status-pill ${statusKey} list-hide-mobile">${statusKey}</span>
            <span class="progress-pill ${statusKey}">${progressText}</span>
            <span class="list-rating-pill">${ratingText}</span>
            ${editBtnHtml}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // GRID VIEW RENDER
  grid.innerHTML = displayedItems.map(item => {
    const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
    const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
    const repeatCount = Number(item.repeat_count) || 0;

    const hasTotal = item.total_units !== null && item.total_units !== undefined && Number(item.total_units) > 0;
    const progressText = hasTotal
      ? `${item.progress || 0}/${item.total_units}`
      : `${item.progress || 0}/?`;

    const statusKey = (item.status || 'planned').toLowerCase().trim();
    let percent = 0;
    let extraBarClass = '';

    if (statusKey === 'completed') {
      percent = 100;
    } else if (hasTotal) {
      percent = Math.min(100, Math.max(0, Math.round(((item.progress || 0) / Number(item.total_units)) * 100)));
      if (statusKey === 'planned' && percent === 0) {
        percent = 100;
        extraBarClass = 'planned-empty';
      }
    } else {
      if (statusKey === 'planned') {
        percent = 100;
        extraBarClass = 'planned-empty';
      } else {
        percent = (item.progress || 0) > 0 ? 45 : 0;
      }
    }

    const statusDateText = formatStatusDate(item.status_updated_at || item.updated_at || item.created_at);

    const repeatBadgeHtml = repeatCount > 0
      ? `<span class="badge-repeat" title="Rewatch / Reread count">↻ ${repeatCount}x</span>`
      : '';

    const coverEditHtml = isAdminLoggedIn ? `
      <button type="button" class="cover-edit-btn" onclick="openEditModal('${item.id}')" title="Edit Entry">
        <ion-icon name="create-outline"></ion-icon>
      </button>
    ` : '';

    return `
      <div class="media-card">
        <div class="media-cover-wrap">
          <img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/300x450/1e1e1f/888888?text=No+Cover'">
          <div class="cover-left-badges">
            <span class="badge-cat">${formatCategoryBadge(item)}</span>
            <span class="badge-rating">${ratingText}</span>
            ${repeatBadgeHtml}
          </div>
          ${coverEditHtml}
        </div>
        <div class="media-body">
          <h3 class="media-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="media-bottom-stack">
            <div class="media-meta-row">
              <span class="status-pill ${statusKey}">${statusKey}</span>
              <span class="progress-pill ${statusKey}">${progressText}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${statusKey} ${extraBarClass}" style="width: ${percent}%"></div>
            </div>
            <div class="media-footer-row">
              <span class="status-date-item" title="Last status update">
                <ion-icon name="calendar-outline"></ion-icon>
                <span>${statusDateText}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 5. ADD / EDIT MODAL, COVER UPLOAD & MULTI-API SEARCH
// ==========================================
window.openMediaModal = function () {
  pendingUploadedUrls = [];
  document.getElementById('media-modal-title').textContent = 'Add Media';
  document.getElementById('media-form').reset();
  document.getElementById('media-id').value = '';
  document.getElementById('media-repeat').value = 0;
  document.getElementById('btn-modal-delete').style.display = 'none';
  document.getElementById('api-search-results').style.display = 'none';
  setElText('cover-upload-status', '');
  handleCategoryFormChange();
  document.getElementById('media-modal').classList.add('active');
};

window.openEditModal = function (id) {
  const item = allMediaLogs.find(m => m.id === id);
  if (!item) return;

  pendingUploadedUrls = [];
  document.getElementById('media-modal-title').textContent = 'Edit Media';
  document.getElementById('media-id').value = item.id;
  document.getElementById('btn-modal-delete').style.display = 'inline-flex';
  document.getElementById('media-category').value = getNormalizedCategory(item);
  handleCategoryFormChange();

  document.getElementById('media-title').value = item.title;
  document.getElementById('media-cover').value = item.cover_url || '';
  document.getElementById('media-status').value = (item.status || 'planned').toLowerCase().trim();
  document.getElementById('media-progress').value = item.progress || 0;
  document.getElementById('media-total').value = item.total_units || '';
  document.getElementById('media-unit').value = item.unit_label || 'eps';
  document.getElementById('media-rating').value = (item.rating !== null && item.rating !== undefined) ? item.rating : '';
  document.getElementById('media-repeat').value = Number(item.repeat_count) || 0;
  document.getElementById('api-search-results').style.display = 'none';
  setElText('cover-upload-status', '');

  document.getElementById('media-modal').classList.add('active');
};

window.closeMediaModal = async function () {
  document.getElementById('media-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

window.handleMediaCoverUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setElText('cover-upload-status', 'Uploading cover...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'covers');
    document.getElementById('media-cover').value = publicUrl;
    setElText('cover-upload-status', 'Cover uploaded successfully!');
  } catch (err) {
    setElText('cover-upload-status', `Upload failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
};

window.handleCategoryFormChange = function () {
  const cat = document.getElementById('media-category').value;
  const unitSelect = document.getElementById('media-unit');

  if (cat === 'tv_show') unitSelect.value = 'eps';
  if (cat === 'movie') unitSelect.value = 'movie';
  if (cat === 'comic') unitSelect.value = 'ch';
  if (cat === 'novel') unitSelect.value = 'vol';
  if (cat === 'game') unitSelect.value = 'item';
  if (cat === 'music') unitSelect.value = 'track';
};

window.handleStatusFormChange = function () {
  const status = document.getElementById('media-status').value;
  const totalVal = parseInt(document.getElementById('media-total').value, 10);

  if (status === 'completed' && totalVal > 0) {
    document.getElementById('media-progress').value = totalVal;
  }
};

window.handleTotalUnitsChange = function () {
  const status = document.getElementById('media-status').value;
  const totalVal = parseInt(document.getElementById('media-total').value, 10);

  if (status === 'completed' && totalVal > 0) {
    document.getElementById('media-progress').value = totalVal;
  }
};

window.stepModalProgress = function () {
  const progInput = document.getElementById('media-progress');
  const totalVal = parseInt(document.getElementById('media-total').value, 10);
  const nextVal = (parseInt(progInput.value, 10) || 0) + 1;
  progInput.value = nextVal;

  if (totalVal > 0 && nextVal >= totalVal) {
    document.getElementById('media-status').value = 'completed';
  }
};

window.stepModalRepeat = function () {
  const repInput = document.getElementById('media-repeat');
  const nextVal = (parseInt(repInput.value, 10) || 0) + 1;
  repInput.value = nextVal;
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAniListMedia(query, isNovel = false) {
  const gql = `
    query ($search: String) {
      Page(perPage: 6) {
        media(search: $search, type: MANGA, ${isNovel ? 'format: NOVEL' : 'format_not: NOVEL'}) {
          title { english romaji }
          coverImage { large medium }
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
    const label = isNovel ? 'Novel' : (originMap[m.countryOfOrigin] || 'Comic');
    return {
      title: m.title.english || m.title.romaji,
      cover: normalizeImageUrl(m.coverImage?.large || m.coverImage?.medium || ''),
      total: isNovel ? (m.volumes || m.chapters || null) : (m.chapters || null),
      unit: isNovel ? (m.volumes ? 'vol' : 'ch') : 'ch',
      meta: `${label} · ${isNovel ? (m.volumes || '?') + ' Volume' : (m.chapters || '?') + ' Chapter'}`
    };
  });
}

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
  const resultsBox = document.getElementById('api-search-results');

  if (!query) return;
  resultsBox.style.display = 'block';
  resultsBox.innerHTML = `<p style="padding: 12px; font-size: 12px; color: var(--light-gray-70);">Searching...</p>`;

  let items = [];

  if (cat === 'tv_show') {
    const [jikanRes, tvmazeRes, tmdbRes] = await Promise.allSettled([
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&type=tv&limit=5&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(a => ({
          title: a.title_english || a.title,
          cover: normalizeImageUrl(a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || a.images?.webp?.large_image_url || ''),
          total: a.episodes || null,
          unit: 'eps',
          meta: `Anime TV · ${a.episodes || '?'} Episode`
        }));
      })(),
      (async () => {
        const res = await fetchWithTimeout(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return (data || []).slice(0, 5).map(entry => ({
          tvmazeId: entry.show.id,
          title: entry.show.name,
          cover: normalizeImageUrl(entry.show.image?.original || entry.show.image?.medium || ''),
          total: null,
          unit: 'eps',
          meta: `TV Show · ${entry.show.premiered?.slice(0, 4) || 'Show'}`
        }));
      })(),
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
          meta: `TV Show · ${t.first_air_date?.slice(0, 4) || 'TMDB'}`
        }));
      })()
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (tvmazeRes.status === 'fulfilled') items.push(...tvmazeRes.value);
    if (tmdbRes.status === 'fulfilled') items.push(...tmdbRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'movie') {
    const [jikanRes, itunesRes, tmdbRes] = await Promise.allSettled([
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&type=movie&limit=5&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(a => ({
          title: a.title_english || a.title,
          cover: normalizeImageUrl(a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || a.images?.webp?.large_image_url || ''),
          total: 1,
          unit: 'movie',
          meta: `Anime Movie · ${a.year || 'Film'}`
        }));
      })(),
      (async () => {
        const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=movie&limit=5`);
        const data = await res.json();
        return (data.results || []).map(m => ({
          title: m.trackName,
          cover: normalizeImageUrl(m.artworkUrl100 ? m.artworkUrl100.replace('100x100bb', '600x600bb') : ''),
          total: 1,
          unit: 'movie',
          meta: `Movie · ${m.releaseDate?.slice(0, 4) || 'Film'}`
        }));
      })(),
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
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=6&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || [])
          .filter(m => m.type !== 'Light Novel' && m.type !== 'Novel')
          .map(m => ({
            title: m.title_english || m.title,
            cover: normalizeImageUrl(m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || m.images?.webp?.large_image_url || ''),
            total: m.chapters || null,
            unit: 'ch',
            meta: `${m.type} · ${m.chapters || '?'} Chapter`
          }));
      })(),
      fetchAniListMedia(query, false)
    ]);

    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (aniRes.status === 'fulfilled') items.push(...aniRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'novel') {
    const [openLibRes, jikanRes, aniRes] = await Promise.allSettled([
      (async () => {
        const res = await fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.docs || []).map(b => {
          const author = b.author_name ? b.author_name[0] : 'Book';
          const pages = b.number_of_pages_median || null;
          return {
            title: b.title,
            cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '',
            total: pages,
            unit: pages ? 'pages' : 'vol',
            meta: `Novel (${author}) · ${pages ? pages + ' Pages' : 'Book'}`
          };
        });
      })(),
      (async () => {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&type=lightnovel&limit=4&sfw=true`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data || []).map(ln => ({
          title: ln.title_english || ln.title,
          cover: normalizeImageUrl(ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url || ln.images?.webp?.large_image_url || ''),
          total: ln.volumes || ln.chapters || null,
          unit: ln.volumes ? 'vol' : 'ch',
          meta: `Light Novel · ${ln.volumes || '?'} Volume`
        }));
      })(),
      fetchAniListMedia(query, true)
    ]);

    if (openLibRes.status === 'fulfilled') items.push(...openLibRes.value);
    if (jikanRes.status === 'fulfilled') items.push(...jikanRes.value);
    if (aniRes.status === 'fulfilled') items.push(...aniRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'game') {
    const [wikiGameRes, vndbRes, rawgRes] = await Promise.allSettled([
      (async () => {
        const searchRes = await fetchWithTimeout(
          `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=8`
        );
        if (!searchRes.ok) return [];
        const searchData = await searchRes.json();
        const candidates = (searchData.search || []).filter(item => {
          const desc = (item.description || '').toLowerCase();
          return desc.includes('video game') || desc.includes('game');
        });

        if (candidates.length === 0) return [];

        const ids = candidates.map(c => c.id).join('|');
        const entityRes = await fetchWithTimeout(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims|sitelinks|labels|descriptions&languages=en&format=json&origin=*`
        );
        const entityData = await entityRes.json();
        const entities = entityData.entities || {};

        const results = await Promise.all(
          candidates.map(async c => {
            const ent = entities[c.id];
            if (!ent) return null;

            const title = ent.labels?.en?.value || c.label;
            const desc = ent.descriptions?.en?.value || 'Video Game';
            let cover = '';

            const p18 = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
            if (p18) {
              cover = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=500`;
            }

            const enWikiTitle = ent.sitelinks?.enwiki?.title;
            if (!cover && enWikiTitle) {
              try {
                const wpRes = await fetchWithTimeout(
                  `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(enWikiTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`
                );
                const wpData = await wpRes.json();
                const pages = wpData.query?.pages || {};
                const pageObj = Object.values(pages)[0];
                if (pageObj?.thumbnail?.source) {
                  cover = normalizeImageUrl(pageObj.thumbnail.source);
                }
              } catch (_) {}
            }

            return {
              title,
              cover,
              total: 1,
              unit: 'item',
              meta: desc.charAt(0).toUpperCase() + desc.slice(1)
            };
          })
        );

        return results.filter(Boolean);
      })(),
      (async () => {
        const res = await fetchWithTimeout('https://api.vndb.org/kana/vn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: ['search', '=', query],
            fields: 'title, image.url, released',
            results: 5
          })
        });
        const data = await res.json();
        return (data.results || []).map(g => ({
          title: g.title,
          cover: normalizeImageUrl(g.image?.url || ''),
          total: 1,
          unit: 'item',
          meta: `Visual Novel · ${g.released || ''}`
        }));
      })(),
      (async () => {
        if (!RAWG_API_KEY) return [];
        const res = await fetchWithTimeout(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=5`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map(g => ({
          title: g.name,
          cover: normalizeImageUrl(g.background_image || ''),
          total: 1,
          unit: 'item',
          meta: `Game · ${g.released?.slice(0, 4) || ''}`
        }));
      })()
    ]);

    if (wikiGameRes.status === 'fulfilled') items.push(...wikiGameRes.value);
    if (vndbRes.status === 'fulfilled') items.push(...vndbRes.value);
    if (rawgRes.status === 'fulfilled') items.push(...rawgRes.value);
    items = deduplicateResults(items);

  } else if (cat === 'music') {
    try {
      const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=8`);
      const data = await res.json();
      items = (data.results || []).map(m => ({
        title: `${m.collectionName} — ${m.artistName}`,
        cover: normalizeImageUrl(m.artworkUrl100 ? m.artworkUrl100.replace('100x100bb', '600x600bb') : ''),
        total: m.trackCount || 1,
        unit: 'track',
        meta: `Album · ${m.trackCount || '?'} Tracks · ${m.releaseDate?.slice(0, 4) || ''}`
      }));
      items = deduplicateResults(items);
    } catch (e) {
      console.error('Music search error:', e);
    }
  }

  lastApiResults = items;

  if (items.length === 0) {
    resultsBox.innerHTML = `<p style="padding: 12px; font-size: 12px; color: var(--light-gray-70);">No results found. Please fill in the fields manually below.</p>`;
    return;
  }

  resultsBox.innerHTML = items.map((it, idx) => `
    <div class="api-result-item" onclick="applyApiResult(${idx})">
      <img src="${it.cover || 'https://placehold.co/60x90/1e1e1f/888?text=?'}" alt="" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/60x90/1e1e1f/888?text=?'">
      <div class="api-result-info">
        <h4>${escapeHtml(it.title)}</h4>
        <p>${escapeHtml(it.meta)}</p>
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
  handleTotalUnitsChange();
  document.getElementById('api-search-results').style.display = 'none';

  if (item.tvmazeId) {
    try {
      const epRes = await fetchWithTimeout(`https://api.tvmaze.com/shows/${item.tvmazeId}/episodes`);
      const epData = await epRes.json();
      if (Array.isArray(epData) && epData.length > 0) {
        document.getElementById('media-total').value = epData.length;
        handleTotalUnitsChange();
      }
    } catch (e) {
      console.error('TVMaze episode count error:', e);
    }
  }

  if (item.tmdbId && TMDB_API_KEY) {
    try {
      const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}`);
      const detailData = await detailRes.json();
      if (detailData.number_of_episodes) {
        document.getElementById('media-total').value = detailData.number_of_episodes;
        handleTotalUnitsChange();
      }
    } catch (e) {
      console.error('TMDB detail error:', e);
    }
  }
};

// ==========================================
// 6. SUPABASE MEDIA CRUD + AUTO-CLEANUP
// ==========================================
document.getElementById('media-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('media-id').value;
  const existingItem = id ? allMediaLogs.find(m => m.id === id) : null;
  const oldCover = existingItem ? existingItem.cover_url : null;
  const newCover = normalizeImageUrl(document.getElementById('media-cover').value) || null;

  const category = document.getElementById('media-category').value;
  const ratingRaw = document.getElementById('media-rating').value;
  const totalRaw = document.getElementById('media-total').value;
  const statusVal = document.getElementById('media-status').value;
  const totalUnits = totalRaw ? parseInt(totalRaw, 10) : null;
  let progressVal = parseInt(document.getElementById('media-progress').value, 10) || 0;
  const repeatVal = Math.max(0, parseInt(document.getElementById('media-repeat').value, 10) || 0);

  if (statusVal === 'completed' && totalUnits && totalUnits > 0) {
    progressVal = totalUnits;
  }

  const prevStatus = existingItem ? (existingItem.status || '').toLowerCase().trim() : null;
  const statusChanged = !existingItem || prevStatus !== statusVal;
  const statusTimestamp = statusChanged
    ? new Date().toISOString()
    : (existingItem.status_updated_at || existingItem.updated_at || new Date().toISOString());

  const payload = {
    title: document.getElementById('media-title').value.trim(),
    category,
    sub_category: null,
    cover_url: newCover,
    status: statusVal,
    progress: progressVal,
    total_units: totalUnits,
    unit_label: document.getElementById('media-unit').value,
    rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null,
    repeat_count: repeatVal,
    updated_at: statusTimestamp
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
    await cleanupPendingUploads([newCover]);
    if (oldCover && oldCover !== newCover) {
      await deleteOldStorageFile(oldCover);
    }
    document.getElementById('media-modal').classList.remove('active');
    await fetchMediaLogs();
  }
});

window.deleteCurrentModalMedia = async function () {
  const id = document.getElementById('media-id').value;
  if (!id) return;

  const existingItem = allMediaLogs.find(m => m.id === id);

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
    if (error) {
      Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
    } else {
      await cleanupPendingUploads([]);
      if (existingItem?.cover_url) {
        await deleteOldStorageFile(existingItem.cover_url);
      }
      document.getElementById('media-modal').classList.remove('active');
      await fetchMediaLogs();
    }
  }
};

// ==========================================
// 7. PERSONAL NOTES / POSTS (CREATE, READ, EDIT, DELETE)
// ==========================================
function formatPostDateTime(createdIso, updatedIso) {
  if (!createdIso) return '';
  const created = new Date(createdIso);
  if (Number.isNaN(created.getTime())) return '';

  const dateStr = created.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = created.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const isEdited = updatedIso && Math.abs(new Date(updatedIso) - created) > 10000;
  return `${dateStr} · ${timeStr}${isEdited ? ' (edited)' : ''}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function fetchBlogPosts() {
  const { data, error } = await supabaseClient
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const listEl = document.getElementById('blog-feed-list');
    if (listEl) listEl.innerHTML = `<p class="empty-state">Failed to load posts: ${error.message}</p>`;
    return;
  }

  allBlogPosts = data || [];
  renderBlogPosts();
}

function renderBlogPosts() {
  const listEl = document.getElementById('blog-feed-list');
  if (!listEl) return;

  if (allBlogPosts.length === 0) {
    listEl.innerHTML = `<p class="empty-state">No notes yet.</p>`;
    return;
  }

  const avatarSrc = normalizeImageUrl(currentProfile.avatar_url) || TRANSPARENT_PIXEL;
  const authorName = escapeHtml(currentProfile.name || '');

  listEl.innerHTML = allBlogPosts.map(post => {
    const postImg = normalizeImageUrl(post.image_url);
    const timeLabel = formatPostDateTime(post.created_at, post.updated_at);

    const adminControls = isAdminLoggedIn ? `
      <div class="blog-post-actions">
        <button type="button" class="blog-icon-btn" onclick="openEditPostModal('${post.id}')" title="Edit Post">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button type="button" class="blog-icon-btn delete" onclick="deleteBlogPost('${post.id}')" title="Delete Post">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    ` : '';

    const imageBlock = postImg ? `
      <div class="blog-post-image-wrap">
        <img src="${postImg}" alt="Post attachment" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
      </div>
    ` : '';

    return `
      <article class="blog-post-card">
        <div class="blog-post-header">
          <div class="blog-post-author">
            <img class="blog-post-avatar" src="${avatarSrc}" alt="" onerror="this.src='${TRANSPARENT_PIXEL}'">
            <div class="blog-post-meta">
              <span class="blog-post-name">${authorName}</span>
              <span class="blog-post-time">${timeLabel}</span>
            </div>
          </div>
          ${adminControls}
        </div>
        <div class="blog-post-text">${escapeHtml(post.content)}</div>
        ${imageBlock}
      </article>
    `;
  }).join('');
}

window.openPostModal = function () {
  pendingUploadedUrls = [];
  document.getElementById('post-modal-title').textContent = 'New Post';
  document.getElementById('post-form').reset();
  document.getElementById('post-id').value = '';
  setElText('post-upload-status', '');
  document.getElementById('post-modal').classList.add('active');
};

window.openEditPostModal = function (id) {
  const post = allBlogPosts.find(p => p.id === id);
  if (!post) return;

  pendingUploadedUrls = [];
  document.getElementById('post-modal-title').textContent = 'Edit Post';
  document.getElementById('post-id').value = post.id;
  document.getElementById('post-content').value = post.content || '';
  document.getElementById('post-image').value = post.image_url || '';
  setElText('post-upload-status', '');
  document.getElementById('post-modal').classList.add('active');
};

window.closePostModal = async function () {
  document.getElementById('post-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

window.clearPostImageInput = function () {
  document.getElementById('post-image').value = '';
  setElText('post-upload-status', 'Photo removed (click Publish to save).');
};

window.handlePostImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setElText('post-upload-status', 'Uploading photo...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'posts');
    document.getElementById('post-image').value = publicUrl;
    setElText('post-upload-status', 'Photo uploaded!');
  } catch (err) {
    setElText('post-upload-status', `Upload failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
};

document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('post-id').value;
  const existingPost = id ? allBlogPosts.find(p => p.id === id) : null;
  const oldImage = existingPost ? existingPost.image_url : null;
  const newImage = normalizeImageUrl(document.getElementById('post-image').value) || null;
  const contentVal = document.getElementById('post-content').value.trim();

  if (!contentVal) return;

  const nowIso = new Date().toISOString();
  const payload = {
    content: contentVal,
    image_url: newImage,
    updated_at: nowIso
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('blog_posts').update(payload).eq('id', id));
  } else {
    payload.created_at = nowIso;
    ({ error } = await supabaseClient.from('blog_posts').insert([payload]));
  }

  if (error) {
    Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
  } else {
    await cleanupPendingUploads([newImage]);
    if (oldImage && oldImage !== newImage) {
      await deleteOldStorageFile(oldImage);
    }
    document.getElementById('post-modal').classList.remove('active');
    await fetchBlogPosts();
  }
});

window.deleteBlogPost = async function (id) {
  const existingPost = allBlogPosts.find(p => p.id === id);

  const confirm = await Swal.fire({
    text: 'Delete this post permanently?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (confirm.isConfirmed) {
    const { error } = await supabaseClient.from('blog_posts').delete().eq('id', id);
    if (error) {
      Swal.fire({ icon: 'error', text: error.message, background: '#1e1e1f', color: '#fff' });
    } else {
      if (existingPost?.image_url) {
        await deleteOldStorageFile(existingPost.image_url);
      }
      await fetchBlogPosts();
    }
  }
};
