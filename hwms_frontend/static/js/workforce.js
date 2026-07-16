/* workforce.js — live API version */

const API = 'http://127.0.0.1:5000/api';
const token   = () => localStorage.getItem('hwms_token');
const authHdr = () => ({ 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' });

let employees   = [];
let departments = [];
let shifts      = [];

document.addEventListener('DOMContentLoaded', async () => {

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  await loadAll();

  document.getElementById('empSearch').addEventListener('input', filterEmployees);
  document.getElementById('empDeptFilter').addEventListener('change', filterEmployees);
  document.getElementById('empStatusFilter').addEventListener('change', filterEmployees);
  document.getElementById('deptSearch').addEventListener('input', function() {
    renderDeptTable(departments.filter(d => d.name.toLowerCase().includes(this.value.toLowerCase())));
  });
  document.getElementById('shiftSearch').addEventListener('input', function() {
    renderShiftTable(shifts.filter(s => s.name.toLowerCase().includes(this.value.toLowerCase())));
  });

  bindModalForm('addEmpForm',   'addEmpSpinner',   '/api/employees',   'POST');
  bindModalForm('editEmpForm',  'editEmpSpinner',  '/api/employees',   'PUT');
  bindModalForm('addDeptForm',  'addDeptSpinner',  '/api/departments', 'POST');
  bindModalForm('addShiftForm', 'addShiftSpinner', '/api/shifts',      'POST');
});

async function loadAll() {
  try {
    const [eRes, dRes, sRes] = await Promise.all([
      fetch(`${API}/employees`,   { headers: authHdr() }),
      fetch(`${API}/departments`, { headers: authHdr() }),
      fetch(`${API}/shifts`,      { headers: authHdr() }),
    ]);
    employees   = await eRes.json();
    departments = await dRes.json();
    shifts      = await sRes.json();
  } catch {
    showToast('Failed to load data from server.', 'error');
  }
  filteredEmps = [...employees];
  renderEmpTable();
  renderDeptTable();
  renderShiftTable();
}

function statusBadge(status) {
  const map = { 'Active': 'success', 'On Leave': 'warning', 'Inactive': 'danger' };
  return `<span class="badge badge-${map[status] || 'info'}">${status}</span>`;
}

const EMP_PER_PAGE = 5;
let empPage = 1;
let filteredEmps = [];

function renderEmpTable() {
  const tbody = document.getElementById('empTableBody');
  const start = (empPage - 1) * EMP_PER_PAGE;
  const slice = filteredEmps.slice(start, start + EMP_PER_PAGE);

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-people"></i><p>No employees found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(e => `
    <tr>
      <td>
        <div class="cell-user">
          <div class="avatar">${e.first_name[0]}${e.last_name[0]}</div>
          <div>
            <div class="cell-name">${e.first_name} ${e.last_name}</div>
            <div class="cell-sub">${e.email}</div>
          </div>
        </div>
      </td>
      <td>${e.department}</td>
      <td>${e.designation}</td>
      <td>${e.phone}</td>
      <td>${e.date_of_joining}</td>
      <td>${statusBadge(e.status)}</td>
      <td class="text-end">
        <button class="btn-icon me-1" onclick="openEditEmp('${e.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon del" onclick="confirmDelete('employee','${e.id}','${e.first_name} ${e.last_name}')"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>
  `).join('');

  document.getElementById('empPaginationInfo').textContent =
    `Showing ${start + 1}–${Math.min(start + EMP_PER_PAGE, filteredEmps.length)} of ${filteredEmps.length}`;

  const total = Math.ceil(filteredEmps.length / EMP_PER_PAGE);
  const container = document.getElementById('empPageBtns');
  container.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn${i === empPage ? ' active' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => { empPage = i; renderEmpTable(); });
    container.appendChild(btn);
  }
}

function filterEmployees() {
  const q    = document.getElementById('empSearch').value.toLowerCase();
  const dept = document.getElementById('empDeptFilter').value;
  const stat = document.getElementById('empStatusFilter').value;
  filteredEmps = employees.filter(e => {
    const matchQ    = `${e.first_name} ${e.last_name} ${e.email} ${e.designation}`.toLowerCase().includes(q);
    const matchDept = !dept || e.department === dept;
    const matchStat = !stat || e.status === stat;
    return matchQ && matchDept && matchStat;
  });
  empPage = 1;
  renderEmpTable();
}

function renderDeptTable(data = departments) {
  document.getElementById('deptTableBody').innerHTML = data.map(d => `
    <tr>
      <td><div class="cell-name">${d.name}</div></td>
      <td style="color:var(--muted);font-size:.82rem">${d.description || ''}</td>
      <td>${d.head || ''}</td>
      <td><strong>${d.count || 0}</strong></td>
      <td>${statusBadge(d.status || 'Active')}</td>
      <td class="text-end">
        <button class="btn-icon del" onclick="confirmDelete('department','${d.id}','${d.name}')"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderShiftTable(data = shifts) {
  document.getElementById('shiftTableBody').innerHTML = data.map(s => `
    <tr>
      <td><div class="cell-name">${s.name}</div></td>
      <td>${s.start}</td>
      <td>${s.end}</td>
      <td>${s.department}</td>
      <td><strong>${s.assigned || 0}</strong> employees</td>
      <td class="text-end">
        <button class="btn-icon del" onclick="confirmDelete('shift','${s.id}','${s.name}')"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>
  `).join('');
}

window.openEditEmp = function(id) {
  const e = employees.find(x => x.id === id);
  if (!e) return;
  document.getElementById('editEmpId').value     = e.id;
  document.getElementById('editEmpFirst').value  = e.first_name;
  document.getElementById('editEmpLast').value   = e.last_name;
  document.getElementById('editEmpEmail').value  = e.email;
  document.getElementById('editEmpPhone').value  = e.phone;
  document.getElementById('editEmpDept').value   = e.department;
  document.getElementById('editEmpDesig').value  = e.designation;
  document.getElementById('editEmpDoj').value    = e.date_of_joining;
  document.getElementById('editEmpStatus').value = e.status;
  new bootstrap.Modal(document.getElementById('editEmpModal')).show();
};

let pendingDelete = null;

window.confirmDelete = function(type, id, name) {
  pendingDelete = { type, id };
  document.getElementById('deleteModalMsg').textContent = `Delete ${type} "${name}"? This cannot be undone.`;
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
};

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  const endpointMap = { employee: 'employees', department: 'departments', shift: 'shifts' };
  try {
    const res = await fetch(`${API}/${endpointMap[type]}/${id}`, { method: 'DELETE', headers: authHdr() });
    if (res.ok) {
      showToast(`${type} deleted.`, 'success');
      await loadAll();
    } else {
      showToast('Delete failed.', 'error');
    }
  } catch {
    showToast('Network error.', 'error');
  }
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  pendingDelete = null;
});

function bindModalForm(formId, spinnerId, endpoint, method) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const spinner = document.getElementById(spinnerId);
    const btn     = form.querySelector('[type="submit"]');
    btn.disabled  = true;
    spinner?.classList.remove('d-none');

    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);

    const empId = data.id;
    const url   = (method === 'PUT' && empId)
      ? `${API}/${endpoint.replace('/api/', '')}/${empId}`
      : `${API}${endpoint.replace('/api', '')}`;

    try {
      const res  = await fetch(url, { method, headers: authHdr(), body: JSON.stringify(data) });
      const json = await res.json();
      if (res.ok) {
        bootstrap.Modal.getInstance(form.closest('.modal'))?.hide();
        showToast(json.message || 'Saved successfully.', 'success');
        form.reset();
        form.classList.remove('was-validated');
        await loadAll();
      } else {
        showToast(json.message || 'Save failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }

    btn.disabled = false;
    spinner?.classList.add('d-none');
  });
}
