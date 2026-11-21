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

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let allMediaLogs = [];
let allBlogPosts = [];
let lastApiResults = [];
let pendingUploadedUrls = [];
let currentCategory = 'all';
let currentMainView = 'blog';
let libraryViewMode = 'grid'; // DEFAULT: Poster Grid View
let itemsPerPage = 16;        // DEFAULT: Medium (16 desktop / 12 mobile)
let visibleMediaLimit = 16;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;

// Sort State (Default: Rating Best)
let currentSortField = 'rating';
let currentSortDir = 'desc';

let currentProfile = {
  name: '',
  bio: '',
  avatar_url: '',
  banner_url: '',
  social_links: [],
  is_library_private: false
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
  try {
    setupScrollListeners();
    setupOutsidePopoverCloser();
    setupFilterListeners();
    updateSortUIControls();
    syncDisplayModalUI();

    await checkAdminSession();
    await fetchProfileSettings();
    await Promise.all([fetchBlogPosts(), fetchMediaLogs()]);
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Init error: ' + err.message, 'error', 5000);
  }
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

function closeAllToolbarPopovers() {
  const pairs = [
    ['filter-popover-menu', 'btn-filter-toggle'],
    ['sort-popover-menu', 'btn-sort-toggle']
  ];
  pairs.forEach(([menuId, btnId]) => {
    const m = document.getElementById(menuId);
    const b = document.getElementById(btnId);
    if (m) m.classList.remove('open');
    if (b) b.classList.remove('active');
  });
}

function setupOutsidePopoverCloser() {
  document.addEventListener('click', (e) => {
    const filterWrap = document.getElementById('filter-popover-wrap');
    const sortWrap = document.getElementById('sort-popover-wrap');

    const insideFilter = filterWrap && filterWrap.contains(e.target);
    const insideSort = sortWrap && sortWrap.contains(e.target);

    if (!insideFilter && !insideSort) {
      closeAllToolbarPopovers();
    }
  });
}

window.toggleToolbarPopover = function (type) {
  const map = {
    filter: ['filter-popover-menu', 'btn-filter-toggle'],
    sort: ['sort-popover-menu', 'btn-sort-toggle']
  };
  const target = map[type];
  if (!target) return;

  const menuEl = document.getElementById(target[0]);
  const btnEl = document.getElementById(target[1]);
  const willOpen = menuEl ? !menuEl.classList.contains('open') : false;

  closeAllToolbarPopovers();

  if (willOpen && menuEl && btnEl) {
    menuEl.style.left = '';
    menuEl.style.right = '';
    menuEl.classList.add('open');
    btnEl.classList.add('active');

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const isMobileLayout = viewportWidth <= 680;
    const rect = menuEl.getBoundingClientRect();
    const btnRect = btnEl.getBoundingClientRect();

    if (isMobileLayout) {
      if (rect.right > viewportWidth - 14) {
        const overflowRight = rect.right - (viewportWidth - 14);
        const safeShift = Math.min(overflowRight, Math.max(0, btnRect.left - 14));
        menuEl.style.left = `-${safeShift}px`;
      }
    } else {
      if (rect.left < 14) {
        const overflowLeft = 14 - rect.left;
        menuEl.style.right = `-${overflowLeft}px`;
      }
    }
  }
};

// Display Size & View Mode Unified Modal Controls
function syncDisplayModalUI() {
  const modalGridBtn = document.getElementById('modal-btn-view-grid');
  const modalListBtn = document.getElementById('modal-btn-view-list');
  const toolbarIcon = document.getElementById('display-options-icon');

  if (modalGridBtn) modalGridBtn.classList.toggle('active', libraryViewMode === 'grid');
  if (modalListBtn) modalListBtn.classList.toggle('active', libraryViewMode === 'list');
  if (toolbarIcon) {
    toolbarIcon.setAttribute('name', libraryViewMode === 'list' ? 'list-outline' : 'grid-outline');
  }
}

window.openDisplayOptionsModal = function () {
  closeAllToolbarPopovers();
  syncDisplayModalUI();
  const modal = document.getElementById('display-options-modal');
  if (modal) modal.classList.add('active');
};

window.closeDisplayOptionsModal = function () {
  const modal = document.getElementById('display-options-modal');
  if (modal) modal.classList.remove('active');
};

window.scrollToTopSmooth = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.switchMainView = function (viewName) {
  if (viewName === 'library' && currentProfile.is_library_private && !isAdminLoggedIn) {
    viewName = 'blog';
  }

  currentMainView = viewName;

  document.querySelectorAll('.nav-icon-tab-btn, .mini-nav-btn').forEach(btn => {
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

function updateLibraryTabVisibility() {
  const isPrivate = Boolean(currentProfile.is_library_private);
  const canViewLibrary = !isPrivate || isAdminLoggedIn;

  const bottomLibBtn = document.getElementById('bottom-tab-library');
  const lockBadge = document.getElementById('library-private-lock');

  if (bottomLibBtn) bottomLibBtn.style.display = canViewLibrary ? 'inline-flex' : 'none';
  if (lockBadge) lockBadge.style.display = (isPrivate && isAdminLoggedIn) ? 'inline-flex' : 'none';

  if (!canViewLibrary && currentMainView === 'library') {
    switchMainView('blog');
  }
}

window.handleCenterActionClick = function () {
  if (!isAdminLoggedIn) return;
  if (currentMainView === 'library') {
    openMediaModal();
  } else {
    openPostModal();
  }
};

window.setLibraryViewMode = function (mode) {
  libraryViewMode = mode;
  syncDisplayModalUI();
  renderMediaGrid();
};

window.selectItemsPerPage = function (val) {
  if (val === 'all') {
    itemsPerPage = Infinity;
    visibleMediaLimit = Infinity;
  } else {
    itemsPerPage = parseInt(val, 10) || 16;
    visibleMediaLimit = itemsPerPage;
  }

  document.querySelectorAll('#display-options-modal .page-option-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.limit === String(val));
  });

  renderMediaGrid();
};

window.loadMoreMedia = function () {
  if (itemsPerPage === Infinity) {
    visibleMediaLimit = Infinity;
  } else {
    visibleMediaLimit += itemsPerPage;
  }
  renderMediaGrid();
};

window.toggleLibraryStats = function () {
  isStatsExpanded = !isStatsExpanded;
  const panel = document.getElementById('collapsible-stats-panel');
  const toggleBtn = document.getElementById('btn-toggle-stats');
  const textEl = document.getElementById('stats-toggle-text');
  const iconEl = document.getElementById('stats-chevron-icon');

  if (panel) panel.style.display = isStatsExpanded ? 'flex' : 'none';
  if (toggleBtn) toggleBtn.classList.toggle('active', isStatsExpanded);
  if (textEl) textEl.textContent = isStatsExpanded ? 'Hide Stats' : 'Show Stats';
  if (iconEl) iconEl.setAttribute('name', isStatsExpanded ? 'chevron-up-outline' : 'chevron-down-outline');
};

function updateAdminActionButtons() {
  const centerActionBtn = document.getElementById('btn-center-action');
  const centerActionIcon = document.getElementById('center-action-icon');
  const centerActionLabel = document.getElementById('center-action-label');

  if (!centerActionBtn) return;

  if (!isAdminLoggedIn) {
    centerActionBtn.style.display = 'none';
    return;
  }

  centerActionBtn.style.display = 'inline-flex';
  const inLibrary = currentMainView === 'library';

  if (centerActionIcon) {
    centerActionIcon.setAttribute('name', inLibrary ? 'add-outline' : 'create-outline');
  }
  if (centerActionLabel) {
    centerActionLabel.textContent = inLibrary ? 'Add Media' : 'New Post';
  }
  centerActionBtn.title = inLibrary ? 'Add Media' : 'New Post';
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

  updateLibraryTabVisibility();
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

const loginForm = document.getElementById('admin-login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
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
}

// ==========================================
// 2B. IMAGE COMPRESSION, STORAGE UPLOAD & CAROUSEL HELPER
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

function buildImageCarouselHtml(urls, extraClass = '') {
  const cleanUrls = (Array.isArray(urls) ? urls : [])
    .map(u => normalizeImageUrl(u))
    .filter(Boolean);

  if (cleanUrls.length === 0) return '';

  const total = cleanUrls.length;
  const slidesHtml = cleanUrls.map((src, i) => `
    <div class="carousel-slide">
      <img src="${src}" alt="Slide ${i + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/300x450/1e1e1f/888888?text=Image'">
    </div>
  `).join('');

  if (total === 1) {
    return `
      <div class="image-carousel ${extraClass}" data-index="0" data-total="1">
        <div class="carousel-track">${slidesHtml}</div>
      </div>
    `;
  }

  const dotsHtml = cleanUrls.map((_, i) => `
    <button type="button" class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); goCarouselSlide(this, ${i})" aria-label="Slide ${i + 1}"></button>
  `).join('');

  return `
    <div class="image-carousel ${extraClass}" data-index="0" data-total="${total}">
      <div class="carousel-track">${slidesHtml}</div>
      <span class="carousel-counter">1 / ${total}</span>
      <button type="button" class="carousel-btn prev" onclick="event.stopPropagation(); stepCarouselSlide(this, -1)" aria-label="Previous image">
        <ion-icon name="chevron-back-outline"></ion-icon>
      </button>
      <button type="button" class="carousel-btn next" onclick="event.stopPropagation(); stepCarouselSlide(this, 1)" aria-label="Next image">
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </button>
      <div class="carousel-dots">${dotsHtml}</div>
    </div>
  `;
}

window.stepCarouselSlide = function (btnEl, delta) {
  const carousel = btnEl.closest('.image-carousel');
  if (!carousel) return;
  const total = parseInt(carousel.dataset.total || '1', 10);
  const current = parseInt(carousel.dataset.index || '0', 10);
  const next = (current + delta + total) % total;
  updateCarouselUI(carousel, next);
};

window.goCarouselSlide = function (dotEl, targetIndex) {
  const carousel = dotEl.closest('.image-carousel');
  if (!carousel) return;
  updateCarouselUI(carousel, targetIndex);
};

function updateCarouselUI(carousel, index) {
  const total = parseInt(carousel.dataset.total || '1', 10);
  carousel.dataset.index = String(index);

  const track = carousel.querySelector('.carousel-track');
  if (track) {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  const counter = carousel.querySelector('.carousel-counter');
  if (counter) {
    counter.textContent = `${index + 1} / ${total}`;
  }

  carousel.querySelectorAll('.carousel-dot').forEach((d, idx) => {
    d.classList.toggle('active', idx === index);
  });
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

  if (error) {
    console.warn('Profile fetch warning:', error.message);
  }

  if (!error && data) {
    currentProfile = {
      name: data.name || '',
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

  updateLibraryTabVisibility();
  updateAdminActionButtons();
  renderBlogPosts();
}

window.addSocialLinkRow = function (label = '', url = '') {
  const container = document.getElementById('social-links-editor');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'social-edit-row';
  row.innerHTML = `
    <input type="text" class="form-input social-label-input" placeholder="Label" value="${escapeHtml(label)}">
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

  const privateCheckbox = document.getElementById('edit-library-private');
  if (privateCheckbox) {
    privateCheckbox.checked = Boolean(currentProfile.is_library_private);
  }

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
  setElText('banner-upload-status', 'Banner removed.');
};

window.handleBannerImageUpload = async function (event) {
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('banner-upload-status', 'Uploading...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'banners');
    document.getElementById('edit-profile-banner').value = publicUrl;
    setElText('banner-upload-status', 'Uploaded!');
    showToast('Banner uploaded', 'success');
  } catch (err) {
    setElText('banner-upload-status', `Failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('profile-upload-status', 'Uploading...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'avatars');
    document.getElementById('edit-profile-avatar').value = publicUrl;
    setElText('profile-upload-status', 'Uploaded!');
    showToast('Avatar uploaded', 'success');
  } catch (err) {
    setElText('profile-upload-status', `Failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

const profileForm = document.getElementById('profile-form');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldAvatar = currentProfile.avatar_url;
    const oldBanner = currentProfile.banner_url;
    const newAvatar = document.getElementById('edit-profile-avatar').value.trim();
    const newBanner = document.getElementById('edit-profile-banner').value.trim();
    const isPrivate = Boolean(document.getElementById('edit-library-private')?.checked);

    const socialRows = document.querySelectorAll('#social-links-editor .social-edit-row');
    const collectedLinks = [];
    socialRows.forEach(row => {
      const labelEl = row.querySelector('.social-label-input');
      const urlEl = row.querySelector('.social-url-input');
      const label = labelEl ? labelEl.value.trim() : '';
      const url = urlEl ? urlEl.value.trim() : '';
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
      is_library_private: isPrivate,
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
      showToast('Settings saved', 'success');
    }
  });
}

// ==========================================
// 3. MULTI-CATEGORY, EPISODE REVIEWS & GALLERY HELPERS
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

const UNIT_SHORT_LABELS = {
  eps: 'EPS',
  ch: 'CH',
  movie: 'MOVIE',
  vol: 'VOL',
  pages: 'PAGES',
  track: 'TRACK',
  item: 'ITEM'
};

function getStatusBadgeClass(statusKey) {
  const key = (statusKey || 'planned').toLowerCase().trim();
  if (key === 'completed') return 'badge-status-completed';
  if (key === 'ongoing') return 'badge-status-ongoing';
  if (key === 'dropped') return 'badge-status-dropped';
  return 'badge-status-planned';
}

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

function getItemEpisodeReviews(item) {
  if (!Array.isArray(item.episode_reviews)) return [];
  return item.episode_reviews
    .map(r => ({
      number: (r.number || '').toString().trim(),
      title: (r.title || '').toString().trim(),
      rating: (r.rating !== null && r.rating !== undefined && r.rating !== '') ? Number(r.rating) : null,
      note: (r.note || '').toString().trim()
    }))
    .filter(r => r.number || r.title || r.rating !== null || r.note);
}

function getItemGalleryUrls(item) {
  const urls = [];
  if (Array.isArray(item.gallery_urls)) {
    item.gallery_urls.forEach(u => {
      const clean = normalizeImageUrl(u);
      if (clean && !urls.includes(clean)) urls.push(clean);
    });
  }
  const primaryCover = normalizeImageUrl(item.cover_url);
  if (primaryCover && !urls.includes(primaryCover)) {
    urls.unshift(primaryCover);
  }
  return urls;
}

function getAllItemUnits(item) {
  return getItemTracks(item);
}

function getItemCategories(item) {
  const allUnits = getAllItemUnits(item);
  const cats = new Set(allUnits.map(t => t.category));
  if (Array.isArray(item.categories)) {
    item.categories.forEach(c => { if (c) cats.add(c); });
  }
  return Array.from(cats);
}

function getItemTotalUnitsValue(item) {
  const allUnits = getAllItemUnits(item);
  const sumTotal = allUnits.reduce((sum, t) => sum + (Number(t.total_units) || 0), 0);
  if (sumTotal > 0) return sumTotal;
  return allUnits.reduce((sum, t) => sum + (Number(t.progress) || 0), 0);
}

function computeSyncedStatus(unitsList) {
  const statuses = unitsList.map(t => (t.status || 'planned').toLowerCase().trim());

  if (statuses.includes('ongoing')) {
    return { key: 'ongoing', label: 'Ongoing' };
  }
  if (statuses.length > 0 && statuses.every(s => s === 'completed')) {
    return { key: 'completed', label: 'Completed' };
  }
  if (statuses.includes('dropped')) {
    return { key: 'dropped', label: 'Dropped' };
  }
  return { key: 'planned', label: 'Planned' };
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
    const grid = document.getElementById('media-grid');
    if (grid) grid.innerHTML = `<p class="empty-state">Failed to load data: ${escapeHtml(error.message)}</p>`;
    return;
  }

  allMediaLogs = data || [];
  updateStatsUI();
  renderMediaGrid();
}

function updateStatsUI() {
  const catStats = {
    tv_show: { total: 0, done: 0 },
    movie: { total: 0, done: 0 },
    comic: { total: 0, done: 0 },
    novel: { total: 0, done: 0 },
    game: { total: 0, done: 0 },
    music: { total: 0, done: 0 }
  };

  const unitCounts = {
    eps: 0,
    ch: 0,
    pages: 0,
    vol: 0,
    movie: 0,
    track: 0,
    item: 0
  };

  let totalCompleted = 0;

  allMediaLogs.forEach(item => {
    const allUnits = getAllItemUnits(item);
    const synced = computeSyncedStatus(allUnits);
    if (synced.key === 'completed') totalCompleted += 1;

    allUnits.forEach(u => {
      if (catStats[u.category]) {
        catStats[u.category].total += 1;
        if (u.status === 'completed') catStats[u.category].done += 1;
      }

      const unitKey = u.unit_label || DEFAULT_UNITS_BY_CAT[u.category] || 'item';
      const progNum = Number(u.progress) || 0;
      if (unitCounts[unitKey] !== undefined) {
        unitCounts[unitKey] += progNum;
      } else {
        unitCounts.item += progNum;
      }
    });
  });

  const totalEntries = allMediaLogs.length;
  const completionRate = totalEntries > 0 ? Math.round((totalCompleted / totalEntries) * 100) : 0;

  const ratedItems = allMediaLogs.filter(i => i.rating !== null && i.rating !== undefined && i.rating !== '');
  const avgRating = ratedItems.length
    ? (ratedItems.reduce((sum, i) => sum + Number(i.rating), 0) / ratedItems.length).toFixed(2)
    : '0.0';

  setElText('total-entries-label', `${totalEntries} Entries`);

  setElText('stat-cat-tv', catStats.tv_show.total.toLocaleString('en-US'));
  setElText('stat-cat-tv-sub', `${catStats.tv_show.done} Completed`);

  setElText('stat-cat-movie', catStats.movie.total.toLocaleString('en-US'));
  setElText('stat-cat-movie-sub', `${catStats.movie.done} Completed`);

  setElText('stat-cat-comic', catStats.comic.total.toLocaleString('en-US'));
  setElText('stat-cat-comic-sub', `${catStats.comic.done} Completed`);

  setElText('stat-cat-novel', catStats.novel.total.toLocaleString('en-US'));
  setElText('stat-cat-novel-sub', `${catStats.novel.done} Completed`);

  setElText('stat-cat-game', catStats.game.total.toLocaleString('en-US'));
  setElText('stat-cat-game-sub', `${catStats.game.done} Completed`);

  setElText('stat-cat-music', catStats.music.total.toLocaleString('en-US'));
  setElText('stat-cat-music-sub', `${catStats.music.done} Completed`);

  setElText('stat-unit-eps', unitCounts.eps.toLocaleString('en-US'));
  setElText('stat-unit-ch', unitCounts.ch.toLocaleString('en-US'));
  setElText('stat-unit-pages', unitCounts.pages.toLocaleString('en-US'));
  setElText('stat-unit-vol', unitCounts.vol.toLocaleString('en-US'));
  setElText('stat-unit-movie', unitCounts.movie.toLocaleString('en-US'));
  setElText('stat-unit-track', unitCounts.track.toLocaleString('en-US'));
  setElText('stat-unit-item', unitCounts.item.toLocaleString('en-US'));

  setElText('stat-completed-total', totalCompleted.toLocaleString('en-US'));
  setElText('stat-completion-rate', `${completionRate}% Rate`);

  setElText('stat-avg-rating', avgRating);
  setElText('stat-rated-count', `${ratedItems.length} Rated`);
}

// ==========================================
// 4. FILTER, SORT, PAGINATION & RENDER MEDIA
// ==========================================
function resetPaginationAndRender() {
  visibleMediaLimit = itemsPerPage;
  updateFilterActiveIndicator();
  renderMediaGrid();
}

function updateFilterActiveIndicator() {
  const statusVal = document.getElementById('filter-status')?.value || 'all';
  const rMin = document.getElementById('filter-rating-min')?.value || '';
  const rMax = document.getElementById('filter-rating-max')?.value || '';
  const unratedOnly = document.getElementById('filter-unrated-only')?.checked || false;
  const uMin = document.getElementById('filter-units-min')?.value || '';
  const uMax = document.getElementById('filter-units-max')?.value || '';

  const isFiltered = statusVal !== 'all' || rMin !== '' || rMax !== '' || unratedOnly || uMin !== '' || uMax !== '';
  const dot = document.getElementById('filter-active-dot');
  if (dot) {
    dot.style.display = isFiltered ? 'inline-block' : 'none';
  }
}

window.resetLibraryFilters = function () {
  const statusEl = document.getElementById('filter-status');
  const rMinEl = document.getElementById('filter-rating-min');
  const rMaxEl = document.getElementById('filter-rating-max');
  const unratedEl = document.getElementById('filter-unrated-only');
  const uMinEl = document.getElementById('filter-units-min');
  const uMaxEl = document.getElementById('filter-units-max');

  if (statusEl) statusEl.value = 'all';
  if (rMinEl) { rMinEl.value = ''; rMinEl.disabled = false; }
  if (rMaxEl) { rMaxEl.value = ''; rMaxEl.disabled = false; }
  if (unratedEl) unratedEl.checked = false;
  if (uMinEl) uMinEl.value = '';
  if (uMaxEl) uMaxEl.value = '';

  resetPaginationAndRender();
};

function updateSortUIControls() {
  const fieldEl = document.getElementById('sort-library-field');
  if (fieldEl) fieldEl.value = currentSortField;

  const descBtn = document.getElementById('btn-sort-desc');
  const ascBtn = document.getElementById('btn-sort-asc');
  const labelEl = document.getElementById('sort-btn-label');

  if (descBtn) descBtn.classList.toggle('active', currentSortDir === 'desc');
  if (ascBtn) ascBtn.classList.toggle('active', currentSortDir === 'asc');

  if (currentSortField === 'rating') {
    if (descBtn) descBtn.textContent = 'Best';
    if (ascBtn) ascBtn.textContent = 'Worst';
    if (labelEl) labelEl.textContent = currentSortDir === 'desc' ? 'Rating (Best)' : 'Rating (Worst)';
  } else if (currentSortField === 'units') {
    if (descBtn) descBtn.textContent = 'Longest';
    if (ascBtn) ascBtn.textContent = 'Shortest';
    if (labelEl) labelEl.textContent = currentSortDir === 'desc' ? 'Count (Longest)' : 'Count (Shortest)';
  } else if (currentSortField === 'title') {
    if (descBtn) descBtn.textContent = 'Z → A';
    if (ascBtn) ascBtn.textContent = 'A → Z';
    if (labelEl) labelEl.textContent = currentSortDir === 'asc' ? 'Title (A→Z)' : 'Title (Z→A)';
  } else {
    if (descBtn) descBtn.textContent = 'Newest';
    if (ascBtn) ascBtn.textContent = 'Oldest';
    if (labelEl) labelEl.textContent = currentSortDir === 'desc' ? 'Updated (New)' : 'Updated (Old)';
  }
}

window.onSortOptionChange = function () {
  const fieldEl = document.getElementById('sort-library-field');
  const fieldVal = fieldEl ? fieldEl.value : 'rating';
  currentSortField = fieldVal;
  currentSortDir = fieldVal === 'title' ? 'asc' : 'desc';
  updateSortUIControls();
  resetPaginationAndRender();
};

window.setSortDirection = function (dir) {
  currentSortDir = dir;
  updateSortUIControls();
  resetPaginationAndRender();
};

function setupFilterListeners() {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      resetPaginationAndRender();
    });
  });

  const searchInput = document.getElementById('search-library');
  const statusSelect = document.getElementById('filter-status');
  const rMinInput = document.getElementById('filter-rating-min');
  const rMaxInput = document.getElementById('filter-rating-max');
  const unratedCheck = document.getElementById('filter-unrated-only');
  const uMinInput = document.getElementById('filter-units-min');
  const uMaxInput = document.getElementById('filter-units-max');

  if (searchInput) searchInput.addEventListener('input', resetPaginationAndRender);
  if (statusSelect) statusSelect.addEventListener('change', resetPaginationAndRender);
  if (rMinInput) rMinInput.addEventListener('input', resetPaginationAndRender);
  if (rMaxInput) rMaxInput.addEventListener('input', resetPaginationAndRender);
  if (uMinInput) uMinInput.addEventListener('input', resetPaginationAndRender);
  if (uMaxInput) uMaxInput.addEventListener('input', resetPaginationAndRender);

  if (unratedCheck) {
    unratedCheck.addEventListener('change', () => {
      const isChecked = unratedCheck.checked;
      if (rMinInput) rMinInput.disabled = isChecked;
      if (rMaxInput) rMaxInput.disabled = isChecked;
      resetPaginationAndRender();
    });
  }
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

function matchesCustomFilters(item) {
  const rMinRaw = document.getElementById('filter-rating-min')?.value ?? '';
  const rMaxRaw = document.getElementById('filter-rating-max')?.value ?? '';
  const unratedOnly = document.getElementById('filter-unrated-only')?.checked ?? false;
  const uMinRaw = document.getElementById('filter-units-min')?.value ?? '';
  const uMaxRaw = document.getElementById('filter-units-max')?.value ?? '';

  const hasRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
  const rVal = hasRating ? Number(item.rating) : null;

  if (unratedOnly) {
    if (hasRating) return false;
  } else if (rMinRaw !== '' || rMaxRaw !== '') {
    if (!hasRating || Number.isNaN(rVal)) return false;
    if (rMinRaw !== '' && rVal < parseFloat(rMinRaw)) return false;
    if (rMaxRaw !== '' && rVal > parseFloat(rMaxRaw)) return false;
  }

  if (uMinRaw !== '' || uMaxRaw !== '') {
    const totalUnits = getItemTotalUnitsValue(item);
    if (uMinRaw !== '' && totalUnits < parseInt(uMinRaw, 10)) return false;
    if (uMaxRaw !== '' && totalUnits > parseInt(uMaxRaw, 10)) return false;
  }

  return true;
}

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;

  const loadMoreWrap = document.getElementById('load-more-wrap');
  const loadMoreText = document.getElementById('load-more-text');

  const searchEl = document.getElementById('search-library');
  const statusEl = document.getElementById('filter-status');

  const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const statusFilter = statusEl ? statusEl.value : 'all';

  grid.classList.toggle('list-view', libraryViewMode === 'list');

  let filtered = allMediaLogs.filter(item => {
    const cats = getItemCategories(item);
    const allUnits = getAllItemUnits(item);
    const epReviews = getItemEpisodeReviews(item);
    const synced = computeSyncedStatus(allUnits);

    const matchCat = currentCategory === 'all' || cats.includes(currentCategory);
    const matchStatus = statusFilter === 'all' || synced.key === statusFilter || allUnits.some(t => t.status === statusFilter);
    const matchRange = matchesCustomFilters(item);
    const matchTitle = (item.title || '').toLowerCase().includes(query);
    const matchEpReview = epReviews.some(ep =>
      (ep.title || '').toLowerCase().includes(query) ||
      (ep.number || '').toLowerCase().includes(query) ||
      (ep.note || '').toLowerCase().includes(query)
    );
    const matchQuery = !query || matchTitle || matchEpReview;

    return matchCat && matchStatus && matchRange && matchQuery;
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

    if (currentSortField === 'units') {
      const uA = getItemTotalUnitsValue(a);
      const uB = getItemTotalUnitsValue(b);
      return currentSortDir === 'desc' ? (uB - uA) : (uA - uB);
    }

    if (currentSortField === 'title') {
      const cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      return currentSortDir === 'asc' ? cmp : -cmp;
    }

    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return currentSortDir === 'desc' ? (timeB - timeA) : (timeA - timeB);
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">No media found matching these filters.</p>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  const displayedItems = visibleMediaLimit === Infinity ? filtered : filtered.slice(0, visibleMediaLimit);
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
      const safeId = escapeHtml(String(item.id));
      const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/120x180/1e1e1f/888888?text=?';
      const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
      const cats = getItemCategories(item);
      const allUnits = getAllItemUnits(item);
      const synced = computeSyncedStatus(allUnits);
      const epReviews = getItemEpisodeReviews(item);
      const repeatCount = Number(item.repeat_count) || 0;

      const catLabels = cats.map(c => (CATEGORY_LABELS[c] || c).toUpperCase()).join(' / ');
      const metaParts = [catLabels, synced.label.toUpperCase()];
      if (epReviews.length > 0) metaParts.push('REVIEWED');
      if (repeatCount > 0) metaParts.push(`↻ ${repeatCount}X`);

      const subMetaHtml = metaParts
        .map(part => `<span class="list-sub-meta-item">${escapeHtml(part)}</span>`)
        .join('<span class="list-meta-sep">·</span>');

      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditModal('${safeId}')" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      return `
        <div class="media-list-row" onclick="openMediaDetailModal('${safeId}')">
          <img class="list-thumb" src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/120x180/1e1e1f/888888?text=?'">
          <div class="list-main-info">
            <div class="list-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="list-sub-meta">${subMetaHtml}</div>
          </div>
          <div class="list-right-meta">
            <span class="list-rating-pill">${ratingText}</span>
            ${editBtnHtml}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // POSTER GRID VIEW RENDER (DEFAULT)
  grid.innerHTML = displayedItems.map(item => {
    const safeId = escapeHtml(String(item.id));
    const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';

    return `
      <div class="media-card" onclick="openMediaDetailModal('${safeId}')">
        <div class="media-cover-wrap">
          <img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/300x450/1e1e1f/888888?text=No+Cover'">
          <div class="poster-bottom-overlay">
            <h3 class="poster-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 4B. MEDIA DETAIL MODAL (NEW BADGE PALETTE, PROGRESS BAR CARDS & LIGHT REVIEW RATING)
// ==========================================
window.openMediaDetailModal = function (id) {
  const item = allMediaLogs.find(m => String(m.id) === String(id));
  if (!item) return;

  const safeId = escapeHtml(String(item.id));
  const galleryUrls = getItemGalleryUrls(item);
  const fallbackPoster = 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
  const posterSlides = galleryUrls.length > 0 ? galleryUrls : [fallbackPoster];

  const tracks = getItemTracks(item);
  const epReviews = getItemEpisodeReviews(item);
  const cats = getItemCategories(item);
  const synced = computeSyncedStatus(tracks);
  const syncedStatusClass = getStatusBadgeClass(synced.key);
  const hasRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
  const ratingText = hasRating ? `★ ${Number(item.rating).toFixed(1)}` : 'UNRATED';
  const repeatCount = Number(item.repeat_count) || 0;

  setElText('detail-modal-title', item.title);

  const heroVisualHtml = posterSlides.length > 1
    ? buildImageCarouselHtml(posterSlides, 'detail-gallery-carousel')
    : `<img class="detail-poster" src="${posterSlides[0]}" alt="${escapeHtml(item.title)}" onerror="this.src='${fallbackPoster}'">`;

  // Progress Section: Visual Progress Bar + Percentage + Status Pill
  const tracksHtml = tracks.map(t => {
    const hasTotal = t.total_units !== null && t.total_units > 0;
    const unitShort = UNIT_SHORT_LABELS[t.unit_label] || (t.unit_label || '').toUpperCase();
    const progStr = hasTotal ? `${t.progress} / ${t.total_units} ${unitShort}` : `${t.progress} ${unitShort}`;

    let pct = 0;
    if (hasTotal) {
      pct = Math.min(100, Math.max(0, Math.round((t.progress / t.total_units) * 100)));
    } else if (t.status === 'completed') {
      pct = 100;
    } else if (t.progress > 0) {
      pct = 45;
    }

    const statusBadgeClass = getStatusBadgeClass(t.status);
    const fillClass = `fill-${(t.status || 'planned').toLowerCase().trim()}`;

    return `
      <div class="detail-progress-card">
        <div class="detail-progress-top">
          <span class="detail-progress-cat">${escapeHtml(CATEGORY_LABELS[t.category] || t.category)}</span>
          <span class="detail-pill-badge ${statusBadgeClass}">${escapeHtml(t.status)}</span>
        </div>
        <div class="detail-progress-bar-track">
          <div class="detail-progress-bar-fill ${fillClass}" style="width: ${pct}%;"></div>
        </div>
        <div class="detail-progress-bottom">
          <span>${progStr}</span>
          <span class="detail-progress-percent">${hasTotal || t.status === 'completed' ? `${pct}%` : ''}</span>
        </div>
      </div>
    `;
  }).join('');

  // Review Section: Bright light-colored rating pill (no dark background)
  let epReviewsHtml = '';
  if (epReviews.length > 0) {
    epReviewsHtml = `
      <div>
        <div class="ep-graph-header">
          <div class="detail-section-title" style="margin-bottom: 0;">Review (${epReviews.length})</div>
        </div>
        <div class="ep-review-cards-list">
          ${epReviews.map((ep, idx) => {
            const partLabel = ep.number || `Part ${idx + 1}`;
            const hasScore = ep.rating !== null && !Number.isNaN(ep.rating);
            const scoreStr = hasScore ? `★ ${Number(ep.rating).toFixed(1)}` : '';

            return `
              <div class="ep-review-card">
                <div class="ep-review-main">
                  <span class="ep-review-title-label">${escapeHtml(partLabel)}</span>
                  ${hasScore ? `<span class="review-rating-pill">${scoreStr}</span>` : ''}
                </div>
                ${ep.note ? `<div class="ep-review-note">${escapeHtml(ep.note)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const editActionHtml = isAdminLoggedIn ? `
    <div class="modal-submit-row">
      <button type="button" class="form-btn primary-submit" onclick="closeMediaDetailModal(); openEditModal('${safeId}');">
        <ion-icon name="create-outline"></ion-icon>
        <span>Edit</span>
      </button>
    </div>
  ` : '';

  document.getElementById('media-detail-body').innerHTML = `
    <div class="detail-hero">
      ${heroVisualHtml}
      <div class="detail-meta-col">
        <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
          ${cats.map(c => `<span class="detail-pill-badge badge-cat">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('')}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
          <span class="detail-pill-badge ${syncedStatusClass}">${escapeHtml(synced.label)}</span>
          <span class="detail-pill-badge ${hasRating ? 'badge-rating' : 'badge-cat'}">${escapeHtml(ratingText)}</span>
          ${repeatCount > 0 ? `<span class="detail-pill-badge badge-cat">↻ ${repeatCount}X</span>` : ''}
        </div>
        <div style="font-size: 11px; color: var(--light-gray-70);">
          Updated ${formatStatusDate(item.updated_at || item.created_at)}
        </div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Progress</div>
      <div class="detail-progress-list">${tracksHtml}</div>
    </div>

    ${epReviewsHtml}
    ${editActionHtml}
  `;

  document.getElementById('media-detail-modal').classList.add('active');
};

window.closeMediaDetailModal = function () {
  document.getElementById('media-detail-modal').classList.remove('active');
};

// ==========================================
// 5. ADD / EDIT MEDIA MODAL (50:50 COVER & 50:50 REVIEW)
// ==========================================
window.addMediaImageRow = function (url = '') {
  const container = document.getElementById('media-gallery-editor');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'cover-split-row';
  row.innerHTML = `
    <input type="url" class="form-input media-gallery-url-input" placeholder="Cover URL" value="${escapeHtml(url)}">
    <div class="row-right-controls">
      <label class="equal-upload-btn" title="Upload">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        <span>Upload</span>
        <input type="file" accept="image/*" hidden onchange="handleSingleCoverRowUpload(event, this)">
      </label>
      <button type="button" class="social-remove-btn" onclick="removeMediaImageRow(this)" title="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.removeMediaImageRow = function (btn) {
  const container = document.getElementById('media-gallery-editor');
  const row = btn.closest('.cover-split-row');
  if (!row || !container) return;
  if (container.children.length <= 1) {
    const inp = row.querySelector('.media-gallery-url-input');
    if (inp) inp.value = '';
    return;
  }
  row.remove();
};

window.handleSingleCoverRowUpload = async function (event, fileInput) {
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  const row = fileInput.closest('.cover-split-row');
  const urlInput = row ? row.querySelector('.media-gallery-url-input') : null;

  setElText('cover-upload-status', 'Uploading...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'covers');
    if (urlInput) urlInput.value = publicUrl;
    setElText('cover-upload-status', 'Uploaded!');
    showToast('Cover uploaded', 'success');
  } catch (err) {
    setElText('cover-upload-status', `Failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

window.addMediaTrackRow = function (track = null) {
  const container = document.getElementById('media-tracks-editor');
  if (!container) return;

  const cat = (track && track.category) ? track.category : 'tv_show';
  const status = (track && track.status) ? track.status : 'completed';
  const progress = (track && track.progress !== undefined) ? track.progress : 0;
  const total = (track && track.total_units !== undefined) ? track.total_units : '';
  const unit = (track && track.unit_label) ? track.unit_label : (DEFAULT_UNITS_BY_CAT[cat] || 'eps');

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
      <button type="button" class="social-remove-btn" onclick="removeMediaTrackRow(this)" title="Remove">
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
        <input type="number" class="form-input track-progress-input" min="0" value="${progress}" placeholder="Count">
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
    showToast('At least 1 progress track is required', 'info');
    return;
  }
  const card = btn.closest('.track-edit-card');
  if (card) card.remove();
};

window.onTrackCategoryChange = function (selectEl) {
  const card = selectEl.closest('.track-edit-card');
  const unitSelect = card ? card.querySelector('.track-unit-select') : null;
  if (unitSelect && DEFAULT_UNITS_BY_CAT[selectEl.value]) {
    unitSelect.value = DEFAULT_UNITS_BY_CAT[selectEl.value];
  }
};

window.onTrackStatusOrTotalChange = function (el) {
  const card = el.closest('.track-edit-card');
  if (!card) return;
  const statusEl = card.querySelector('.track-status-select');
  const totalEl = card.querySelector('.track-total-input');
  const progInput = card.querySelector('.track-progress-input');

  const status = statusEl ? statusEl.value : '';
  const totalVal = totalEl ? parseInt(totalEl.value, 10) : NaN;

  if (status === 'completed' && totalVal > 0 && progInput) {
    progInput.value = totalVal;
  }
};

window.addEpisodeReviewRow = function (ep = null) {
  const container = document.getElementById('media-ep-reviews-editor');
  if (!container) return;

  const numVal = (ep && ep.number) ? ep.number : '';
  const ratingVal = (ep && ep.rating !== null && ep.rating !== undefined && ep.rating !== '') ? ep.rating : '';
  const noteVal = (ep && (ep.note || ep.title)) ? (ep.note || ep.title) : '';

  const row = document.createElement('div');
  row.className = 'review-split-row';
  row.innerHTML = `
    <div class="review-part-group">
      <input type="text" class="form-input ep-num-input" placeholder="Ch / Eps" value="${escapeHtml(numVal)}">
      <input type="number" class="form-input ep-rating-input" step="0.1" min="1.0" max="10.0" placeholder="Rating" value="${ratingVal}">
    </div>
    <div class="row-right-controls">
      <input type="text" class="form-input ep-note-input" placeholder="Notes" value="${escapeHtml(noteVal)}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.review-split-row').remove()" title="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
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

  const galleryEditor = document.getElementById('media-gallery-editor');
  if (galleryEditor) {
    galleryEditor.innerHTML = '';
    addMediaImageRow('');
  }

  const tracksEditor = document.getElementById('media-tracks-editor');
  if (tracksEditor) {
    tracksEditor.innerHTML = '';
    addMediaTrackRow({ category: 'tv_show', status: 'completed', progress: 0, total_units: '', unit_label: 'eps' });
  }

  const epEditor = document.getElementById('media-ep-reviews-editor');
  if (epEditor) {
    epEditor.innerHTML = '';
    addEpisodeReviewRow();
  }

  document.getElementById('media-modal').classList.add('active');
};

window.openEditModal = function (id) {
  const item = allMediaLogs.find(m => String(m.id) === String(id));
  if (!item) {
    showToast('Media entry not found', 'error');
    return;
  }

  pendingUploadedUrls = [];
  document.getElementById('media-modal-title').textContent = 'Edit Media';
  document.getElementById('media-id').value = item.id;
  document.getElementById('btn-modal-delete').style.display = 'inline-flex';

  document.getElementById('media-title').value = item.title || '';
  document.getElementById('media-rating').value = (item.rating !== null && item.rating !== undefined) ? item.rating : '';
  document.getElementById('media-repeat').value = Number(item.repeat_count) || 0;
  document.getElementById('api-search-results').style.display = 'none';
  setElText('cover-upload-status', '');

  const galleryEditor = document.getElementById('media-gallery-editor');
  if (galleryEditor) {
    galleryEditor.innerHTML = '';
    const gallery = getItemGalleryUrls(item);
    if (gallery.length > 0) {
      gallery.forEach(u => addMediaImageRow(u));
    } else {
      addMediaImageRow('');
    }
  }

  const tracksEditor = document.getElementById('media-tracks-editor');
  if (tracksEditor) {
    tracksEditor.innerHTML = '';
    const tracks = getItemTracks(item);
    tracks.forEach(t => addMediaTrackRow(t));
    const apiCatSelect = document.getElementById('api-search-cat');
    if (apiCatSelect && tracks[0]) apiCatSelect.value = tracks[0].category || 'tv_show';
  }

  const epEditor = document.getElementById('media-ep-reviews-editor');
  if (epEditor) {
    epEditor.innerHTML = '';
    const existingReviews = getItemEpisodeReviews(item);
    if (existingReviews.length > 0) {
      existingReviews.forEach(ep => addEpisodeReviewRow(ep));
    } else {
      addEpisodeReviewRow();
    }
  }

  document.getElementById('media-modal').classList.add('active');
};

window.closeMediaModal = async function () {
  document.getElementById('media-modal').classList.remove('active');
  await cleanupPendingUploads([]);
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
  const mediaList = (json.data && json.data.Page && json.data.Page.media) ? json.data.Page.media : [];
  return mediaList.map(m => {
    const originMap = { JP: 'Manga', KR: 'Manhwa', CN: 'Manhua' };
    const label = isNovel ? 'Novel' : (originMap[m.countryOfOrigin] || 'Comic');
    const coverImg = m.coverImage ? (m.coverImage.large || m.coverImage.medium || '') : '';
    return {
      title: m.title.english || m.title.romaji,
      cover: normalizeImageUrl(coverImg),
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
          cover: normalizeImageUrl((a.images && a.images.jpg && (a.images.jpg.large_image_url || a.images.jpg.image_url)) || ''),
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
          cover: normalizeImageUrl((entry.show.image && (entry.show.image.original || entry.show.image.medium)) || ''),
          total: null,
          unit: 'eps',
          meta: `TV Show · ${entry.show.premiered ? entry.show.premiered.slice(0, 4) : 'Show'}`
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
          meta: `TV Show · ${t.first_air_date ? t.first_air_date.slice(0, 4) : 'TMDB'}`
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
          cover: normalizeImageUrl((a.images && a.images.jpg && (a.images.jpg.large_image_url || a.images.jpg.image_url)) || ''),
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
          meta: `Movie · ${m.releaseDate ? m.releaseDate.slice(0, 4) : 'Film'}`
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
          meta: `Movie · ${m.release_date ? m.release_date.slice(0, 4) : 'TMDB'}`
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
            cover: normalizeImageUrl((m.images && m.images.jpg && (m.images.jpg.large_image_url || m.images.jpg.image_url)) || ''),
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
          cover: normalizeImageUrl((ln.images && ln.images.jpg && (ln.images.jpg.large_image_url || ln.images.jpg.image_url)) || ''),
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
            const title = (ent.labels && ent.labels.en && ent.labels.en.value) || c.label;
            const desc = (ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || 'Video Game';
            let cover = '';
            const p18 = ent.claims && ent.claims.P18 && ent.claims.P18[0] && ent.claims.P18[0].mainsnak && ent.claims.P18[0].mainsnak.datavalue && ent.claims.P18[0].mainsnak.datavalue.value;
            if (p18) cover = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=500`;
            const enWikiTitle = ent.sitelinks && ent.sitelinks.enwiki && ent.sitelinks.enwiki.title;
            if (!cover && enWikiTitle) {
              try {
                const wpRes = await fetchWithTimeout(
                  `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(enWikiTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`
                );
                const wpData = await wpRes.json();
                const pagesObj = (wpData.query && wpData.query.pages) ? wpData.query.pages : {};
                const pageObj = Object.values(pagesObj)[0];
                if (pageObj && pageObj.thumbnail && pageObj.thumbnail.source) cover = normalizeImageUrl(pageObj.thumbnail.source);
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
          cover: normalizeImageUrl(g.image ? g.image.url : ''),
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
          meta: `Game · ${g.released ? g.released.slice(0, 4) : ''}`
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
        meta: `Album · ${m.trackCount || '?'} Tracks · ${m.releaseDate ? m.releaseDate.slice(0, 4) : ''}`
      }));
      items = deduplicateResults(items);
    } catch (e) {
      console.error('Music search error:', e);
    }
  }

  lastApiResults = items;

  if (items.length === 0) {
    resultsBox.innerHTML = `<p style="padding: 12px; font-size: 12px; color: var(--light-gray-70);">No results found.</p>`;
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

  if (item.cover) {
    const existingInputs = Array.from(document.querySelectorAll('#media-gallery-editor .media-gallery-url-input'));
    const hasAnyCover = existingInputs.some(inp => inp.value.trim() !== '');
    if (!hasAnyCover) {
      if (existingInputs[0]) {
        existingInputs[0].value = item.cover;
      } else {
        addMediaImageRow(item.cover);
      }
    }
  }

  const trackCards = Array.from(document.querySelectorAll('#media-tracks-editor .track-edit-card'));
  let targetCard = trackCards.find(c => {
    const sel = c.querySelector('.track-cat-select');
    return sel && sel.value === searchedCat;
  }) || trackCards[0];

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
const mediaForm = document.getElementById('media-form');
if (mediaForm) {
  mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('media-id').value;
    const existingItem = id ? allMediaLogs.find(m => String(m.id) === String(id)) : null;
    const oldGallery = existingItem ? getItemGalleryUrls(existingItem) : [];

    const galleryInputs = document.querySelectorAll('#media-gallery-editor .media-gallery-url-input');
    const galleryUrls = [];
    galleryInputs.forEach(inp => {
      const clean = normalizeImageUrl(inp.value);
      if (clean && !galleryUrls.includes(clean)) {
        galleryUrls.push(clean);
      }
    });
    const newPrimaryCover = galleryUrls[0] || null;

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

    if (tracks.length === 0) {
      showToast('At least 1 progress track is required', 'error');
      return;
    }

    const epRows = document.querySelectorAll('#media-ep-reviews-editor .review-split-row');
    const episodeReviews = [];
    epRows.forEach(row => {
      const numStr = row.querySelector('.ep-num-input')?.value.trim() || '';
      const ratingRaw = row.querySelector('.ep-rating-input')?.value ?? '';
      const noteStr = row.querySelector('.ep-note-input')?.value.trim() || '';

      if (!numStr && ratingRaw === '' && !noteStr) return;

      episodeReviews.push({
        number: numStr,
        title: '',
        rating: ratingRaw !== '' ? parseFloat(ratingRaw) : null,
        note: noteStr
      });
    });

    const ratingRaw = document.getElementById('media-rating').value;
    const overallRating = ratingRaw !== '' ? parseFloat(ratingRaw) : null;
    const categories = Array.from(new Set(tracks.map(t => t.category)));
    const primaryTrack = tracks[0];
    const syncedStatus = computeSyncedStatus(tracks);
    const repeatVal = Math.max(0, parseInt(document.getElementById('media-repeat').value, 10) || 0);

    const payload = {
      title: document.getElementById('media-title').value.trim(),
      category: primaryTrack.category,
      categories,
      tracks,
      episode_reviews: episodeReviews,
      gallery_urls: galleryUrls,
      sub_category: null,
      cover_url: newPrimaryCover,
      status: syncedStatus.key,
      progress: primaryTrack.progress,
      total_units: primaryTrack.total_units,
      unit_label: primaryTrack.unit_label,
      rating: overallRating,
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
      await cleanupPendingUploads(galleryUrls);
      const keepSet = new Set(galleryUrls);
      for (const oldUrl of oldGallery) {
        if (!keepSet.has(oldUrl)) {
          await deleteOldStorageFile(oldUrl);
        }
      }
      document.getElementById('media-modal').classList.remove('active');
      await fetchMediaLogs();
      showToast(id ? 'Updated' : 'Saved', 'success');
    }
  });
}

window.deleteCurrentModalMedia = async function () {
  const id = document.getElementById('media-id').value;
  if (!id) return;

  const existingItem = allMediaLogs.find(m => String(m.id) === String(id));

  const confirm = await Swal.fire({
    text: 'Remove this entry from your library?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ffffff',
    confirmButtonText: '<span style="color:#111;">Delete</span>',
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
      if (existingItem) {
        const oldGallery = getItemGalleryUrls(existingItem);
        for (const u of oldGallery) {
          await deleteOldStorageFile(u);
        }
      }
      document.getElementById('media-modal').classList.remove('active');
      await fetchMediaLogs();
      showToast('Deleted', 'info');
    }
  }
};

// ==========================================
// 7. PERSONAL NOTES / POSTS + 50:50 IMAGE ROWS
// ==========================================
function getPostImageUrls(post) {
  const urls = [];
  if (Array.isArray(post.image_urls)) {
    post.image_urls.forEach(u => {
      const clean = normalizeImageUrl(u);
      if (clean && !urls.includes(clean)) urls.push(clean);
    });
  }
  const legacyImg = normalizeImageUrl(post.image_url);
  if (legacyImg && !urls.includes(legacyImg)) {
    urls.unshift(legacyImg);
  }
  return urls;
}

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
  div.textContent = text == null ? '' : String(text);
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
    if (listEl) listEl.innerHTML = `<p class="empty-state">Failed to load posts: ${escapeHtml(error.message)}</p>`;
    return;
  }

  allBlogPosts = data || [];
  renderBlogPosts();
}

function renderBlogPosts() {
  const listEl = document.getElementById('blog-feed-list');
  if (!listEl) return;

  const visiblePosts = allBlogPosts.filter(p => !p.is_private || isAdminLoggedIn);

  if (visiblePosts.length === 0) {
    listEl.innerHTML = `<p class="empty-state">No notes yet.</p>`;
    return;
  }

  const avatarSrc = normalizeImageUrl(currentProfile.avatar_url) || TRANSPARENT_PIXEL;
  const authorName = escapeHtml(currentProfile.name || '');

  listEl.innerHTML = visiblePosts.map(post => {
    const safePostId = escapeHtml(String(post.id));
    const postImages = getPostImageUrls(post);
    const timeLabel = formatPostDateTime(post.created_at, post.updated_at);
    const detectedUrl = extractFirstUrl(post.content);
    const linkPreviewHtml = detectedUrl ? buildLinkPreviewCard(detectedUrl) : '';

    const adminControls = isAdminLoggedIn ? `
      <div class="blog-post-actions">
        <button type="button" class="blog-icon-btn" onclick="openEditPostModal('${safePostId}')" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button type="button" class="blog-icon-btn" onclick="deleteBlogPost('${safePostId}')" title="Delete">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    ` : '';

    const imageSliderBlock = postImages.length > 0
      ? buildImageCarouselHtml(postImages, 'blog-post-carousel')
      : '';

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
        ${imageSliderBlock}
      </article>
    `;
  }).join('');
}

window.addPostImageRow = function (url = '') {
  const container = document.getElementById('post-images-editor');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'post-img-split-row';
  row.innerHTML = `
    <input type="url" class="form-input post-image-url-input" placeholder="Image URL" value="${escapeHtml(url)}">
    <div class="row-right-controls">
      <label class="equal-upload-btn" title="Upload">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        <span>Upload</span>
        <input type="file" accept="image/*" hidden onchange="handleSinglePostRowUpload(event, this)">
      </label>
      <button type="button" class="social-remove-btn" onclick="removePostImageRow(this)" title="Delete">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  `;
  container.appendChild(row);
};

window.removePostImageRow = function (btn) {
  const container = document.getElementById('post-images-editor');
  const row = btn.closest('.post-img-split-row');
  if (!row || !container) return;
  if (container.children.length <= 1) {
    const inp = row.querySelector('.post-image-url-input');
    if (inp) inp.value = '';
    return;
  }
  row.remove();
};

window.handleSinglePostRowUpload = async function (event, fileInput) {
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  const row = fileInput.closest('.post-img-split-row');
  const urlInput = row ? row.querySelector('.post-image-url-input') : null;

  setElText('post-upload-status', 'Uploading...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'posts');
    if (urlInput) urlInput.value = publicUrl;
    setElText('post-upload-status', 'Uploaded!');
    showToast('Uploaded', 'success');
  } catch (err) {
    setElText('post-upload-status', `Failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

window.openPostModal = function () {
  pendingUploadedUrls = [];
  document.getElementById('post-modal-title').textContent = 'New Post';
  document.getElementById('post-form').reset();
  document.getElementById('post-id').value = '';
  setElText('post-upload-status', '');

  const imgEditor = document.getElementById('post-images-editor');
  if (imgEditor) {
    imgEditor.innerHTML = '';
    addPostImageRow('');
  }

  document.getElementById('post-modal').classList.add('active');
};

window.openEditPostModal = function (id) {
  const post = allBlogPosts.find(p => String(p.id) === String(id));
  if (!post) return;

  pendingUploadedUrls = [];
  document.getElementById('post-modal-title').textContent = 'Edit Post';
  document.getElementById('post-id').value = post.id;
  document.getElementById('post-content').value = post.content || '';
  setElText('post-upload-status', '');

  const imgEditor = document.getElementById('post-images-editor');
  if (imgEditor) {
    imgEditor.innerHTML = '';
    const imgs = getPostImageUrls(post);
    if (imgs.length > 0) {
      imgs.forEach(u => addPostImageRow(u));
    } else {
      addPostImageRow('');
    }
  }

  document.getElementById('post-modal').classList.add('active');
};

window.closePostModal = async function () {
  document.getElementById('post-modal').classList.remove('active');
  await cleanupPendingUploads([]);
};

const postForm = document.getElementById('post-form');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('post-id').value;
    const existingPost = id ? allBlogPosts.find(p => String(p.id) === String(id)) : null;
    const oldImages = existingPost ? getPostImageUrls(existingPost) : [];

    const imgInputs = document.querySelectorAll('#post-images-editor .post-image-url-input');
    const imageUrls = [];
    imgInputs.forEach(inp => {
      const clean = normalizeImageUrl(inp.value);
      if (clean && !imageUrls.includes(clean)) {
        imageUrls.push(clean);
      }
    });

    const contentVal = document.getElementById('post-content').value.trim();
    if (!contentVal) return;

    const nowIso = new Date().toISOString();
    const payload = {
      content: contentVal,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      is_private: false,
      updated_at: nowIso
    };

    let res = id
      ? await supabaseClient.from('blog_posts').update(payload).eq('id', id)
      : await supabaseClient.from('blog_posts').insert([{ ...payload, created_at: nowIso }]);

    if (res.error && res.error.message && res.error.message.includes('is_private')) {
      delete payload.is_private;
      res = id
        ? await supabaseClient.from('blog_posts').update(payload).eq('id', id)
        : await supabaseClient.from('blog_posts').insert([{ ...payload, created_at: nowIso }]);
    }

    if (res.error) {
      showToast(res.error.message, 'error');
    } else {
      await cleanupPendingUploads(imageUrls);
      const keepSet = new Set(imageUrls);
      for (const oldImg of oldImages) {
        if (!keepSet.has(oldImg)) {
          await deleteOldStorageFile(oldImg);
        }
      }
      document.getElementById('post-modal').classList.remove('active');
      await fetchBlogPosts();
      showToast(id ? 'Updated' : 'Published', 'success');
    }
  });
}

window.deleteBlogPost = async function (id) {
  const existingPost = allBlogPosts.find(p => String(p.id) === String(id));

  const confirm = await Swal.fire({
    text: 'Delete this post permanently?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ffffff',
    confirmButtonText: '<span style="color:#111;">Delete</span>',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (confirm.isConfirmed) {
    const { error } = await supabaseClient.from('blog_posts').delete().eq('id', id);
    if (error) {
      showToast(error.message, 'error');
    } else {
      if (existingPost) {
        const oldImages = getPostImageUrls(existingPost);
        for (const u of oldImages) {
          await deleteOldStorageFile(u);
        }
      }
      await fetchBlogPosts();
      showToast('Deleted', 'info');
    }
  }
};
