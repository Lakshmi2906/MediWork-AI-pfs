/* dashboard.js — live API version */

const API = 'http://127.0.0.1:5000/api';
const token = () => localStorage.getItem('hwms_token');
const headers = () => ({ 'Authorization': 'Bearer ' + token() });

document.addEventListener('DOMContentLoaded', async () => {

  const user = JSON.parse(localStorage.getItem('hwms_user') || '{}');
  const role = user.role || 'Admin';

  if (role === 'Doctor' || role === 'Nurse') {
    document.getElementById('adminStatsRow')?.classList.add('d-none');
    document.getElementById('personalStatsRow')?.classList.remove('d-none');
    document.getElementById('burnoutSummaryCard')?.classList.add('d-none');
  }

  // ── Stats ──
  try {
    const res  = await fetch(`${API}/dashboard/stats`, { headers: headers() });
    const data = await res.json();
    document.getElementById('statEmployees').textContent = data.total_employees ?? '—';
    document.getElementById('statPresent').textContent   = data.present_today   ?? '—';
    document.getElementById('statLeaves').textContent    = data.pending_leaves  ?? '—';
    document.getElementById('statBurnout').textContent   = data.high_burnout    ?? '—';
  } catch { /* leave as — */ }

  // ── Attendance Trend Chart ──
  let attData = { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], present: [0,0,0,0,0,0,0], absent: [0,0,0,0,0,0,0] };
  try {
    const res = await fetch(`${API}/dashboard/attendance-trend`, { headers: headers() });
    attData   = await res.json();
  } catch { /* use empty */ }

  new Chart(document.getElementById('attendanceTrendChart'), {
    type: 'line',
    data: {
      labels: attData.labels,
      datasets: [
        { label: 'Present', data: attData.present, borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,.08)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#0F6E56' },
        { label: 'Absent',  data: attData.absent,  borderColor: '#854F0B', backgroundColor: 'rgba(133,79,11,.06)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#854F0B' },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { color: '#E5E7EB' }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#E5E7EB' }, ticks: { font: { size: 11 } }, beginAtZero: true },
      },
    },
  });

  // ── Department Chart ──
  let deptData = { labels: [], counts: [] };
  try {
    const res = await fetch(`${API}/dashboard/department-split`, { headers: headers() });
    deptData  = await res.json();
  } catch { /* use empty */ }

  new Chart(document.getElementById('departmentChart'), {
    type: 'doughnut',
    data: {
      labels: deptData.labels,
      datasets: [{ data: deptData.counts, backgroundColor: ['#0F6E56','#185FA5','#854F0B','#3B6D11','#99351D','#6B7280'], borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
    },
  });

});
