'use strict';

/*
 * palabras.js
 * Carga del diccionario de palabras en castellano usado para generar claves
 * (ADR-034 §2): cuatro palabras separadas por guiones. Es el único punto que
 * conoce la ruta del archivo; lo usan el bootstrap del padrón, el módulo de
 * administración y la importación CSV.
 */

const fs = require('node:fs');
const path = require('node:path');

const RUTA = path.join(__dirname, '..', 'config', 'palabras.json');

function diccionarioDePalabras() {
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}

module.exports = { diccionarioDePalabras };