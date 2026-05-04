'use strict';

function isValidEmail(v) {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !v.includes('..');
}
function isValidDni(v)   { return /^[0-9]{8}[A-Za-z]$/.test(v || ''); }
function isValidDate(v)  { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function isValidLoc(v)   {
  if (!v) return false;
  return /^[A-Z0-9]{1,10}$/.test(v);
}

module.exports = {
  isValidEmail,
  isValidDni,
  isValidDate,
  isValidLoc
};
