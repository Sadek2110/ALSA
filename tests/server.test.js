const request = require('supertest');

// Set environment variables for testing
process.env.SESSION_SECRET = 'test-secret';

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
});
