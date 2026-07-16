/* training_reports.js — live API version */

const API = 'http://127.0.0.1:5000/api';
const token   = () => localStorage.getItem('hwms_token');
const authHdr = () => ({ 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' });

let trainings     = [];
let notifications = [];

const reports = [
  { id:'employees',  icon:'bi-people-fill',               iconBg:'#E1F5EE', iconColor:'#0F6E56', title:'Employee Report',    desc:'Full employee directory with roles, departments and status.' },
  { id:'attendance', icon:'bi-calendar-check-fill',       iconBg:'#EAF3DE', iconColor:'#3B6D11', title:'Attendance Report',  desc:'Daily and monthly attendance summaries with trends.' },
  { id:'leave',      icon:'bi-calendar-x-fill',           iconBg:'#FAEEDA', iconColor:'#854F0B', title:'Leave Report',       desc:'Leave requests, approvals, balances and history.' },
  { id:'training',   icon:'bi-mortarboard-fill',          iconBg:'#E6F1FB', iconColor:'#185FA5', title:'Training Report',    desc:'Certificate status, compliance overview and expiry alerts.' },
  { id:'burnout',    icon:'bi-exclamation-triangle-fill', iconBg:'#FAECE7', iconColor:'#99351D', title:'Burnout Risk Report', desc:'ML-predicted burnout risk scores per employee.' },
];

document.addEventListener('DOMContentLoaded', async () => {

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  await loadTrainings();
  await loadNotifications();
  renderReports();

  document.getElementById('trainSearch').addEventListener('input', filterTrainings);
  document.getElementById('trainStatusFilter').addEventListener('change', filterTrainings);

  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    try {
      await fetch(`${API}/notifications/mark-all-read`, { method: 'PATCH', headers: authHdr() });
      await loadNotifications();
      showToast('All notifications marked as read.', 'success');
    } catch {
      showToast('Failed to update notifications.', 'error');
    }
  });

  document.getElementById('addTrainingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const spinner = document.getElementById('addTrainSpinner');
    const btn     = form.querySelector('[type="submit"]');
    btn.disabled  = true;
    spinner.classList.remove('d-none');

    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);

    try {
      const res  = await fetch(`${API}/trainings`, { method: 'POST', headers: authHdr(), body: JSON.stringify(data) });
      const json = await res.json();
      if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('addTrainingModal'))?.hide();
        showToast(json.message || 'Training saved.', 'success');
        form.reset();
        form.classList.remove('was-validated');
        await loadTrainings();
      } else {
        showToast(json.message || 'Save failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }

    btn.disabled = false;
    spinner.classList.add('d-none');
  });
});

async function loadTrainings() {
  try {
    const res = await fetch(`${API}/trainings`, { headers: authHdr() });
    trainings = await res.json();
  } catch {
    showToast('Failed to load trainings.', 'error');
    trainings = [];
  }
  renderTrainTable();
}

function certBadge(status) {
  const map = { 'Valid': 'badge-success', 'Expiring Soon': 'badge-warning', 'Expired': 'badge-danger' };
  return `<span class="badge ${map[status] || 'badge-info'}">${status}</span>`;
}

function renderTrainTable(data = trainings) {
  const tbody = document.getElementById('trainTableBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-mortarboard"></i><p>No training records found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(t => `
    <tr>
      <td>
        <div class="cell-user">
          <div class="avatar">${t.employee.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
          <div>
            <div class="cell-name">${t.employee}</div>
            <div class="cell-sub">${t.dept}</div>
          </div>
        </div>
      </td>
      <td>${t.name}</td>
      <td>${t.completed}</td>
      <td>${t.expiry}</td>
      <td>${certBadge(t.status)}</td>
    </tr>
  `).join('');
}

function filterTrainings() {
  const q      = document.getElementById('trainSearch').value.toLowerCase();
  const status = document.getElementById('trainStatusFilter').value;
  renderTrainTable(trainings.filter(t => {
    const matchQ = `${t.employee} ${t.name} ${t.dept}`.toLowerCase().includes(q);
    const matchS = !status || t.status === status;
    return matchQ && matchS;
  }));
}

async function loadNotifications() {
  try {
    const res     = await fetch(`${API}/notifications`, { headers: authHdr() });
    notifications = await res.json();
  } catch {
    notifications = [];
  }
  renderNotifications();
}

function renderNotifications() {
  const list        = document.getElementById('notifList');
  const unreadCount = notifications.filter(n => n.unread).length;

  const badge = document.getElementById('unreadBadge');
  badge.textContent   = unreadCount;
  badge.style.display = unreadCount > 0 ? '' : 'none';

  if (notifications.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="bi bi-bell-slash"></i><p>No notifications.</p></div>`;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" id="notif-${n.id}">
      <div class="notif-icon" style="background:${n.iconBg};color:${n.iconColor}">
        <i class="bi ${n.icon}"></i>
      </div>
      <div class="flex-grow-1">
        <div class="notif-text ${n.unread ? '' : 'read'}">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${n.unread ? '<div class="notif-dot-mark"></div>' : ''}
    </div>
  `).join('');
}

function renderReports() {
  document.getElementById('reportsGrid').innerHTML = reports.map(r => `
    <div class="report-card">
      <div class="report-icon" style="background:${r.iconBg};color:${r.iconColor}">
        <i class="bi ${r.icon}"></i>
      </div>
      <div>
        <div class="report-title">${r.title}</div>
        <div class="report-desc">${r.desc}</div>
      </div>
      <div class="report-actions">
        <button class="btn-pdf"   onclick="exportReport('${r.id}','pdf')"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
        <button class="btn-excel" onclick="exportReport('${r.id}','excel')"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</button>
      </div>
    </div>
  `).join('');
}

window.exportReport = function(reportId, format) {
  fetch(`${API}/reports/${reportId}/export?format=${format}`, {
    headers: { 'Authorization': 'Bearer ' + token() }
  })
    .then(res => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    })
    .then(blob => {
      const ext = format === 'excel' ? 'xlsx' : format;
      const a   = document.createElement('a');
      a.href    = URL.createObjectURL(blob);
      a.download = `${reportId}_report.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => showToast('Export failed. Make sure openpyxl / reportlab is installed.', 'error'));
};
