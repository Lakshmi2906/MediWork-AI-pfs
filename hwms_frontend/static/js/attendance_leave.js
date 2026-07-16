/* attendance_leave.js — live API version */

const API = 'http://127.0.0.1:5000/api';
const token   = () => localStorage.getItem('hwms_token');
const authHdr = () => ({ 'Authorization': 'Bearer ' + token() });

let attendance    = [];
let leaveRequests = [];

document.addEventListener('DOMContentLoaded', async () => {

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  await loadAttendance();
  await loadLeave();

  document.getElementById('attDateFilter').addEventListener('change', loadAttendance);
  document.getElementById('attDeptFilter').addEventListener('change', loadAttendance);
  document.getElementById('attClearBtn').addEventListener('click', () => {
    document.getElementById('attDateFilter').value = '';
    document.getElementById('attDeptFilter').value = '';
    loadAttendance();
  });

  document.getElementById('leaveStatusFilter').addEventListener('change', filterLeave);
  document.getElementById('leaveTypeFilter').addEventListener('change', filterLeave);
});

const ATT_PER_PAGE = 6;
let attPage = 1;
let filteredAtt = [];

async function loadAttendance() {
  const date = document.getElementById('attDateFilter').value;
  const dept = document.getElementById('attDeptFilter').value;
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (dept) params.append('department', dept);

  try {
    const res  = await fetch(`${API}/attendance?${params}`, { headers: authHdr() });
    attendance = await res.json();
  } catch {
    showToast('Failed to load attendance.', 'error');
    attendance = [];
  }
  filteredAtt = [...attendance];
  attPage = 1;
  renderAttTable();
}

function renderAttTable() {
  const tbody = document.getElementById('attTableBody');
  const start = (attPage - 1) * ATT_PER_PAGE;
  const slice = filteredAtt.slice(start, start + ATT_PER_PAGE);

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-calendar-x"></i><p>No attendance records found.</p></div></td></tr>`;
    document.getElementById('presentCount').textContent = 0;
    document.getElementById('absentCount').textContent  = 0;
    return;
  }

  tbody.innerHTML = slice.map(r => `
    <tr>
      <td>
        <div class="cell-user">
          <div class="avatar">${r.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
          <div class="cell-name">${r.name}</div>
        </div>
      </td>
      <td>${r.dept}</td>
      <td>${r.date}</td>
      <td>${r.checkin || '—'}</td>
      <td>${r.checkout || '—'}</td>
      <td>${r.hours || '—'}</td>
      <td><span class="badge ${r.status === 'Present' ? 'badge-success' : 'badge-danger'}">${r.status}</span></td>
    </tr>
  `).join('');

  document.getElementById('attPaginationInfo').textContent =
    `Showing ${start + 1}–${Math.min(start + ATT_PER_PAGE, filteredAtt.length)} of ${filteredAtt.length}`;

  const total = Math.ceil(filteredAtt.length / ATT_PER_PAGE);
  const container = document.getElementById('attPageBtns');
  container.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn${i === attPage ? ' active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => { attPage = i; renderAttTable(); });
    container.appendChild(btn);
  }

  document.getElementById('presentCount').textContent = filteredAtt.filter(r => r.status === 'Present').length;
  document.getElementById('absentCount').textContent  = filteredAtt.filter(r => r.status === 'Absent').length;
}

let filteredLeave = [];

async function loadLeave() {
  try {
    const res     = await fetch(`${API}/leave-requests`, { headers: authHdr() });
    leaveRequests = await res.json();
  } catch {
    showToast('Failed to load leave requests.', 'error');
    leaveRequests = [];
  }
  filteredLeave = [...leaveRequests];
  renderLeaveCards();
}

function badgeClass(status) {
  return { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' }[status] || 'badge-info';
}

function renderLeaveCards(data = filteredLeave) {
  const grid = document.getElementById('leaveCardsGrid');

  if (data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-x"></i><p>No leave requests found.</p></div>`;
    return;
  }

  grid.innerHTML = data.map(r => `
    <div class="leave-card ${r.status !== 'Pending' ? 'resolved' : ''}" id="leaveCard-${r.id}">
      <div class="leave-avatar">${r.initials || r.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
      <div class="leave-body">
        <div class="leave-name">${r.name}</div>
        <div class="leave-type">${r.type}</div>
        <div class="leave-meta">
          <div class="leave-meta-item"><i class="bi bi-calendar-range"></i>${r.start} → ${r.end}</div>
          <div class="leave-meta-item"><i class="bi bi-clock"></i>${r.days} day${r.days > 1 ? 's' : ''}</div>
        </div>
        <div class="leave-reason">${r.reason}</div>
      </div>
      <div class="leave-actions">
        ${r.status === 'Pending'
          ? `<button class="btn-approve" onclick="handleLeave('${r.id}','approve')"><i class="bi bi-check-lg"></i> Approve</button>
             <button class="btn-reject"  onclick="handleLeave('${r.id}','reject')"><i class="bi bi-x-lg"></i> Reject</button>`
          : `<span class="badge ${badgeClass(r.status)}">${r.status}</span>`
        }
      </div>
    </div>
  `).join('');

  const pendingCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const badge = document.getElementById('pendingLeaveBadge');
  badge.textContent   = pendingCount;
  badge.style.display = pendingCount > 0 ? '' : 'none';
}

window.handleLeave = async function(id, action) {
  try {
    const res = await fetch(`${API}/leave-requests/${id}/${action}`, { method: 'PATCH', headers: authHdr() });
    if (res.ok) {
      showToast(`Leave ${action}d.`, 'success');
      await loadLeave();
    } else {
      showToast('Action failed.', 'error');
    }
  } catch {
    showToast('Network error.', 'error');
  }
};

function filterLeave() {
  const status = document.getElementById('leaveStatusFilter').value;
  const type   = document.getElementById('leaveTypeFilter').value;
  filteredLeave = leaveRequests.filter(r => {
    const matchStatus = !status || r.status === status;
    const matchType   = !type   || r.type === type;
    return matchStatus && matchType;
  });
  renderLeaveCards(filteredLeave);
}
