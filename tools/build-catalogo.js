#!/usr/bin/env node
/*
 * build-catalogo.js
 * Generador de fragmentos del catálogo (ADR-004, ORDEN-RONDA-04 §3.1).
 *
 * Transforma el catálogo completo (datos-prueba/catalogo_incisos.json,
 * 159.366 registros, ~40 MB) en fragmentos servibles bajo app/catalogo/:
 *
 *   app/catalogo/manifiesto.json        versión, conteos y fecha de generación
 *   app/catalogo/rubros.json            los 50 rubros: [{idRubro, rubro}]
 *   app/catalogo/clases.json            una entrada compacta por clase
 *                                       [idClase, idRubro, clase, cantidad, partes]
 *   app/catalogo/items/<idClase>.json   ítems de cada clase (partido si pesa más
 *                                       del límite: <idClase>_p1.json, _p2.json...)
 *
 * La codificación del índice es compacta (ADR-004 estimaba ~200 KB): el rubro
 * va como índice a rubros.json y el idClase identifica al fragmento, para que
 * el índice inicial (rubros + clases) entre en el presupuesto de 300 KB de la
 * ORDEN-RONDA-04 §3.5.
 *
 * Uso:
 *   node tools/build-catalogo.js --entrada datos-prueba/catalogo_incisos.json --salida app/catalogo
 *
 * Garantías:
 *  - Determinista: dos corridas sobre la misma entrada producen archivos byte
 *    a byte idénticos. La fecha del manifiesto deriva del mtime del archivo de
 *    entrada (no del reloj) y catalogoVersion es un hash FNV-1a del contenido.
 *  - Descarta el campo estado (ADR-014).
 *  - Ningún fragmento de ítems supera LIMITE_FRAGMENTO bytes; las clases grandes
 *    se parten en varios archivos. El manifiesto asienta cuántas partes tiene
 *    cada clase partida.
 *  - Sin dependencias externas: sólo la biblioteca estándar de Node.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LIMITE_FRAGMENTO = 280 * 1024;

function hashFnv1a(texto) {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function compararTexto(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function leerArgumentos(argv) {
  const opciones = { entrada: null, salida: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--entrada') {
      opciones.entrada = argv[i + 1];
      i++;
    } else if (argv[i] === '--salida') {
      opciones.salida = argv[i + 1];
      i++;
    }
  }
  return opciones;
}

function validarRegistros(registros) {
  if (!Array.isArray(registros)) {
    throw new Error('El catálogo de entrada debe ser un arreglo JSON de registros');
  }
  let invalidos = 0;
  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    if (!r || typeof r.codigo !== 'string' || typeof r.rubro !== 'string' ||
        typeof r.clase !== 'string' || typeof r.item !== 'string') {
      invalidos++;
    }
  }
  if (invalidos > 0) {
    throw new Error('Hay ' + invalidos + ' registros sin los campos esperados (codigo, rubro, clase, item)');
  }
}

function bytesDeItem(item) {
  const pieza = '{"codigo":' + JSON.stringify(item.codigo) + ',"item":' +
    JSON.stringify(item.item) + '},';
  return Buffer.byteLength(pieza, 'utf8');
}

function partirItems(items) {
  const bytes = items.map(bytesDeItem);
  const partes = [];
  let actual = [];
  let tamanioActual = 2;
  for (let i = 0; i < items.length; i++) {
    if (actual.length > 0 && tamanioActual + bytes[i] > LIMITE_FRAGMENTO) {
      partes.push(actual);
      actual = [];
      tamanioActual = 2;
    }
    actual.push(items[i]);
    tamanioActual += bytes[i];
  }
  if (actual.length > 0) {
    partes.push(actual);
  }
  return partes;
}

function escribirJson(ruta, valor) {
  fs.writeFileSync(ruta, JSON.stringify(valor), 'utf8');
}

function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  if (!opciones.entrada || !opciones.salida) {
    console.error('Uso: node tools/build-catalogo.js --entrada <catalogo.json> --salida <carpeta de salida>');
    process.exit(1);
  }
  if (!fs.existsSync(opciones.entrada)) {
    console.error('No se encuentra el catálogo de entrada: ' + opciones.entrada);
    process.exit(1);
  }

  const inicio = Date.now();
  let texto = null;
  try {
    texto = fs.readFileSync(opciones.entrada, 'utf8');
  } catch (err) {
    console.error('No se pudo leer el catálogo de entrada "' + opciones.entrada + '": ' + err.message);
    process.exit(1);
  }
  let registros = null;
  try {
    registros = JSON.parse(texto);
  } catch (err) {
    console.error('El archivo de entrada "' + opciones.entrada + '" no es JSON válido: ' + err.message);
    console.error('Revisá que el archivo esté completo y sin cortes.');
    process.exit(1);
  }
  validarRegistros(registros);

  const ordenados = registros.slice().sort(function (a, b) {
    return compararTexto(a.codigo, b.codigo);
  });

  const rubrosMap = new Map();
  const contenido = [];
  const grupos = new Map();
  for (let i = 0; i < ordenados.length; i++) {
    const r = ordenados[i];
    contenido.push(r.codigo + '|' + r.rubro + '|' + r.clase + '|' + r.item);
    rubrosMap.set(r.rubro, (rubrosMap.get(r.rubro) || 0) + 1);
    const clave = r.rubro + '\u0000' + r.clase;
    if (!grupos.has(clave)) {
      grupos.set(clave, { rubro: r.rubro, clase: r.clase, items: [] });
    }
    grupos.get(clave).items.push({ codigo: r.codigo, item: r.item });
  }
  const catalogoVersion = hashFnv1a(contenido.join('\n'));

  const clasesOrdenadas = Array.from(grupos.values()).sort(function (a, b) {
    const porRubro = compararTexto(a.rubro, b.rubro);
    return porRubro !== 0 ? porRubro : compararTexto(a.clase, b.clase);
  });

  const clases = [];
  let totalFragmentos = 0;
  let fragmentoMasGrande = 0;
  let bytesTotal = 0;

  const rubrosOrdenados = Array.from(rubrosMap.keys()).sort(compararTexto);
  const idRubros = new Map();
  for (let i = 0; i < rubrosOrdenados.length; i++) {
    idRubros.set(rubrosOrdenados[i], i + 1);
  }

  const dirItems = path.join(opciones.salida, 'items');
  fs.rmSync(dirItems, { recursive: true, force: true });
  fs.mkdirSync(dirItems, { recursive: true });

  for (let i = 0; i < clasesOrdenadas.length; i++) {
    const idClase = i + 1;
    const grupo = clasesOrdenadas[i];
    const items = grupo.items;
    const partes = partirItems(items);

    for (let p = 0; p < partes.length; p++) {
      const parte = partes[p];
      const nombre = partes.length === 1
        ? String(idClase) + '.json'
        : String(idClase) + '_p' + (p + 1) + '.json';
      const ruta = path.join(dirItems, nombre);
      const contenidoParte = JSON.stringify(parte);
      fs.writeFileSync(ruta, contenidoParte, 'utf8');
      const bytes = Buffer.byteLength(contenidoParte, 'utf8');
      totalFragmentos++;
      bytesTotal += bytes;
      if (bytes > fragmentoMasGrande) {
        fragmentoMasGrande = bytes;
      }
    }

    clases.push([
      idClase,
      idRubros.get(grupo.rubro),
      grupo.clase,
      items.length,
      partes.length
    ]);
  }

  const rubros = rubrosOrdenados.map(function (rubro, indice) {
    return { idRubro: indice + 1, rubro: rubro };
  });

  escribirJson(path.join(opciones.salida, 'rubros.json'), rubros);
  escribirJson(path.join(opciones.salida, 'clases.json'), clases);

  const manifiesto = {
    catalogoVersion: catalogoVersion,
    registros: registros.length,
    rubros: rubros.length,
    clases: clases.length,
    fragmentos: totalFragmentos,
    generado: new Date(fs.statSync(opciones.entrada).mtime).toISOString()
  };
  escribirJson(path.join(opciones.salida, 'manifiesto.json'), manifiesto);

  const segundos = ((Date.now() - inicio) / 1000).toFixed(2);
  console.log('catalogo: ' + registros.length + ' registros en ' + clases.length + ' clases y ' + totalFragmentos + ' fragmentos');
  console.log('catalogo: fragmento más grande ' + (fragmentoMasGrande / 1024).toFixed(0) + ' KB, total ' + (bytesTotal / 1024).toFixed(0) + ' KB');
  console.log('catalogo: catalogoVersion ' + catalogoVersion + ', generado ' + manifiesto.generado);
  console.log('catalogo: listo en ' + segundos + ' s -> ' + opciones.salida);
}

if (require.main === module) {
  main();
}
