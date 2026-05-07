'use strict';

const { Pool } = require('pg');

jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery,
    on: jest.fn(),
  };
  return {
    Pool: jest.fn(() => mockPool),
    __mockQuery: mockQuery,
  };
});

const db = require('../db');
const { Pool: MockPool } = require('pg');
const mockPool = new MockPool();
const mockQuery = mockPool.query;

describe('db.js — init()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicializa correctamente y crea tablas', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

    await db.init();
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('db.js — getAll()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna filas convertidas a camelCase para bookings', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          triptype: 'ida',
          origin: 'Barcelona',
          destination: 'Mallorca',
          naviera: 'Balearia',
          departuredate: '2025-06-15',
          departuretime: '07:30',
          returndate: null,
          returntime: null,
          localizador: 'ABC123',
          estado: 'Pendiente',
          passengername: 'Juan Garcia',
          email: 'juan@test.com',
          vehicleplate: null,
          paxnombre: 'Juan',
          paxapellido1: 'Garcia',
          paxapellido2: '',
          paxemail: 'juan@test.com',
          paxtelefono: '+34 612345678',
          Paxtipodoc: 'DNI',
          paxnumdoc: '12345678A',
          paxexpdoc: '2030-01-01',
          vehmarca: '',
          vehmodelo: '',
          vehmatricula: '',
          vehlargo: 0,
          vehancho: 0,
          vealto: 0,
          vehiclecount: 1,
          groupid: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const result = await db.getAll('bookings');
    expect(result).toHaveLength(1);
    expect(result[0].tripType).toBe('ida');
    expect(result[0].departureDate).toBe('2025-06-15');
    expect(result[0].departureTime).toBe('07:30');
    expect(result[0].passengerName).toBe('Juan Garcia');
    expect(result[0].paxTipoDoc).toBe('DNI');
  });

  it('retorna filas convertidas para members', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Ana', tipodoc: 'NIE', numdoc: 'Z1234567X' }],
    });
    const result = await db.getAll('members');
    expect(result[0].tipoDoc).toBe('NIE');
    expect(result[0].numDoc).toBe('Z1234567X');
  });

  it('retorna array vacio si no hay filas', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await db.getAll('bookings');
    expect(result).toEqual([]);
  });
});

describe('db.js — getById()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna una fila convertida si existe', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, triptype: 'ida', origin: 'Barcelona' }],
    });
    const result = await db.getById('bookings', 1);
    expect(result).not.toBeNull();
    expect(result.tripType).toBe('ida');
  });

  it('retorna null si no existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await db.getById('bookings', 9999);
    expect(result).toBeNull();
  });
});

describe('db.js — insertRow()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserta una fila y la retorna convertida', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, triptype: 'ida', origin: 'Barcelona' }],
    });
    const result = await db.insertRow('bookings', { tripType: 'ida', origin: 'Barcelona' });
    expect(result.tripType).toBe('ida');
  });

  it('genera SQL correcto con columnas y placeholders', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, nombre: 'Carlos', apellido1: 'Ruiz' }],
    });
    await db.insertRow('members', { nombre: 'Carlos', apellido1: 'Ruiz' });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/INSERT INTO members/);
    expect(sql).toMatch(/RETURNING \*/);
  });
});

describe('db.js — updateRow()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('actualiza una fila y la retorna convertida', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, triptype: 'idayvuelta', origin: 'Barcelona' }],
    });
    const result = await db.updateRow('bookings', 1, { tripType: 'idayvuelta' });
    expect(result.tripType).toBe('idayvuelta');
  });

  it('retorna null si la fila no existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await db.updateRow('bookings', 9999, { tripType: 'ida' });
    expect(result).toBeNull();
  });

  it('incluye updated_at = NOW() en la actualizacion', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await db.updateRow('bookings', 1, { estado: 'Confirmado' });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/updated_at = NOW\(\)/);
  });
});

describe('db.js — deleteRow()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elimina una fila y retorna el rowCount', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const result = await db.deleteRow('bookings', 1);
    expect(result).toBe(1);
  });

  it('retorna 0 si la fila no existe', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const result = await db.deleteRow('bookings', 9999);
    expect(result).toBe(0);
  });
});

describe('db.js — query()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ejecuta query con parametros', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const result = await db.query('SELECT * FROM bookings WHERE id = $1', [1]);
    expect(result.rows).toHaveLength(1);
  });
});