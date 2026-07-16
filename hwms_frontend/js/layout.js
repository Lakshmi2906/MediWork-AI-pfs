/* layout.js — HWMS Shared Layout Logic */

document.addEventListener('DOMContentLoaded', () => {

  const user = JSON.parse(localStorage.getItem('hwms_user') || '{}');

  // Topbar user info
  const tName   = document.getElementById('topName');
  const tRole   = document.getElementById('topRole');
  const tAvatar = document.getElementById('topAvatar');
  if (tName)   tName.textContent   = user.first_name ? `${user.first_name} ${user.last_name}` : 'User';
  if (tRole)   tRole.textContent   = user.role || 'Staff';
  if (tAvatar) tAvatar.textContent = user.first_name ? user.first_name[0].toUpperCase() : 'U';

  // Sidebar footer user info
  const sfName   = document.getElementById('sfName');
  const sfRole   = document.getElementById('sfRole');
  const sfAvatar = document.getElementById('sfAvatar');
  if (sfName)   sfName.textContent   = user.first_name ? `${user.first_name} ${user.last_name}` : 'User';
  if (sfRole)   sfRole.textContent   = user.role || 'Staff';
  if (sfAvatar) sfAvatar.textContent = user.first_name ? user.first_name[0].toUpperCase() : 'U';

  // Sidebar toggle (mobile)
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('overlay');
  const hamburger = document.getElementById('hamburger');

  function openSidebar()  { sidebar?.classList.add('open');    overlay?.classList.add('show'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('show'); }

  hamburger?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('hwms_token');
    localStorage.removeItem('hwms_user');
    window.location.href = 'login.html';
  });

  // Toast (global)
  window.showToast = function(msg, type = 'success') {
    const wrap = document.getElementById('toastWrap');
    const icon = document.getElementById('toastIcon');
    const text = document.getElementById('toastMsg');
    if (!wrap) return;
    wrap.className   = `toast-wrap ${type}`;
    icon.className   = type === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-circle-fill';
    text.textContent = msg;
    wrap.classList.add('show');
    setTimeout(() => wrap.classList.remove('show'), 3500);
  };

});
