#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const DIR_TESTS = path.join(RAIZ, 'tests');
const NODE = process.execPath;
const TIMEOUT = '--test-timeout=120000';

const MARCADORES = [
  'servidor-util.js',
  'aplicacion-montura.js',
  'transiciones-servidor-util.js',
  'matriz-servidor-bateria.js',
  'server/servidor.js'
];

function listarTests() {
  return fs.readdirSync(DIR_TESTS)
    .filter(function (nombre) { return nombre.endsWith('.test.js'); })
    .sort()
    .map(function (nombre) { return path.join(DIR_TESTS, nombre); });
}

function extraerRequires(contenido) {
  const salida = [];
  const re = /require\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(contenido))) {
    salida.push(m[2]);
  }
  return salida;
}

function esRelativo(spec) {
  return spec.startsWith('./') || spec.startsWith('../');
}

function resolverDependencia(desde, spec) {
  const base = path.resolve(path.dirname(desde), spec);
  const candidatos = [base, base + '.js', path.join(base, 'index.js')];
  for (const candidato of candidatos) {
    if (fs.existsSync(candidato) && fs.statSync(candidato).isFile()) {
      return candidato;
    }
  }
  return null;
}

function marcarMotivo(contenido) {
  for (const spec of extraerRequires(contenido)) {
    for (const marcador of MARCADORES) {
      if (spec === marcador || spec.endsWith('/' + marcador) || spec.endsWith('\\' + marcador)) {
        return marcador;
      }
    }
  }
  return null;
}

function clasificar(archivo, opciones) {
  const o = opciones || {};
  const vistos = new Set();
  const cola = [{ archivo: archivo, contenido: o.contenido }];
  while (cola.length > 0) {
    const actual = cola.shift();
    const ruta = path.resolve(actual.archivo);
    if (vistos.has(ruta)) {
      continue;
    }
    vistos.add(ruta);
    let contenido = actual.contenido;
    if (contenido === undefined) {
      if (!fs.existsSync(ruta)) {
        continue;
      }
      contenido = fs.readFileSync(ruta, 'utf8');
    }
    const motivo = marcarMotivo(contenido);
    if (motivo) {
      return {
        serie: true,
        motivo: motivo,
        motivoTexto: 'usa ' + motivo
      };
    }
    for (const spec of extraerRequires(contenido)) {
      if (!esRelativo(spec)) {
        continue;
      }
      const dependencia = resolverDependencia(ruta, spec);
      if (dependencia) {
        cola.push({ archivo: dependencia });
      }
    }
  }
  return {
    serie: false,
    motivo: null,
    motivoTexto: 'no usa servidor ni la montura de la aplicación'
  };
}

function clasificarSuite() {
  const serie = [];
  const paralelo = [];
  for (const archivo of listarTests()) {
    const resultado = clasificar(archivo);
    const entrada = {
      archivo: archivo,
      nombre: path.basename(archivo),
      motivo: resultado.motivoTexto
    };
    if (resultado.serie) {
      serie.push(entrada);
    } else {
      paralelo.push(entrada);
    }
  }
  return { serie: serie, paralelo: paralelo, todos: listarTests() };
}

function parsearTotales(texto) {
  const totales = {
    tests: 0,
    pass: 0,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    duration_ms: 0
  };
  const claves = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'duration_ms'];
  for (const clave of claves) {
    const re = new RegExp('(?:^|\\n)\\s*(?:\\u2139|#)\\s*' + clave + '\\s+(\\d+(?:\\.\\d+)?)');
    const m = texto.match(re);
    if (m) {
      totales[clave] = clave === 'duration_ms' ? Number(m[1]) : parseInt(m[1], 10);
    }
  }
  return totales;
}

function sumar(a, b) {
  return {
    tests: a.tests + b.tests,
    pass: a.pass + b.pass,
    fail: a.fail + b.fail,
    cancelled: a.cancelled + b.cancelled,
    skipped: a.skipped + b.skipped,
    duration_ms: a.duration_ms + b.duration_ms
  };
}

function correrTanda(archivos, concurrencia) {
  if (archivos.length === 0) {
    return { salida: '', estado: 0, totales: parsearTotales('') };
  }
  const args = ['--test', TIMEOUT, '--test-force-exit'];
  if (concurrencia !== undefined) {
    args.push('--test-concurrency=' + concurrencia);
  }
  for (const archivo of archivos) {
    args.push(path.relative(RAIZ, archivo));
  }
  const resultado = spawnSync(NODE, args, {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  });
  const salida = (resultado.stdout || '') + (resultado.stderr || '');
  process.stdout.write(salida);
  return {
    salida: salida,
    estado: resultado.status === null ? 1 : resultado.status,
    totales: parsearTotales(salida)
  };
}

function imprimirListado(clasificacion) {
  console.log('serie (' + clasificacion.serie.length + ')');
  for (const entrada of clasificacion.serie) {
    console.log('  ' + entrada.nombre + ' — ' + entrada.motivo);
  }
  console.log('paralelo (' + clasificacion.paralelo.length + ')');
  for (const entrada of clasificacion.paralelo) {
    console.log('  ' + entrada.nombre + ' — ' + entrada.motivo);
  }
}

function main() {
  const args = process.argv.slice(2);
  const clasificacion = clasificarSuite();
  if (args.indexOf('--listar') !== -1) {
    imprimirListado(clasificacion);
    return;
  }
  const serie = correrTanda(clasificacion.serie.map(function (e) { return e.archivo; }), 1);
  const paralelo = correrTanda(clasificacion.paralelo.map(function (e) { return e.archivo; }));
  const totales = sumar(serie.totales, paralelo.totales);
  console.log('tests ' + totales.tests + ' / pass ' + totales.pass + ' / fail ' + totales.fail +
    ' / cancelled ' + totales.cancelled + ' / skipped ' + totales.skipped +
    ' / duration_ms ' + Math.round(totales.duration_ms));
  const fallo = totales.fail > 0 || totales.cancelled > 0 || serie.estado !== 0 || paralelo.estado !== 0;
  process.exitCode = fallo ? 1 : 0;
}

if (require.main === module) {
  main();
}

module.exports = {
  MARCADORES: MARCADORES,
  RAIZ: RAIZ,
  listarTests: listarTests,
  clasificar: clasificar,
  clasificarSuite: clasificarSuite,
  parsearTotales: parsearTotales
};
