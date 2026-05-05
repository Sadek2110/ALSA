const request = require('supertest');

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

// Set environment variables for testing
process.env.SESSION_SECRET = 'test-secret';
process.env.GMAIL_USER = 'test@gmail.com';
process.env.GMAIL_PASS = 'testpass';
process.env.NOTIFICATION_EMAIL = 'notify@test.com';

const app = require('../server');

/* ===================================================================
   TESTS
   =================================================================== */
describe('API Integration Tests', () => {

  /* ─────────────────────────────────────────────────────────────
     ROUTES
     ───────────────────────────────────────────────────────────── */
  describe('Routes', () => {
    test('GET / returns index.html (sanity check)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<!DOCTYPE html>');
    });

    test('GET /api/routes returns route list', async () => {
      const res = await request(app).get('/api/routes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  /* ─────────────────────────────────────────────────────────────
     TIMETABLES
     ───────────────────────────────────────────────────────────── */
  describe('Timetables', () => {
    test('POST /api/timetables returns array', async () => {
      const res = await request(app).post('/api/timetables').send({
        departure_port_id: 122,
        destination_port_id: 23,
        date: '2026-06-15',
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/timetables rejects missing departure_port_id', async () => {
      const res = await request(app).post('/api/timetables').send({
        destination_port_id: 23,
        date: '2026-06-15',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('departure_port_id');
    });

    test('POST /api/timetables rejects missing destination_port_id', async () => {
      const res = await request(app).post('/api/timetables').send({
        departure_port_id: 122,
        date: '2026-06-15',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('destination_port_id');
    });

    test('POST /api/timetables rejects missing date', async () => {
      const res = await request(app).post('/api/timetables').send({
        departure_port_id: 122,
        destination_port_id: 23,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('date');
    });

    test('POST /api/timetables rejects invalid date format', async () => {
      const res = await request(app).post('/api/timetables').send({
        departure_port_id: 122,
        destination_port_id: 23,
        date: '15-06-2026',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('fecha');
    });
  });

  /* ─────────────────────────────────────────────────────────────
     BOOKING NOTIFICATION
     ───────────────────────────────────────────────────────────── */
  describe('Booking Notification', () => {
    beforeEach(() => {
      mockSendMail.mockClear();
    });

    test('POST /api/bookings/notify sends email and returns success', async () => {
      const res = await request(app).post('/api/bookings/notify').send({
        origin: 'Algeciras',
        destination: 'Ceuta',
        naviera: 'Balearia',
        tripType: 'ida',
        departureDate: '2026-05-15',
        departureTime: '10:00',
        estado: 'Pendiente',
        passengers: [
          { nombre: 'Test', apellido1: 'User', email: 'test@user.com', tipoDoc: 'DNI', numDoc: '12345678A', isDriver: true },
        ],
        vehicle: { marca: 'Mercedes', modelo: 'Sprinter', matricula: '1234ABC', largo: 5.9, ancho: 2.1, alto: 2.8 },
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Correo enviado');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Algeciras'),
        })
      );
    });

    test('POST /api/bookings/notify sends email without vehicle', async () => {
      const res = await request(app).post('/api/bookings/notify').send({
        origin: 'Ceuta',
        destination: 'Algeciras',
        naviera: 'FRS',
        tripType: 'ida',
        departureDate: '2026-06-01',
        departureTime: '09:00',
        estado: 'Pendiente',
        passengers: [
          { nombre: 'Pax', apellido1: 'One', email: 'pax@test.com', tipoDoc: 'DNI', numDoc: '87654321B' },
        ],
      });
      expect(res.status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    test('POST /api/bookings/notify sends email for round trip with return date', async () => {
      const res = await request(app).post('/api/bookings/notify').send({
        origin: 'Barcelona',
        destination: 'Palma',
        naviera: 'Trasmediterránea',
        tripType: 'idayvuelta',
        departureDate: '2026-07-01',
        departureTime: '10:00',
        returnDate: '2026-07-08',
        returnTime: '18:00',
        estado: 'Pendiente',
        passengers: [
          { nombre: 'Round', apellido1: 'Trip', email: 'round@test.com', tipoDoc: 'DNI', numDoc: '11111111A' },
        ],
      });
      expect(res.status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Barcelona'),
        })
      );
    });

    test('POST /api/bookings/notify rejects incomplete data', async () => {
      const res = await request(app).post('/api/bookings/notify').send({
        origin: '',
        destination: '',
      });
      expect(res.status).toBe(400);
    });
  });
});
