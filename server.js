/* ============================================================
   KIKOTO — server.js
   Servidor Node.js + Express — base de datos JSON embebida
   Sin MySQL ni XAMPP ni dependencias nativas.
   Ejecutar: node server.js
   ============================================================ */

'use strict';

require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});

const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const nodemailer = require('nodemailer');

const store = require('./store');

// ============================================================
// EMAIL — nodemailer + SMTP Kikoto
// ============================================================
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.kikoto.es',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

async function sendBookingEmail(booking) {
  const b = booking;
  const veh = (b.veh_marca && b.veh_modelo)
    ? `${b.veh_marca} ${b.veh_modelo} — ${b.veh_largo}m × ${b.veh_ancho}m × ${b.veh_alto}m`
    : 'Sin vehículo';
  const pet = b.with_pet
    ? `Sí (${b.pet_num || 1} mascota${b.pet_num > 1 ? 's' : ''}${b.pet_raza ? ' · ' + b.pet_raza : ''})`
    : 'No';

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#288cfc;padding:24px;text-align:center">
    <img src="https://kikoto.es/img/logo.png" alt="Kikoto" style="height:40px;margin-bottom:8px">
    <div style="color:white;font-size:20px;font-weight:bold">KIKOTO FERRIES</div>
  </div>
  <div style="padding:24px">
    <h2 style="color:#1a56db;margin-top:0">Nueva reserva Kikoto #${b.id}</h2>
    <p>Se ha registrado una nueva solicitud de reserva desde el panel de agencias.</p>
    
    <h3 style="border-bottom:1px solid #eee;padding-bottom:8px">Detalles del Viaje</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6b7280">Tipo</td><td style="padding:8px 0;font-weight:600">${b.trip_type === 'idayvuelta' ? 'Ida y vuelta' : 'Ida'}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Ruta</td><td style="padding:8px 0;font-weight:600">${b.departure_port} → ${b.destination_port}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Naviera</td><td style="padding:8px 0;font-weight:600">${b.naviera}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Salida</td><td style="padding:8px 0;font-weight:600">${b.departure_date} ${b.departure_time || ''}</td></tr>
      ${b.return_date ? `<tr><td style="padding:8px 0;color:#6b7280">Vuelta</td><td style="padding:8px 0;font-weight:600">${b.return_date} ${b.return_time || ''}</td></tr>` : ''}
    </table>

    <h3 style="border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px">Pasajero Principal</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6b7280">Nombre</td><td style="padding:8px 0;font-weight:600">${b.pax_nombre} ${b.pax_apellido1}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;font-weight:600">${b.pax_email}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Documento</td><td style="padding:8px 0;font-weight:600">${b.pax_tipo_doc} ${b.pax_num_doc}</td></tr>
    </table>

    <h3 style="border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px">Vehículo</h3>
    <p style="margin:8px 0;font-weight:600">${veh}</p>
    ${b.veh_matricula ? `<p style="margin:4px 0;color:#6b7280">Matrícula: <span style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;color:#111827">${b.veh_matricula}</span></p>` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#9ca3af;font-size:12px;text-align:center">
      Reserva creada el ${b.created_at} — ID Grupo: ${b.group_id || 'N/A'}<br>
      © 2024 Kikoto Soluciones Tecnológicas S.L.
    </div>
  </div>
</div>`;

  await mailer.sendMail({
    from: `"Kikoto Reservas" <${process.env.SMTP_USER || 'noreply@kikoto.es'}>`,
    to:   'sadekjoud@gmail.com',
    subject: `[Kikoto] Nueva reserva #${b.id} — ${b.departure_port} → ${b.destination_port}`,
    html,
  });
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'kikoto-secret-2024-node',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true },
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// MULTER — subida de archivos de facturas
// ============================================================
const UPLOAD_DIR = path.join(process.env.DATA_DIR || __dirname, 'uploads', 'invoices');
const UPLOAD_ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    UPLOAD_ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Formato no permitido. Solo PDF, JPG o PNG.'));
  },
});

// ============================================================
// HELPERS
// ============================================================
const DEMO_EMAIL    = 'admin@kikoto.com';
const DEMO_PASSWORD = 'Admin123';

function requireAuth(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'No autenticado.' });
  next();
}

// La API devuelve los datos directamente (igual que la versión PHP)
function ok(res, data, status = 200) {
  res.status(status).json(data);
}

function fail(res, message, status = 400) {
  res.status(status).json({ error: message });
}

function logAction(type, entity, entityId, desc, adminId) {
  try {
    store.insert('admin_actions', {
      admin_id: adminId || null, action_type: type,
      entity_type: entity, entity_id: entityId,
      description: desc, ip_address: null,
    });
  } catch (_) {}
}

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ''); }
function isValidDni(v)   { return /^[0-9]{8}[A-Za-z]$/.test(v || ''); }
function isValidDate(v)  { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function isValidLoc(v)   { return /^[A-Z0-9]{1,10}$/.test(v || ''); }

// ============================================================
// AUTH — /api/auth/*
// ============================================================
app.post('/api/auth/login', (req, res) => {
  const email    = (req.body.email    || '').toLowerCase().trim();
  const password = (req.body.password || '');

  if (!email || !password) return fail(res, 'Email y contraseña son obligatorios.');
  if (!isValidEmail(email)) return fail(res, 'Formato de email incorrecto.');

  // Modo demo
  if (email === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
    req.session.adminId   = 1;
    req.session.adminName = 'Admin Principal';
    req.session.email     = DEMO_EMAIL;
    return ok(res, { id:1, nombre:'Admin Principal', email:DEMO_EMAIL, usuario:'admin', role:'super_admin' });
  }

  // Usuarios reales
  const user = store.find('users', u => u.email.toLowerCase() === email && u.is_active);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return fail(res, 'Credenciales incorrectas.', 401);
  }

  const admin = store.find('administrators', a => a.user_id === user.id && a.is_active);
  req.session.adminId   = admin ? admin.id : user.id;
  req.session.adminName = user.nombre;
  req.session.email     = user.email;

  if (admin) {
    store.update('administrators', a => a.id === admin.id, { last_login: store.now() });
  }
  logAction('LOGIN', 'users', user.id, 'Inicio de sesión exitoso', req.session.adminId);

  return ok(res, {
    id:      admin ? admin.id : user.id,
    nombre:  user.nombre,
    email:   user.email,
    usuario: admin ? admin.username : 'admin',
    role:    user.role,
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  ok(res, { message: 'Sesión cerrada.' });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.adminId) return fail(res, 'No autenticado.', 401);
  ok(res, { id: req.session.adminId, nombre: req.session.adminName || 'Admin', email: req.session.email || '' });
});

// ============================================================
// BOOKINGS — /api/bookings
// ============================================================
function bookingToJson(r) {
  return {
    id:            r.id,
    tripType:      r.trip_type,
    origin:        r.departure_port,
    destination:   r.destination_port,
    naviera:       r.naviera,
    departureDate: r.departure_date,
    departureTime: r.departure_time || '',
    returnDate:    r.return_date,
    returnTime:    r.return_time,
    localizador:   r.localizador || '',
    estado:        r.estado,
    passengerName: ((r.pax_nombre || '') + ' ' + (r.pax_apellido1 || '')).trim(),
    email:         r.pax_email || '',
    vehiclePlate:  (r.veh_marca && r.veh_modelo) ? `${r.veh_marca} ${r.veh_modelo}` : null,
    createdAt:     (r.created_at || '').slice(0, 10),
    // Flat fields for modal display
    paxNombre:     r.pax_nombre       || '',
    paxApellido1:  r.pax_apellido1    || '',
    paxApellido2:  r.pax_apellido2    || '',
    paxEmail:      r.pax_email        || '',
    paxTelefono:   r.pax_telefono     || '',
    paxTipoDoc:    r.pax_tipo_doc     || '',
    paxNumDoc:     r.pax_num_doc      || '',
    vehMarca:      r.veh_marca        || '',
    vehModelo:     r.veh_modelo       || '',
    vehMatricula:  r.veh_matricula    || '',
    vehAncho:      parseFloat(r.veh_ancho) || 0,
    vehLargo:      parseFloat(r.veh_largo) || 0,
    vehAlto:       parseFloat(r.veh_alto)  || 0,
    withPet:       r.with_pet || 0,
    petNum:        r.pet_num  || null,
    petRaza:       r.pet_raza || null,
    vehicleCount:  r.vehicle_count || (r.veh_marca ? 1 : 0),
    groupId:       r.group_id || null,
    passengerData: {
      nombre:       r.pax_nombre       || '',
      apellido1:    r.pax_apellido1    || '',
      apellido2:    r.pax_apellido2    || '',
      email:        r.pax_email        || '',
      telefono:     r.pax_telefono     || '',
      fnac:         r.pax_fnac         || '',
      nacionalidad: r.pax_nacionalidad || '',
      tipoDoc:      r.pax_tipo_doc     || '',
      numDoc:       r.pax_num_doc      || '',
      expDoc:       r.pax_exp_doc      || '',
    },
    vehicleData: r.veh_marca ? {
      marca:r.veh_marca, modelo:r.veh_modelo, matricula:r.veh_matricula||'',
      ancho:parseFloat(r.veh_ancho)||0, largo:parseFloat(r.veh_largo)||0, alto:parseFloat(r.veh_alto)||0,
    } : null,
    petDetails: r.with_pet ? { num:r.pet_num, raza:r.pet_raza } : null,
  };
}

app.get('/api/bookings', requireAuth, (_req, res) => {
  const rows = store.all('bookings').sort((a, b) => b.id - a.id);
  ok(res, rows.map(bookingToJson));
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const b = req.body;
  const errors = [];

  if (!b.tripType)                 errors.push('tripType requerido');
  if (!b.origin)                   errors.push('origin requerido');
  if (!b.destination)              errors.push('destination requerido');
  if (!b.naviera)                  errors.push('naviera requerido');
  if (!b.departureDate)            errors.push('departureDate requerido');
  
  const passengers = b.passengers || (b.passengerData ? [b.passengerData] : []);
  if (passengers.length === 0) {
    errors.push('Al menos un pasajero es requerido');
  } else {
    passengers.forEach((p, i) => {
      if (!p.nombre)    errors.push(`Nombre del pasajero ${i+1} requerido`);
      if (!p.apellido1) errors.push(`Apellido del pasajero ${i+1} requerido`);
      if (!p.email)     errors.push(`Email del pasajero ${i+1} requerido`);
      if (p.email && !isValidEmail(p.email)) errors.push(`Email del pasajero ${i+1} inválido`);
    });
  }

  if (!['ida','idayvuelta'].includes(b.tripType || '')) errors.push('tripType inválido (solo ida o idayvuelta)');
  if (b.origin && b.destination && b.origin.toLowerCase() === b.destination.toLowerCase()) {
    errors.push('El origen y el destino no pueden ser el mismo puerto');
  }
  if (errors.length) return fail(res, errors.join('; '));

  const veh = b.vehicleData   || null;
  const pet = b.petDetails    || null;
  const vehicleCount = parseInt(b.vehicleCount) || (veh ? 1 : 0);
  const groupId = b.groupId || `GRP-${Date.now()}`;

  const results = [];
  passengers.forEach((pax, idx) => {
    const row = store.insert('bookings', {
      trip_type: b.tripType, departure_port: b.origin, destination_port: b.destination,
      naviera: b.naviera, departure_date: b.departureDate, departure_time: b.departureTime || null,
      return_date: b.returnDate || null, return_time: b.returnTime || null,
      estado: 'Pendiente', localizador: null,
      pax_nombre: pax.nombre || '', pax_apellido1: pax.apellido1 || '', pax_apellido2: pax.apellido2 || null,
      pax_email: pax.email || '', pax_telefono: pax.telefono || null, pax_fnac: pax.fnac || null,
      pax_nacionalidad: pax.nacionalidad || null, pax_tipo_doc: pax.tipoDoc || null,
      pax_num_doc: (pax.numDoc || '').toUpperCase() || null, pax_exp_doc: pax.expDoc || null,
      veh_marca: idx === 0 ? (veh ? veh.marca : null) : null,
      veh_modelo: idx === 0 ? (veh ? veh.modelo : null) : null,
      veh_matricula: idx === 0 ? (veh ? (veh.matricula || null) : null) : null,
      veh_ancho: idx === 0 ? (veh ? parseFloat(veh.ancho) : null) : null,
      veh_largo: idx === 0 ? (veh ? parseFloat(veh.largo) : null) : null,
      veh_alto: idx === 0 ? (veh ? parseFloat(veh.alto) : null) : null,
      vehicle_count: idx === 0 ? vehicleCount : 0,
      group_id: groupId,
      with_pet: idx === 0 ? (pet ? 1 : 0) : 0,
      pet_num: idx === 0 ? (pet ? (pet.num || null) : null) : null,
      pet_raza: idx === 0 ? (pet ? (pet.raza || null) : null) : null,
      notification_email: 'admin@kikoto.com', created_by: req.session.adminId,
    });
    results.push(bookingToJson(row));
    if (idx === 0) {
      logAction('BOOKING_CREATE', 'bookings', row.id, `Reserva GRUPAL (${passengers.length} pax) ${b.origin} → ${b.destination}`, req.session.adminId);
      sendBookingEmail(row).catch(err => console.error('[EMAIL] Error al enviar:', err.message));
    }
  });

  ok(res, results[0], 201);
});

app.patch('/api/bookings/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const b  = req.body;

  if (Object.prototype.hasOwnProperty.call(b, 'localizador')) {
    const loc = (b.localizador || '').toUpperCase().trim();
    if (loc && !isValidLoc(loc)) return fail(res, 'Formato de localizador inválido (solo A-Z y 0-9, hasta 10 caracteres).');
    const estado = loc ? 'Confirmado' : 'Pendiente';
    const n = store.update('bookings', r => r.id === id, { localizador: loc || null, estado });
    if (!n) return fail(res, 'Reserva no encontrada.', 404);
    logAction('BOOKING_LOCALIZADOR', 'bookings', id, `Localizador actualizado: ${loc}`, req.session.adminId);
  }

  if (b.estado !== undefined) {
    if (!['Pendiente','Confirmado','Cancelado'].includes(b.estado)) return fail(res, 'Estado inválido.');
    store.update('bookings', r => r.id === id, { estado: b.estado });
  }

  const row = store.find('bookings', r => r.id === id);
  if (!row) return fail(res, 'Reserva no encontrada.', 404);
  ok(res, bookingToJson(row));
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const n  = store.remove('bookings', r => r.id === id);
  if (!n) return fail(res, 'Reserva no encontrada.', 404);
  logAction('DELETE', 'bookings', id, `Reserva #${id} eliminada`, req.session.adminId);
  ok(res, { message: 'Reserva eliminada.' });
});

// ============================================================
// MEMBERS — /api/members
// ============================================================
function memberToJson(r) {
  return {
    id: r.id, nombre: r.nombre,
    apellido: ((r.apellido1||'') + ' ' + (r.apellido2||'')).trim(),
    apellido1: r.apellido1||'', apellido2: r.apellido2||'',
    dni: r.dni, tipoDoc: r.tipo_doc, numDoc: r.num_doc, expDoc: r.exp_doc,
    email: r.email||'', telefonoPrefix: r.telefono_prefix||'',
    telefono: ((r.telefono_prefix||'') + ' ' + (r.telefono||'')).trim(),
    fechaNacimiento: r.fecha_nacimiento, fechaExpiracion: r.fecha_expiracion, nacionalidad: r.nacionalidad||'',
  };
}

app.get('/api/members', requireAuth, (_req, res) => {
  ok(res, store.all('members').sort((a,b) => a.id - b.id).map(memberToJson));
});

app.post('/api/members', requireAuth, (req, res) => {
  const b    = req.body;
  const nombre = (b.nombre||'').trim();
  const ape1   = (b.apellido1||b.apellido||'').trim();
  const ape2   = (b.apellido2||'').trim();
  const dni    = (b.dni||'').toUpperCase().trim();
  const pre    = (b.telefonoPrefix||b.prefijo||'+34').trim();
  const tel    = (b.telefono||'').trim();
  const fnac   = (b.fechaNacimiento||'').trim();
  const fexp   = (b.fechaExpiracion||'').trim();
  const nac    = (b.nacionalidad||'ES').trim();
  const email  = (b.email||'').trim();
  const tipDoc = (b.tipoDoc||'DNI').trim();
  const numDoc = (b.numDoc||dni).toUpperCase().trim();
  const expDoc = (b.expDoc||fexp).trim();

  const errors = [];
  if (!nombre)           errors.push('Nombre obligatorio');
  if (!ape1)             errors.push('Apellido obligatorio');
  if (!isValidDni(dni))  errors.push('DNI inválido (8 dígitos + letra)');
  if (!isValidDate(fnac)) errors.push('Fecha de nacimiento inválida');
  if (fexp && !isValidDate(fexp)) errors.push('Fecha de expiración inválida');
  if (fexp && fexp <= fnac) errors.push('La expiración debe ser posterior al nacimiento');
  if (email && !isValidEmail(email)) errors.push('Email inválido');
  if (errors.length) return fail(res, errors.join('; '));

  // Comprobar duplicados
  if (store.find('members', m => m.dni === dni)) return fail(res, 'Ya existe un miembro con ese DNI/documento.', 409);
  if (numDoc !== dni && store.find('members', m => m.num_doc === numDoc)) return fail(res, 'Ya existe un miembro con ese DNI/documento.', 409);

  const telNum = tel.replace(/^(\+\d{1,4})\s*/, '').trim();
  const row = store.insert('members', {
    nombre, apellido1: ape1, apellido2: ape2||null, dni, tipo_doc: tipDoc, num_doc: numDoc, exp_doc: expDoc||null,
    email: email||null, telefono_prefix: pre, telefono: telNum||tel,
    fecha_nacimiento: fnac, fecha_expiracion: fexp||null, nacionalidad: nac,
  });
  logAction('CREATE', 'members', row.id, `Alta miembro: ${nombre} ${ape1}`, req.session.adminId);
  ok(res, memberToJson(row), 201);
});

app.delete('/api/members/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const n  = store.remove('members', r => r.id === id);
  if (!n) return fail(res, 'Miembro no encontrado.', 404);
  logAction('DELETE', 'members', id, `Miembro #${id} eliminado`, req.session.adminId);
  ok(res, { message: 'Miembro eliminado.' });
});

app.put('/api/members/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = store.find('members', m => m.id === id);
  if (!existing) return fail(res, 'Miembro no encontrado.', 404);

  const b = req.body;
  const changes = {};
  if (b.nombre !== undefined)         changes.nombre = (b.nombre||'').trim();
  if (b.apellido1 !== undefined)      changes.apellido1 = (b.apellido1||'').trim();
  if (b.apellido2 !== undefined)      changes.apellido2 = (b.apellido2||'').trim() || null;
  if (b.dni !== undefined)            changes.dni = (b.dni||'').toUpperCase().trim();
  if (b.telefono !== undefined)       changes.telefono = (b.telefono||'').trim();
  if (b.telefonoPrefix !== undefined) changes.telefono_prefix = (b.telefonoPrefix||'').trim();
  if (b.email !== undefined)          changes.email = (b.email||'').trim() || null;
  if (b.fechaNacimiento !== undefined) changes.fecha_nacimiento = b.fechaNacimiento;
  if (b.fechaExpiracion !== undefined) changes.fecha_expiracion = b.fechaExpiracion;
  if (b.nacionalidad !== undefined)   changes.nacionalidad = (b.nacionalidad||'').trim();
  if (b.tipoDoc !== undefined)        changes.tipo_doc = (b.tipoDoc||'').trim();
  if (b.numDoc !== undefined)         changes.num_doc = (b.numDoc||'').toUpperCase().trim();
  if (b.expDoc !== undefined)         changes.exp_doc = (b.expDoc||'').trim() || null;

  // Validar DNI único si se cambia
  if (changes.dni && changes.dni !== existing.dni) {
    if (!isValidDni(changes.dni)) return fail(res, 'DNI inválido (8 dígitos + letra)');
    if (store.find('members', m => m.id !== id && m.dni === changes.dni)) return fail(res, 'Ya existe un miembro con ese DNI.', 409);
  }

  store.update('members', m => m.id === id, changes);
  logAction('UPDATE', 'members', id, `Miembro #${id} actualizado`, req.session.adminId);
  const updated = store.find('members', m => m.id === id);
  ok(res, memberToJson(updated));
});

// ============================================================
// VEHICLES — /api/vehicles
// ============================================================
function vehicleToJson(r) {
  return { id:r.id, marca:r.marca, modelo:r.modelo, matricula:r.matricula||'', ancho:parseFloat(r.ancho)||0, largo:parseFloat(r.largo)||0, alto:parseFloat(r.alto)||0 };
}

app.get('/api/vehicles', requireAuth, (_req, res) => {
  ok(res, store.all('vehicles', v => v.is_active).sort((a,b) => a.id - b.id).map(vehicleToJson));
});

app.post('/api/vehicles', requireAuth, (req, res) => {
  const mar = (req.body.marca ||'').trim();
  const mod = (req.body.modelo||'').trim();
  const anc = parseFloat(req.body.ancho)||0;
  const lar = parseFloat(req.body.largo)||0;
  const alt = parseFloat(req.body.alto) ||0;

  const errors = [];
  if (!mar)    errors.push('Marca obligatoria');
  if (!mod)    errors.push('Modelo obligatorio');
  if (anc <= 0) errors.push('Ancho debe ser mayor que 0');
  if (lar <= 0) errors.push('Largo debe ser mayor que 0');
  if (alt <= 0) errors.push('Alto debe ser mayor que 0');
  if (errors.length) return fail(res, errors.join('; '));

  const mat = (req.body.matricula||'').toUpperCase().trim();

  const row = store.insert('vehicles', { marca:mar, modelo:mod, matricula:mat||null, ancho:anc, largo:lar, alto:alt, is_active:1 });
  logAction('CREATE', 'vehicles', row.id, `Alta vehículo: ${mar} ${mod}${mat ? ' ['+mat+']' : ''}`, req.session.adminId);
  ok(res, vehicleToJson(row), 201);
});

app.put('/api/vehicles/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = store.find('vehicles', v => v.id === id);
  if (!existing) return fail(res, 'Vehículo no encontrado.', 404);

  const changes = {};
  if (req.body.marca !== undefined)     changes.marca = (req.body.marca||'').trim();
  if (req.body.modelo !== undefined)    changes.modelo = (req.body.modelo||'').trim();
  if (req.body.matricula !== undefined) changes.matricula = (req.body.matricula||'').toUpperCase().trim() || null;
  if (req.body.ancho !== undefined)     changes.ancho = parseFloat(req.body.ancho)||0;
  if (req.body.largo !== undefined)     changes.largo = parseFloat(req.body.largo)||0;
  if (req.body.alto !== undefined)      changes.alto = parseFloat(req.body.alto)||0;

  store.update('vehicles', v => v.id === id, changes);
  logAction('UPDATE', 'vehicles', id, `Vehículo #${id} actualizado`, req.session.adminId);
  const updated = store.find('vehicles', v => v.id === id);
  ok(res, vehicleToJson(updated));
});

app.delete('/api/vehicles/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const n  = store.update('vehicles', v => v.id === id, { is_active: 0 });
  if (!n) return fail(res, 'Vehículo no encontrado.', 404);
  logAction('DELETE', 'vehicles', id, `Vehículo #${id} desactivado`, req.session.adminId);
  ok(res, { message: 'Vehículo eliminado.' });
});

// ============================================================
// INVOICES — /api/invoices
// ============================================================
function invoiceToJson(r) {
  return { id:r.id, numero:r.invoice_number, fecha:r.fecha, importe:parseFloat(r.importe)||0, estado:r.estado, archivo:r.archivo_nombre };
}

app.get('/api/invoices', requireAuth, (_req, res) => {
  const rows = store.all('invoices').sort((a,b) => {
    if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
    return b.id - a.id;
  });
  ok(res, rows.map(invoiceToJson));
});

app.post('/api/invoices', requireAuth, upload.single('archivo'), (req, res) => {
  const num = (req.body.numero ||'').trim();
  const fec = (req.body.fecha  ||'').trim();
  const imp = parseFloat(req.body.importe)||0;
  const est = (req.body.estado ||'Pendiente').trim();

  const errors = [];
  if (!num)                      errors.push('Número de factura obligatorio');
  if (!fec || !isValidDate(fec)) errors.push('Fecha inválida');
  if (!imp || imp <= 0)          errors.push('Importe debe ser mayor que 0');
  if (!['Pendiente','Pagada','Anulada'].includes(est)) errors.push('Estado inválido (Pendiente, Pagada o Anulada)');

  if (errors.length) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return fail(res, errors.join('; '));
  }

  // Comprobar duplicado de número
  if (store.find('invoices', i => i.invoice_number === num)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return fail(res, 'Ya existe una factura con ese número.', 409);
  }

  let archivoNombre = null, archivoMime = null, archivoSize = null;
  if (req.file) {
    archivoNombre = req.file.filename;
    archivoMime   = req.file.mimetype;
    archivoSize   = req.file.size;
  } else if (req.body.archivo) {
    archivoNombre = req.body.archivo.trim();
  }

  const bid = req.body.booking_id ? parseInt(req.body.booking_id) : null;

  const row = store.insert('invoices', {
    invoice_number: num, fecha: fec, importe: imp, estado: est,
    archivo_nombre: archivoNombre, archivo_mime: archivoMime, archivo_tamanio: archivoSize,
    booking_id: bid, trip_id: null, created_by: req.session.adminId,
  });
  logAction('CREATE', 'invoices', row.id, `Factura ${num} — €${imp}`, req.session.adminId);
  ok(res, invoiceToJson(row), 201);
});

app.delete('/api/invoices/:id', requireAuth, (req, res) => {
  const id  = parseInt(req.params.id);
  const row = store.find('invoices', i => i.id === id);
  if (!row) return fail(res, 'Factura no encontrada.', 404);

  if (row.archivo_nombre) {
    const filePath = path.join(UPLOAD_DIR, path.basename(row.archivo_nombre));
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }

  store.remove('invoices', i => i.id === id);
  logAction('DELETE', 'invoices', id, `Factura #${id} eliminada`, req.session.adminId);
  ok(res, { message: 'Factura eliminada.' });
});

app.patch('/api/invoices/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = store.find('invoices', i => i.id === id);
  if (!existing) return fail(res, 'Factura no encontrada.', 404);

  const changes = {};
  if (req.body.estado !== undefined) {
    if (!['Pendiente','Pagada','Anulada'].includes(req.body.estado)) return fail(res, 'Estado inválido (Pendiente, Pagada o Anulada)');
    changes.estado = req.body.estado;
  }
  if (req.body.numero !== undefined) changes.invoice_number = (req.body.numero||'').trim();
  if (req.body.fecha !== undefined)  changes.fecha = req.body.fecha;
  if (req.body.importe !== undefined) changes.importe = parseFloat(req.body.importe)||0;

  store.update('invoices', i => i.id === id, changes);
  logAction('UPDATE', 'invoices', id, `Factura #${id} actualizada — ${changes.estado || existing.estado}`, req.session.adminId);
  const updated = store.find('invoices', i => i.id === id);
  ok(res, invoiceToJson(updated));
});

// ============================================================
// ADMINS — /api/admins
// ============================================================
function adminToJson(r) {
  return {
    id: r.id, nombre: r.nombre, email: r.email, usuario: r.username,
    activo: r.is_active === 1 || r.is_active === true,
    fecha: (r.created_at || '').slice(0, 10),
    acciones: r._lastAction || 'Sin actividad',
  };
}

app.get('/api/admins', requireAuth, (_req, res) => {
  const admins  = store.all('administrators').sort((a,b) => a.id - b.id);
  const actions = store.all('admin_actions');
  const result  = admins.map(a => {
    const lastAct = actions.filter(x => x.admin_id === a.id).sort((x,y) => y.id - x.id)[0];
    return { ...a, _lastAction: lastAct ? lastAct.description : 'Sin actividad' };
  });
  ok(res, result.map(adminToJson));
});

app.post('/api/admins', requireAuth, (req, res) => {
  const email   = (req.body.email  ||'').toLowerCase().trim();
  const usuario = (req.body.usuario||req.body.username||'').trim();

  if (!isValidEmail(email)) return fail(res, 'Email inválido.');
  if (usuario.length < 3)   return fail(res, 'El nombre de usuario debe tener al menos 3 caracteres.');
  if (store.find('administrators', a => a.email.toLowerCase() === email)) {
    return fail(res, `Ya existe un administrador con el email ${email}.`, 409);
  }

  const token     = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const nombre    = usuario.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  const row = store.insert('administrators', {
    user_id: null, username: usuario, nombre, email, is_active: 0,
    invitation_token: tokenHash, invitation_sent_at: store.now(),
    activated_at: null, last_login: null,
  });
  logAction('INVITE', 'administrators', row.id, `Invitación enviada a ${email}`, req.session.adminId);
  console.log(`[EMAIL SIMULADO] Para: ${email} | Token: ${token} | Admin: ${nombre}`);
  ok(res, { ...adminToJson({ ...row, _lastAction: 'Sin actividad' }), invitationToken: token }, 201);
});

app.patch('/api/admins/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const b  = req.body;

  if (Object.prototype.hasOwnProperty.call(b, 'activo')) {
    store.update('administrators', a => a.id === id, { is_active: b.activo ? 1 : 0 });
  }

  if (b.password !== undefined && b.token !== undefined) {
    if ((b.password || '').length < 8) return fail(res, 'La contraseña debe tener al menos 8 caracteres.');

    const admin = store.find('administrators', a => a.id === id);
    if (!admin) return fail(res, 'Administrador no encontrado.', 404);

    const tokenHash = crypto.createHash('sha256').update(b.token).digest('hex');
    if (!admin.invitation_token || admin.invitation_token !== tokenHash) {
      return fail(res, 'Token de activación inválido.', 403);
    }

    const hash = bcrypt.hashSync(b.password, 10);
    let existingUser = store.find('users', u => u.email.toLowerCase() === admin.email.toLowerCase());
    let userId;
    if (existingUser) {
      store.update('users', u => u.id === existingUser.id, { password_hash: hash, nombre: admin.nombre });
      userId = existingUser.id;
    } else {
      const u = store.insert('users', { email: admin.email, password_hash: hash, nombre: admin.nombre, role: 'admin', is_active: 1 });
      userId = u.id;
    }
    store.update('administrators', a => a.id === id, {
      is_active: 1, user_id: userId, invitation_token: null, activated_at: store.now(),
    });
    logAction('ACTIVATE', 'administrators', id, `Cuenta activada: ${admin.email}`, req.session.adminId);
  }

  const row = store.find('administrators', a => a.id === id);
  if (!row) return fail(res, 'Administrador no encontrado.', 404);
  const lastAct = store.all('admin_actions', x => x.admin_id === id).sort((a,b) => b.id - a.id)[0];
  ok(res, adminToJson({ ...row, _lastAction: lastAct ? lastAct.description : 'Sin actividad' }));
});

app.delete('/api/admins/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (id === 1) return fail(res, 'No se puede eliminar al administrador principal.', 403);
  const n = store.remove('administrators', a => a.id === id);
  if (!n) return fail(res, 'Administrador no encontrado.', 404);
  logAction('DELETE', 'administrators', id, `Admin #${id} eliminado`, req.session.adminId);
  ok(res, { message: 'Administrador eliminado.' });
});

// ============================================================
// FREQUENT PASSENGERS — /api/frequent-passengers
// ============================================================
function fpToJson(r) {
  return {
    id: r.id, nombre: r.nombre, apellido1: r.apellido1, apellido2: r.apellido2||'',
    email: r.email, telefono: ((r.telefono_prefix||'') + ' ' + (r.telefono||'')).trim(),
    fnac: r.fnac, nacionalidad: r.nacionalidad||'', tipoDoc: r.tipo_doc||'', numDoc: r.num_doc, expDoc: r.exp_doc,
  };
}

app.get('/api/frequent-passengers', requireAuth, (_req, res) => {
  ok(res, store.all('frequent_passengers').sort((a,b) => a.nombre.localeCompare(b.nombre)).map(fpToJson));
});

app.post('/api/frequent-passengers', requireAuth, (req, res) => {
  const b      = req.body;
  const nombre = (b.nombre     ||'').trim();
  const ape1   = (b.apellido1  ||'').trim();
  const ape2   = (b.apellido2  ||'').trim();
  const email  = (b.email      ||'').trim();
  const tel    = (b.telefono   ||'').trim();
  const fnac   = (b.fnac       ||'').trim();
  const nac    = (b.nacionalidad||'').trim();
  const tipDoc = (b.tipoDoc    ||'').trim();
  const numDoc = (b.numDoc     ||'').toUpperCase().trim();
  const expDoc = (b.expDoc     ||'').trim();

  if (!nombre || !ape1 || !numDoc) return fail(res, 'Nombre, apellido y número de documento son obligatorios.');
  if (!isValidEmail(email)) return fail(res, 'Email inválido.');
  if (store.find('frequent_passengers', p => p.num_doc === numDoc)) {
    return fail(res, `Ya existe un pasajero frecuente con ese documento (${numDoc}).`, 409);
  }

  let pre = '+34', telNum = tel;
  const m = tel.match(/^(\+\d{1,4})\s*(.*)$/);
  if (m) { pre = m[1]; telNum = m[2]; }

  const row = store.insert('frequent_passengers', {
    nombre, apellido1:ape1, apellido2:ape2||null, email,
    telefono_prefix:pre, telefono:telNum, fnac:fnac||null,
    nacionalidad:nac, tipo_doc:tipDoc, num_doc:numDoc, exp_doc:expDoc||null,
  });
  ok(res, fpToJson(row), 201);
});

app.delete('/api/frequent-passengers/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const n  = store.remove('frequent_passengers', p => p.id === id);
  if (!n) return fail(res, 'Pasajero frecuente no encontrado.', 404);
  ok(res, { message: 'Pasajero frecuente eliminado.' });
});

// ============================================================
// ROUTES / SAILINGS / TIMETABLES
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

let routesCache = null, routesCacheTime = 0;

app.get('/api/routes', requireAuth, async (_req, res) => {
  if (routesCache && Date.now() - routesCacheTime < 300000) return ok(res, routesCache);

  try {
    const [routesRes, portsRes] = await Promise.all([
      fetchKikoto('/routes'),
      fetchKikoto('/ports'),
    ]);

    const portsMap = {};
    (portsRes.data || []).forEach(p => { portsMap[p.id] = p; });

    const mappedRoutes = (routesRes.data || []).map(r => ({
      id: r.id,
      name: r.name,
      departure_port: {
        id: r.departure_port_id,
        name: portsMap[r.departure_port_id] ? portsMap[r.departure_port_id].name : 'Unknown',
      },
      destination_port: {
        id: r.destination_port_id,
        name: portsMap[r.destination_port_id] ? portsMap[r.destination_port_id].name : 'Unknown',
      },
    }));

    // If API failed or returned nothing, fallback to demo if needed, but the instruction says "Sincronizar las rutas disponibles en tiempo real".
    // For safety, if empty, we might keep the demo or just return empty.
    if (mappedRoutes.length === 0 && !KIKOTO_API_TOKEN) {
      routesCache = [
        { id:1,  name:'Algeciras - Ceuta',         departure_port:{id:10,name:'Algeciras'},  destination_port:{id:11,name:'Ceuta'         } },
        { id:2,  name:'Algeciras - Tánger Med',    departure_port:{id:10,name:'Algeciras'},  destination_port:{id:12,name:'Tánger Med'    } },
        { id:3,  name:'Algeciras - Tánger Ciudad', departure_port:{id:10,name:'Algeciras'},  destination_port:{id:13,name:'Tánger Ciudad' } },
        { id:4,  name:'Tarifa - Tánger Ciudad',    departure_port:{id:14,name:'Tarifa'   },  destination_port:{id:13,name:'Tánger Ciudad' } },
        { id:5,  name:'Ceuta - Algeciras',         departure_port:{id:11,name:'Ceuta'    },  destination_port:{id:10,name:'Algeciras'     } },
      ];
    } else {
      routesCache = mappedRoutes;
    }

    routesCacheTime = Date.now();
    ok(res, routesCache);
  } catch (err) {
    console.error('[ROUTES] Error sync:', err.message);
    ok(res, []);
  }
});

app.post('/api/sailings', requireAuth, (req, res) => {
  const { departure_port_id, destination_port_id, date } = req.body;
  if (!departure_port_id || !destination_port_id || !date) return fail(res, 'departure_port_id, destination_port_id y date son obligatorios.');
  if (!isValidDate(date)) return fail(res, 'Formato de fecha inválido (YYYY-MM-DD).');
  if (departure_port_id === destination_port_id) return fail(res, 'El origen y el destino no pueden ser el mismo puerto.');
  ok(res, demoSailings(date));
});

app.post('/api/timetables', requireAuth, (req, res) => {
  const { departure_port_id, destination_port_id, date } = req.body;
  if (!departure_port_id || !destination_port_id || !date) return fail(res, 'departure_port_id, destination_port_id y date son obligatorios.');
  if (!isValidDate(date)) return fail(res, 'Formato de fecha inválido (YYYY-MM-DD).');
  if (departure_port_id === destination_port_id) return fail(res, 'El origen y el destino no pueden ser el mismo puerto.');
  ok(res, demoSailings(date));
});

// ============================================================
// TEST EMAIL
// ============================================================
app.get('/api/test-email', requireAuth, async (_req, res) => {
  try {
    await mailer.verify();
    await mailer.sendMail({
      from: `"Kikoto Reservas" <${process.env.SMTP_USER || 'noreply@kikoto.es'}>`,
      to:   process.env.SMTP_USER || 'noreply@kikoto.es',
      subject: '[Kikoto] Email de prueba',
      text: 'Conexión SMTP funcionando correctamente.',
    });
    ok(res, { message: 'Email enviado correctamente.' });
  } catch (err) {
    console.error('[EMAIL TEST]', err);
    fail(res, 'Error al enviar email: ' + err.message, 500);
  }
});

// ============================================================
// ERROR HANDLER — multer y genérico
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 'El archivo supera el tamaño máximo de 10 MB.');
    return fail(res, 'Error al subir el archivo: ' + err.message);
  }
  if (err) return fail(res, err.message || 'Error interno.', 500);
});

// ============================================================
// ARRANCAR SERVIDOR
// ============================================================
store.load(); // inicializa la BD en el arranque

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   KIKOTO — Gestión de Agencias           ║`);
  console.log(`  ║   Node.js + Express + JSON Store         ║`);
  console.log(`  ╠══════════════════════════════════════════╣`);
  console.log(`  ║   http://localhost:${PORT}                   ║`);
  console.log(`  ║                                          ║`);
  console.log(`  ║   Demo: admin@kikoto.com / Admin123      ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
