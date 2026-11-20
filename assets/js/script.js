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
let currentMainView = 'blog';
let libraryViewMode = 'grid';
let visibleMediaLimit = ITEMS_PER_PAGE;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;

// Cropper State
let cropperInstance = null;
let cropResolveCallback = null;
let cropRejectCallback = null;

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
// MINIMALIST TOAST NOTIFICATION
// ==========================================
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
    setTimeout(() => toast.remove(), 240);
  }, duration);
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
      showToast('Logged out from Admin mode', 'info');
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
    showToast(error.message, 'error');
  } else {
    isAdminLoggedIn = true;
    closeLoginModal();
    updateAdminUI();
    showToast('Admin login successful', 'success');
  }
});

// ==========================================
// 2B. INTERACTIVE IMAGE CROPPER & STORAGE UPLOAD
// ==========================================
function openImageCropperModal(file, defaultAspectRatio = NaN, title = 'Crop Image') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const modal = document.getElementById('cropper-modal');
      const img = document.getElementById('cropper-target-img');
      setElText('cropper-modal-title', title);

      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }

      cropResolveCallback = resolve;
      cropRejectCallback = reject;

      img.onload = () => {
        cropperInstance = new Cropper(img, {
          aspectRatio: defaultAspectRatio,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          responsive: true,
          background: false
        });
      };

      img.src = e.target.result;
      modal.classList.add('active');

      // Highlight matching aspect button
      document.querySelectorAll('#cropper-aspect-bar .cat-tab').forEach((btn, idx) => {
        btn.classList.remove('active');
        if (Number.isNaN(defaultAspectRatio) && idx === 0) btn.classList.add('active');
        if (defaultAspectRatio === 1 && idx === 1) btn.classList.add('active');
        if (Math.abs(defaultAspectRatio - 2 / 3) < 0.01 && idx === 2) btn.classList.add('active');
        if (Math.abs(defaultAspectRatio - 16 / 9) < 0.01 && idx === 3) btn.classList.add('active');
        if (defaultAspectRatio === 3 && idx === 4) btn.classList.add('active');
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

window.setCropAspectRatio = function (ratio, btnEl) {
  if (!cropperInstance) return;
  cropperInstance.setAspectRatio(ratio);
  document.querySelectorAll('#cropper-aspect-bar .cat-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
};

window.cancelImageCrop = function () {
  document.getElementById('cropper-modal').classList.remove('active');
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  if (cropRejectCallback) {
    cropRejectCallback(new Error('Crop cancelled'));
    cropRejectCallback = null;
    cropResolveCallback = null;
  }
};

window.confirmImageCrop = function () {
  if (!cropperInstance) return;

  const canvas = cropperInstance.getCroppedCanvas({
    maxWidth: 1200,
    maxHeight: 1200,
    imageSmoothingQuality: 'high'
  });

  canvas.toBlob(
    (blob) => {
      document.getElementById('cropper-modal').classList.remove('active');
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
      if (blob && cropResolveCallback) {
        cropResolveCallback(blob);
      } else if (cropRejectCallback) {
        cropRejectCallback(new Error('Crop failed'));
      }
      cropResolveCallback = null;
      cropRejectCallback = null;
    },
    'image/webp',
    0.84
  );
};

async function uploadCroppedBlobToSupabase(blob, folder = 'covers') {
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, blob, {
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

  await supabaseClient.storage.from(STORAGE_BUCKET).remove([filePath]);
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
  event.target.value = '';
  if (!file) return;

  try {
    const croppedBlob = await openImageCropperModal(file, 3, 'Crop Cover Banner');
    setElText('banner-upload-status', 'Uploading banner...');
    const publicUrl = await uploadCroppedBlobToSupabase(croppedBlob, 'banners');
    document.getElementById('edit-profile-banner').value = publicUrl;
    setElText('banner-upload-status', 'Banner cropped & uploaded!');
    showToast('Banner ready to save', 'success');
  } catch (err) {
    if (err.message !== 'Crop cancelled') {
      setElText('banner-upload-status', `Upload failed: ${err.message}`);
      showToast(err.message, 'error');
    }
  }
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const croppedBlob = await openImageCropperModal(file, 1, 'Crop Profile Avatar');
    setElText('profile-upload-status', 'Uploading avatar...');
    const publicUrl = await uploadCroppedBlobToSupabase(croppedBlob, 'avatars');
    document.getElementById('edit-profile-avatar').value = publicUrl;
    setElText('profile-upload-status', 'Avatar cropped & uploaded!');
    showToast('Avatar ready to save', 'success');
  } catch (err) {
    if (err.message !== 'Crop cancelled') {
      setElText('profile-upload-status', `Upload failed: ${err.message}`);
      showToast(err.message, 'error');
    }
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
    showToast(error.message, 'error');
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
    showToast('Profile updated', 'success');
  }
});

// ==========================================
// 3. MULTI-CATEGORY, MULTI-TRACK & SMART STATUS HELPERS
// ==========================================
const CATEGORY_LABELS = {
  tv_show: 'TV Show',
  movie: 'Movie',
  comic: 'Comic',
  novel: 'Novel',
  game: 'Game',
  music: 'Music'
};

const DEFAULT_UNITS_BY_CAT = {
  tv_show: 'eps',
  movie: 'movie',
  comic: 'ch',
  novel: 'vol',
  game: 'item',
  music: 'track'
};

function getLegacyCategory(item) {
  const rawCat = (item.category || '').toLowerCase().trim();
  if (rawCat === 'series' || rawCat === 'tv_show') return 'tv_show';
  if (rawCat === 'other') {
    if (item.sub_category === 'light_novel') return 'novel';
    if (item.sub_category === 'game') return 'game';
  }
  return rawCat || 'tv_show';
}

function getItemTracks(item) {
  if (Array.isArray(item.tracks) && item.tracks.length > 0) {
    return item.tracks.map(t => ({
      category: t.category || getLegacyCategory(item),
      status: (t.status || item.status || 'planned').toLowerCase().trim(),
      progress: Number(t.progress) || 0,
      total_units: (t.total_units !== null && t.total_units !== undefined && t.total_units !== '') ? Number(t.total_units) : null,
      unit_label: t.unit_label || DEFAULT_UNITS_BY_CAT[t.category] || 'eps'
    }));
  }

  const cat = getLegacyCategory(item);
  return [{
    category: cat,
    status: (item.status || 'planned').toLowerCase().trim(),
    progress: Number(item.progress) || 0,
    total_units: (item.total_units !== null && item.total_units !== undefined && item.total_units !== '') ? Number(item.total_units) : null,
    unit_label: item.unit_label || DEFAULT_UNITS_BY_CAT[cat] || 'eps'
  }];
}

function getItemCategories(item) {
  const tracks = getItemTracks(item);
  const cats = new Set(tracks.map(t => t.category));
  if (Array.isArray(item.categories)) {
    item.categories.forEach(c => { if (c) cats.add(c); });
  }
  return Array.from(cats);
}

function getItemSeasons(item) {
  return Array.isArray(item.seasons) ? item.seasons : [];
}

function computeSyncedStatus(tracks) {
  const statuses = Array.from(new Set(tracks.map(t => (t.status || 'planned').toLowerCase().trim())));
  if (statuses.length === 1) {
    return {
      key: statuses[0],
      label: statuses[0],
      isMixed: false
    };
  }
  return {
    key: 'mixed',
    label: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' · '),
    isMixed: true
  };
}

// ==========================================
// 3B. LOAD MEDIA DATA & AUTO-CALCULATE STATS
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
  let tvEps = 0, tvCount = 0;
  let movieTotal = 0, movieDone = 0;
  let comicCh = 0, comicCount = 0;
  let novelTotal = 0, novelDone = 0;
  let gameTotal = 0, gameDone = 0;
  let musicTotal = 0, musicTracks = 0;
  let totalCompleted = 0;

  allMediaLogs.forEach(item => {
    const tracks = getItemTracks(item);
    const synced = computeSyncedStatus(tracks);
    if (synced.key === 'completed') totalCompleted += 1;

    tracks.forEach(t => {
      if (t.category === 'tv_show') {
        tvCount += 1;
        tvEps += (Number(t.progress) || 0);
      } else if (t.category === 'movie') {
        movieTotal += 1;
        if (t.status === 'completed') movieDone += 1;
      } else if (t.category === 'comic') {
        comicCount += 1;
        comicCh += (Number(t.progress) || 0);
      } else if (t.category === 'novel') {
        novelTotal += 1;
        if (t.status === 'completed') novelDone += 1;
      } else if (t.category === 'game') {
        gameTotal += 1;
        if (t.status === 'completed') gameDone += 1;
      } else if (t.category === 'music') {
        musicTotal += 1;
        musicTracks += (Number(t.progress) || 0);
      }
    });
  });

  const totalEntries = allMediaLogs.length;
  const completionRate = totalEntries > 0 ? Math.round((totalCompleted / totalEntries) * 100) : 0;

  const ratedItems = allMediaLogs.filter(i => i.rating !== null && i.rating !== undefined);
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((sum, i) => sum + Number(i.rating), 0) / ratedItems.length).toFixed(2)
    : '0.0';

  setElText('total-entries-label', `${totalEntries} Entries`);

  setElText('stat-tv-eps', tvEps.toLocaleString('en-US'));
  setElText('stat-tv-count', `${tvCount} Show`);

  setElText('stat-movies-total', movieTotal.toLocaleString('en-US'));
  setElText('stat-movies-done', `${movieDone} Completed`);

  setElText('stat-comic-ch', comicCh.toLocaleString('en-US'));
  setElText('stat-comic-count', `${comicCount} Comic`);

  setElText('stat-novel-total', novelTotal.toLocaleString('en-US'));
  setElText('stat-novel-done', `${novelDone} Completed`);

  setElText('stat-game-total', gameTotal.toLocaleString('en-US'));
  setElText('stat-game-done', `${gameDone} Completed`);

  setElText('stat-music-total', musicTotal.toLocaleString('en-US'));
  setElText('stat-music-tracks', `${musicTracks.toLocaleString('en-US')} Track`);

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
    const cats = getItemCategories(item);
    const tracks = getItemTracks(item);
    const seasons = getItemSeasons(item);

    const matchCat = currentCategory === 'all' || cats.includes(currentCategory);
    const matchStatus = statusFilter === 'all' || tracks.some(t => t.status === statusFilter);
    const matchRating = matchesRatingFilter(item, ratingFilter);
    const matchTitle = item.title.toLowerCase().includes(query);
    const matchSeason = seasons.some(s => (s.name || '').toLowerCase().includes(query));
    const matchQuery = !query || matchTitle || matchSeason;

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
      const tracks = getItemTracks(item);
      const cats = getItemCategories(item);
      const seasons = getItemSeasons(item);
      const synced = computeSyncedStatus(tracks);
      const repeatCount = Number(item.repeat_count) || 0;
      const statusDateText = formatStatusDate(item.updated_at || item.created_at);

      const catLabels = cats.map(c => CATEGORY_LABELS[c] || c).join(' / ');
      const progressPills = tracks.map(t => {
        const hasTotal = t.total_units !== null && t.total_units > 0;
        const txt = hasTotal ? `${t.progress}/${t.total_units}` : `${t.progress}/?`;
        const unitShort = tracks.length > 1 ? ` ${t.unit_label}` : '';
        return `<span class="progress-pill ${t.status}">${txt}${unitShort}</span>`;
      }).join('');

      const seasonTag = seasons.length > 0 ? `<span>• ${seasons.length} Parts</span>` : '';
      const repeatHtml = repeatCount > 0 ? `<span class="list-repeat-tag">• ↻ ${repeatCount}x</span>` : '';

      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="Edit Entry">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      return `
        <div class="media-list-row" onclick="openMediaDetailModal('${item.id}')">
          <img class="list-thumb" src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/120x180/1e1e1f/888888?text=?'">
          <div class="list-main-info">
            <div class="list-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="list-sub-meta">
              <span class="list-cat-tag">${escapeHtml(catLabels)}</span>
              <span>•</span>
              <span>${statusDateText}</span>
              ${seasonTag}
              ${repeatHtml}
            </div>
          </div>
          <div class="list-right-meta">
            <span class="status-pill ${synced.key} list-hide-mobile">${escapeHtml(synced.label)}</span>
            <div class="multi-progress-pills">${progressPills}</div>
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
    const tracks = getItemTracks(item);
    const cats = getItemCategories(item);
    const seasons = getItemSeasons(item);
    const synced = computeSyncedStatus(tracks);

    const catBadgesHtml = cats.map(c => `<span class="badge-cat">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('');

    const progressPillsHtml = tracks.map(t => {
      const hasTotal = t.total_units !== null && t.total_units > 0;
      const txt = hasTotal ? `${t.progress}/${t.total_units}` : `${t.progress}/?`;
      const unitShort = tracks.length > 1 ? ` ${t.unit_label}` : '';
      return `<span class="progress-pill ${t.status}">${txt}${unitShort}</span>`;
    }).join('');

    // Calculate average progress bar percentage across tracks
    const trackPercents = tracks.map(t => {
      const hasTotal = t.total_units !== null && t.total_units > 0;
      if (t.status === 'completed') return 100;
      if (hasTotal) return Math.min(100, Math.max(0, Math.round((t.progress / t.total_units) * 100)));
      if (t.status === 'planned') return 100;
      return t.progress > 0 ? 45 : 0;
    });
    const avgPercent = Math.round(trackPercents.reduce((a, b) => a + b, 0) / trackPercents.length);
    const isAllPlannedEmpty = tracks.every(t => t.status === 'planned' && t.progress === 0);
    const extraBarClass = isAllPlannedEmpty ? 'planned-empty' : '';

    const statusDateText = formatStatusDate(item.updated_at || item.created_at);

    const repeatBadgeHtml = repeatCount > 0
      ? `<span class="badge-repeat" title="Rewatch / Reread count">↻ ${repeatCount}x</span>`
      : '';

    const seasonsBadgeHtml = seasons.length > 0
      ? `<span class="badge-seasons">${seasons.length} Parts / OVA</span>`
      : '';

    const coverEditHtml = isAdminLoggedIn ? `
      <button type="button" class="cover-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="Edit Entry">
        <ion-icon name="create-outline"></ion-icon>
      </button>
    ` : '';

    return `
      <div class="media-card" onclick="openMediaDetailModal('${item.id}')">
        <div class="media-cover-wrap">
          <img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/300x450/1e1e1f/888888?text=No+Cover'">
          <div class="cover-left-badges">
            <div class="badge-cat-row">${catBadgesHtml}</div>
            <span class="badge-rating">${ratingText}</span>
            ${repeatBadgeHtml}
          </div>
          ${seasonsBadgeHtml}
          ${coverEditHtml}
        </div>
        <div class="media-body">
          <h3 class="media-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="media-bottom-stack">
            <div class="media-meta-row">
              <span class="status-pill ${synced.key}">${escapeHtml(synced.label)}</span>
              <div class="multi-progress-pills">${progressPillsHtml}</div>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${synced.key} ${extraBarClass}" style="width: ${avgPercent}%"></div>
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
// 4B. MEDIA DETAIL MODAL (VIEW TRACKS & ALL-IN-ONE SEASONS/OVA)
// ==========================================
window.openMediaDetailModal = function (id) {
  const item = allMediaLogs.find(m => m.id === id);
  if (!item) return;

  const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
  const tracks = getItemTracks(item);
  const cats = getItemCategories(item);
  const seasons = getItemSeasons(item);
  const synced = computeSyncedStatus(tracks);
  const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : 'Unrated';
  const repeatCount = Number(item.repeat_count) || 0;

  setElText('detail-modal-title', item.title);

  const tracksHtml = tracks.map(t => {
    const hasTotal = t.total_units !== null && t.total_units > 0;
    const progStr = hasTotal ? `${t.progress} / ${t.total_units} ${t.unit_label}` : `${t.progress} / ? ${t.unit_label}`;
    return `
      <div class="detail-row-item">
        <div>
          <strong style="color: var(--white-1);">${escapeHtml(CATEGORY_LABELS[t.category] || t.category)}</strong>
          <span style="color: var(--light-gray-70); margin-left: 8px;">${progStr}</span>
        </div>
        <span class="status-pill ${t.status}">${t.status}</span>
      </div>
    `;
  }).join('');

  const seasonsHtml = seasons.length > 0 ? `
    <div>
      <div class="detail-section-title">Seasons / Sequels / OVA (${seasons.length})</div>
      <div class="detail-list">
        ${seasons.map(s => {
          const sStatus = (s.status || 'planned').toLowerCase().trim();
          const sProg = (s.total_units && Number(s.total_units) > 0) ? `${s.progress || 0}/${s.total_units}` : `${s.progress || 0}/?`;
          const sRating = s.rating ? ` · ★ ${Number(s.rating).toFixed(1)}` : '';
          return `
            <div class="detail-row-item">
              <div style="min-width: 0;">
                <div style="font-weight: 600; color: var(--white-1);">${escapeHtml(s.name || 'Part')}</div>
                <div style="font-size: 11px; color: var(--light-gray-70);">${sProg}${sRating}</div>
              </div>
              <span class="status-pill ${sStatus}">${sStatus}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const editActionHtml = isAdminLoggedIn ? `
    <div class="modal-submit-row">
      <button type="button" class="form-btn primary-submit" onclick="closeMediaDetailModal(); openEditModal('${item.id}');">
        <ion-icon name="create-outline"></ion-icon>
        <span>Edit Entry</span>
      </button>
    </div>
  ` : '';

  document.getElementById('media-detail-body').innerHTML = `
    <div class="detail-hero">
      <img class="detail-poster" src="${cover}" alt="${escapeHtml(item.title)}" onerror="this.src='https://placehold.co/300x450/1e1e1f/888888?text=No+Cover'">
      <div class="detail-meta-col">
        <div class="badge-cat-row">
          ${cats.map(c => `<span class="badge-cat">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('')}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
          <span class="status-pill ${synced.key}">${escapeHtml(synced.label)}</span>
          <span class="badge-rating">${ratingText}</span>
          ${repeatCount > 0 ? `<span class="badge-repeat">↻ ${repeatCount}x</span>` : ''}
        </div>
        <div style="font-size: 11px; color: var(--light-gray-70);">
          Updated ${formatStatusDate(item.updated_at || item.created_at)}
        </div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Progress Tracks</div>
      <div class="detail-list">${tracksHtml}</div>
    </div>

    ${seasonsHtml}
    ${editActionHtml}
  `;

  document.getElementById('media-detail-modal').classList.add('active');
};

window.closeMediaDetailModal = function () {
  document.getElementById('media-detail-modal').classList.remove('active');
};

// ==========================================
// 5. ADD / EDIT MODAL (MULTI-TRACK, SEASONS/OVA, CROP & MULTI-API)
// ==========================================
window.addMediaTrackRow = function (track = null) {
  const container = document.getElementById('media-tracks-editor');
  if (!container) return;

  const cat = track?.category || 'tv_show';
  const status = track?.status || 'completed';
  const progress = track?.progress ?? 0;
  const total = track?.total_units ?? '';
  const unit = track?.unit_label || DEFAULT_UNITS_BY_CAT[cat] || 'eps';

  const card = document.createElement('div');
  card.className = 'track-edit-card';
  card.innerHTML = `
    <div class="track-edit-top">
      <select class="form-input track-cat-select" onchange="onTrackCategoryChange(this)">
        <option value="tv_show" ${cat === 'tv_show' ? 'selected' : ''}>TV Show</option>
        <option value="movie" ${cat === 'movie' ? 'selected' : ''}>Movie</option>
        <option value="comic" ${cat === 'comic' ? 'selected' : ''}>Comic</option>
        <option value="novel" ${cat === 'novel' ? 'selected' : ''}>Novel</option>
        <option value="game" ${cat === 'game' ? 'selected' : ''}>Game</option>
        <option value="music" ${cat === 'music' ? 'selected' : ''}>Music</option>
      </select>
      <button type="button" class="social-remove-btn" onclick="removeMediaTrackRow(this)" title="Remove Category">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="track-edit-grid">
      <select class="form-input track-status-select" onchange="onTrackStatusOrTotalChange(this)">
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <div class="progress-input-row">
        <input type="number" class="form-input track-progress-input" min="0" value="${progress}" placeholder="Prog">
        <button type="button" class="step-plus-btn" onclick="stepTrackProgress(this)" title="+1">+1</button>
      </div>
      <input type="number" class="form-input track-total-input" min="0" value="${total !== null ? total : ''}" placeholder="Total" oninput="onTrackStatusOrTotalChange(this)">
      <select class="form-input track-unit-select">
        <option value="eps" ${unit === 'eps' ? 'selected' : ''}>Episode</option>
        <option value="movie" ${unit === 'movie' ? 'selected' : ''}>Movie</option>
        <option value="ch" ${unit === 'ch' ? 'selected' : ''}>Chapter</option>
        <option value="vol" ${unit === 'vol' ? 'selected' : ''}>Volume</option>
        <option value="pages" ${unit === 'pages' ? 'selected' : ''}>Pages</option>
        <option value="track" ${unit === 'track' ? 'selected' : ''}>Track</option>
        <option value="item" ${unit === 'item' ? 'selected' : ''}>Item</option>
      </select>
    </div>
  `;
  container.appendChild(card);
};

window.removeMediaTrackRow = function (btn) {
  const container = document.getElementById('media-tracks-editor');
  if (container && container.children.length <= 1) {
    showToast('At least 1 category track is required', 'info');
    return;
  }
  btn.closest('.track-edit-card')?.remove();
};

window.onTrackCategoryChange = function (selectEl) {
  const card = selectEl.closest('.track-edit-card');
  const unitSelect = card?.querySelector('.track-unit-select');
  if (unitSelect && DEFAULT_UNITS_BY_CAT[selectEl.value]) {
    unitSelect.value = DEFAULT_UNITS_BY_CAT[selectEl.value];
  }
};

window.onTrackStatusOrTotalChange = function (el) {
  const card = el.closest('.track-edit-card');
  const status = card?.querySelector('.track-status-select')?.value;
  const totalVal = parseInt(card?.querySelector('.track-total-input')?.value, 10);
  const progInput = card?.querySelector('.track-progress-input');

  if (status === 'completed' && totalVal > 0 && progInput) {
    progInput.value = totalVal;
  }
};

window.stepTrackProgress = function (btn) {
  const card = btn.closest('.track-edit-card');
  const progInput = card?.querySelector('.track-progress-input');
  const totalVal = parseInt(card?.querySelector('.track-total-input')?.value, 10);
  const statusSelect = card?.querySelector('.track-status-select');

  if (!progInput) return;
  const nextVal = (parseInt(progInput.value, 10) || 0) + 1;
  progInput.value = nextVal;

  if (totalVal > 0 && nextVal >= totalVal && statusSelect) {
    statusSelect.value = 'completed';
  }
};

window.addSeasonItemRow = function (season = null) {
  const container = document.getElementById('media-seasons-editor');
  if (!container) return;

  const name = season?.name || '';
  const status = season?.status || 'completed';
  const progress = season?.progress ?? 0;
  const total = season?.total_units ?? '';
  const rating = season?.rating ?? '';

  const card = document.createElement('div');
  card.className = 'season-edit-card';
  card.innerHTML = `
    <div class="season-edit-top">
      <input type="text" class="form-input season-name-input" placeholder="e.g. Season 2 / OVA / Movie Sequel" value="${escapeHtml(name)}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.season-edit-card').remove()" title="Remove Part">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="season-edit-grid">
      <select class="form-input season-status-select">
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <input type="number" class="form-input season-progress-input" min="0" value="${progress}" placeholder="Prog">
      <input type="number" class="form-input season-total-input" min="0" value="${total !== null ? total : ''}" placeholder="Total">
      <input type="number" class="form-input season-rating-input" step="0.1" min="1.0" max="10.0" value="${rating !== null ? rating : ''}" placeholder="Score">
    </div>
  `;
  container.appendChild(card);
};

window.openMediaModal = function () {
  pendingUploadedUrls = [];
  document.getElementById('media-modal-title').textContent = 'Add Media';
  document.getElementById('media-form').reset();
  document.getElementById('media-id').value = '';
  document.getElementById('media-repeat').value = 0;
  document.getElementById('btn-modal-delete').style.display = 'none';
  document.getElementById('api-search-results').style.display = 'none';
  setElText('cover-upload-status', '');

  const tracksEditor = document.getElementById('media-tracks-editor');
  if (tracksEditor) {
    tracksEditor.innerHTML = '';
    addMediaTrackRow({ category: 'tv_show', status: 'completed', progress: 0, total_units: '', unit_label: 'eps' });
  }

  const seasonsEditor = document.getElementById('media-seasons-editor');
  if (seasonsEditor) seasonsEditor.innerHTML = '';

  document.getElementById('media-modal').classList.add('active');
};

window.openEditModal = function (id) {
  const item = allMediaLogs.find(m => m.id === id);
  if (!item) return;

  pendingUploadedUrls = [];
  document.getElementById('media-modal-title').textContent = 'Edit Media';
  document.getElementById('media-id').value = item.id;
  document.getElementById('btn-modal-delete').style.display = 'inline-flex';

  document.getElementById('media-title').value = item.title;
  document.getElementById('media-cover').value = item.cover_url || '';
  document.getElementById('media-rating').value = (item.rating !== null && item.rating !== undefined) ? item.rating : '';
  document.getElementById('media-repeat').value = Number(item.repeat_count) || 0;
  document.getElementById('api-search-results').style.display = 'none';
  setElText('cover-upload-status', '');

  const tracksEditor = document.getElementById('media-tracks-editor');
  if (tracksEditor) {
    tracksEditor.innerHTML = '';
    const tracks = getItemTracks(item);
    tracks.forEach(t => addMediaTrackRow(t));
    document.getElementById('api-search-cat').value = tracks[0]?.category || 'tv_show';
  }

  const seasonsEditor = document.getElementById('media-seasons-editor');
  if (seasonsEditor) {
    seasonsEditor.innerHTML = '';
    getItemSeasons(item).forEach(s => addSeasonItemRow(s));
  }

  document.getElementById('media-modal').classList.add('active');
};

window.closeMediaModal = async function () {
  document.getElementById('media-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

window.handleMediaCoverUpload = async function (event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const croppedBlob = await openImageCropperModal(file, 2 / 3, 'Crop Media Cover (2:3)');
    setElText('cover-upload-status', 'Uploading cover...');
    const publicUrl = await uploadCroppedBlobToSupabase(croppedBlob, 'covers');
    document.getElementById('media-cover').value = publicUrl;
    setElText('cover-upload-status', 'Cover cropped & uploaded!');
    showToast('Cover uploaded', 'success');
  } catch (err) {
    if (err.message !== 'Crop cancelled') {
      setElText('cover-upload-status', `Upload failed: ${err.message}`);
      showToast(err.message, 'error');
    }
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
  const cat = document.getElementById('api-search-cat').value;
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
            if (p18) cover = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=500`;
            const enWikiTitle = ent.sitelinks?.enwiki?.title;
            if (!cover && enWikiTitle) {
              try {
                const wpRes = await fetchWithTimeout(
                  `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(enWikiTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`
                );
                const wpData = await wpRes.json();
                const pageObj = Object.values(wpData.query?.pages || {})[0];
                if (pageObj?.thumbnail?.source) cover = normalizeImageUrl(pageObj.thumbnail.source);
              } catch (_) {}
            }
            return { title, cover, total: 1, unit: 'item', meta: desc.charAt(0).toUpperCase() + desc.slice(1) };
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
  const searchedCat = document.getElementById('api-search-cat').value;
  if (!item) return;

  if (!document.getElementById('media-title').value.trim()) {
    document.getElementById('media-title').value = item.title;
  }
  if (!document.getElementById('media-cover').value.trim() && item.cover) {
    document.getElementById('media-cover').value = item.cover;
  }

  // Find matching track row or update first track
  const trackCards = Array.from(document.querySelectorAll('#media-tracks-editor .track-edit-card'));
  let targetCard = trackCards.find(c => c.querySelector('.track-cat-select')?.value === searchedCat) || trackCards[0];

  if (targetCard) {
    targetCard.querySelector('.track-cat-select').value = searchedCat;
    if (item.total) targetCard.querySelector('.track-total-input').value = item.total;
    if (item.unit) targetCard.querySelector('.track-unit-select').value = item.unit;
    onTrackStatusOrTotalChange(targetCard.querySelector('.track-total-input'));
  }

  document.getElementById('api-search-results').style.display = 'none';

  if (item.tvmazeId && targetCard) {
    try {
      const epRes = await fetchWithTimeout(`https://api.tvmaze.com/shows/${item.tvmazeId}/episodes`);
      const epData = await epRes.json();
      if (Array.isArray(epData) && epData.length > 0) {
        targetCard.querySelector('.track-total-input').value = epData.length;
        onTrackStatusOrTotalChange(targetCard.querySelector('.track-total-input'));
      }
    } catch (_) {}
  }

  if (item.tmdbId && TMDB_API_KEY && targetCard) {
    try {
      const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}`);
      const detailData = await detailRes.json();
      if (detailData.number_of_episodes) {
        targetCard.querySelector('.track-total-input').value = detailData.number_of_episodes;
        onTrackStatusOrTotalChange(targetCard.querySelector('.track-total-input'));
      }
    } catch (_) {}
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

  // Collect Multi-Tracks
  const trackCards = document.querySelectorAll('#media-tracks-editor .track-edit-card');
  const tracks = [];
  trackCards.forEach(card => {
    const cat = card.querySelector('.track-cat-select').value;
    const status = card.querySelector('.track-status-select').value;
    const totalRaw = card.querySelector('.track-total-input').value;
    const totalUnits = totalRaw ? parseInt(totalRaw, 10) : null;
    let progressVal = parseInt(card.querySelector('.track-progress-input').value, 10) || 0;
    const unitLabel = card.querySelector('.track-unit-select').value;

    if (status === 'completed' && totalUnits && totalUnits > 0) {
      progressVal = totalUnits;
    }

    tracks.push({
      category: cat,
      status,
      progress: progressVal,
      total_units: totalUnits,
      unit_label: unitLabel
    });
  });

  // Collect Seasons / Sequels / OVA
  const seasonCards = document.querySelectorAll('#media-seasons-editor .season-edit-card');
  const seasons = [];
  seasonCards.forEach(card => {
    const name = card.querySelector('.season-name-input').value.trim();
    if (!name) return;
    const status = card.querySelector('.season-status-select').value;
    const totalRaw = card.querySelector('.season-total-input').value;
    const totalUnits = totalRaw ? parseInt(totalRaw, 10) : null;
    let progressVal = parseInt(card.querySelector('.season-progress-input').value, 10) || 0;
    const ratingRaw = card.querySelector('.season-rating-input').value;

    if (status === 'completed' && totalUnits && totalUnits > 0) {
      progressVal = totalUnits;
    }

    seasons.push({
      name,
      status,
      progress: progressVal,
      total_units: totalUnits,
      rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null
    });
  });

  const categories = Array.from(new Set(tracks.map(t => t.category)));
  const primaryTrack = tracks[0];
  const syncedStatus = computeSyncedStatus(tracks);

  const ratingRaw = document.getElementById('media-rating').value;
  const repeatVal = Math.max(0, parseInt(document.getElementById('media-repeat').value, 10) || 0);

  const payload = {
    title: document.getElementById('media-title').value.trim(),
    category: primaryTrack.category,
    categories,
    tracks,
    seasons,
    sub_category: null,
    cover_url: newCover,
    status: syncedStatus.isMixed ? primaryTrack.status : syncedStatus.key,
    progress: primaryTrack.progress,
    total_units: primaryTrack.total_units,
    unit_label: primaryTrack.unit_label,
    rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null,
    repeat_count: repeatVal,
    updated_at: new Date().toISOString()
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('media_logs').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('media_logs').insert([payload]));
  }

  if (error) {
    showToast(error.message, 'error');
  } else {
    await cleanupPendingUploads([newCover]);
    if (oldCover && oldCover !== newCover) {
      await deleteOldStorageFile(oldCover);
    }
    document.getElementById('media-modal').classList.remove('active');
    await fetchMediaLogs();
    showToast(id ? 'Media entry updated' : 'Media entry added', 'success');
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
      showToast(error.message, 'error');
    } else {
      await cleanupPendingUploads([]);
      if (existingItem?.cover_url) {
        await deleteOldStorageFile(existingItem.cover_url);
      }
      document.getElementById('media-modal').classList.remove('active');
      await fetchMediaLogs();
      showToast('Entry deleted', 'info');
    }
  }
};

// ==========================================
// 7. PERSONAL NOTES / POSTS + AUTOMATIC LINK PREVIEW CARD
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

function extractFirstUrl(text) {
  const match = (text || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}

function formatTextWithLinks(rawText) {
  const escaped = escapeHtml(rawText || '');
  return escaped.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-note-link">${url}</a>`;
  });
}

function buildLinkPreviewCard(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const iconName = detectSocialIcon(url);
    const pathClean = decodeURIComponent(parsed.pathname).replace(/^\/|\/$/g, '').replace(/[-_]/g, ' ');
    const displayTitle = pathClean ? `${domain} — ${pathClean}` : url;

    return `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
        <div class="link-preview-icon">
          <ion-icon name="${iconName}"></ion-icon>
        </div>
        <div class="link-preview-info">
          <span class="link-preview-domain">${escapeHtml(domain)}</span>
          <span class="link-preview-title">${escapeHtml(displayTitle)}</span>
        </div>
        <ion-icon name="open-outline" style="color: var(--light-gray-70); font-size: 16px; flex-shrink: 0;"></ion-icon>
      </a>
    `;
  } catch (_) {
    return '';
  }
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
    const detectedUrl = extractFirstUrl(post.content);
    const linkPreviewHtml = detectedUrl ? buildLinkPreviewCard(detectedUrl) : '';

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
        <div class="blog-post-text">${formatTextWithLinks(post.content)}</div>
        ${linkPreviewHtml}
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
  event.target.value = '';
  if (!file) return;

  try {
    const croppedBlob = await openImageCropperModal(file, NaN, 'Crop Post Photo');
    setElText('post-upload-status', 'Uploading photo...');
    const publicUrl = await uploadCroppedBlobToSupabase(croppedBlob, 'posts');
    document.getElementById('post-image').value = publicUrl;
    setElText('post-upload-status', 'Photo cropped & uploaded!');
    showToast('Photo uploaded', 'success');
  } catch (err) {
    if (err.message !== 'Crop cancelled') {
      setElText('post-upload-status', `Upload failed: ${err.message}`);
      showToast(err.message, 'error');
    }
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
    showToast(error.message, 'error');
  } else {
    await cleanupPendingUploads([newImage]);
    if (oldImage && oldImage !== newImage) {
      await deleteOldStorageFile(oldImage);
    }
    document.getElementById('post-modal').classList.remove('active');
    await fetchBlogPosts();
    showToast(id ? 'Post updated' : 'Post published', 'success');
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
      showToast(error.message, 'error');
    } else {
      if (existingPost?.image_url) {
        await deleteOldStorageFile(existingPost.image_url);
      }
      await fetchBlogPosts();
      showToast('Post deleted', 'info');
    }
  }
};
