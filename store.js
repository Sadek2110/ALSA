/* ============================================================
   KIKOTO — store.js
   Base de datos JSON pura (sin dependencias nativas).
   Persiste en kikoto.json — funciona con cualquier Node.js.
   ============================================================ */

'use strict';

const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const FILE = path.join(process.env.DATA_DIR || __dirname, 'kikoto.json');

let _db = null;

// ── Cargar / inicializar ──────────────────────────────────────
function load() {
  if (_db) return _db;
  try {
    _db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    _db = seed();
    save();
    console.log('Base de datos inicializada con datos de demo.');
  }
  return _db;
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(_db, null, 2), 'utf8');
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Auto-incremento de IDs ────────────────────────────────────
function nextId(table) {
  const db = load();
  if (!db._seq) db._seq = {};
  db._seq[table] = (db._seq[table] || 0) + 1;
  return db._seq[table];
}

// ── Operaciones CRUD ──────────────────────────────────────────
function insert(table, data) {
  const db  = load();
  const id  = nextId(table);
  const row = { id, ...data, created_at: now(), updated_at: now() };
  db[table].push(row);
  save();
  return row;
}

function update(table, pred, changes) {
  const db = load();
  let n = 0;
  db[table] = db[table].map(r => {
    if (pred(r)) { n++; return { ...r, ...changes, updated_at: now() }; }
    return r;
  });
  if (n) save();
  return n;
}

function remove(table, pred) {
  const db     = load();
  const before = db[table].length;
  db[table]    = db[table].filter(r => !pred(r));
  const n      = before - db[table].length;
  if (n) save();
  return n;
}

function all(table, pred = () => true) {
  return load()[table].filter(pred);
}

function find(table, pred) {
  return load()[table].find(pred) ?? null;
}

// ── Datos de demo ────────────────────────────────────────────
function seed() {
  const adminHash = bcrypt.hashSync('Admin123', 10);
  const lauraHash = bcrypt.hashSync('Laura123', 10);
  const roberHash = bcrypt.hashSync('Rober123', 10);

  return {
    _seq: {
      users: 3, administrators: 3, members: 3, vehicles: 4,
      frequent_passengers: 1, trips: 5, bookings: 2, invoices: 5, admin_actions: 7,
    },
    users: [
      { id:1, email:'admin@kikoto.com', password_hash:adminHash, nombre:'Admin Principal', role:'super_admin', is_active:1, created_at:'2024-01-10 09:00:00', updated_at:'2024-01-10 09:00:00' },
      { id:2, email:'laura@kikoto.com', password_hash:lauraHash, nombre:'Laura Sánchez',   role:'admin',       is_active:1, created_at:'2024-02-14 11:30:00', updated_at:'2024-02-14 11:30:00' },
      { id:3, email:'rob@kikoto.com',   password_hash:roberHash, nombre:'Roberto Pérez',   role:'admin',       is_active:1, created_at:'2024-03-01 08:00:00', updated_at:'2024-03-01 08:00:00' },
    ],
    administrators: [
      { id:1, user_id:1, username:'admin',     nombre:'Admin Principal', email:'admin@kikoto.com', is_active:1, invitation_token:null, invitation_sent_at:null, activated_at:'2024-01-10 09:00:00', last_login:null, created_at:'2024-01-10 09:00:00', updated_at:'2024-01-10 09:00:00' },
      { id:2, user_id:2, username:'laura.s',   nombre:'Laura Sánchez',   email:'laura@kikoto.com', is_active:1, invitation_token:null, invitation_sent_at:null, activated_at:'2024-02-14 11:30:00', last_login:null, created_at:'2024-02-14 11:30:00', updated_at:'2024-02-14 11:30:00' },
      { id:3, user_id:3, username:'roberto.p', nombre:'Roberto Pérez',   email:'rob@kikoto.com',   is_active:0, invitation_token:null, invitation_sent_at:null, activated_at:null,                  last_login:null, created_at:'2024-03-01 08:00:00', updated_at:'2024-03-01 08:00:00' },
    ],
    members: [
      { id:1, nombre:'María',  apellido1:'García',    apellido2:'López', dni:'12345678A', tipo_doc:'DNI', num_doc:'12345678A', exp_doc:'2027-06-15', email:'maria@ejemplo.com',  telefono_prefix:'+34', telefono:'612345678', fecha_nacimiento:'1985-06-15', fecha_expiracion:'2027-06-15', nacionalidad:'ES', created_at:now(), updated_at:now() },
      { id:2, nombre:'Carlos', apellido1:'Martínez',  apellido2:null,    dni:'87654321B', tipo_doc:'DNI', num_doc:'87654321B', exp_doc:'2025-12-31', email:'carlos@ejemplo.com', telefono_prefix:'+34', telefono:'698765432', fecha_nacimiento:'1990-03-22', fecha_expiracion:'2025-12-31', nacionalidad:'ES', created_at:now(), updated_at:now() },
      { id:3, nombre:'Ana',    apellido1:'Rodríguez', apellido2:null,    dni:'11223344C', tipo_doc:'DNI', num_doc:'11223344C', exp_doc:'2026-03-08', email:'ana@ejemplo.com',    telefono_prefix:'+34', telefono:'655111222', fecha_nacimiento:'1978-11-08', fecha_expiracion:'2026-03-08', nacionalidad:'ES', created_at:now(), updated_at:now() },
    ],
    vehicles: [
      { id:1, marca:'Mercedes',   modelo:'Sprinter', ancho:2.10, largo:5.90, alto:2.80, is_active:1, created_at:now(), updated_at:now() },
      { id:2, marca:'Volkswagen', modelo:'Crafter',  ancho:2.05, largo:5.40, alto:2.60, is_active:1, created_at:now(), updated_at:now() },
      { id:3, marca:'Ford',       modelo:'Transit',  ancho:2.00, largo:5.50, alto:2.55, is_active:1, created_at:now(), updated_at:now() },
      { id:4, marca:'Renault',    modelo:'Master',   ancho:1.99, largo:5.05, alto:2.48, is_active:1, created_at:now(), updated_at:now() },
    ],
    frequent_passengers: [
      { id:1, nombre:'María', apellido1:'García', apellido2:'López', email:'maria@ejemplo.com', telefono_prefix:'+34', telefono:'612345678', fnac:'1985-06-15', nacionalidad:'ES', tipo_doc:'DNI', num_doc:'12345678A', exp_doc:'2027-06-15', created_at:now(), updated_at:now() },
    ],
    trips: [
      { id:1, localizador:'ABC123', fecha_ida:'2024-03-15 08:30:00', fecha_vuelta:'2024-03-22 18:00:00', estado:'Confirmado', incluye_vehiculo:1, incluye_mascota:0, vehicle_id:1, created_by:1, created_at:'2024-03-01 10:00:00', updated_at:'2024-03-01 10:00:00' },
      { id:2, localizador:'XYZ789', fecha_ida:'2024-03-20 10:00:00', fecha_vuelta:'2024-03-25 16:00:00', estado:'Pendiente',  incluye_vehiculo:0, incluye_mascota:1, vehicle_id:null, created_by:1, created_at:'2024-03-05 09:00:00', updated_at:'2024-03-05 09:00:00' },
      { id:3, localizador:'DEF456', fecha_ida:'2024-02-10 07:00:00', fecha_vuelta:'2024-02-17 20:00:00', estado:'Confirmado', incluye_vehiculo:0, incluye_mascota:0, vehicle_id:null, created_by:2, created_at:'2024-02-01 08:00:00', updated_at:'2024-02-01 08:00:00' },
      { id:4, localizador:'GHI321', fecha_ida:'2024-04-01 09:15:00', fecha_vuelta:null,                  estado:'Cancelado',  incluye_vehiculo:1, incluye_mascota:0, vehicle_id:2,    created_by:2, created_at:'2024-03-20 11:00:00', updated_at:'2024-03-20 11:00:00' },
      { id:5, localizador:'JKL654', fecha_ida:'2024-04-10 11:00:00', fecha_vuelta:'2024-04-18 14:30:00', estado:'Pendiente',  incluye_vehiculo:1, incluye_mascota:1, vehicle_id:3,    created_by:1, created_at:'2024-04-01 07:00:00', updated_at:'2024-04-01 07:00:00' },
    ],
    bookings: [
      { id:1, trip_type:'ida',        departure_port:'Algeciras', destination_port:'Ceuta',   naviera:'Baleària',          departure_date:'2024-03-15', departure_time:'08:00', return_date:null,         return_time:null,    localizador:null,      estado:'Pendiente',  pax_nombre:'María',  pax_apellido1:'García',    pax_apellido2:null, pax_email:'maria@ejemplo.com',  pax_telefono:'+34 612345678', pax_fnac:'1985-06-15', pax_nacionalidad:'ES', pax_tipo_doc:'DNI', pax_num_doc:'12345678A', pax_exp_doc:'2027-06-15', veh_marca:'Mercedes',   veh_modelo:'Sprinter', veh_largo:5.90, veh_ancho:2.10, veh_alto:2.80, with_pet:0, pet_num:null, pet_raza:null, notification_email:'admin@kikoto.com', created_by:1, created_at:'2024-03-10 10:00:00', updated_at:'2024-03-10 10:00:00' },
      { id:2, trip_type:'idayvuelta', departure_port:'Barcelona',  destination_port:'Palma',   naviera:'Trasmediterránea', departure_date:'2024-04-01', departure_time:'10:30', return_date:'2024-04-08', return_time:'09:00', localizador:'ALG1234', estado:'Confirmado', pax_nombre:'Carlos', pax_apellido1:'Martínez',  pax_apellido2:null, pax_email:'carlos@ejemplo.com', pax_telefono:'+34 698765432', pax_fnac:'1990-03-22', pax_nacionalidad:'ES', pax_tipo_doc:'DNI', pax_num_doc:'87654321B', pax_exp_doc:'2025-12-31', veh_marca:'Volkswagen', veh_modelo:'Crafter',  veh_largo:5.40, veh_ancho:2.05, veh_alto:2.60, with_pet:0, pet_num:null, pet_raza:null, notification_email:'admin@kikoto.com', created_by:1, created_at:'2024-03-25 09:00:00', updated_at:'2024-03-25 09:00:00' },
    ],
    invoices: [
      { id:1, invoice_number:'FAC-2024-001', fecha:'2024-01-15', importe:1250.00, estado:'Pagada',    archivo_nombre:'factura_001.pdf', archivo_mime:'application/pdf', archivo_tamanio:null, booking_id:null, trip_id:1, created_by:1, created_at:'2024-01-15 09:00:00', updated_at:'2024-01-15 09:00:00' },
      { id:2, invoice_number:'FAC-2024-002', fecha:'2024-02-08', importe: 875.50, estado:'Pendiente', archivo_nombre:'factura_002.pdf', archivo_mime:'application/pdf', archivo_tamanio:null, booking_id:null, trip_id:2, created_by:1, created_at:'2024-02-08 10:00:00', updated_at:'2024-02-08 10:00:00' },
      { id:3, invoice_number:'FAC-2024-003', fecha:'2024-02-28', importe:3400.00, estado:'Pagada',    archivo_nombre:'factura_003.pdf', archivo_mime:'application/pdf', archivo_tamanio:null, booking_id:null, trip_id:3, created_by:2, created_at:'2024-02-28 08:00:00', updated_at:'2024-02-28 08:00:00' },
      { id:4, invoice_number:'FAC-2024-004', fecha:'2024-03-10', importe: 620.00, estado:'Vencida',   archivo_nombre:null,              archivo_mime:null,              archivo_tamanio:null, booking_id:null, trip_id:4, created_by:1, created_at:'2024-03-10 11:00:00', updated_at:'2024-03-10 11:00:00' },
      { id:5, invoice_number:'FAC-2024-005', fecha:'2024-03-22', importe:1890.75, estado:'Pendiente', archivo_nombre:'factura_005.pdf', archivo_mime:'application/pdf', archivo_tamanio:null, booking_id:null, trip_id:5, created_by:2, created_at:'2024-03-22 14:00:00', updated_at:'2024-03-22 14:00:00' },
    ],
    admin_actions: [
      { id:1, admin_id:1, action_type:'LOGIN',              entity_type:'users',          entity_id:1, description:'Inicio de sesión exitoso',              ip_address:null, created_at:now() },
      { id:2, admin_id:1, action_type:'CREATE',             entity_type:'trips',          entity_id:1, description:'Creación del viaje ABC123',              ip_address:null, created_at:now() },
      { id:3, admin_id:2, action_type:'UPDATE',             entity_type:'trips',          entity_id:3, description:'Estado del viaje DEF456 → Confirmado',   ip_address:null, created_at:now() },
      { id:4, admin_id:1, action_type:'CREATE',             entity_type:'invoices',       entity_id:1, description:'Registro de factura FAC-2024-001',       ip_address:null, created_at:now() },
      { id:5, admin_id:2, action_type:'CREATE',             entity_type:'members',        entity_id:1, description:'Alta del miembro María García López',     ip_address:null, created_at:now() },
      { id:6, admin_id:1, action_type:'BOOKING_CREATE',     entity_type:'bookings',       entity_id:1, description:'Reserva Algeciras → Ceuta, Baleària',     ip_address:null, created_at:now() },
      { id:7, admin_id:1, action_type:'BOOKING_LOCALIZADOR',entity_type:'bookings',       entity_id:2, description:'Localizador añadido: ALG1234',            ip_address:null, created_at:now() },
    ],
  };
}

module.exports = { insert, update, remove, all, find, load, save, now, today };
