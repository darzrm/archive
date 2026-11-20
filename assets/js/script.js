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

const GROQ_KEY_STORAGE = 'archive_groq_api_key';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let allMediaLogs = [];
let allBlogPosts = [];
let aiChatMessages = [];
let lastApiResults = [];
let pendingUploadedUrls = [];
let currentCategory = 'all';
let currentMainView = 'blog';
let libraryViewMode = 'grid';
let itemsPerPage = 8;
let visibleMediaLimit = 8;
let isStatsExpanded = false;
let isAdminLoggedIn = false;
let isProfileLoaded = false;
let isAiSending = false;

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
    setupAiListeners();
    updateSortUIControls();

    await checkAdminSession();
    await fetchProfileSettings();
    await Promise.all([fetchBlogPosts(), fetchMediaLogs()]);
    if (isAdminLoggedIn) {
      await fetchAiChatHistory();
    }
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
    ['sort-popover-menu', 'btn-sort-toggle'],
    ['pages-popover-menu', 'btn-pages-toggle']
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
    const pagesWrap = document.getElementById('page-popover-wrap');

    const insideFilter = filterWrap && filterWrap.contains(e.target);
    const insideSort = sortWrap && sortWrap.contains(e.target);
    const insidePages = pagesWrap && pagesWrap.contains(e.target);

    if (!insideFilter && !insideSort && !insidePages) {
      closeAllToolbarPopovers();
    }
  });
}

window.toggleToolbarPopover = function (type) {
  const map = {
    filter: ['filter-popover-menu', 'btn-filter-toggle'],
    sort: ['sort-popover-menu', 'btn-sort-toggle'],
    pages: ['pages-popover-menu', 'btn-pages-toggle']
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

window.scrollToTopSmooth = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.switchMainView = function (viewName) {
  if (viewName === 'library' && currentProfile.is_library_private && !isAdminLoggedIn) {
    viewName = 'blog';
  }
  if (viewName === 'ai' && !isAdminLoggedIn) {
    viewName = 'blog';
  }

  currentMainView = viewName;

  document.querySelectorAll('.main-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.mini-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const libView = document.getElementById('view-library');
  const blogView = document.getElementById('view-blog');
  const aiView = document.getElementById('view-ai');

  [libView, blogView, aiView].forEach(v => {
    if (v) {
      v.classList.remove('active-view');
      v.style.display = 'none';
    }
  });

  const targetView = viewName === 'library' ? libView : (viewName === 'ai' ? aiView : blogView);
  if (targetView) {
    targetView.style.display = 'block';
    void targetView.offsetWidth;
    targetView.classList.add('active-view');
  }

  if (viewName === 'ai') {
    updateAiContextCounters();
    scrollAiToBottom();
  }

  updateAdminActionButtons();
};

function updateLibraryTabVisibility() {
  const isPrivate = Boolean(currentProfile.is_library_private);
  const canViewLibrary = !isPrivate || isAdminLoggedIn;

  const mainLibBtn = document.getElementById('main-tab-library');
  const miniLibBtn = document.getElementById('mini-tab-library');
  const lockBadge = document.getElementById('library-private-lock');

  if (mainLibBtn) mainLibBtn.style.display = canViewLibrary ? 'inline-flex' : 'none';
  if (miniLibBtn) miniLibBtn.style.display = canViewLibrary ? 'inline-flex' : 'none';
  if (lockBadge) lockBadge.style.display = (isPrivate && isAdminLoggedIn) ? 'inline-block' : 'none';

  if (!canViewLibrary && currentMainView === 'library') {
    switchMainView('blog');
  }
}

window.toggleLibraryPrivacy = async function () {
  if (!isAdminLoggedIn) return;

  const nextState = !currentProfile.is_library_private;
  const { error } = await supabaseClient
    .from('profile_settings')
    .upsert([{
      id: 1,
      name: currentProfile.name,
      bio: currentProfile.bio,
      avatar_url: currentProfile.avatar_url,
      banner_url: currentProfile.banner_url,
      social_links: currentProfile.social_links,
      is_library_private: nextState,
      updated_at: new Date().toISOString()
    }]);

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  currentProfile.is_library_private = nextState;
  updateLibraryTabVisibility();
  updateAdminActionButtons();
  showToast(nextState ? 'Library set to Private' : 'Library set to Public', 'info');
};

window.setLibraryViewMode = function (mode) {
  libraryViewMode = mode;
  const gridBtn = document.getElementById('btn-view-grid');
  const listBtn = document.getElementById('btn-view-list');
  if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
  if (listBtn) listBtn.classList.toggle('active', mode === 'list');
  renderMediaGrid();
};

window.selectItemsPerPage = function (val) {
  if (val === 'all') {
    itemsPerPage = Infinity;
    visibleMediaLimit = Infinity;
  } else {
    itemsPerPage = parseInt(val, 10) || 8;
    visibleMediaLimit = itemsPerPage;
  }

  document.querySelectorAll('#pages-popover-menu .page-option-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.limit === String(val));
  });

  closeAllToolbarPopovers();
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
  const addMediaBtn = document.getElementById('btn-add-media');
  const addPostBtn = document.getElementById('btn-add-post');
  const privacyBtn = document.getElementById('btn-toggle-library-privacy');
  const privacyIcon = document.getElementById('library-privacy-icon');
  const privacyText = document.getElementById('library-privacy-text');

  if (!isAdminLoggedIn) {
    if (addMediaBtn) addMediaBtn.style.display = 'none';
    if (addPostBtn) addPostBtn.style.display = 'none';
    if (privacyBtn) privacyBtn.style.display = 'none';
    return;
  }

  const inLibrary = currentMainView === 'library';

  if (privacyBtn) {
    privacyBtn.style.display = inLibrary ? 'inline-flex' : 'none';
    const isPriv = Boolean(currentProfile.is_library_private);
    if (privacyIcon) privacyIcon.setAttribute('name', isPriv ? 'eye-off-outline' : 'eye-outline');
    if (privacyText) privacyText.textContent = isPriv ? 'Private' : 'Public';
  }

  if (addMediaBtn) addMediaBtn.style.display = inLibrary ? 'inline-flex' : 'none';
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
  const mainAiBtn = document.getElementById('main-tab-ai');
  const miniAiBtn = document.getElementById('mini-tab-ai');

  if (isAdminLoggedIn) {
    if (editProfileBtn) editProfileBtn.style.display = 'inline-flex';
    if (lockIcon) lockIcon.setAttribute('name', 'log-out-outline');
    if (btnText) btnText.textContent = 'Logout';
    if (mainAiBtn) mainAiBtn.style.display = 'inline-flex';
    if (miniAiBtn) miniAiBtn.style.display = 'inline-flex';
  } else {
    if (editProfileBtn) editProfileBtn.style.display = 'none';
    if (lockIcon) lockIcon.setAttribute('name', 'lock-closed-outline');
    if (btnText) btnText.textContent = 'Admin';
    if (mainAiBtn) mainAiBtn.style.display = 'none';
    if (miniAiBtn) miniAiBtn.style.display = 'none';
    if (currentMainView === 'ai') switchMainView('blog');
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
      aiChatMessages = [];
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
      await fetchAiChatHistory();
      showToast('Admin login successful', 'success');
    }
  });
}

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
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('banner-upload-status', 'Uploading banner...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'banners');
    document.getElementById('edit-profile-banner').value = publicUrl;
    setElText('banner-upload-status', 'Banner uploaded! Click Save Profile.');
    showToast('Banner uploaded', 'success');
  } catch (err) {
    setElText('banner-upload-status', `Upload failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('profile-upload-status', 'Uploading avatar...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'avatars');
    document.getElementById('edit-profile-avatar').value = publicUrl;
    setElText('profile-upload-status', 'Avatar uploaded! Click Save Profile.');
    showToast('Avatar uploaded', 'success');
  } catch (err) {
    setElText('profile-upload-status', `Upload failed: ${err.message}`);
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
      is_library_private: Boolean(currentProfile.is_library_private),
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
}

// ==========================================
// 3. MULTI-CATEGORY, ADDITIONAL ENTRIES & SMART STATUS HELPERS
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
  eps: 'Eps',
  ch: 'Ch',
  movie: 'Movie',
  vol: 'Vol',
  pages: 'Pages',
  track: 'Track',
  item: 'Item'
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

function getItemSeasons(item) {
  if (!Array.isArray(item.seasons)) return [];
  const fallbackCat = getLegacyCategory(item);
  return item.seasons.map(s => {
    const unit = s.unit_label || 'eps';
    const inferredCat = s.category || (unit === 'movie' ? 'movie' : (unit === 'ch' ? 'comic' : (unit === 'vol' || unit === 'pages' ? 'novel' : (unit === 'track' ? 'music' : fallbackCat))));
    return {
      name: s.name || '',
      category: inferredCat,
      status: (s.status || 'planned').toLowerCase().trim(),
      progress: Number(s.progress) || 0,
      total_units: (s.total_units !== null && s.total_units !== undefined && s.total_units !== '') ? Number(s.total_units) : null,
      unit_label: unit
    };
  });
}

function getAllItemUnits(item) {
  return [...getItemTracks(item), ...getItemSeasons(item)];
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

function computeCombinedProgress(unitsList, syncedStatusKey) {
  const totalProgress = unitsList.reduce((sum, t) => sum + (Number(t.progress) || 0), 0);
  const allHaveTotal = unitsList.every(t => t.total_units !== null && Number(t.total_units) > 0);
  const totalUnits = allHaveTotal
    ? unitsList.reduce((sum, t) => sum + Number(t.total_units), 0)
    : null;

  const text = totalUnits !== null ? `${totalProgress}/${totalUnits}` : `${totalProgress}/?`;

  let percent = 0;
  if (syncedStatusKey === 'completed') {
    percent = 100;
  } else if (totalUnits !== null && totalUnits > 0) {
    percent = Math.min(100, Math.max(0, Math.round((totalProgress / totalUnits) * 100)));
  } else if (syncedStatusKey === 'planned') {
    percent = 100;
  } else {
    percent = totalProgress > 0 ? 45 : 0;
  }

  return {
    text,
    percent,
    isPlannedEmpty: syncedStatusKey === 'planned' && totalProgress === 0
  };
}

function formatEntryBadgeLabel(extraPartsCount) {
  const totalEntries = extraPartsCount + 1;
  return totalEntries === 1 ? '1 Entry' : `${totalEntries} Entries`;
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
  updateAiContextCounters();
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
// 4. FILTER (CUSTOM RANGES), SORT (2-WAY), PAGINATION & RENDER MEDIA
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
  document.querySelectorAll('#view-library .cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-library .cat-tab').forEach(b => b.classList.remove('active'));
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
    const seasons = getItemSeasons(item);
    const synced = computeSyncedStatus(allUnits);

    const matchCat = currentCategory === 'all' || cats.includes(currentCategory);
    const matchStatus = statusFilter === 'all' || synced.key === statusFilter || allUnits.some(t => t.status === statusFilter);
    const matchRange = matchesCustomFilters(item);
    const matchTitle = (item.title || '').toLowerCase().includes(query);
    const matchSeason = seasons.some(s => (s.name || '').toLowerCase().includes(query));
    const matchQuery = !query || matchTitle || matchSeason;

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

  if (libraryViewMode === 'list') {
    grid.innerHTML = displayedItems.map(item => {
      const safeId = escapeHtml(String(item.id));
      const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/120x180/1e1e1f/888888?text=?';
      const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
      const allUnits = getAllItemUnits(item);
      const cats = getItemCategories(item);
      const seasons = getItemSeasons(item);
      const synced = computeSyncedStatus(allUnits);
      const combined = computeCombinedProgress(allUnits, synced.key);
      const repeatCount = Number(item.repeat_count) || 0;
      const statusDateText = formatStatusDate(item.updated_at || item.created_at);

      const catLabels = cats.map(c => CATEGORY_LABELS[c] || c).join(' / ');
      const seasonTag = seasons.length > 0 ? `<span>• ${formatEntryBadgeLabel(seasons.length)}</span>` : '';
      const repeatHtml = repeatCount > 0 ? `<span class="list-repeat-tag">• ↻ ${repeatCount}x</span>` : '';

      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openEditModal('${safeId}')" title="Edit Entry">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      return `
        <div class="media-list-row" onclick="openMediaDetailModal('${safeId}')">
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
            <span class="progress-pill ${synced.key}">${combined.text}</span>
            <span class="list-rating-pill">${ratingText}</span>
            ${editBtnHtml}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  grid.innerHTML = displayedItems.map(item => {
    const safeId = escapeHtml(String(item.id));
    const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
    const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : '—';
    const repeatCount = Number(item.repeat_count) || 0;
    const allUnits = getAllItemUnits(item);
    const cats = getItemCategories(item);
    const seasons = getItemSeasons(item);
    const synced = computeSyncedStatus(allUnits);
    const combined = computeCombinedProgress(allUnits, synced.key);

    const catBadgesHtml = cats.map(c => `<span class="badge-cat">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('');
    const extraBarClass = combined.isPlannedEmpty ? 'planned-empty' : '';
    const statusDateText = formatStatusDate(item.updated_at || item.created_at);

    const repeatBadgeHtml = repeatCount > 0
      ? `<span class="badge-repeat" title="Rewatch / Reread count">↻ ${repeatCount}x</span>`
      : '';

    const seasonsBadgeHtml = seasons.length > 0
      ? `<span class="badge-seasons">${formatEntryBadgeLabel(seasons.length)}</span>`
      : '';

    const coverEditHtml = isAdminLoggedIn ? `
      <button type="button" class="cover-edit-btn" onclick="event.stopPropagation(); openEditModal('${safeId}')" title="Edit Entry">
        <ion-icon name="create-outline"></ion-icon>
      </button>
    ` : '';

    return `
      <div class="media-card" onclick="openMediaDetailModal('${safeId}')">
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
              <span class="progress-pill ${synced.key}">${combined.text}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${synced.key} ${extraBarClass}" style="width: ${combined.percent}%"></div>
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
// 4B. MEDIA DETAIL MODAL
// ==========================================
window.openMediaDetailModal = function (id) {
  const item = allMediaLogs.find(m => String(m.id) === String(id));
  if (!item) return;

  const safeId = escapeHtml(String(item.id));
  const cover = normalizeImageUrl(item.cover_url) || 'https://placehold.co/300x450/1e1e1f/888888?text=No+Cover';
  const tracks = getItemTracks(item);
  const seasons = getItemSeasons(item);
  const allUnits = [...tracks, ...seasons];
  const cats = getItemCategories(item);
  const synced = computeSyncedStatus(allUnits);
  const ratingText = (item.rating !== null && item.rating !== undefined) ? `★ ${Number(item.rating).toFixed(1)}` : 'Unrated';
  const repeatCount = Number(item.repeat_count) || 0;

  setElText('detail-modal-title', item.title);

  const tracksHtml = tracks.map(t => {
    const hasTotal = t.total_units !== null && t.total_units > 0;
    const unitShort = UNIT_SHORT_LABELS[t.unit_label] || t.unit_label || '';
    const progStr = hasTotal ? `${t.progress} / ${t.total_units} ${unitShort}` : `${t.progress} / ? ${unitShort}`;
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
      <div class="detail-section-title">Entries & Parts (${seasons.length + 1} Total)</div>
      <div class="detail-list">
        ${seasons.map(s => {
          const sStatus = (s.status || 'planned').toLowerCase().trim();
          const sCatLabel = CATEGORY_LABELS[s.category] || s.category || 'TV Show';
          const sUnit = UNIT_SHORT_LABELS[s.unit_label] || s.unit_label || 'Eps';
          const sProg = (s.total_units && Number(s.total_units) > 0)
            ? `${s.progress || 0}/${s.total_units} ${sUnit}`
            : `${s.progress || 0}/? ${sUnit}`;
          const sRating = (item.rating !== null && item.rating !== undefined)
            ? ` · ★ ${Number(item.rating).toFixed(1)}`
            : '';
          return `
            <div class="detail-row-item">
              <div style="min-width: 0;">
                <div style="font-weight: 600; color: var(--white-1);">${escapeHtml(s.name || 'Part')}</div>
                <div style="font-size: 11px; color: var(--light-gray-70);">${escapeHtml(sCatLabel)} · ${sProg}${sRating}</div>
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
      <button type="button" class="form-btn primary-submit" onclick="closeMediaDetailModal(); openEditModal('${safeId}');">
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
// 5. ADD / EDIT MODAL
// ==========================================
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
        <input type="number" class="form-input track-progress-input" min="0" value="${progress}" placeholder="Count">
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

window.stepTrackProgress = function (btn) {
  const card = btn.closest('.track-edit-card');
  if (!card) return;
  const progInput = card.querySelector('.track-progress-input');
  const totalEl = card.querySelector('.track-total-input');
  const statusSelect = card.querySelector('.track-status-select');

  if (!progInput) return;
  const totalVal = totalEl ? parseInt(totalEl.value, 10) : NaN;
  const nextVal = (parseInt(progInput.value, 10) || 0) + 1;
  progInput.value = nextVal;

  if (totalVal > 0 && nextVal >= totalVal && statusSelect) {
    statusSelect.value = 'completed';
  }
};

window.addSeasonItemRow = function (season = null) {
  const container = document.getElementById('media-seasons-editor');
  if (!container) return;

  const firstTrackCat = document.querySelector('#media-tracks-editor .track-cat-select')?.value || 'tv_show';
  const name = (season && season.name) ? season.name : '';
  const cat = (season && season.category) ? season.category : firstTrackCat;
  const status = (season && season.status) ? season.status : 'completed';
  const progress = (season && season.progress !== undefined) ? season.progress : 0;
  const total = (season && season.total_units !== undefined && season.total_units !== null) ? season.total_units : '';
  const unit = (season && season.unit_label) ? season.unit_label : (DEFAULT_UNITS_BY_CAT[cat] || 'eps');

  const card = document.createElement('div');
  card.className = 'season-edit-card';
  card.innerHTML = `
    <div class="season-edit-top">
      <select class="form-input season-cat-select" style="max-width: 118px;" onchange="onSeasonCategoryChange(this)">
        <option value="tv_show" ${cat === 'tv_show' ? 'selected' : ''}>TV Show</option>
        <option value="movie" ${cat === 'movie' ? 'selected' : ''}>Movie</option>
        <option value="comic" ${cat === 'comic' ? 'selected' : ''}>Comic</option>
        <option value="novel" ${cat === 'novel' ? 'selected' : ''}>Novel</option>
        <option value="game" ${cat === 'game' ? 'selected' : ''}>Game</option>
        <option value="music" ${cat === 'music' ? 'selected' : ''}>Music</option>
      </select>
      <input type="text" class="form-input season-name-input" placeholder="e.g. OVA / Season 2 / Special" value="${escapeHtml(name)}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.season-edit-card').remove()" title="Remove Entry">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="season-edit-grid">
      <select class="form-input season-status-select" onchange="onSeasonStatusOrTotalChange(this)">
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <div class="progress-input-row">
        <input type="number" class="form-input season-progress-input" min="0" value="${progress}" placeholder="Count">
        <button type="button" class="step-plus-btn" onclick="stepSeasonProgress(this)" title="+1">+1</button>
      </div>
      <input type="number" class="form-input season-total-input" min="0" value="${total}" placeholder="Total" oninput="onSeasonStatusOrTotalChange(this)">
      <select class="form-input season-unit-select">
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

window.onSeasonCategoryChange = function (selectEl) {
  const card = selectEl.closest('.season-edit-card');
  const unitSelect = card ? card.querySelector('.season-unit-select') : null;
  if (unitSelect && DEFAULT_UNITS_BY_CAT[selectEl.value]) {
    unitSelect.value = DEFAULT_UNITS_BY_CAT[selectEl.value];
  }
};

window.onSeasonStatusOrTotalChange = function (el) {
  const card = el.closest('.season-edit-card');
  if (!card) return;
  const statusEl = card.querySelector('.season-status-select');
  const totalEl = card.querySelector('.season-total-input');
  const progInput = card.querySelector('.season-progress-input');

  const status = statusEl ? statusEl.value : '';
  const totalVal = totalEl ? parseInt(totalEl.value, 10) : NaN;

  if (status === 'completed' && totalVal > 0 && progInput) {
    progInput.value = totalVal;
  }
};

window.stepSeasonProgress = function (btn) {
  const card = btn.closest('.season-edit-card');
  if (!card) return;
  const progInput = card.querySelector('.season-progress-input');
  const totalEl = card.querySelector('.season-total-input');
  const statusSelect = card.querySelector('.season-status-select');

  if (!progInput) return;
  const totalVal = totalEl ? parseInt(totalEl.value, 10) : NaN;
  const nextVal = (parseInt(progInput.value, 10) || 0) + 1;
  progInput.value = nextVal;

  if (totalVal > 0 && nextVal >= totalVal && statusSelect) {
    statusSelect.value = 'completed';
  }
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
    const apiCatSelect = document.getElementById('api-search-cat');
    if (apiCatSelect && tracks[0]) apiCatSelect.value = tracks[0].category || 'tv_show';
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
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('cover-upload-status', 'Uploading cover...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'covers');
    document.getElementById('media-cover').value = publicUrl;
    setElText('cover-upload-status', 'Cover uploaded successfully!');
    showToast('Cover uploaded', 'success');
  } catch (err) {
    setElText('cover-upload-status', `Upload failed: ${err.message}`);
    showToast(err.message, 'error');
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
    const oldCover = existingItem ? existingItem.cover_url : null;
    const newCover = normalizeImageUrl(document.getElementById('media-cover').value) || null;

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
      showToast('Please add at least 1 category track', 'error');
      return;
    }

    const ratingRaw = document.getElementById('media-rating').value;
    const inheritedRating = ratingRaw !== '' ? parseFloat(ratingRaw) : null;

    const seasonCards = document.querySelectorAll('#media-seasons-editor .season-edit-card');
    const seasons = [];
    seasonCards.forEach(card => {
      const name = card.querySelector('.season-name-input').value.trim();
      if (!name) return;
      const cat = card.querySelector('.season-cat-select')?.value || tracks[0].category;
      const status = card.querySelector('.season-status-select').value;
      const totalRaw = card.querySelector('.season-total-input').value;
      const totalUnits = totalRaw ? parseInt(totalRaw, 10) : null;
      let progressVal = parseInt(card.querySelector('.season-progress-input').value, 10) || 0;
      const unitLabel = card.querySelector('.season-unit-select')?.value || 'eps';

      if (status === 'completed' && totalUnits && totalUnits > 0) {
        progressVal = totalUnits;
      }

      seasons.push({
        name,
        category: cat,
        status,
        progress: progressVal,
        total_units: totalUnits,
        unit_label: unitLabel,
        rating: inheritedRating
      });
    });

    const allCombinedUnits = [...tracks, ...seasons];
    const categories = Array.from(new Set(allCombinedUnits.map(t => t.category)));
    const primaryTrack = tracks[0];
    const syncedStatus = computeSyncedStatus(allCombinedUnits);
    const repeatVal = Math.max(0, parseInt(document.getElementById('media-repeat').value, 10) || 0);

    const payload = {
      title: document.getElementById('media-title').value.trim(),
      category: primaryTrack.category,
      categories,
      tracks,
      seasons,
      sub_category: null,
      cover_url: newCover,
      status: syncedStatus.key,
      progress: primaryTrack.progress,
      total_units: primaryTrack.total_units,
      unit_label: primaryTrack.unit_label,
      rating: inheritedRating,
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
}

window.deleteCurrentModalMedia = async function () {
  const id = document.getElementById('media-id').value;
  if (!id) return;

  const existingItem = allMediaLogs.find(m => String(m.id) === String(id));

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
      if (existingItem && existingItem.cover_url) {
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
  updateAiContextCounters();
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
    const safePostId = escapeHtml(String(post.id));
    const postImg = normalizeImageUrl(post.image_url);
    const timeLabel = formatPostDateTime(post.created_at, post.updated_at);
    const detectedUrl = extractFirstUrl(post.content);
    const linkPreviewHtml = detectedUrl ? buildLinkPreviewCard(detectedUrl) : '';

    const adminControls = isAdminLoggedIn ? `
      <div class="blog-post-actions">
        <button type="button" class="blog-icon-btn" onclick="openEditPostModal('${safePostId}')" title="Edit Post">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button type="button" class="blog-icon-btn delete" onclick="deleteBlogPost('${safePostId}')" title="Delete Post">
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
  const post = allBlogPosts.find(p => String(p.id) === String(id));
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
  const file = event.target.files ? event.target.files[0] : null;
  event.target.value = '';
  if (!file) return;

  setElText('post-upload-status', 'Uploading photo...');
  try {
    const publicUrl = await uploadImageToSupabase(file, 'posts');
    document.getElementById('post-image').value = publicUrl;
    setElText('post-upload-status', 'Photo uploaded!');
    showToast('Photo uploaded', 'success');
  } catch (err) {
    setElText('post-upload-status', `Upload failed: ${err.message}`);
    showToast(err.message, 'error');
  }
};

const postForm = document.getElementById('post-form');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('post-id').value;
    const existingPost = id ? allBlogPosts.find(p => String(p.id) === String(id)) : null;
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
}

window.deleteBlogPost = async function (id) {
  const existingPost = allBlogPosts.find(p => String(p.id) === String(id));

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
      if (existingPost && existingPost.image_url) {
        await deleteOldStorageFile(existingPost.image_url);
      }
      await fetchBlogPosts();
      showToast('Post deleted', 'info');
    }
  }
};

// ==========================================
// 8. ADMIN GROQ AI ASSISTANT (ARCHIVE CONTEXT + SUPABASE HISTORY)
// ==========================================
function setupAiListeners() {
  const savedKey = localStorage.getItem(GROQ_KEY_STORAGE) || '';
  const keyInput = document.getElementById('groq-api-key-input');
  if (keyInput && savedKey) {
    keyInput.value = savedKey;
  }

  const aiForm = document.getElementById('ai-chat-form');
  const promptInput = document.getElementById('ai-prompt-input');

  if (promptInput) {
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (aiForm && !isAiSending) {
          aiForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  }

  if (aiForm) {
    aiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isAiSending) return;
      const text = promptInput ? promptInput.value.trim() : '';
      if (!text) return;

      if (promptInput) {
        promptInput.value = '';
        promptInput.style.height = 'auto';
      }
      await sendAiMessage(text);
    });
  }
}

window.toggleAiSettingsBox = function () {
  const panel = document.getElementById('ai-settings-panel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'flex' : 'none';
};

window.saveGroqApiKey = function () {
  const keyInput = document.getElementById('groq-api-key-input');
  const val = keyInput ? keyInput.value.trim() : '';
  if (!val) {
    localStorage.removeItem(GROQ_KEY_STORAGE);
    showToast('Groq API Key removed', 'info');
    return;
  }
  localStorage.setItem(GROQ_KEY_STORAGE, val);
  const panel = document.getElementById('ai-settings-panel');
  if (panel) panel.style.display = 'none';
  showToast('Groq API Key saved', 'success');
};

function updateAiContextCounters() {
  setElText('ai-ctx-library-count', `${allMediaLogs.length} Library entries`);
  setElText('ai-ctx-notes-count', `${allBlogPosts.length} Personal notes`);
}

function buildArchiveSystemContext() {
  const includeCtx = document.getElementById('ai-include-context')?.checked ?? true;
  const ownerName = currentProfile.name || 'Admin';

  let basePrompt = `Kamu adalah asisten AI pribadi yang cerdas, ramah, dan membantu milik ${ownerName}. Kamu bebas menjawab pertanyaan apa saja (coding, ide tulisan, diskusi umum, terjemahan, rekomendasi, dll). Jawab dengan bahasa yang sesuai dengan pertanyaan pengguna (default Bahasa Indonesia yang natural dan ringkas).`;

  if (!includeCtx) return basePrompt;

  const librarySummary = allMediaLogs.slice(0, 60).map(item => {
    const cats = getItemCategories(item).map(c => CATEGORY_LABELS[c] || c).join('/');
    const units = getAllItemUnits(item);
    const synced = computeSyncedStatus(units);
    const prog = computeCombinedProgress(units, synced.key);
    const ratingStr = (item.rating !== null && item.rating !== undefined) ? `Rating: ${item.rating}/10` : 'Unrated';
    return `- ${item.title} [${cats}] | Status: ${synced.label} (${prog.text}) | ${ratingStr}`;
  }).join('\n');

  const notesSummary = allBlogPosts.slice(0, 20).map(post => {
    const dateStr = formatStatusDate(post.created_at);
    const cleanText = (post.content || '').replace(/\s+/g, ' ').slice(0, 240);
    return `- (${dateStr}): ${cleanText}`;
  }).join('\n');

  return `${basePrompt}

Berikut adalah data arsip pribadi milik ${ownerName} sebagai konteks jika ditanyakan atau relevan:

=== LIBRARY (${allMediaLogs.length} total entri, menampilkan hingga 60 terbaru) ===
${librarySummary || '(Belum ada entri di Library)'}

=== PERSONAL NOTES (${allBlogPosts.length} total catatan, menampilkan hingga 20 terbaru) ===
${notesSummary || '(Belum ada catatan di Notes)'}`;
}

function formatAiMarkdown(raw) {
  let html = escapeHtml(raw || '');

  // Code blocks ```...```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function scrollAiToBottom() {
  const listEl = document.getElementById('ai-messages-list');
  if (listEl) {
    listEl.scrollTop = listEl.scrollHeight;
  }
}

async function fetchAiChatHistory() {
  if (!isAdminLoggedIn) return;

  const { data, error } = await supabaseClient
    .from('ai_chat_history')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.warn('AI history load warning:', error.message);
    renderAiMessages();
    return;
  }

  aiChatMessages = data || [];
  renderAiMessages();
}

function renderAiMessages(showTyping = false) {
  const listEl = document.getElementById('ai-messages-list');
  if (!listEl) return;

  if (aiChatMessages.length === 0 && !showTyping) {
    listEl.innerHTML = `
      <div class="ai-empty-welcome">
        <ion-icon name="sparkles-outline"></ion-icon>
        <h4>Halo, ${escapeHtml(currentProfile.name || 'Admin')}!</h4>
        <p>Tanyakan apa saja secara bebas, atau minta bantuan analisis & rekomendasi dari <strong>${allMediaLogs.length} Library</strong> dan <strong>${allBlogPosts.length} Notes</strong> milikmu.</p>
      </div>
    `;
    return;
  }

  const bubblesHtml = aiChatMessages.map((msg, idx) => {
    const isUser = msg.role === 'user';
    const timeStr = msg.created_at
      ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    const saveToNoteHtml = !isUser ? `
      <button type="button" class="ai-save-note-btn" onclick="saveAiReplyToNotes(${idx})" title="Simpan ke tab Notes">
        <ion-icon name="bookmark-outline"></ion-icon>
        <span>Save to Notes</span>
      </button>
    ` : '';

    return `
      <div class="ai-msg-row ${isUser ? 'user' : 'model'}">
        <div class="ai-msg-bubble">
          ${isUser ? escapeHtml(msg.content).replace(/\n/g, '<br>') : formatAiMarkdown(msg.content)}
        </div>
        <div class="ai-msg-footer">
          <span>${timeStr}</span>
          ${saveToNoteHtml}
        </div>
      </div>
    `;
  }).join('');

  const typingHtml = showTyping ? `
    <div class="ai-msg-row model">
      <div class="ai-msg-bubble">
        <div class="ai-typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
  ` : '';

  listEl.innerHTML = bubblesHtml + typingHtml;
  scrollAiToBottom();
}

window.sendQuickAiPrompt = function (promptText) {
  if (isAiSending) return;
  sendAiMessage(promptText);
};

async function sendAiMessage(userText) {
  if (!isAdminLoggedIn) return;

  const apiKey = (localStorage.getItem(GROQ_KEY_STORAGE) || '').trim();
  if (!apiKey) {
    const panel = document.getElementById('ai-settings-panel');
    if (panel) panel.style.display = 'flex';
    showToast('Masukkan Groq API Key terlebih dahulu', 'info');
    return;
  }

  isAiSending = true;
  const sendBtn = document.getElementById('btn-send-ai');
  if (sendBtn) sendBtn.disabled = true;

  const nowIso = new Date().toISOString();
  const userMsg = { role: 'user', content: userText, created_at: nowIso };
  aiChatMessages.push(userMsg);
  renderAiMessages(true);

  await supabaseClient.from('ai_chat_history').insert([{
    role: 'user',
    content: userText,
    created_at: nowIso
  }]);

  try {
    const recentHistory = aiChatMessages.slice(-16).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: buildArchiveSystemContext() },
          ...recentHistory
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = (data && data.error && data.error.message) ? data.error.message : 'Gagal menghubungi Groq API';
      throw new Error(errMsg);
    }

    const aiReplyText = data?.choices?.[0]?.message?.content || 'Tidak ada respons dari AI.';
    const replyIso = new Date().toISOString();

    aiChatMessages.push({
      role: 'model',
      content: aiReplyText,
      created_at: replyIso
    });

    await supabaseClient.from('ai_chat_history').insert([{
      role: 'model',
      content: aiReplyText,
      created_at: replyIso
    }]);

  } catch (err) {
    console.error('Groq API Error:', err);
    showToast(err.message, 'error', 4000);
    aiChatMessages.push({
      role: 'model',
      content: `⚠️ Error: ${err.message}`,
      created_at: new Date().toISOString()
    });
  } finally {
    isAiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderAiMessages(false);
  }
}

window.saveAiReplyToNotes = async function (msgIndex) {
  const msg = aiChatMessages[msgIndex];
  if (!msg || !msg.content) return;

  const confirm = await Swal.fire({
    text: 'Simpan balasan AI ini sebagai postingan baru di Notes?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Save to Notes',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (!confirm.isConfirmed) return;

  const nowIso = new Date().toISOString();
  const { error } = await supabaseClient.from('blog_posts').insert([{
    content: msg.content,
    image_url: null,
    created_at: nowIso,
    updated_at: nowIso
  }]);

  if (error) {
    showToast(error.message, 'error');
  } else {
    await fetchBlogPosts();
    showToast('Saved to Notes!', 'success');
  }
};

window.clearAiChatHistory = async function () {
  if (!isAdminLoggedIn) return;

  const confirm = await Swal.fire({
    text: 'Hapus seluruh riwayat chat AI secara permanen?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Hapus Riwayat',
    cancelButtonText: 'Batal',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabaseClient
    .from('ai_chat_history')
    .delete()
    .not('id', 'is', null);

  if (error) {
    showToast(error.message, 'error');
  } else {
    aiChatMessages = [];
    renderAiMessages();
    showToast('Riwayat chat berhasil dihapus', 'info');
  }
};
