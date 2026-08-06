/* =========================================
   utils.js — shared helpers for Arogya Plus
   ========================================= */

/* ── TOAST ── */
export function toast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slide-in .3s ease reverse'; setTimeout(() => t.remove(), 280); }, 3200);
}

/* ── SIDEBAR TOGGLE ── */
export function initSidebar() {
  const sb = document.querySelector('.sidebar');
  const colBtn = document.querySelector('.collapse-btn');
  const overlay = document.querySelector('.overlay');
  if (!sb) return;

  // Mobile hamburger
  const ham = document.querySelector('#hamburger');
  if (ham) {
    ham.addEventListener('click', () => {
      sb.classList.toggle('open');
      if (overlay) overlay.style.display = sb.classList.contains('open') ? 'block' : 'none';
    });
  }
  if (overlay) overlay.addEventListener('click', () => {
    sb.classList.remove('open');
    overlay.style.display = 'none';
  });
  if (colBtn) colBtn.addEventListener('click', () => sb.classList.toggle('collapsed'));

  // Highlight active nav
  const path = location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

/* ── ACTIVE NAV ── */
export function setActiveNav(href) {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === href);
  });
}

/* ── FORMAT ── */
export const fmt = {
  currency: n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 }),
  date: d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  time: t => new Date('1970-01-01T' + t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  initials: name => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
};

/* ── RENDER CHART BARS ── */
export function renderBarChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...data.map(d => d.v));
  el.innerHTML = data.map(d => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="flex:1;width:100%;display:flex;align-items:flex-end">
        <div class="chart-bar" style="height:${(d.v / max * 100)}%;width:100%;min-height:8px" title="${d.l}: ${d.v}"></div>
      </div>
      <div style="font-size:.62rem;color:var(--text-500);white-space:nowrap">${d.l}</div>
    </div>`).join('');
}

/* ── RENDER DONUT ── */
export function renderDonut(svgId, pct, color = '#06b6d4') {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const r = 45, c = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(100, Number(pct || 0)));
  const dash = (safePct / 100) * c;
  svg.innerHTML = `
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
    ${safePct > 0 ? `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="${dash} ${c}" stroke-linecap="round"/>` : ''}`;
}

/* ── SAMPLE DATA ── */
export const sampleAppointments = [
  { id: 'APT-001', patient: 'Alice Johnson', doctor: 'Dr. Smith', date: '2026-02-21', time: '10:00', reason: 'Cardiology Checkup', status: 'Confirmed' },
  { id: 'APT-002', patient: 'Bob Williams', doctor: 'Dr. Patel', date: '2026-02-21', time: '11:30', reason: 'Follow-up', status: 'Pending' },
  { id: 'APT-003', patient: 'Carol Martinez', doctor: 'Dr. Lee', date: '2026-02-22', time: '14:00', reason: 'Lab Results', status: 'Confirmed' },
  { id: 'APT-004', patient: 'David Kim', doctor: 'Dr. Nguyen', date: '2026-02-22', time: '15:30', reason: 'General Checkup', status: 'Cancelled' },
  { id: 'APT-005', patient: 'Emma Davis', doctor: 'Dr. Brown', date: '2026-02-23', time: '09:00', reason: 'Dermatology', status: 'Confirmed' },
];

export const sampleDoctors = [
  { name: 'Dr. James Smith', spec: 'Cardiologist', exp: '12 yrs', rating: 4.9, avail: true, e: '👨‍⚕️', color: 'rgba(37,99,235,0.2)' },
  { name: 'Dr. Priya Patel', spec: 'Neurologist', exp: '8 yrs', rating: 4.8, avail: true, e: '👩‍⚕️', color: 'rgba(139,92,246,0.2)' },
  { name: 'Dr. Kevin Lee', spec: 'Orthopedist', exp: '15 yrs', rating: 4.7, avail: false, e: '👨‍⚕️', color: 'rgba(6,182,212,0.2)' },
  { name: 'Dr. Mei Nguyen', spec: 'Pediatrician', exp: '10 yrs', rating: 5.0, avail: true, e: '👩‍⚕️', color: 'rgba(34,197,94,0.2)' },
  { name: 'Dr. Tom Brown', spec: 'Dermatologist', exp: '6 yrs', rating: 4.6, avail: true, e: '👨‍⚕️', color: 'rgba(234,179,8,0.2)' },
  { name: 'Dr. Ana Garcia', spec: 'Oncologist', exp: '20 yrs', rating: 4.9, avail: false, e: '👩‍⚕️', color: 'rgba(239,68,68,0.2)' },
];

export const samplePatients = [
  { id: 'PAT-001', name: 'Alice Johnson', age: 34, blood: 'A+', phone: '555-0101', status: 'Active' },
  { id: 'PAT-002', name: 'Bob Williams', age: 52, blood: 'O-', phone: '555-0102', status: 'Active' },
  { id: 'PAT-003', name: 'Carol Martinez', age: 28, blood: 'B+', phone: '555-0103', status: 'Discharged' },
  { id: 'PAT-004', name: 'David Kim', age: 65, blood: 'AB+', phone: '555-0104', status: 'Critical' },
  { id: 'PAT-005', name: 'Emma Davis', age: 41, blood: 'A-', phone: '555-0105', status: 'Active' },
];

export const statusBadge = s => {
  const map = {
    'Confirmed': 'badge-green', 'Active': 'badge-green', 'Success': 'badge-green', 'Approved': 'badge-green',
    'Pending': 'badge-yellow', 'En Route': 'badge-yellow',
    'Cancelled': 'badge-red', 'Critical': 'badge-red', 'Rejected': 'badge-red',
    'Discharged': 'badge-blue', 'Stable': 'badge-cyan',
  };
  return `<span class="badge ${map[s] || 'badge-blue'}">${s}</span>`;
};
