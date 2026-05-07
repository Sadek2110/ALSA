'use strict';

const { toCamel, toDbColumns } = require('../db');

describe('db.js — toCamel', () => {
  it('convierte columnas snake_case a camelCase para bookings', () => {
    const row = {
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
      paxapellido2: 'Lopez',
      paxemail: 'juan@test.com',
      paxtelefono: '+34 612345678',
      Paxtipodoc: 'DNI',
      paxnumdoc: '12345678A',
      paxexpdoc: '2030-01-01',
      vehmarca: 'Mercedes',
      vehmodelo: 'Sprinter',
      vehmatricula: '1234BBB',
      vehlargo: 5.9,
      vehancho: 2.1,
      vealto: 2.8,
      vehiclecount: 1,
      groupid: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('bookings', row);
    expect(result.tripType).toBe('ida');
    expect(result.departureDate).toBe('2025-06-15');
    expect(result.departureTime).toBe('07:30');
    expect(result.returnDate).toBeNull();
    expect(result.passengerName).toBe('Juan Garcia');
    expect(result.paxTipoDoc).toBe('DNI');
    expect(result.paxNumDoc).toBe('12345678A');
    expect(result.vehMarca).toBe('Mercedes');
    expect(result.vehLargo).toBe(5.9);
    expect(result.vehAncho).toBe(2.1);
    expect(result.vehAlto).toBe(2.8);
    expect(result.vehicleCount).toBe(1);
    expect(result.groupId).toBeNull();
  });

  it('convierte columnas snake_case a camelCase para members', () => {
    const row = {
      id: 1,
      nombre: 'Ana',
      apellido: 'Martinez',
      apellido1: 'Martinez',
      apellido2: 'Sanz',
      dni: '87654321B',
      tipodoc: 'NIE',
      numdoc: 'Z1234567X',
      expdoc: '2031-06-01',
      email: 'ana@test.com',
      telefono: '+34 698765432',
      fechanacimiento: '1990-05-20',
      fechaexpiracion: '2031-06-01',
      nacionalidad: 'ES',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('members', row);
    expect(result.tipoDoc).toBe('NIE');
    expect(result.numDoc).toBe('Z1234567X');
    expect(result.fechaNacimiento).toBe('1990-05-20');
    expect(result.fechaExpiracion).toBe('2031-06-01');
  });

  it('convierte columnas snake_case a camelCase para vehicles', () => {
    const row = {
      id: 1, marca: 'Ford', modelo: 'Transit', matricula: '5678CCC',
      ancho: 2.2, largo: 6.0, alto: 2.9,
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('vehicles', row);
    expect(result.marca).toBe('Ford');
    expect(result.modelo).toBe('Transit');
    expect(result.matricula).toBe('5678CCC');
  });

  it('convierte columnas para invoices', () => {
    const row = {
      id: 1, numero: 'INV-001', fecha: '2025-01-15',
      importe: 150.50, estado: 'Pendiente', archivo: null,
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('invoices', row);
    expect(result.numero).toBe('INV-001');
    expect(result.importe).toBe(150.50);
    expect(result.estado).toBe('Pendiente');
  });

  it('convierte columnas para administrators', () => {
    const row = {
      id: 1, nombre: 'Admin Principal', email: 'admin@alsa.com',
      usuario: 'admin', activo: true, fecha: '2025-01-01', acciones: 'Acceso completo',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('administrators', row);
    expect(result.usuario).toBe('admin');
    expect(result.activo).toBe(true);
  });

  it('convierte columnas para frequent_passengers', () => {
    const row = {
      id: 1, nombre: 'Carlos', apellido1: 'Ruiz', apellido2: ' Perez',
      email: 'carlos@test.com', telefono: '+34 611222333',
      fnac: '1985-03-10', nacionalidad: 'ES',
      tipodoc: 'DNI', numdoc: '11222333C', expdoc: '2029-12-31',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    const result = toCamel('frequent_passengers', row);
    expect(result.tipoDoc).toBe('DNI');
    expect(result.numDoc).toBe('11222333C');
  });

  it('deja claves sin mapear tal cual', () => {
    const result = toCamel('bookings', { id: 5, unknown_col: 'val' });
    expect(result.id).toBe(5);
    expect(result.unknown_col).toBe('val');
  });

  it('retorna objeto vacío para tabla desconocida', () => {
    const result = toCamel('nonexistent', { id: 1 });
    expect(result.id).toBe(1);
  });
});

describe('db.js — toDbColumns', () => {
  it('convierte camelCase a columnas DB para bookings', () => {
    const data = {
      tripType: 'ida',
      origin: 'Barcelona',
      destination: 'Mallorca',
      naviera: 'Balearia',
      departureDate: '2025-06-15',
      departureTime: '07:30',
      returnDate: null,
      returnTime: null,
      estado: 'Pendiente',
      passengerName: 'Juan Garcia',
      paxTipoDoc: 'DNI',
      paxNumDoc: '12345678A',
      vehMarca: 'Mercedes',
    };
    const result = toDbColumns('bookings', data);
    expect(result.cols).toContain('triptype');
    expect(result.cols).toContain('origin');
    expect(result.cols).toContain('departuredate');
    expect(result.cols).toContain('Paxtipodoc');
    expect(result.vals).toContain('ida');
    expect(result.vals).toContain('Barcelona');
    expect(result.vals).toContain('DNI');
  });

  it('ignora id, created_at y updated_at', () => {
    const data = { id: 99, created_at: 'xxx', updated_at: 'yyy', nombre: 'Test' };
    const result = toDbColumns('members', data);
    expect(result.cols).not.toContain('id');
    expect(result.cols).not.toContain('created_at');
    expect(result.cols).not.toContain('updated_at');
    expect(result.cols).toContain('nombre');
  });

  it('genera placeholders $1, $2, etc.', () => {
    const data = { nombre: 'A', apellido1: 'B' };
    const result = toDbColumns('members', data);
    expect(result.placeholders).toBe('$1,$2');
  });

  it('convierte camelCase a columnas DB para members', () => {
    const data = { tipoDoc: 'NIE', numDoc: 'Z1234567X', fechaNacimiento: '1990-05-20' };
    const result = toDbColumns('members', data);
    expect(result.cols).toContain('tipodoc');
    expect(result.cols).toContain('numdoc');
    expect(result.cols).toContain('fechanacimiento');
  });

  it('convierte camelCase a columnas DB para vehicles', () => {
    const data = { marca: 'Ford', modelo: 'Transit', matricula: '5678CCC' };
    const result = toDbColumns('vehicles', data);
    expect(result.cols).toEqual(['marca', 'modelo', 'matricula']);
    expect(result.vals).toEqual(['Ford', 'Transit', '5678CCC']);
  });

  it('convierte camelCase a columnas DB para invoices', () => {
    const data = { numero: 'INV-001', importe: 150.5, estado: 'Pendiente' };
    const result = toDbColumns('invoices', data);
    expect(result.cols).toContain('numero');
    expect(result.cols).toContain('importe');
  });

  it('convierte para frequent_passengers', () => {
    const data = { tipoDoc: 'DNI', numDoc: '111', expDoc: '2029-12-31' };
    const result = toDbColumns('frequent_passengers', data);
    expect(result.cols).toContain('tipodoc');
    expect(result.cols).toContain('numdoc');
    expect(result.cols).toContain('expdoc');
  });

  it('retorna cols vacío para objeto vacío', () => {
    const result = toDbColumns('bookings', {});
    expect(result.cols).toEqual([]);
    expect(result.vals).toEqual([]);
    expect(result.placeholders).toBe('');
  });
});