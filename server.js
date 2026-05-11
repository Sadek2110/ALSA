/* ============================================================
   ALSA — server.js
   Servidor Node.js + Express — Rutas y Horarios
   ============================================================ */

'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
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
  const passengersList = b.passengers || [];

  // ── VEHÍCULOS: cada campo del formulario en su propia fila ──
  const vehiclesHtml = vehiclesList.length > 0
    ? vehiclesList.map((v, i) => {
        const driverIdx = v.driverPassengerIndex;
        const driverName = (typeof driverIdx === 'number' && passengersList[driverIdx])
          ? `${passengersList[driverIdx].nombre || ''} ${passengersList[driverIdx].apellido1 || ''}`.trim()
          : '';
        return `
      <tr><td colspan="2" style="padding:10px 0 4px;font-weight:700;font-size:14px;color:#1a56db">Vehículo ${i + 1}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:35%">Marca</td><td style="padding:4px 0;font-weight:600">${v.marca || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Modelo</td><td style="padding:4px 0;font-weight:600">${v.modelo || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Matrícula</td><td style="padding:4px 0;font-weight:600">${v.matricula || ''}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Largo</td><td style="padding:4px 0">${v.largo || ''} m</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Ancho</td><td style="padding:4px 0">${v.ancho || ''} m</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Alto</td><td style="padding:4px 0">${v.alto || ''} m</td></tr>
      ${driverName ? `<tr><td style="padding:4px 0;color:#6b7280">Conductor</td><td style="padding:4px 0;font-weight:600">${driverName}</td></tr>` : ''}
    `;
      }).join('')
    : '<tr><td colspan="2" style="padding:6px 0;color:#6b7280">Sin vehículo</td></tr>';

  // ── PASAJEROS: todos los datos del formulario, fila por fila ──
  const passengersHtml = passengersList.map((p, i) => {
    const drivenVehicleIdx = vehiclesList.findIndex(v => v.driverPassengerIndex === i);
    const driverLabel = p.isDriver
      ? (drivenVehicleIdx >= 0 ? ` — Conductor Del Vehículo ${drivenVehicleIdx + 1}` : ' — Conductor')
      : '';
    return `
    <tr><td colspan="2" style="padding:10px 0 4px;font-weight:700;font-size:14px;color:#1a56db">Pasajero ${i + 1}${driverLabel}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;width:35%">Nombre</td><td style="padding:4px 0;font-weight:600">${p.nombre || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Primer Apellido</td><td style="padding:4px 0">${p.apellido1 || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Segundo Apellido</td><td style="padding:4px 0">${p.apellido2 || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Tipo De Documento</td><td style="padding:4px 0">${p.tipoDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Número De Documento</td><td style="padding:4px 0;font-weight:600">${p.numDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Fecha De Expiración</td><td style="padding:4px 0">${p.expDoc || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0">${p.email || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Teléfono</td><td style="padding:4px 0">${p.telefono || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Fecha De Nacimiento</td><td style="padding:4px 0">${p.fnac || ''}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Nacionalidad</td><td style="padding:4px 0">${p.nacionalidad || ''}</td></tr>
  `;
  }).join('');

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff">
  <div style="background:linear-gradient(135deg,#1a56db,#2563eb);padding:28px;text-align:center">
    <h1 style="color:white;font-size:22px;margin:0">ALSA — Nueva Reserva</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${b.origin || ''} → ${b.destination || ''}</p>
  </div>
  <div style="padding:24px">

    <h3 style="color:#1a56db;margin-top:0;border-bottom:1px solid #eee;padding-bottom:8px;font-size:15px">Detalles Del Viaje</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:6px 0;color:#6b7280;width:35%">Tipo De Viaje</td><td style="padding:6px 0;font-weight:600">${idaVuelta ? 'Ida y vuelta' : 'Solo ida'}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Origen</td><td style="padding:6px 0;font-weight:600">${b.origin || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Destino</td><td style="padding:6px 0;font-weight:600">${b.destination || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Naviera</td><td style="padding:6px 0;font-weight:600">${b.naviera || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Fecha De Salida</td><td style="padding:6px 0;font-weight:600">${b.departureDate || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Hora De Salida</td><td style="padding:6px 0;font-weight:600">${b.departureTime || ''}</td></tr>
      ${idaVuelta ? `
      <tr><td style="padding:6px 0;color:#6b7280">Fecha De Vuelta</td><td style="padding:6px 0;font-weight:600">${b.returnDate || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Hora De Vuelta</td><td style="padding:6px 0;font-weight:600">${b.returnTime || ''}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#6b7280">Estado</td><td style="padding:6px 0;font-weight:600">${b.estado || 'Pendiente'}</td></tr>
    </table>

    <h3 style="color:#1a56db;border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px;font-size:15px">Pasajeros (${passengersList.length})</h3>
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

async function sendInviteEmail(email, usuario, nombre, token) {
  const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const link = `${baseUrl}/set-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:30px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <tr><td style="background:linear-gradient(135deg,#1a56db,#2563eb);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">ALSA · Gestión de Agencias</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Hola${nombre ? ' ' + nombre : ''},</h2>
          <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6">
            <strong>${escHtml(email)}</strong> te ha invitado a formar parte del equipo de administración de ALSA como <strong>@${escHtml(usuario)}</strong>.
          </p>
          <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6">
            Haz clic en el botón de abajo para activar tu cuenta y crear tu contraseña. Este enlace expira en 48 horas.
          </p>
          <div style="text-align:center;margin-bottom:24px">
            <a href="${link}" style="display:inline-block;background:#1a56db;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Activar mi cuenta</a>
          </div>
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <span style="color:#6b7280">${link}</span>
          </p>
          <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">
            Si no solicitaste esta invitación, puedes ignorar este mensaje.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await mailer.sendMail({
    from: `"ALSA" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `[ALSA] Invitación al equipo de administración — @${usuario}`,
    html,
  });
}

function escHtml(text) {
  if (!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://alsa.kikoto.es'
    : ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── SPA route for activation page ──
app.get('/set-password', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT NOW() as now');
    ok(res, {
      status: 'ok',
      database: 'connected',
      timestamp: rows[0].now,
    });
  } catch (err) {
    fail(res, {
      status: 'error',
      database: 'disconnected',
      error: err.message,
    }, 503);
  }
});

// ============================================================
// DATA & CRUD — PostgreSQL
// ============================================================
app.get('/api/data', async (_req, res) => {
  try {
    const [bookings, members, vehicles, invoices, admins, fp] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('members'),
      db.getAll('vehicles'),
      db.getAll('invoices'),
      db.getAll('administrators'),
      db.getAll('frequent_passengers'),
    ]);
    ok(res, { bookings, members, vehicles, invoices, admins, frequentPassengers: fp });
  } catch (err) {
    console.error('[DATA] Error loading data:', err.message);
    fail(res, 'Error al cargar datos', 500);
  }
});

app.post('/api/bookings', async (req, res) => {
  try { const row = await db.insertRow('bookings', req.body); ok(res, row, 201); }
  catch (err) { console.error('[DB] booking insert:', err); fail(res, err.message, 400); }
});
app.put('/api/bookings/:id', async (req, res) => {
  try { const row = await db.updateRow('bookings', +req.params.id, req.body); row ? ok(res, row) : fail(res, 'Reserva no encontrada', 404); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/bookings/:id', async (req, res) => {
  try { const n = await db.deleteRow('bookings', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Reserva no encontrada', 404); }
  catch (err) { fail(res, err.message, 400); }
});

app.post('/api/members', async (req, res) => {
  try { const row = await db.insertRow('members', req.body); ok(res, row, 201); }
  catch (err) { fail(res, err.message, 400); }
});
app.put('/api/members/:id', async (req, res) => {
  try { const row = await db.updateRow('members', +req.params.id, req.body); row ? ok(res, row) : fail(res, 'Miembro no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/members/:id', async (req, res) => {
  try { const n = await db.deleteRow('members', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Miembro no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});

app.post('/api/vehicles', async (req, res) => {
  try { const row = await db.insertRow('vehicles', req.body); ok(res, row, 201); }
  catch (err) { fail(res, err.message, 400); }
});
app.put('/api/vehicles/:id', async (req, res) => {
  try { const row = await db.updateRow('vehicles', +req.params.id, req.body); row ? ok(res, row) : fail(res, 'Vehículo no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/vehicles/:id', async (req, res) => {
  try { const n = await db.deleteRow('vehicles', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Vehículo no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});

app.post('/api/invoices', async (req, res) => {
  try { const row = await db.insertRow('invoices', req.body); ok(res, row, 201); }
  catch (err) { fail(res, err.message, 400); }
});
app.put('/api/invoices/:id', async (req, res) => {
  try { const row = await db.updateRow('invoices', +req.params.id, req.body); row ? ok(res, row) : fail(res, 'Factura no encontrada', 404); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/invoices/:id', async (req, res) => {
  try { const n = await db.deleteRow('invoices', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Factura no encontrada', 404); }
  catch (err) { fail(res, err.message, 400); }
});

app.post('/api/administrators', async (req, res) => {
  try { const row = await db.insertRow('administrators', req.body); ok(res, row, 201); }
  catch (err) { fail(res, err.message, 400); }
});
app.put('/api/administrators/:id', async (req, res) => {
  try { const row = await db.updateRow('administrators', +req.params.id, req.body); row ? ok(res, row) : fail(res, 'Administrador no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/administrators/:id', async (req, res) => {
  try { const n = await db.deleteRow('administrators', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Administrador no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});

// ── INVITE ADMINISTRATOR (envía correo real) ──
app.post('/api/administrators/invite', async (req, res) => {
  try {
    const { email, usuario, nombre, inviterUserId } = req.body;

    // Solo el super_admin puede invitar
    if (!inviterUserId) return fail(res, 'No autorizado: se requiere identificación del administrador.', 403);
    const { rows: inviterRows } = await db.query('SELECT role FROM users WHERE id = $1 AND is_active = TRUE', [inviterUserId]);
    if (inviterRows.length === 0 || inviterRows[0].role !== 'super_admin') {
      return fail(res, 'Solo el administrador principal puede enviar invitaciones.', 403);
    }
    if (!email || !usuario) return fail(res, 'Email y usuario son obligatorios.', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'Email no válido.', 400);
    if (usuario.length < 3) return fail(res, 'El usuario debe tener al menos 3 caracteres.', 400);

    // Verificar email duplicado
    const { rows: dupEmail } = await db.query(
      'SELECT id FROM administrators WHERE email = $1 UNION ALL SELECT id FROM users WHERE email = $1', [email]
    );
    if (dupEmail.length > 0) return fail(res, 'Ya existe un administrador con ese email.', 409);

    // Verificar usuario duplicado
    const { rows: dupUser } = await db.query('SELECT id FROM administrators WHERE usuario = $1', [usuario]);
    if (dupUser.length > 0) return fail(res, 'Ya existe un administrador con ese nombre de usuario.', 409);

    const crypto = require('crypto');
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const row = await db.insertRow('administrators', {
      nombre: nombre || usuario,
      email,
      usuario,
      activo: false,
      fecha: new Date().toISOString().slice(0, 10),
      acciones: 'Invitación enviada',
      inviteToken: token,
      inviteTokenExpires: expires,
    });

    try {
      await sendInviteEmail(email, usuario, nombre || usuario, token);
    } catch (mailErr) {
      console.error('[EMAIL] Error enviando invitación:', mailErr.message);
      return fail(res, 'Administrador creado pero no se pudo enviar el correo. Intenta reenviar la invitación.', 500);
    }

    ok(res, row, 201);
  } catch (err) {
    console.error('[ADMIN INVITE]', err.message);
    fail(res, err.message, 400);
  }
});

// ── VALIDATE INVITATION TOKEN ──
app.get('/api/auth/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await db.query(
      'SELECT id, nombre, email, usuario, invite_token, invite_token_expires FROM administrators WHERE invite_token = $1',
      [token]
    );
    if (rows.length === 0) return fail(res, 'Token de invitación no encontrado.', 404);

    const admin = rows[0];
    if (new Date(admin.invite_token_expires) < new Date()) {
      return fail(res, 'El enlace de invitación ha expirado (48h). Solicita una nueva invitación.', 410);
    }

    ok(res, {
      nombre: admin.nombre,
      email: admin.email,
      usuario: admin.usuario,
    });
  } catch (err) {
    console.error('[INVITE VALIDATE]', err.message);
    fail(res, err.message, 400);
  }
});

// ── ACTIVATE ACCOUNT (set password) ──
app.post('/api/auth/activate', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return fail(res, 'Token y contraseña son obligatorios.', 400);
    if (password.length < 8) return fail(res, 'La contraseña debe tener al menos 8 caracteres.', 400);

    const { rows } = await db.query(
      'SELECT id, nombre, email, usuario, invite_token, invite_token_expires FROM administrators WHERE invite_token = $1',
      [token]
    );
    if (rows.length === 0) return fail(res, 'Token de invitación no encontrado.', 404);

    const admin = rows[0];
    if (new Date(admin.invite_token_expires) < new Date()) {
      return fail(res, 'El enlace de invitación ha expirado (48h). Solicita una nueva invitación.', 410);
    }

    // Verificar si ya existe un usuario con ese email
    const { rows: existingUser } = await db.query('SELECT id FROM users WHERE email = $1', [admin.email]);
    if (existingUser.length > 0) {
      return fail(res, 'Ya existe una cuenta de usuario con ese email.', 409);
    }

    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);

    // Crear usuario en tabla users
    await db.query(
      'INSERT INTO users (email, password_hash, nombre, role, is_active) VALUES ($1, $2, $3, $4, TRUE)',
      [admin.email, hash, admin.nombre, 'admin']
    );

    // Activar administrador y limpiar token
    await db.query(
      'UPDATE administrators SET activo = TRUE, invite_token = NULL, invite_token_expires = NULL, acciones = $1, updated_at = NOW() WHERE id = $2',
      ['Cuenta activada', admin.id]
    );

    ok(res, { message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.', email: admin.email });
  } catch (err) {
    console.error('[ACTIVATE]', err.message);
    fail(res, err.message, 400);
  }
});

app.post('/api/frequent-passengers', async (req, res) => {
  try { const row = await db.insertRow('frequent_passengers', req.body); ok(res, row, 201); }
  catch (err) { fail(res, err.message, 400); }
});
app.delete('/api/frequent-passengers/:id', async (req, res) => {
  try { const n = await db.deleteRow('frequent_passengers', +req.params.id); n ? ok(res, { deleted: n }) : fail(res, 'Pasajero no encontrado', 404); }
  catch (err) { fail(res, err.message, 400); }
});

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
// ROUTE AVAILABILITIES
// ============================================================
app.get('/api/routes/:id/availabilities', async (req, res) => {
  const routeId = req.params.id;
  if (!routeId) return fail(res, 'Route ID es obligatorio.');

  try {
    const availRes = await fetchKikoto(`/routes/${routeId}/availabilities`);
    const availabilities = availRes.data || availRes || [];
    ok(res, Array.isArray(availabilities) ? availabilities : []);
  } catch (err) {
    console.error('[AVAILABILITIES] Error:', err.message);
    fail(res, 'Error al obtener disponibilidades: ' + err.message, 500);
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
// DATABASE — PostgreSQL via db.js
// ============================================================
const db = require('./db');

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email y contraseña son obligatorios.');

    const bcrypt = require('bcryptjs');
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]);

    if (rows.length === 0) return fail(res, 'Credenciales incorrectas.', 401);

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password_hash)) return fail(res, 'Credenciales incorrectas.', 401);

    const { password_hash, ...safeUser } = user;
    ok(res, { user: safeUser });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    fail(res, 'Error interno de autenticación.', 500);
  }
});

// ============================================================
// BOOKINGS CRUD
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
  (async () => {
    try {
      await db.init();
    } catch (err) {
      console.error('[DB] Failed to initialize database:', err.message);
      process.exit(1);
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  ╔══════════════════════════════════════════╗`);
      console.log(`  ║   ALSA — Rutas y Horarios                ║`);
      console.log(`  ║   Node.js + Express + PostgreSQL         ║`);
      console.log(`  ╠══════════════════════════════════════════╣`);
      console.log(`  ║   http://0.0.0.0:${PORT}                   ║`);
      console.log(`  ╚══════════════════════════════════════════╝\n`);
    });
  })();
}

module.exports = app;
