'use strict';

const { body, param, query, validationResult } = require('express-validator');

// ── HTML escaping for XSS prevention ──
function escHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => escObj(item));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? escHtml(v) : typeof v === 'object' ? escObj(v) : v;
  }
  return out;
}

// ── String sanitization ──
function sanitizeText(str) {
  if (!str) return '';
  return String(str).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeEmail(str) {
  const s = sanitizeText(str);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
}

function sanitizeInt(val) {
  if (val === null || val === undefined) return NaN;
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

function isValidDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '');
}

// ── Validation middleware ──
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map(e => `${e.path}: ${e.msg}`).join('; ');
    return res.status(400).json({ error: msgs });
  }
  next();
}

// ── Common validation chains ──
const idParam = [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un entero positivo')
];

const authLogin = [
  body('email').trim().isEmail().withMessage('Email no válido').normalizeEmail(),
  body('password').isLength({ min: 1 }).withMessage('Contraseña requerida')
];

const authActivate = [
  body('token').trim().notEmpty().withMessage('Token requerido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
];

const authInvitation = [
  param('token').trim().notEmpty().withMessage('Token requerido')
];

const adminInvite = [
  body('email').trim().isEmail().withMessage('Email no válido').normalizeEmail(),
  body('usuario').trim().isLength({ min: 3 }).withMessage('El usuario debe tener al menos 3 caracteres'),
  body('nombre').trim().optional({ values: 'falsy' }),
  body('inviterUserId').isInt({ min: 1 }).withMessage('ID del invitador inválido')
];

const timetables = [
  body('departure_port_id').isInt({ min: 1 }).withMessage('departure_port_id debe ser un entero positivo'),
  body('destination_port_id').isInt({ min: 1 }).withMessage('destination_port_id debe ser un entero positivo'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)')
];

const bookingNotify = [
  body('origin').trim().notEmpty().withMessage('Origen requerido'),
  body('destination').trim().notEmpty().withMessage('Destino requerido')
];

// ── CRUD body sanitization ──
function crudBody() {
  return [
    body().customSanitizer((value) => {
      if (!value || typeof value !== 'object') return value;
      const sanitized = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === 'id') continue;
        if (typeof v === 'string') {
          sanitized[k] = sanitizeText(v);
        } else if (Array.isArray(v)) {
          sanitized[k] = v.map(item => {
            if (typeof item === 'object') {
              const s = {};
              for (const [ik, iv] of Object.entries(item)) {
                s[ik] = typeof iv === 'string' ? sanitizeText(iv) : iv;
              }
              return s;
            }
            return typeof item === 'string' ? sanitizeText(item) : item;
          });
        } else {
          sanitized[k] = v;
        }
      }
      return sanitized;
    })
  ];
}

module.exports = {
  escHtml,
  escObj,
  sanitizeText,
  sanitizeEmail,
  sanitizeInt,
  isValidDate,
  validate,
  idParam,
  authLogin,
  authActivate,
  authInvitation,
  adminInvite,
  timetables,
  bookingNotify,
  crudBody,
};
