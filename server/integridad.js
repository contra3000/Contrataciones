'use strict';

/*
 * integridad.js
 * ORDEN-RONDA-11 §2.1 (ADR-029). Verificación de integridad del núcleo:
 * comprueba que todos los módulos declarados en APP_CORE estén cargados en
 * globalThis.SGC. Si falta alguno, lanza con un mensaje claro.
 *
 * Se usa tanto en el test de integridad como en la verificación en arranque.
 */

const path = require('node:path');
const RAIZ = path.resolve(__dirname, '..');

// Lista exportada por servidor.js (carga el mismo orden).
const { APP_CORE } = require('./servidor.js');

// Mapa archivo → función de verificación. La función recibe globalThis.SGC y
// devuelve true si el módulo está correctamente registrado.
const MANIFEST = {
  'namespaces.js':        (s) => !!(s && s.core),
  'config.js':            (s) => !!(s && s.core && s.core.config),
  'cotas-encabezado.js':  (s) => !!(s && s.core && s.core.config && s.core.config.CAMPOS_ENCABEZADO_COTAS),
  'autorizacion.js':      (s) => !!(s && s.core && s.core.autorizacion),
  'auditoria.js':     (s) => !!(s && s.core && s.core.auditoria),
  'migraciones.js':   (s) => !!(s && s.core && s.core.migraciones),
  'utils.js':         (s) => !!(s && s.core && s.core.utils),
  'requerimiento.js': (s) => !!(s && s.core && s.core.requerimiento),
  'anexo-eett.js':    (s) => !!(s && s.core && s.core.anexoEett),
  'validacion.js':    (s) => !!(s && s.core && s.core.validacion),
  'estados.js':       (s) => !!(s && s.core && s.core.estados)
};

function verificarModulos(lista) {
  const faltantes = [];
  for (let i = 0; i < lista.length; i++) {
    const archivo = lista[i];
    const verificar = MANIFEST[archivo];
    if (verificar && !verificar(globalThis.SGC)) {
      faltantes.push(archivo);
    }
  }
  if (faltantes.length > 0) {
    throw new Error('Integridad del núcleo: faltan los módulos cargados [' +
      faltantes.join(', ') + ']');
  }
  return lista.length;
}

module.exports = { verificarModulos, APP_CORE, RAIZ };
