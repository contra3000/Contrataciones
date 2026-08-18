/*
 * compat-patrones.js
 * Tablas de veto del guardián de compatibilidad (ADR-011, ADR-018), separadas
 * de check-compat.js por responsabilidad (ORDEN-RONDA-07 §2.2). Este archivo
 * no contiene lógica de escaneo: sólo datos. El guardián lo consume con
 * require() y el mismo lo inspecciona sin falsos positivos (las cadenas y los
 * literales regex que mencionan APIs vetadas se separan antes de comparar).
 */
'use strict';

const PATRONES_JS = [
  { re: /\.toSorted\s*\(/, motivo: 'Array.prototype.toSorted (Chrome 110)' },
  { re: /\.toSpliced\s*\(/, motivo: 'Array.prototype.toSpliced (Chrome 110)' },
  { re: /\.with\s*\(/, motivo: 'Array.prototype.with (Chrome 110)' },
  { re: /Object\s*\.\s*groupBy\b/, motivo: 'Object.groupBy (Chrome 117)' },
  { re: /Map\s*\.\s*groupBy\b/, motivo: 'Map.groupBy (Chrome 117)' },
  { re: /Promise\s*\.\s*withResolvers\b/, motivo: 'Promise.withResolvers (Chrome 119)' }
];

const PATRONES_CSS = [
  { re: /&\s*[:.#\[>]/, motivo: 'anidamiento CSS nativo con "&" (Chrome 112)' },
  { re: /text-wrap\s*:\s*balance\b/, motivo: 'text-wrap: balance (Chrome 114)' },
  { re: /:user-valid\b/, motivo: ':user-valid (Chrome 119)' },
  { re: /:user-invalid\b/, motivo: ':user-invalid (Chrome 119)' }
];

const PATRONES_HTML = [
  { re: /\bpopover\b/, motivo: 'atributo HTML popover (Chrome 114)' }
];

// "import"/"export" se construyen por partes para que el token vetado nunca
// aparezca contiguo en el propio guardián (auto-inspección sin falso positivo).
// Estos dos se revisan sobre el código limpio (sin cadenas).
const PATRONES_IMPORT_EXPORT = [
  { re: new RegExp('\\b' + 'im' + 'port' + '\\b'), motivo: 'import (módulos ES no permitidos)' },
  { re: new RegExp('\\b' + 'ex' + 'port' + '\\b'), motivo: 'export (módulos ES no permitidos)' }
];

// type="module" en HTML se revisa sobre el texto con cadenas conservadas: el
// valor de atributo va entre comillas y no es un literal de código.
const PATRONES_TYPE_MODULE = [
  { re: /\btype\s*=\s*["']module["']/, motivo: 'script type="module" (módulos ES no permitidos)' }
];

const PATRONES_URL = [
  { re: /https?:\/\/\S*/, motivo: 'URL absoluta (app no emite peticiones al exterior, ADR-018)' }
];

module.exports = {
  PATRONES_JS,
  PATRONES_CSS,
  PATRONES_HTML,
  PATRONES_IMPORT_EXPORT,
  PATRONES_TYPE_MODULE,
  PATRONES_URL
};