#!/usr/bin/env node
/*
 * completar-descripciones.js
 * ORDEN-RONDA-25 pieza 5 (R58) · completa `item` —la descripción del ítem del
 * catálogo— en los renglones de los expedientes existentes que quedaron sin
 * ella.
 *
 * Uso:
 *   node tools/completar-descripciones.js --datos <ruta>
 *
 * - Lee el catálogo de app/catalogo (los fragmentos de ítems) y arma el índice
 *   código → `item`.
 * - Recorre <ruta> buscando expedientes (<numero>_Expediente/datos.json). Cada
 *   renglón con `codigo` del catálogo y sin `item` (o vacío) recibe el `item`
 *   del catálogo.
 * - No toca nada más del datos.json. La escritura sigue la convención del
 *   servidor: la versión anterior queda en `hist/v<version>.json` y `version`
 *   sube en 1; el resto de los campos queda idéntico byte a byte.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

function ayuda() {
  console.error('completar-descripciones: falta --datos <ruta>');
  console.error('Uso: node tools/completar-descripciones.js --datos <ruta>');
  process.exit(1);
}

function argumentos(argv) {
  const opciones = { datos: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--datos' && i + 1 < argv.length) {
      opciones.datos = path.resolve(argv[i + 1]);
      i++;
    }
  }
  return opciones;
}

// Índice código → item (la descripción del ítem), desde app/catalogo/items.
function cargarCatalogo(dir) {
  const itemsDir = path.join(dir, 'items');
  const indice = new Map();
  if (!fs.existsSync(itemsDir)) {
    return { indice: indice, error: 'no se encuentra el catálogo en ' + dir };
  }
  for (const nombre of fs.readdirSync(itemsDir)) {
    if (!nombre.endsWith('.json')) {
      continue;
    }
    const lista = JSON.parse(fs.readFileSync(path.join(itemsDir, nombre), 'utf8'));
    for (const item of lista) {
      if (item && typeof item.codigo === 'string' &&
          typeof item.item === 'string' && item.item.length > 0) {
        indice.set(item.codigo, item.item);
      }
    }
  }
  return { indice: indice, error: null };
}

// Todos los <numero>_Expediente/datos.json bajo <datos>.
function expedientesEn(datos) {
  const hallados = [];
  function recorrer(dir) {
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entrada of entradas) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'idx' || entrada.name === 'hist') {
          continue;
        }
        recorrer(ruta);
      } else if (entrada.isFile() && entrada.name === 'datos.json' &&
                 dir.endsWith('_Expediente')) {
        hallados.push(ruta);
      }
    }
  }
  recorrer(datos);
  return hallados;
}

function serializar(objeto) {
  return JSON.stringify(objeto, null, 2);
}

function principal() {
  const opciones = argumentos(process.argv);
  if (!opciones.datos) {
    ayuda();
  }
  if (!fs.existsSync(opciones.datos)) {
    console.error('completar-descripciones: no existe la carpeta de datos ' + opciones.datos);
    process.exit(1);
  }
  const { indice, error } = cargarCatalogo(path.join(RAIZ, 'app', 'catalogo'));
  if (error) {
    console.error('completar-descripciones: ' + error);
    process.exit(1);
  }

  const expedientes = expedientesEn(opciones.datos);
  let totalCompletados = 0;
  let totalSinCatalogo = 0;
  for (const ruta of expedientes) {
    const contenido = fs.readFileSync(ruta, 'utf8');
    const expediente = JSON.parse(contenido);
    const renglones = Array.isArray(expediente.renglones) ? expediente.renglones : [];
    let completados = 0;
    for (let i = 0; i < renglones.length; i++) {
      const r = renglones[i];
      if (!r || typeof r.codigo !== 'string') {
        continue;
      }
      const descripcion = indice.get(r.codigo);
      if (typeof descripcion !== 'string') {
        if (!r.item) {
          totalSinCatalogo++;
        }
        continue;
      }
      if (typeof r.item === 'string' && r.item.length > 0) {
        continue;
      }
      r.item = descripcion;
      completados++;
    }
    if (completados === 0) {
      continue;
    }
    const versionVieja = Number(expediente.version) || 0;
    expediente.version = versionVieja + 1;
    const dirExp = path.dirname(ruta);
    const dirHist = path.join(dirExp, 'hist');
    fs.mkdirSync(dirHist, { recursive: true });
    const archivoViejo = path.join(dirHist, 'v' + versionVieja + '.json');
    if (!fs.existsSync(archivoViejo)) {
      fs.writeFileSync(archivoViejo, contenido, 'utf8');
    }
    fs.writeFileSync(ruta, serializar(expediente), 'utf8');
    totalCompletados += completados;
    console.log('completar-descripciones: ' + path.basename(dirExp) +
      ' · items completados: ' + completados +
      ' · versión anterior en hist/v' + versionVieja + '.json');
  }
  console.log('completar-descripciones: total de items completados: ' + totalCompletados +
    (totalSinCatalogo > 0
      ? ' · ' + totalSinCatalogo + ' renglón(es) sin descripción (sin código en el catálogo)'
      : ''));
}

principal();