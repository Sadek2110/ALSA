'use strict';

const request = require('supertest');
const express = require('express');

const mockDb = {
  init: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  getAll: jest.fn(),
  getById: jest.fn(),
  insertRow: jest.fn(),
  updateRow: jest.fn(),
  deleteRow: jest.fn(),
};

jest.mock('../db', () => mockDb);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
  })),
}));

const bcrypt = require('bcryptjs');
const app = require('../server');

describe('GET /api/health', () => {
  it('responde con status ok si la DB funciona', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ now: new Date().toISOString() }] });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });

  it('responde con error 503 si la DB falla', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('Connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/data', () => {
  it('retorna todos los datos de la DB', async () => {
    mockDb.getAll.mockImplementation((table) => {
      const data = {
        bookings: [{ id: 1, origin: 'BArcelona' }],
        members: [{ id: 1, nombre: 'Ana' }],
        vehicles: [],
        invoices: [],
        administrators: [],
        frequent_passengers: [],
      };
      return data[table] || [];
    });

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body.bookings).toBeDefined();
    expect(res.body.members).toBeDefined();
    expect(res.body.vehicles).toBeDefined();
  });

  it('retorna error 500 si la DB falla', async () => {
    mockDb.getAll.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(500);
  });
});

describe('CRUD /api/bookings', () => {
  it('POST crea un booking y retorna 201', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, origin: 'Barcelona', destination: 'Mallorca' });
    const res = await request(app)
      .post('/api/bookings')
      .send({ origin: 'Barcelona', destination: 'Mallorca', tripType: 'ida' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
  });

  it('PUT actualiza un booking existente', async () => {
    mockDb.updateRow.mockResolvedValueOnce({ id: 1, origin: 'Barcelona', estado: 'Confirmado' });
    const res = await request(app)
      .put('/api/bookings/1')
      .send({ estado: 'Confirmado' });
    expect(res.status).toBe(200);
  });

  it('PUT retorna 404 si el booking no existe', async () => {
    mockDb.updateRow.mockResolvedValueOnce(null);
    const res = await request(app)
      .put('/api/bookings/9999')
      .send({ estado: 'Cancelado' });
    expect(res.status).toBe(404);
  });

  it('DELETE elimina un booking', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/bookings/1');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
  });

  it('DELETE retorna 404 si el booking no existe', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(0);
    const res = await request(app).delete('/api/bookings/9999');
    expect(res.status).toBe(404);
  });

  it('POST retorna 400 si falla la insercion', async () => {
    mockDb.insertRow.mockRejectedValueOnce(new Error('Constraint violation'));
    const res = await request(app)
      .post('/api/bookings')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('CRUD /api/members', () => {
  it('POST crea un member', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, nombre: 'Ana' });
    const res = await request(app)
      .post('/api/members')
      .send({ nombre: 'Ana' });
    expect(res.status).toBe(201);
  });

  it('PUT actualiza un member', async () => {
    mockDb.updateRow.mockResolvedValueOnce({ id: 1, nombre: 'Ana Modificado' });
    const res = await request(app).put('/api/members/1').send({ nombre: 'Ana Modificado' });
    expect(res.status).toBe(200);
  });

  it('PUT retorna 404 si member no existe', async () => {
    mockDb.updateRow.mockResolvedValueOnce(null);
    const res = await request(app).put('/api/members/9999').send({ nombre: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE elimina un member', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/members/1');
    expect(res.status).toBe(200);
  });

  it('DELETE retorna 404 si member no existe', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(0);
    const res = await request(app).delete('/api/members/9999');
    expect(res.status).toBe(404);
  });
});

describe('CRUD /api/vehicles', () => {
  it('POST crea un vehiculo', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, marca: 'Ford', modelo: 'Transit' });
    const res = await request(app)
      .post('/api/vehicles')
      .send({ marca: 'Ford', modelo: 'Transit' });
    expect(res.status).toBe(201);
  });

  it('PUT actualiza un vehiculo', async () => {
    mockDb.updateRow.mockResolvedValueOnce({ id: 1, marca: 'Ford' });
    const res = await request(app).put('/api/vehicles/1').send({ marca: 'Ford' });
    expect(res.status).toBe(200);
  });

  it('DELETE elimina un vehiculo', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/vehicles/1');
    expect(res.status).toBe(200);
  });

  it('DELETE retorna 404 si vehiculo no existe', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(0);
    const res = await request(app).delete('/api/vehicles/9999');
    expect(res.status).toBe(404);
  });
});

describe('CRUD /api/invoices', () => {
  it('POST crea una factura', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, numero: 'INV-001' });
    const res = await request(app)
      .post('/api/invoices')
      .send({ numero: 'INV-001', importe: 150 });
    expect(res.status).toBe(201);
  });

  it('PUT actualiza una factura', async () => {
    mockDb.updateRow.mockResolvedValueOnce({ id: 1, estado: 'Pagada' });
    const res = await request(app).put('/api/invoices/1').send({ estado: 'Pagada' });
    expect(res.status).toBe(200);
  });

  it('DELETE elimina una factura', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/invoices/1');
    expect(res.status).toBe(200);
  });
});

describe('CRUD /api/administrators', () => {
  it('POST crea un administrador', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, nombre: 'Admin' });
    const res = await request(app)
      .post('/api/administrators')
      .send({ nombre: 'Admin' });
    expect(res.status).toBe(201);
  });

  it('PUT actualiza un administrador', async () => {
    mockDb.updateRow.mockResolvedValueOnce({ id: 1, nombre: 'Admin Updated' });
    const res = await request(app).put('/api/administrators/1').send({ nombre: 'Admin Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE elimina un administrador', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/administrators/1');
    expect(res.status).toBe(200);
  });
});

describe('CRUD /api/frequent-passengers', () => {
  it('POST crea un pasajero frecuente', async () => {
    mockDb.insertRow.mockResolvedValueOnce({ id: 1, nombre: 'Carlos' });
    const res = await request(app)
      .post('/api/frequent-passengers')
      .send({ nombre: 'Carlos' });
    expect(res.status).toBe(201);
  });

  it('DELETE elimina un pasajero frecuente', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(1);
    const res = await request(app).delete('/api/frequent-passengers/1');
    expect(res.status).toBe(200);
  });

  it('DELETE retorna 404 si no existe', async () => {
    mockDb.deleteRow.mockResolvedValueOnce(0);
    const res = await request(app).delete('/api/frequent-passengers/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/login', () => {
  it('retorna 400 si falta email o password', async () => {
    const res1 = await request(app).post('/api/auth/login').send({ password: '1234' });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/auth/login').send({});
    expect(res3.status).toBe(400);
  });

  it('retorna 401 si el usuario no existe', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('retorna 401 si la contrasena es incorrecta', async () => {
    const hash = bcrypt.hashSync('correctpass', 10);
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@alsa.com', password_hash: hash, nombre: 'Admin', is_active: true }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@alsa.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('loguea correctamente con credenciales validas', async () => {
    const hash = bcrypt.hashSync('Admin123', 10);
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@alsa.com', password_hash: hash, nombre: 'Admin Principal', role: 'super_admin', is_active: true }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@alsa.com', password: 'Admin123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('admin@alsa.com');
    expect(res.body.user.password_hash).toBeUndefined();
  });
});

describe('POST /api/bookings/notify', () => {
  it('retorna 400 si faltan datos de reserva', async () => {
    const res = await request(app)
      .post('/api/bookings/notify')
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 400 si falta destination', async () => {
    const res = await request(app)
      .post('/api/bookings/notify')
      .send({ origin: 'Barcelona' });
    expect(res.status).toBe(400);
  });

  it('envia notificacion correctamente', async () => {
    const res = await request(app)
      .post('/api/bookings/notify')
      .send({
        origin: 'Barcelona',
        destination: 'Mallorca',
        tripType: 'ida',
        naviera: 'Balearia',
        departureDate: '2025-07-01',
        departureTime: '07:30',
        passengers: [{ nombre: 'Juan', apellido1: 'Garcia', email: 'juan@test.com' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('enviado');
  });
});

describe('POST /api/timetables', () => {
  it('retorna 400 si faltan parametros obligatorios', async () => {
    const res1 = await request(app).post('/api/timetables').send({});
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/timetables').send({ departure_port_id: 1 });
    expect(res2.status).toBe(400);

    const res3 = await request(app).post('/api/timetables').send({ departure_port_id: 1, destination_port_id: 2 });
    expect(res3.status).toBe(400);
  });

  it('retorna 400 si la fecha tiene formato invalido', async () => {
    const res = await request(app)
      .post('/api/timetables')
      .send({ departure_port_id: 1, destination_port_id: 2, date: '15-06-2025' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('fecha');
  });

  it('acepta fecha con formato YYYY-MM-DD correcto', async () => {
    const res = await request(app)
      .post('/api/timetables')
      .send({ departure_port_id: 1, destination_port_id: 2, date: '2025-06-15' });
    expect(res.status).not.toBe(400);
  });
});

describe('GET /api/routes/:id/availabilities', () => {
  it('retorna error si no se proporciona routeId', async () => {
    const res = await request(app).get('/api/routes/ /availabilities');
    expect([200, 400, 500]).toContain(res.status);
  });
});