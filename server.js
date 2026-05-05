/* ============================================================
   ALSA — server.js
   Servidor Node.js + Express — Rutas y Horarios
   ============================================================ */

'use strict';

require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// EMAIL — nodemailer + Gmail
// ============================================================
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

async function sendBookingEmail(booking) {
  if (!booking) return;
  const b = booking;
  const idaVuelta = b.tripType === 'idayvuelta';

  const vehiclesList = b.vehicles || (b.vehicle ? [b.vehicle] : []);

  // ── VEHÍCULOS: cada campo del formulario en su propia fila ──
  const vehiclesHtml = vehiclesList.length > 0
    ? vehiclesList.map((v, i) => `
      <tr><td colspan="2" style="padding:10px 0 4px;font-weight:700;font-size:14px;color:#1a56db">Vehículo ${i + 1}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:35%">Marca</td><td style="padding:4px 0;font-weight:600">${v.marca || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Modelo</td><td style="padding:4px 0;font-weight:600">${v.modelo || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Matrícula</td><td style="padding:4px 0;font-weight:600">${v.matricula || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Largo</td><td style="padding:4px 0">${v.largo || ''} m</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Ancho</td><td style="padding:4px 0">${v.ancho || ''} m</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Alto</td><td style="padding:4px 0">${v.alto || ''} m</td></tr>
    `).join('')
    : '<tr><td colspan="2" style="padding:6px 0;color:#6b7280">Sin vehículo</td></tr>';

  // ── PASAJEROS: todos los datos del formulario, fila por fila ──
  const passengersHtml = (b.passengers || []).map((p, i) => `
    <tr><td colspan="2" style="padding:10px 0 4px;font-weight:700;font-size:14px;color:#1a56db">Pasajero ${i + 1}${p.isDriver ? ' — Conductor' : ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;width:35%">Nombre</td><td style="padding:4px 0;font-weight:600">${p.nombre || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Primer apellido</td><td style="padding:4px 0">${p.apellido1 || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Segundo apellido</td><td style="padding:4px 0">${p.apellido2 || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Tipo de documento</td><td style="padding:4px 0">${p.tipoDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Número de documento</td><td style="padding:4px 0;font-weight:600">${p.numDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Fecha de expiración</td><td style="padding:4px 0">${p.expDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0">${p.email || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Teléfono</td><td style="padding:4px 0">${p.telefono || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Fecha de nacimiento</td><td style="padding:4px 0">${p.fnac || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Nacionalidad</td><td style="padding:4px 0">${p.nacionalidad || ''}</td></tr>
  `).join('');

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff">
  <div style="background:linear-gradient(135deg,#1a56db,#2563eb);padding:28px;text-align:center">
    <h1 style="color:white;font-size:22px;margin:0">ALSA — Nueva Reserva</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${b.origin || ''} → ${b.destination || ''}</p>
  </div>
  <div style="padding:24px">

    <h3 style="color:#1a56db;margin-top:0;border-bottom:1px solid #eee;padding-bottom:8px;font-size:15px">Detalles del Viaje</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:6px 0;color:#6b7280;width:35%">Tipo de viaje</td><td style="padding:6px 0;font-weight:600">${idaVuelta ? 'Ida y vuelta' : 'Solo ida'}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Origen</td><td style="padding:6px 0;font-weight:600">${b.origin || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Destino</td><td style="padding:6px 0;font-weight:600">${b.destination || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Naviera</td><td style="padding:6px 0;font-weight:600">${b.naviera || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Fecha de salida</td><td style="padding:6px 0;font-weight:600">${b.departureDate || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Hora de salida</td><td style="padding:6px 0;font-weight:600">${b.departureTime || ''}</td></tr>
      ${idaVuelta ? `
      <tr><td style="padding:6px 0;color:#6b7280">Fecha de vuelta</td><td style="padding:6px 0;font-weight:600">${b.returnDate || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Hora de vuelta</td><td style="padding:6px 0;font-weight:600">${b.returnTime || ''}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#6b7280">Estado</td><td style="padding:6px 0;font-weight:600">${b.estado || 'Pendiente'}</td></tr>
    </table>

    <h3 style="color:#1a56db;border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px;font-size:15px">Pasajeros (${(b.passengers || []).length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${passengersHtml}
    </table>

    <h3 style="color:#1a56db;border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px;font-size:15px">Vehículos (${vehiclesList.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${vehiclesHtml}
    </table>

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#9ca3af;font-size:12px;text-align:center">
      Reserva creada el ${new Date().toISOString().slice(0, 10)}<br>
      ALSA — Sistema de Gestión de Agencias
    </div>
  </div>
</div>`;

  await mailer.sendMail({
    from: `"ALSA Reservas" <${process.env.GMAIL_USER}>`,
    to:   process.env.NOTIFICATION_EMAIL || process.env.GMAIL_USER,
    subject: `[ALSA] Nueva reserva — ${b.origin || ''} → ${b.destination || ''} · ${b.naviera || ''} · ${b.departureDate || ''}`,
    html,
  });
}

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HELPERS
// ============================================================
function ok(res, data, status = 200) {
  res.status(status).json(data);
}

function fail(res, message, status = 400) {
  res.status(status).json({ error: message });
}

function isValidDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '');
}

// ============================================================
// KIKOTO API PROXY
// ============================================================
const KIKOTO_API_BASE = process.env.KIKOTO_API_BASE || 'https://api.b2b.kikoto.com/v1';
const KIKOTO_API_TOKEN = process.env.KIKOTO_API_TOKEN || '';

async function fetchKikoto(path) {
  if (!KIKOTO_API_TOKEN) {
    console.warn(`[KIKOTO API] No token configured for ${path}. Using empty data.`);
    return { data: [] };
  }
  try {
    const res = await fetch(`${KIKOTO_API_BASE}${path}`, {
      headers: {
        'Authorization': `Bearer ${KIKOTO_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[KIKOTO API] Error fetching ${path}:`, err.message);
    return { data: [] };
  }
}

async function fetchKikotoPost(path, body) {
  if (!KIKOTO_API_TOKEN) {
    console.warn(`[KIKOTO API] No token configured for ${path}. Using empty data.`);
    return { data: [] };
  }
  try {
    const res = await fetch(`${KIKOTO_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIKOTO_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[KIKOTO API] Error fetching ${path}:`, err.message);
    return { data: [] };
  }
}

let routesCache = null, routesCacheTime = 0;
let routesRawCache = null, routesRawCacheTime = 0;

// ============================================================
// ROUTES
// ============================================================
app.get('/api/routes', async (_req, res) => {
  if (routesCache && Date.now() - routesCacheTime < 300000) return ok(res, routesCache);

  try {
    const routesRes = await fetchKikoto('/routes');
    const rawRoutes = routesRes.data || [];

    routesRawCache = rawRoutes;
    routesRawCacheTime = Date.now();

    const mappedRoutes = rawRoutes.map(r => {
      const parts = (r.name || '').split(' - ').map(s => s.trim());
      return {
        id: r.id,
        name: r.name,
        departure_port:   { id: r.departure_port_id,   name: parts[0] || 'Unknown' },
        destination_port: { id: r.destination_port_id, name: parts[1] || 'Unknown' },
      };
    });

    routesCache = mappedRoutes;
    routesCacheTime = Date.now();
    ok(res, routesCache);
  } catch (err) {
    console.error('[ROUTES] Error:', err.message);
    ok(res, []);
  }
});

// ============================================================
// TIMETABLES
// ============================================================
app.post('/api/timetables', async (req, res) => {
  const { departure_port_id, destination_port_id, date } = req.body;
  if (!departure_port_id || !destination_port_id || !date)
    return fail(res, 'departure_port_id, destination_port_id y date son obligatorios.');
  if (!isValidDate(date))
    return fail(res, 'Formato de fecha inválido (YYYY-MM-DD).');

  try {
    // Find route matching the port IDs
    let rawRoutes = routesRawCache;
    if (!rawRoutes || Date.now() - routesRawCacheTime > 300000) {
      const routesRes = await fetchKikoto('/routes');
      rawRoutes = routesRes.data || [];
    }

    const route = rawRoutes.find(r =>
      r.departure_port_id == departure_port_id &&
      r.destination_port_id == destination_port_id
    );
    if (!route) return ok(res, []);

    const companiesRes = await fetchKikoto(`/routes/${route.id}/shipping-companies`);
    const companies = (companiesRes.data || []).map(c => ({ id: c.id, name: c.name }));

    if (companies.length === 0) return ok(res, []);

    const perCompany = await Promise.all(companies.map(async c => {
      try {
        const tt = await fetchKikotoPost(`/timetables?shipping-company=${c.id}`, {
          departure_port_id: Number(departure_port_id),
          destination_port_id: Number(destination_port_id),
          date,
        });
        const items = tt.data || [];
        return items.map(t => {
          const dt = t.departure_datetime || '';
          return {
            naviera_id:    c.id,
            naviera:       c.name,
            date:          dt.slice(0, 10) || date,
            departureTime: dt.slice(11, 16) || '—',
            raw:           t,
          };
        });
      } catch (err) {
        console.error(`[TIMETABLES] company ${c.id}:`, err.message);
        return [];
      }
    }));

    ok(res, perCompany.flat());
  } catch (err) {
    console.error('[TIMETABLES] Error:', err.message);
    fail(res, 'Error al obtener horarios: ' + err.message, 500);
  }
});

// ============================================================
// BOOKING NOTIFICATION — envía email al confirmar reserva
// ============================================================
app.post('/api/bookings/notify', async (req, res) => {
  const b = req.body;
  if (!b || !b.origin || !b.destination) {
    return fail(res, 'Datos de reserva incompletos.');
  }

  try {
    await sendBookingEmail(b);
    ok(res, { message: 'Correo enviado correctamente.' });
  } catch (err) {
    console.error('[EMAIL] Error al enviar:', err.message);
    fail(res, 'Error al enviar el correo: ' + err.message, 500);
  }
});

// ============================================================
// ERROR HANDLER
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err) return fail(res, err.message || 'Error interno.', 500);
});

// ============================================================
// ARRANCAR SERVIDOR
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   ALSA — Rutas y Horarios                ║`);
    console.log(`  ║   Node.js + Express                     ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║   http://localhost:${PORT}                   ║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
  });
}

module.exports = app;
