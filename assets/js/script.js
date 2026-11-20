// ==========================================
// 1. SUPABASE CONFIGURATION & STATE
// ==========================================
const SUPABASE_URL = 'https://zuzlclqovfqgokvtwlbc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1emxjbHFvdmZxZ29rdnR3bGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzQ5NjIsImV4cCI6MjA5MTk1MDk2Mn0.mQ96R4d8h7rY6iN-b2S7m1vU-6e8A2v3C5K1i_j_z10';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" fill="#27272a"/>
    <circle cx="50" cy="38" r="18" fill="#71717a"/>
    <path d="M20 88c0-16.5 13.5-30 30-30s30 13.5 30 30" fill="#71717a"/>
  </svg>`
);

const DEFAULT_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" fill="none">
    <rect width="200" height="300" fill="#27272a"/>
    <rect x="74" y="124" width="52" height="52" rx="10" stroke="#52525b" stroke-width="4"/>
    <circle cx="91" cy="141" r="4" fill="#52525b"/>
    <path d="M78 168l16-16 11 11 10-10 11 15" stroke="#52525b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
);

const CATEGORY_LABELS = {
  tv_show: 'TV Show',
  movie: 'Movie',
  comic: 'Comic',
  novel: 'Novel',
  game: 'Game',
  music: 'Music'
};

const VALID_CATEGORIES = ['tv_show', 'movie', 'comic', 'novel', 'game', 'music'];

const SOCIAL_PLATFORMS = {
  instagram: { label: 'Instagram', icon: 'logo-instagram' },
  twitter: { label: 'X / Twitter', icon: 'logo-twitter' },
  youtube: { label: 'YouTube', icon: 'logo-youtube' },
  tiktok: { label: 'TikTok', icon: 'logo-tiktok' },
  github: { label: 'GitHub', icon: 'logo-github' },
  discord: { label: 'Discord', icon: 'logo-discord' },
  spotify: { label: 'Spotify', icon: 'musical-notes-outline' },
  mal: { label: 'MyAnimeList', icon: 'list-circle-outline' },
  anilist: { label: 'AniList', icon: 'albums-outline' },
  letterboxd: { label: 'Letterboxd', icon: 'film-outline' },
  steam: { label: 'Steam', icon: 'game-controller-outline' },
  website: { label: 'Website', icon: 'globe-outline' }
};

const GROQ_KEY_STORAGE = 'archive_groq_api_key';

let isAdminLoggedIn = false;
let currentProfile = {
  name: 'Archive',
  bio: '',
  avatar_url: '',
  banner_url: '',
  social_links: [],
  is_library_public: true
};

let allMediaLogs = [];
let allBlogPosts = [];
let aiChatMessages = [];
let isAiSending = false;

let activeMainView = 'blog';
let activeCategory = 'all';
let libraryViewMode = 'grid';
let sortField = 'rating';
let sortDirection = 'desc';
let itemsPerPage = '8';
let currentVisibleLimit = 8;
let isStatsExpanded = false;

// ==========================================
// 2. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupScrollListeners();
  setupOutsidePopoverCloser();
  setupLibraryControls();
  initGroqKeyInput();

  await checkAdminSession();
  await fetchProfile();
  await Promise.all([fetchMediaLogs(), fetchBlogPosts()]);

  if (isAdminLoggedIn) {
    await fetchAiChatHistory();
  }
});

function setupScrollListeners() {
  const stickyHeader = document.getElementById('sticky-mini-header');
  const backToTopBtn = document.getElementById('btn-back-to-top');

  window.addEventListener('scroll', () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (stickyHeader) stickyHeader.classList.toggle('visible', y > 220);
    if (backToTopBtn) backToTopBtn.classList.toggle('visible', y > 400);
  }, { passive: true });
}

window.scrollToTopSmooth = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function setupOutsidePopoverCloser() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.popover-wrapper')) {
      closeAllToolbarPopovers();
    }
  });
}

function closeAllToolbarPopovers() {
  document.querySelectorAll('.toolbar-popover-menu').forEach(menu => menu.classList.remove('open'));
  document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
}

window.toggleToolbarPopover = function (name) {
  const targetMenu = document.getElementById(`${name}-popover-menu`);
  const targetBtn = document.getElementById(`btn-${name}-toggle`);
  if (!targetMenu) return;

  const isOpen = targetMenu.classList.contains('open');
  closeAllToolbarPopovers();

  if (!isOpen) {
    targetMenu.classList.add('open');
    if (targetBtn) targetBtn.classList.add('active');
  }
};

// ==========================================
// 3. TOAST & HELPERS
// ==========================================
function showToast(message, type = 'info', duration = 2600) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type === 'error' ? 'error' : ''}`;

  const iconName = type === 'error'
    ? 'alert-circle-outline'
    : type === 'success'
      ? 'checkmark-circle-outline'
      : 'information-circle-outline';

  toast.innerHTML = `<ion-icon name="${iconName}"></ion-icon><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 240);
  }, duration);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatStatusDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNoteTimestamp(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

async function uploadImageToStorage(file, folder = 'uploads') {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage
    .from('media-assets')
    .upload(filePath, file, { upsert: true });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('media-assets')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ==========================================
// 4. ADMIN AUTH & VIEW SWITCHING
// ==========================================
async function checkAdminSession() {
  const { data } = await supabaseClient.auth.getSession();
  isAdminLoggedIn = Boolean(data?.session);
  updateAdminUIState();
}

function updateAdminUIState() {
  const lockIcon = document.getElementById('admin-lock-icon');
  const adminBtnText = document.getElementById('admin-btn-text');
  const editProfileBtn = document.getElementById('btn-edit-profile');
  const mainAiTab = document.getElementById('main-tab-ai');
  const miniAiTab = document.getElementById('mini-tab-ai');

  if (lockIcon) lockIcon.setAttribute('name', isAdminLoggedIn ? 'log-out-outline' : 'lock-closed-outline');
  if (adminBtnText) adminBtnText.textContent = isAdminLoggedIn ? 'Logout' : 'Admin';
  if (editProfileBtn) editProfileBtn.style.display = isAdminLoggedIn ? 'inline-flex' : 'none';
  if (mainAiTab) mainAiTab.style.display = isAdminLoggedIn ? 'inline-flex' : 'none';
  if (miniAiTab) miniAiTab.style.display = isAdminLoggedIn ? 'inline-flex' : 'none';

  if (!isAdminLoggedIn && activeMainView === 'ai') {
    switchMainView('blog');
  }

  updateContextActionButtons();
  updateLibraryPrivacyUI();
}

function updateContextActionButtons() {
  const btnPrivacy = document.getElementById('btn-toggle-library-privacy');
  const btnAddMedia = document.getElementById('btn-add-media');
  const btnAddPost = document.getElementById('btn-add-post');
  const tabBarActions = document.getElementById('tab-bar-actions');

  if (!isAdminLoggedIn) {
    if (btnPrivacy) btnPrivacy.style.display = 'none';
    if (btnAddMedia) btnAddMedia.style.display = 'none';
    if (btnAddPost) btnAddPost.style.display = 'none';
    if (tabBarActions) tabBarActions.style.display = 'none';
    return;
  }

  if (activeMainView === 'blog') {
    if (tabBarActions) tabBarActions.style.display = 'flex';
    if (btnAddPost) btnAddPost.style.display = 'inline-flex';
    if (btnAddMedia) btnAddMedia.style.display = 'none';
    if (btnPrivacy) btnPrivacy.style.display = 'none';
  } else if (activeMainView === 'library') {
    if (tabBarActions) tabBarActions.style.display = 'flex';
    if (btnAddPost) btnAddPost.style.display = 'none';
    if (btnAddMedia) btnAddMedia.style.display = 'inline-flex';
    if (btnPrivacy) btnPrivacy.style.display = 'inline-flex';
  } else {
    if (btnAddPost) btnAddPost.style.display = 'none';
    if (btnAddMedia) btnAddMedia.style.display = 'none';
    if (btnPrivacy) btnPrivacy.style.display = 'none';
    if (tabBarActions) tabBarActions.style.display = 'none';
  }
}

window.switchMainView = function (viewName) {
  if (viewName === 'ai' && !isAdminLoggedIn) return;

  if (viewName === 'library' && !isAdminLoggedIn && currentProfile.is_library_public === false) {
    showToast('Library is currently set to private', 'info');
    return;
  }

  activeMainView = viewName;

  document.querySelectorAll('.main-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.mini-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  ['blog', 'library', 'ai'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (!el) return;
    if (v === viewName) {
      el.style.display = 'block';
      el.classList.add('active-view');
    } else {
      el.style.display = 'none';
      el.classList.remove('active-view');
    }
  });

  updateContextActionButtons();
};

window.handleAdminAuthClick = async function () {
  if (isAdminLoggedIn) {
    const res = await Swal.fire({
      text: 'Sign out from Admin mode?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ffffff',
      confirmButtonText: '<span style="color:#121212;font-weight:600;">Sign Out</span>',
      cancelButtonText: 'Cancel',
      background: '#1e1e1f',
      color: '#fff'
    });
    if (!res.isConfirmed) return;

    await supabaseClient.auth.signOut();
    isAdminLoggedIn = false;
    aiChatMessages = [];
    updateAdminUIState();
    renderBlogPosts();
    renderMediaGrid();
    showToast('Signed out', 'info');
  } else {
    document.getElementById('login-modal')?.classList.add('active');
  }
};

window.closeLoginModal = function () {
  document.getElementById('login-modal')?.classList.remove('active');
};

document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message, 'error');
    return;
  }

  isAdminLoggedIn = true;
  closeLoginModal();
  updateAdminUIState();
  renderBlogPosts();
  renderMediaGrid();
  await fetchAiChatHistory();
  showToast('Signed in as Admin', 'success');
});

// ==========================================
// 5. PROFILE & PRIVACY MANAGEMENT
// ==========================================
async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from('profile_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (!error && data) {
    currentProfile = {
      ...currentProfile,
      ...data,
      social_links: Array.isArray(data.social_links) ? data.social_links : [],
      is_library_public: data.is_library_public !== false
    };
  }

  renderProfileHeader();
  updateLibraryPrivacyUI();
}

function renderProfileHeader() {
  const name = currentProfile.name || 'Archive';
  const bio = currentProfile.bio || '';
  const avatar = currentProfile.avatar_url || DEFAULT_AVATAR;
  const banner = (currentProfile.banner_url || '').trim();

  document.title = name;
  setElText('profile-name-text', name);
  setElText('profile-bio-text', bio);
  setElText('sticky-name-text', name);
  setElText('footer-brand-name', name);

  const avatarImg = document.getElementById('profile-avatar-img');
  const stickyAvatarImg = document.getElementById('sticky-avatar-img');
  const faviconLink = document.getElementById('favicon-link');

  if (avatarImg) avatarImg.src = avatar;
  if (stickyAvatarImg) stickyAvatarImg.src = avatar;
  if (faviconLink && currentProfile.avatar_url) faviconLink.href = currentProfile.avatar_url;

  const headerCard = document.getElementById('profile-header-card');
  const bannerWrap = document.getElementById('profile-banner-wrap');
  const bannerImg = document.getElementById('profile-banner-img');

  if (banner && bannerWrap && bannerImg && headerCard) {
    bannerImg.src = banner;
    bannerWrap.style.display = 'block';
    headerCard.classList.add('has-banner');
  } else if (bannerWrap && headerCard) {
    bannerWrap.style.display = 'none';
    headerCard.classList.remove('has-banner');
  }

  const socialsBar = document.getElementById('profile-socials-bar');
  const links = currentProfile.social_links || [];
  if (socialsBar) {
    if (links.length === 0) {
      socialsBar.style.display = 'none';
    } else {
      socialsBar.style.display = 'flex';
      socialsBar.innerHTML = links.map(link => {
        const meta = SOCIAL_PLATFORMS[link.platform] || SOCIAL_PLATFORMS.website;
        return `
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="social-chip">
            <ion-icon name="${meta.icon}"></ion-icon>
            <span>${escapeHtml(meta.label)}</span>
          </a>
        `;
      }).join('');
    }
  }
}

function updateLibraryPrivacyUI() {
  const isPublic = currentProfile.is_library_public !== false;
  const lockBadge = document.getElementById('library-private-lock');
  const privacyIcon = document.getElementById('library-privacy-icon');
  const privacyText = document.getElementById('library-privacy-text');

  if (lockBadge) lockBadge.style.display = isPublic ? 'none' : 'inline-block';
  if (privacyIcon) privacyIcon.setAttribute('name', isPublic ? 'eye-outline' : 'eye-off-outline');
  if (privacyText) privacyText.textContent = isPublic ? 'Public' : 'Private';

  if (!isPublic && !isAdminLoggedIn && activeMainView === 'library') {
    switchMainView('blog');
  }
}

window.toggleLibraryPrivacy = async function () {
  if (!isAdminLoggedIn) return;
  const nextPublic = !(currentProfile.is_library_public !== false);

  const { error } = await supabaseClient
    .from('profile_settings')
    .upsert({ id: 1, is_library_public: nextPublic });

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  currentProfile.is_library_public = nextPublic;
  updateLibraryPrivacyUI();
  showToast(nextPublic ? 'Library is now Public' : 'Library is now Private', 'success');
};

window.openProfileModal = function () {
  if (!isAdminLoggedIn) return;
  document.getElementById('edit-profile-name').value = currentProfile.name || '';
  document.getElementById('edit-profile-bio').value = currentProfile.bio || '';
  document.getElementById('edit-profile-avatar').value = currentProfile.avatar_url || '';
  document.getElementById('edit-profile-banner').value = currentProfile.banner_url || '';
  setElText('profile-upload-status', '');
  setElText('banner-upload-status', '');

  const editor = document.getElementById('social-links-editor');
  if (editor) {
    editor.innerHTML = '';
    (currentProfile.social_links || []).forEach(item => addSocialLinkRow(item.platform, item.url));
  }

  document.getElementById('profile-modal')?.classList.add('active');
};

window.closeProfileModal = function () {
  document.getElementById('profile-modal')?.classList.remove('active');
};

window.clearBannerInput = function () {
  const input = document.getElementById('edit-profile-banner');
  if (input) input.value = '';
};

window.addSocialLinkRow = function (platform = 'instagram', url = '') {
  const editor = document.getElementById('social-links-editor');
  if (!editor) return;

  const row = document.createElement('div');
  row.className = 'social-edit-row';

  const optionsHtml = Object.entries(SOCIAL_PLATFORMS).map(([key, val]) =>
    `<option value="${key}" ${key === platform ? 'selected' : ''}>${val.label}</option>`
  ).join('');

  row.innerHTML = `
    <select class="form-input social-platform-select">${optionsHtml}</select>
    <input type="url" class="form-input social-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="social-remove-btn" onclick="this.parentElement.remove()" title="Remove">
      <ion-icon name="trash-outline"></ion-icon>
    </button>
  `;
  editor.appendChild(row);
};

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setElText('profile-upload-status', 'Uploading avatar...');
  try {
    const publicUrl = await uploadImageToStorage(file, 'avatars');
    document.getElementById('edit-profile-avatar').value = publicUrl;
    setElText('profile-upload-status', 'Avatar uploaded');
  } catch (err) {
    setElText('profile-upload-status', '');
    showToast(err.message, 'error');
  }
};

window.handleBannerImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setElText('banner-upload-status', 'Uploading banner...');
  try {
    const publicUrl = await uploadImageToStorage(file, 'banners');
    document.getElementById('edit-profile-banner').value = publicUrl;
    setElText('banner-upload-status', 'Banner uploaded');
  } catch (err) {
    setElText('banner-upload-status', '');
    showToast(err.message, 'error');
  }
};

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return;

  const socialRows = document.querySelectorAll('#social-links-editor .social-edit-row');
  const socialLinks = [];
  socialRows.forEach(row => {
    const platform = row.querySelector('.social-platform-select')?.value || 'website';
    const url = (row.querySelector('.social-url-input')?.value || '').trim();
    if (url) socialLinks.push({ platform, url });
  });

  const payload = {
    id: 1,
    name: document.getElementById('edit-profile-name').value.trim() || 'Archive',
    bio: document.getElementById('edit-profile-bio').value.trim(),
    avatar_url: document.getElementById('edit-profile-avatar').value.trim(),
    banner_url: document.getElementById('edit-profile-banner').value.trim(),
    social_links: socialLinks
  };

  const { error } = await supabaseClient.from('profile_settings').upsert(payload);
  if (error) {
    showToast(error.message, 'error');
    return;
  }

  currentProfile = { ...currentProfile, ...payload };
  renderProfileHeader();
  renderBlogPosts();
  closeProfileModal();
  showToast('Profile updated', 'success');
});

// ==========================================
// 6. PERSONAL NOTES / MICRO-BLOG FEED
// ==========================================
async function fetchBlogPosts() {
  const { data, error } = await supabaseClient
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Notes fetch error:', error.message);
    return;
  }

  allBlogPosts = data || [];
  renderBlogPosts();
  updateAiContextSidebar();
}

function linkifyText(rawText) {
  const escaped = escapeHtml(rawText || '');
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-note-link">${url}</a>`
  );
}

function extractFirstUrl(rawText) {
  const match = (rawText || '').match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

function renderBlogPosts() {
  const container = document.getElementById('blog-feed-list');
  if (!container) return;

  if (allBlogPosts.length === 0) {
    container.innerHTML = `<p class="empty-state">No notes published yet.</p>`;
    return;
  }

  const authorName = escapeHtml(currentProfile.name || 'Archive');
  const authorAvatar = escapeHtml(currentProfile.avatar_url || DEFAULT_AVATAR);

  container.innerHTML = allBlogPosts.map(post => {
    const timeStr = formatNoteTimestamp(post.created_at);
    const firstUrl = extractFirstUrl(post.content);
    let linkPreviewHtml = '';

    if (firstUrl && !post.image_url) {
      try {
        const u = new URL(firstUrl);
        linkPreviewHtml = `
          <a href="${escapeHtml(firstUrl)}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
            <div class="link-preview-icon"><ion-icon name="link-outline"></ion-icon></div>
            <div class="link-preview-info">
              <span class="link-preview-domain">${escapeHtml(u.hostname.replace(/^www\./, ''))}</span>
              <span class="link-preview-title">${escapeHtml(firstUrl)}</span>
            </div>
          </a>
        `;
      } catch (_) {}
    }

    const imageHtml = post.image_url ? `
      <div class="blog-post-image-wrap">
        <img src="${escapeHtml(post.image_url)}" alt="Post attachment" loading="lazy">
      </div>
    ` : '';

    const adminActionsHtml = isAdminLoggedIn ? `
      <div class="blog-post-actions">
        <button type="button" class="blog-icon-btn" onclick="openPostModal('${post.id}')" title="Edit Note">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button type="button" class="blog-icon-btn delete" onclick="deleteBlogPost('${post.id}')" title="Delete Note">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    ` : '';

    return `
      <article class="blog-post-card">
        <div class="blog-post-header">
          <div class="blog-post-author">
            <img src="${authorAvatar}" alt="${authorName}" class="blog-post-avatar">
            <div class="blog-post-meta">
              <span class="blog-post-name">${authorName}</span>
              <span class="blog-post-time">${timeStr}</span>
            </div>
          </div>
          ${adminActionsHtml}
        </div>
        <div class="blog-post-text">${linkifyText(post.content)}</div>
        ${linkPreviewHtml}
        ${imageHtml}
      </article>
    `;
  }).join('');
}

window.openPostModal = function (postId = null) {
  if (!isAdminLoggedIn) return;
  const idInput = document.getElementById('post-id');
  const contentInput = document.getElementById('post-content');
  const imageInput = document.getElementById('post-image');

  setElText('post-upload-status', '');

  if (postId) {
    const existing = allBlogPosts.find(p => String(p.id) === String(postId));
    if (!existing) return;
    setElText('post-modal-title', 'Edit Post');
    idInput.value = existing.id;
    contentInput.value = existing.content || '';
    imageInput.value = existing.image_url || '';
  } else {
    setElText('post-modal-title', 'New Post');
    idInput.value = '';
    contentInput.value = '';
    imageInput.value = '';
  }

  document.getElementById('post-modal')?.classList.add('active');
};

window.closePostModal = function () {
  document.getElementById('post-modal')?.classList.remove('active');
};

window.clearPostImageInput = function () {
  const input = document.getElementById('post-image');
  if (input) input.value = '';
};

window.handlePostImageUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setElText('post-upload-status', 'Uploading photo...');
  try {
    const publicUrl = await uploadImageToStorage(file, 'notes');
    document.getElementById('post-image').value = publicUrl;
    setElText('post-upload-status', 'Photo uploaded');
  } catch (err) {
    setElText('post-upload-status', '');
    showToast(err.message, 'error');
  }
};

document.getElementById('post-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return;

  const id = document.getElementById('post-id').value;
  const content = document.getElementById('post-content').value.trim();
  const imageUrl = document.getElementById('post-image').value.trim() || null;

  if (!content) return;

  const nowIso = new Date().toISOString();

  if (id) {
    const { error } = await supabaseClient
      .from('blog_posts')
      .update({ content, image_url: imageUrl, updated_at: nowIso })
      .eq('id', id);

    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Post updated', 'success');
  } else {
    const { error } = await supabaseClient
      .from('blog_posts')
      .insert([{ content, image_url: imageUrl, created_at: nowIso, updated_at: nowIso }]);

    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Post published', 'success');
  }

  closePostModal();
  await fetchBlogPosts();
});

window.deleteBlogPost = async function (postId) {
  if (!isAdminLoggedIn) return;
  const res = await Swal.fire({
    text: 'Delete this note post?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (!res.isConfirmed) return;

  const { error } = await supabaseClient.from('blog_posts').delete().eq('id', postId);
  if (error) {
    showToast(error.message, 'error');
    return;
  }

  await fetchBlogPosts();
  showToast('Post deleted', 'info');
};

// ==========================================
// 7. MEDIA LIBRARY LOGIC
// ==========================================
async function fetchMediaLogs() {
  const { data, error } = await supabaseClient
    .from('media_logs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Media logs fetch error:', error.message);
    return;
  }

  allMediaLogs = data || [];
  updateLibraryStats();
  renderMediaGrid();
  updateAiContextSidebar();
}

function getAllItemUnits(item) {
  const tracks = Array.isArray(item.category_tracks) && item.category_tracks.length > 0
    ? item.category_tracks
    : [{
        category: item.category || 'tv_show',
        status: item.status || 'planned',
        progress: Number(item.progress) || 0,
        total: item.total !== null && item.total !== undefined ? Number(item.total) : null,
        unit: item.unit || 'Eps'
      }];

  const extras = Array.isArray(item.seasons) ? item.seasons : [];
  return [
    ...tracks.map(t => ({
      title: CATEGORY_LABELS[t.category] || t.category,
      category: t.category || 'tv_show',
      status: t.status || 'planned',
      progress: Number(t.progress) || 0,
      total: t.total !== null && t.total !== undefined && t.total !== '' ? Number(t.total) : null,
      unit: t.unit || 'Eps',
      isExtra: false
    })),
    ...extras.map(s => ({
      title: s.title || 'Part',
      category: s.category || tracks[0].category || 'tv_show',
      status: s.status || 'planned',
      progress: Number(s.progress) || 0,
      total: s.total !== null && s.total !== undefined && s.total !== '' ? Number(s.total) : null,
      unit: s.unit || 'Eps',
      isExtra: true
    }))
  ];
}

function getItemCategories(item) {
  const units = getAllItemUnits(item);
  const set = new Set();
  units.forEach(u => {
    if (VALID_CATEGORIES.includes(u.category)) set.add(u.category);
  });
  if (set.size === 0) set.add('tv_show');
  return Array.from(set);
}

function computeSyncedStatus(units) {
  const statuses = units.map(u => u.status);
  if (statuses.includes('ongoing')) return { key: 'ongoing', label: 'Ongoing' };
  if (statuses.every(s => s === 'completed')) return { key: 'completed', label: 'Completed' };
  if (statuses.every(s => s === 'dropped')) return { key: 'dropped', label: 'Dropped' };
  if (statuses.includes('completed') && statuses.includes('planned')) return { key: 'ongoing', label: 'Ongoing' };
  return { key: 'planned', label: 'Planned' };
}

function computeCombinedProgress(units, statusKey) {
  let sumProg = 0;
  let sumTotal = 0;
  let hasUnknownTotal = false;

  units.forEach(u => {
    sumProg += Number(u.progress) || 0;
    if (u.total !== null && u.total !== undefined && Number(u.total) > 0) {
      sumTotal += Number(u.total);
    } else {
      hasUnknownTotal = true;
    }
  });

  const mainUnit = units[0]?.unit || 'Eps';
  const pct = sumTotal > 0 ? Math.min(100, Math.round((sumProg / sumTotal) * 100)) : (statusKey === 'completed' ? 100 : 0);
  const text = sumTotal > 0 && !hasUnknownTotal
    ? `${sumProg}/${sumTotal} ${mainUnit}`
    : `${sumProg} ${mainUnit}`;

  return { sumProg, sumTotal, pct, text };
}

window.toggleLibraryStats = function () {
  isStatsExpanded = !isStatsExpanded;
  const panel = document.getElementById('collapsible-stats-panel');
  const text = document.getElementById('stats-toggle-text');
  const icon = document.getElementById('stats-chevron-icon');

  if (panel) panel.style.display = isStatsExpanded ? 'flex' : 'none';
  if (text) text.textContent = isStatsExpanded ? 'Hide Stats' : 'Show Stats';
  if (icon) icon.setAttribute('name', isStatsExpanded ? 'chevron-up-outline' : 'chevron-down-outline');
};

function updateLibraryStats() {
  setElText('total-entries-label', `${allMediaLogs.length} Entries`);

  const catCounts = { tv_show: 0, movie: 0, comic: 0, novel: 0, game: 0, music: 0 };
  const catCompleted = { tv_show: 0, movie: 0, comic: 0, novel: 0, game: 0, music: 0 };
  const unitTotals = { Eps: 0, Ch: 0, Pages: 0, Vol: 0, Movie: 0, Track: 0, Item: 0 };

  let totalCompletedEntries = 0;
  let ratingSum = 0;
  let ratedCount = 0;

  allMediaLogs.forEach(item => {
    const units = getAllItemUnits(item);
    const cats = getItemCategories(item);
    const synced = computeSyncedStatus(units);

    if (synced.key === 'completed') totalCompletedEntries++;

    if (item.rating !== null && item.rating !== undefined && Number(item.rating) > 0) {
      ratingSum += Number(item.rating);
      ratedCount++;
    }

    cats.forEach(c => {
      if (catCounts[c] !== undefined) {
        catCounts[c]++;
        if (synced.key === 'completed') catCompleted[c]++;
      }
    });

    units.forEach(u => {
      const p = Number(u.progress) || 0;
      const key = u.unit in unitTotals ? u.unit : 'Item';
      unitTotals[key] += p;
    });
  });

  setElText('stat-cat-tv', catCounts.tv_show);
  setElText('stat-cat-tv-sub', `${catCompleted.tv_show} Completed`);
  setElText('stat-cat-movie', catCounts.movie);
  setElText('stat-cat-movie-sub', `${catCompleted.movie} Completed`);
  setElText('stat-cat-comic', catCounts.comic);
  setElText('stat-cat-comic-sub', `${catCompleted.comic} Completed`);
  setElText('stat-cat-novel', catCounts.novel);
  setElText('stat-cat-novel-sub', `${catCompleted.novel} Completed`);
  setElText('stat-cat-game', catCounts.game);
  setElText('stat-cat-game-sub', `${catCompleted.game} Completed`);
  setElText('stat-cat-music', catCounts.music);
  setElText('stat-cat-music-sub', `${catCompleted.music} Completed`);

  setElText('stat-unit-eps', unitTotals.Eps);
  setElText('stat-unit-ch', unitTotals.Ch);
  setElText('stat-unit-pages', unitTotals.Pages);
  setElText('stat-unit-vol', unitTotals.Vol);
  setElText('stat-unit-movie', unitTotals.Movie);
  setElText('stat-unit-track', unitTotals.Track);
  setElText('stat-unit-item', unitTotals.Item);

  const rate = allMediaLogs.length > 0 ? Math.round((totalCompletedEntries / allMediaLogs.length) * 100) : 0;
  const avgRating = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : '0.0';

  setElText('stat-completed-total', totalCompletedEntries);
  setElText('stat-completion-rate', `${rate}% Rate`);
  setElText('stat-avg-rating', avgRating);
  setElText('stat-rated-count', `${ratedCount} Rated`);
}

function setupLibraryControls() {
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category || 'all';
      resetPaginationAndRender();
    });
  });

  ['search-library', 'filter-status', 'filter-rating-min', 'filter-rating-max', 'filter-unrated-only', 'filter-units-min', 'filter-units-max'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      updateFilterIndicatorDot();
      resetPaginationAndRender();
    });
    el.addEventListener('change', () => {
      updateFilterIndicatorDot();
      resetPaginationAndRender();
    });
  });
}

function updateFilterIndicatorDot() {
  const status = document.getElementById('filter-status')?.value || 'all';
  const rMin = document.getElementById('filter-rating-min')?.value || '';
  const rMax = document.getElementById('filter-rating-max')?.value || '';
  const unrated = document.getElementById('filter-unrated-only')?.checked || false;
  const uMin = document.getElementById('filter-units-min')?.value || '';
  const uMax = document.getElementById('filter-units-max')?.value || '';

  const hasActive = status !== 'all' || rMin !== '' || rMax !== '' || unrated || uMin !== '' || uMax !== '';
  const dot = document.getElementById('filter-active-dot');
  if (dot) dot.style.display = hasActive ? 'inline-block' : 'none';
}

window.resetLibraryFilters = function () {
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-rating-min').value = '';
  document.getElementById('filter-rating-max').value = '';
  document.getElementById('filter-unrated-only').checked = false;
  document.getElementById('filter-units-min').value = '';
  document.getElementById('filter-units-max').value = '';
  updateFilterIndicatorDot();
  resetPaginationAndRender();
};

window.onSortOptionChange = function () {
  sortField = document.getElementById('sort-library-field')?.value || 'rating';
  updateSortButtonLabel();
  resetPaginationAndRender();
};

window.setSortDirection = function (dir) {
  sortDirection = dir;
  document.getElementById('btn-sort-desc')?.classList.toggle('active', dir === 'desc');
  document.getElementById('btn-sort-asc')?.classList.toggle('active', dir === 'asc');
  updateSortButtonLabel();
  resetPaginationAndRender();
};

function updateSortButtonLabel() {
  const map = {
    rating: sortDirection === 'desc' ? 'Rating (Best)' : 'Rating (Worst)',
    updated: sortDirection === 'desc' ? 'Newest' : 'Oldest',
    units: sortDirection === 'desc' ? 'Count (High)' : 'Count (Low)',
    title: sortDirection === 'desc' ? 'Title (Z-A)' : 'Title (A-Z)'
  };
  setElText('sort-btn-label', map[sortField] || 'Sort');
}

window.selectItemsPerPage = function (limitVal) {
  itemsPerPage = limitVal;
  document.querySelectorAll('.page-option-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.limit === limitVal);
  });
  closeAllToolbarPopovers();
  resetPaginationAndRender();
};

window.setLibraryViewMode = function (mode) {
  libraryViewMode = mode;
  document.getElementById('btn-view-grid')?.classList.toggle('active', mode === 'grid');
  document.getElementById('btn-view-list')?.classList.toggle('active', mode === 'list');
  renderMediaGrid();
};

function resetPaginationAndRender() {
  currentVisibleLimit = itemsPerPage === 'all' ? Infinity : Number(itemsPerPage) || 8;
  renderMediaGrid();
}

window.loadMoreMedia = function () {
  const step = itemsPerPage === 'all' ? 9999 : Number(itemsPerPage) || 8;
  currentVisibleLimit += step;
  renderMediaGrid();
};

function getFilteredAndSortedMedia() {
  const q = (document.getElementById('search-library')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const rMinRaw = document.getElementById('filter-rating-min')?.value || '';
  const rMaxRaw = document.getElementById('filter-rating-max')?.value || '';
  const unratedOnly = document.getElementById('filter-unrated-only')?.checked || false;
  const uMinRaw = document.getElementById('filter-units-min')?.value || '';
  const uMaxRaw = document.getElementById('filter-units-max')?.value || '';

  const filtered = allMediaLogs.filter(item => {
    const units = getAllItemUnits(item);
    const cats = getItemCategories(item);
    const synced = computeSyncedStatus(units);
    const combined = computeCombinedProgress(units, synced.key);

    if (activeCategory !== 'all' && !cats.includes(activeCategory)) return false;
    if (statusFilter !== 'all' && synced.key !== statusFilter) return false;

    if (q) {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subMatch = units.some(u => (u.title || '').toLowerCase().includes(q));
      if (!titleMatch && !subMatch) return false;
    }

    const hasRating = item.rating !== null && item.rating !== undefined && Number(item.rating) > 0;
    if (unratedOnly && hasRating) return false;
    if (rMinRaw !== '' && (!hasRating || Number(item.rating) < Number(rMinRaw))) return false;
    if (rMaxRaw !== '' && (!hasRating || Number(item.rating) > Number(rMaxRaw))) return false;

    if (uMinRaw !== '' && combined.sumProg < Number(uMinRaw)) return false;
    if (uMaxRaw !== '' && combined.sumProg > Number(uMaxRaw)) return false;

    return true;
  });

  const dirMult = sortDirection === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    if (sortField === 'rating') {
      const ra = a.rating !== null && a.rating !== undefined ? Number(a.rating) : -1;
      const rb = b.rating !== null && b.rating !== undefined ? Number(b.rating) : -1;
      if (ra === rb) return (a.title || '').localeCompare(b.title || '');
      return (ra - rb) * dirMult;
    }
    if (sortField === 'units') {
      const ua = computeCombinedProgress(getAllItemUnits(a), 'ongoing').sumProg;
      const ub = computeCombinedProgress(getAllItemUnits(b), 'ongoing').sumProg;
      return (ua - ub) * dirMult;
    }
    if (sortField === 'title') {
      return (a.title || '').localeCompare(b.title || '') * (sortDirection === 'asc' ? 1 : -1);
    }
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return (ta - tb) * dirMult;
  });

  return filtered;
}

function renderMediaGrid() {
  const container = document.getElementById('media-grid');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (!container) return;

  const list = getFilteredAndSortedMedia();
  container.classList.toggle('list-view', libraryViewMode === 'list');

  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">No media entries found.</p>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  const visibleItems = list.slice(0, currentVisibleLimit);

  if (libraryViewMode === 'list') {
    container.innerHTML = visibleItems.map(item => {
      const units = getAllItemUnits(item);
      const cats = getItemCategories(item).map(c => CATEGORY_LABELS[c] || c).join(' • ');
      const synced = computeSyncedStatus(units);
      const combined = computeCombinedProgress(units, synced.key);
      const cover = escapeHtml(item.cover_url || DEFAULT_COVER);
      const ratingStr = (item.rating !== null && item.rating !== undefined && Number(item.rating) > 0)
        ? `★ ${Number(item.rating).toFixed(1)}`
        : '—';
      const repeatHtml = Number(item.repeat_count) > 0
        ? `<span class="list-repeat-tag">↻ ${item.repeat_count}x</span>`
        : '';
      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="list-edit-btn" onclick="event.stopPropagation(); openMediaModal('${item.id}')" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      return `
        <article class="media-list-row" onclick="openMediaDetailModal('${item.id}')">
          <img src="${cover}" alt="${escapeHtml(item.title)}" class="list-thumb" loading="lazy">
          <div class="list-main-info">
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <div class="list-sub-meta">
              <span class="list-cat-tag">${escapeHtml(cats)}</span>
              <span>•</span>
              <span class="status-pill ${synced.key}">${synced.label}</span>
              <span class="list-hide-mobile">• ${escapeHtml(combined.text)}</span>
              ${repeatHtml}
            </div>
          </div>
          <div class="list-right-meta">
            <span class="list-rating-pill">${ratingStr}</span>
            ${editBtnHtml}
          </div>
        </article>
      `;
    }).join('');
  } else {
    container.innerHTML = visibleItems.map(item => {
      const units = getAllItemUnits(item);
      const cats = getItemCategories(item);
      const synced = computeSyncedStatus(units);
      const combined = computeCombinedProgress(units, synced.key);
      const cover = escapeHtml(item.cover_url || DEFAULT_COVER);

      const catBadgesHtml = cats.map(c =>
        `<span class="badge-cat">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`
      ).join('');

      const ratingBadgeHtml = (item.rating !== null && item.rating !== undefined && Number(item.rating) > 0)
        ? `<span class="badge-rating">★ ${Number(item.rating).toFixed(1)}</span>`
        : '';

      const repeatBadgeHtml = Number(item.repeat_count) > 0
        ? `<span class="badge-repeat">↻ ${item.repeat_count}x</span>`
        : '';

      const extraCount = Array.isArray(item.seasons) ? item.seasons.length : 0;
      const seasonsBadgeHtml = extraCount > 0
        ? `<span class="badge-seasons">+${extraCount} Entry</span>`
        : '';

      const editBtnHtml = isAdminLoggedIn ? `
        <button type="button" class="cover-edit-btn" onclick="event.stopPropagation(); openMediaModal('${item.id}')" title="Edit Entry">
          <ion-icon name="create-outline"></ion-icon>
        </button>
      ` : '';

      const fillClass = synced.key === 'planned' && combined.pct === 0 ? 'planned-empty' : synced.key;
      const dateStr = formatStatusDate(item.updated_at || item.created_at);

      return `
        <article class="media-card" onclick="openMediaDetailModal('${item.id}')">
          <div class="media-cover-wrap">
            <img src="${cover}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="cover-left-badges">
              <div class="badge-cat-row">${catBadgesHtml}</div>
              ${ratingBadgeHtml}
              ${repeatBadgeHtml}
            </div>
            ${seasonsBadgeHtml}
            ${editBtnHtml}
          </div>
          <div class="media-body">
            <h3 class="media-title">${escapeHtml(item.title)}</h3>
            <div class="media-bottom-stack">
              <div class="media-meta-row">
                <span class="status-pill ${synced.key}">${synced.label}</span>
                <span class="progress-pill ${synced.key}">${escapeHtml(combined.text)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${fillClass}" style="width: ${combined.pct}%;"></div>
              </div>
              <div class="media-footer-row">
                <span class="status-date-item">
                  <ion-icon name="time-outline"></ion-icon>
                  <span>${dateStr}</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  if (loadMoreWrap) {
    if (visibleItems.length < list.length) {
      loadMoreWrap.style.display = 'flex';
      setElText('load-more-text', `Load More (${visibleItems.length} of ${list.length})`);
    } else {
      loadMoreWrap.style.display = 'none';
    }
  }
}

window.openMediaDetailModal = function (mediaId) {
  const item = allMediaLogs.find(m => String(m.id) === String(mediaId));
  if (!item) return;

  const units = getAllItemUnits(item);
  const cats = getItemCategories(item).map(c => CATEGORY_LABELS[c] || c).join(' • ');
  const synced = computeSyncedStatus(units);
  const cover = escapeHtml(item.cover_url || DEFAULT_COVER);
  const ratingStr = (item.rating !== null && item.rating !== undefined && Number(item.rating) > 0)
    ? `★ ${Number(item.rating).toFixed(1)} / 10`
    : 'Unrated';

  setElText('detail-modal-title', item.title);

  const body = document.getElementById('media-detail-body');
  if (body) {
    body.innerHTML = `
      <div class="detail-hero">
        <img src="${cover}" alt="${escapeHtml(item.title)}" class="detail-poster">
        <div class="detail-meta-col">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="status-pill ${synced.key}">${synced.label}</span>
            <span class="badge-rating">${ratingStr}</span>
            ${Number(item.repeat_count) > 0 ? `<span class="badge-repeat">↻ ${item.repeat_count}x</span>` : ''}
          </div>
          <p style="font-size:12px;color:var(--light-gray-70);">Categories: ${escapeHtml(cats)}</p>
          <p style="font-size:11px;color:var(--light-gray-70);">Updated: ${formatStatusDate(item.updated_at || item.created_at)}</p>
        </div>
      </div>
      <div>
        <div class="detail-section-title">Progress Breakdown</div>
        <div class="detail-list">
          ${units.map(u => {
            const pText = u.total ? `${u.progress} / ${u.total} ${u.unit}` : `${u.progress} ${u.unit}`;
            return `
              <div class="detail-row-item">
                <span><strong>${escapeHtml(u.title)}</strong> <small style="color:var(--light-gray-70);">(${escapeHtml(u.status)})</small></span>
                <span style="font-weight:600;">${escapeHtml(pText)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('media-detail-modal')?.classList.add('active');
};

window.closeMediaDetailModal = function () {
  document.getElementById('media-detail-modal')?.classList.remove('active');
};

// Add / Edit Media Modal & Editors
window.openMediaModal = function (mediaId = null) {
  if (!isAdminLoggedIn) return;

  const tracksEditor = document.getElementById('media-tracks-editor');
  const seasonsEditor = document.getElementById('media-seasons-editor');
  const delBtn = document.getElementById('btn-modal-delete');
  const apiResults = document.getElementById('api-search-results');

  if (tracksEditor) tracksEditor.innerHTML = '';
  if (seasonsEditor) seasonsEditor.innerHTML = '';
  if (apiResults) apiResults.style.display = 'none';
  setElText('cover-upload-status', '');

  if (mediaId) {
    const item = allMediaLogs.find(m => String(m.id) === String(mediaId));
    if (!item) return;

    setElText('media-modal-title', 'Edit Media');
    document.getElementById('media-id').value = item.id;
    document.getElementById('media-title').value = item.title || '';
    document.getElementById('media-cover').value = item.cover_url || '';
    document.getElementById('media-rating').value = item.rating ?? '';
    document.getElementById('media-repeat').value = item.repeat_count ?? 0;
    if (delBtn) delBtn.style.display = 'inline-block';

    const tracks = Array.isArray(item.category_tracks) && item.category_tracks.length > 0
      ? item.category_tracks
      : [{
          category: item.category || 'tv_show',
          status: item.status || 'ongoing',
          progress: item.progress || 0,
          total: item.total ?? '',
          unit: item.unit || 'Eps'
        }];

    tracks.forEach(t => addMediaTrackRow(t));
    (Array.isArray(item.seasons) ? item.seasons : []).forEach(s => addSeasonItemRow(s));
  } else {
    setElText('media-modal-title', 'Add Media');
    document.getElementById('media-id').value = '';
    document.getElementById('media-title').value = '';
    document.getElementById('media-cover').value = '';
    document.getElementById('media-rating').value = '';
    document.getElementById('media-repeat').value = 0;
    if (delBtn) delBtn.style.display = 'none';
    addMediaTrackRow();
  }

  document.getElementById('media-modal')?.classList.add('active');
};

window.closeMediaModal = function () {
  document.getElementById('media-modal')?.classList.remove('active');
};

window.stepModalRepeat = function () {
  const input = document.getElementById('media-repeat');
  if (input) input.value = (Number(input.value) || 0) + 1;
};

window.addMediaTrackRow = function (data = {}) {
  const editor = document.getElementById('media-tracks-editor');
  if (!editor) return;

  const cat = data.category || 'tv_show';
  const status = data.status || 'ongoing';
  const prog = data.progress ?? 0;
  const total = data.total ?? '';
  const unit = data.unit || 'Eps';

  const card = document.createElement('div');
  card.className = 'track-edit-card';
  card.innerHTML = `
    <div class="track-edit-top">
      <select class="form-input track-cat">
        ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <select class="form-input track-status">
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <button type="button" class="social-remove-btn" onclick="if(document.querySelectorAll('#media-tracks-editor .track-edit-card').length > 1) this.closest('.track-edit-card').remove()" title="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="track-edit-grid">
      <div class="progress-input-row">
        <input type="number" class="form-input track-prog" min="0" value="${prog}" placeholder="Prog">
        <button type="button" class="step-plus-btn" onclick="const inp=this.previousElementSibling; inp.value=(Number(inp.value)||0)+1;">+1</button>
      </div>
      <input type="number" class="form-input track-total" min="0" value="${total}" placeholder="Total">
      <select class="form-input track-unit">
        ${['Eps', 'Ch', 'Pages', 'Vol', 'Movie', 'Track', 'Item'].map(u => `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
      <button type="button" class="form-btn" onclick="const c=this.closest('.track-edit-card'); const t=c.querySelector('.track-total').value; if(t) c.querySelector('.track-prog').value=t; c.querySelector('.track-status').value='completed';">Max</button>
    </div>
  `;
  editor.appendChild(card);
};

window.addSeasonItemRow = function (data = {}) {
  const editor = document.getElementById('media-seasons-editor');
  if (!editor) return;

  const title = data.title || '';
  const status = data.status || 'planned';
  const prog = data.progress ?? 0;
  const total = data.total ?? '';
  const unit = data.unit || 'Eps';

  const card = document.createElement('div');
  card.className = 'season-edit-card';
  card.innerHTML = `
    <div class="season-edit-top">
      <input type="text" class="form-input season-title" placeholder="Part / Season / OVA title" value="${escapeHtml(title)}">
      <button type="button" class="social-remove-btn" onclick="this.closest('.season-edit-card').remove()" title="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
    <div class="season-edit-grid">
      <select class="form-input season-status">
        <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
      </select>
      <div class="progress-input-row">
        <input type="number" class="form-input season-prog" min="0" value="${prog}" placeholder="Prog">
        <button type="button" class="step-plus-btn" onclick="const inp=this.previousElementSibling; inp.value=(Number(inp.value)||0)+1;">+1</button>
      </div>
      <input type="number" class="form-input season-total" min="0" value="${total}" placeholder="Total">
      <select class="form-input season-unit">
        ${['Eps', 'Ch', 'Pages', 'Vol', 'Movie', 'Track', 'Item'].map(u => `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
    </div>
  `;
  editor.appendChild(card);
};

window.handleMediaCoverUpload = async function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setElText('cover-upload-status', 'Uploading cover...');
  try {
    const publicUrl = await uploadImageToStorage(file, 'covers');
    document.getElementById('media-cover').value = publicUrl;
    setElText('cover-upload-status', 'Cover uploaded');
  } catch (err) {
    setElText('cover-upload-status', '');
    showToast(err.message, 'error');
  }
};

window.searchExternalAPI = async function () {
  const cat = document.getElementById('api-search-cat')?.value || 'tv_show';
  const query = (document.getElementById('api-search-input')?.value || '').trim();
  const listEl = document.getElementById('api-search-results');
  if (!query || !listEl) return;

  listEl.style.display = 'block';
  listEl.innerHTML = `<p style="font-size:12px;color:var(--light-gray-70);">Searching...</p>`;

  try {
    let items = [];
    if (cat === 'tv_show' || cat === 'movie') {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=6`);
      const json = await res.json();
      items = (json.data || []).map(a => ({
        title: a.title_english || a.title,
        cover: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '',
        total: a.episodes || '',
        unit: cat === 'movie' ? 'Movie' : 'Eps',
        sub: `${a.type || 'Anime'} • ${a.episodes ? a.episodes + ' eps' : '?'}`
      }));
    } else if (cat === 'comic' || cat === 'novel') {
      const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=6`);
      const json = await res.json();
      items = (json.data || []).map(m => ({
        title: m.title_english || m.title,
        cover: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || '',
        total: m.chapters || '',
        unit: 'Ch',
        sub: `${m.type || 'Manga'} • ${m.chapters ? m.chapters + ' ch' : '?'}`
      }));
    } else if (cat === 'music') {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=6&entity=album`);
      const json = await res.json();
      items = (json.results || []).map(al => ({
        title: `${al.collectionName} - ${al.artistName}`,
        cover: (al.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
        total: al.trackCount || '',
        unit: 'Track',
        sub: `${al.artistName} • ${al.trackCount || '?'} tracks`
      }));
    } else {
      const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      items = (json || []).slice(0, 6).map(s => ({
        title: s.show?.name || '',
        cover: s.show?.image?.original || s.show?.image?.medium || '',
        total: '',
        unit: 'Item',
        sub: s.show?.premiered || 'Show'
      }));
    }

    if (items.length === 0) {
      listEl.innerHTML = `<p style="font-size:12px;color:var(--light-gray-70);">No results found.</p>`;
      return;
    }

    listEl.innerHTML = items.map(it => `
      <div class="api-result-item" onclick='applyApiAutofill(${JSON.stringify(it).replace(/'/g, "&#39;")}, "${cat}")'>
        <img src="${escapeHtml(it.cover || DEFAULT_COVER)}" alt="">
        <div class="api-result-info">
          <h4>${escapeHtml(it.title)}</h4>
          <p>${escapeHtml(it.sub)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<p style="font-size:12px;color:#ff7b7b;">Search failed.</p>`;
  }
};

window.applyApiAutofill = function (item, cat) {
  document.getElementById('media-title').value = item.title || '';
  if (item.cover) document.getElementById('media-cover').value = item.cover;

  const firstCard = document.querySelector('#media-tracks-editor .track-edit-card');
  if (firstCard) {
    firstCard.querySelector('.track-cat').value = cat;
    if (item.total) firstCard.querySelector('.track-total').value = item.total;
    if (item.unit) firstCard.querySelector('.track-unit').value = item.unit;
  }
  document.getElementById('api-search-results').style.display = 'none';
};

document.getElementById('media-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn) return;

  const id = document.getElementById('media-id').value;
  const title = document.getElementById('media-title').value.trim();
  const coverUrl = document.getElementById('media-cover').value.trim() || null;
  const ratingRaw = document.getElementById('media-rating').value;
  const rating = ratingRaw !== '' ? Number(ratingRaw) : null;
  const repeatCount = Number(document.getElementById('media-repeat').value) || 0;

  const trackCards = document.querySelectorAll('#media-tracks-editor .track-edit-card');
  const categoryTracks = [];
  trackCards.forEach(c => {
    const category = c.querySelector('.track-cat').value;
    const status = c.querySelector('.track-status').value;
    const progress = Number(c.querySelector('.track-prog').value) || 0;
    const totalRaw = c.querySelector('.track-total').value;
    const total = totalRaw !== '' ? Number(totalRaw) : null;
    const unit = c.querySelector('.track-unit').value;
    categoryTracks.push({ category, status, progress, total, unit });
  });

  const seasonCards = document.querySelectorAll('#media-seasons-editor .season-edit-card');
  const seasons = [];
  seasonCards.forEach(c => {
    const sTitle = c.querySelector('.season-title').value.trim();
    if (!sTitle) return;
    seasons.push({
      title: sTitle,
      category: categoryTracks[0]?.category || 'tv_show',
      status: c.querySelector('.season-status').value,
      progress: Number(c.querySelector('.season-prog').value) || 0,
      total: c.querySelector('.season-total').value !== '' ? Number(c.querySelector('.season-total').value) : null,
      unit: c.querySelector('.season-unit').value
    });
  });

  const primary = categoryTracks[0];
  const synced = computeSyncedStatus(getAllItemUnits({ category_tracks: categoryTracks, seasons }));
  const nowIso = new Date().toISOString();

  const payload = {
    title,
    cover_url: coverUrl,
    category: primary.category,
    status: synced.key,
    progress: primary.progress,
    total: primary.total,
    unit: primary.unit,
    rating,
    repeat_count: repeatCount,
    category_tracks: categoryTracks,
    seasons,
    updated_at: nowIso
  };

  if (id) {
    const { error } = await supabaseClient.from('media_logs').update(payload).eq('id', id);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Media updated', 'success');
  } else {
    payload.created_at = nowIso;
    const { error } = await supabaseClient.from('media_logs').insert([payload]);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    showToast('Media added', 'success');
  }

  closeMediaModal();
  await fetchMediaLogs();
});

window.deleteCurrentModalMedia = async function () {
  const id = document.getElementById('media-id')?.value;
  if (!id || !isAdminLoggedIn) return;

  const res = await Swal.fire({
    text: 'Delete this media entry?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (!res.isConfirmed) return;

  const { error } = await supabaseClient.from('media_logs').delete().eq('id', id);
  if (error) {
    showToast(error.message, 'error');
    return;
  }

  closeMediaModal();
  await fetchMediaLogs();
  showToast('Media deleted', 'info');
};

// ==========================================
// 8. ADMIN AI WORKSPACE (GROQ FULL-AUTO + DB TOGGLE)
// ==========================================
const GROQ_AUTO_POOL = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'allam-2-7b'
];

let groqPoolCursor = 0;
let isAiDbContextEnabled = false;

function initGroqKeyInput() {
  const savedKey = (localStorage.getItem(GROQ_KEY_STORAGE) || '').trim();
  const inputEl = document.getElementById('groq-api-key-input');
  if (inputEl && savedKey) inputEl.value = savedKey;
  setElText('ai-model-subtitle', 'Groq • Full Auto');
  syncAiDbToggleUI();
}

function syncAiDbToggleUI() {
  const btn = document.getElementById('btn-toggle-ai-db');
  const label = document.getElementById('ai-db-toggle-text');
  if (btn) btn.classList.toggle('active', isAiDbContextEnabled);
  if (label) label.textContent = isAiDbContextEnabled ? 'Read Database: ON' : 'Read Database: OFF';
}

window.toggleAiDatabaseContext = function () {
  isAiDbContextEnabled = !isAiDbContextEnabled;
  syncAiDbToggleUI();
  showToast(
    isAiDbContextEnabled
      ? 'Database context ON (Library & Notes included)'
      : 'Database context OFF (Token-saver mode)',
    'info'
  );
};

window.toggleAiSettings = function () {
  const panel = document.getElementById('ai-settings-panel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || panel.style.display === '';
  panel.style.display = isHidden ? 'flex' : 'none';
};

window.saveGroqApiKey = function () {
  const inputEl = document.getElementById('groq-api-key-input');
  if (!inputEl) return;

  const keyVal = inputEl.value.replace(/\s+/g, '').trim();

  if (!keyVal) {
    localStorage.removeItem(GROQ_KEY_STORAGE);
    showToast('Groq API key cleared', 'info');
  } else {
    localStorage.setItem(GROQ_KEY_STORAGE, keyVal);
    setElText('ai-model-subtitle', 'Groq • Full Auto');
    showToast('Groq API key saved', 'success');
  }

  const panel = document.getElementById('ai-settings-panel');
  if (panel) panel.style.display = 'none';
};

function updateAiContextSidebar() {
  setElText('ai-ctx-library-count', `${allMediaLogs.length} Library entries`);
  setElText('ai-ctx-notes-count', `${allBlogPosts.length} Personal notes`);
}

function scrollAiToBottom() {
  const listEl = document.getElementById('ai-messages-list');
  if (listEl) listEl.scrollTop = listEl.scrollHeight;
}

function formatAiMarkdown(rawText) {
  let text = escapeHtml(rawText || '');
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

async function fetchAiChatHistory() {
  if (!isAdminLoggedIn) return;

  const { data, error } = await supabaseClient
    .from('ai_chat_history')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(60);

  if (error) {
    console.warn('AI chat history fetch warning:', error.message);
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
        <h4>Hello, Admin</h4>
        <p>Token-saver mode is active. Turn on <strong>Read Database</strong> above when you want me to read your Library & Notes.</p>
      </div>
    `;
    return;
  }

  let html = aiChatMessages.map((msg, idx) => {
    const isUser = msg.role === 'user';
    const timeStr = msg.created_at
      ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    const saveBtnHtml = !isUser ? `
      <button type="button" class="ai-save-note-btn" onclick="saveAiReplyToNotes(${idx})" title="Publish this reply to Notes">
        <ion-icon name="bookmark-outline"></ion-icon>
        <span>Save to Notes</span>
      </button>
    ` : '';

    return `
      <div class="ai-msg-row ${isUser ? 'user' : 'model'}">
        <div class="ai-msg-bubble">${isUser ? escapeHtml(msg.content).replace(/\n/g, '<br>') : formatAiMarkdown(msg.content)}</div>
        <div class="ai-msg-footer">
          <span>${timeStr}</span>
          ${saveBtnHtml}
        </div>
      </div>
    `;
  }).join('');

  if (showTyping) {
    html += `
      <div class="ai-msg-row model">
        <div class="ai-msg-bubble">
          <div class="ai-typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
  }

  listEl.innerHTML = html;
  scrollAiToBottom();
}

function buildArchiveSystemContext() {
  const adminName = currentProfile.name || 'Admin';

  if (!isAiDbContextEnabled) {
    return `You are a concise, helpful personal AI assistant for ${adminName}. Reply in the same language as the user.`;
  }

  const totalMedia = allMediaLogs.length;
  const completedCount = allMediaLogs.filter(item => computeSyncedStatus(getAllItemUnits(item)).key === 'completed').length;

  const mediaSummaryLines = allMediaLogs.slice(0, 40).map(item => {
    const allUnits = getAllItemUnits(item);
    const cats = getItemCategories(item).map(c => CATEGORY_LABELS[c] || c).join('/');
    const synced = computeSyncedStatus(allUnits);
    const r = (item.rating !== null && item.rating !== undefined) ? `${item.rating}/10` : '-';
    return `${item.title} [${cats}|${synced.label}|${r}]`;
  }).join('; ');

  const notesSummaryLines = allBlogPosts.slice(0, 10).map(post => {
    const cleanText = (post.content || '').replace(/\s+/g, ' ').slice(0, 120);
    return `- ${cleanText}`;
  }).join('\n');

  return `You are ${adminName}'s personal AI assistant. Reply in the user's language.
Archive Stats: ${totalMedia} total, ${completedCount} completed.
Media (latest 40): ${mediaSummaryLines || 'None'}
Notes (latest 10):
${notesSummaryLines || 'None'}`;
}

window.handleAiInputKeydown = function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const form = document.getElementById('ai-composer-form');
    if (form) form.dispatchEvent(new Event('submit'));
  }
};

window.triggerQuickPrompt = function (promptText, forceReadDb = false) {
  if (forceReadDb && !isAiDbContextEnabled) {
    isAiDbContextEnabled = true;
    syncAiDbToggleUI();
  }
  const inputEl = document.getElementById('ai-prompt-input');
  if (!inputEl) return;
  inputEl.value = promptText;
  sendAiMessage(promptText);
};

window.handleAiFormSubmit = function (e) {
  e.preventDefault();
  const inputEl = document.getElementById('ai-prompt-input');
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text || isAiSending) return;
  inputEl.value = '';
  sendAiMessage(text);
};

async function sendGroqFullAuto(apiKey, messagesPayload) {
  const orderedModels = [];
  for (let i = 0; i < GROQ_AUTO_POOL.length; i++) {
    orderedModels.push(GROQ_AUTO_POOL[(groqPoolCursor + i) % GROQ_AUTO_POOL.length]);
  }
  groqPoolCursor = (groqPoolCursor + 1) % GROQ_AUTO_POOL.length;

  let lastErrorMsg = 'All Groq models are currently busy or rate-limited.';

  for (const modelId of orderedModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: messagesPayload,
          temperature: 0.7,
          max_tokens: 900
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setElText('ai-model-subtitle', `Groq • Auto (${modelId})`);
        return data?.choices?.[0]?.message?.content || 'No response received.';
      }

      lastErrorMsg = data?.error?.message || `Error ${response.status}`;

      if (response.status === 401) {
        throw new Error(lastErrorMsg);
      }

      continue;
    } catch (networkErr) {
      if (networkErr.message.toLowerCase().includes('invalid api key')) {
        throw networkErr;
      }
      lastErrorMsg = networkErr.message;
      continue;
    }
  }

  throw new Error(lastErrorMsg);
}

async function sendAiMessage(userText) {
  if (!isAdminLoggedIn) return;

  const apiKey = (localStorage.getItem(GROQ_KEY_STORAGE) || '').replace(/\s+/g, '').trim();
  if (!apiKey) {
    const panel = document.getElementById('ai-settings-panel');
    if (panel) panel.style.display = 'flex';
    showToast('Please enter your Groq API Key first', 'info');
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
    const recentHistory = aiChatMessages.slice(-4).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (m.content || '').slice(0, 800)
    }));

    const messagesPayload = [
      { role: 'system', content: buildArchiveSystemContext() },
      ...recentHistory
    ];

    const aiReplyText = await sendGroqFullAuto(apiKey, messagesPayload);
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
    console.error('Groq AI error:', err);
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
  if (!isAdminLoggedIn) return;
  const msg = aiChatMessages[msgIndex];
  if (!msg || !msg.content) return;

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
    showToast('Saved to Personal Notes', 'success');
  }
};

window.clearAiChatHistory = async function () {
  if (!isAdminLoggedIn) return;

  const confirm = await Swal.fire({
    text: 'Clear all AI chat history?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff5f5f',
    confirmButtonText: 'Clear',
    cancelButtonText: 'Cancel',
    background: '#1e1e1f',
    color: '#fff'
  });

  if (!confirm.isConfirmed) return;

  const { error } = await supabaseClient
    .from('ai_chat_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    showToast(error.message, 'error');
  } else {
    aiChatMessages = [];
    renderAiMessages(false);
    showToast('Chat history cleared', 'info');
  }
};
