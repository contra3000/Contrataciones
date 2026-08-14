'use strict';

/*
 * servidor.test.js
 * Pruebas de server/servidor.js (ORDEN-RONDA-03 §3.3 y §3.5).
 *
 * - Tests de unidad sobre los helpers exportados (atomicidad, lock).
 * - Tests de arranque: los argumentos inválidos no arrancan el proceso.
 * - Tests de integración con el proceso real: API, estáticos, índice,
 *   recorrido de rutas y los dos tests de concurrencia que definen la ronda
 *   (20 PUT simultáneos y 20 POST simultáneos × 10 corridas).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const servidor = require(path.join(RAIZ, 'server', 'servidor.js'));

const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  pedir,
  pedirConPath,
  ejecutarYEsperar,
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
// Unidad: escritura atómica
// ---------------------------------------------------------------------------
test('escribirTemporal deja el destino intacto; reemplazarTemporal lo reemplaza', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-atomic-'));
  try {
    const destino = path.join(dir, 'datos.json');
    fs.writeFileSync(destino, 'ORIGINAL', 'utf8');
    const tmp = servidor.escribirTemporal(destino, 'NUEVO');
    assert.ok(fs.existsSync(tmp), 'el temporal existe antes del rename');
    assert.equal(fs.readFileSync(destino, 'utf8'), 'ORIGINAL',
      'el destino no se toca hasta el rename (corte simulado entre escritura y rename)');
    servidor.reemplazarTemporal(tmp, destino);
    assert.equal(fs.readFileSync(destino, 'utf8'), 'NUEVO');
    assert.equal(fs.existsSync(tmp), false, 'no quedan temporales');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('escribirAtomico deja un JSON legible aunque el destino previo no exista', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-atomic-'));
  try {
    const destino = path.join(dir, 'datos.json');
    servidor.escribirAtomico(destino, JSON.stringify({ a: 1 }));
    assert.deepEqual(JSON.parse(fs.readFileSync(destino, 'utf8')), { a: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Unidad: lock de numeración (ADR-009)
// ---------------------------------------------------------------------------
test('adquirirLock crea el archivo con wx; un segundo lock falla y luego libera', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-lock-'));
  try {
    const rutaLock = path.join(dir, 'contador.lock');
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), true, 'primer lock se obtiene');
    assert.ok(fs.existsSync(rutaLock));
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), false, 'segundo lock con wx falla');
    servidor.liberarLock(rutaLock);
    assert.equal(fs.existsSync(rutaLock), false);
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), true, 'después de liberar se obtiene de nuevo');
    servidor.liberarLock(rutaLock);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('siguienteNumero serializa el contador por año', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-contador-'));
  try {
    assert.equal(servidor.siguienteNumero(dir, '2026'), 1);
    assert.equal(servidor.siguienteNumero(dir, '2026'), 2);
    assert.equal(servidor.siguienteNumero(dir, '2027'), 1);
    const contador = JSON.parse(fs.readFileSync(path.join(dir, 'contador.json'), 'utf8'));
    assert.deepEqual(contador, { contador: { 2026: 2, 2027: 1 } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Arranque: argumentos inválidos
// ---------------------------------------------------------------------------
test('sin --datos el servidor no arranca y explica por qué', async () => {
  const r = await ejecutarYEsperar([SERVIDOR, '--puerto', '0']);
  assert.notEqual(r.exitCode, 0);
  assert.match(r.stderr, /--datos/);
});

test('con --datos inexistente el servidor no arranca y explica por qué', async () => {
  const inexistente = path.join(os.tmpdir(), 'sgc-inexistente-' + Date.now());
  const r = await ejecutarYEsperar([SERVIDOR, '--datos', inexistente, '--puerto', '0']);
  assert.notEqual(r.exitCode, 0);
  assert.match(r.stderr, /no existe|--datos/i);
});

test('con --datos apuntando a un archivo el servidor no arranca', async () => {
  const archivo = path.join(os.tmpdir(), 'sgc-archivo-' + Date.now() + '.txt');
  fs.writeFileSync(archivo, 'x', 'utf8');
  try {
    const r = await ejecutarYEsperar([SERVIDOR, '--datos', archivo, '--puerto', '0']);
    assert.notEqual(r.exitCode, 0);
    assert.match(r.stderr, /archivo|directorio|--datos/i);
  } finally {
    fs.unlinkSync(archivo);
  }
});

test('con --puerto inválido el servidor no arranca', async () => {
  const datos = crearDirDatos('sgc-puerto-');
  try {
    const r = await ejecutarYEsperar([SERVIDOR, '--datos', datos, '--puerto', 'abc']);
    assert.notEqual(r.exitCode, 0);
    assert.match(r.stderr, /puerto/i);
  } finally {
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

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

// ---------------------------------------------------------------------------
// Concurrencia: 20 PUT simultáneos
// ---------------------------------------------------------------------------
test('CONCURRENCIA PUT: 20 PUT simultáneos dan exactamente 1×200 y 19×409', { timeout: 60000 }, async () => {
  const datosDir = crearDirDatos('sgc-put-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const creado = await pedir(base, 'POST', '/api/expedientes', {
      datosIniciales: { titulo: 'Base', anio: '2026' },
      contexto: contextoBase()
    });
    const id = creado.body.id;

    const resultados = await Promise.all(
      Array.from({ length: 20 }, (_, i) => pedir(base, 'PUT', '/api/expedientes/' + id, {
        expediente: {
          expedienteId: id,
          titulo: 'Base',
          estadoActual: 'ESPECIFICACIONES_TECNICAS',
          marca: 'put-' + i
        },
        versionEsperada: 1,
        contexto: contextoBase()
      }))
    );

    const ok = resultados.filter((r) => r.status === 200);
    const conf = resultados.filter((r) => r.status === 409);
    assert.equal(ok.length, 1, 'exactamente un PUT gana');
    assert.equal(conf.length, 19, 'los otros 19 pierden por conflicto');

    const indiceGanador = resultados.findIndex((r) => r.status === 200);
    assert.notEqual(indiceGanador, -1);
    assert.deepEqual(ok[0].body, { version: 2 });

    const doc = JSON.parse(fs.readFileSync(
      path.join(datosDir, '2026', id.split('-')[1] + '_Expediente', 'datos.json'),
      'utf8'
    ));
    assert.equal(doc.marca, 'put-' + indiceGanador,
      'datos.json contiene exactamente el contenido del ganador');
    assert.equal(doc.version, 2);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Concurrencia: 20 POST simultáneos × 10 corridas
// ---------------------------------------------------------------------------
test('CONCURRENCIA POST: 20 POST simultáneos dan 20 ids distintos, 10 corridas', { timeout: 180000 }, async () => {
  for (let corrida = 0; corrida < 10; corrida++) {
    const datosDir = crearDirDatos('sgc-post-');
    const ctx = await arrancarServidor(datosDir);
    try {
      const base = 'http://127.0.0.1:' + ctx.puerto;
      const respuestas = await Promise.all(
        Array.from({ length: 20 }, () => pedir(base, 'POST', '/api/expedientes', {
          datosIniciales: { titulo: 'Concurrente', anio: '2026' },
          contexto: contextoBase()
        }))
      );
      for (const r of respuestas) {
        assert.equal(r.status, 201, 'corrida ' + corrida + ': todos los POST deben responder 201');
      }
      const ids = respuestas.map((r) => r.body.id);
      const numeros = ids.map((i) => parseInt(i.split('-')[1], 10)).sort((a, b) => a - b);
      assert.equal(new Set(ids).size, 20, 'corrida ' + corrida + ': 20 ids distintos');
      assert.deepEqual(numeros,
        Array.from({ length: 20 }, (_, i) => i + 1),
        'corrida ' + corrida + ': sin huecos ni duplicados');
    } finally {
      await detenerServidor(ctx);
      fs.rmSync(datosDir, { recursive: true, force: true });
    }
  }
});