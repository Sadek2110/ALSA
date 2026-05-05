/* ============================================================
   ALSA — server.js
   Servidor Node.js + Express — Rutas y Horarios
   ============================================================ */

'use strict';

require('dotenv').config();

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HELPERS
// ============================================================
function ok(res, data, status = 200) {
  res.status(status).json(data);
}

function fail(res, message, status = 400) {
  res.status(status).json({ error: message });
}

function isValidDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '');
}

// ============================================================
// KIKOTO API PROXY
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

async function fetchKikotoPost(path, body) {
  if (!KIKOTO_API_TOKEN) {
    console.warn(`[KIKOTO API] No token configured for ${path}. Using empty data.`);
    return { data: [] };
  }
  try {
    const res = await fetch(`${KIKOTO_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIKOTO_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[KIKOTO API] Error fetching ${path}:`, err.message);
    return { data: [] };
  }
}

let routesCache = null, routesCacheTime = 0;
let routesRawCache = null, routesRawCacheTime = 0;

// ============================================================
// ROUTES
// ============================================================
app.get('/api/routes', async (_req, res) => {
  if (routesCache && Date.now() - routesCacheTime < 300000) return ok(res, routesCache);

  try {
    const routesRes = await fetchKikoto('/routes');
    const rawRoutes = routesRes.data || [];

    routesRawCache = rawRoutes;
    routesRawCacheTime = Date.now();

    const mappedRoutes = rawRoutes.map(r => {
      const parts = (r.name || '').split(' - ').map(s => s.trim());
      return {
        id: r.id,
        name: r.name,
        departure_port:   { id: r.departure_port_id,   name: parts[0] || 'Unknown' },
        destination_port: { id: r.destination_port_id, name: parts[1] || 'Unknown' },
      };
    });

    routesCache = mappedRoutes;
    routesCacheTime = Date.now();
    ok(res, routesCache);
  } catch (err) {
    console.error('[ROUTES] Error:', err.message);
    ok(res, []);
  }
});

// ============================================================
// TIMETABLES
// ============================================================
app.post('/api/timetables', async (req, res) => {
  const { departure_port_id, destination_port_id, date } = req.body;
  if (!departure_port_id || !destination_port_id || !date)
    return fail(res, 'departure_port_id, destination_port_id y date son obligatorios.');
  if (!isValidDate(date))
    return fail(res, 'Formato de fecha inválido (YYYY-MM-DD).');

  try {
    // Find route matching the port IDs
    let rawRoutes = routesRawCache;
    if (!rawRoutes || Date.now() - routesRawCacheTime > 300000) {
      const routesRes = await fetchKikoto('/routes');
      rawRoutes = routesRes.data || [];
    }

    const route = rawRoutes.find(r =>
      r.departure_port_id == departure_port_id &&
      r.destination_port_id == destination_port_id
    );
    if (!route) return ok(res, []);

    const companiesRes = await fetchKikoto(`/routes/${route.id}/shipping-companies`);
    const companies = (companiesRes.data || []).map(c => ({ id: c.id, name: c.name }));

    if (companies.length === 0) return ok(res, []);

    const perCompany = await Promise.all(companies.map(async c => {
      try {
        const tt = await fetchKikotoPost(`/timetables?shipping-company=${c.id}`, {
          departure_port_id: Number(departure_port_id),
          destination_port_id: Number(destination_port_id),
          date,
        });
        const items = tt.data || [];
        return items
          .filter(t => {
            const d = t.date || t.departure_date || (t.departure_at || '').slice(0, 10);
            return d === date;
          })
          .map(t => ({
            naviera_id:    c.id,
            naviera:       c.name,
            date:          t.date || t.departure_date || (t.departure_at || '').slice(0, 10) || date,
            departureTime: t.departure_time || t.time || (t.departure_at || '').slice(11, 16) || '',
            raw:           t,
          }));
      } catch (err) {
        console.error(`[TIMETABLES] company ${c.id}:`, err.message);
        return [];
      }
    }));

    ok(res, perCompany.flat());
  } catch (err) {
    console.error('[TIMETABLES] Error:', err.message);
    fail(res, 'Error al obtener horarios: ' + err.message, 500);
  }
});

// ============================================================
// ERROR HANDLER
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err) return fail(res, err.message || 'Error interno.', 500);
});

// ============================================================
// ARRANCAR SERVIDOR
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   ALSA — Rutas y Horarios                ║`);
    console.log(`  ║   Node.js + Express                     ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║   http://localhost:${PORT}                   ║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
  });
}

module.exports = app;
