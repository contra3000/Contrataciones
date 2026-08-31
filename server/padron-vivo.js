'use strict';

const fs = require('node:fs');
const path = require('node:path');

function crearPadronVivo(rutaPadron) {
  let cache = null;
  let mtimeMs = -1;

  function leer() {
    try {
      const stat = fs.statSync(rutaPadron);
      if (cache && stat.mtimeMs === mtimeMs) {
        return cache;
      }
      const contenido = JSON.parse(fs.readFileSync(rutaPadron, 'utf8'));
      cache = contenido;
      mtimeMs = stat.mtimeMs;
      return cache;
    } catch (e) {
      return null;
    }
  }

  function usuarios() {
    const padron = leer();
    return padron && Array.isArray(padron.usuarios) ? padron.usuarios : [];
  }

  function buscar(email) {
    return usuarios().find((u) => u && u.email === email) || null;
  }

  function guardar(padron) {
    const dir = path.dirname(rutaPadron);
    const tmp = path.join(dir, '.padron-' + process.pid + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(padron, null, 2), 'utf8');
    fs.renameSync(tmp, rutaPadron);
    cache = null;
    mtimeMs = -1;
  }

  function existe() {
    return fs.existsSync(rutaPadron);
  }

  function invalidar() {
    cache = null;
    mtimeMs = -1;
  }

  return { leer, usuarios, buscar, guardar, existe, invalidar };
}

module.exports = { crearPadronVivo };
