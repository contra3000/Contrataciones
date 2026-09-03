'use strict';

/*
 * identidad.js
 * ORDEN-RONDA-18 §3.5. El correo es la identidad (ADR-017) y no distingue
 * mayúsculas: dos formas del mismo correo son dos cuentas para la misma
 * persona. Este módulo es la definición ÚNICA de validación y comparación de
 * correo, usada por el bootstrap, la importación CSV, el alta de a uno y la
 * búsqueda de la sesión.
 *
 * También normaliza el campo booleano `activo` de la importación CSV
 * (ORDEN-RONDA-18 §3.1): sin tildes, vocabulario cerrado, vacío = activo, y
 * cualquier otra cosa es error de línea (la peor omisión posible es resolver
 * un booleano de identidad como `false` en silencio).
 */

const SUFIJOS_INVALIDOS = [';', '\r', '\n'];
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Mapa tildes -> sin tildes (para la normalización del campo activo).
const TILDES = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u',
  'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u' };

function quitarTildes(texto) {
  return String(texto).replace(/[áéíóúüÁÉÍÓÚÜ]/g, (c) => TILDES[c] || c);
}

// Normaliza a minúsculas y recorta. El correo es identidad y no distingue
// mayúsculas (ORDEN-RONDA-18 §3.5).
function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validarEmail(email) {
  if (SUFIJOS_INVALIDOS.some((c) => email.indexOf(c) !== -1)) {
    return false;
  }
  return RE_EMAIL.test(email);
}

// Normaliza el campo `activo` de la importación CSV. Devuelve
// { activo } o { error }. Vocabulario cerrado en las dos direcciones:
//   afirmativos: si, sí, s, true, 1, x, verdadero
//   negativos:   no, n, false, 0, falso
//   vacío o ausente = activo
// Cualquier otra cosa es un error de línea; NO se resuelve como false.
function normalizarActivo(valor, n) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return { activo: true };
  }
  const v = quitarTildes(String(valor).trim().toLowerCase());
  if (v === 'si' || v === 's' || v === 'true' || v === '1' || v === 'x' || v === 'verdadero') {
    return { activo: true };
  }
  if (v === 'no' || v === 'n' || v === 'false' || v === '0' || v === 'falso') {
    return { activo: false };
  }
  return { error: 'línea ' + n + ': el campo activo "' + valor + '" no es válido ' +
    '(use si/no, sí/s, true/1/x/verdadero, false/0/falso, o déjelo vacío para activo)' };
}

module.exports = {
  SUFIJOS_INVALIDOS,
  RE_EMAIL,
  normalizarEmail,
  validarEmail,
  normalizarActivo,
  quitarTildes
};
