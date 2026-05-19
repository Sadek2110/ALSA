/* ============================================================
   ALSA - Agency Management Platform
   app.js - Frontend Logic (consume la API Node.js en /api)
   ============================================================ */

'use strict';

// ============================================================
// API BASE — apunta al backend Node.js
// ============================================================
const API_BASE = '/api';

/**
 * Llamada genérica a la API Node.js.
 * Lanza un Error con el mensaje del servidor si la respuesta no es ok.
 */
async function api(method, path, data = null, isFormData = false) {
  const opts = {
    method,
    credentials: 'same-origin',
  };
  if (data !== null) {
    if (isFormData) {
      opts.body = data;              // FormData: el browser pone el Content-Type
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body    = JSON.stringify(data);
    }
  }
  const res  = await fetch(API_BASE + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status} en ${path}`);
  return json;
}

// ============================================================
// APPLICATION STATE  (datos que se cargan desde el backend Node.js)
// ============================================================
const state = {
  currentSection: 'home',
  currentUser: null,
  pendingAdmin: null,

  // Los arrays se rellenan con loadStateFromServer() tras login
  trips:              [],
  invoices:           [],
  members:            [],
  vehicles:           [],
  admins:             [],
  bookings:           [],
  frequentPassengers: [],

  lastCreatedBookingId: null,

  // Estado temporal del wizard (no persiste)
  routes:        [],
  searchResults: [],
  availabilities: [],
  bookingWizard: null,
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  if (token) {
    // El usuario ha llegado desde el enlace de invitación
    const valid = await validateInviteToken(token);
    if (valid) {
      showPage('set-password');
    } else {
      showPage('login');
      showToast('error', 'Invitación inválida', 'El enlace de activación no es válido o ha expirado. Solicita una nueva invitación.');
    }
  } else {
    showPage('login');
  }
});

async function validateInviteToken(token) {
  try {
    const info = await api('GET', `/auth/invitation/${encodeURIComponent(token)}`);
    // Mostrar info del admin invitado en la página de activación
    const el = document.getElementById('inv-admin-info');
    if (el && info.email) {
      el.textContent = `${info.nombre || info.usuario} (${info.email})`;
      el.style.display = 'block';
    }
    return true;
  } catch (err) {
    console.error('[INVITE] Token inválido:', err.message);
    return false;
  }
}

/**
 * Carga todos los datos desde el backend Node.js.
 */
async function loadStateFromServer() {
  try {
    const data = await api('GET', '/data');
    state.bookings = data.bookings || [];
    state.members = data.members || [];
    state.vehicles = data.vehicles || [];
    state.invoices = data.invoices || [];
    state.admins = data.admins || [];
    state.frequentPassengers = data.frequentPassengers || [];
    console.log('[DATA] Loaded from server:', data.bookings.length, 'bookings,', data.members.length, 'members');
  } catch (err) {
    console.error('[DATA] Error loading data:', err.message);
    showToast('error', 'Error', 'No se pudieron cargar los datos del servidor.');
  }
}


// ============================================================
// PAGE MANAGEMENT
// ============================================================
function showPage(name) {
  const pages = { login:'grid', dashboard:'block', 'set-password':'flex' };
  Object.keys(pages).forEach(k => {
    const el = document.getElementById('page-' + k);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('page-' + name);
  if (target) target.style.display = pages[name] || 'block';
}

// ============================================================
// AUTHENTICATION
// ============================================================
async function handleLogin(e) {
  e.preventDefault();

  const email = val('login-email');
  const pwd   = val('login-pwd');
  let ok = true;

  if (!email || !isEmail(email)) {
    fieldErr('err-email','login-email','Introduce un correo electrónico válido.'); ok=false;
  } else { fieldOk('err-email','login-email'); }

  if (!pwd) {
    fieldErr('err-pwd','login-pwd','La contraseña es obligatoria.'); ok=false;
  } else { fieldOk('err-pwd','login-pwd'); }

  if (!ok) return;

  // Deshabilitar botón mientras se procesa
  const btn = document.querySelector('#login-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Iniciando sesión…'; }

  try {
    const result = await api('POST', '/auth/login', { email, password: pwd });
    if (result.user) {
      state.currentUser = result.user;
      $('sidebar-uname').textContent = result.user.nombre || result.user.name || '';
      $('user-ava').textContent = (result.user.nombre || result.user.name || 'U').slice(0,2).toUpperCase();
      showPage('dashboard');
      navigateTo('home');
      loadStateFromServer();
      showToast('success','Bienvenido','Has iniciado sesión correctamente.');
      return;
    }
    fieldErr('err-pwd','login-pwd','Credenciales incorrectas. Verifica los datos.');
    showToast('error','Acceso denegado', 'Usuario o contraseña incorrectos.');
  } catch (err) {
    fieldErr('err-pwd','login-pwd','Credenciales incorrectas. Verifica los datos.');
    showToast('error','Acceso denegado', 'Usuario o contraseña incorrectos.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Iniciar sesión'; }
  }
}

function handleLogout() {
  state.currentUser     = null;
  state.bookings        = [];
  state.members         = [];
  state.vehicles        = [];
  state.invoices        = [];
  state.admins          = [];
  state.frequentPassengers = [];
  $('login-email').value = '';
  $('login-pwd').value   = '';
  fieldOk('err-email','login-email');
  fieldOk('err-pwd','login-pwd');
  showPage('login');
  showToast('info','Sesión cerrada','Has cerrado sesión correctamente.');
}

function handleForgotPwd() {
  const email = val('login-email');
  if (!email || !isEmail(email)) {
    showToast('warning','Email requerido','Escribe tu correo en el campo de arriba primero.');
  } else {
    showToast('success','Correo enviado',`Se ha enviado un enlace de recuperación a ${email}`);
  }
}

// ============================================================
// NAVIGATION
// ============================================================
const SEC_TITLES = {
  home:'Escritorio', viajes:'Reservas', reserva:'Nueva Reserva',
  facturas:'Facturas', miembros:'Miembros',
  vehiculos:'Vehículos', administradores:'Administradores'
};

function navigateTo(section) {
  // Reset booking wizard when navigating away from reserva
  if (state.currentSection === 'reserva' && section !== 'reserva') {
    state.bookingWizard = null;
  }

  state.currentSection = section;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  $('header-title').textContent = SEC_TITLES[section] || section;

  const renderers = {
    home: renderHome, viajes: renderViajes, reserva: renderReserva,
    facturas: renderFacturas, miembros: renderMiembros,
    vehiculos: renderVehiculos, administradores: renderAdmins
  };

  const fn = renderers[section];
  if (fn) $('content-area').innerHTML = fn();

  if (section === 'reserva') initReservaSection();
  if (section === 'home') initHomeCharts();
  closeSidebar();
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ============================================================
// HOME SECTION (dashboard limpio — sin formulario de reserva)
// ============================================================
function renderHome() {
  const pend     = state.invoices.filter(i=>i.estado==='Pendiente').length;
  const totalInv = state.invoices.reduce((s,i)=>s+i.importe, 0);
  const recent   = state.bookings.slice(0, 5);

  return `<div class="section-page">
    <div class="stats-grid">
      <div class="stat-card stat-card-link" onclick="navigateTo('viajes')" title="Ir a Reservas">
        <div class="stat-icon blue">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-label">Total Reservas</div>
        <div class="stat-value">${state.bookings.length}</div>
        <div class="stat-change up"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> ${state.bookings.filter(b=>b.localizador).length} confirmadas</div>
      </div>
      <div class="stat-card stat-card-link" onclick="navigateTo('facturas')" title="Ir a Facturas">
        <div class="stat-icon green">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-label">Ingresos Totales</div>
        <div class="stat-value">€${totalInv.toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
        <div class="stat-change up"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> Acumulado</div>
      </div>
      <div class="stat-card stat-card-link" onclick="navigateTo('miembros')" title="Ir a Miembros">
        <div class="stat-icon amber">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div class="stat-label">Miembros</div>
        <div class="stat-value">${state.members.length}</div>
        <div class="stat-change up"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> Registrados</div>
      </div>
      <div class="stat-card stat-card-link" onclick="navigateTo('facturas')" title="Ir a Facturas">
        <div class="stat-icon red">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="stat-label">Facturas Pendientes</div>
        <div class="stat-value">${pend}</div>
        <div class="stat-change down"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> Requieren atención</div>
      </div>
    </div>

    <!-- CTA destacado: Nueva reserva -->
    <div class="card home-cta-card" onclick="navigateTo('reserva')">
      <div class="home-cta-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.41 2 2 0 0 1 3.55 1h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6.08 6.08l.87-.87a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"/></svg>
      </div>
      <div class="home-cta-content">
        <div class="home-cta-title">Reservar nuevo viaje</div>
        <div class="home-cta-desc">Busca disponibilidad, elige naviera y completa los datos del pasajero en pocos pasos.</div>
        <div class="home-cta-steps">
          <span class="home-cta-step">1. Buscar viaje</span>
          <span class="home-cta-sep">›</span>
          <span class="home-cta-step">2. Pasajero</span>
          <span class="home-cta-sep">›</span>
          <span class="home-cta-step">3. Confirmar</span>
        </div>
      </div>
      <div class="home-cta-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>

    <!-- Gráficos interactivos -->
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">Evolución de reservas</div>
        <div class="chart-desc">Reservas por mes en los últimos 6 meses</div>
        <div class="chart-canvas-wrap">
          <canvas id="chart-line"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Estado de reservas</div>
        <div class="chart-desc">Distribución actual del total</div>
        <div class="chart-canvas-wrap">
          <canvas id="chart-donut"></canvas>
        </div>
      </div>
    </div>

    <!-- Gráficos fila 2 -->
    <div class="charts-row charts-row-even">
      <div class="chart-card">
        <div class="chart-title">Rutas más populares</div>
        <div class="chart-desc">Top 5 rutas con más reservas</div>
        <div class="chart-canvas-wrap chart-canvas-wrap-sm">
          <canvas id="chart-routes"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Facturación mensual</div>
        <div class="chart-desc">Total facturado por mes en los últimos 6 meses</div>
        <div class="chart-canvas-wrap chart-canvas-wrap-sm">
          <canvas id="chart-invoices"></canvas>
        </div>
      </div>
    </div>

    <!-- Actividad reciente -->
    <div class="home-bottom-row">
      <div class="card home-activity-card">
        <div class="card-title">Actividad reciente</div>
        <div class="card-desc">Últimas reservas registradas</div>
        ${recent.length===0
          ? `<div class="empty-state" style="padding:24px 0"><div class="empty-txt">Sin reservas aún</div></div>`
          : recent.map(b=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--gray-100)">
              <div>
                <div style="font-size:0.875rem;font-weight:700;color:var(--gray-900)">${esc(b.origin)} → ${esc(b.destination)}</div>
                <div style="font-size:0.72rem;color:var(--gray-400);margin-top:1px">${esc(b.passengerName||'')} · ${b.departureDate||''}</div>
              </div>
              <span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}">${b.localizador ? 'Activo' : 'Pendiente'}</span>
            </div>
          `).join('')}
        <div style="margin-top:14px">
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('viajes')">Ver todas →</button>
        </div>
      </div>
    </div>
  </div>`;
}

function initHomeCharts() {
  if (typeof Chart === 'undefined') return;

  const C = {
    primary: '#3d8ee8', success: '#10b981',
    warning: '#f59e0b', danger: '#ef4444',
    purple: '#8b5cf6', gray100: '#f3f4f6',
    gridLine: '#f0f1f3', tick: '#9ca3af',
  };

  const font = (size) => ({ size, family: 'Inter, sans-serif' });

  ['chart-line', 'chart-donut', 'chart-routes', 'chart-invoices'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const ch = Chart.getChart(el); if (ch) ch.destroy(); }
  });

  // ── Donut: Estado de reservas ───────────────────────────────
  const confirmed = state.bookings.filter(b => b.localizador && b.estado !== 'Cancelado').length;
  const pending   = state.bookings.filter(b => !b.localizador && b.estado !== 'Cancelado').length;
  const cancelled = state.bookings.filter(b => b.estado === 'Cancelado').length;
  const total     = state.bookings.length;

  new Chart(document.getElementById('chart-donut'), {
    type: 'doughnut',
    data: {
      labels: ['Confirmadas', 'Pendientes', 'Canceladas'],
      datasets: [{
        data: [confirmed, pending, cancelled],
        backgroundColor: [C.success, C.warning, C.danger],
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 10,
      }]
    },
    options: {
      cutout: '70%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, font: font(12), color: '#6b7280', boxWidth: 10, boxHeight: 10 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total ? Math.round(ctx.parsed / total * 100) : 0;
              return `  ${ctx.parsed} reservas (${pct}%)`;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      beforeDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `700 22px Inter, sans-serif`;
        ctx.fillStyle = '#111827';
        ctx.fillText(total, cx, cy - 8);
        ctx.font = `400 11px Inter, sans-serif`;
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('reservas', cx, cy + 10);
        ctx.restore();
      }
    }]
  });

  // ── Line: Evolución mensual ─────────────────────────────────
  const now = new Date();
  const labels = [], counts = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
    const y = d.getFullYear(), m = d.getMonth();
    const n = state.bookings.filter(b => {
      if (!b.departureDate) return false;
      let bd;
      if (b.departureDate.includes('-')) {
        const [yr, mo, dy] = b.departureDate.split('-');
        bd = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(dy));
      } else {
        const [dd, mm, yyyy] = b.departureDate.split('/');
        bd = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      }
      return !isNaN(bd) && bd.getFullYear() === y && bd.getMonth() === m;
    }).length;
    counts.push(n);
  }

  new Chart(document.getElementById('chart-line'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Reservas',
        data: counts,
        borderColor: C.primary,
        backgroundColor: 'rgba(61,142,232,0.08)',
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: C.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2.5,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `  ${ctx.parsed.y} reserva${ctx.parsed.y !== 1 ? 's' : ''}` }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: C.tick, font: font(11) }
        },
        y: {
          border: { display: false, dash: [4, 4] },
          grid: { color: C.gridLine },
          ticks: { color: C.tick, font: font(11), precision: 0, stepSize: 1 },
          beginAtZero: true,
        }
      }
    }
  });

  // ── Horizontal bar: Top rutas ───────────────────────────────
  const routeMap = {};
  state.bookings.forEach(b => {
    const key = b.origin && b.destination ? `${b.origin} → ${b.destination}` : null;
    if (key) routeMap[key] = (routeMap[key] || 0) + 1;
  });

  const sortedRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const routeLabels = sortedRoutes.map(r => r[0]);
  const routeData   = sortedRoutes.map(r => r[1]);
  const barColors   = [C.primary, C.purple, C.success, C.warning, '#06b6d4'];

  new Chart(document.getElementById('chart-routes'), {
    type: 'bar',
    data: {
      labels: routeLabels.length ? routeLabels : ['Sin datos'],
      datasets: [{
        label: 'Reservas',
        data: routeData.length ? routeData : [0],
        backgroundColor: barColors.slice(0, Math.max(routeLabels.length, 1)),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `  ${ctx.parsed.x} reserva${ctx.parsed.x !== 1 ? 's' : ''}` }
        }
      },
      scales: {
        x: {
          border: { display: false, dash: [4, 4] },
          grid: { color: C.gridLine },
          ticks: { color: C.tick, font: font(11), precision: 0, stepSize: 1 },
          beginAtZero: true,
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#374151', font: font(12) }
        }
      }
    }
  });

  // ── Bar: Facturación mensual ────────────────────────────────
  const invLabels = [], invAmounts = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    invLabels.push(d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
    const y = d.getFullYear(), m = d.getMonth();
    const monthTotal = state.invoices.filter(inv => {
      if (!inv.fecha) return false;
      let id;
      if (inv.fecha.includes('-')) {
        const [yr, mo, dy] = inv.fecha.split('-');
        id = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(dy));
      } else {
        const [dd, mm, yyyy] = inv.fecha.split('/');
        id = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      }
      return !isNaN(id) && id.getFullYear() === y && id.getMonth() === m;
    }).reduce((s, inv) => s + (inv.importe || 0), 0);
    invAmounts.push(Math.round(monthTotal));
  }

  new Chart(document.getElementById('chart-invoices'), {
    type: 'bar',
    data: {
      labels: invLabels,
      datasets: [{
        label: 'Facturado',
        data: invAmounts,
        backgroundColor: invAmounts.map(v =>
          v > 0 ? 'rgba(16,185,129,0.75)' : 'rgba(209,213,219,0.5)'
        ),
        hoverBackgroundColor: invAmounts.map(v =>
          v > 0 ? '#10b981' : '#d1d5db'
        ),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `  €${ctx.parsed.y.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: C.tick, font: font(11) }
        },
        y: {
          border: { display: false, dash: [4, 4] },
          grid: { color: C.gridLine },
          ticks: {
            color: C.tick,
            font: font(11),
            callback: v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`
          },
          beginAtZero: true,
        }
      }
    }
  });
}

// ============================================================
// RESERVA SECTION (página independiente de reservas)
// ============================================================
function renderReserva() {
  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Nueva reserva</h2>
        <p class="sec-desc">Sigue los pasos para completar la reserva</p>
      </div>
      <button class="btn btn-secondary btn-sm" style="width:auto" onclick="navigateTo('viajes')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Ver reservas
      </button>
    </div>
    <div id="wiz-step-bar" style="margin-bottom:20px"></div>
    <div id="wiz-content"></div>
  </div>`;
}

// Inicializa la sección de reservas tras el render
function initReservaSection() {
  if (state.routes.length === 0) loadRoutes();
  showWizStep1();
}

// No-op — home ya no tiene búsqueda
function initHomeRoutes() {}

// ── Barra de pasos ────────────────────────────────────────────
function renderWizStepBar(current) {
  const bar = $('wiz-step-bar');
  if (!bar) return;
  const steps = ['Búsqueda','Disponibilidad','Pasajeros','Confirmar'];
  bar.innerHTML = `<div class="booking-steps">${steps.map((label, i) => {
    const n = i + 1;
    let cls = 'bstep-pending', numHtml = String(n);
    if (n < current)   { cls = 'bstep-done';   numHtml = '✓'; }
    if (n === current) { cls = 'bstep-active'; }
    return `<div class="bstep ${cls}"><div class="bstep-num">${numHtml}</div><div class="bstep-label">${label}</div></div>${i < steps.length-1 ? '<div class="bstep-arrow">›</div>' : ''}`;
  }).join('')}</div>`;
}

// ── Paso 1: Búsqueda ──────────────────────────────────────────
function showWizStep1() {
  const sp = state.bookingWizard?.searchParams || {};
  renderWizStepBar(1);
  const content = $('wiz-content');
  if (!content) return;

  content.innerHTML = `
    <div class="card reserva-search-card">
      <div style="margin-bottom:18px">
        <span class="form-sec-label">Tipo de trayecto</span>
        <div class="seg-ctrl" id="home-seg">
          <button class="seg-btn ${(!sp.tripType||sp.tripType==='Ida'||sp.tripType==='ida')?'active':''}" onclick="selectTripType('ida',this)">Ida</button>
          <button class="seg-btn ${(sp.tripType==='idayvuelta'||sp.tripType==='Ida y vuelta')?'active':''}" onclick="selectTripType('idayvuelta',this)">Ida y vuelta</button>
        </div>
      </div>
      <div style="margin-bottom:18px">
        <span class="form-sec-label">Ruta</span>
        <div class="form-grid">
          <div class="form-group" style="margin-bottom:0;position:relative">
            <label class="form-label" style="font-size:0.8125rem">Puerto de origen</label>
            <input type="text" class="form-input" id="h-origen" value="${esc(sp.origenNm||'')}" placeholder="Escribe para buscar..." autocomplete="off"
              oninput="filterRoutes('origen')" onfocus="filterRoutes('origen')" onblur="setTimeout(()=>hideDropdown('drop-origen'),180)">
            <div class="route-dropdown" id="drop-origen"></div>
            <input type="hidden" id="h-origen-id" value="${esc(sp.origenId||'')}">
            <span class="error-msg" id="e-origen"></span>
          </div>
          <div class="form-group" style="margin-bottom:0;position:relative">
            <label class="form-label" style="font-size:0.8125rem">Puerto de destino</label>
            <input type="text" class="form-input" id="h-destino" value="${esc(sp.destinoNm||'')}" placeholder="Selecciona primero el origen…" autocomplete="off"
              oninput="filterRoutes('destino')" onfocus="filterRoutes('destino')" onblur="setTimeout(()=>hideDropdown('drop-destino'),180)">
            <div class="route-dropdown" id="drop-destino"></div>
            <input type="hidden" id="h-destino-id" value="${esc(sp.destinoId||'')}">
            <span class="error-msg" id="e-destino"></span>
          </div>
        </div>
      </div>
      <div style="margin-bottom:18px">
        <span class="form-sec-label">Fechas</span>
        <div class="form-grid">
          <div class="form-group" id="g-ida" style="margin-bottom:0;position:relative">
            <label class="form-label" style="font-size:0.8125rem">Fecha de ida</label>
            <div class="date-input-wrap" onclick="openDatePicker('ida')">
              <input type="text" class="form-input date-input" id="h-fecha-ida" value="${esc(sp.fechaIda||'')}" placeholder="Selecciona fecha…" readonly>
              <svg class="date-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span class="error-msg" id="e-fecha-ida"></span>
            <div class="date-picker-dropdown" id="dp-ida" style="display:none"></div>
          </div>
          <div class="form-group" id="g-vuelta" style="margin-bottom:0;position:relative;${(sp.tripType==='idayvuelta'||sp.tripType==='Ida y vuelta')?'':'opacity:0.4;pointer-events:none'}">
            <label class="form-label" style="font-size:0.8125rem">Fecha de vuelta</label>
            <div class="date-input-wrap" onclick="openDatePicker('vuelta')">
              <input type="text" class="form-input date-input" id="h-fecha-vuelta" value="${esc(sp.fechaVuelta||'')}" placeholder="Selecciona fecha…" readonly>
              <svg class="date-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span class="error-msg" id="e-fecha-vuelta"></span>
            <div class="date-picker-dropdown" id="dp-vuelta" style="display:none"></div>
          </div>
        </div>
      </div>

      
      <button class="btn btn-primary" style="width:auto;padding:11px 32px;font-size:1rem" onclick="doSearchSailings()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar disponibilidad
      </button>
    </div>`;

  // Si ya había una ruta seleccionada, cargar disponibilidad
  const origenId = val('h-origen-id');
  const destinoId = val('h-destino-id');
  if (origenId && destinoId) {
    loadAvailabilities(Number(origenId), Number(destinoId));
  }

  // Cerrar pickers al hacer clic fuera
  document.addEventListener('click', closeDatePickerOnOutside);

  setTimeout(() => $('h-origen')?.focus(), 80);
}

async function loadRoutes() {
  try {
    const data = await api('GET', '/routes');
    const routes = Array.isArray(data) ? data : (data.data || data.routes || []);
    state.routes = routes;
  } catch(err) {
    console.error('[ROUTES] Error loading routes:', err.message);
    state.routes = [];
    showToast('error', 'Error', 'No se pudieron cargar las rutas.');
  }
}

function getPortsFromRoute(r) {
  // Support multiple response shapes
  const depId   = r.departure_port_id   || (r.departure_port   && r.departure_port.id)   || r.origin_port_id;
  const depName = r.departure_port_name || (r.departure_port   && r.departure_port.name) || r.origin || '';
  const dstId   = r.destination_port_id || (r.destination_port && r.destination_port.id) || r.dest_port_id;
  const dstName = r.destination_port_name||(r.destination_port && r.destination_port.name)|| r.destination || '';
  return { depId, depName, dstId, dstName };
}

function filterRoutes(side) {
  const inputId  = side === 'origen' ? 'h-origen'  : 'h-destino';
  const dropId   = side === 'origen' ? 'drop-origen': 'drop-destino';
  const inp = $(inputId);
  const drop = $(dropId);
  if (!inp || !drop) return;

  const q = inp.value.trim().toLowerCase();
  const selectedOrigenId = val('h-origen-id');

  // Build deduplicated port list — same port can appear in many routes
  const seen = new Set();
  const uniquePorts = [];
  for (const r of state.routes) {
    const { depId, depName, dstId, dstName } = getPortsFromRoute(r);

    // For destino: only show ports that have a valid route from selected origen
    if (side === 'destino') {
      if (!selectedOrigenId) continue;                               // origen not chosen yet
      if (String(depId) !== String(selectedOrigenId)) continue;     // not departing from chosen origen
      if (String(dstId) === String(selectedOrigenId)) continue;     // can't pick same as origen
      const portName = dstName;
      if (!portName) continue;
      if (!String(portName).toLowerCase().includes(q)) continue;
      const key = `${dstId}:${portName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniquePorts.push({ portId: dstId, portName });
    } else {
      const portName = depName;
      if (!portName) continue;
      if (!String(portName).toLowerCase().includes(q)) continue;
      const key = `${depId}:${portName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniquePorts.push({ portId: depId, portName });
    }
  }

  if (!uniquePorts.length) {
    drop.innerHTML = side === 'destino' && !selectedOrigenId
      ? `<div class="route-option" style="color:var(--gray-400);cursor:default">Selecciona primero el origen</div>`
      : '';
    if (!selectedOrigenId && side === 'destino') drop.classList.add('open');
    else drop.classList.remove('open');
    return;
  }

  drop.innerHTML = uniquePorts.map(({ portId, portName }) =>
    `<div class="route-option" data-id="${portId}" data-name="${esc(portName)}"
      onmousedown="selectRoute('${side}','${portId}','${portName.replace(/'/g,"\\'")}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z"/></svg>
      ${esc(portName)}
    </div>`
  ).join('');
  drop.classList.add('open');
}

function selectRoute(side, portId, portName) {
  const inputId  = side === 'origen'  ? 'h-origen'   : 'h-destino';
  const hiddenId = side === 'origen'  ? 'h-origen-id' : 'h-destino-id';
  const dropId   = side === 'origen'  ? 'drop-origen' : 'drop-destino';
  const inp = $(inputId), hid = $(hiddenId), drop = $(dropId);
  if (inp) inp.value = portName;
  if (hid) hid.value = portId;
  if (drop) { drop.innerHTML=''; drop.classList.remove('open'); }

  // Al cambiar el origen, limpiar el destino seleccionado y disponibilidades
  if (side === 'origen') {
    const destInp = $('h-destino'), destHid = $('h-destino-id');
    if (destInp) destInp.value = '';
    if (destHid) destHid.value = '';
    hideDropdown('drop-destino');
    state.availabilities = [];
  }

  // Al seleccionar destino, cargar disponibilidades de la ruta
  if (side === 'destino') {
    const origenId = val('h-origen-id');
    const destinoId = val('h-destino-id');
    if (origenId && destinoId) {
      loadAvailabilities(Number(origenId), Number(destinoId));
    }
  }
}

function hideDropdown(id) {
  const el = $(id); if(el) { el.innerHTML=''; el.classList.remove('open'); }
}

let _searchInProgress = false;

async function loadAvailabilities(origenId, destinoId) {
  const routeObj = state.routes.find(r => {
    const { depId, dstId } = getPortsFromRoute(r);
    return String(depId) === String(origenId) && String(dstId) === String(destinoId);
  });
  if (!routeObj) {
    state.availabilities = [];
    return;
  }
  try {
    const availRes = await api('GET', `/routes/${routeObj.id}/availabilities`);
    const availData = Array.isArray(availRes) ? availRes : (availRes.data || []);
    state.availabilities = availData;
  } catch(e) {
    console.warn('Availabilities error:', e.message);
    state.availabilities = [];
  }
}

let _dpType = null;
let _dpMonth = null;
let _dpYear = null;

function openDatePicker(type) {
  closeDatePicker();
  _dpType = type;
  const dropId = type === 'ida' ? 'dp-ida' : 'dp-vuelta';
  const drop = $(dropId);
  if (!drop) return;

  const now = new Date();
  const currentVal = type === 'ida' ? val('h-fecha-ida') : val('h-fecha-vuelta');
  if (currentVal) {
    const d = new Date(currentVal + 'T00:00:00');
    if (!isNaN(d)) {
      _dpMonth = d.getMonth();
      _dpYear = d.getFullYear();
    } else {
      _dpMonth = now.getMonth();
      _dpYear = now.getFullYear();
    }
  } else {
    _dpMonth = now.getMonth();
    _dpYear = now.getFullYear();
  }

  drop.innerHTML = renderDatePickerCalendar(_dpYear, _dpMonth, type);
  drop.style.display = 'block';
}

function closeDatePicker() {
  const dpIda = $('dp-ida');
  const dpVue = $('dp-vuelta');
  if (dpIda) dpIda.style.display = 'none';
  if (dpVue) dpVue.style.display = 'none';
}

function closeDatePickerOnOutside(e) {
  if (!e) return;
  const dpIda = $('dp-ida');
  const dpVue = $('dp-vuelta');
  const target = e.target;
  if (!target) return;
  // Si el clic fue dentro de un picker o en un input de fecha, no cerrar
  if (dpIda && (dpIda.contains(target) || target.closest('#g-ida'))) return;
  if (dpVue && (dpVue.contains(target) || target.closest('#g-vuelta'))) return;
  closeDatePicker();
}

function dpNav(dir) {
  _dpMonth += dir;
  if (_dpMonth > 11) { _dpMonth = 0; _dpYear++; }
  if (_dpMonth < 0) { _dpMonth = 11; _dpYear--; }
  const dropId = _dpType === 'ida' ? 'dp-ida' : 'dp-vuelta';
  const drop = $(dropId);
  if (drop) drop.innerHTML = renderDatePickerCalendar(_dpYear, _dpMonth, _dpType);
}

function renderDatePickerCalendar(year, month, type) {
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAYS = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const availMap = {};
  (state.availabilities || []).forEach(a => {
    const key = `${a.year}-${String(a.month).padStart(2,'0')}-${String(a.day).padStart(2,'0')}`;
    availMap[key] = a.status;
  });

  let html = `<div class="dp-cal">`;
  html += `<div class="dp-cal-header">
    <button class="dp-cal-nav" onclick="event.stopPropagation();dpNav(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
    <div class="dp-cal-title">${MONTHS[month]} ${year}</div>
    <button class="dp-cal-nav" onclick="event.stopPropagation();dpNav(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
  </div>`;
  html += `<div class="dp-cal-grid">`;
  DAYS.forEach(d => { html += `<div class="dp-cal-dow">${d}</div>`; });

  const prevLast = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    html += `<div class="dp-cal-day dp-cal-empty">${prevLast - i}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dateObj = new Date(year, month, d);
    const isPast = dateObj < today;
    const status = availMap[dateStr];
    const isSelected = (type === 'ida' && val('h-fecha-ida') === dateStr) || (type === 'vuelta' && val('h-fecha-vuelta') === dateStr);

    let cls = 'dp-cal-day';
    if (isPast) {
      cls += ' dp-cal-past';
    } else if (isSelected) {
      cls += ' dp-cal-selected';
    } else if (status === 'available') {
      cls += ' dp-cal-available';
    } else {
      cls += ' dp-cal-unavailable';
    }

    const clickable = !isPast && status === 'available';
    const onclick = clickable ? `onclick="event.stopPropagation();selectPickerDate('${dateStr}','${type}')"` : '';
    html += `<div class="${cls}" ${onclick}>${d}</div>`;
  }

  const totalCells = startDow + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="dp-cal-day dp-cal-empty">${i}</div>`;
  }

  html += `</div></div>`;
  return html;
}

function selectPickerDate(dateStr, type) {
  const input = type === 'ida' ? $('h-fecha-ida') : $('h-fecha-vuelta');
  if (input) input.value = dateStr;

  // Si es ida, actualizar mínimo de vuelta
  if (type === 'ida') {
    const vuelInp = $('h-fecha-vuelta');
    const vuelVal = vuelInp ? vuelInp.value : '';
    if (vuelVal && vuelVal < dateStr) {
      vuelInp.value = '';
    }
  }

  closeDatePicker();
}

async function doSearchSailings() {
  if (_searchInProgress) return;
  const origenId    = val('h-origen-id');
  const destinoId   = val('h-destino-id');
  const origenNm    = val('h-origen');
  const destinoNm   = val('h-destino');
  const fechaIda    = val('h-fecha-ida');
  const fechaVuelta = val('h-fecha-vuelta');
  const _tripText   = document.querySelector('#home-seg .seg-btn.active')?.textContent.trim() || 'Ida';
  const _tripMap    = { 'Ida': 'ida', 'Vuelta': 'vuelta', 'Ida y vuelta': 'idayvuelta' };
  const tripType    = _tripMap[_tripText] || 'ida';
  const isRoundTrip = tripType === 'idayvuelta';
  let isOk = true;

  if (!origenId || !origenNm) { fieldErr('e-origen','h-origen','Selecciona un puerto de origen'); isOk=false; } else fieldOk('e-origen','h-origen');
  if (!destinoId|| !destinoNm){ fieldErr('e-destino','h-destino','Selecciona un puerto de destino'); isOk=false; } else fieldOk('e-destino','h-destino');
  if (!fechaIda) { fieldErr('e-fecha-ida','h-fecha-ida','La fecha de ida es obligatoria'); isOk=false; } else fieldOk('e-fecha-ida','h-fecha-ida');
  if (isRoundTrip) {
    if (!fechaVuelta) { fieldErr('e-fecha-vuelta','h-fecha-vuelta','La fecha de vuelta es obligatoria'); isOk=false; }
    else if (fechaVuelta < fechaIda) { fieldErr('e-fecha-vuelta','h-fecha-vuelta','La vuelta no puede ser anterior a la ida'); isOk=false; }
    else fieldOk('e-fecha-vuelta','h-fecha-vuelta');
  }

  // Validar contra disponibilidades cargadas
  const availMap = {};
  (state.availabilities || []).forEach(a => {
    const key = `${a.year}-${String(a.month).padStart(2,'0')}-${String(a.day).padStart(2,'0')}`;
    availMap[key] = a.status;
  });
  if (fechaIda && availMap[fechaIda] === 'unavailable') {
    fieldErr('e-fecha-ida','h-fecha-ida','Fecha no disponible para esta ruta'); isOk=false;
  }
  if (isRoundTrip && fechaVuelta && availMap[fechaVuelta] === 'unavailable') {
    fieldErr('e-fecha-vuelta','h-fecha-vuelta','Fecha no disponible para esta ruta'); isOk=false;
  }

  if (!isOk) return;

  const searchParams = { origenNm, origenId, destinoNm, destinoId, fechaIda, fechaVuelta, tripType };
  state.bookingWizard = {
    tripType, origin: origenNm, originId: origenId,
    destination: destinoNm, destinationId: destinoId,
    dateIda: fechaIda, dateVuelta: fechaVuelta || null,
    selectedSailing: null, passengers: [], vehicles: [], saveAsFrequent: false,
    searchParams,
  };

  const content = $('wiz-content');
  if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
    <div class="loading-row" style="justify-content:center;margin-bottom:8px">
      <div class="loading-spinner"></div>
      <span>Consultando navieras disponibles…</span>
    </div>
    <div style="font-size:0.8125rem;color:var(--gray-400)">${esc(origenNm)} → ${esc(destinoNm)} · ${esc(fechaIda)}</div>
  </div>`;

  _searchInProgress = true;
  try {
    const ttRes = await api('POST', '/timetables', {
      departure_port_id: Number(origenId),
      destination_port_id: Number(destinoId),
      date: fechaIda,
    });
    const timetables = Array.isArray(ttRes) ? ttRes : (ttRes.data || ttRes.timetables || []);

    const combined = timetables.map(t => ({
      naviera:       t.naviera || t.name || 'Naviera',
      naviera_id:    t.naviera_id || t.id || null,
      departureDate: t.date || t.departureDate || fechaIda,
      departureTime: t.departureTime || t.departure_time || t.time || '—',
      raw:           t.raw || t,
    })).sort((a, b) => {
      const ta = a.departureTime || '', tb = b.departureTime || '';
      return ta.localeCompare(tb);
    });
    state.searchResults = combined;

    if (combined.length === 0) {
      if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
        <div style="font-size:2rem;margin-bottom:12px">🚢</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:8px">Sin disponibilidad</div>
        <div style="color:var(--gray-400);font-size:0.875rem;margin-bottom:20px">No hay reservas para <strong>${esc(origenNm)} → ${esc(destinoNm)}</strong> el ${fmtDateShort(fechaIda)}.</div>
        <button class="btn btn-secondary" style="width:auto" onclick="showWizStep1()">Cambiar búsqueda</button>
      </div>`;
      return;
    }
    showWizStep2();
  } catch(err) {
    if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
      <div style="color:var(--danger);font-weight:700;margin-bottom:8px">Error al consultar disponibilidad</div>
      <div style="color:var(--gray-400);font-size:0.875rem;margin-bottom:20px">${esc(err.message)}</div>
      <button class="btn btn-secondary" style="width:auto" onclick="showWizStep1()">Volver a búsqueda</button>
    </div>`;
  } finally {
    _searchInProgress = false;
  }
}

function mergeResults(sailings, timetables, date) {
  const results = [];
  if (sailings.length > 0) {
    sailings.forEach(s => {
      const tt = timetables.find(t => (t.company_id||t.naviera_id) === (s.company_id||s.naviera_id)) || {};
      results.push({
        naviera:       s.company_name || s.naviera || s.name || 'Naviera',
        departureDate: s.departureDate || tt.date || s.date || date,
        departureTime: s.departureTime || tt.departure_time || s.departure_time || s.hora_salida || '—',
        raw: s
      });
    });
    return results;
  }
  return [
    { naviera:'Balearia',          departureDate: date, departureTime:'07:30', raw:{} },
    { naviera:'Trasmediterránea',  departureDate: date, departureTime:'10:00', raw:{} },
    { naviera:'FRS',               departureDate: date, departureTime:'12:15', raw:{} },
    { naviera:'Armas Trasatlántica', departureDate: date, departureTime:'14:45', raw:{} },
    { naviera:'GNV',               departureDate: date, departureTime:'17:30', raw:{} },
  ];
}

function showWizStep2() {
  const wz = state.bookingWizard;
  renderWizStepBar(2);
  const content = $('wiz-content');
  if (!content) return;
  const { origenNm, destinoNm, fechaIda } = wz.searchParams;
  const combined = state.searchResults.sort((a, b) => {
    const ta = a.departureTime || '', tb = b.departureTime || '';
    return ta.localeCompare(tb);
  });
  content.innerHTML = `<div class="card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="showWizStep1()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Cambiar búsqueda
      </button>
      <div>
        <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">${esc(origenNm)} → ${esc(destinoNm)}</div>
        <div style="font-size:0.8125rem;color:var(--gray-400)">${fmtDateShort(fechaIda)} · ${combined.length} opción${combined.length!==1?'es':''} disponible${combined.length!==1?'s':''}</div>
      </div>
    </div>
    ${combined.map((r,i) => `
      <div class="sailing-row" onclick="selectSailing(${i})">
        <div class="sailing-main">
          ${getNavieraLogo(r.naviera, 'lg')}
          <div class="sailing-info">
            <div class="sailing-naviera">${esc(r.naviera)}</div>
            <div class="sailing-time">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Salida: <strong>${esc(r.departureDate)} ${esc(r.departureTime)}</strong>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" style="width:auto;flex-shrink:0">Seleccionar →</button>
      </div>
    `).join('')}
  </div>`;
}

function mergeResults(sailings, timetables, date) {
  const results = [];

  // If sailings have data
  if (sailings.length > 0) {
    sailings.forEach(s => {
      const tt = timetables.find(t => (t.company_id||t.naviera_id) === (s.company_id||s.naviera_id)) || {};
      results.push({
        naviera:       s.company_name || s.naviera || s.name || 'Naviera',
        departureDate: s.departureDate || tt.date || s.date || date,
        departureTime: s.departureTime || tt.departure_time || s.departure_time || s.hora_salida || '—',
        raw: s
      });
    });
    return results;
  }

  // If timetables have data but no sailings
  if (timetables.length > 0) {
    timetables.forEach(t => {
      results.push({
        naviera:       t.naviera || t.company_name || 'Naviera',
        departureDate: t.date || date,
        departureTime: t.departureTime || t.departure_time || '—',
        raw: t
      });
    });
    return results;
  }

  return [];
}

// ── Paso 2: Disponibilidad ────────────────────────────────────
function selectSailing(idx) {
  const s = state.searchResults[idx];
  if (!s || !state.bookingWizard) return;
  state.bookingWizard.selectedSailing = s;
  showWizStep3();
}

// ── Paso 3: Datos del pasajero ───────────────────────────────
function showWizStep3() {
  const wz = state.bookingWizard;
  if (!wz) return;
  renderWizStepBar(3);
  const content = $('wiz-content');
  if (!content) return;
  const fp = state.frequentPassengers;
  
  // Lista de pasajeros añadidos con sus vehículos
  const paxListHtml = wz.passengers.length > 0 ? `
    <div class="pax-list-container" style="margin-bottom:24px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--radius)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-weight:700;font-size:0.875rem;color:#c2410c">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Pasajeros añadidos (${wz.passengers.length})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${wz.passengers.map((p, idx) => {
          const paxVehicles = (wz.vehicles || []).filter(v => v.driverPassengerIndex === idx);
          return `
          <div class="pax-item-card" style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 16px;background:white;border:1px solid #fed7aa;border-radius:var(--radius);gap:12px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-weight:600;font-size:0.875rem">
                  ${idx + 1}. ${esc(p.nombre)} ${esc(p.apellido1)}
                </span>
                ${paxVehicles.length > 0 ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:10px;font-size:0.65rem;font-weight:700">🚗 Conductor</span>' : ''}
              </div>
              <div style="font-size:0.75rem;color:var(--gray-500)">${esc(p.tipoDoc)}: ${esc(p.numDoc)} · ${esc(p.email)}</div>
              ${paxVehicles.length > 0 ? `
              <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
                ${paxVehicles.map(v => `
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--gray-100);border-radius:10px;font-size:0.6875rem;color:var(--gray-600)">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    ${esc(v.marca||'')} ${esc(v.modelo||'')}
                  </span>
                `).join('')}
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 10px;font-size:0.6875rem;width:auto" onclick="event.stopPropagation();addVehicleToPassenger(${idx})">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  + Vehículo
                </button>
              </div>` : `
              <button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;padding:2px 10px;font-size:0.6875rem;width:auto" onclick="event.stopPropagation();addVehicleToPassenger(${idx})">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Añadir vehículo
              </button>`}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn-icon-outline" onclick="editWizPassenger(${idx})" title="Editar pasajero" style="width:28px;height:28px">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon-danger" onclick="removeWizPassenger(${idx})" title="Eliminar pasajero" style="width:28px;height:28px">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;}).join('')}
      </div>
    </div>
  ` : '';

  const vehiclesInfoHtml = (wz.vehicles && wz.vehicles.length > 0) ? `
    <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:var(--radius);margin-bottom:20px;font-size:0.875rem;color:#0369a1">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      <span><strong>${wz.vehicles.length} vehículo(s)</strong> añadido(s) a esta reserva</span>
    </div>` : '';

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="showWizStep2()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <div>
          <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">Paso 3: Añadir pasajeros</div>
          <div style="font-size:0.8125rem;color:var(--gray-400)">
            ${wz.passengers.length === 0 ? 'Rellena los datos del primer pasajero' : `Ya tienes ${wz.passengers.length} pasajero(s) · Puedes añadir más o continuar al resumen`}
          </div>
        </div>
      </div>

      ${vehiclesInfoHtml}
      ${paxListHtml}

      <div class="fp-section" style="background:#f5f3ff;border:1px solid #c4b5fd;padding:16px;border-radius:var(--radius);margin-bottom:24px">
        <div class="fp-section-header" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:0.8125rem;color:#7c3aed">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Cargar desde Pasajeros Frecuentes
        </div>
        ${fp.length > 0 ? `
        <div class="fp-select-wrap" style="position:relative">
          <input type="text" class="form-input" id="fp-search" value="" placeholder="Escribe para buscar pasajero..." autocomplete="off"
            oninput="filterFrequentPax(this)" onfocus="filterFrequentPax(this)" onblur="setTimeout(()=>hideDropdown('drop-fp'),180)">
          <div class="route-dropdown" id="drop-fp"></div>
          <input type="hidden" id="fp-selected-idx" value="">
        </div>` : `<p style="font-size:0.75rem;color:var(--gray-500);margin:0">No hay pasajeros frecuentes guardados.</p>`}
      </div>

      <form id="wiz-pax-form" onsubmit="addPassengerAction(event)" novalidate>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #dbeafe">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#3b82f6;color:white;flex-shrink:0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span style="font-weight:700;font-size:0.875rem;color:#1e40af;text-transform:uppercase;letter-spacing:0.025em">Datos del nuevo pasajero</span>
        </div>
        <div id="fp-duplicate-warn" style="display:none;margin-bottom:16px;padding:10px 14px;background:#fef9c3;border:1px solid #facc15;border-radius:var(--radius);font-size:0.8125rem;color:var(--gray-700);align-items:center;gap:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Este pasajero ya existe en tu lista de pasajeros frecuentes.</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nombre <span style="color:var(--danger)">*</span></label>
            <input type="text" id="pax-nombre" class="form-input" placeholder="Nombre">
            <span class="error-msg" id="e-pax-nombre"></span>
          </div>
          <div class="form-group">
            <label class="form-label">1er Apellido <span style="color:var(--danger)">*</span></label>
            <input type="text" id="pax-ape1" class="form-input" placeholder="Primer apellido">
            <span class="error-msg" id="e-pax-ape1"></span>
          </div>
          <div class="form-group">
            <label class="form-label">2º Apellido</label>
            <input type="text" id="pax-ape2" class="form-input" placeholder="Segundo apellido">
          </div>
          <div class="form-group">
            <label class="form-label">Correo electrónico <span style="color:var(--danger)">*</span></label>
            <input type="email" id="pax-email" class="form-input" placeholder="correo@ejemplo.com">
            <span class="error-msg" id="e-pax-email"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar correo <span style="color:var(--danger)">*</span></label>
            <input type="email" id="pax-email2" class="form-input" placeholder="Repite el correo">
            <span class="error-msg" id="e-pax-email2"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono <span style="color:var(--danger)">*</span></label>
            <div class="input-group">
              <select id="pax-pre" class="form-input" style="width:100px;flex-shrink:0;border-right:none;border-radius:var(--radius) 0 0 var(--radius)">
                <option value="+34">🇪🇸 +34</option><option value="+1">🇺🇸 +1</option><option value="+33">🇫🇷 +33</option><option value="+39">🇮🇹 +39</option><option value="+351">🇵🇹 +351</option>
              </select>
              <input type="tel" id="pax-tel" class="form-input" style="border-radius:0 var(--radius) var(--radius) 0">
            </div>
            <span class="error-msg" id="e-pax-tel"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de nacimiento <span style="color:var(--danger)">*</span></label>
            <input type="date" id="pax-fnac" class="form-input">
            <span class="error-msg" id="e-pax-fnac"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Nacionalidad <span style="color:var(--danger)">*</span></label>
            <select id="pax-nac" class="form-input">
              <option value="">— Seleccionar —</option>
              <option value="ES">Española</option><option value="FR">Francesa</option><option value="IT">Italiana</option><option value="PT">Portuguesa</option><option value="MA">Marroquí</option><option value="OTHER">Otra</option>
            </select>
            <span class="error-msg" id="e-pax-nac"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de documento <span style="color:var(--danger)">*</span></label>
            <select id="pax-tipdoc" class="form-input">
              <option value="">— Seleccionar —</option>
              <option value="DNI">DNI</option><option value="NIE">NIE</option><option value="PASAPORTE">Pasaporte</option>
            </select>
            <span class="error-msg" id="e-pax-tipdoc"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Número de documento <span style="color:var(--danger)">*</span></label>
            <input type="text" id="pax-numdoc" class="form-input" oninput="this.value=this.value.toUpperCase(); checkFrequentPassengerDuplicate(this.value)">
            <span class="error-msg" id="e-pax-numdoc"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Expiración documento <span style="color:var(--danger)">*</span></label>
            <input type="date" id="pax-expdoc" class="form-input">
            <span class="error-msg" id="e-pax-expdoc"></span>
          </div>
        </div>

        <div style="margin:16px 0 24px" id="guardar-frecuente-wrap">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.875rem">
            <input type="checkbox" id="pax-frecuente" style="width:18px;height:18px;accent-color:var(--primary)">
            Guardar como pasajero frecuente
          </label>
        </div>

        <div id="vehicle-section" style="display:none;margin:0 0 20px;padding:16px;background:#f0f9ff;border:2px solid #38bdf8;border-radius:var(--radius)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:0.875rem;color:#0369a1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              Datos del vehículo
            </div>
            <button type="button" class="btn-icon-danger" onclick="hideVehicleSection()" title="Cerrar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div id="vehicle-form-container"></div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--gray-100)">
          <button type="submit" class="btn btn-secondary" style="width:auto;padding:11px 24px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir pasajero
          </button>

          <button type="button" class="btn btn-outline" style="width:auto;padding:11px 20px" onclick="addVehicleForNewPassenger()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            Añadir vehículo
          </button>
        </div>
      </form>

      ${wz.passengers.length > 0 ? `
      <div style="margin-top:28px;padding:20px 24px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#10b981;color:white;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style="font-weight:700;font-size:0.9375rem;color:#065f46">${wz.passengers.length} pasajero${wz.passengers.length === 1 ? '' : 's'} listo${wz.passengers.length === 1 ? '' : 's'}</div>
            <div style="font-size:0.8125rem;color:#047857">Revisa los datos y continúa al resumen cuando estés listo</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary" style="width:auto;padding:12px 32px;font-size:1rem" onclick="finalizePassengerStep()">
          Continuar al resumen →
        </button>
      </div>` : ''}
    </div>`;
}

function checkFrequentPassengerDuplicate(value) {
  const trimmed = (value || '').trim();
  const exists = !!trimmed && state.frequentPassengers.some(p => p.numDoc === trimmed);
  const wrap = $('guardar-frecuente-wrap');
  const warn = $('fp-duplicate-warn');
  const cb   = $('pax-frecuente');
  if (wrap) wrap.style.display = exists ? 'none' : 'block';
  if (warn) warn.style.display = exists ? 'flex' : 'none';
  if (cb) {
    cb.disabled = exists;
    if (exists) cb.checked = false;
    const lbl = cb.closest('label');
    if (lbl) lbl.style.opacity = exists ? '0.5' : '';
  }
  const numdocInp = $('pax-numdoc');
  if (numdocInp) numdocInp.classList.toggle('is-frequent-dup', exists);
}

function showVehicleForm(passengerIndex) {
  const wz = state.bookingWizard;
  if (!wz) return;
  persistAllVehicleBlocks();
  if (!Array.isArray(wz.vehicles) || wz.vehicles.length === 0) {
    const newEntry = emptyVehicleEntry();
    if (typeof passengerIndex === 'number') {
      newEntry.driverPassengerIndex = passengerIndex;
    }
    wz.vehicles = [newEntry];
  } else if (typeof passengerIndex === 'number') {
    wz.vehicles.forEach(v => {
      if (typeof v.driverPassengerIndex !== 'number' || isNaN(v.driverPassengerIndex) || v.driverPassengerIndex === -1) {
        v.driverPassengerIndex = passengerIndex;
      }
    });
  }
  const section = $('vehicle-section');
  const container = $('vehicle-form-container');
  if (!section || !container) return;
  const blocks = wz.vehicles.map((_, idx) => renderVehicleBlock(idx)).join('');
  container.innerHTML = `<div id="vehicle-blocks-wrapper">${blocks}</div>`;
  section.style.display = 'block';
}

function addVehicleForNewPassenger() {
  const wz = state.bookingWizard;
  if (!wz) return;
  persistAllVehicleBlocks();
  const newEntry = emptyVehicleEntry();
  newEntry.driverPassengerIndex = -1;
  if (!Array.isArray(wz.vehicles)) wz.vehicles = [];
  wz.vehicles.push(newEntry);
  showVehicleForm();
}

function addAnotherVehicleBlock() {
  const wz = state.bookingWizard;
  if (!wz) return;
  persistAllVehicleBlocks();
  const newEntry = emptyVehicleEntry();
  newEntry.driverPassengerIndex = -1;
  wz.vehicles.push(newEntry);
  showVehicleForm();
}

function hideVehicleSection() {
  persistAllVehicleBlocks();
  const section = $('vehicle-section');
  if (section) section.style.display = 'none';
}

function removeWizPassenger(idx) {
  if (!state.bookingWizard) return;
  // También eliminar vehículos asociados a este pasajero
  const wz = state.bookingWizard;
  if (wz.vehicles) {
    wz.vehicles = wz.vehicles.filter(v => v.driverPassengerIndex !== idx);
    // Reajustar índices de conductor
    wz.vehicles.forEach(v => {
      if (typeof v.driverPassengerIndex === 'number' && v.driverPassengerIndex > idx) {
        v.driverPassengerIndex--;
      }
    });
  }
  wz.passengers.splice(idx, 1);
  showWizStep3();
}

function addVehicleToPassenger(passengerIndex) {
  const wz = state.bookingWizard;
  if (!wz) return;
  persistAllVehicleBlocks();
  if (!Array.isArray(wz.vehicles)) wz.vehicles = [];
  const newEntry = emptyVehicleEntry();
  newEntry.driverPassengerIndex = passengerIndex;
  wz.vehicles.push(newEntry);
  showVehicleForm(passengerIndex);
}

function editWizPassenger(idx) {
  const wz = state.bookingWizard;
  if (!wz || !wz.passengers[idx]) return;
  const p = wz.passengers[idx];
  // Rellenar el formulario con los datos del pasajero
  const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
  set('pax-nombre', p.nombre);
  set('pax-ape1', p.apellido1);
  set('pax-ape2', p.apellido2 || '');
  set('pax-email', p.email);
  set('pax-email2', p.email);
  const knownPrefixes = ['+34','+1','+44','+33','+49','+39','+351'];
  let telPrefix = '+34', telNumber = p.telefono || '';
  for (const pre of knownPrefixes) {
    if (telNumber.startsWith(pre + ' ') || telNumber.startsWith(pre)) {
      telPrefix = pre;
      telNumber = telNumber.slice(pre.length).trim();
      break;
    }
  }
  const preEl = $('pax-pre'); if (preEl) preEl.value = telPrefix;
  set('pax-tel', telNumber);
  set('pax-fnac', p.fnac);
  set('pax-nac', p.nacionalidad);
  set('pax-tipdoc', p.tipoDoc);
  set('pax-numdoc', p.numDoc);
  set('pax-expdoc', p.expDoc);
  // Desvincular vehículos del pasajero editado y reajustar índices
  if (wz.vehicles) {
    wz.vehicles.forEach(v => {
      if (v.driverPassengerIndex === idx) {
        v.driverPassengerIndex = -1;
      }
    });
  }
  // Eliminar el pasajero original y dar feedback
  wz.passengers.splice(idx, 1);
  // Reajustar índices de conductor tras el desplazamiento
  if (wz.vehicles) {
    wz.vehicles.forEach(v => {
      if (typeof v.driverPassengerIndex === 'number' && v.driverPassengerIndex > idx) {
        v.driverPassengerIndex--;
      }
    });
  }
  showToast('info', 'Editando pasajero', 'Modifica los datos y pulsa "Añadir pasajero" para guardar.');
  // Scroll al formulario
  const form = $('wiz-pax-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function addPassengerAction(e) {
  if (e) e.preventDefault();
  const nombre  = val('pax-nombre').trim();
  const ape1    = val('pax-ape1').trim();
  const email   = val('pax-email').trim();
  const email2  = val('pax-email2').trim();
  const tel     = val('pax-tel').trim();
  const fnac    = val('pax-fnac');
  const nac     = val('pax-nac');
  const tipdoc  = val('pax-tipdoc');
  const numdoc  = val('pax-numdoc').trim();
  const expdoc  = val('pax-expdoc');
  let ok = true;

  if (!nombre || !isName(nombre)) { fieldErr('e-pax-nombre','pax-nombre', !nombre ? 'Requerido' : 'Introduce un nombre válido.'); ok=false; } else fieldOk('e-pax-nombre','pax-nombre');
  if (!ape1 || !isName(ape1))    { fieldErr('e-pax-ape1','pax-ape1', !ape1 ? 'Requerido' : 'Introduce un apellido válido.'); ok=false; } else fieldOk('e-pax-ape1','pax-ape1');
  if (!isEmail(email))   { fieldErr('e-pax-email','pax-email','Inválido'); ok=false; } else fieldOk('e-pax-email','pax-email');
  if (email !== email2)  { fieldErr('e-pax-email2','pax-email2','No coinciden'); ok=false; } else fieldOk('e-pax-email2','pax-email2');
  if (!tel || !isPhone(tel)) { fieldErr('e-pax-tel','pax-tel','Teléfono inválido (solo dígitos, 6-15 caracteres)'); ok=false; } else fieldOk('e-pax-tel','pax-tel');
  if (!fnac)             { fieldErr('e-pax-fnac','pax-fnac','Requerido'); ok=false; } else fieldOk('e-pax-fnac','pax-fnac');
  if (!nac)              { fieldErr('e-pax-nac','pax-nac','Requerido'); ok=false; } else fieldOk('e-pax-nac','pax-nac');
  if (!tipdoc)           { fieldErr('e-pax-tipdoc','pax-tipdoc','Requerido'); ok=false; } else fieldOk('e-pax-tipdoc','pax-tipdoc');
  if (!numdoc || (tipdoc && !isDocNum(numdoc, tipdoc))) { fieldErr('e-pax-numdoc','pax-numdoc', !numdoc ? 'Requerido' : 'Introduce un número de documento válido.'); ok=false; } else fieldOk('e-pax-numdoc','pax-numdoc');
  if (!expdoc)           { fieldErr('e-pax-expdoc','pax-expdoc','Requerido'); ok=false; } else fieldOk('e-pax-expdoc','pax-expdoc');
  if (!ok) return;

  const wz = state.bookingWizard;
  // Validación de identidad única: comprobar DNI/Pasaporte duplicado
  if (wz.passengers.some(p => p.numDoc === numdoc)) {
    showToast('warning','Pasajero duplicado','Ya existe un pasajero con este número de documento en la reserva.');
    fieldErr('e-pax-numdoc','pax-numdoc','Ya existe en esta reserva');
    return;
  }
  // Validación adicional: comprobar nombre completo + fecha de nacimiento
  const fullNameKey = `${nombre.toLowerCase()} ${ape1.toLowerCase()}`;
  if (wz.passengers.some(p => {
    const existingKey = `${(p.nombre||'').toLowerCase()} ${(p.apellido1||'').toLowerCase()}`;
    return existingKey === fullNameKey && p.fnac === fnac;
  })) {
    showToast('warning','Pasajero duplicado','Ya existe un pasajero con el mismo nombre y fecha de nacimiento en esta reserva.');
    return;
  }

  const pax = {
    nombre, apellido1: ape1, apellido2: val('pax-ape2').trim(),
    email, telefono: `${val('pax-pre')} ${tel}`,
    fnac, nacionalidad: nac, tipoDoc: tipdoc, numDoc: numdoc, expDoc: expdoc,
  };

  // Si se marcó "guardar como frecuente", hacerlo ahora
  if ($('pax-frecuente')?.checked) {
    const newFp = { nombre: pax.nombre, apellido1: pax.apellido1, apellido2: pax.apellido2 || '', email: pax.email, telefono: pax.telefono, fnac: pax.fnac, nacionalidad: pax.nacionalidad, tipoDoc: pax.tipoDoc, numDoc: pax.numDoc, expDoc: pax.expDoc };
    try {
      const saved = await api('POST', '/frequent-passengers', newFp);
      state.frequentPassengers.push(saved);
      showToast('success','Pasajero guardado','Se ha añadido a tus pasajeros frecuentes.');
    } catch(e) {
      console.error('[FREQUENT_PASSENGER] Error:', e.message);
      showToast('warning','Pasajero no guardado','No se pudo añadir a pasajeros frecuentes.');
    }
  }

  // Persistir vehículos que estén en el formulario antes de recargar la página
  persistAllVehicleBlocks();

  // Asignar vehículos pendientes (driverPassengerIndex === -1) a este pasajero
  const newPaxIdx = state.bookingWizard.passengers.length;
  if (Array.isArray(state.bookingWizard.vehicles)) {
    state.bookingWizard.vehicles.forEach(v => {
      if (v.driverPassengerIndex === -1) {
        v.driverPassengerIndex = newPaxIdx;
      }
    });
  }

  state.bookingWizard.passengers.push(pax);
  showToast('success','Pasajero añadido',`${nombre} ha sido añadido al viaje.`);
  showWizStep3(); // Recargar para mostrar lista y formulario vacío
}

function finalizePassengerStep() {
  const wz = state.bookingWizard;
  if (!wz || wz.passengers.length === 0) {
    showToast('warning','Sin pasajeros','Añade al menos un pasajero antes de continuar.');
    return;
  }
  persistAllVehicleBlocks();
  if (wz.vehicles && wz.vehicles.length > 0) {
    const unassigned = wz.vehicles.filter(v => typeof v.driverPassengerIndex !== 'number' || v.driverPassengerIndex < 0 || v.driverPassengerIndex >= wz.passengers.length);
    if (unassigned.length > 0) {
      showToast('warning','Conductor sin asignar','Todos los vehículos deben tener un conductor asignado. Selecciona un conductor para cada vehículo.');
      showVehicleForm();
      return;
    }
    const driverIndices = wz.vehicles.map(v => v.driverPassengerIndex);
    const duplicates = driverIndices.filter((idx, i) => driverIndices.indexOf(idx) !== i);
    if (duplicates.length > 0) {
      showToast('warning','Conductor duplicado','Cada vehículo debe tener un conductor diferente. Un pasajero no puede conducir dos vehículos.');
      showVehicleForm();
      return;
    }
  }
  showWizStep5();
}

function selectFrequentPax(idx) {
  const p = state.frequentPassengers[idx];
  if (!p) return;
  const inp = $('fp-search');
  if (inp) inp.value = `${p.nombre} ${p.apellido1} · ${p.numDoc}`;
  const hid = $('fp-selected-idx');
  if (hid) hid.value = idx;

  const set = (id, v) => { const el=$(id); if(el) el.value=v||''; };
  set('pax-nombre', p.nombre);
  set('pax-ape1',   p.apellido1);
  set('pax-ape2',   p.apellido2);
  set('pax-email',  p.email);
  set('pax-email2', p.email);

  const knownPrefixes = ['+34','+1','+44','+33','+49','+39','+351'];
  let telPrefix = '+34', telNumber = p.telefono || '';
  for (const pre of knownPrefixes) {
    if (telNumber.startsWith(pre + ' ') || telNumber.startsWith(pre)) {
      telPrefix  = pre;
      telNumber  = telNumber.slice(pre.length).trim();
      break;
    }
  }
  const preEl = $('pax-pre'); if (preEl) preEl.value = telPrefix;
  set('pax-tel',    telNumber);
  set('pax-fnac',   p.fnac);
  set('pax-nac',    p.nacionalidad);
  set('pax-tipdoc', p.tipoDoc);
  set('pax-numdoc', p.numDoc);
  set('pax-expdoc', p.expDoc);

  checkFrequentPassengerDuplicate(p.numDoc);
  showToast('info','Datos cargados',`Se han cargado los datos de ${p.nombre}.`);
  hideDropdown('drop-fp');
}

function filterFrequentPax() {
  const inp = $('fp-search');
  const drop = $('drop-fp');
  if (!inp || !drop) return;
  const q = inp.value.trim().toLowerCase();
  const fp = state.frequentPassengers || [];
  const filtered = fp.filter(p =>
    `${p.nombre} ${p.apellido1} ${p.apellido2||''} ${p.numDoc} ${p.email||''}`.toLowerCase().includes(q)
  );
  if (!filtered.length) {
    drop.innerHTML = `<div class="route-option" style="color:var(--gray-400);cursor:default">Sin resultados</div>`;
    drop.classList.add('open');
    return;
  }
  drop.innerHTML = filtered.map(p => {
    const idx = state.frequentPassengers.indexOf(p);
    return `<div class="route-option" data-idx="${idx}"
      onmousedown="selectFrequentPax(${idx})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      ${esc(p.nombre)} ${esc(p.apellido1)}${p.apellido2 ? ' ' + esc(p.apellido2) : ''} · ${esc(p.numDoc)}
    </div>`;
  }).join('');
  drop.classList.add('open');
}

function selectVehicle(vehId, idx) {
  const v = state.vehicles.find(v => String(v.id) === String(vehId));
  if (!v || !state.bookingWizard?.vehicles?.[idx]) return;
  const inp = $(`veh-search-${idx}`);
  if (inp) inp.value = `${v.marca} ${v.modelo}${v.matricula ? ' [' + v.matricula + ']' : ''} — ${v.largo}m × ${v.ancho}m × ${v.alto}m`;
  const hid = $(`veh-selected-id-${idx}`);
  if (hid) hid.value = v.id;
  fieldOk(`e-veh-select-${idx}`, `veh-search-${idx}`);
  Object.assign(state.bookingWizard.vehicles[idx], {
    _mode: 'registrado', registeredId: v.id,
    marca: v.marca, modelo: v.modelo, matricula: v.matricula || '',
    ancho: v.ancho, largo: v.largo, alto: v.alto,
  });
  hideDropdown(`drop-veh-${idx}`);
}

function filterVehicles(idx) {
  const inp = $(`veh-search-${idx}`);
  const drop = $(`drop-veh-${idx}`);
  if (!inp || !drop) return;
  const q = inp.value.trim().toLowerCase();
  const vehicles = state.vehicles || [];
  const wz = state.bookingWizard;
  const usedIds = wz?.vehicles
    ? wz.vehicles.filter((veh, i) => i !== idx && veh._mode === 'registrado' && veh.registeredId).map(veh => String(veh.registeredId))
    : [];
  const filtered = vehicles.filter(v =>
    !usedIds.includes(String(v.id)) &&
    `${v.marca} ${v.modelo} ${v.matricula||''}`.toLowerCase().includes(q)
  );
  if (!filtered.length) {
    drop.innerHTML = `<div class="route-option" style="color:var(--gray-400);cursor:default">Sin resultados</div>`;
    drop.classList.add('open');
    return;
  }
  drop.innerHTML = filtered.map(v =>
    `<div class="route-option" data-id="${v.id}"
      onmousedown="selectVehicle('${v.id}', ${idx})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      ${esc(v.marca)} ${esc(v.modelo)}${v.matricula ? ' [' + esc(v.matricula) + ']' : ''} — ${v.largo}m × ${v.ancho}m × ${v.alto}m
    </div>`
  ).join('');
  drop.classList.add('open');
}

// ── Paso 4: Datos del vehículo ───────────────────────────────
function emptyVehicleEntry() {
  const defaultMode = state.vehicles.length > 0 ? 'registrado' : 'nuevo';
  return { _mode: defaultMode, registeredId:'', marca:'', modelo:'', matricula:'', ancho:'', largo:'', alto:'' };
}

function showWizStep4() {
  const wz = state.bookingWizard;
  if (!wz) return;
  renderWizStepBar(4, true);
  const content = $('wiz-content');
  if (!content) return;

  if (!Array.isArray(wz.vehicles) || wz.vehicles.length === 0) {
    const legacy = wz.vehicle ? [{ ...wz.vehicle, _mode: 'nuevo' }] : [];
    const cnt = wz._vehicleCount || legacy.length || 1;
    wz.vehicles = [];
    for (let i = 0; i < cnt; i++) wz.vehicles.push(legacy[i] || emptyVehicleEntry());
  }
  wz._vehicleCount = wz.vehicles.length;

  const blocks = wz.vehicles.map((_, idx) => renderVehicleBlock(idx)).join('');

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="showWizStep3()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <div>
          <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">Datos del vehículo</div>
          <div style="font-size:0.8125rem;color:var(--gray-400)">Configura los datos individuales de cada vehículo añadido a la reserva</div>
        </div>
      </div>

      <form id="wiz-veh-form" onsubmit="wizStep4Submit(event)" novalidate>
        ${blocks}

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="showWizStep3()">← Volver</button>
          <button type="submit" class="btn btn-primary" style="width:auto;padding:11px 28px">Siguiente: Confirmar →</button>
        </div>
      </form>
    </div>`;

}

function renderVehicleBlock(idx) {
  const wz = state.bookingWizard;
  const v  = wz.vehicles[idx];
  const savedVehicles = state.vehicles;
  const hasReg = savedVehicles.length > 0;
  const mode   = v._mode || (hasReg ? 'registrado' : 'nuevo');
  const regSel = (v.registeredId && hasReg)
    ? `${esc(v.marca||'')} ${esc(v.modelo||'')}${v.matricula?` [${esc(v.matricula)}]`:''} — ${v.largo}m × ${v.ancho}m × ${v.alto}m`
    : '';

  return `
  <div class="vehicle-block" data-idx="${idx}" style="border:1px solid var(--gray-200);border-radius:var(--radius);padding:18px;margin-bottom:18px;background:var(--gray-50)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-full);background:var(--primary);color:#fff;font-weight:700;font-size:0.8125rem">${idx + 1}</span>
        <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">Vehículo ${idx + 1}</div>
      </div>
      ${wz.vehicles.length > 1 ? `<button type="button" class="btn-icon-danger" onclick="removeVehicleBlock(${idx})" title="Eliminar vehículo">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>` : ''}
    </div>

    <div class="veh-mode-selector" style="margin-bottom:16px">
      ${hasReg ? `
      <label class="veh-mode-option ${mode==='registrado'?'active':''}" id="veh-mode-reg-lbl-${idx}">
        <input type="radio" name="veh-mode-${idx}" value="registrado" ${mode==='registrado'?'checked':''} onchange="onVehicleModeChange(${idx},'registrado')">
        <span class="veh-mode-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </span>
        <div>
          <div class="veh-mode-title">Vehículo registrado</div>
          <div class="veh-mode-sub">Usar uno guardado en la flota</div>
        </div>
      </label>` : ''}
      <label class="veh-mode-option ${mode==='nuevo'?'active':''}" id="veh-mode-new-lbl-${idx}">
        <input type="radio" name="veh-mode-${idx}" value="nuevo" ${mode==='nuevo'?'checked':''} onchange="onVehicleModeChange(${idx},'nuevo')">
        <span class="veh-mode-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </span>
        <div>
          <div class="veh-mode-title">Añadir nuevo</div>
          <div class="veh-mode-sub">Introducir datos manualmente</div>
        </div>
      </label>
    </div>

    <div id="veh-reg-panel-${idx}" style="${mode==='registrado'?'':'display:none'}">
      <div style="margin-bottom:0;position:relative">
        <label class="form-label">Selecciona el vehículo</label>
        <input type="text" class="form-input" id="veh-search-${idx}" value="${regSel}" placeholder="Escribe para buscar vehículo..." autocomplete="off"
          oninput="filterVehicles(${idx})" onfocus="filterVehicles(${idx})" onblur="setTimeout(()=>hideDropdown('drop-veh-${idx}'),180)">
        <div class="route-dropdown" id="drop-veh-${idx}"></div>
        <input type="hidden" id="veh-selected-id-${idx}" value="${v.registeredId||''}">
        <span class="error-msg" id="e-veh-select-${idx}"></span>
      </div>
    </div>

    <div id="veh-new-fields-${idx}" style="${mode==='nuevo'?'':'display:none'}">
      <div class="form-grid" style="margin-bottom:0">
        <div class="form-group">
          <label class="form-label">Marca <span style="color:var(--danger)">*</span></label>
          <input type="text" id="veh-mar-${idx}" class="form-input" placeholder="Ej: Mercedes" value="${esc(v.marca||'')}">
          <span class="error-msg" id="e-veh-mar-${idx}"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Modelo <span style="color:var(--danger)">*</span></label>
          <input type="text" id="veh-mod-${idx}" class="form-input" placeholder="Ej: Sprinter" value="${esc(v.modelo||'')}">
          <span class="error-msg" id="e-veh-mod-${idx}"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Matrícula</label>
          <input type="text" id="veh-mat-${idx}" class="form-input" placeholder="Ej: 1234BBB" oninput="this.value=this.value.toUpperCase()" value="${esc(v.matricula||'')}">
          <span class="error-msg" id="e-veh-mat-${idx}"></span>
        </div>
      </div>
      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Ancho <span style="color:var(--danger)">*</span></label>
          <div style="display:flex">
            <input type="number" id="veh-anc-${idx}" class="form-input" placeholder="2.10" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none" value="${v.ancho||''}">
            <div class="input-addon-right">m</div>
          </div>
          <span class="error-msg" id="e-veh-anc-${idx}"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Largo <span style="color:var(--danger)">*</span></label>
          <div style="display:flex">
            <input type="number" id="veh-lar-${idx}" class="form-input" placeholder="5.90" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none" value="${v.largo||''}">
            <div class="input-addon-right">m</div>
          </div>
          <span class="error-msg" id="e-veh-lar-${idx}"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Alto <span style="color:var(--danger)">*</span></label>
          <div style="display:flex">
            <input type="number" id="veh-alt-${idx}" class="form-input" placeholder="2.80" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none" value="${v.alto||''}">
            <div class="input-addon-right">m</div>
          </div>
          <span class="error-msg" id="e-veh-alt-${idx}"></span>
        </div>
      </div>
    </div>

    <div style="margin-top:12px">
      <label class="form-label">Conductor del vehículo <span style="color:var(--danger)">*</span></label>
      <select id="veh-driver-${idx}" class="form-input" onchange="onDriverChange(${idx},this.value)">
        <option value="-1" ${typeof v.driverPassengerIndex !== 'number' || v.driverPassengerIndex === -1 ? 'selected' : ''}>— Seleccionar conductor —</option>
        ${wz.passengers.map((p, pIdx) => {
          const usedByOther = wz.vehicles.some((ov, oi) => oi !== idx && ov.driverPassengerIndex === pIdx);
          if (usedByOther) return '';
          return `<option value="${pIdx}" ${typeof v.driverPassengerIndex === 'number' && v.driverPassengerIndex === pIdx ? 'selected' : ''}>${esc(p.nombre)} ${esc(p.apellido1)}${p.apellido2 ? ' ' + esc(p.apellido2) : ''}</option>`;
        }).join('')}
      </select>
      <span class="error-msg" id="e-veh-driver-${idx}"></span>
    </div>
  </div>`;
}

function readVehicleBlock(idx) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles?.[idx]) return;
  const v = wz.vehicles[idx];
  
  // Si el formulario de vehículo no está visible en el DOM, no leer
  // (evita sobrescribir datos ya persistidos cuando showWizStep3 reconstruye la página)
  const section = $('vehicle-section');
  if (!section || section.style.display === 'none') return;

  // Verificar que el bloque existe en el DOM (se renderizó)
  const blockEl = document.querySelector(`.vehicle-block[data-idx="${idx}"]`);
  if (!blockEl) return;
  
  const modeEl = document.querySelector(`input[name="veh-mode-${idx}"]:checked`);
  if (modeEl) v._mode = modeEl.value;
  if (v._mode === 'registrado') {
    v.registeredId = val(`veh-selected-id-${idx}`) || v.registeredId || '';
  } else {
    v.marca     = (val(`veh-mar-${idx}`) || '').trim();
    v.modelo    = (val(`veh-mod-${idx}`) || '').trim();
    v.matricula = (val(`veh-mat-${idx}`) || '').trim();
    v.ancho     = val(`veh-anc-${idx}`) || '';
    v.largo     = val(`veh-lar-${idx}`) || '';
    v.alto      = val(`veh-alt-${idx}`) || '';
  }
  const driverEl = $(`veh-driver-${idx}`);
  if (driverEl) {
    const driverVal = driverEl.value;
    v.driverPassengerIndex = driverVal !== '' ? parseInt(driverVal, 10) : -1;
  }
}

function persistAllVehicleBlocks() {
  const wz = state.bookingWizard;
  if (!wz?.vehicles) return;
  wz.vehicles.forEach((_, i) => readVehicleBlock(i));
}

function onVehicleModeChange(idx, mode) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles?.[idx]) return;
  readVehicleBlock(idx);
  wz.vehicles[idx]._mode = mode;

  const reg = $(`veh-reg-panel-${idx}`);
  const nw  = $(`veh-new-fields-${idx}`);
  const rl  = $(`veh-mode-reg-lbl-${idx}`);
  const nl  = $(`veh-mode-new-lbl-${idx}`);
  if (reg) reg.style.display = mode === 'registrado' ? '' : 'none';
  if (nw)  nw.style.display  = mode === 'nuevo' ? '' : 'none';
  if (rl)  rl.classList.toggle('active', mode === 'registrado');
  if (nl)  nl.classList.toggle('active', mode === 'nuevo');

  if (mode === 'nuevo') {
    const s = $(`veh-search-${idx}`); if (s) s.value = '';
    const h = $(`veh-selected-id-${idx}`); if (h) h.value = '';
    wz.vehicles[idx].registeredId = '';
  }
}

function onDriverChange(idx, value) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles?.[idx]) return;
  wz.vehicles[idx].driverPassengerIndex = parseInt(value, 10);
}

function removeVehicleBlock(idx) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles) return;
  persistAllVehicleBlocks();
  wz.vehicles.splice(idx, 1);
  if (wz.vehicles.length === 0) {
    hideVehicleSection();
    return;
  }
  wz._vehicleCount = wz.vehicles.length;
  showVehicleForm();
}

function wizStep4Submit(e) {
  e.preventDefault();
  persistAllVehicleBlocks();
  const wz = state.bookingWizard;
  let allOk = true;

  wz.vehicles.forEach((v, idx) => {
    if (v._mode === 'registrado') {
      if (!v.registeredId) { fieldErr(`e-veh-select-${idx}`, `veh-search-${idx}`, 'Selecciona un vehículo'); allOk = false; }
      else fieldOk(`e-veh-select-${idx}`, `veh-search-${idx}`);
    } else {
      const anc = parseFloat(v.ancho), lar = parseFloat(v.largo), alt = parseFloat(v.alto);
      if (!v.marca)  { fieldErr(`e-veh-mar-${idx}`, `veh-mar-${idx}`, 'La marca es obligatoria'); allOk = false; } else fieldOk(`e-veh-mar-${idx}`, `veh-mar-${idx}`);
      if (!v.modelo) { fieldErr(`e-veh-mod-${idx}`, `veh-mod-${idx}`, 'El modelo es obligatorio'); allOk = false; } else fieldOk(`e-veh-mod-${idx}`, `veh-mod-${idx}`);
      if (v.matricula && !isPlate(v.matricula)) { fieldErr(`e-veh-mat-${idx}`, `veh-mat-${idx}`, 'Introduce una matrícula válida.'); allOk = false; } else fieldOk(`e-veh-mat-${idx}`, `veh-mat-${idx}`);
      if (isNaN(anc)||anc<=0) { fieldErr(`e-veh-anc-${idx}`, `veh-anc-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-anc-${idx}`, `veh-anc-${idx}`);
      if (isNaN(lar)||lar<=0) { fieldErr(`e-veh-lar-${idx}`, `veh-lar-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-lar-${idx}`, `veh-lar-${idx}`);
      if (isNaN(alt)||alt<=0) { fieldErr(`e-veh-alt-${idx}`, `veh-alt-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-alt-${idx}`, `veh-alt-${idx}`);
    }
    if (typeof v.driverPassengerIndex !== 'number' || isNaN(v.driverPassengerIndex) || v.driverPassengerIndex < 0) {
      fieldErr(`e-veh-driver-${idx}`, `veh-driver-${idx}`, 'Selecciona un conductor');
      allOk = false;
    } else {
      fieldOk(`e-veh-driver-${idx}`, `veh-driver-${idx}`);
    }
  });

  if (!allOk) return;

  wz.vehicles = wz.vehicles.map(v => ({
    marca: v.marca, modelo: v.modelo, matricula: v.matricula || '',
    ancho: parseFloat(v.ancho), largo: parseFloat(v.largo), alto: parseFloat(v.alto),
    driverPassengerIndex: v.driverPassengerIndex,
  }));
  wz.vehicle = wz.vehicles[0];
  wz._vehicleCount = wz.vehicles.length;
  showWizStep5();
}

// ── Paso 5: Resumen y confirmación ───────────────────────────
function showWizStep5() {
  const wz = state.bookingWizard;
  if (!wz || !wz.passengers || wz.passengers.length === 0) return;
  renderWizStepBar(4);
  const content = $('wiz-content');
  if (!content) return;
  const pax = wz.passengers[0];
  const veh = wz.vehicle;
  const sail = wz.selectedSailing;
  const tripTypeLabel = wz.tripType === 'idayvuelta' ? 'Ida y vuelta' : 'Ida';

  const nacMap = { ES:'Española',FR:'Francesa',IT:'Italiana',PT:'Portuguesa',UK:'Británica',DE:'Alemana',MA:'Marroquí',OTHER:'Otra' };

  // Marcar pasajeros que son conductores (tienen vehículo asignado)
  const vehiclesList = Array.isArray(wz.vehicles) ? wz.vehicles : [];
  wz.passengers.forEach((p, idx) => {
    p.isDriver = vehiclesList.some(v => v.driverPassengerIndex === idx);
  });

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="showWizStep3()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <div>
          <div style="font-weight:700;font-size:1rem;color:var(--gray-900)">Resumen de la reserva</div>
          <div style="font-size:0.8125rem;color:var(--gray-400)">Revisa los datos antes de confirmar</div>
        </div>
      </div>

      <!-- Bloque: Viaje -->
      <div class="wiz-summary-block">
        <div class="wiz-summary-block-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l2-2m0 0l7-7 4 4L21 6"/></svg>
          Viaje
        </div>
        <div class="wiz-summary-grid">
          <div class="wiz-summary-row"><span class="wiz-sum-label">Ruta</span><span class="wiz-sum-val">${esc(wz.origin)} → ${esc(wz.destination)}</span></div>
          <div class="wiz-summary-row"><span class="wiz-sum-label">Tipo</span><span class="wiz-sum-val">${tripTypeLabel}</span></div>
          <div class="wiz-summary-row"><span class="wiz-sum-label">Naviera</span><span class="wiz-sum-val">${esc(sail.naviera)}</span></div>
        </div>
      </div>

      <!-- Desglose ida/vuelta -->
      <div class="trip-leg">
        <div class="trip-leg-header">
          <div class="trip-leg-icon ida"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
          <div class="trip-leg-title">Trayecto de ida</div>
        </div>
        <div class="trip-leg-details">
          ${esc(wz.origin)} → ${esc(wz.destination)}<br>
          ${esc(sail.departureDate)} a las ${esc(sail.departureTime)}
        </div>
      </div>
      ${wz.dateVuelta ? `
      <div class="trip-leg">
        <div class="trip-leg-header">
          <div class="trip-leg-icon vuelta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></div>
          <div class="trip-leg-title">Trayecto de vuelta</div>
        </div>
        <div class="trip-leg-details">
          ${esc(wz.destination)} → ${esc(wz.origin)}<br>
          ${esc(wz.dateVuelta)}
        </div>
      </div>` : ''}

      <!-- Bloque: Pasajeros -->
      <div class="wiz-summary-block">
        <div class="wiz-summary-block-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 21v-2a4 4 0 0 1 4-4"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Pasajeros (${wz.passengers.length})
        </div>
        ${wz.passengers.map((p, idx) => `
          <div style="${idx > 0 ? 'margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)' : ''}">
            <div style="font-weight:600;font-size:0.875rem;margin-bottom:6px">${idx + 1}. ${esc(p.nombre)} ${esc(p.apellido1)}${p.isDriver ? ' <span style="display:inline-block;padding:1px 8px;background:#dbeafe;color:#1d4ed8;border-radius:10px;font-size:0.65rem;font-weight:700">🚗 Conductor</span>' : ''}</div>
            <div class="wiz-summary-grid">
              <div class="wiz-summary-row"><span class="wiz-sum-label">Documento</span><span class="wiz-sum-val">${esc(p.tipoDoc)} ${esc(p.numDoc)}</span></div>
              <div class="wiz-summary-row"><span class="wiz-sum-label">Email</span><span class="wiz-sum-val">${esc(p.email)}</span></div>
            </div>
          </div>
        `).join('')}
      </div>

      ${(Array.isArray(wz.vehicles) && wz.vehicles.length > 0) ? `
      <!-- Bloque: Vehículos -->
      <div class="wiz-summary-block">
        <div class="wiz-summary-block-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Vehículos (${wz.vehicles.length})
        </div>
        ${wz.vehicles.map((vh, i) => {
          const driver = (typeof vh.driverPassengerIndex === 'number' && wz.passengers[vh.driverPassengerIndex])
            ? `${wz.passengers[vh.driverPassengerIndex].nombre || ''} ${wz.passengers[vh.driverPassengerIndex].apellido1 || ''}`.trim()
            : '';
          return `
          <div style="${i > 0 ? 'margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)' : ''}">
            <div style="font-weight:600;font-size:0.875rem;margin-bottom:6px">${i + 1}. ${esc(vh.marca||'')} ${esc(vh.modelo||'')}${vh.matricula ? ` · ${esc(vh.matricula)}` : ''}</div>
            <div class="wiz-summary-grid">
              <div class="wiz-summary-row"><span class="wiz-sum-label">Dimensiones</span><span class="wiz-sum-val">${vh.largo}m × ${vh.ancho}m × ${vh.alto}m (L × A × H)</span></div>
              ${driver ? `<div class="wiz-summary-row"><span class="wiz-sum-label">Conductor</span><span class="wiz-sum-val">${esc(driver)}</span></div>` : ''}
            </div>
          </div>
        `;}).join('')}
      </div>` : (veh ? `
      <!-- Bloque: Vehículo -->
      <div class="wiz-summary-block">
        <div class="wiz-summary-block-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Vehículo
        </div>
        <div class="wiz-summary-grid">
          <div class="wiz-summary-row"><span class="wiz-sum-label">Marca / Modelo</span><span class="wiz-sum-val">${esc(veh.marca)} ${esc(veh.modelo)}</span></div>
          <div class="wiz-summary-row"><span class="wiz-sum-label">Dimensiones</span><span class="wiz-sum-val">${veh.largo}m × ${veh.ancho}m × ${veh.alto}m (L × A × H)</span></div>
          ${(typeof veh.driverPassengerIndex === 'number' && wz.passengers[veh.driverPassengerIndex]) ? `<div class="wiz-summary-row"><span class="wiz-sum-label">Conductor</span><span class="wiz-sum-val">${esc(wz.passengers[veh.driverPassengerIndex].nombre || '')} ${esc(wz.passengers[veh.driverPassengerIndex].apellido1 || '')}</span></div>` : ''}
        </div>
      </div>` : '')}

      <form id="wiz-confirm-form" onsubmit="doFinalizeBooking(event)" novalidate>
        <div style="margin:16px 0 20px${state.frequentPassengers.find(p => p.numDoc === pax.numDoc) ? ';display:none' : ''}" id="guardar-frecuente-wrap">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.875rem;font-weight:500;color:var(--gray-700)">
            <input type="checkbox" id="pax-frecuente" style="width:17px;height:17px;accent-color:var(--primary)">
            Guardar pasajero como frecuente para futuras reservas
          </label>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="showWizStep3()">← Volver</button>
          <button type="submit" class="btn btn-primary" style="width:auto;padding:11px 32px;font-size:1rem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Confirmar reserva
          </button>
        </div>
      </form>
    </div>`;
}

async function doFinalizeBooking(e) {
  if (e) e.preventDefault();
  const wz = state.bookingWizard;
  if (!wz) return;

  const vehiclesList = Array.isArray(wz.vehicles) ? wz.vehicles : (wz.vehicle ? [wz.vehicle] : []);
  const payload = {
    tripType:      wz.tripType,
    origin:        wz.origin,
    destination:   wz.destination,
    naviera:       wz.selectedSailing.naviera,
    departureDate: wz.selectedSailing.departureDate,
    departureTime: wz.selectedSailing.departureTime,
    returnDate:    wz.dateVuelta || null,
    passengers:    wz.passengers,
    vehicles:      vehiclesList,
    vehicleData:   vehiclesList[0] || null,
    vehicleCount:  vehiclesList.length,
  };

  const confirmBtn = document.querySelector('#wiz-confirm-form button[type="submit"]');
  if (confirmBtn) confirmBtn.disabled = true;

  if (!wz.passengers || wz.passengers.length === 0) {
    showToast('error','Sin pasajeros','Añade al menos un pasajero antes de confirmar.');
    if (confirmBtn) confirmBtn.disabled = false;
    return;
  }

  try {
    const groupId = wz.passengers.length > 1 ? 'G-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5) : null;
    const bookingPromises = wz.passengers.map(async (pax, paxIdx) => {
      const myVehicle = vehiclesList.find(v => v.driverPassengerIndex === paxIdx) || null;
      const bookingData = {
        tripType: wz.tripType,
        origin: wz.origin,
        destination: wz.destination,
        naviera: wz.selectedSailing.naviera,
        departureDate: wz.dateIda,
        departureTime: wz.selectedSailing.departureTime,
        returnDate: wz.dateVuelta || null,
        returnTime: wz.returnTime || null,
        localizador: '',
        estado: 'Pendiente',
        passengerName: `${pax.nombre} ${pax.apellido1}`.trim(),
        email: pax.email || '',
        vehiclePlate: myVehicle ? `${myVehicle.marca} ${myVehicle.modelo}` : null,
        paxNombre: pax.nombre || '',
        paxApellido1: pax.apellido1 || '',
        paxApellido2: pax.apellido2 || '',
        paxEmail: pax.email || '',
        paxTelefono: pax.telefono || '',
        paxTipoDoc: pax.tipoDoc || '',
        paxNumDoc: pax.numDoc || '',
        paxExpDoc: pax.expDoc || '',
        vehMarca: myVehicle ? myVehicle.marca : '',
        vehModelo: myVehicle ? myVehicle.modelo : '',
        vehMatricula: myVehicle ? (myVehicle.matricula || '') : '',
        vehLargo: myVehicle ? (parseFloat(myVehicle.largo) || 0) : 0,
        vehAncho: myVehicle ? (parseFloat(myVehicle.ancho) || 0) : 0,
        vehAlto: myVehicle ? (parseFloat(myVehicle.alto) || 0) : 0,
        vehicleCount: vehiclesList.length,
        groupId: groupId,
      };
      try {
        const saved = await api('POST', '/bookings', bookingData);
        return saved;
      } catch(err) {
        console.error('[BOOKING] Error guardando reserva:', err.message);
        throw err;
      }
    });
    const savedBookings = await Promise.all(bookingPromises);
    state.bookings.unshift(...savedBookings);
    state.lastCreatedBookingId = savedBookings[0].id;

    if ($('pax-frecuente')?.checked) {
      const pax = wz.passengers[0];
      const exists = state.frequentPassengers.find(p => p.numDoc === pax.numDoc);
      if (!exists) {
        try {
          const saved = await api('POST', '/frequent-passengers', { nombre: pax.nombre, apellido1: pax.apellido1, apellido2: pax.apellido2 || '', email: pax.email, telefono: pax.telefono, fnac: pax.fnac, nacionalidad: pax.nacionalidad, tipoDoc: pax.tipoDoc, numDoc: pax.numDoc, expDoc: pax.expDoc });
          state.frequentPassengers.push(saved);
          showToast('success','Pasajero guardado','Se ha añadido a tus pasajeros frecuentes.');
        } catch(e) {
          console.error('[FREQUENT_PASSENGER] Error:', e.message);
          showToast('warning','Pasajero no guardado','No se pudo añadir a pasajeros frecuentes.');
        }
      }
    }

    // Enviar notificación por correo (no bloquea la UI)
    const notifyData = {
      origin: wz.origin,
      destination: wz.destination,
      naviera: wz.selectedSailing.naviera,
      tripType: wz.tripType,
      departureDate: wz.dateIda,
      departureTime: wz.selectedSailing.departureTime,
      returnDate: wz.dateVuelta || null,
      returnTime: wz.returnTime || null,
      estado: 'Pendiente',
      vehicles: vehiclesList,
      passengers: wz.passengers,
    };
    api('POST', '/bookings/notify', notifyData).catch(err =>
      console.error('Error enviando notificación:', err.message)
    );
  } catch (err) {
    if (confirmBtn) confirmBtn.disabled = false;
    showToast('error','Error al crear la reserva', err.message);
    return;
  }

  state.bookingWizard = null;
  showToast('success','¡Reserva enviada!','La reserva ha sido registrada. Queda pendiente de localizador.');
  navigateTo('viajes');
}

function cancelWizard() {
  state.bookingWizard = null;
  showWizStep1();
}

// ============================================================
// VIAJES SECTION
// ============================================================
function renderViajes() {
  const newId = state.lastCreatedBookingId;
  const tripTypeLabel = t => t==='idayvuelta'?'Ida y vuelta':'Ida';

  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Reservas</h2>
        <p class="sec-desc">Reservas generadas — ${state.bookings.filter(b=>!b.localizador).length} sin localizador · ${state.bookings.length} total</p>
      </div>
      <button class="btn btn-primary btn-sm" style="width:auto" onclick="navigateTo('reserva')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Nueva reserva
      </button>
    </div>

    <!-- DESKTOP TABLE -->
    <div class="card bk-table-card">
      <div class="tbl-wrap" style="border:none;border-radius:0">
        ${state.bookings.length===0
          ? `<div class="empty-state"><div class="empty-txt">No hay reservas registradas.</div><div class="empty-sub"><a href="#" onclick="navigateTo('reserva');return false;" style="color:var(--primary)">Crear la primera reserva →</a></div></div>`
          : `<table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ruta</th>
                <th>Naviera</th>
                <th>Fecha salida</th>
                <th>Pasajero</th>
                <th>Estado</th>
                <th>Localizador</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${state.bookings.map(b=>`
                <tr class="${b.id===newId?'bk-row-new':''}" onclick="openBookingModal(${b.id})" style="cursor:pointer">
                  <td style="color:var(--gray-400);font-size:0.8125rem">
                    #${b.id}
                    ${b.id===newId ? '<span class="badge-new">Nuevo</span>' : ''}
                  </td>
                  <td>
                    <div style="font-weight:600;font-size:0.875rem">${esc(b.origin||'')} → ${esc(b.destination||'')}</div>
                    ${b.tripType === 'idayvuelta' ? `<div style="font-weight:600;font-size:0.875rem;color:var(--primary)">${esc(b.destination||'')} → ${esc(b.origin||'')}</div>` : ''}
                    <div style="font-size:0.75rem;color:var(--gray-400)">${tripTypeLabel(b.tripType)}</div>
                  </td>
                  <td>
                    <div class="naviera-cell">
                      ${getNavieraLogo(b.naviera, 'sm')}
                      <span style="font-size:0.875rem">${esc(b.naviera||'')}</span>
                    </div>
                  </td>
                  <td>
                    <div style="font-size:0.875rem">Ida: ${esc(b.departureDate||'')}</div>
                    ${b.returnDate ? `<div style="font-size:0.875rem;color:var(--primary)">Vta: ${esc(b.returnDate||'')}</div>` : ''}
                    <div style="font-size:0.75rem;color:var(--gray-400)">${esc(b.departureTime||'')}</div>
                  </td>
                  <td>
                    <div style="font-weight:600;font-size:0.875rem">${esc(b.passengerName||'')}</div>
                    <div style="font-size:0.75rem;color:var(--gray-400)">${esc(b.email||'')}</div>
                  </td>
                  <td>
                    ${b.estado === 'cancelado'
                      ? `<span class="badge badge-danger" id="estado-badge-${b.id}">Cancelado</span>`
                      : `<span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}" id="estado-badge-${b.id}">
                          ${b.localizador ? 'Activo' : 'Pendiente'}
                        </span>`
                    }
                  </td>
                  <td onclick="event.stopPropagation()">
                    <div style="display:flex;align-items:center;gap:6px">
                      <input type="text" class="form-input localizador-input" value="${esc(b.localizador||'')}"
                        placeholder="XXXXXXXX" maxlength="10"
                        oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"
                        onchange="updateBookingLocalizador(${b.id},this.value)"
                        style="width:120px;padding:5px 8px;height:32px;font-size:0.8125rem;font-family:monospace">
                      <span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}" id="loc-badge-${b.id}" style="flex-shrink:0">
                        ${b.localizador ? '✓' : '—'}
                      </span>
                    </div>
                  </td>
                  <td onclick="event.stopPropagation()">
                    <div class="tbl-actions">
                      ${(b.localizador || b.estado === 'Confirmado') && b.estado !== 'cancelado' ? `
                      <button class="btn btn-warning btn-sm" onclick="cancelBooking(${b.id})" title="Cancelar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      </button>` : ''}
                      <button class="btn btn-outline btn-sm" onclick="editBooking(${b.id})" title="Editar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="deleteBooking(${b.id})" title="Eliminar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
        }
      </div>
    </div>

    <!-- MOBILE CARDS -->
    <div class="bk-cards-mobile">
      ${state.bookings.length===0
        ? `<div class="empty-state"><div class="empty-txt">No hay reservas.</div></div>`
        : state.bookings.map(b=>`
          <div class="bk-card ${b.id===newId?'bk-card-new':''}" onclick="openBookingModal(${b.id})" style="cursor:pointer">
            <div class="bk-card-head">
              <div class="bk-card-route">${esc(b.origin||'')} → ${esc(b.destination||'')}</div>
              <div style="display:flex;align-items:center;gap:6px">
                ${b.id===newId ? '<span class="badge-new">Nuevo</span>' : ''}
                ${b.estado === 'cancelado'
                  ? `<span class="badge badge-danger">Cancelado</span>`
                  : `<span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}">${b.localizador ? 'Activo' : 'Pendiente'}</span>`
                }
              </div>
            </div>
            <div class="bk-card-body">
              <div class="bk-card-row">
                <span class="bk-card-lbl">Naviera</span>
                <span class="bk-card-val">${esc(b.naviera||'')}</span>
              </div>
              <div class="bk-card-row">
                <span class="bk-card-lbl">Salida</span>
                <span class="bk-card-val">${esc(b.departureDate||'')} ${esc(b.departureTime||'')}</span>
              </div>
              <div class="bk-card-row">
                <span class="bk-card-lbl">Pasajero</span>
                <span class="bk-card-val">${esc(b.passengerName||'')}</span>
              </div>
              <div class="bk-card-row">
                <span class="bk-card-lbl">Trayecto</span>
                <span class="bk-card-val">${tripTypeLabel(b.tripType)}</span>
              </div>
              <div class="bk-card-row">
                <span class="bk-card-lbl">Localizador</span>
                <input type="text" class="form-input localizador-input" value="${esc(b.localizador||'')}"
                  placeholder="XXXXXXXX" maxlength="10"
                  oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"
                  onchange="updateBookingLocalizador(${b.id},this.value)"
                  onclick="event.stopPropagation()"
                  style="width:130px;padding:5px 8px;height:32px;font-size:0.8125rem;font-family:monospace">
              </div>
            </div>
            <div class="bk-card-foot" onclick="event.stopPropagation()">
              ${(b.localizador || b.estado === 'Confirmado') && b.estado !== 'cancelado' ? `
              <button class="btn btn-warning btn-sm" onclick="cancelBooking(${b.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Cancelar
              </button>` : ''}
              <button class="btn btn-outline btn-sm" onclick="editBooking(${b.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteBooking(${b.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Eliminar
              </button>
            </div>
          </div>
        `).join('')}
    </div>

  </div>`;
}

// ============================================================
// FACTURAS SECTION
// ============================================================
function renderFacturas() {
  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Facturas</h2>
        <p class="sec-desc">Gestiona documentos financieros y facturas de la agencia</p>
      </div>
    </div>

    <div class="inv-grid" style="margin-bottom:22px">
      ${state.invoices.map(inv=>`
        <div class="inv-card">
          <div class="inv-num">${esc(inv.numero)}</div>
          <div class="inv-amount">€${parseFloat(inv.importe).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div class="inv-meta">
            <span>${fmtDateShort(inv.fecha)}</span>
            <span class="badge ${facturaBadge(inv.estado)}">${inv.estado}</span>
          </div>
          ${inv.archivo ? `<div style="margin-top:8px;display:flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--gray-400)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${esc(inv.archivo)}
          </div>` : ''}
          <div style="margin-top:12px;display:flex;gap:5px">
            <button class="btn btn-secondary btn-sm" onclick="showToast('info','Vista previa','${esc(inv.numero)} — ${inv.archivo||'Sin archivo adjunto'}')">Ver</button>
            <button class="btn btn-outline btn-sm" onclick="editInvoice(${inv.id})">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${inv.id})">Eliminar</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title">Subir nueva factura</div>
      <div class="card-desc">Registra una factura y adjunta el documento correspondiente</div>

      <form id="inv-form" onsubmit="doAddInvoice(event)" novalidate>
        <div class="form-grid" style="margin-bottom:18px">
          <div class="form-group">
            <label class="form-label" for="i-num">Número de factura <span style="color:var(--danger)">*</span></label>
            <input type="text" id="i-num" class="form-input" placeholder="FAC-2024-006">
            <span class="error-msg" id="e-i-num"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="i-fec">Fecha <span style="color:var(--danger)">*</span></label>
            <input type="date" id="i-fec" class="form-input">
            <span class="error-msg" id="e-i-fec"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="i-booking">Relacionar con reserva</label>
            <select id="i-booking" class="form-input">
              <option value="">— Ninguna —</option>
              ${state.bookings.map(b=>`<option value="${b.id}">Reserva #${b.id} — ${esc(b.origin)} → ${esc(b.destination)} (${esc(b.passengerName)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="i-imp">Importe (€) <span style="color:var(--danger)">*</span></label>
            <input type="number" id="i-imp" class="form-input" placeholder="0.00" step="0.01" min="0.01">
            <span class="error-msg" id="e-i-imp"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="i-est">Estado</label>
            <select id="i-est" class="form-input">
              <option value="Pendiente">Pendiente</option>
              <option value="Pagada">Pagada</option>
              <option value="Anulada">Anulada</option>
            </select>
          </div>
        </div>

        <div class="upload-area" id="upload-area" onclick="$('i-file').click()" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="doDrop(event)">
          <div class="upload-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
          </div>
          <div class="upload-txt"><span class="upload-hl">Haz clic para seleccionar</span> o arrastra un archivo aquí</div>
          <div class="upload-hint">PDF, JPG, PNG · máximo 10 MB</div>
          <div id="file-selected" style="display:none;margin-top:8px;font-size:0.875rem;font-weight:600;color:var(--primary)"></div>
        </div>
        <input type="file" id="i-file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="onFileSelect(this)">

        <button type="submit" class="btn btn-primary" style="margin-top:16px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Registrar factura
        </button>
      </form>
    </div>
  </div>`;
}

// ============================================================
// MIEMBROS SECTION
// ============================================================
function renderMiembros() {
  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Miembros</h2>
        <p class="sec-desc">Registro y gestión de pasajeros y clientes de la agencia</p>
      </div>
      <button class="btn btn-primary btn-sm" style="width:auto" onclick="showMiembrosForm()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Añadir miembro
      </button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="card-hd">
        <div>
          <div class="card-title">Miembros registrados</div>
          <div class="card-desc-sm">${state.members.length} personas en el sistema</div>
        </div>
      </div>
      ${state.members.length===0
        ? `<div class="empty-state"><div class="empty-txt">No hay miembros registrados</div><div class="empty-sub">Pulsa "Añadir miembro" para registrar el primero</div></div>`
        : `<div class="tbl-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr><th>Nombre</th><th>DNI</th><th>Teléfono</th><th>F. Nacimiento</th><th>F. Expiración</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${state.members.map(m=>`
                <tr>
                  <td><span style="font-weight:600;color:var(--gray-900)">${esc(m.nombre)} ${esc(m.apellido || m.apellido1 || '')}</span></td>
                  <td><span class="pill-code">${esc(m.dni)}</span></td>
                  <td style="font-size:0.875rem">${esc(m.telefono)}</td>
                  <td style="font-size:0.875rem">${fmtDateShort(m.fechaNacimiento)}</td>
                  <td><span class="badge ${isExpired(m.fechaExpiracion)?'badge-danger':'badge-success'}">${fmtDateShort(m.fechaExpiracion)}</span></td>
                  <td>
                    <div class="tbl-actions">
                      <button class="btn-edit" onclick="editMember(${m.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
    </div>
  </div>`;
}

function showMiembrosForm() {
  $('content-area').innerHTML = `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Nuevo miembro</h2>
        <p class="sec-desc">Completa los datos para registrar un nuevo miembro</p>
      </div>
      <button class="btn btn-secondary btn-sm" style="width:auto" onclick="navigateTo('miembros')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
    </div>

    <div class="card" style="max-width:680px">
      <div class="card-title">Registrar nuevo miembro</div>
      <div class="card-desc">El DNI debe tener 8 dígitos y una letra (ej: 12345678A). El teléfono sólo acepta dígitos.</div>

      <form id="mem-form" onsubmit="doAddMember(event)" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="m-nom">Nombre <span style="color:var(--danger)">*</span></label>
            <input type="text" id="m-nom" class="form-input" placeholder="Nombre">
            <span class="error-msg" id="e-m-nom"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="m-ape">Apellido <span style="color:var(--danger)">*</span></label>
            <input type="text" id="m-ape" class="form-input" placeholder="Apellidos">
            <span class="error-msg" id="e-m-ape"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="m-dni">DNI <span style="color:var(--danger)">*</span></label>
            <input type="text" id="m-dni" class="form-input" placeholder="12345678A" maxlength="9" oninput="this.value=this.value.toUpperCase()">
            <span class="error-msg" id="e-m-dni"></span>
            <div style="font-size:0.72rem;color:var(--gray-400);margin-top:3px">Patrón: <code>^[0-9]{8}[A-Z]$</code></div>
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono <span style="color:var(--danger)">*</span></label>
            <div class="input-group">
              <select id="m-pre" class="form-input" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none;width:108px;flex-shrink:0">
                <option value="+34">🇪🇸 +34</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+33">🇫🇷 +33</option>
                <option value="+49">🇩🇪 +49</option>
                <option value="+351">🇵🇹 +351</option>
                <option value="+39">🇮🇹 +39</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+57">🇨🇴 +57</option>
              </select>
              <input type="tel" id="m-tel" class="form-input" placeholder="612 345 678" style="border-radius:0 var(--radius) var(--radius) 0" oninput="this.value=this.value.replace(/[^0-9\s\-]/g,'')">
            </div>
            <span class="error-msg" id="e-m-tel"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="m-fnac">Fecha de nacimiento <span style="color:var(--danger)">*</span></label>
            <input type="date" id="m-fnac" class="form-input">
            <span class="error-msg" id="e-m-fnac"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="m-fexp">Fecha de expiración <span style="color:var(--danger)">*</span></label>
            <input type="date" id="m-fexp" class="form-input">
            <span class="error-msg" id="e-m-fexp"></span>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Guardar miembro
        </button>
      </form>
    </div>
  </div>`;
}

// ============================================================
// VEHÍCULOS SECTION
// ============================================================
function renderVehiculos() {
  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Vehículos</h2>
        <p class="sec-desc">Gestión de la flota de vehículos disponibles</p>
      </div>
    </div>

    ${state.vehicles.length>0 ? `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:22px">
      <div class="card-hd">
        <div>
          <div class="card-title">Flota registrada</div>
          <div class="card-desc-sm">${state.vehicles.length} vehículos</div>
        </div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr><th>Marca</th><th>Modelo</th><th>Matrícula</th><th>Ancho</th><th>Largo</th><th>Alto</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            ${state.vehicles.map(v=>`
              <tr>
                <td style="font-weight:700">${esc(v.marca)}</td>
                <td>${esc(v.modelo)}</td>
                <td>${v.matricula ? `<span class="pill-code">${esc(v.matricula)}</span>` : '<span style="color:var(--gray-300)">—</span>'}</td>
                <td><span class="pill-code">${v.ancho}m</span></td>
                <td><span class="pill-code">${v.largo}m</span></td>
                <td><span class="pill-code">${v.alto}m</span></td>
                <td>
                  <div class="tbl-actions">
                    <button class="btn-edit" onclick="editVehicle(${v.id})">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteVehicle(${v.id})">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Registrar nuevo vehículo</div>
      <div class="card-desc">Todos los campos de dimensiones son positivos y se expresan en metros</div>

      <form id="veh-form" onsubmit="doAddVehicle(event)" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="v-mar">Marca <span style="color:var(--danger)">*</span></label>
            <input type="text" id="v-mar" class="form-input" placeholder="Ej: Mercedes">
            <span class="error-msg" id="e-v-mar"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="v-mod">Modelo <span style="color:var(--danger)">*</span></label>
            <input type="text" id="v-mod" class="form-input" placeholder="Ej: Sprinter">
            <span class="error-msg" id="e-v-mod"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="v-mat">Matrícula</label>
            <input type="text" id="v-mat" class="form-input" placeholder="Ej: 1234BBB" oninput="this.value=this.value.toUpperCase()">
          </div>
        </div>
        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label" for="v-anc">Ancho <span style="color:var(--danger)">*</span></label>
            <div style="display:flex">
              <input type="number" id="v-anc" class="form-input" placeholder="2.10" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none">
              <div class="input-addon" style="border-left:none;border-radius:0 var(--radius) var(--radius) 0">m</div>
            </div>
            <span class="error-msg" id="e-v-anc"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="v-lar">Largo <span style="color:var(--danger)">*</span></label>
            <div style="display:flex">
              <input type="number" id="v-lar" class="form-input" placeholder="5.90" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none">
              <div class="input-addon" style="border-left:none;border-radius:0 var(--radius) var(--radius) 0">m</div>
            </div>
            <span class="error-msg" id="e-v-lar"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="v-alt">Alto <span style="color:var(--danger)">*</span></label>
            <div style="display:flex">
              <input type="number" id="v-alt" class="form-input" placeholder="2.80" step="0.01" min="0.01" style="border-radius:var(--radius) 0 0 var(--radius);border-right:none">
              <div class="input-addon" style="border-left:none;border-radius:0 var(--radius) var(--radius) 0">m</div>
            </div>
            <span class="error-msg" id="e-v-alt"></span>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Añadir vehículo
        </button>
      </form>
    </div>
  </div>`;
}

// ============================================================
// ADMINISTRADORES SECTION
// ============================================================
function renderAdmins() {
  return `<div class="section-page">
    <div class="sec-header">
      <div>
        <h2 class="sec-title">Administradores</h2>
        <p class="sec-desc">Gestión de usuarios con acceso al panel de administración</p>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;margin-bottom:22px">
      <div class="card-hd">
        <div>
          <div class="card-title">Equipo de administración</div>
          <div class="card-desc-sm">${state.admins.filter(a=>a.activo).length} activos de ${state.admins.length}</div>
        </div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Usuario</th><th>Último acceso</th><th>Acciones realizadas</th><th>Estado</th><th>Gestión</th></tr>
          </thead>
          <tbody>
            ${state.admins.map(a=>`
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:9px">
                    <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-light));display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:white;flex-shrink:0">${initials(a.nombre)}</div>
                    <span style="font-weight:600;color:var(--gray-900)">${esc(a.nombre)}</span>
                  </div>
                </td>
                <td style="font-size:0.8125rem;color:var(--gray-500)">${esc(a.email)}</td>
                <td><span class="pill-code">@${esc(a.usuario)}</span></td>
                <td style="font-size:0.875rem">${fmtDateShort(a.fecha)}</td>
                <td style="font-size:0.8125rem;color:var(--gray-500)">${esc(a.acciones)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <label class="toggle-sw">
                      <input type="checkbox" ${a.activo?'checked':''} onchange="toggleAdmin(${a.id},this.checked)">
                      <span class="toggle-sl"></span>
                    </label>
                    <span class="badge ${a.activo?'badge-success':'badge-gray'}">${a.activo?'Activo':'Inactivo'}</span>
                  </div>
                </td>
                <td>
                  ${a.id===1
                    ? '<span style="font-size:0.75rem;color:var(--gray-400);font-style:italic">Principal</span>'
                    : `<button class="btn btn-danger btn-sm" onclick="deleteAdmin(${a.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${state.currentUser?.role === 'super_admin' ? `
    <div class="card">
      <div class="card-title">Invitar nuevo administrador</div>
      <div class="card-desc">El usuario recibirá un correo con un enlace para activar su cuenta y crear su contraseña</div>

      <form id="inv-adm-form" onsubmit="doInviteAdmin(event)" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="ia-email">Correo electrónico <span style="color:var(--danger)">*</span></label>
            <input type="email" id="ia-email" class="form-input" placeholder="nuevo@empresa.com">
            <span class="error-msg" id="e-ia-email"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="ia-user">Nombre de usuario <span style="color:var(--danger)">*</span></label>
            <input type="text" id="ia-user" class="form-input" placeholder="nombre.apellido">
            <span class="error-msg" id="e-ia-user"></span>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Enviar invitación
        </button>
        <div id="inv-success" style="display:none"></div>
      </form>
    </div>` : ''}
  </div>`;
}

// ============================================================
// FORM HANDLERS
// ============================================================

/* --- BOOKINGS --- */
const _locTimers = {};
function updateBookingLocalizador(id, value) {
  clearTimeout(_locTimers[id]);
  _locTimers[id] = setTimeout(() => _doUpdateLocalizador(id, value), 400);
}

async function _doUpdateLocalizador(id, value) {
  const b = state.bookings.find(b=>b.id===id);
  if (!b) return;
  const loc = value.toUpperCase().replace(/[^A-Z0-9]/g,'');

  b.localizador = loc || '';
  b.estado      = loc ? 'Confirmado' : 'Pendiente';

  try { await api('PUT', `/bookings/${id}`, { localizador: b.localizador, estado: b.estado }); } catch(e) { console.error('Error guardando localizador:', e); }

  const estadoEl = document.getElementById(`estado-badge-${id}`);
  if (estadoEl) {
    estadoEl.className   = `badge ${estadoBadge(b.estado)}`;
    estadoEl.textContent = b.estado;
  }
  const locEl = document.getElementById(`loc-badge-${id}`);
  if (locEl) {
    locEl.className   = `badge ${b.localizador ? 'badge-success' : 'badge-warning'}`;
    locEl.textContent = b.localizador ? '✓' : '—';
  }

  if (b.localizador) showToast('success','Localizador guardado',`Reserva #${id}: ${b.localizador}`);
  else showToast('info','Localizador borrado',`Reserva #${id} vuelve a estado Pendiente.`);
}

function updateBookingStatus(id, estado) {
  const idx = state.bookings.findIndex(bk => bk.id === id);
  if (idx !== -1) state.bookings[idx] = { ...state.bookings[idx], estado };
  api('PUT', `/bookings/${id}`, { estado }).catch(e => console.error('Error actualizando estado:', e));
  renderViajes();
  showToast('success','Estado actualizado',`Reserva #${id} → ${estado}`);
}

async function deleteBooking(id) {
  if (!confirm('¿Eliminar esta reserva? No se puede deshacer.')) return;
  state.bookings = state.bookings.filter(b=>b.id!==id);
  await api('DELETE', `/bookings/${id}`).catch(e => console.error('Error eliminando reserva:', e));
  navigateTo('viajes');
  showToast('success','Reserva eliminada','La reserva ha sido eliminada del sistema.');
}

function cancelBooking(id) {
  if (!confirm('¿Cancelar esta reserva? Esta acción puede revertirse.')) return;
  const idx = state.bookings.findIndex(bk => bk.id === id);
  if (idx !== -1) {
    state.bookings[idx] = { ...state.bookings[idx], estado: 'cancelado' };
    api('PUT', `/bookings/${id}`, { estado: 'cancelado' }).catch(e => console.error('Error cancelando reserva:', e));
    renderViajes();
    showToast('success','Reserva cancelada',`La reserva #${id} ha sido cancelada.`);
  }
}

/* --- FACTURAS --- */
async function doAddInvoice(e) {
  e.preventDefault();
  const num = val('i-num');
  const fec = val('i-fec');
  const imp = parseFloat(val('i-imp'));
  const est = val('i-est');
  let ok = true;

  if (!num.trim()) { fieldErr('e-i-num','i-num','El número de factura es obligatorio'); ok=false; }
  else fieldOk('e-i-num','i-num');
  if (!fec) { fieldErr('e-i-fec','i-fec','La fecha es obligatoria'); ok=false; }
  else fieldOk('e-i-fec','i-fec');
  if (!imp || imp<=0 || isNaN(imp)) { fieldErr('e-i-imp','i-imp','Introduce un importe válido mayor que 0'); ok=false; }
  else fieldOk('e-i-imp','i-imp');
  if (!ok) return;

  const bid = val('i-booking');
  const newInvoice = {
    numero: num,
    fecha: fec,
    importe: parseFloat(imp),
    estado: est,
    archivo: state._pendingInvoiceFile ? state._pendingInvoiceFile.name : null,
    booking_id: bid || null,
  };
  try {
    const saved = await api('POST', '/invoices', newInvoice);
    state.invoices.push(saved);
    navigateTo('facturas');
    showToast('success','Factura registrada',`${num} — €${imp} añadida correctamente.`);
  } catch(err) {
    showToast('error','Error', 'No se pudo guardar la factura: ' + err.message);
  }
  state._pendingInvoiceFile = null;
}

async function deleteInvoice(id) {
  if (!confirm('¿Eliminar esta factura?')) return;
  state.invoices = state.invoices.filter(i=>i.id!==id);
  await api('DELETE', `/invoices/${id}`).catch(e => console.error('Error eliminando factura:', e));
  navigateTo('facturas');
  showToast('success','Factura eliminada','La factura ha sido eliminada correctamente.');
}

/* --- MIEMBROS --- */
async function doAddMember(e) {
  e.preventDefault();
  const nom  = val('m-nom').trim();
  const ape  = val('m-ape').trim();
  const dni  = val('m-dni').trim();
  const pre  = val('m-pre');
  const tel  = val('m-tel').trim();
  const fnac = val('m-fnac');
  const fexp = val('m-fexp');
  let ok = true;

  if (!nom) { fieldErr('e-m-nom','m-nom','El nombre es obligatorio'); ok=false; } else fieldOk('e-m-nom','m-nom');
  if (!ape) { fieldErr('e-m-ape','m-ape','El apellido es obligatorio'); ok=false; } else fieldOk('e-m-ape','m-ape');
  if (!isDNI(dni)) { fieldErr('e-m-dni','m-dni','DNI inválido. Ejemplo correcto: 12345678A'); ok=false; }
  else fieldOk('e-m-dni','m-dni');
  if (!isPhone(tel)) { fieldErr('e-m-tel','m-tel','Introduce un número de teléfono válido (solo dígitos)'); ok=false; }
  else fieldOk('e-m-tel','m-tel');
  if (!fnac) { fieldErr('e-m-fnac','m-fnac','La fecha de nacimiento es obligatoria'); ok=false; } else fieldOk('e-m-fnac','m-fnac');
  if (!fexp) { fieldErr('e-m-fexp','m-fexp','La fecha de expiración es obligatoria'); ok=false; }
  else if (fexp <= fnac) { fieldErr('e-m-fexp','m-fexp','Debe ser posterior a la fecha de nacimiento'); ok=false; }
  else fieldOk('e-m-fexp','m-fexp');
  if (!ok) return;

  const newMember = {
    nombre: nom,
    apellido: ape,
    apellido1: ape.split(' ')[0],
    apellido2: ape.split(' ').slice(1).join(' ') || null,
    dni,
    telefono: `${pre} ${tel}`,
    fechaNacimiento: fnac,
    fechaExpiracion: fexp,
  };
  try {
    const saved = await api('POST', '/members', newMember);
    state.members.push(saved);
    navigateTo('miembros');
    showToast('success','Miembro registrado',`${nom} ${ape} ha sido añadido correctamente.`);
  } catch(err) {
    showToast('error','Error', 'No se pudo guardar el miembro: ' + err.message);
  }
}

async function deleteMember(id) {
  if (!confirm('¿Eliminar este miembro?')) return;
  state.members = state.members.filter(m=>m.id!==id);
  await api('DELETE', `/members/${id}`).catch(e => console.error('Error eliminando miembro:', e));
  navigateTo('miembros');
  showToast('success','Miembro eliminado','El miembro ha sido eliminado del sistema.');
}

/* --- VEHÍCULOS --- */
async function doAddVehicle(e) {
  e.preventDefault();
  const mar = val('v-mar').trim();
  const mod = val('v-mod').trim();
  const mat = val('v-mat').trim();
  const anc = parseFloat(val('v-anc'));
  const lar = parseFloat(val('v-lar'));
  const alt = parseFloat(val('v-alt'));
  let ok = true;

  if (!mar) { fieldErr('e-v-mar','v-mar','La marca es obligatoria'); ok=false; } else fieldOk('e-v-mar','v-mar');
  if (!mod) { fieldErr('e-v-mod','v-mod','El modelo es obligatorio'); ok=false; } else fieldOk('e-v-mod','v-mod');

  if (isNaN(anc)||anc<=0) { fieldErr('e-v-anc','v-anc','Valor positivo requerido'); ok=false; } else fieldOk('e-v-anc','v-anc');
  if (isNaN(lar)||lar<=0) { fieldErr('e-v-lar','v-lar','Valor positivo requerido'); ok=false; } else fieldOk('e-v-lar','v-lar');
  if (isNaN(alt)||alt<=0) { fieldErr('e-v-alt','v-alt','Valor positivo requerido'); ok=false; } else fieldOk('e-v-alt','v-alt');

  if (!ok) return;

  const newVeh = {
    marca: mar,
    modelo: mod,
    matricula: mat,
    ancho: anc,
    largo: lar,
    alto: alt,
  };
  try {
    const saved = await api('POST', '/vehicles', newVeh);
    state.vehicles.push(saved);
    navigateTo('vehiculos');
    showToast('success','Vehículo añadido',`${mar} ${mod} registrado en la flota.`);
  } catch(err) {
    showToast('error','Error', 'No se pudo guardar el vehículo: ' + err.message);
  }
}

async function deleteVehicle(id) {
  if (!confirm('¿Eliminar este vehículo de la flota?')) return;
  state.vehicles = state.vehicles.filter(v=>v.id!==id);
  await api('DELETE', `/vehicles/${id}`).catch(e => console.error('Error eliminando vehículo:', e));
  navigateTo('vehiculos');
  showToast('success','Vehículo eliminado','El vehículo ha sido retirado de la flota.');
}

/* --- ADMINISTRADORES --- */
async function doInviteAdmin(e) {
  e.preventDefault();
  const email   = val('ia-email').trim();
  const usuario = val('ia-user').trim();
  let ok = true;

  if (!email||!isEmail(email)) { fieldErr('e-ia-email','ia-email','Introduce un correo electrónico válido'); ok=false; } else fieldOk('e-ia-email','ia-email');
  if (!usuario||usuario.length<3) { fieldErr('e-ia-user','ia-user','Mínimo 3 caracteres'); ok=false; } else fieldOk('e-ia-user','ia-user');
  if (!ok) return;

  if (state.currentUser?.role !== 'super_admin') {
    showToast('error','Acceso denegado', 'Solo el administrador principal puede enviar invitaciones.');
    return;
  }

  try {
    const saved = await api('POST', '/administrators/invite', {
      email,
      usuario,
      nombre: usuario,
      inviterUserId: state.currentUser.id,
    });
    const newAdmin = saved;
    state.admins.push(newAdmin);
  } catch(e) {
    console.error('[ADMIN] Error invitando admin:', e.message);
    showToast('error','Error', 'No se pudo enviar la invitación: ' + e.message);
    return;
  }

  $('ia-email').value = '';
  $('ia-user').value  = '';

  const banner = $('inv-success');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="success-banner">
        <div class="success-banner-title">✓ Invitación enviada</div>
        <div class="success-banner-sub">Se ha enviado un correo de invitación a <strong>${esc(email)}</strong>. El usuario deberá hacer clic en el enlace para activar su cuenta y crear su contraseña. El enlace expira en 48 horas.</div>
      </div>
    `;
  }
  showToast('success','Invitación enviada',`Correo de invitación enviado a ${email}`);
  navigateTo('administradores');
}

async function handleSetPassword(e) {
  e.preventDefault();
  const pwd = val('new-pwd');
  const rep = val('rep-pwd');
  let ok = true;

  if (!pwd||pwd.length<8) { fieldErr('err-new-pwd','new-pwd','La contraseña debe tener al menos 8 caracteres'); ok=false; } else fieldOk('err-new-pwd','new-pwd');
  if (pwd!==rep) { fieldErr('err-rep-pwd','rep-pwd','Las contraseñas no coinciden'); ok=false; } else fieldOk('err-rep-pwd','rep-pwd');
  if (!ok) return;

  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    showToast('error','Error','No se encontró el token de activación en la URL.');
    return;
  }

  try {
    await api('POST', '/auth/activate', { token, password: pwd });
    showPage('login');
    showToast('success','¡Cuenta activada!','Tu cuenta ha sido activada. Ya puedes iniciar sesión con tu email y contraseña.');
    // Limpiar URL
    window.history.replaceState({}, '', window.location.pathname);
  } catch (err) {
    console.error('[ACTIVATE] Error:', err.message);
    showToast('error','Error al activar', err.message);
    // Si el token expiró o es inválido, redirigir al login
    if (err.message.includes('expirado') || err.message.includes('no encontrado')) {
      showPage('login');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}

function toggleAdmin(id, active) {
  const a = state.admins.find(a=>a.id===id);
  if (!a) return;
  a.activo = active;
  api('PUT', `/administrators/${id}`, { activo: active }).catch(e => console.error('Error toggle admin:', e));
  showToast('success','Estado actualizado',`${a.nombre} está ahora ${active?'activo':'inactivo'}.`);
  setTimeout(()=>navigateTo('administradores'), 80);
}

async function deleteAdmin(id) {
  if (id===1) { showToast('error','No permitido','No se puede eliminar al administrador principal.'); return; }
  if (!confirm('¿Eliminar este administrador?')) return;
  state.admins = state.admins.filter(a=>a.id!==id);
  await api('DELETE', `/administrators/${id}`).catch(e => console.error('Error eliminando admin:', e));
  navigateTo('administradores');
  showToast('success','Administrador eliminado','La cuenta ha sido eliminada del sistema.');
}

// ============================================================
// HOME INTERACTIONS
// ============================================================
function selectTripType(type, btn) {
  document.querySelectorAll('#home-seg .seg-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const gida  = $('g-ida');
  const gvue  = $('g-vuelta');
  if (!gida||!gvue) return;
  if (type==='ida') {
    gida.style.cssText='opacity:1;pointer-events:auto';
    gvue.style.cssText='opacity:0.4;pointer-events:none';
    const vuelInp = $('h-fecha-vuelta');
    if (vuelInp) vuelInp.value = '';
  } else {
    gida.style.cssText='opacity:1;pointer-events:auto';
    gvue.style.cssText='opacity:1;pointer-events:auto';
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================
const ALLOWED_INVOICE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_INVOICE_SIZE = 10 * 1024 * 1024; // 10 MB

function _setInvoiceFile(f) {
  if (!f) return;
  if (!ALLOWED_INVOICE_TYPES.includes(f.type)) {
    showToast('error', 'Formato no permitido', 'Solo se aceptan PDF, JPG o PNG.');
    return;
  }
  if (f.size > MAX_INVOICE_SIZE) {
    showToast('error', 'Archivo demasiado grande', 'El tamaño máximo es 10 MB.');
    return;
  }
  state._pendingInvoiceFile = f;
  const el = $('file-selected');
  if (el) { el.textContent = `✓ ${f.name} (${(f.size/1024).toFixed(0)} KB)`; el.style.display='block'; }
}

function onFileSelect(input) {
  if (!input.files.length) return;
  _setInvoiceFile(input.files[0]);
}
function dragOver(e)  { e.preventDefault(); $('upload-area')&&$('upload-area').classList.add('over'); }
function dragLeave()  { $('upload-area')&&$('upload-area').classList.remove('over'); }
function doDrop(e)    {
  e.preventDefault();
  $('upload-area')&&$('upload-area').classList.remove('over');
  _setInvoiceFile(e.dataTransfer.files[0]);
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================
function updatePwStrength(pw) {
  let s = 0;
  if (pw.length>=8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const cls = ['weak','fair','good','strong'];
  ['pwb1','pwb2','pwb3','pwb4'].forEach((id,i)=>{
    const el = $(id);
    if (!el) return;
    el.className = 'pw-bar';
    if (i<s) el.classList.add(cls[s-1]);
  });
}

// ============================================================
// VALIDATION
// ============================================================
function isLocalizador(v) { return /^[A-Z0-9]{5,10}$/.test(v); }
function isDNI(v)         { return /^[0-9]{8}[A-Za-z]$/.test(v); }
function isNIE(v)         { return /^[XYZxyz][0-9]{7}[A-Za-z]$/.test(v); }
function isPassport(v)    { return /^[A-Za-z0-9]{6,20}$/.test(v); }
function isName(v)        { return v.length >= 2 && !/^\d+$/.test(v) && /^[A-Za-zÀ-ɏḀ-ỿ' \-]+$/.test(v); }
function isPlate(v)       { const n = v.replace(/\s/g,'').toUpperCase(); return /^[0-9]{4}[A-Z]{3}$/.test(n) || /^[A-Z]{1,2}[0-9]{4}[A-Z]{2}$/.test(n); }
function isDocNum(num, tipo) {
  const t = (tipo || '').toUpperCase();
  if (t === 'DNI') return isDNI(num);
  if (t === 'NIE') return isNIE(num);
  return isPassport(num);
}
function isEmail(v)       { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isPhone(v)       { return /^[0-9\s\-]{6,15}$/.test(v); }

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, msg) {
  const icons = {
    success: '<svg class="toast-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg class="toast-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg class="toast-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg class="toast-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };
  const root = $('toast-root');
  if (!root) return;
  const id  = 'toast-' + Date.now() + Math.random().toString(36).slice(2,5);
  const el  = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.id = id;
  el.innerHTML = `${icons[type]||icons.info}<div class="toast-body"><div class="toast-title">${esc(title)}</div>${msg?`<div class="toast-msg">${esc(msg)}</div>`:''}</div>`;
  root.appendChild(el);
  setTimeout(()=>{ const t=$( id); if(t){t.classList.add('removing');setTimeout(()=>t.remove(),220);} }, 4200);
}

// ============================================================
// SIDEBAR (MOBILE)
// ============================================================
function toggleSidebar() {
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
  $('sidebar')&&$('sidebar').classList.remove('open');
  $('sidebar-overlay')&&$('sidebar-overlay').classList.remove('active');
}

// ============================================================
// UTILITIES
// ============================================================
function $(id)  { return document.getElementById(id); }
function val(id){ const el=$(id); return el?el.value:''; }
function esc(s) { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }
function formatDate(d) { try { const dt=new Date(d); if(isNaN(dt)) return String(d||''); return dt.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e) { return String(d||''); } }

function fieldErr(errId, inputId, msg) {
  const err=$(errId), inp=$(inputId);
  if (err){ err.textContent=msg; err.classList.add('visible'); }
  if (inp) inp.classList.add('is-error');
}
function fieldOk(errId, inputId) {
  const err=$(errId), inp=$(inputId);
  if (err) err.classList.remove('visible');
  if (inp) inp.classList.remove('is-error');
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch { return s; }
}
function fmtDateShort(s) {
  if (!s) return '—';
  try {
    const d = new Date(s.length===10 ? s+'T00:00:00' : s);
    return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  } catch { return s; }
}

function estadoBadge(e) {
  return {Activo:'badge-active',Confirmado:'badge-success',Pendiente:'badge-warning',Cancelado:'badge-danger'}[e]||'badge-gray';
}
function facturaBadge(e) {
  return {Pagada:'badge-success',Pendiente:'badge-warning',Anulada:'badge-danger'}[e]||'badge-gray';
}
function isExpired(s) { return s ? new Date(s) < new Date() : false; }
function initials(name) {
  return (name||'').split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
}

// Naviera branding: real logos where available, colored text badge as fallback
function getNavieraLogo(name, size = 'lg') {
  const n   = (name||'').toLowerCase();
  const cls = size === 'sm' ? 'naviera-cell-badge' : 'naviera-logo-badge';

  // Navieras with real logo images in img/
  const imgBrands = [
    { match: ['baleàr','baleari','baleária','balearia'], img: 'img/LOGO-BALEARIA.png' },
    { match: ['trasmed','trasmediterr'],                 img: 'img/Trasmed_logo.png'  },
    { match: ['frs'],                                   img: 'img/Logo_FRS.svg.png'  },
    { match: ['armas'],                                 img: 'img/Armas_logo.png'    },
    { match: ['gnv'],                                   img: 'img/GNV_logo.svg.png'  },
    { match: ['fred','olsen'],                          img: 'img/logo_fred_oslen.png' },
  ];
  const imgFound = imgBrands.find(b => b.match.some(m => n.includes(m)));
  if (imgFound) {
    return `<div class="${cls}" style="background:white;padding:3px">
      <img src="${imgFound.img}" alt="${(name||'').replace(/"/g,'&quot;')}" style="width:100%;height:100%;object-fit:contain">
    </div>`;
  }

  // Text fallback for navieras without image (e.g. GNV)
  const textBrands = [
    { match: 'gnv',     abbr: 'GNV', color: '#e31e24', bg: '#fff0f0' },
    { match: 'acciona', abbr: 'ACN', color: '#e30613', bg: '#fff0f0' },
    { match: 'nautas',  abbr: 'NAU', color: '#0067b1', bg: '#e6f2ff' },
  ];
  const textFound = textBrands.find(b => n.includes(b.match));
  const abbr  = textFound ? textFound.abbr  : (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3)||'?';
  const color = textFound ? textFound.color : 'var(--primary)';
  const bg    = textFound ? textFound.bg    : 'var(--primary-50)';
  return `<div class="${cls}" style="background:${bg};color:${color}">${abbr}</div>`;
}

// ============================================================
// VEHICLE COUNTER
// ============================================================
function changeVehicleCount(delta) {
  const wz = state.bookingWizard;
  if (!wz) return;
  if (!Array.isArray(wz.vehicles)) wz.vehicles = [];
  persistAllVehicleBlocks();
  const next = Math.max(1, Math.min(10, wz.vehicles.length + delta));
  if (next > wz.vehicles.length) {
    while (wz.vehicles.length < next) wz.vehicles.push(emptyVehicleEntry());
  } else if (next < wz.vehicles.length) {
    wz.vehicles.length = next;
  }
  wz._vehicleCount = wz.vehicles.length;
  showVehicleForm();
}

function updateCounterBtns() {
  const count = state.bookingWizard?.vehicles?.length || 1;
  const minus = $('vc-minus');
  const plus  = $('vc-plus');
  if (minus) minus.disabled = count <= 1;
  if (plus)  plus.disabled  = count >= 10;
}

// ============================================================
// BOOKING DETAIL MODAL
// ============================================================
function openBookingModal(bookingId) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return;

  // Buscar otros pasajeros del mismo grupo
  const group = b.groupId ? state.bookings.filter(x => x.groupId === b.groupId) : [b];

  const overlay = $('booking-modal-overlay');
  const body    = $('booking-modal-body');
  if (!overlay || !body) return;

  const tripLabel = b.tripType === 'idayvuelta' ? 'Ida y vuelta' : 'Ida';

  body.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Reserva #${b.id} ${b.groupId ? `<span style="font-size:0.75rem;color:var(--gray-400);font-weight:400"> (Grupo: ${b.groupId})</span>` : ''}</div>
      <button class="modal-close" onclick="closeBookingModal()" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="modal-section">
        <div class="modal-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l2-2m0 0l7-7 4 4L21 6"/></svg>
          Detalles del viaje
        </div>
        <div class="modal-detail-grid">
          <div class="modal-detail-item"><div class="modal-detail-label">Tipo</div><div class="modal-detail-value">${tripLabel}</div></div>
          <div class="modal-detail-item"><div class="modal-detail-label">Estado</div><div class="modal-detail-value"><span class="badge ${estadoBadge(b.estado)}">${esc(b.estado)}</span></div></div>
          <div class="modal-detail-item"><div class="modal-detail-label">Naviera</div><div class="modal-detail-value">${esc(b.naviera)}</div></div>
          <div class="modal-detail-item"><div class="modal-detail-label">Localizador</div><div class="modal-detail-value">${b.localizador ? `<span class="pill-code">${esc(b.localizador)}</span>` : '<span style="color:var(--gray-300)">Pendiente</span>'}</div></div>
          ${b.createdAt ? `<div class="modal-detail-item"><div class="modal-detail-label">Fecha creación</div><div class="modal-detail-value">${formatDate(b.createdAt)}</div></div>` : ''}
        </div>
        
        <!-- Trayectos detallados -->
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
          <div style="padding:10px;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--gray-100)">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--gray-400);font-weight:700;margin-bottom:4px">Trayecto de Ida</div>
            <div style="font-weight:600;font-size:0.875rem">${esc(b.origin)} → ${esc(b.destination)}</div>
            <div style="font-size:0.8125rem;color:var(--gray-600)">${esc(b.departureDate)} ${b.departureTime||''}</div>
          </div>
          ${b.returnDate ? `
          <div style="padding:10px;background:var(--primary-50);border-radius:var(--radius);border:1px solid var(--primary-100)">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--primary-600);font-weight:700;margin-bottom:4px">Trayecto de Vuelta</div>
            <div style="font-weight:600;font-size:0.875rem">${esc(b.destination)} → ${esc(b.origin)}</div>
            <div style="font-size:0.8125rem;color:var(--gray-600)">${esc(b.returnDate)} ${b.returnTime||''}</div>
          </div>` : ''}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 21v-2a4 4 0 0 1 4-4"/><circle cx="9" cy="7" r="4"/></svg>
          Pasajeros (${group.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${group.map((p, idx) => `
            <div style="${idx > 0 ? 'padding-top:12px;border-top:1px solid var(--gray-100)' : ''}">
              <div style="font-weight:600;font-size:0.875rem;margin-bottom:4px">${idx + 1}. ${esc(p.paxNombre)} ${esc(p.paxApellido1)}${p.paxApellido2 ? ' ' + esc(p.paxApellido2) : ''}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:0.8125rem;color:var(--gray-500)">
                ${p.paxTipoDoc || p.paxNumDoc ? `<div><span style="color:var(--gray-400)">${esc(p.paxTipoDoc || 'Doc')}:</span> ${esc(p.paxNumDoc)}</div>` : ''}
                ${p.paxExpDoc ? `<div><span style="color:var(--gray-400)">Expiración:</span> ${esc(p.paxExpDoc)}</div>` : ''}
                ${p.paxEmail ? `<div><span style="color:var(--gray-400)">Email:</span> ${esc(p.paxEmail)}</div>` : ''}
                ${p.paxTelefono ? `<div><span style="color:var(--gray-400)">Teléfono:</span> ${esc(p.paxTelefono)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      ${b.vehMarca ? `
      <div class="modal-section">
        <div class="modal-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Vehículo ${b.vehicleCount > 1 ? `(${b.vehicleCount})` : ''}
        </div>
        <div class="modal-detail-grid">
          <div class="modal-detail-item"><div class="modal-detail-label">Marca / Modelo</div><div class="modal-detail-value">${esc(b.vehMarca)} ${esc(b.vehModelo)}</div></div>
          ${b.vehMatricula ? `<div class="modal-detail-item"><div class="modal-detail-label">Matrícula</div><div class="modal-detail-value"><span class="pill-code">${esc(b.vehMatricula)}</span></div></div>` : ''}
          <div class="modal-detail-item"><div class="modal-detail-label">Dimensiones</div><div class="modal-detail-value">${b.vehLargo||'?'}m × ${b.vehAncho||'?'}m × ${b.vehAlto||'?'}m</div></div>
        </div>
      </div>` : ''}

    </div>`;

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = $('booking-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('closing');
  document.body.style.overflow = '';
  setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('closing'); }, 150);
}

// ============================================================
// EDIT MEMBER (inline modal)
// ============================================================
async function editMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;

  const overlay = $('booking-modal-overlay');
  const body    = $('booking-modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Editar Miembro #${m.id}</div>
      <button class="modal-close" onclick="closeBookingModal()" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <form id="edit-member-form" onsubmit="submitEditMember(event, ${id})" novalidate>
        <div class="form-grid">
          <div class="form-group"><label class="form-label">Nombre</label><input type="text" class="form-input" id="em-nombre" value="${esc(m.nombre)}"></div>
          <div class="form-group"><label class="form-label">Apellido 1</label><input type="text" class="form-input" id="em-ape1" value="${esc(m.apellido1 || (m.apellido ? m.apellido.split(' ')[0] : ''))}"></div>
          <div class="form-group"><label class="form-label">Apellido 2</label><input type="text" class="form-input" id="em-ape2" value="${esc(m.apellido2 || (m.apellido ? m.apellido.split(' ').slice(1).join(' ') : ''))}"></div>
          <div class="form-group"><label class="form-label">DNI</label><input type="text" class="form-input" id="em-dni" value="${esc(m.dni||m.numDoc||'')}"></div>
          <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-input" id="em-tel" value="${esc(m.telefono||'')}"></div>
          <div class="form-group"><label class="form-label">Fecha de nacimiento</label><input type="date" class="form-input" id="em-fnac" value="${esc(m.fechaNacimiento||m.fnac||'')}"></div>
          <div class="form-group"><label class="form-label">Fecha de expiración</label><input type="date" class="form-input" id="em-fexp" value="${esc(m.fechaExpiracion||m.expDoc||'')}"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="closeBookingModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="width:auto">Guardar cambios</button>
        </div>
      </form>
    </div>`;

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

async function submitEditMember(e, id) {
  e.preventDefault();
  const idx = state.members.findIndex(m => m.id === id);
  if (idx >= 0) {
    const ape1 = val('em-ape1');
    const ape2 = val('em-ape2');
    const changes = {
      nombre: val('em-nombre'),
      apellido: `${ape1}${ape2 ? ' ' + ape2 : ''}`,
      apellido1: ape1,
      apellido2: ape2,
      telefono: val('em-tel'),
      dni: val('em-dni'),
      fechaNacimiento: val('em-fnac'),
      fechaExpiracion: val('em-fexp'),
    };
    state.members[idx] = { ...state.members[idx], ...changes };
    api('PUT', `/members/${id}`, changes).catch(e => console.error('Error guardando miembro:', e));
  }
  closeBookingModal();
  navigateTo(state.currentSection);
  showToast('success', 'Miembro actualizado', `Guardado correctamente.`);
}

// ============================================================
// EDIT VEHICLE (inline modal)
// ============================================================
async function editVehicle(id) {
  const v = state.vehicles.find(x => x.id === id);
  if (!v) return;

  const overlay = $('booking-modal-overlay');
  const body    = $('booking-modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Editar Vehículo #${v.id}</div>
      <button class="modal-close" onclick="closeBookingModal()" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <form id="edit-vehicle-form" onsubmit="submitEditVehicle(event, ${id})" novalidate>
        <div class="form-grid">
          <div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-input" id="ev-marca" value="${esc(v.marca)}"></div>
          <div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-input" id="ev-modelo" value="${esc(v.modelo)}"></div>
          <div class="form-group"><label class="form-label">Matrícula</label><input type="text" class="form-input" id="ev-mat" value="${esc(v.matricula||'')}" placeholder="Ej: 1234ABC"></div>
        </div>
        <div class="form-grid-3" style="margin-top:8px">
          <div class="form-group"><label class="form-label">Ancho (m)</label><input type="number" class="form-input" id="ev-ancho" value="${v.ancho}" step="0.01"></div>
          <div class="form-group"><label class="form-label">Largo (m)</label><input type="number" class="form-input" id="ev-largo" value="${v.largo}" step="0.01"></div>
          <div class="form-group"><label class="form-label">Alto (m)</label><input type="number" class="form-input" id="ev-alto" value="${v.alto}" step="0.01"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="closeBookingModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="width:auto">Guardar cambios</button>
        </div>
      </form>
    </div>`;

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

async function submitEditVehicle(e, id) {
  e.preventDefault();
  const ancho = parseFloat(val('ev-ancho'));
  const largo = parseFloat(val('ev-largo'));
  const alto  = parseFloat(val('ev-alto'));
  if (ancho <= 0 || isNaN(ancho) || largo <= 0 || isNaN(largo) || alto <= 0 || isNaN(alto)) {
    showToast('error', 'Dimensiones inválidas', 'Ancho, largo y alto deben ser mayores que 0.');
    return;
  }
  const idx = state.vehicles.findIndex(v => v.id === id);
  if (idx >= 0) {
    const changes = {
      marca: val('ev-marca'),
      modelo: val('ev-modelo'),
      matricula: val('ev-mat'),
      ancho, largo, alto,
    };
    state.vehicles[idx] = { ...state.vehicles[idx], ...changes };
    api('PUT', `/vehicles/${id}`, changes).catch(e => console.error('Error guardando vehículo:', e));
  }
  closeBookingModal();
  navigateTo(state.currentSection);
  showToast('success', 'Vehículo actualizado', `Guardado correctamente.`);
}

// ============================================================
// EDIT BOOKING (inline modal)
// ============================================================
async function editBooking(id) {
  const b = state.bookings.find(x => x.id === id);
  if (!b) return;

  const overlay = $('booking-modal-overlay');
  const body    = $('booking-modal-body');
  if (!overlay || !body) return;

  const hasVehicle = !!b.vehMarca;
  const NAVIERAS = ['Balearia','Baleària','FRS','Armas Trasatlántica','GNV','Trasmediterránea'];
  // Asegurar que la naviera actual siempre aparece en el select aunque no esté en la lista
  const navieraOptions = b.naviera && !NAVIERAS.includes(b.naviera)
    ? [...NAVIERAS, b.naviera]
    : NAVIERAS;

  body.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Editar Reserva #${b.id}</div>
      <button class="modal-close" onclick="closeBookingModal()" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      ${hasVehicle ? `<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:var(--radius);padding:10px 14px;margin-bottom:16px;font-size:0.875rem;color:#92400e">
        <strong>ℹ Reserva con vehículo</strong> — puedes editar datos del viaje y del pasajero, pero no los datos del vehículo.
      </div>` : ''}
      <form id="edit-booking-form" onsubmit="submitEditBooking(event,${id})" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Origen</label>
            <input type="text" class="form-input" id="eb-origin" value="${esc(b.origin||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Destino</label>
            <input type="text" class="form-input" id="eb-dest" value="${esc(b.destination||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Naviera</label>
            <select class="form-input" id="eb-naviera">
              ${navieraOptions.map(n=>`<option value="${n}" ${b.naviera===n?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de viaje</label>
            <select class="form-input" id="eb-triptype">
              <option value="ida" ${b.tripType==='ida'?'selected':''}>Ida</option>
              <option value="idayvuelta" ${b.tripType==='idayvuelta'?'selected':''}>Ida y vuelta</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha salida</label>
            <input type="date" class="form-input" id="eb-depdate" value="${esc(b.departureDate||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Hora salida</label>
            <input type="time" class="form-input" id="eb-deptime" value="${esc(b.departureTime||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Fecha vuelta</label>
            <input type="date" class="form-input" id="eb-retdate" value="${esc(b.returnDate||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Hora vuelta</label>
            <input type="time" class="form-input" id="eb-rettime" value="${esc(b.returnTime||'')}">
          </div>
        </div>
        <div style="margin-top:4px;margin-bottom:2px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-400)">Pasajero principal</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-input" id="eb-pnombre" value="${esc(b.paxNombre||b.passengerName?.split(' ')[0]||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Apellido</label>
            <input type="text" class="form-input" id="eb-pape1" value="${esc(b.paxApellido1||b.passengerName?.split(' ').slice(1).join(' ')||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="eb-pemail" value="${esc(b.paxEmail||b.email||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" class="form-input" id="eb-ptel" value="${esc(b.paxTelefono||'')}">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="closeBookingModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="width:auto">Guardar cambios</button>
        </div>
      </form>
    </div>`;

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

function submitEditBooking(e, id) {
  e.preventDefault();
  const idx = state.bookings.findIndex(b => b.id === id);
  if (idx >= 0) {
    const changes = {
      origin:        val('eb-origin'),
      destination:   val('eb-dest'),
      naviera:       val('eb-naviera'),
      tripType:      val('eb-triptype'),
      departureDate: val('eb-depdate'),
      departureTime: val('eb-deptime') || null,
      returnDate:    val('eb-retdate') || null,
      returnTime:    val('eb-rettime') || null,
      passengerName: `${val('eb-pnombre')} ${val('eb-pape1')}`.trim(),
      email:         val('eb-pemail'),
      paxNombre:     val('eb-pnombre'),
      paxApellido1:  val('eb-pape1'),
      paxEmail:      val('eb-pemail'),
      paxTelefono:   val('eb-ptel') || null,
    };
    state.bookings[idx] = { ...state.bookings[idx], ...changes };
    api('PUT', `/bookings/${id}`, changes).catch(e => console.error('Error guardando reserva:', e));
  }
  closeBookingModal();
  navigateTo(state.currentSection);
  showToast('success', 'Reserva actualizada', `Reserva #${id} guardada correctamente.`);
}

// ============================================================
// EDIT INVOICE (inline modal)
// ============================================================
async function editInvoice(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;

  const overlay = $('booking-modal-overlay');
  const body    = $('booking-modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Editar Factura ${esc(inv.numero)}</div>
      <button class="modal-close" onclick="closeBookingModal()" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <form id="edit-invoice-form" onsubmit="submitEditInvoice(event,${id})" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Número de factura</label>
            <input type="text" class="form-input" id="ei-num" value="${esc(inv.numero)}">
          </div>
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-input" id="ei-fec" value="${esc(inv.fecha||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Importe (€)</label>
            <input type="number" class="form-input" id="ei-imp" value="${parseFloat(inv.importe)||0}" step="0.01" min="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="form-input" id="ei-est">
              <option value="Pendiente" ${inv.estado==='Pendiente'?'selected':''}>Pendiente</option>
              <option value="Pagada"    ${inv.estado==='Pagada'   ?'selected':''}>Pagada</option>
              <option value="Anulada"   ${inv.estado==='Anulada'  ?'selected':''}>Anulada</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="closeBookingModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="width:auto">Guardar cambios</button>
        </div>
      </form>
    </div>`;

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
  document.body.style.overflow = 'hidden';
}

function submitEditInvoice(e, id) {
  e.preventDefault();
  const idx = state.invoices.findIndex(i => i.id === id);
  if (idx >= 0) {
    const changes = {
      numero:  val('ei-num'),
      fecha:   val('ei-fec'),
      importe: parseFloat(val('ei-imp')) || 0,
      estado:  val('ei-est'),
    };
    state.invoices[idx] = { ...state.invoices[idx], ...changes };
    api('PUT', `/invoices/${id}`, changes).catch(e => console.error('Error guardando factura:', e));
  }
  closeBookingModal();
  navigateTo(state.currentSection);
  showToast('success', 'Factura actualizada', `Guardada correctamente.`);
}


