/* ==========================================
   VARIABLES & BASE RESET
========================================== */
:root {
  --smoky-black: #0f0f10;
  --eerie-black-1: #161618;
  --eerie-black-2: #1e1e20;
  --onyx: #28282b;
  --jet: #36363a;
  --white-1: #ffffff;
  --white-2: #f4f4f6;
  --light-gray: #c8c8cf;
  --light-gray-70: rgba(200, 200, 207, 0.7);
  --bittersweet-shimmer: #ff5f5f;

  --ff-poppins: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
  --shadow-1: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-2: 0 16px 40px rgba(0, 0, 0, 0.55);
  --transition-1: 0.22s ease;
}

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-family: var(--ff-poppins);
  scroll-behavior: smooth;
  background-color: var(--smoky-black);
  color: var(--white-2);
}

body {
  min-height: 100vh;
  background: var(--smoky-black);
  line-height: 1.5;
  overflow-x: hidden;
  padding: 20px 16px 48px;
}

a {
  text-decoration: none;
  color: inherit;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button {
  background: none;
  border: none;
  cursor: pointer;
}

img {
  display: block;
  max-width: 100%;
}

/* ==========================================
   TOAST NOTIFICATION
========================================== */
.toast-container {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}

.toast-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  color: var(--white-1);
  font-size: 12px;
  font-weight: 500;
  box-shadow: var(--shadow-2);
  animation: toastSlideUp 0.22s ease forwards;
}

.toast-item.success ion-icon { color: #4ade80; font-size: 16px; }
.toast-item.error ion-icon { color: #ff5f5f; font-size: 16px; }
.toast-item.info ion-icon { color: #60a5fa; font-size: 16px; }

.toast-item.hide {
  opacity: 0;
  transform: translateY(8px);
  transition: 0.2s ease;
}

@keyframes toastSlideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ==========================================
   STICKY MINI HEADER (ON SCROLL)
========================================== */
.sticky-mini-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: rgba(22, 22, 24, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--jet);
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 0.25s ease, opacity 0.25s ease;
  pointer-events: none;
}

.sticky-mini-header.visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.sticky-mini-inner {
  max-width: 920px;
  margin: 0 auto;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sticky-mini-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
}

.sticky-mini-profile img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--jet);
  background: var(--onyx);
}

.sticky-mini-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--white-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sticky-mini-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-tab-btn {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--light-gray-70);
  transition: var(--transition-1);
}

.mini-tab-btn:hover {
  color: var(--white-1);
}

.mini-tab-btn.active {
  background: var(--onyx);
  color: var(--white-1);
  border: 1px solid var(--jet);
}

/* ==========================================
   MAIN CONTAINER & CARD SECTIONS
========================================== */
.single-page-container {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card-section {
  background: var(--eerie-black-1);
  border: 1px solid var(--jet);
  border-radius: 20px;
  box-shadow: var(--shadow-1);
  position: relative;
}

/* ==========================================
   1. PROFILE HEADER & DYNAMIC BANNER
========================================== */
.profile-header {
  overflow: hidden;
}

.profile-banner-wrap {
  position: relative;
  width: 100%;
  height: 170px;
  background: var(--onyx);
  overflow: hidden;
}

.profile-banner-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15, 15, 16, 0.15), rgba(22, 22, 24, 0.92));
}

.profile-top-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-btn,
.icon-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--white-1);
  background: rgba(30, 30, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.icon-pill-btn {
  padding: 7px 9px;
}

.pill-btn:hover,
.icon-pill-btn:hover {
  border-color: var(--white-1);
  background: var(--onyx);
}

.primary-btn {
  background: var(--onyx);
  border-color: rgba(255, 255, 255, 0.22);
}

.profile-content-body {
  padding: 24px;
  position: relative;
}

.profile-header.has-banner .profile-content-body {
  padding-top: 0;
  margin-top: -42px;
}

.profile-main {
  display: flex;
  align-items: flex-end;
  gap: 18px;
}

.profile-avatar {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  overflow: hidden;
  border: 3px solid var(--eerie-black-1);
  background: var(--onyx);
  flex-shrink: 0;
  box-shadow: var(--shadow-1);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-details {
  flex: 1;
  min-width: 0;
  padding-bottom: 2px;
}

.profile-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--white-1);
  line-height: 1.25;
}

.profile-bio {
  font-size: 13px;
  color: var(--light-gray);
  margin-top: 4px;
  word-break: break-word;
}

.profile-socials {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.social-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 9px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  font-size: 11px;
  font-weight: 500;
  color: var(--light-gray);
  transition: var(--transition-1);
}

.social-chip:hover {
  color: var(--white-1);
  border-color: var(--white-1);
  transform: translateY(-1px);
}

.social-chip ion-icon {
  font-size: 14px;
}

/* ==========================================
   2. MAIN SWITCHER BAR & TABS
========================================== */
.library-section {
  padding: 20px 24px 26px;
}

.main-switcher-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--jet);
  flex-wrap: wrap;
}

.main-view-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 600;
  color: var(--light-gray-70);
  background: transparent;
  border: 1px solid transparent;
  transition: var(--transition-1);
}

.main-view-btn:hover {
  color: var(--white-1);
  background: rgba(255, 255, 255, 0.04);
}

.main-view-btn.active {
  color: var(--white-1);
  background: var(--eerie-black-2);
  border-color: var(--jet);
}

.main-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.minimal-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--white-1);
  background: var(--onyx);
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: var(--transition-1);
}

.minimal-add-btn ion-icon {
  font-size: 15px;
  color: var(--white-1);
}

.minimal-add-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--white-1);
  transform: translateY(-1px);
}

.tab-view-panel.active-view {
  animation: tabFadeSlide 0.22s ease forwards;
}

@keyframes tabFadeSlide {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-state {
  text-align: center;
  padding: 42px 16px;
  font-size: 13px;
  color: var(--light-gray-70);
  grid-column: 1 / -1;
}

/* ==========================================
   3. PERSONAL NOTES / BLOG FEED
========================================== */
.blog-feed-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.blog-post-card {
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-post-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.blog-post-author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.blog-post-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--onyx);
  border: 1px solid var(--jet);
  flex-shrink: 0;
}

.blog-post-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.blog-post-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--white-1);
}

.blog-post-time {
  font-size: 11px;
  color: var(--light-gray-70);
}

.blog-post-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.blog-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--light-gray-70);
  background: var(--onyx);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.blog-icon-btn:hover {
  color: var(--white-1);
  border-color: var(--white-1);
}

.blog-icon-btn.delete:hover {
  color: #ff5f5f;
  border-color: #ff5f5f;
}

.blog-post-text {
  font-size: 13.5px;
  color: var(--white-2);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.inline-note-link {
  color: #7dd3fc;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-preview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.link-preview-card:hover {
  border-color: var(--white-1);
}

.link-preview-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--eerie-black-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--white-1);
  flex-shrink: 0;
}

.link-preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.link-preview-domain {
  font-size: 11px;
  color: var(--light-gray-70);
}

.link-preview-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--white-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.blog-post-image-wrap {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--jet);
  max-height: 440px;
}

.blog-post-image-wrap img {
  width: 100%;
  max-height: 440px;
  object-fit: cover;
}

/* ==========================================
   4. LIBRARY STATS & CONTROLS BAR
========================================== */
.library-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.stats-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--light-gray);
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
  white-space: nowrap;
}

.stats-toggle-btn:hover,
.stats-toggle-btn.active {
  color: var(--white-1);
  border-color: var(--white-1);
}

.library-right-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-total-badge {
  display: inline-flex;
  align-items: center;
  height: 32px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--light-gray);
  padding: 0 10px;
  border-radius: 9px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  white-space: nowrap;
}

.per-page-select {
  appearance: none;
  -webkit-appearance: none;
  height: 32px;
  background-color: var(--eerie-black-2);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8c8cf' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
  border: 1px solid var(--jet);
  border-radius: 9px;
  padding: 0 26px 0 10px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--light-gray);
  outline: none;
  cursor: pointer;
  transition: var(--transition-1);
  white-space: nowrap;
}

.per-page-select:hover,
.per-page-select:focus {
  border-color: var(--white-1);
  color: var(--white-1);
}

.per-page-select option {
  background: var(--eerie-black-2);
  color: var(--white-1);
}

.view-mode-switch {
  display: inline-flex;
  align-items: center;
  height: 32px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
}

.view-mode-btn {
  width: 28px;
  height: 26px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--light-gray-70);
  font-size: 15px;
  transition: var(--transition-1);
}

.view-mode-btn:hover {
  color: var(--white-1);
}

.view-mode-btn.active {
  background: var(--onyx);
  color: var(--white-1);
}

/* Collapsible Stats Grid */
.collapsible-stats-panel {
  margin-bottom: 16px;
  animation: tabFadeSlide 0.2s ease forwards;
}

.stats-modern-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-card-modern {
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--white-1);
  flex-shrink: 0;
}

.stat-info-modern {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-val-modern {
  font-size: 16px;
  font-weight: 700;
  color: var(--white-1);
  line-height: 1.2;
}

.stat-name-modern {
  font-size: 11px;
  font-weight: 500;
  color: var(--light-gray);
}

.stat-sub-modern {
  font-size: 10px;
  color: var(--light-gray-70);
}

/* Category Tabs */
.library-top-bar {
  margin-bottom: 12px;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.cat-tab {
  padding: 6px 13px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--light-gray-70);
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  white-space: nowrap;
  transition: var(--transition-1);
}

.cat-tab:hover {
  color: var(--white-1);
}

.cat-tab.active {
  background: var(--white-1);
  color: var(--smoky-black);
  border-color: var(--white-1);
  font-weight: 600;
}

/* ==========================================
   SEARCHBAR + FILTER & SORT TOOLBAR
========================================== */
.library-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  width: 100%;
}

.search-box {
  flex: 1 1 auto;
  min-width: 0;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 11px;
  padding: 0 12px;
  transition: var(--transition-1);
}

.search-box:focus-within {
  border-color: var(--white-1);
}

.search-box ion-icon {
  font-size: 16px;
  color: var(--light-gray-70);
  flex-shrink: 0;
}

.search-box input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12.5px;
  color: var(--white-1);
}

.toolbar-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.popover-wrapper {
  position: relative;
}

.toolbar-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 500;
  color: var(--light-gray);
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
  white-space: nowrap;
}

.toolbar-action-btn ion-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.toolbar-action-btn:hover,
.toolbar-action-btn.active {
  color: var(--white-1);
  border-color: var(--white-1);
  background: var(--onyx);
}

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  flex-shrink: 0;
}

/* Popover Dropdown Menu */
.toolbar-popover-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 248px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 14px;
  padding: 14px;
  box-shadow: var(--shadow-2);
  z-index: 75;
  display: none;
  flex-direction: column;
  gap: 12px;
  animation: tabFadeSlide 0.18s ease forwards;
}

.toolbar-popover-menu.open {
  display: flex;
}

.popover-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.popover-field > label:first-child {
  font-size: 11px;
  font-weight: 600;
  color: var(--light-gray-70);
}

.control-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 34px;
  background-color: var(--onyx);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c8c8cf' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  border: 1px solid var(--jet);
  border-radius: 9px;
  padding: 0 28px 0 10px;
  font-size: 12px;
  color: var(--white-1);
  outline: none;
  cursor: pointer;
}

.control-select:focus {
  border-color: var(--white-1);
}

.control-select option {
  background: var(--eerie-black-2);
  color: var(--white-1);
}

.range-input-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.range-sep {
  font-size: 12px;
  color: var(--light-gray-70);
  text-align: center;
}

.range-num-input {
  width: 100%;
  min-width: 0;
  height: 34px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  border-radius: 9px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--white-1);
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}

.range-num-input::-webkit-outer-spin-button,
.range-num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.range-num-input:focus {
  border-color: var(--white-1);
}

.range-num-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.checkbox-inline-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--light-gray);
  cursor: pointer;
  margin-top: 2px;
}

.checkbox-inline-label input[type="checkbox"] {
  accent-color: var(--white-1);
  width: 13px;
  height: 13px;
  cursor: pointer;
}

.popover-reset-btn {
  width: 100%;
  height: 32px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--light-gray);
  background: var(--onyx);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.popover-reset-btn:hover {
  color: var(--white-1);
  border-color: var(--white-1);
}

.sort-dir-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.sort-dir-btn {
  height: 32px;
  padding: 0 8px;
  border-radius: 9px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--light-gray-70);
  background: var(--onyx);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.sort-dir-btn:hover {
  color: var(--white-1);
}

.sort-dir-btn.active {
  background: var(--white-1);
  color: var(--smoky-black);
  border-color: var(--white-1);
  font-weight: 600;
}

/* ==========================================
   5. MEDIA GRID & COMPACT LIST VIEW
========================================== */
.media-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.media-card {
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 15px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.media-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.32);
}

.media-cover-wrap {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--onyx);
  overflow: hidden;
}

.media-cover-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.media-card:hover .media-cover-wrap img {
  transform: scale(1.03);
}

.cover-left-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  max-width: calc(100% - 44px);
}

.badge-cat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-cat,
.badge-rating,
.badge-repeat,
.badge-seasons {
  padding: 3px 7px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(15, 15, 16, 0.82);
  backdrop-filter: blur(6px);
  color: var(--white-1);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.badge-rating {
  color: #fbbf24;
}

.badge-repeat {
  color: #38bdf8;
}

.badge-seasons {
  position: absolute;
  bottom: 8px;
  left: 8px;
}

.cover-edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(15, 15, 16, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--white-1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: var(--transition-1);
}

.cover-edit-btn:hover {
  background: var(--white-1);
  color: var(--smoky-black);
}

.media-body {
  padding: 11px 12px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 9px;
}

.media-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--white-1);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.media-bottom-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.media-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.status-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  text-transform: capitalize;
}

.status-pill.completed { background: rgba(74, 222, 128, 0.16); color: #4ade80; }
.status-pill.ongoing { background: rgba(56, 189, 248, 0.16); color: #38bdf8; }
.status-pill.planned { background: rgba(168, 162, 158, 0.18); color: #d6d3d1; }
.status-pill.dropped { background: rgba(248, 113, 113, 0.16); color: #f87171; }

.progress-pill {
  font-size: 11px;
  font-weight: 600;
  color: var(--light-gray);
}

.progress-track {
  width: 100%;
  height: 4px;
  border-radius: 99px;
  background: var(--onyx);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}

.progress-fill.completed { background: #4ade80; }
.progress-fill.ongoing { background: #38bdf8; }
.progress-fill.planned { background: #78716c; }
.progress-fill.planned.planned-empty { opacity: 0.35; }
.progress-fill.dropped { background: #f87171; }

.media-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--light-gray-70);
}

.status-date-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Compact List Mode */
.media-grid.list-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  cursor: pointer;
  transition: var(--transition-1);
}

.media-list-row:hover {
  border-color: rgba(255, 255, 255, 0.32);
}

.list-thumb {
  width: 36px;
  height: 50px;
  border-radius: 7px;
  object-fit: cover;
  background: var(--onyx);
  flex-shrink: 0;
}

.list-main-info {
  flex: 1;
  min-width: 0;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--white-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-sub-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--light-gray-70);
  margin-top: 2px;
}

.list-cat-tag {
  color: var(--light-gray);
  font-weight: 500;
}

.list-repeat-tag {
  color: #38bdf8;
}

.list-right-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.list-rating-pill {
  font-size: 11.5px;
  font-weight: 600;
  color: #fbbf24;
  min-width: 46px;
  text-align: right;
}

.list-edit-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  color: var(--light-gray);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-1);
}

.list-edit-btn:hover {
  color: var(--white-1);
  border-color: var(--white-1);
}

/* Load More */
.load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 500;
  color: var(--white-1);
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  transition: var(--transition-1);
}

.load-more-btn:hover {
  border-color: var(--white-1);
  background: var(--onyx);
}

/* ==========================================
   6. FOOTER & BACK TO TOP
========================================== */
.section-footer {
  margin-top: 8px;
  padding: 0 6px;
}

.footer-divider {
  height: 1px;
  background: var(--jet);
  margin-bottom: 14px;
}

.footer-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11.5px;
  color: var(--light-gray-70);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-name {
  font-weight: 700;
  color: var(--white-1);
  letter-spacing: 0.6px;
}

.back-to-top-btn {
  position: fixed;
  bottom: 22px;
  right: 22px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  color: var(--white-1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: var(--shadow-2);
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
  transition: var(--transition-1);
  z-index: 80;
}

.back-to-top-btn.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.back-to-top-btn:hover {
  border-color: var(--white-1);
  background: var(--onyx);
}

/* ==========================================
   7. MODALS & FORMS
========================================== */
.custom-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.custom-modal.active {
  display: flex;
}

.custom-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
}

.custom-modal-box {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--eerie-black-1);
  border: 1px solid var(--jet);
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow: var(--shadow-2);
  animation: tabFadeSlide 0.2s ease forwards;
}

.custom-modal-box.modal-lg {
  max-width: 580px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--jet);
}

.modal-header .h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--white-1);
}

.modal-close {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  color: var(--light-gray);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: var(--transition-1);
}

.modal-close:hover {
  color: var(--white-1);
  border-color: var(--white-1);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--light-gray);
}

.form-input {
  width: 100%;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 12.5px;
  color: var(--white-1);
  outline: none;
  transition: var(--transition-1);
}

.form-input:focus {
  border-color: var(--white-1);
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.api-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-results-list {
  margin-top: 6px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 11px;
  max-height: 210px;
  overflow-y: auto;
}

.api-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--jet);
  cursor: pointer;
  transition: var(--transition-1);
}

.api-result-item:last-child {
  border-bottom: none;
}

.api-result-item:hover {
  background: var(--onyx);
}

.api-result-item img {
  width: 34px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.api-result-info h4 {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--white-1);
}

.api-result-info p {
  font-size: 11px;
  color: var(--light-gray-70);
}

/* Tracks, Seasons & Social Link Editors */
.tracks-editor-list,
.seasons-editor-list,
.social-links-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.track-edit-card,
.season-edit-card {
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.track-edit-top,
.season-edit-top,
.social-edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-edit-grid,
.season-edit-grid {
  display: grid;
  grid-template-columns: 1.15fr 1.15fr 0.85fr 0.95fr;
  gap: 6px;
}

.progress-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.step-plus-btn {
  padding: 0 9px;
  height: 36px;
  border-radius: 9px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  font-size: 11px;
  font-weight: 600;
  color: var(--white-1);
  flex-shrink: 0;
  transition: var(--transition-1);
}

.step-plus-btn:hover {
  border-color: var(--white-1);
}

.social-remove-btn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--onyx);
  border: 1px solid var(--jet);
  color: #ff6b6b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: var(--transition-1);
}

.social-remove-btn:hover {
  border-color: #ff6b6b;
}

.modal-submit-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.form-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 11px;
  font-size: 12.5px;
  font-weight: 600;
  transition: var(--transition-1);
}

.primary-submit {
  background: var(--white-1);
  color: var(--smoky-black);
}

.primary-submit:hover {
  opacity: 0.9;
}

.danger-submit {
  background: rgba(255, 95, 95, 0.14);
  color: #ff5f5f;
  border: 1px solid rgba(255, 95, 95, 0.35);
}

.danger-submit:hover {
  background: #ff5f5f;
  color: var(--white-1);
}

/* Media Detail Modal */
.media-detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.detail-poster {
  width: 110px;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid var(--jet);
  flex-shrink: 0;
}

.detail-meta-col {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.detail-section-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--light-gray-70);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--eerie-black-2);
  border: 1px solid var(--jet);
  font-size: 12.5px;
}

/* ==========================================
   8. RESPONSIVE BREAKPOINTS
========================================== */
@media (max-width: 768px) {
  .media-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stats-modern-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  body {
    padding: 12px 10px 40px;
  }

  .library-section {
    padding: 16px 14px 22px;
  }

  .profile-banner-wrap {
    height: 130px;
  }

  .profile-content-body {
    padding: 16px;
  }

  .profile-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .profile-avatar {
    width: 74px;
    height: 74px;
  }

  .library-controls {
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1 1 100%;
  }

  .toolbar-btn-group {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .toolbar-action-btn {
    width: 100%;
  }

  #filter-popover-menu {
    left: 0;
    right: auto;
    width: min(260px, calc(100vw - 48px));
  }

  #sort-popover-menu {
    right: 0;
    left: auto;
    width: min(240px, calc(100vw - 48px));
  }

  .media-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .list-hide-mobile {
    display: none;
  }

  .track-edit-grid,
  .season-edit-grid {
    grid-template-columns: 1fr 1fr;
  }

  .form-row-2 {
    grid-template-columns: 1fr;
  }

  .api-search-row {
    flex-wrap: wrap;
  }
}
