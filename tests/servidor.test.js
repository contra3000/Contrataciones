'use strict';

/*
 * servidor.test.js
 * Integración de server/servidor.js con el proceso real (ORDEN-RONDA-03 §3.3
 * y §3.5): API, estáticos, índice, recorrido de rutas y el 409 por conflicto.
 * Los tests de unidad de los helpers y del arranque viven en
 * servidor-ayudantes.test.js y los dos de concurrencia en
 * servidor-concurrencia.test.js (ORDEN-RONDA-07 §2.2).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  pedir,
  pedirConPath,
  SERVIDOR,
  NODE
} = require('./helpers/servidor-util.js');

function contextoBase(extra) {
  return Object.assign({
    timestamp: '2026-08-14T10:00:00.000Z',
    email: 'operador@faa.mil.ar',
    rol: 'contrataciones',
    equipo: 'PC-PRUEBA-01'
  }, extra || {});
}

// ---------------------------------------------------------------------------
// Integración: salud y estáticos
// ---------------------------------------------------------------------------
test('GET /api/salud responde 200 con ok, version y datos accesible', async () => {
  const datosDir = crearDirDatos('sgc-salud-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const r = await pedir(base, 'GET', '/api/salud');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(typeof r.body.version, 'string');
    assert.equal(r.body.datos, 'accesible');
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('sirve los estáticos de app/ en /', async () => {
  const datosDir = crearDirDatos('sgc-estatico-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const raiz = await pedir(base, 'GET', '/');
    assert.equal(raiz.status, 200);
    assert.match(raiz.raw, /<title>SGC/);
    assert.match(raiz.raw, /js\/core\/namespaces\.js/);
    const core = await pedir(base, 'GET', '/js/core/namespaces.js');
    assert.equal(core.status, 200);
    assert.match(core.raw, /SGC/);
    const faltante = await pedir(base, 'GET', '/no-existe.html');
    assert.equal(faltante.status, 404);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integración: ciclo de vida de la API
// ---------------------------------------------------------------------------
test('POST, GET y PUT completan el ciclo con versiones correctas', async () => {
  const datosDir = crearDirDatos('sgc-api-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const creado = await pedir(base, 'POST', '/api/expedientes', {
      datosIniciales: { titulo: 'Resmas A4', anio: '2026' },
      contexto: contextoBase()
    });
    assert.equal(creado.status, 201);
    assert.match(creado.body.id, /^2026-\d{3}$/);
    assert.equal(creado.body.version, 1);
    assert.equal(creado.body.expediente.estado.id, 'ESPECIFICACIONES_TECNICAS');

    const leido = await pedir(base, 'GET', '/api/expedientes/' + creado.body.id);
    assert.equal(leido.status, 200);
    assert.equal(leido.body.version, 1);
    assert.equal(leido.body.expediente.titulo, 'Resmas A4');

    const actualizado = await pedir(base, 'PUT', '/api/expedientes/' + creado.body.id, {
      expediente: Object.assign({}, leido.body.expediente, { titulo: 'Resmas A4 (mod)' }),
      versionEsperada: 1,
      contexto: contextoBase()
    });
    assert.equal(actualizado.status, 200);
    assert.deepEqual(actualizado.body, { version: 2 });

    const rel = await pedir(base, 'GET', '/api/expedientes/' + creado.body.id);
    assert.equal(rel.body.version, 2);
    assert.equal(rel.body.expediente.titulo, 'Resmas A4 (mod)');

    const hist = path.join(datosDir, '2026', creado.body.id.split('-')[1] + '_Expediente', 'hist', 'v1.json');
    assert.ok(fs.existsSync(hist), 'se guarda el snapshot de la versión previa');

    const inexistente = await pedir(base, 'GET', '/api/expedientes/2026-999');
    assert.equal(inexistente.status, 404);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('el origen de la petición se registra junto al contexto (ADR-017 medida 3)', async () => {
  const datosDir = crearDirDatos('sgc-origen-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const contexto = contextoBase({ timestamp: '2026-08-14T12:34:56.789Z' });
    await pedir(base, 'POST', '/api/expedientes', {
      datosIniciales: { titulo: 'X', anio: '2026' },
      contexto
    });
    const lineas = fs.readFileSync(path.join(datosDir, 'origen.log'), 'utf8')
      .split('\n').filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
    const post = lineas.find((l) => l.metodo === 'POST');
    assert.ok(post, 'existe una línea de origen para el POST');
    assert.ok(post.ip.length > 0, 'se registra la dirección de red');
    assert.ok(post.hostname.length > 0, 'se registra el nombre del equipo');
    assert.equal(post.contexto.timestamp, '2026-08-14T12:34:56.789Z');
    assert.match(post.ruta, /\/api\/expedientes/);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integración: índice fragmentado (ADR-005)
// ---------------------------------------------------------------------------
test('tres expedientes dejan tres archivos en idx/ y tres entradas en el índice', async () => {
  const datosDir = crearDirDatos('sgc-idx-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const r = await pedir(base, 'POST', '/api/expedientes', {
        datosIniciales: { titulo: 'Expediente ' + i, anio: '2026' },
        contexto: contextoBase()
      });
      assert.equal(r.status, 201);
      ids.push(r.body.id);
    }
    const archivosIdx = fs.readdirSync(path.join(datosDir, 'idx')).filter((a) => a.endsWith('.json'));
    assert.equal(archivosIdx.length, 3);
    assert.deepEqual(archivosIdx.sort(), ids.map((i) => i + '.json').sort());

    const indice = await pedir(base, 'GET', '/api/indice');
    assert.equal(indice.status, 200);
    assert.ok(Array.isArray(indice.body));
    assert.equal(indice.body.length, 3);
    for (const entrada of indice.body) {
      assert.equal(typeof entrada.id, 'string');
      assert.equal(entrada.estado, 'ESPECIFICACIONES_TECNICAS');
      assert.equal(entrada.fase, 1);
      assert.equal(entrada.rolEjecutor, 'generador');
      assert.equal(entrada.sector, 'usuario');
      assert.equal(entrada.actualizado, '2026-08-14T10:00:00.000Z');
    }
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integración: configuración (padrón ADR-017)
// ---------------------------------------------------------------------------
test('sirve config/ con JSON y rechaza el recorrido de rutas y lo inexistente', async () => {
  const datosDir = crearDirDatos('sgc-config-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const padron = await pedir(base, 'GET', '/config/usuarios.ejemplo.json');
    assert.equal(padron.status, 200);
    assert.equal(padron.body.schemaVersion, '1.0.0');
    assert.ok(Array.isArray(padron.body.usuarios));
    assert.equal(padron.body.usuarios.length > 0, true);
    assert.equal(typeof padron.body.usuarios[0].email, 'string');

    const directorio = await pedir(base, 'GET', '/config/');
    assert.equal(directorio.status, 404, 'un directorio no se sirve');

    const inexistente = await pedir(base, 'GET', '/config/no-existe.json');
    assert.equal(inexistente.status, 404);

    const fuera = await pedirConPath(base, 'GET', '/config/../package.json');
    assert.equal(fuera.status, 403, 'el recorrido fuera de config/ se bloquea');
    const codificado = await pedirConPath(base, 'GET', '/config/%2e%2e/package.json');
    assert.equal(codificado.status, 404, 'un nombre codificado no escapa: se trata como nombre literal');
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integración: validación de códigos por servidor (ORDEN-RONDA-06 §2.2)
// ---------------------------------------------------------------------------
test('POST /api/catalogo/validar-codigos devuelve exactamente los códigos inexistentes', async () => {
  const datosDir = crearDirDatos('sgc-validar-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;

    const mezcla = await pedir(base, 'POST', '/api/catalogo/validar-codigos', {
      codigos: ['2.1.1-439.102', '99.9-9999.9', '2.1.1-439.102', '99.9-9999.9', '00.0-0000.0']
    });
    assert.equal(mezcla.status, 200);
    assert.deepEqual(mezcla.body.invalidos, ['99.9-9999.9', '00.0-0000.0'],
      'sólo los inexistentes, una vez cada uno aunque el código se repita');
    assert.match(mezcla.body.catalogoVersion, /^[0-9a-f]{8}$/, 'se devuelve la versión del catálogo');

    const vacio = await pedir(base, 'POST', '/api/catalogo/validar-codigos', { codigos: [] });
    assert.equal(vacio.status, 200);
    assert.deepEqual(vacio.body.invalidos, []);

    const todosValidos = await pedir(base, 'POST', '/api/catalogo/validar-codigos', {
      codigos: ['2.1.1-439.102']
    });
    assert.equal(todosValidos.status, 200);
    assert.deepEqual(todosValidos.body.invalidos, [], 'nada que no exista, nada que informar');

    const masDelMaximo = await pedir(base, 'POST', '/api/catalogo/validar-codigos', {
      codigos: Array.from({ length: 1001 }, () => 'x')
    });
    assert.equal(masDelMaximo.status, 400);
    assert.match(masDelMaximo.body.error, /máximo/);

    const sinArreglo = await pedir(base, 'POST', '/api/catalogo/validar-codigos', { codigos: 'x' });
    assert.equal(sinArreglo.status, 400);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Concurrencia (ORDEN-RONDA-06 §3.3): dos operadores con la misma versión.
// ---------------------------------------------------------------------------
test('el segundo guardado con la misma versión esperada recibe un 409 con conflicto', async () => {
  const datosDir = crearDirDatos('sgc-conflicto-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const creado = await pedir(base, 'POST', '/api/expedientes', {
      datosIniciales: { titulo: 'Resmas A4', anio: '2026' },
      contexto: contextoBase({ email: 'maria.gonzalez@faa.mil.ar' })
    });
    const id = creado.body.id;

    const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
    const primero = await pedir(base, 'PUT', '/api/expedientes/' + id, {
      expediente: Object.assign({}, leido.body.expediente, { titulo: 'Resmas A4 (mod)' }),
      versionEsperada: 1,
      contexto: contextoBase({ email: 'maria.gonzalez@faa.mil.ar' })
    });
    assert.equal(primero.status, 200);

    const segundo = await pedir(base, 'PUT', '/api/expedientes/' + id, {
      expediente: Object.assign({}, leido.body.expediente, { titulo: 'Resmas A4 (otro operador)' }),
      versionEsperada: 1,
      contexto: contextoBase({ email: 'carlos.ramirez@faa.mil.ar' })
    });
    assert.equal(segundo.status, 409);
    assert.deepEqual(segundo.body, { conflicto: true, versionRemota: 2 });

    const final = await pedir(base, 'GET', '/api/expedientes/' + id);
    assert.equal(final.body.expediente.titulo, 'Resmas A4 (mod)',
      'el primer cambio queda; el conflicto no pisa lo ajeno');
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Recorrido de rutas
// ---------------------------------------------------------------------------
test('GET y PUT con ../../secreto devuelven 400 sin tocar el disco', async () => {
  const datosDir = crearDirDatos('sgc-rutas-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const rGet = await pedirConPath(base, 'GET', '/api/expedientes/../../secreto');
    assert.equal(rGet.status, 400);
    const rPut = await pedirConPath(base, 'PUT', '/api/expedientes/../../secreto', {
      expediente: {},
      versionEsperada: 1,
      contexto: {}
    });
    assert.equal(rPut.status, 400);
    const rExtra = await pedirConPath(base, 'PUT', '/api/expedientes/2026-001/../..', {
      expediente: {},
      versionEsperada: 1,
      contexto: {}
    });
    assert.equal(rExtra.status, 400);

    const contenido = fs.readdirSync(datosDir);
    assert.ok(!contenido.includes('secreto'), 'no se crea ningún archivo "secreto"');
    assert.ok(!contenido.includes('idx'), 'no se crea el índice');
    assert.ok(!contenido.includes('2026'), 'no se crea ninguna carpeta de expediente');
    const padre = path.dirname(datosDir);
    const enPadre = fs.readdirSync(padre);
    assert.ok(!enPadre.some((n) => n === 'secreto'), 'nada aparece fuera del directorio de datos');
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});