'use strict';

/*
 * generador-pliegos.js
 * ORDEN-RONDA-24 §2 (pieza 2). Un solo lugar donde se define la ruta del
 * generador real de pliegos (SGC_GENERADOR_PLIEGOS), para que la suite corra
 * igual en cualquier clon. La toman ronda-16, ronda-17, ronda-18 y ronda-23-c2.
 *
 * Resolución, en orden: variable ya fijada; el generador como hermano del repo
 * (misma estructura que server/pliego-probador.js); la ruta histórica absoluta
 * del desarrollador. Se deja fijada en el entorno para que también la hereden
 * los servidores que los tests arrancan con helpers/servidor-util.js.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');

function candidatas() {
  const lista = [];
  if (process.env.SGC_GENERADOR_PLIEGOS) {
    lista.push(process.env.SGC_GENERADOR_PLIEGOS);
  }
  lista.push(
    path.join(RAIZ, '..', 'EjemplosProcesoActual', 'DocUOC', 'Generador de Pliegos'),
    'C:\\Proyectos\\DContrataciones\\Automatizar\\AppOptimizar\\EjemplosProcesoActual\\DocUOC\\Generador de Pliegos'
  );
  return lista;
}

function rutaGenerador() {
  const lista = candidatas();
  return lista.find((r) =>
    fs.existsSync(path.join(r, 'scripts', 'generar_pliego.py'))) || lista[0] || null;
}

const GENERADOR = rutaGenerador();
if (GENERADOR) {
  process.env.SGC_GENERADOR_PLIEGOS = GENERADOR;
}

module.exports = { GENERADOR, rutaGenerador };