/* ============================================================
   ALSA — app.js
   Búsqueda de rutas y horarios
   ============================================================ */

'use strict';

const API_BASE = '/api';

async function api(method, path, data = null) {
  const opts = { method, credentials: 'same-origin' };
  if (data !== null) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body    = JSON.stringify(data);
  }
  const res  = await fetch(API_BASE + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status} en ${path}`);
  return json;
}

const state = {
  routes: [],
  searchResults: [],
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadRoutes();
});

// ============================================================
// ROUTES
// ============================================================
async function loadRoutes() {
  try {
    const data = await api('GET', '/routes');
    state.routes = Array.isArray(data) ? data : (data.data || data.routes || []);
  } catch (err) {
    state.routes = [];
    console.error('Routes API error:', err.message);
  }
}

function getPortsFromRoute(r) {
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

  const seen = new Set();
  const uniquePorts = [];
  for (const r of state.routes) {
    const { depId, depName, dstId, dstName } = getPortsFromRoute(r);

    if (side === 'destino') {
      if (!selectedOrigenId) continue;
      if (String(depId) !== String(selectedOrigenId)) continue;
      if (String(dstId) === String(selectedOrigenId)) continue;
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

// ============================================================
// SEARCH
// ============================================================
let _searchInProgress = false;
async function doSearchSailings() {
  if (_searchInProgress) return;
  const origenId    = val('h-origen-id');
  const destinoId   = val('h-destino-id');
  const origenNm    = val('h-origen');
  const destinoNm   = val('h-destino');
  const fechaIda    = val('h-fecha-ida');
  const _tripText   = document.querySelector('#home-seg .seg-btn.active')?.textContent.trim() || 'Ida';
  const _tripMap    = { 'Ida': 'ida', 'Ida y vuelta': 'idayvuelta' };
  const tripType    = _tripMap[_tripText] || 'ida';
  let isOk = true;

  if (!origenId || !origenNm) { fieldErr('e-origen','h-origen','Selecciona un puerto de origen'); isOk=false; } else fieldOk('e-origen','h-origen');
  if (!destinoId|| !destinoNm){ fieldErr('e-destino','h-destino','Selecciona un puerto de destino'); isOk=false; } else fieldOk('e-destino','h-destino');
  if (!fechaIda) { fieldErr('e-fecha-ida','h-fecha-ida','La fecha de ida es obligatoria'); isOk=false; } else fieldOk('e-fecha-ida','h-fecha-ida');
  if (!isOk) return;

  // Loading
  const content = $('results-area');
  if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
    <div class="loading-row" style="justify-content:center;margin-bottom:8px">
      <div class="loading-spinner"></div>
      <span>Consultando navieras disponibles…</span>
    </div>
    <div style="font-size:0.8125rem;color:var(--gray-400)">${esc(origenNm)} → ${esc(destinoNm)} · ${esc(fechaIda)}</div>
  </div>`;

  _searchInProgress = true;
  try {
    const route = (state.routes || []).find(r => {
      const { depId, dstId } = getPortsFromRoute(r);
      return Number(depId) === Number(origenId) && Number(dstId) === Number(destinoId);
    });
    if (!route) throw new Error('No se encontró una ruta para el origen y destino seleccionados.');

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
      </div>`;
      return;
    }
    showResults(origenNm, destinoNm, fechaIda, combined);
  } catch(err) {
    if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
      <div style="color:var(--danger);font-weight:700;margin-bottom:8px">Error al consultar disponibilidad</div>
      <div style="color:var(--gray-400);font-size:0.875rem;margin-bottom:20px">${esc(err.message)}</div>
    </div>`;
  } finally {
    _searchInProgress = false;
  }
}

function showResults(origenNm, destinoNm, fechaIda, combined) {
  const content = $('results-area');
  if (!content) return;
  content.innerHTML = `<div class="card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700;font-size:0.9375rem;color:var(--gray-900)">${esc(origenNm)} → ${esc(destinoNm)}</div>
        <div style="font-size:0.8125rem;color:var(--gray-400)">${fmtDateShort(fechaIda)} · ${combined.length} opción${combined.length!==1?'es':''}</div>
      </div>
    </div>
    ${combined.map((r,i) => `
      <div class="sailing-row">
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
      </div>
    `).join('')}
  </div>`;
}

// ============================================================
// UI HELPERS
// ============================================================
function $(id) { return document.getElementById(id); }
function val(id) { const el = $(id); return el ? el.value.trim() : ''; }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function selectTripType(type, btn) {
  document.querySelectorAll('#home-seg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const vuelta = $('g-vuelta');
  if (vuelta) vuelta.style.cssText = type === 'idayvuelta' ? '' : 'opacity:0.4;pointer-events:none';
}

function fieldErr(errId, inputId, msg) {
  const errEl = $(errId), inp = $(inputId);
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  if (inp) inp.classList.add('input-error');
}

function fieldOk(errId, inputId) {
  const errEl = $(errId), inp = $(inputId);
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (inp) inp.classList.remove('input-error');
}

function fmtDateShort(d) {
  if (!d) return '';
  const parts = d.includes('-') ? d.split('-') : d.split('/');
  if (parts.length !== 3) return d;
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const m = parseInt(parts[1]) - 1;
  return `${parseInt(parts[2])} ${months[m] || ''} ${parts[0]}`;
}

function getNavieraLogo(name, size) {
  const n = (name || '').toLowerCase();
  if (n.includes('balearia') || n.includes('baleària')) return `<img src="img/LOBO-BALEARIA.png" alt="Baleària" class="naviera-logo-${size}">`;
  if (n.includes('trasmediterránea') || n.includes('trasmed')) return `<img src="img/Trasmed_logo.png" alt="Trasmediterránea" class="naviera-logo-${size}">`;
  if (n.includes('frs')) return `<img src="img/Logo_FRS.svg.png" alt="FRS" class="naviera-logo-${size}">`;
  if (n.includes('gnv') || n.includes('grandi navi')) return `<img src="img/GNV_logo.svg.png" alt="GNV" class="naviera-logo-${size}">`;
  if (n.includes('armas')) return `<img src="img/Armas_logo.png" alt="Armas" class="naviera-logo-${size}">`;
  return `<div class="naviera-placeholder-${size}">${esc(name).slice(0,2).toUpperCase()}</div>`;
}
