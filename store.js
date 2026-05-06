/* ============================================================
   KIKOTO — store.js
   Base de datos JSON pura (sin dependencias nativas).
   Persiste en kikoto.json — funciona con cualquier Node.js.
   ============================================================ */

'use strict';

const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA = process.env.DATA_DIR || path.join(__dirname, 'database');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
const FILE = path.join(DATA, 'kikoto.json');

let _db = null;

// ── Cargar / inicializar ──────────────────────────────────────
function load() {
  if (_db) return _db;
  try {
    _db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      _db = seed();
      save();
      console.log('Base de datos inicializada con datos de demo.');
    } else {
      console.error('ERROR FATAL: Base de datos corrupta. Realiza una copia de seguridad antes de continuar.');
      console.error('Ruta:', FILE);
      console.error('Detalle:', err.message);
      process.exit(1);
    }
  }
  return _db;
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_db, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
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
  const db = load();
  if (!db[table]) db[table] = [];
  const id = nextId(table);
  // Descartar cualquier `id` que venga en data para que el autoincremento siempre gane
  const { id: _discard, created_at: _ca, updated_at: _ua, ...cleanData } = data;
  const row = { ...cleanData, id, created_at: now(), updated_at: now() };
  db[table].push(row);
  try {
    save();
  } catch (err) {
    db[table].pop();
    db._seq[table] = id - 1;
    throw err;
  }
  return { ...row };
}

function update(table, pred, changes) {
  const db = load();
  if (!db[table]) return 0;
  let n = 0;
  // Proteger campos inmutables: id y created_at nunca se sobreescriben
  const { id: _1, created_at: _2, ...safeChanges } = changes;
  db[table] = db[table].map(r => {
    if (pred(r)) { n++; return { ...r, ...safeChanges, updated_at: now() }; }
    return r;
  });
  if (n) save();
  return n;
}

function remove(table, pred) {
  const db     = load();
  if (!db[table]) return 0;
  const before = db[table].length;
  db[table]    = db[table].filter(r => !pred(r));
  const n      = before - db[table].length;
  if (n) save();
  return n;
}

function all(table, pred = () => true) {
  const db = load();
  // No crear tabla fantasma: leer sin mutar _db
  const rows = db[table] || [];
  return rows.filter(pred).map(r => ({ ...r }));
}

function find(table, pred) {
  const db = load();
  const rows = db[table] || [];
  const row = rows.find(pred);
  return row ? { ...row } : null;
}

// ── Datos de demo ────────────────────────────────────────────
function seed() {
  return {
    _seq: { users: 1, administrators: 1, members: 3, vehicles: 4, frequent_passengers: 1, bookings: 2, invoices: 5 },
    users: [
      { id:1, email:'admin@kikoto.com', password_hash:bcrypt.hashSync('Admin123',10), nombre:'Admin Principal', role:'super_admin', is_active:1, created_at:'2024-01-10 09:00:00', updated_at:'2024-01-10 09:00:00' },
    ],
    administrators: [
      { id:1, nombre:'Admin Principal', email:'admin@kikoto.com', usuario:'admin', activo:true, fecha:'2024-01-10', acciones:'Acceso completo' },
    ],
    members: [
      { id:1, nombre:'María',  apellido1:'García',    apellido2:'López',   apellido:'García López', dni:'12345678A', tipoDoc:'DNI', numDoc:'12345678A', expDoc:'2027-06-15', email:'maria@ejemplo.com',  telefono:'+34 612 345 678', fechaNacimiento:'1985-06-15', fechaExpiracion:'2027-06-15', nacionalidad:'ES' },
      { id:2, nombre:'Carlos', apellido1:'Martínez',  apellido2:null,      apellido:'Martínez',     dni:'87654321B', tipoDoc:'DNI', numDoc:'87654321B', expDoc:'2025-12-31', email:'carlos@ejemplo.com', telefono:'+34 698 765 432', fechaNacimiento:'1990-03-22', fechaExpiracion:'2025-12-31', nacionalidad:'ES' },
      { id:3, nombre:'Ana',    apellido1:'Rodríguez', apellido2:null,      apellido:'Rodríguez',    dni:'11223344C', tipoDoc:'DNI', numDoc:'11223344C', expDoc:'2026-03-08', email:'ana@ejemplo.com',    telefono:'+34 655 111 222', fechaNacimiento:'1978-11-08', fechaExpiracion:'2026-03-08', nacionalidad:'ES' },
    ],
    vehicles: [
      { id:1, marca:'Mercedes',   modelo:'Sprinter', matricula:'1234ABC', ancho:2.10, largo:5.90, alto:2.80 },
      { id:2, marca:'Volkswagen', modelo:'Crafter',  matricula:'5678DEF', ancho:2.05, largo:5.40, alto:2.60 },
      { id:3, marca:'Ford',       modelo:'Transit',  matricula:'9012GHI', ancho:2.00, largo:5.50, alto:2.55 },
      { id:4, marca:'Renault',    modelo:'Master',   matricula:'',        ancho:1.99, largo:5.05, alto:2.48 },
    ],
    frequent_passengers: [
      { id:1, nombre:'María', apellido1:'García', apellido2:'López', email:'maria@ejemplo.com', telefono:'+34 612 345 678', fnac:'1985-06-15', nacionalidad:'ES', tipoDoc:'DNI', numDoc:'12345678A', expDoc:'2027-06-15' },
    ],
    bookings: [
      { id:1, tripType:'ida',        origin:'Algeciras', destination:'Ceuta',     naviera:'Balearia',          departureDate:'2024-03-15', departureTime:'08:00', returnDate:null,              returnTime:null, localizador:'',       estado:'Pendiente',  passengerName:'María García',  email:'maria@ejemplo.com',  vehiclePlate:'Mercedes Sprinter', createdAt:'2024-03-10', paxNombre:'María',  paxApellido1:'García',   paxApellido2:'',      paxEmail:'maria@ejemplo.com',  paxTelefono:'+34 612345678', paxTipoDoc:'DNI', paxNumDoc:'12345678A', paxExpDoc:'2027-06-15', vehMarca:'Mercedes',  vehModelo:'Sprinter', vehLargo:5.90, vehAncho:2.10, vehAlto:2.80, vehicleCount:1 },
      { id:2, tripType:'idayvuelta', origin:'Barcelona',  destination:'Palma',     naviera:'Trasmediterránea', departureDate:'2024-04-01', departureTime:'10:30', returnDate:'2024-04-08',     returnTime:'09:00',localizador:'ALG1234', estado:'Activo',     passengerName:'Carlos Martínez', email:'carlos@ejemplo.com', vehiclePlate:'Volkswagen Crafter', createdAt:'2024-03-20', paxNombre:'Carlos', paxApellido1:'Martínez', paxApellido2:null,    paxEmail:'carlos@ejemplo.com', paxTelefono:'+34 698765432', paxTipoDoc:'DNI', paxNumDoc:'87654321B', paxExpDoc:'2025-12-31', vehMarca:'Volkswagen',vehModelo:'Crafter',  vehLargo:5.40, vehAncho:2.05, vehAlto:2.60, vehicleCount:1 },
    ],
    invoices: [
      { id:1, numero:'FAC-2024-001', fecha:'2024-01-15', importe:1250.00, estado:'Pagada',    archivo:'factura_001.pdf' },
      { id:2, numero:'FAC-2024-002', fecha:'2024-02-08', importe:875.50,  estado:'Pendiente', archivo:'factura_002.pdf' },
      { id:3, numero:'FAC-2024-003', fecha:'2024-02-28', importe:3400.00, estado:'Pagada',    archivo:'factura_003.pdf' },
      { id:4, numero:'FAC-2024-004', fecha:'2024-03-10', importe:620.00,   estado:'Anulada',   archivo:null },
      { id:5, numero:'FAC-2024-005', fecha:'2024-03-22', importe:1890.75,  estado:'Pendiente', archivo:'factura_005.pdf' },
    ],
  };
}

module.exports = { insert, update, remove, all, find, load, save, now, today };
