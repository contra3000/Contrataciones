'use strict';

/*
 * ronda-27-c2.test.js
 * ORDEN-RONDA-27 pieza 2 · un test roto falla, no cuelga.
 *
 * El auditor del ciclo 26 encontró que `ronda-26-c6.test.js:93` cerraba el
 * servidor en el camino feliz y no en `finally`: si una aserción fallaba antes,
 * el servidor seguía vivo y la corrida entera se colgaba. Un test roto tiene
 * que fallar, no colgar.
 *
 * Este archivo es el CONTROL de la familia (regla de hierro del ciclo de
 * trabajo: una familia de defectos se cierra con un control automático, no de
 * a un caso por ronda). Recorre todos los archivos de `tests/` y falla si
 * encuentra un test que levante un proceso sin cerrarlo en `finally`.
 *
 * También verifica la otra mitad de la pieza: `tests/LEEME.md` declara
 * `--test-timeout=120000` en todos sus comandos de corrida, que es lo que
 * convierte "colgarse" en "fallar a los dos minutos".
 *
 * Lo que el control NO exige, y por qué:
 *  - los ganchos `before`/`after` están bien: si `before` levanta y `after`
 *    cierra, el proceso no sobrevive al archivo, y un `before` que falla hace
 *    que corran igual los `after` (node:test);
 *  - `spawnSync`/`execSync` no dejan proceso vivo (son sincrónicos y su hijo
 *    muere con la llamada), así que no cuentan como "levantar un proceso".
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const DIR_TESTS = __dirname;

// Llamadas que levantan un proceso (ORDEN-RONDA-27 pieza 2: la búsqueda entera
// de `spawn`, `arrancar` y `levantar` en `tests/`).
const LEVANTA = [
  /arrancarServidor\(/,
  /arrancarServidorDePrueba\(/,
  /arrancarEntorno\(/,
  /arrancarBootstrap\(/,
  /arrancarSugerencias\(/,
  /arrancarPadron\(/,
  /levantarServidor\(/,
  /levantarMontura\(/,
  /\bspawn\(/
];

// Llamadas que lo cierran. Un cierre que aparece sólo en el camino feliz NO
// cuenta: tiene que estar en un `finally`.
const CIERRA = [
  /detenerServidor\(/,
  /limpiarEntorno\(/,
  /limpiarSugerencias\(/,
  /limpiarMontura\(/,
  /montaje\.cerrar\(/,
  /\.cerrar\(\)/
];

const GANCHOS = ['before', 'after', 'beforeEach', 'afterEach'];

// Sincrónicos: no dejan proceso vivo, no cuentan.
const SINCRONOS = /\bspawnSync\(|\bexecSync\(|\bexecFileSync\(/;

function archivosDePruebas(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'node_modules') continue;
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...archivosDePruebas(p));
    else if (entrada.name.endsWith('.js')) salida.push(p);
  }
  return salida;
}

// Quita comentarios, para que una llamada mencionada en un comentario no cuente
// como código.
function sinComentarios(lineas) {
  return lineas
    .map((l) => l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))
    .join('\n');
}

// Índice (base 0) de la línea donde termina el bloque que abre en `desde`, o
// null si no cierra.
function finDeBloque(lineas, desde) {
  let profundidad = 0;
  let abrio = false;
  for (let j = desde; j < lineas.length; j++) {
    const limpia = sinComentarios([lineas[j]]);
    for (const ch of limpia) {
      if ('({['.includes(ch)) { profundidad++; abrio = true; }
      else if (')}]'.includes(ch)) {
        profundidad--;
        if (abrio && profundidad === 0) return j;
      }
    }
  }
  return null;
}

// Recorta bloques de primer nivel `test(...)`, `before(...)`, etc.
function bloques(src) {
  const lineas = src.split(/\r?\n/);
  const salida = [];
  let i = 0;
  while (i < lineas.length) {
    const m = /^(test|before|after|beforeEach|afterEach)\s*\(/.exec(lineas[i]);
    if (!m) { i++; continue; }
    const fin = finDeBloque(lineas, i);
    if (fin === null) break;
    const cuerpo = lineas.slice(i, fin + 1).join('\n');
    const nombre = (cuerpo.match(/^\w+\s*\(\s*(['"`])([\s\S]*?)\1/) || [])[2] || '(sin titulo)';
    salida.push({
      inicio: i + 1,
      nombre: nombre,
      esGancho: GANCHOS.indexOf(m[1]) !== -1,
      cuerpo: cuerpo
    });
    i = fin + 1;
  }
  return salida;
}

// Números de línea (base 1) que están dentro del cuerpo de un `finally`.
function lineasDeFinally(lineas) {
  const dentro = new Set();
  for (let i = 0; i < lineas.length; i++) {
    if (!/\bfinally\b/.test(sinComentarios([lineas[i]]))) continue;
    // El cuerpo del finally empieza en la línea donde está su llave de apertura.
    let j = i;
    let abierto = false;
    while (j < lineas.length) {
      if (sinComentarios([lineas[j]]).indexOf('{') !== -1) { abierto = true; break; }
      j++;
    }
    if (!abierto) continue;
    const fin = finDeBloque(lineas, j);
    if (fin === null) continue;
    for (let k = j + 1; k <= fin; k++) dentro.add(k + 1);
  }
  return dentro;
}

function levanta(lineas) {
  return lineas.some((l) => {
    const limpia = sinComentarios([l]);
    if (SINCRONOS.test(limpia)) return false;
    return LEVANTA.some((re) => re.test(limpia));
  });
}

function cierres(lineas) {
  return lineas
    .map((l, k) => (CIERRA.some((re) => re.test(sinComentarios([l]))) ? k + 1 : 0))
    .filter((n) => n > 0);
}

test('RONDA-27 pieza 2 · ningun test de tests/ levanta un proceso sin cerrarlo en finally', () => {
  const ofensores = [];
  for (const archivo of archivosDePruebas(DIR_TESTS).sort()) {
    const src = fs.readFileSync(archivo, 'utf8');
    for (const bloque of bloques(src)) {
      if (bloque.esGancho) continue;
      const lineas = bloque.cuerpo.split(/\r?\n/);
      if (!levanta(lineas)) continue;
      const dentroDeFinally = lineasDeFinally(lineas);
      const cierresEnTest = cierres(lineas);
      const enFinally = cierresEnTest.filter((n) => dentroDeFinally.has(n));
      if (enFinally.length === 0) {
        ofensores.push(path.relative(RAIZ, archivo) + ':' + bloque.inicio +
          '  "' + bloque.nombre.slice(0, 70) + '"' +
          (cierresEnTest.length > 0 ? '  (cierra fuera del finally)' : '  (no cierra)'));
      }
    }
  }
  assert.deepEqual(ofensores, [],
    'todo test que levante un proceso tiene que cerrarlo en finally:\n' +
    (ofensores.length > 0 ? ofensores.join('\n') : '(sin ofensores)'));
});

test('RONDA-27 pieza 2 · tests/LEEME.md declara los dos topes en todos sus comandos', () => {
  // Los dos, y no uno: con sólo --test-timeout el test se pone rojo pero la
  // corrida queda colgada (medido: 300 s con el python huerfano vivo).
  const leeme = fs.readFileSync(path.join(DIR_TESTS, 'LEEME.md'), 'utf8');
  const lineas = leeme.split(/\r?\n/);
  const comandos = lineas
    .map((l, i) => ({ l: l.trim(), i: i + 1 }))
    .filter((x) => /^node\s+--test\b/.test(x.l));
  assert.ok(comandos.length > 0,
    'LEEME.md tiene al menos un comando de corrida (si no, el control no vigila nada)');
  const sinTimeout = comandos.filter((c) => c.l.indexOf('--test-timeout=120000') === -1);
  assert.deepEqual(sinTimeout.map((c) => 'LEEME.md:' + c.i + '  ' + c.l), [],
    'todo comando node --test de LEEME.md lleva --test-timeout=120000');
  const sinForce = comandos.filter((c) => c.l.indexOf('--test-force-exit') === -1);
  assert.deepEqual(sinForce.map((c) => 'LEEME.md:' + c.i + '  ' + c.l), [],
    'todo comando node --test de LEEME.md lleva --test-force-exit (sin el, la corrida se cuelga)');
});

test('RONDA-27 pieza 2 · el control se mira a si mismo (sanidad de la busqueda)', () => {
  // Si el control dejara de ver, por un cambio de forma, dejaria de servir.
  const bien = [
    "test('levanta y cierra bien', async () => {",
    "  const ctx = await arrancarServidor(datos, 0);",
    "  try {",
    "    assert.ok(ctx.puerto > 0);",
    "  } finally {",
    "    await detenerServidor(ctx);",
    "  }",
    "});"
  ].join('\n');
  const b1 = bloques(bien);
  assert.equal(b1.length, 1, 'el recorte de bloques encuentra el test');
  assert.equal(b1[0].nombre, 'levanta y cierra bien', 'y lee su nombre');
  const l1 = b1[0].cuerpo.split(/\r?\n/);
  assert.ok(levanta(l1), 'detecta que levanta un proceso');
  assert.deepEqual(cierres(l1), [6], 'el cierre esta en la linea 6');
  assert.ok(lineasDeFinally(l1).has(6), 'y esa linea esta dentro de un finally: el control no la marca');

  const sinCerrar = [
    "test('levanta y no cierra', async () => {",
    "  const ctx = await arrancarServidor(datos, 0);",
    "  assert.ok(ctx.puerto > 0);",
    "});"
  ].join('\n');
  const l2 = bloques(sinCerrar)[0].cuerpo.split(/\r?\n/);
  assert.ok(levanta(l2), 'detecta que levanta un proceso');
  assert.deepEqual(cierres(l2), [], 'y que no lo cierra');

  // El cierre en el camino feliz NO cuenta como cierre en finally.
  const caminoFeliz = [
    "test('cierra en el camino feliz', async () => {",
    "  const ctx = await arrancarServidor(datos, 0);",
    "  await detenerServidor(ctx);",
    "  assert.ok(true);",
    "});"
  ].join('\n');
  const l3 = bloques(caminoFeliz)[0].cuerpo.split(/\r?\n/);
  const c3 = cierres(l3);
  const f3 = lineasDeFinally(l3);
  assert.deepEqual(c3, [3], 'el caso feliz si cierra, en la linea 3');
  assert.equal(c3.filter((n) => f3.has(n)).length, 0,
    'pero no esta en un finally, que es exactamente lo que el control exige');
});
