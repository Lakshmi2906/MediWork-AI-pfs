/* login.js — HWMS Authentication */

const API_BASE = 'http://127.0.0.1:5000/api';

/* TAB SWITCHING */
function switchTab(tab) {
  const loginPanel    = document.getElementById('panelLogin');
  const registerPanel = document.getElementById('panelRegister');
  const tabLogin      = document.getElementById('tabLogin');
  const tabRegister   = document.getElementById('tabRegister');
  const slider        = document.getElementById('tabSlider');

  if (tab === 'login') {
    loginPanel.classList.add('active');
    registerPanel.classList.remove('active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    slider.classList.remove('right');
  } else {
    registerPanel.classList.add('active');
    loginPanel.classList.remove('active');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    slider.classList.add('right');
  }

  clearAllErrors();
}

/* PASSWORD TOGGLE */
function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
}

/* PASSWORD STRENGTH METER */
document.getElementById('regPw').addEventListener('input', function () {
  const val   = this.value;
  const bar   = document.getElementById('pwStrengthBar');
  const label = document.getElementById('pwStrengthLabel');

  let score = 0;
  if (val.length >= 8)           score++;
  if (/[A-Z]/.test(val))         score++;
  if (/[0-9]/.test(val))         score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { w: '0%',   bg: 'transparent', text: '',       color: ''        },
    { w: '25%',  bg: '#dc3545',     text: 'Weak',   color: '#dc3545' },
    { w: '50%',  bg: '#fd7e14',     text: 'Fair',   color: '#fd7e14' },
    { w: '75%',  bg: '#ffc107',     text: 'Good',   color: '#856404' },
    { w: '100%', bg: '#0F6E56',     text: 'Strong', color: '#0F6E56' },
  ];

  const lvl            = val.length === 0 ? levels[0] : levels[score] || levels[1];
  bar.style.width      = lvl.w;
  bar.style.background = lvl.bg;
  label.textContent    = lvl.text;
  label.style.color    = lvl.color;
});

/* TOAST */
function showToast(msg, type = 'error') {
  const wrap = document.getElementById('toastWrap');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');

  wrap.className = `toast-wrap ${type}`;
  icon.className = type === 'success'
    ? 'bi bi-check-circle-fill'
    : 'bi bi-exclamation-circle-fill';
  text.textContent = msg;

  wrap.classList.add('show');
  setTimeout(() => wrap.classList.remove('show'), 3500);
}

/* FIELD ERROR HELPERS */
function setError(inputId, errId, show) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (!input || !err) return;
  if (show) {
    input.classList.add('is-error');
    err.classList.add('show');
  } else {
    input.classList.remove('is-error');
    err.classList.remove('show');
  }
}

function clearAllErrors() {
  document.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
  document.querySelectorAll('.error.show').forEach(el => el.classList.remove('show'));
}

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', function () {
    this.classList.remove('is-error');
    const err = this.closest('.field')?.querySelector('.error');
    if (err) err.classList.remove('show');
  });
});

/* LOGIN FORM */
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearAllErrors();

  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPw').value;
  let valid   = true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('loginEmail', 'loginEmailErr', true);
    valid = false;
  }
  if (!pw) {
    setError('loginPw', 'loginPwErr', true);
    valid = false;
  }
  if (!valid) return;

  const btn     = document.getElementById('loginBtn');
  const spinner = document.getElementById('loginSpinner');
  const label   = btn.querySelector('.btn-label');
  btn.disabled  = true;
  spinner.classList.remove('d-none');
  label.textContent = 'Signing in…';

  try {
    const res  = await fetch(`${API_BASE}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pw }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Invalid email or password.', 'error');
      return;
    }

    localStorage.setItem('hwms_token', data.token);
    localStorage.setItem('hwms_user',  JSON.stringify(data.user));

    showToast(`Welcome back, ${data.user.first_name}!`, 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);

  } catch (err) {
    showToast('Cannot connect to server. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('d-none');
    label.textContent = 'Sign In';
  }
});

/* REGISTER FORM */
document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearAllErrors();

  const first     = document.getElementById('regFirst').value.trim();
  const last      = document.getElementById('regLast').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const role      = document.getElementById('regRole').value;
  const dept      = document.getElementById('regDept').value;
  const pw        = document.getElementById('regPw').value;
  const pwConfirm = document.getElementById('regPwConfirm').value;
  let valid       = true;

  if (!first) { setError('regFirst', 'regFirstErr', true); valid = false; }
  if (!last)  { setError('regLast',  'regLastErr',  true); valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('regEmail', 'regEmailErr', true); valid = false;
  }
  if (!role) { setError('regRole', 'regRoleErr', true); valid = false; }
  if (!dept) { setError('regDept', 'regDeptErr', true); valid = false; }
  if (!pw || pw.length < 8) {
    setError('regPw', 'regPwErr', true); valid = false;
  }
  if (pw !== pwConfirm) {
    setError('regPwConfirm', 'regPwConfirmErr', true); valid = false;
  }
  if (!valid) return;

  const btn     = document.getElementById('registerBtn');
  const spinner = document.getElementById('registerSpinner');
  const label   = btn.querySelector('.btn-label');
  btn.disabled  = true;
  spinner.classList.remove('d-none');
  label.textContent = 'Creating account…';

  try {
    const res  = await fetch(`${API_BASE}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        first_name: first,
        last_name:  last,
        email,
        role,
        department: dept,
        password:   pw,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Registration failed.', 'error');
      return;
    }

    showToast('Account created! Please sign in.', 'success');
    setTimeout(() => {
      switchTab('login');
      document.getElementById('loginEmail').value = email;
    }, 1200);

  } catch (err) {
    showToast('Cannot connect to server. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('d-none');
    label.textContent = 'Create Account';
  }
});
