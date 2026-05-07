'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

let _ready = false;

async function query(text, params) {
  return pool.query(text, params);
}

async function init() {
  if (_ready) return;
  console.log('[DB] Connecting to PostgreSQL...');
  console.log('[DB] DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : '(not set)');
  console.log('[DB] DB_SSL:', process.env.DB_SSL);

  try {
    const testResult = await pool.query('SELECT NOW() as now');
    console.log('[DB] Connected successfully at', testResult.rows[0].now);
  } catch (connErr) {
    console.error('[DB] CONNECTION FAILED:', connErr.message);
    console.error('[DB] Check that DATABASE_URL is correct and PostgreSQL is running.');
    throw connErr;
  }

  console.log('[DB] Initializing schema...');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      nombre        TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'admin',
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS administrators (
      id         SERIAL PRIMARY KEY,
      nombre     TEXT NOT NULL,
      email      TEXT NOT NULL,
      usuario    TEXT NOT NULL UNIQUE,
      activo     BOOLEAN NOT NULL DEFAULT TRUE,
      fecha      TEXT NOT NULL DEFAULT '',
      acciones   TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS members (
      id                SERIAL PRIMARY KEY,
      nombre            TEXT NOT NULL,
      apellido          TEXT NOT NULL DEFAULT '',
      apellido1         TEXT NOT NULL DEFAULT '',
      apellido2         TEXT,
      dni               TEXT NOT NULL DEFAULT '',
      tipodoc           TEXT NOT NULL DEFAULT 'DNI',
      numdoc            TEXT NOT NULL DEFAULT '',
      expdoc            TEXT,
      email             TEXT NOT NULL DEFAULT '',
      telefono          TEXT NOT NULL DEFAULT '',
      fechanacimiento   TEXT,
      fechaexpiracion   TEXT,
      nacionalidad      TEXT NOT NULL DEFAULT 'ES',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id        SERIAL PRIMARY KEY,
      marca     TEXT NOT NULL,
      modelo    TEXT NOT NULL,
      matricula TEXT NOT NULL DEFAULT '',
      ancho     NUMERIC(6,2) NOT NULL DEFAULT 0,
      largo     NUMERIC(6,2) NOT NULL DEFAULT 0,
      alto      NUMERIC(6,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS frequent_passengers (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT NOT NULL,
      apellido1   TEXT NOT NULL DEFAULT '',
      apellido2   TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL DEFAULT '',
      telefono    TEXT NOT NULL DEFAULT '',
      fnac        TEXT,
      nacionalidad TEXT NOT NULL DEFAULT 'ES',
      tipodoc     TEXT NOT NULL DEFAULT 'DNI',
      numdoc      TEXT NOT NULL DEFAULT '',
      expdoc      TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id              SERIAL PRIMARY KEY,
      triptype        TEXT NOT NULL DEFAULT 'ida',
      origin          TEXT NOT NULL DEFAULT '',
      destination     TEXT NOT NULL DEFAULT '',
      naviera         TEXT NOT NULL DEFAULT '',
      departuredate   TEXT NOT NULL DEFAULT '',
      departuretime   TEXT,
      returndate      TEXT,
      returntime      TEXT,
      localizador     TEXT NOT NULL DEFAULT '',
      estado          TEXT NOT NULL DEFAULT 'Pendiente',
      passengername   TEXT NOT NULL DEFAULT '',
      email           TEXT NOT NULL DEFAULT '',
      vehicleplate    TEXT,
      paxnombre       TEXT NOT NULL DEFAULT '',
      paxapellido1    TEXT NOT NULL DEFAULT '',
      paxapellido2    TEXT NOT NULL DEFAULT '',
      paxemail        TEXT NOT NULL DEFAULT '',
      paxtelefono     TEXT,
      Paxtipodoc      TEXT NOT NULL DEFAULT 'DNI',
      paxnumdoc       TEXT NOT NULL DEFAULT '',
      paxexpdoc       TEXT,
      vehmarca        TEXT NOT NULL DEFAULT '',
      vehmodelo       TEXT NOT NULL DEFAULT '',
      vehmatricula    TEXT NOT NULL DEFAULT '',
      vehlargo        NUMERIC(6,2) NOT NULL DEFAULT 0,
      vehancho        NUMERIC(6,2) NOT NULL DEFAULT 0,
      vealto          NUMERIC(6,2) NOT NULL DEFAULT 0,
      vehiclecount    INTEGER NOT NULL DEFAULT 1,
      groupid         TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id        SERIAL PRIMARY KEY,
      numero    TEXT NOT NULL UNIQUE,
      fecha     TEXT NOT NULL DEFAULT '',
      importe   NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado    TEXT NOT NULL DEFAULT 'Pendiente',
      archivo   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Migraciones ──
  await query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS groupid TEXT');

  const { rows } = await query('SELECT COUNT(*) as cnt FROM users');
  if (parseInt(rows[0].cnt, 10) === 0) {
    console.log('[DB] Seeding initial admin user...');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('Admin123', 10);

    await query('INSERT INTO users (email, password_hash, nombre, role) VALUES ($1, $2, $3, $4)',
      ['admin@alsa.com', hash, 'Admin Principal', 'super_admin']);

    await query('INSERT INTO administrators (nombre, email, usuario, activo, fecha, acciones) VALUES ($1,$2,$3,$4,$5,$6)',
      ['Admin Principal', 'admin@alsa.com', 'admin', true, new Date().toISOString().slice(0,10), 'Acceso completo']);

    console.log('[DB] Admin user created.');
  } else {
    console.log('[DB] Data already exists, skipping seed.');
  }

  _ready = true;
  console.log('[DB] Schema ready.');
}

// ── Generic helpers ──
const COL_MAP = {
  bookings: ['id','triptype','origin','destination','naviera','departuredate','departuretime','returndate','returntime','localizador','estado','passengername','email','vehicleplate','paxnombre','paxapellido1','paxapellido2','paxemail','paxtelefono','Paxtipodoc','paxnumdoc','paxexpdoc','vehmarca','vehmodelo','vehmatricula','vehlargo','vehancho','vealto','vehiclecount','created_at','updated_at'],
  members: ['id','nombre','apellido','apellido1','apellido2','dni','tipodoc','numdoc','expdoc','email','telefono','fechanacimiento','fechaexpiracion','nacionalidad','created_at','updated_at'],
  vehicles: ['id','marca','modelo','matricula','ancho','largo','alto','created_at','updated_at'],
  invoices: ['id','numero','fecha','importe','estado','archivo','created_at','updated_at'],
  administrators: ['id','nombre','email','usuario','activo','fecha','acciones','created_at','updated_at'],
  frequent_passengers: ['id','nombre','apellido1','apellido2','email','telefono','fnac','nacionalidad','tipodoc','numdoc','expdoc','created_at','updated_at'],
};

// camelCase mapping for JSON responses
const CAMEL_MAP = {
  bookings: { triptype:'tripType', origin:'origin', destination:'destination', naviera:'naviera', departuredate:'departureDate', departuretime:'departureTime', returndate:'returnDate', returntime:'returnTime', localizador:'localizador', estado:'estado', passengername:'passengerName', email:'email', vehicleplate:'vehiclePlate', paxnombre:'paxNombre', paxapellido1:'paxApellido1', paxapellido2:'paxApellido2', paxemail:'paxEmail', paxtelefono:'paxTelefono', Paxtipodoc:'paxTipoDoc', paxnumdoc:'paxNumDoc', paxexpdoc:'paxExpDoc', vehmarca:'vehMarca', vehmodelo:'vehModelo', vehmatricula:'vehMatricula', vehlargo:'vehLargo', vehancho:'vehAncho', vealto:'vehAlto', vehiclecount:'vehicleCount', groupid:'groupId', created_at:'createdAt', updated_at:'updatedAt' },
  members: { nombre:'nombre', apellido:'apellido', apellido1:'apellido1', apellido2:'apellido2', dni:'dni', tipodoc:'tipoDoc', numdoc:'numDoc', expdoc:'expDoc', email:'email', telefono:'telefono', fechanacimiento:'fechaNacimiento', fechaexpiracion:'fechaExpiracion', nacionalidad:'nacionalidad', created_at:'createdAt', updated_at:'updatedAt' },
  vehicles: { marca:'marca', modelo:'modelo', matricula:'matricula', ancho:'ancho', largo:'largo', alto:'alto', created_at:'createdAt', updated_at:'updatedAt' },
  invoices: { numero:'numero', fecha:'fecha', importe:'importe', estado:'estado', archivo:'archivo', created_at:'createdAt', updated_at:'updatedAt' },
  administrators: { nombre:'nombre', email:'email', usuario:'usuario', activo:'activo', fecha:'fecha', acciones:'acciones', created_at:'createdAt', updated_at:'updatedAt' },
  frequent_passengers: { nombre:'nombre', apellido1:'apellido1', apellido2:'apellido2', email:'email', telefono:'telefono', fnac:'fnac', nacionalidad:'nacionalidad', tipodoc:'tipoDoc', numdoc:'numDoc', expdoc:'expDoc', created_at:'createdAt', updated_at:'updatedAt' },
};

function toCamel(table, row) {
  const map = CAMEL_MAP[table] || {};
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = map[k] || k;
    out[key] = v;
  }
  return out;
}

// ── Convert frontend camelCase → DB columns (snake_case) ──
const DB_MAP = {
  bookings: { tripType:'triptype', origin:'origin', destination:'destination', naviera:'naviera', departureDate:'departuredate', departureTime:'departuretime', returnDate:'returndate', returnTime:'returntime', localizador:'localizador', estado:'estado', passengerName:'passengername', email:'email', vehiclePlate:'vehicleplate', paxNombre:'paxnombre', paxApellido1:'paxapellido1', paxApellido2:'paxapellido2', paxEmail:'paxemail', paxTelefono:'paxtelefono', paxTipoDoc:'Paxtipodoc', paxNumDoc:'paxnumdoc', paxExpDoc:'paxexpdoc', vehMarca:'vehmarca', vehModelo:'vehmodelo', vehMatricula:'vehmatricula', vehLargo:'vehlargo', vehAncho:'vehancho', vehAlto:'vealto', vehicleCount:'vehiclecount', groupId:'groupid' },
  members: { nombre:'nombre', apellido:'apellido', apellido1:'apellido1', apellido2:'apellido2', dni:'dni', tipoDoc:'tipodoc', numDoc:'numdoc', expDoc:'expdoc', email:'email', telefono:'telefono', fechaNacimiento:'fechanacimiento', fechaExpiracion:'fechaexpiracion', nacionalidad:'nacionalidad' },
  vehicles: { marca:'marca', modelo:'modelo', matricula:'matricula', ancho:'ancho', largo:'largo', alto:'alto' },
  invoices: { numero:'numero', fecha:'fecha', importe:'importe', estado:'estado', archivo:'archivo' },
  administrators: { nombre:'nombre', email:'email', usuario:'usuario', activo:'activo', fecha:'fecha', acciones:'acciones' },
  frequent_passengers: { nombre:'nombre', apellido1:'apellido1', apellido2:'apellido2', email:'email', telefono:'telefono', fnac:'fnac', nacionalidad:'nacionalidad', tipoDoc:'tipodoc', numDoc:'numdoc', expDoc:'expdoc' },
};

function toDbColumns(table, obj) {
  const map = DB_MAP[table] || {};
  const cols = [];
  const vals = [];
  let idx = 1;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'created_at' || k === 'updated_at') continue;
    const col = map[k] || k;
    cols.push(col);
    vals.push(v);
    idx++;
  }
  return { cols, vals, placeholders: cols.map((_, i) => `$${i + 1}`).join(',') };
}

// ── CRUD ──
async function getAll(table) {
  const { rows } = await query(`SELECT * FROM ${table} ORDER BY id`);
  return rows.map(r => toCamel(table, r));
}

async function getById(table, id) {
  const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return rows.length ? toCamel(table, rows[0]) : null;
}

async function insertRow(table, data) {
  const { cols, vals, placeholders } = toDbColumns(table, data);
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await query(sql, vals);
  return toCamel(table, rows[0]);
}

async function updateRow(table, id, data) {
  const { cols, vals } = toDbColumns(table, data);
  if (cols.length === 0) return getById(table, id);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
  const { rows } = await query(sql, [...vals, id]);
  return rows.length ? toCamel(table, rows[0]) : null;
}

async function deleteRow(table, id) {
  const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return rowCount;
}

module.exports = { init, query, getAll, getById, insertRow, updateRow, deleteRow, toCamel, toDbColumns };