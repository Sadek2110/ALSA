const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockVerify = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
    verify: mockVerify,
  }),
}));

// Set a temporary data directory for testing
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoto-api-test-'));
process.env.DATA_DIR = testDataDir;
process.env.SESSION_SECRET = 'test-secret';

const app = require('../server');
const store = require('../store');

/* ===================================================================
   HELPERS
   =================================================================== */
function makeAgent() {
  const ag = request.agent(app);
  return ag
    .post('/api/auth/login')
    .send({ email: 'admin@kikoto.com', password: 'Admin123' })
    .then(() => ag);
}

async function getNewId(agent, endpoint) {
  const res = await agent.get(endpoint);
  if (!res.body.length) return null;
  return Math.max(...res.body.map((r) => r.id));
}

/* ===================================================================
   TESTS
   =================================================================== */
describe('API Integration Tests', () => {
  let agent;

  beforeAll(async () => {
    store.load();
    agent = await makeAgent();
  });

  afterAll(() => {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  /* ─────────────────────────────────────────────────────────────
     AUTH
     ───────────────────────────────────────────────────────────── */
  describe('Auth', () => {
    test('GET / returns index.html (sanity check)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<!DOCTYPE html>');
    });

    test('POST /api/auth/login with valid demo creds', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@kikoto.com', password: 'Admin123' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@kikoto.com');
    });

    test('POST /api/auth/login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@kikoto.com', password: 'WrongPass' });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('incorrectas');
    });

    test('POST /api/auth/login with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: '' });
      expect(res.status).toBe(400);
    });

    test('POST /api/auth/login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'Admin123' });
      expect(res.status).toBe(400);
    });

    test('POST /api/auth/login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noexiste@kikoto.com', password: 'Admin123' });
      expect(res.status).toBe(401);
    });

    test('GET /api/auth/me returns session info after login', async () => {
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@kikoto.com');
    });

    test('GET /api/auth/me fails without session', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('POST /api/auth/logout clears session', async () => {
      const a = await makeAgent();
      await a.post('/api/auth/logout');
      const res = await a.get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     BOOKINGS
     ───────────────────────────────────────────────────────────── */
  describe('Bookings', () => {
    let bookingId;

    test('GET /api/bookings returns list', async () => {
      const res = await agent.get('/api/bookings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/bookings fails without auth', async () => {
      const res = await request(app).get('/api/bookings');
      expect(res.status).toBe(401);
    });

    test('POST /api/bookings creates a new booking and sends email', async () => {
      mockSendMail.mockClear();
      const res = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'Algeciras',
        destination: 'Ceuta',
        naviera: 'Baleària',
        departureDate: '2026-05-15',
        passengers: [
          { nombre: 'Test', apellido1: 'User', email: 'test@user.com' },
        ],
      });
      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].origin).toBe('Algeciras');
      expect(res.body[0].passengerName).toBe('Test User');
      bookingId = res.body[0].id;
    });

    test('POST /api/bookings creates a group booking with multiple passengers', async () => {
      mockSendMail.mockClear();
      const res = await agent.post('/api/bookings').send({
        tripType: 'idayvuelta',
        origin: 'Barcelona',
        destination: 'Palma',
        naviera: 'Trasmediterránea',
        departureDate: '2026-06-01',
        departureTime: '10:00',
        returnDate: '2026-06-08',
        returnTime: '18:00',
        vehicleData: { marca: 'Ford', modelo: 'Transit', ancho: 2.0, largo: 5.5, alto: 2.55 },
        vehicleCount: 2,
        groupId: 'GRP-TEST',
        passengers: [
          { nombre: 'Pax1', apellido1: 'Uno',  email: 'pax1@test.com' },
          { nombre: 'Pax2', apellido1: 'Dos',  email: 'pax2@test.com' },
          { nombre: 'Pax3', apellido1: 'Tres', email: 'pax3@test.com' },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.length).toBe(3);
      expect(res.body[0].vehicleData).not.toBeNull();
      expect(res.body[0].groupId).toBe('GRP-TEST');
    });

    test('POST /api/bookings rejects self-route (origin = destination)', async () => {
      const res = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'Ceuta',
        destination: 'Ceuta',
        naviera: 'Baleària',
        departureDate: '2026-05-15',
        passengers: [{ nombre: 'X', apellido1: 'Y', email: 'x@y.com' }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('mismo');
    });

    test('POST /api/bookings rejects invalid tripType', async () => {
      const res = await agent.post('/api/bookings').send({
        tripType: 'invalido',
        origin: 'Algeciras',
        destination: 'Ceuta',
        naviera: 'Baleària',
        departureDate: '2026-05-15',
        passengers: [{ nombre: 'X', apellido1: 'Y', email: 'x@y.com' }],
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/bookings rejects missing passengers', async () => {
      const res = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'A',
        destination: 'B',
        naviera: 'C',
        departureDate: '2026-05-15',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('pasajero');
    });

    test('POST /api/bookings rejects missing required fields', async () => {
      const res = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'Algeciras',
        // missing destination, naviera, departureDate
        passengers: [{ nombre: 'X', apellido1: 'Y', email: 'x@y.com' }],
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/bookings rejects invalid passenger email', async () => {
      const res = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'Algeciras',
        destination: 'Ceuta',
        naviera: 'Baleària',
        departureDate: '2026-05-15',
        passengers: [{ nombre: 'X', apellido1: 'Y', email: 'email-invalido' }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('inválido');
    });

    test('PATCH /api/bookings/:id updates localizador and changes estado to Confirmado', async () => {
      const res = await agent
        .patch(`/api/bookings/${bookingId}`)
        .send({ localizador: 'TSTLOC1' });
      expect(res.status).toBe(200);
      expect(res.body.localizador).toBe('TSTLOC1');
      expect(res.body.estado).toBe('Confirmado');
    });

    test('PATCH /api/bookings/:id rejects invalid localizador format', async () => {
      const res = await agent
        .patch(`/api/bookings/${bookingId}`)
        .send({ localizador: 'too-long-localizador-123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Formato');
    });

    test('PATCH /api/bookings/:id sets estado to Cancelado', async () => {
      const res = await agent
        .patch(`/api/bookings/${bookingId}`)
        .send({ estado: 'Cancelado' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('Cancelado');
    });

    test('PATCH /api/bookings/:id rejects invalid estado', async () => {
      const res = await agent
        .patch(`/api/bookings/${bookingId}`)
        .send({ estado: 'Inventado' });
      expect(res.status).toBe(400);
    });

    test('PATCH /api/bookings/:id returns 404 for non-existent booking', async () => {
      const res = await agent.patch('/api/bookings/99999').send({ localizador: 'ABC123' });
      expect(res.status).toBe(404);
    });

    test('PUT /api/bookings/:id updates booking details (no vehicle assigned)', async () => {
      // Create a booking without vehicle
      mockSendMail.mockClear();
      const createRes = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'Tarifa',
        destination: 'Tánger',
        naviera: 'FRS',
        departureDate: '2026-07-01',
        passengers: [{ nombre: 'Edit', apellido1: 'Me', email: 'edit@me.com' }],
      });
      const id = createRes.body[0].id;

      const res = await agent.put(`/api/bookings/${id}`).send({
        origin: 'Algeciras',
        destination: 'Ceuta',
        naviera: 'Balearia',
      });
      expect(res.status).toBe(200);
      expect(res.body.origin).toBe('Algeciras');
      expect(res.body.destination).toBe('Ceuta');
      expect(res.body.naviera).toBe('Balearia');
    });

    test('PUT /api/bookings/:id blocks vehicle field edits on booking with vehicle', async () => {
      // Booking #1 has vehicle data (Mercedes Sprinter in seed data)
      const res = await agent.put('/api/bookings/1').send({
        vehMarca: 'Toyota',
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('vehículo');
    });

    test('PUT /api/bookings/:id allows non-vehicle edits on booking with vehicle', async () => {
      // Booking #1 has vehicle data but we edit passenger fields only
      const res = await agent.put('/api/bookings/1').send({
        paxNombre: 'NuevoNombre',
      });
      expect(res.status).toBe(200);
      expect(res.body.paxNombre).toBe('NuevoNombre');
    });

    test('PUT /api/bookings/:id returns 404 for non-existent booking', async () => {
      const res = await agent.put('/api/bookings/99999').send({ origin: 'X' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/bookings/:id removes a booking', async () => {
      mockSendMail.mockClear();
      const createRes = await agent.post('/api/bookings').send({
        tripType: 'ida',
        origin: 'X',
        destination: 'Y',
        naviera: 'Z',
        departureDate: '2026-08-01',
        passengers: [{ nombre: 'Del', apellido1: 'Me', email: 'del@me.com' }],
      });
      const id = createRes.body[0].id;

      const res = await agent.delete(`/api/bookings/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminada');
    });

    test('DELETE /api/bookings/:id returns 404 for non-existent booking', async () => {
      const res = await agent.delete('/api/bookings/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/bookings/:id fails without auth', async () => {
      const res = await request(app).delete('/api/bookings/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     MEMBERS
     ───────────────────────────────────────────────────────────── */
  describe('Members', () => {
    let memberId;

    test('GET /api/members returns list', async () => {
      const res = await agent.get('/api/members');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/members fails without auth', async () => {
      const res = await request(app).get('/api/members');
      expect(res.status).toBe(401);
    });

    test('POST /api/members creates a new member', async () => {
      const res = await agent.post('/api/members').send({
        nombre: 'Pedro',
        apellido1: 'Jiménez',
        apellido2: 'Ruiz',
        dni: '34567890Z',
        fechaNacimiento: '1992-04-10',
        fechaExpiracion: '2028-04-10',
        email: 'pedro@ejemplo.com',
        telefono: '611222333',
        telefonoPrefix: '+34',
        nacionalidad: 'ES',
        tipoDoc: 'DNI',
      });
      expect(res.status).toBe(201);
      expect(res.body.nombre).toBe('Pedro');
      memberId = res.body.id;
    });

    test('POST /api/members rejects duplicate DNI', async () => {
      const res = await agent.post('/api/members').send({
        nombre: 'Dupe',
        apellido1: 'Test',
        dni: '34567890Z',
        fechaNacimiento: '1990-01-01',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('existe');
    });

    test('POST /api/members rejects invalid DNI format', async () => {
      const res = await agent.post('/api/members').send({
        nombre: 'Bad',
        apellido1: 'Dni',
        dni: '1234567', // 7 digits, missing 1 + letter
        fechaNacimiento: '1990-01-01',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('DNI');
    });

    test('POST /api/members rejects missing nombre', async () => {
      const res = await agent.post('/api/members').send({
        apellido1: 'SinNombre',
        dni: '11111111H',
        fechaNacimiento: '1990-01-01',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/members rejects invalid fecha format', async () => {
      const res = await agent.post('/api/members').send({
        nombre: 'Bad',
        apellido1: 'Date',
        dni: '22222222J',
        fechaNacimiento: '01-01-1990', // wrong format
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/members rejects expiracion <= nacimiento', async () => {
      const res = await agent.post('/api/members').send({
        nombre: 'Bad',
        apellido1: 'Exp',
        dni: '33333333K',
        fechaNacimiento: '2000-01-01',
        fechaExpiracion: '1999-12-31',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('posterior');
    });

    test('PUT /api/members/:id updates a member', async () => {
      const res = await agent.put(`/api/members/${memberId}`).send({
        nombre: 'Pedro Modificado',
        email: 'pedro.mod@ejemplo.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe('Pedro Modificado');
      expect(res.body.email).toBe('pedro.mod@ejemplo.com');
    });

    test('PUT /api/members/:id rejects changing to existing DNI', async () => {
      const res = await agent.put(`/api/members/${memberId}`).send({
        dni: '12345678A', // already exists in seed data (María)
      });
      expect(res.status).toBe(409);
    });

    test('PUT /api/members/:id returns 404 for non-existent', async () => {
      const res = await agent.put('/api/members/99999').send({ nombre: 'X' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/members/:id removes a member', async () => {
      const res = await agent.delete(`/api/members/${memberId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminado');
    });

    test('DELETE /api/members/:id returns 404 for non-existent', async () => {
      const res = await agent.delete('/api/members/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/members/:id fails without auth', async () => {
      const res = await request(app).delete('/api/members/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     VEHICLES
     ───────────────────────────────────────────────────────────── */
  describe('Vehicles', () => {
    let vehicleId;

    test('GET /api/vehicles returns active vehicles', async () => {
      const res = await agent.get('/api/vehicles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/vehicles fails without auth', async () => {
      const res = await request(app).get('/api/vehicles');
      expect(res.status).toBe(401);
    });

    test('POST /api/vehicles creates a new vehicle', async () => {
      const res = await agent.post('/api/vehicles').send({
        marca: 'Peugeot',
        modelo: 'Boxer',
        matricula: '1111ZZZ',
        ancho: 2.0,
        largo: 5.4,
        alto: 2.5,
      });
      expect(res.status).toBe(201);
      expect(res.body.marca).toBe('Peugeot');
      vehicleId = res.body.id;
    });

    test('POST /api/vehicles rejects missing marca', async () => {
      const res = await agent.post('/api/vehicles').send({
        modelo: 'SinMarca',
        ancho: 2,
        largo: 5,
        alto: 2,
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/vehicles rejects zero dimensions', async () => {
      const res = await agent.post('/api/vehicles').send({
        marca: 'Bad',
        modelo: 'Dim',
        ancho: 0,
        largo: 0,
        alto: 0,
      });
      expect(res.status).toBe(400);
    });

    test('PUT /api/vehicles/:id updates a vehicle', async () => {
      const res = await agent.put(`/api/vehicles/${vehicleId}`).send({
        marca: 'Citroën',
        modelo: 'Jumper',
        matricula: '2222YYY',
      });
      expect(res.status).toBe(200);
      expect(res.body.marca).toBe('Citroën');
      expect(res.body.matricula).toBe('2222YYY');
    });

    test('PUT /api/vehicles/:id returns 404 for non-existent', async () => {
      const res = await agent.put('/api/vehicles/99999').send({ marca: 'X' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/vehicles/:id soft-deletes (sets is_active=0)', async () => {
      const res = await agent.delete(`/api/vehicles/${vehicleId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminado');
      // Vehicle should no longer appear in list
      const list = await agent.get('/api/vehicles');
      const found = list.body.find((v) => v.id === vehicleId);
      expect(found).toBeUndefined();
    });

    test('DELETE /api/vehicles/:id returns 404 for non-existent', async () => {
      const res = await agent.delete('/api/vehicles/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/vehicles/:id fails without auth', async () => {
      const res = await request(app).delete('/api/vehicles/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     INVOICES
     ───────────────────────────────────────────────────────────── */
  describe('Invoices', () => {
    let invoiceId;

    test('GET /api/invoices returns list sorted by date desc', async () => {
      const res = await agent.get('/api/invoices');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/invoices fails without auth', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(401);
    });

    test('POST /api/invoices creates a new invoice (no file)', async () => {
      const res = await agent.post('/api/invoices').send({
        numero: 'FAC-TEST-001',
        fecha: '2026-05-01',
        importe: 1500.50,
        estado: 'Pendiente',
      });
      expect(res.status).toBe(201);
      expect(res.body.numero).toBe('FAC-TEST-001');
      invoiceId = res.body.id;
    });

    test('POST /api/invoices rejects duplicate invoice number', async () => {
      const res = await agent.post('/api/invoices').send({
        numero: 'FAC-TEST-001',
        fecha: '2026-05-01',
        importe: 100,
        estado: 'Pendiente',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('existe');
    });

    test('POST /api/invoices rejects missing numero', async () => {
      const res = await agent.post('/api/invoices').send({
        fecha: '2026-05-01',
        importe: 100,
        estado: 'Pendiente',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/invoices rejects invalid fecha', async () => {
      const res = await agent.post('/api/invoices').send({
        numero: 'FAC-BAD',
        fecha: 'bad-date',
        importe: 100,
        estado: 'Pendiente',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/invoices rejects zero importe', async () => {
      const res = await agent.post('/api/invoices').send({
        numero: 'FAC-ZERO',
        fecha: '2026-05-01',
        importe: 0,
        estado: 'Pendiente',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/invoices rejects invalid estado', async () => {
      const res = await agent.post('/api/invoices').send({
        numero: 'FAC-BAD-EST',
        fecha: '2026-05-01',
        importe: 100,
        estado: 'Cobrada',
      });
      expect(res.status).toBe(400);
    });

    test('PATCH /api/invoices/:id updates estado to Pagada', async () => {
      const res = await agent.patch(`/api/invoices/${invoiceId}`).send({
        estado: 'Pagada',
      });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('Pagada');
    });

    test('PATCH /api/invoices/:id rejects invalid estado', async () => {
      const res = await agent.patch(`/api/invoices/${invoiceId}`).send({
        estado: 'Inventado',
      });
      expect(res.status).toBe(400);
    });

    test('PATCH /api/invoices/:id updates other fields', async () => {
      const res = await agent.patch(`/api/invoices/${invoiceId}`).send({
        numero: 'FAC-MOD-001',
        importe: 999.99,
      });
      expect(res.status).toBe(200);
      expect(res.body.numero).toBe('FAC-MOD-001');
      expect(res.body.importe).toBe(999.99);
    });

    test('PATCH /api/invoices/:id returns 404 for non-existent', async () => {
      const res = await agent.patch('/api/invoices/99999').send({ estado: 'Pagada' });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/invoices/:id removes an invoice', async () => {
      const res = await agent.delete(`/api/invoices/${invoiceId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminada');
    });

    test('DELETE /api/invoices/:id returns 404 for non-existent', async () => {
      const res = await agent.delete('/api/invoices/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/invoices/:id fails without auth', async () => {
      const res = await request(app).delete('/api/invoices/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     ADMINS
     ───────────────────────────────────────────────────────────── */
  describe('Admins', () => {
    let adminId;

    test('GET /api/admins returns list with last action', async () => {
      const res = await agent.get('/api/admins');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/admins fails without auth', async () => {
      const res = await request(app).get('/api/admins');
      expect(res.status).toBe(401);
    });

    test('POST /api/admins creates invitation', async () => {
      const res = await agent.post('/api/admins').send({
        email: 'nuevo.admin@kikoto.com',
        usuario: 'nuevo.admin',
      });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('nuevo.admin@kikoto.com');
      expect(res.body.activo).toBe(false);
      expect(res.body.invitationToken).toBeDefined();
      adminId = res.body.id;
    });

    test('POST /api/admins rejects invalid email', async () => {
      const res = await agent.post('/api/admins').send({
        email: 'bad-email',
        usuario: 'test',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/admins rejects short username', async () => {
      const res = await agent.post('/api/admins').send({
        email: 'test@kikoto.com',
        usuario: 'ab', // < 3 chars
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/admins rejects duplicate email', async () => {
      const res = await agent.post('/api/admins').send({
        email: 'nuevo.admin@kikoto.com',
        usuario: 'otro.user',
      });
      expect(res.status).toBe(409);
    });

    test('PATCH /api/admins/:id toggles is_active', async () => {
      const res = await agent.patch(`/api/admins/${adminId}`).send({
        activo: false,
      });
      expect(res.status).toBe(200);
    });

    test('PATCH /api/admins/:id returns 404 for non-existent', async () => {
      const res = await agent.patch('/api/admins/99999').send({ activo: true });
      expect(res.status).toBe(404);
    });

    test('DELETE /api/admins/:id removes an admin', async () => {
      const res = await agent.delete(`/api/admins/${adminId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminado');
    });

    test('DELETE /api/admins/:id fails for main admin (id=1)', async () => {
      const res = await agent.delete('/api/admins/1');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('principal');
    });

    test('DELETE /api/admins/:id returns 404 for non-existent', async () => {
      const res = await agent.delete('/api/admins/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/admins/:id fails without auth', async () => {
      const res = await request(app).delete('/api/admins/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     FREQUENT PASSENGERS
     ───────────────────────────────────────────────────────────── */
  describe('Frequent Passengers', () => {
    let fpId;

    test('GET /api/frequent-passengers returns list sorted by name', async () => {
      const res = await agent.get('/api/frequent-passengers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/frequent-passengers fails without auth', async () => {
      const res = await request(app).get('/api/frequent-passengers');
      expect(res.status).toBe(401);
    });

    test('POST /api/frequent-passengers creates a new passenger', async () => {
      const res = await agent.post('/api/frequent-passengers').send({
        nombre: 'Lucía',
        apellido1: 'Fernández',
        apellido2: 'Sanz',
        email: 'lucia@ejemplo.com',
        telefono: '+34 677888999',
        fnac: '1988-07-20',
        nacionalidad: 'ES',
        tipoDoc: 'DNI',
        numDoc: '99999999R',
      });
      expect(res.status).toBe(201);
      expect(res.body.nombre).toBe('Lucía');
      fpId = res.body.id;
    });

    test('POST /api/frequent-passengers rejects duplicate numDoc', async () => {
      const res = await agent.post('/api/frequent-passengers').send({
        nombre: 'Dupe',
        apellido1: 'Test',
        email: 'dup@ejemplo.com',
        numDoc: '99999999R',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('existe');
    });

    test('POST /api/frequent-passengers rejects invalid email', async () => {
      const res = await agent.post('/api/frequent-passengers').send({
        nombre: 'Bad',
        apellido1: 'Email',
        email: 'not-an-email',
        numDoc: '88888888S',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/frequent-passengers rejects missing required fields', async () => {
      const res = await agent.post('/api/frequent-passengers').send({
        nombre: '',
        apellido1: '',
        email: 'test@test.com',
        numDoc: '',
      });
      expect(res.status).toBe(400);
    });

    test('DELETE /api/frequent-passengers/:id removes a passenger', async () => {
      const res = await agent.delete(`/api/frequent-passengers/${fpId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminado');
    });

    test('DELETE /api/frequent-passengers/:id returns 404 for non-existent', async () => {
      const res = await agent.delete('/api/frequent-passengers/99999');
      expect(res.status).toBe(404);
    });

    test('DELETE /api/frequent-passengers/:id fails without auth', async () => {
      const res = await request(app).delete('/api/frequent-passengers/1');
      expect(res.status).toBe(401);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     ROUTES / SAILINGS / TIMETABLES
     ───────────────────────────────────────────────────────────── */
  describe('Routes / Sailings / Timetables', () => {
    test('GET /api/routes returns route list', async () => {
      const res = await agent.get('/api/routes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Without API token, should get demo routes
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/routes fails without auth', async () => {
      const res = await request(app).get('/api/routes');
      expect(res.status).toBe(401);
    });

    test('POST /api/sailings returns demo sailings', async () => {
      const res = await agent.post('/api/sailings').send({
        departure_port_id: 10,
        destination_port_id: 11,
        date: '2026-06-15',
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(0);
      //expect(res.body[0]).toHaveProperty('naviera');
      //expect(res.body[0]).toHaveProperty('departureTime');
    });

    test('POST /api/sailings rejects missing fields', async () => {
      const res = await agent.post('/api/sailings').send({
        departure_port_id: 10,
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/sailings rejects invalid date format', async () => {
      const res = await agent.post('/api/sailings').send({
        departure_port_id: 10,
        destination_port_id: 11,
        date: '15-06-2026',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('fecha');
    });

    test('POST /api/sailings rejects same origin and destination', async () => {
      const res = await agent.post('/api/sailings').send({
        departure_port_id: 10,
        destination_port_id: 10,
        date: '2026-06-15',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('mismo');
    });

    test('POST /api/sailings fails without auth', async () => {
      const res = await request(app).post('/api/sailings').send({
        departure_port_id: 10,
        destination_port_id: 11,
        date: '2026-06-15',
      });
      expect(res.status).toBe(401);
    });

    test('POST /api/timetables returns demo timetables', async () => {
      const res = await agent.post('/api/timetables').send({
        departure_port_id: 10,
        destination_port_id: 11,
        date: '2026-06-15',
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(0);
    });

    test('POST /api/timetables rejects missing fields', async () => {
      const res = await agent.post('/api/timetables').send({
        departure_port_id: 10,
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/timetables rejects same origin and destination', async () => {
      const res = await agent.post('/api/timetables').send({
        departure_port_id: 10,
        destination_port_id: 10,
        date: '2026-06-15',
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/timetables fails without auth', async () => {
      const res = await request(app).post('/api/timetables').send({
        departure_port_id: 10,
        destination_port_id: 11,
        date: '2026-06-15',
      });
      expect(res.status).toBe(401);
    });
  });
});
