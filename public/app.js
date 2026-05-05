/* ============================================================
   KIKOTO - Agency Management Platform
   app.js - Frontend Logic (consume la API Node.js en /api)
   ============================================================ */

'use strict';

// ============================================================
// API BASE — apunta al backend PHP
// ============================================================
const API_BASE = '/api';

/**
 * Llamada genérica a la API PHP.
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

const NOTIFICATION_EMAIL = 'admin@kikoto.com';

// ============================================================
// APPLICATION STATE  (datos que se cargan desde el backend PHP)
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
  bookingWizard: null,
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Modo demo: siempre mostrar login
  showPage('login');
});

/**
 * Carga todos los datos desde el backend PHP y actualiza el state.
 * Si el backend no está disponible, usa datos demo locales.
 */
function loadStateFromServer() {
  _loadDemoData();
}

/** Datos demo para cuando el backend PHP no está disponible */
function _loadDemoData() {
  state.bookings = [
    { id:1, tripType:'ida', origin:'Algeciras', destination:'Ceuta', naviera:'Balearia',
      departureDate:'2024-03-15', departureTime:'08:00', returnDate:null, returnTime:null,
      localizador:'', estado:'Pendiente', passengerName:'María García',
      vehiclePlate:'Mercedes Sprinter', email:'maria@ejemplo.com', createdAt:'2024-03-10' },
    { id:2, tripType:'idayvuelta', origin:'Barcelona', destination:'Palma', naviera:'Trasmediterránea',
      departureDate:'2024-04-01', departureTime:'10:30', returnDate:'2024-04-08', returnTime:'09:00',
      localizador:'ALG1234', estado:'Activo', passengerName:'Carlos Martínez',
      vehiclePlate:'Volkswagen Crafter', email:'carlos@ejemplo.com', createdAt:'2024-03-20' },
  ];
  state.members = [
    { id:1, nombre:'María',  apellido:'García López', dni:'12345678A', telefono:'+34 612 345 678', fechaNacimiento:'1985-06-15', fechaExpiracion:'2026-06-15' },
    { id:2, nombre:'Carlos', apellido:'Martínez',     dni:'87654321B', telefono:'+34 698 765 432', fechaNacimiento:'1990-03-22', fechaExpiracion:'2025-12-31' },
    { id:3, nombre:'Ana',    apellido:'Rodríguez',    dni:'11223344C', telefono:'+34 655 111 222', fechaNacimiento:'1978-11-08', fechaExpiracion:'2026-03-08' },
  ];
  state.vehicles = [
    { id:1, marca:'Mercedes',  modelo:'Sprinter', ancho:2.10, largo:5.90, alto:2.80 },
    { id:2, marca:'Volkswagen',modelo:'Crafter',  ancho:2.05, largo:5.40, alto:2.60 },
    { id:3, marca:'Ford',      modelo:'Transit',  ancho:2.00, largo:5.50, alto:2.55 },
    { id:4, marca:'Renault',   modelo:'Master',   ancho:1.99, largo:5.05, alto:2.48 },
  ];
  state.invoices = [
    { id:1, numero:'FAC-2024-001', fecha:'2024-01-15', importe:1250.00, estado:'Pagada',   archivo:'factura_001.pdf' },
    { id:2, numero:'FAC-2024-002', fecha:'2024-02-08', importe: 875.50, estado:'Pendiente',archivo:'factura_002.pdf' },
    { id:3, numero:'FAC-2024-003', fecha:'2024-02-28', importe:3400.00, estado:'Pagada',   archivo:'factura_003.pdf' },
    { id:4, numero:'FAC-2024-004', fecha:'2024-03-10', importe: 620.00, estado:'Anulada',  archivo:null },
    { id:5, numero:'FAC-2024-005', fecha:'2024-03-22', importe:1890.75, estado:'Pendiente',archivo:'factura_005.pdf' },
  ];
  state.admins = [
    { id:1, nombre:'Admin Principal', email:'admin@kikoto.com', usuario:'admin',     activo:true,  fecha:'2024-01-10', acciones:'Acceso completo' },
    { id:2, nombre:'Laura Sánchez',   email:'laura@kikoto.com', usuario:'laura.s',   activo:true,  fecha:'2024-02-14', acciones:'Gestión de reservas' },
    { id:3, nombre:'Roberto Pérez',   email:'rob@kikoto.com',   usuario:'roberto.p', activo:false, fecha:'2024-03-01', acciones:'Sin actividad reciente' },
  ];
}

/**
 * Compatibilidad: saveToStorage ya no escribe en localStorage;
 * los datos se persisten en el backend PHP. Se mantiene la función
 * vacía para no romper llamadas existentes en el código.
 */
function saveToStorage() { /* datos gestionados por el backend PHP */ }

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
    // Modo demo: solo se permite acceso con credenciales demo
    if (email.toLowerCase() === 'admin@kikoto.com' && pwd === 'Admin123') {
      state.currentUser = { email: 'admin@kikoto.com', name: 'Admin Principal', initials: 'AP' };
      $('sidebar-uname').textContent = 'Admin Principal';
      $('user-ava').textContent       = 'AP';
      loadStateFromServer();
      showPage('dashboard');
      navigateTo('home');
      showToast('success','Bienvenido','Has iniciado sesión correctamente.');
      return;
    }
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
function renderWizStepBar(current, withVehicle) {
  const bar = $('wiz-step-bar');
  if (!bar) return;
  const steps = withVehicle
    ? ['Búsqueda','Disponibilidad','Pasajero','Vehículo','Confirmar']
    : ['Búsqueda','Disponibilidad','Pasajero','Confirmar'];
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
  renderWizStepBar(1, sp.withVehicle || false);
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
          <div class="form-group" id="g-ida" style="margin-bottom:0">
            <label class="form-label" style="font-size:0.8125rem">Fecha de ida</label>
            <input type="date" class="form-input" id="h-fecha-ida" value="${esc(sp.fechaIda||'')}">
            <span class="error-msg" id="e-fecha-ida"></span>
          </div>
          <div class="form-group" id="g-vuelta" style="margin-bottom:0;${(sp.tripType==='idayvuelta'||sp.tripType==='Ida y vuelta')?'':'opacity:0.4;pointer-events:none'}">
            <label class="form-label" style="font-size:0.8125rem">Fecha de vuelta</label>
            <input type="date" class="form-input" id="h-fecha-vuelta" value="${esc(sp.fechaVuelta||'')}">
            <span class="error-msg" id="e-fecha-vuelta"></span>
          </div>
        </div>
      </div>
      <div style="margin-bottom:22px">
        <span class="form-sec-label">Opciones</span>
        <div class="chips-row">
          <div class="chip ${sp.withVehicle?'active':''}" id="chip-vehiculo" onclick="this.classList.toggle('active')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            Vehículo
          </div>
        </div>
      </div>
      <button class="btn btn-primary" style="width:auto;padding:11px 32px;font-size:1rem" onclick="doSearchSailings()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar disponibilidad
      </button>
    </div>`;

  // Date constraints
  const today = new Date().toISOString().split('T')[0];
  const idaEl = $('h-fecha-ida');
  if (idaEl) {
    idaEl.min = today;
    idaEl.addEventListener('change', () => {
      const vuelEl = $('h-fecha-vuelta');
      if (vuelEl && idaEl.value) {
        vuelEl.min = idaEl.value;
        if (vuelEl.value && vuelEl.value < idaEl.value) vuelEl.value = idaEl.value;
      }
    });
  }

  // Autofocus on origin input (Kikoto "Voy con prisa" philosophy)
  setTimeout(() => $('h-origen')?.focus(), 80);
}

async function loadRoutes() {
  try {
    const data = await api('GET', '/routes');
    // API may return array directly or wrapped
    const routes = Array.isArray(data) ? data : (data.data || data.routes || []);
    state.routes = routes;
  } catch(err) {
    // CORS or network error: use demo routes
    state.routes = [
      // Estrecho / Norte de África
      { id:1,  name:'Algeciras - Ceuta',         departure_port:{ id:10, name:'Algeciras'  }, destination_port:{ id:11, name:'Ceuta'        } },
      { id:2,  name:'Algeciras - Tánger Med',    departure_port:{ id:10, name:'Algeciras'  }, destination_port:{ id:12, name:'Tánger Med'   } },
      { id:3,  name:'Algeciras - Tánger Ciudad', departure_port:{ id:10, name:'Algeciras'  }, destination_port:{ id:13, name:'Tánger Ciudad'} },
      { id:4,  name:'Tarifa - Tánger Ciudad',    departure_port:{ id:14, name:'Tarifa'     }, destination_port:{ id:13, name:'Tánger Ciudad'} },
      { id:5,  name:'Ceuta - Algeciras',         departure_port:{ id:11, name:'Ceuta'      }, destination_port:{ id:10, name:'Algeciras'    } },
      { id:6,  name:'Málaga - Melilla',          departure_port:{ id:30, name:'Málaga'     }, destination_port:{ id:31, name:'Melilla'      } },
      { id:7,  name:'Almería - Melilla',         departure_port:{ id:32, name:'Almería'    }, destination_port:{ id:31, name:'Melilla'      } },
      { id:8,  name:'Almería - Nador',           departure_port:{ id:32, name:'Almería'    }, destination_port:{ id:33, name:'Nador'        } },
      { id:9,  name:'Almería - Ghazaouet',       departure_port:{ id:32, name:'Almería'    }, destination_port:{ id:34, name:'Ghazaouet'   } },
      { id:10, name:'Motril - Melilla',          departure_port:{ id:35, name:'Motril'     }, destination_port:{ id:31, name:'Melilla'      } },
      { id:11, name:'Cartagena - Orán',          departure_port:{ id:36, name:'Cartagena'  }, destination_port:{ id:37, name:'Orán'         } },
      // Baleares
      { id:12, name:'Barcelona - Palma',         departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:21, name:'Palma'        } },
      { id:13, name:'Barcelona - Ibiza',         departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:23, name:'Ibiza'        } },
      { id:14, name:'Barcelona - Mahón',         departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:24, name:'Mahón'        } },
      { id:15, name:'Valencia - Palma',          departure_port:{ id:22, name:'Valencia'   }, destination_port:{ id:21, name:'Palma'        } },
      { id:16, name:'Valencia - Ibiza',          departure_port:{ id:22, name:'Valencia'   }, destination_port:{ id:23, name:'Ibiza'        } },
      { id:17, name:'Valencia - Mahón',          departure_port:{ id:22, name:'Valencia'   }, destination_port:{ id:24, name:'Mahón'        } },
      { id:18, name:'Denia - Ibiza',             departure_port:{ id:25, name:'Denia'      }, destination_port:{ id:23, name:'Ibiza'        } },
      { id:19, name:'Denia - Formentera',        departure_port:{ id:25, name:'Denia'      }, destination_port:{ id:26, name:'Formentera'   } },
      { id:20, name:'Palma - Ibiza',             departure_port:{ id:21, name:'Palma'      }, destination_port:{ id:23, name:'Ibiza'        } },
      { id:21, name:'Ibiza - Formentera',        departure_port:{ id:23, name:'Ibiza'      }, destination_port:{ id:26, name:'Formentera'   } },
      // Mediterráneo / Italia
      { id:22, name:'Barcelona - Génova',        departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:40, name:'Génova'       } },
      { id:23, name:'Barcelona - Civitavecchia', departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:41, name:'Civitavecchia'} },
      { id:24, name:'Barcelona - Palermo',       departure_port:{ id:20, name:'Barcelona'  }, destination_port:{ id:42, name:'Palermo'      } },
      { id:25, name:'Valencia - Génova',         departure_port:{ id:22, name:'Valencia'   }, destination_port:{ id:40, name:'Génova'       } },
    ];
    console.warn('Routes API error (using demo data):', err.message);
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

  // Al cambiar el origen, limpiar el destino seleccionado
  if (side === 'origen') {
    const destInp = $('h-destino'), destHid = $('h-destino-id');
    if (destInp) destInp.value = '';
    if (destHid) destHid.value = '';
    hideDropdown('drop-destino');
  }
}

function hideDropdown(id) {
  const el = $(id); if(el) { el.innerHTML=''; el.classList.remove('open'); }
}

let _searchInProgress = false;
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
  const withVehicle = !!$('chip-vehiculo')?.classList.contains('active');
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
  if (!isOk) return;

  const searchParams = { origenNm, origenId, destinoNm, destinoId, fechaIda, fechaVuelta, tripType, withVehicle };
  state.bookingWizard = {
    tripType, origin: origenNm, originId: origenId,
    destination: destinoNm, destinationId: destinoId,
    dateIda: fechaIda, dateVuelta: fechaVuelta || null,
    withVehicle, withPet: false,
    selectedSailing: null, passengers: [], vehicle: null, petDetails: [], saveAsFrequent: false,
    searchParams,
  };

  // Loading state
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
    }));
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
  // Try to combine real API data; fallback to demo if empty
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

  // Fallback demo data
  return [
    { naviera:'Balearia',          departureDate: date, departureTime:'07:30', raw:{} },
    { naviera:'Trasmediterránea',  departureDate: date, departureTime:'10:00', raw:{} },
    { naviera:'FRS',               departureDate: date, departureTime:'12:15', raw:{} },
    { naviera:'Armas Trasatlántica', departureDate: date, departureTime:'14:45', raw:{} },
    { naviera:'GNV',               departureDate: date, departureTime:'17:30', raw:{} },
  ];
}

// ── Paso 2: Disponibilidad ────────────────────────────────────
function showWizStep2() {
  const wz = state.bookingWizard;
  renderWizStepBar(2, wz?.withVehicle || false);
  const content = $('wiz-content');
  if (!content) return;
  const { origenNm, destinoNm, fechaIda } = wz.searchParams;
  const combined = state.searchResults;
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
  renderWizStepBar(3, wz.withVehicle);
  const content = $('wiz-content');
  if (!content) return;
  const fp = state.frequentPassengers;
  
  // Si no hay pasajeros, mostramos el formulario para el primero
  const paxListHtml = wz.passengers.length > 0 ? `
    <div class="pax-list-container" style="margin-bottom:24px">
      <div style="font-weight:700;font-size:0.875rem;color:var(--gray-700);margin-bottom:12px">Pasajeros añadidos (${wz.passengers.length})</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${wz.passengers.map((p, idx) => `
          <div class="pax-item-card" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:white;border:1px solid var(--gray-200);border-radius:var(--radius)">
            <div>
              <div style="font-weight:600;font-size:0.875rem">
                ${esc(p.nombre)} ${esc(p.apellido1)}
                ${p.isDriver ? '<span style="display:inline-block;margin-left:6px;padding:1px 8px;background:#dbeafe;color:#1d4ed8;border-radius:10px;font-size:0.65rem;font-weight:700;vertical-align:middle">🚗 Conductor</span>' : ''}
              </div>
              <div style="font-size:0.75rem;color:var(--gray-500)">${esc(p.tipoDoc)}: ${esc(p.numDoc)} · ${esc(p.email)}</div>
            </div>
            <button class="btn-icon-danger" onclick="removeWizPassenger(${idx})" title="Eliminar pasajero">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="showWizStep2()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <div>
          <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">Registro de pasajeros</div>
          <div style="font-size:0.8125rem;color:var(--gray-400)">Añade los datos de todos los viajeros</div>
        </div>
      </div>

      ${paxListHtml}

      <div class="fp-section" style="background:var(--gray-50);border:1px dashed var(--gray-300);padding:16px;border-radius:var(--radius);margin-bottom:24px">
        <div class="fp-section-header" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:0.8125rem">
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
        <div style="font-weight:700;font-size:0.8125rem;color:var(--gray-500);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.025em">Datos del nuevo pasajero</div>
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

        ${wz.withVehicle ? `
        <div style="margin:0 0 20px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--radius)">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.875rem;font-weight:500;color:var(--gray-700)">
            <input type="checkbox" id="pax-conductor" class="pax-is-driver" style="width:18px;height:18px;accent-color:var(--primary)"
              onchange="if(this.checked){document.querySelectorAll('.pax-is-driver').forEach(c=>c.checked=false);this.checked=true}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Marcar como conductor del vehículo
          </label>
        </div>` : ''}

        <div style="display:flex;gap:12px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--gray-100)">
          <button type="submit" class="btn btn-secondary" style="width:auto;padding:11px 24px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir pasajero
          </button>
          
          ${wz.passengers.length > 0 ? `
          <button type="button" class="btn btn-primary" style="width:auto;margin-left:auto;padding:11px 32px" onclick="finalizePassengerStep()">
            Continuar: ${wz.withVehicle ? 'Vehículo' : 'Confirmar'} →
          </button>` : ''}
        </div>
      </form>
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

function removeWizPassenger(idx) {
  if (!state.bookingWizard) return;
  state.bookingWizard.passengers.splice(idx, 1);
  showWizStep3();
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

  if (!nombre)           { fieldErr('e-pax-nombre','pax-nombre','Requerido'); ok=false; } else fieldOk('e-pax-nombre','pax-nombre');
  if (!ape1)             { fieldErr('e-pax-ape1','pax-ape1','Requerido'); ok=false; } else fieldOk('e-pax-ape1','pax-ape1');
  if (!isEmail(email))   { fieldErr('e-pax-email','pax-email','Inválido'); ok=false; } else fieldOk('e-pax-email','pax-email');
  if (email !== email2)  { fieldErr('e-pax-email2','pax-email2','No coinciden'); ok=false; } else fieldOk('e-pax-email2','pax-email2');
  if (!tel || !isPhone(tel)) { fieldErr('e-pax-tel','pax-tel','Teléfono inválido (solo dígitos, 6-15 caracteres)'); ok=false; } else fieldOk('e-pax-tel','pax-tel');
  if (!fnac)             { fieldErr('e-pax-fnac','pax-fnac','Requerido'); ok=false; } else fieldOk('e-pax-fnac','pax-fnac');
  if (!nac)              { fieldErr('e-pax-nac','pax-nac','Requerido'); ok=false; } else fieldOk('e-pax-nac','pax-nac');
  if (!tipdoc)           { fieldErr('e-pax-tipdoc','pax-tipdoc','Requerido'); ok=false; } else fieldOk('e-pax-tipdoc','pax-tipdoc');
  if (!numdoc)           { fieldErr('e-pax-numdoc','pax-numdoc','Requerido'); ok=false; } else fieldOk('e-pax-numdoc','pax-numdoc');
  if (!expdoc)           { fieldErr('e-pax-expdoc','pax-expdoc','Requerido'); ok=false; } else fieldOk('e-pax-expdoc','pax-expdoc');
  if (!ok) return;

  const pax = {
    nombre, apellido1: ape1, apellido2: val('pax-ape2').trim(),
    email, telefono: `${val('pax-pre')} ${tel}`,
    fnac, nacionalidad: nac, tipoDoc: tipdoc, numDoc: numdoc, expDoc: expdoc,
    isDriver: $('pax-conductor')?.checked || false,
  };

  // Si se marcó como conductor, quitar conductor de los demás pasajeros
  if (pax.isDriver) {
    state.bookingWizard.passengers.forEach(p => p.isDriver = false);
  }

  // Si se marcó "guardar como frecuente", hacerlo ahora
  if ($('pax-frecuente')?.checked) {
    const newFp = { ...pax, id: Date.now() };
    state.frequentPassengers.push(newFp);
    showToast('success','Pasajero guardado','Se ha añadido a tus pasajeros frecuentes.');
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
  if (wz.withVehicle && !wz.passengers.some(p => p.isDriver)) {
    showToast('warning','Conductor requerido','Debes marcar al menos un pasajero como conductor del vehículo.');
    return;
  }
  if (wz.withVehicle) showWizStep4();
  else showWizStep5();
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
  const filtered = vehicles.filter(v =>
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

      <div style="margin-bottom:18px">
        <span class="form-sec-label">Cantidad de vehículos</span>
        <div class="vehicle-counter">
          <button type="button" class="counter-btn" onclick="changeVehicleCount(-1)" id="vc-minus">−</button>
          <div class="counter-value" id="vc-value">${wz.vehicles.length}</div>
          <button type="button" class="counter-btn" onclick="changeVehicleCount(1)" id="vc-plus">+</button>
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

  updateCounterBtns();
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
  </div>`;
}

function readVehicleBlock(idx) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles?.[idx]) return;
  const v = wz.vehicles[idx];
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

function removeVehicleBlock(idx) {
  const wz = state.bookingWizard;
  if (!wz?.vehicles) return;
  persistAllVehicleBlocks();
  wz.vehicles.splice(idx, 1);
  if (wz.vehicles.length === 0) wz.vehicles.push(emptyVehicleEntry());
  wz._vehicleCount = wz.vehicles.length;
  showWizStep4();
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
      if (isNaN(anc)||anc<=0) { fieldErr(`e-veh-anc-${idx}`, `veh-anc-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-anc-${idx}`, `veh-anc-${idx}`);
      if (isNaN(lar)||lar<=0) { fieldErr(`e-veh-lar-${idx}`, `veh-lar-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-lar-${idx}`, `veh-lar-${idx}`);
      if (isNaN(alt)||alt<=0) { fieldErr(`e-veh-alt-${idx}`, `veh-alt-${idx}`, 'Valor positivo requerido'); allOk = false; } else fieldOk(`e-veh-alt-${idx}`, `veh-alt-${idx}`);
    }
  });

  if (!allOk) return;

  wz.vehicles = wz.vehicles.map(v => ({
    marca: v.marca, modelo: v.modelo, matricula: v.matricula || '',
    ancho: parseFloat(v.ancho), largo: parseFloat(v.largo), alto: parseFloat(v.alto),
  }));
  wz.vehicle = wz.vehicles[0];
  wz._vehicleCount = wz.vehicles.length;
  showWizStep5();
}

// ── Paso 5: Resumen y confirmación ───────────────────────────
function showWizStep5() {
  const wz = state.bookingWizard;
  if (!wz || !wz.passengers || wz.passengers.length === 0) return;
  renderWizStepBar(wz.withVehicle ? 5 : 4, wz.withVehicle);
  const content = $('wiz-content');
  if (!content) return;
  const pax = wz.passengers[0];
  const veh = wz.vehicle;
  const sail = wz.selectedSailing;
  const tripTypeLabel = wz.tripType === 'idayvuelta' ? 'Ida y vuelta' : 'Ida';

  const nacMap = { ES:'Española',FR:'Francesa',IT:'Italiana',PT:'Portuguesa',UK:'Británica',DE:'Alemana',MA:'Marroquí',OTHER:'Otra' };

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="width:auto;flex-shrink:0" onclick="${wz.withVehicle ? 'showWizStep4()' : 'showWizStep3()'}">
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
        ${wz.vehicles.map((vh, i) => `
          <div style="${i > 0 ? 'margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)' : ''}">
            <div style="font-weight:600;font-size:0.875rem;margin-bottom:6px">${i + 1}. ${esc(vh.marca||'')} ${esc(vh.modelo||'')}${vh.matricula ? ` · ${esc(vh.matricula)}` : ''}</div>
            <div class="wiz-summary-grid">
              <div class="wiz-summary-row"><span class="wiz-sum-label">Dimensiones</span><span class="wiz-sum-val">${vh.largo}m × ${vh.ancho}m × ${vh.alto}m (L × A × H)</span></div>
            </div>
          </div>
        `).join('')}
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
        </div>
      </div>` : '')}

      ${wz.petDetails ? `
      <!-- Bloque: Mascota -->
      <div class="wiz-summary-block">
        <div class="wiz-summary-block-title">🐾 Mascota</div>
        <div class="wiz-summary-grid">
          <div class="wiz-summary-row"><span class="wiz-sum-label">Número</span><span class="wiz-sum-val">${wz.petDetails.num}</span></div>
          ${wz.petDetails.raza ? `<div class="wiz-summary-row"><span class="wiz-sum-label">Tipo / Raza</span><span class="wiz-sum-val">${esc(wz.petDetails.raza)}</span></div>` : ''}
        </div>
      </div>` : ''}

      <form id="wiz-confirm-form" onsubmit="doFinalizeBooking(event)" novalidate>
        <div style="margin:16px 0 20px${state.frequentPassengers.find(p => p.numDoc === pax.numDoc) ? ';display:none' : ''}" id="guardar-frecuente-wrap">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.875rem;font-weight:500;color:var(--gray-700)">
            <input type="checkbox" id="pax-frecuente" style="width:17px;height:17px;accent-color:var(--primary)">
            Guardar pasajero como frecuente para futuras reservas
          </label>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" style="width:auto" onclick="${wz.withVehicle ? 'showWizStep4()' : 'showWizStep3()'}">← Volver</button>
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
    petDetails:    wz.petDetails || null,
  };

  const confirmBtn = document.querySelector('#wiz-confirm-form button[type="submit"]');
  if (confirmBtn) confirmBtn.disabled = true;

  if (!wz.passengers || wz.passengers.length === 0) {
    showToast('error','Sin pasajeros','Añade al menos un pasajero antes de confirmar.');
    if (confirmBtn) confirmBtn.disabled = false;
    return;
  }

  try {
    // Crear reserva localmente (modo demo)
    const bookings = [];
    wz.passengers.forEach((pax) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const newBooking = {
        id,
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
        vehiclePlate: vehiclesList.length > 0 ? `${vehiclesList[0].marca} ${vehiclesList[0].modelo}` : null,
        createdAt: new Date().toISOString().slice(0, 10),
        paxNombre: pax.nombre || '',
        paxApellido1: pax.apellido1 || '',
        paxApellido2: pax.apellido2 || '',
        paxEmail: pax.email || '',
        paxTelefono: pax.telefono || '',
        paxTipoDoc: pax.tipoDoc || '',
        paxNumDoc: pax.numDoc || '',
        vehMarca: vehiclesList[0] ? vehiclesList[0].marca : '',
        vehModelo: vehiclesList[0] ? vehiclesList[0].modelo : '',
        vehMatricula: vehiclesList[0] ? (vehiclesList[0].matricula || '') : '',
        vehAncho: vehiclesList[0] ? (parseFloat(vehiclesList[0].ancho) || 0) : 0,
        vehLargo: vehiclesList[0] ? (parseFloat(vehiclesList[0].largo) || 0) : 0,
        vehAlto: vehiclesList[0] ? (parseFloat(vehiclesList[0].alto) || 0) : 0,
        withPet: wz.withPet ? 1 : 0,
        vehicleCount: vehiclesList.length,
        passengerData: pax,
        vehicleData: vehiclesList[0] || null,
      };
      bookings.push(newBooking);
    });
    state.bookings.unshift(...bookings);
    state.lastCreatedBookingId = bookings[0].id;

    if ($('pax-frecuente')?.checked) {
      const pax = wz.passengers[0];
      const exists = state.frequentPassengers.find(p => p.numDoc === pax.numDoc);
      if (!exists) {
        state.frequentPassengers.push({ ...pax, id: Date.now() });
        showToast('success','Pasajero guardado','Se ha guardado como pasajero frecuente.');
      }
    }
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
                    <span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}" id="estado-badge-${b.id}">
                      ${b.localizador ? 'Activo' : 'Pendiente'}
                    </span>
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
          <div class="bk-card ${b.id===newId?'bk-card-new':''}">
            <div class="bk-card-head">
              <div class="bk-card-route">${esc(b.origin||'')} → ${esc(b.destination||'')}</div>
              <div style="display:flex;align-items:center;gap:6px">
                ${b.id===newId ? '<span class="badge-new">Nuevo</span>' : ''}
                <span class="badge ${b.localizador ? 'badge-success' : 'badge-warning'}">${b.localizador ? 'Activo' : 'Pendiente'}</span>
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
                  style="width:130px;padding:5px 8px;height:32px;font-size:0.8125rem;font-family:monospace">
              </div>
            </div>
            <div class="bk-card-foot">
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
    </div>
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

  // Actualizar badges en DOM sin re-render completo
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
  renderViajes();
  showToast('success','Estado actualizado',`Reserva #${id} → ${estado}`);
}

function deleteBooking(id) {
  if (!confirm('¿Eliminar esta reserva? No se puede deshacer.')) return;
  state.bookings = state.bookings.filter(b=>b.id!==id);
  navigateTo('viajes');
  showToast('success','Reserva eliminada','La reserva ha sido eliminada del sistema.');
}

/* --- FACTURAS --- */
async function doAddInvoice(e) {
  e.preventDefault();
  const num = val('i-num');
  const fec = val('i-fec');
  const imp = parseFloat(val('i-imp'));
  const est = val('i-est');
  const fi  = $('i-file');
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
    id: Date.now(),
    numero: num,
    fecha: fec,
    importe: parseFloat(imp),
    estado: est,
    archivo: state._pendingInvoiceFile ? state._pendingInvoiceFile.name : null,
    booking_id: bid || null,
  };
  state.invoices.push(newInvoice);
  state._pendingInvoiceFile = null;
  navigateTo('facturas');
  showToast('success','Factura registrada',`${num} — €${imp} añadida correctamente.`);
}

function deleteInvoice(id) {
  if (!confirm('¿Eliminar esta factura?')) return;
  state.invoices = state.invoices.filter(i=>i.id!==id);
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
    id: Date.now(),
    nombre: nom,
    apellido: ape,
    dni,
    telefono: `${pre} ${tel}`,
    fechaNacimiento: fnac,
    fechaExpiracion: fexp,
  };
  state.members.push(newMember);
  navigateTo('miembros');
  showToast('success','Miembro registrado',`${nom} ${ape} ha sido añadido correctamente.`);
}

function deleteMember(id) {
  if (!confirm('¿Eliminar este miembro?')) return;
  state.members = state.members.filter(m=>m.id!==id);
  navigateTo('miembros');
  showToast('success','Miembro eliminado','El miembro ha sido eliminado del sistema.');
}

/* --- VEHÍCULOS --- */
async function doAddVehicle(e) {
  e.preventDefault();
  const mar = val('v-mar').trim();
  const mod = val('v-mod').trim();
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
    id: Date.now(),
    marca: mar,
    modelo: mod,
    ancho: anc,
    largo: lar,
    alto: alt,
  };
  state.vehicles.push(newVeh);
  navigateTo('vehiculos');
  showToast('success','Vehículo añadido',`${mar} ${mod} registrado en la flota.`);
}

function deleteVehicle(id) {
  if (!confirm('¿Eliminar este vehículo de la flota?')) return;
  state.vehicles = state.vehicles.filter(v=>v.id!==id);
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

  const newId = Date.now();
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  state.pendingAdmin = { email, usuario, id: newId, token };
  state.admins.push({ id: newId, nombre: usuario, email, usuario, activo: false,
                      fecha: new Date().toISOString().split('T')[0], acciones: 'Invitación enviada' });

  $('ia-email').value = '';
  $('ia-user').value  = '';

  const banner = $('inv-success');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="success-banner">
        <div class="success-banner-title">✓ Invitación registrada en el backend</div>
        <div class="success-banner-sub">Enlace de activación generado para <strong>${esc(email)}</strong>. El usuario deberá crear su contraseña para activar la cuenta.</div>
        <button class="btn btn-success btn-sm" onclick="goSetPassword()">Simular activación →</button>
      </div>
    `;
  }
  showToast('success','Invitación enviada',`Enlace de activación generado para ${email}`);
}

function goSetPassword() {
  showPage('set-password');
}

async function handleSetPassword(e) {
  e.preventDefault();
  const pwd = val('new-pwd');
  const rep = val('rep-pwd');
  let ok = true;

  if (!pwd||pwd.length<8) { fieldErr('err-new-pwd','new-pwd','La contraseña debe tener al menos 8 caracteres'); ok=false; } else fieldOk('err-new-pwd','new-pwd');
  if (pwd!==rep) { fieldErr('err-rep-pwd','rep-pwd','Las contraseñas no coinciden'); ok=false; } else fieldOk('err-rep-pwd','rep-pwd');
  if (!ok) return;

  if (state.pendingAdmin) {
    const { id } = state.pendingAdmin;
    const a = state.admins.find(a => a.id === id);
    if (a) { a.activo = true; a.acciones = 'Cuenta recién activada'; }
    state.pendingAdmin = null;
  }

  showPage('dashboard');
  navigateTo('administradores');
  showToast('success','¡Cuenta activada!','La cuenta de administrador ha sido activada correctamente.');
}

function toggleAdmin(id, active) {
  const a = state.admins.find(a=>a.id===id);
  if (!a) return;
  a.activo = active;
  showToast('success','Estado actualizado',`${a.nombre} está ahora ${active?'activo':'inactivo'}.`);
  setTimeout(()=>navigateTo('administradores'), 80);
}

function deleteAdmin(id) {
  if (id===1) { showToast('error','No permitido','No se puede eliminar al administrador principal.'); return; }
  if (!confirm('¿Eliminar este administrador?')) return;
  state.admins = state.admins.filter(a=>a.id!==id);
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
  } else {
    gida.style.cssText='opacity:1;pointer-events:auto';
    gvue.style.cssText='opacity:1;pointer-events:auto';
    // Ensure min date on vuelta is set if ida is already selected
    const idaEl = $('h-fecha-ida'), vuelEl = $('h-fecha-vuelta');
    if (idaEl?.value && vuelEl) { vuelEl.min = idaEl.value; }
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
  showWizStep4();
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
              <div style="font-weight:600;font-size:0.875rem;margin-bottom:4px">${idx + 1}. ${esc(p.paxNombre)} ${esc(p.paxApellido1)}</div>
              <div style="font-size:0.8125rem;color:var(--gray-500)">
                ${esc(p.paxTipoDoc)}: ${esc(p.paxNumDoc)} · ${esc(p.paxEmail)}
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

      ${b.withPet ? `
      <div class="modal-section">
        <div class="modal-section-title">🐾 Mascota</div>
        <div class="modal-detail-grid">
          <div class="modal-detail-item"><div class="modal-detail-label">Cantidad</div><div class="modal-detail-value">${b.petNum||1}</div></div>
          ${b.petRaza ? `<div class="modal-detail-item"><div class="modal-detail-label">Raza</div><div class="modal-detail-value">${esc(b.petRaza)}</div></div>` : ''}
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
          <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="em-email" value="${esc(m.email||'')}"></div>
          <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-input" id="em-tel" value="${esc(m.telefono||'')}"></div>
          <div class="form-group"><label class="form-label">Nacionalidad</label><input type="text" class="form-input" id="em-nac" value="${esc(m.nacionalidad||'')}"></div>
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

function submitEditMember(e, id) {
  e.preventDefault();
  const idx = state.members.findIndex(m => m.id === id);
  if (idx >= 0) {
    const ape1 = val('em-ape1');
    const ape2 = val('em-ape2');
    state.members[idx] = {
      ...state.members[idx],
      nombre: val('em-nombre'),
      apellido: `${ape1}${ape2 ? ' ' + ape2 : ''}`,
      apellido1: ape1,
      apellido2: ape2,
      email: val('em-email'),
      telefono: val('em-tel'),
      nacionalidad: val('em-nac'),
    };
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
    state.vehicles[idx] = {
      ...state.vehicles[idx],
      marca: val('ev-marca'),
      modelo: val('ev-modelo'),
      matricula: val('ev-mat'),
      ancho, largo, alto,
    };
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
    state.bookings[idx] = {
      ...state.bookings[idx],
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
    state.invoices[idx] = {
      ...state.invoices[idx],
      numero:  val('ei-num'),
      fecha:   val('ei-fec'),
      importe: parseFloat(val('ei-imp')) || 0,
      estado:  val('ei-est'),
    };
  }
  closeBookingModal();
  navigateTo(state.currentSection);
  showToast('success', 'Factura actualizada', `Guardada correctamente.`);
}


