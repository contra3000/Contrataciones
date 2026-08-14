#!/usr/bin/env node
/*
 * medir-catalogo.js
 * Mediciones del catálogo generado (ORDEN-RONDA-04 §3.5).
 *
 * Mide y reporta, contra app/catalogo/:
 *   - peso del índice (rubros.json + clases.json) y tiempo de carga/armado,
 *   - promedio de buscarClases sobre 100 búsquedas distintas,
 *   - peso y tiempo de carga del fragmento de ítems más grande.
 *
 * Presupuestos (ADR-004): índice < 300 KB, buscarClases < 100 ms, fragmentos
 * de ítems de a lo sumo 300 KB. Imprime PASS o FAIL para cada uno.
 *
 * Uso:  node tools/medir-catalogo.js [carpeta del catálogo]
 * La carpeta por defecto es app/catalogo.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'app', 'catalogo');

const namespaces = path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js');
const indiceJs = path.join(RAIZ, 'app', 'js', 'catalogo', 'indice.js');

if (!fs.existsSync(DIR) || !fs.existsSync(path.join(DIR, 'manifiesto.json'))) {
  console.error('medir-catalogo: no se encuentra el catálogo en ' + DIR);
  console.error('medir-catalogo: corré primero: node tools/build-catalogo.js --entrada datos-prueba/catalogo_incisos.json --salida app/catalogo');
  process.exit(1);
}

require(namespaces);
require(indiceJs);
const SGC = globalThis.SGC;

function leerJson(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function listarFragmentos() {
  const dir = path.join(DIR, 'items');
  return fs.readdirSync(dir).map(function (nombre) {
    const ruta = path.join(dir, nombre);
    return { nombre: nombre, ruta: ruta, tamanio: fs.statSync(ruta).size };
  });
}

function principal() {
  const inicioIndice = Date.now();
  const rubros = leerJson(path.join(DIR, 'rubros.json'));
  const clases = leerJson(path.join(DIR, 'clases.json'));
  const montadas = SGC.catalogo.indice.montar({ rubros: rubros, clases: clases });
  const msIndice = Date.now() - inicioIndice;

  const pesoIndice = Buffer.byteLength(JSON.stringify(rubros), 'utf8') +
    Buffer.byteLength(JSON.stringify(clases), 'utf8');

  const consultas = [];
  for (let i = 0; i < clases.length; i += Math.floor(clases.length / 100)) {
    if (consultas.length >= 100) {
      break;
    }
    const palabra = clases[i][2].split(' ')[0];
    if (palabra && consultas.indexOf(palabra) === -1) {
      consultas.push(palabra);
    }
  }
  if (consultas.length < 100) {
    for (let i = 0; i < clases.length && consultas.length < 100; i++) {
      const palabra = clases[i][2].split(' ')[0];
      if (palabra && consultas.indexOf(palabra) === -1) {
        consultas.push(palabra);
      }
    }
  }

  let totalMs = 0;
  let totalResultados = 0;
  let peorMs = 0;
  for (const consulta of consultas) {
    const desde = Date.now();
    const resultados = SGC.catalogo.indice.buscarClases(consulta, 8);
    const duracion = Date.now() - desde;
    totalMs += duracion;
    totalResultados += resultados.length;
    if (duracion > peorMs) {
      peorMs = duracion;
    }
  }
  const promedioMs = totalMs / consultas.length;

  const fragmentos = listarFragmentos();
  const masGrande = fragmentos.reduce(function (a, b) {
    return b.tamanio > a.tamanio ? b : a;
  }, fragmentos[0]);
  const inicioFragmento = Date.now();
  leerJson(masGrande.ruta);
  const msFragmento = Date.now() - inicioFragmento;

  const indiceOk = pesoIndice < 300 * 1024;
  const busquedaOk = promedioMs < 100;
  const fragmentoOk = masGrande.tamanio <= 300 * 1024;

  console.log('indice: peso ' + (pesoIndice / 1024).toFixed(0) + ' KB, carga + armado ' + msIndice + ' ms, ' + montadas + ' clases');
  console.log('indice: presupuesto 300 KB -> ' + (indiceOk ? 'PASS' : 'FAIL'));
  console.log('buscarClases: ' + consultas.length + ' consultas, promedio ' + promedioMs.toFixed(2) + ' ms, peor ' + peorMs + ' ms, ' + (totalResultados / consultas.length).toFixed(1) + ' resultados promedio');
  console.log('buscarClases: presupuesto 100 ms -> ' + (busquedaOk ? 'PASS' : 'FAIL'));
  console.log('fragmento más grande: ' + masGrande.nombre + ' = ' + (masGrande.tamanio / 1024).toFixed(0) + ' KB, carga ' + msFragmento + ' ms');
  console.log('fragmento: presupuesto 300 KB -> ' + (fragmentoOk ? 'PASS' : 'FAIL'));
}

principal();
