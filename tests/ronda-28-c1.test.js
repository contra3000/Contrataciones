'use strict';

/*
 * ronda-28-c1.test.js
 * RONDA-28 · pieza 1 · "El catálogo carga sin red" (ORDEN-RONDA-28 §1).
 *
 * El generador se abre con doble clic, o sea file://, y Chrome no deja hacer
 * fetch ahí. La rama de carga.js tiene que inyectar un <script> que llama a
 * SGC.catalogo.recibir, y el build tiene que escribir ese .js hermano de cada
 * .json.
 *
 * Todo lo que levanta procesos --el build contra el fixture, y el catálogo
 * real-- cierra en su finally o en su after, para que la suite no cuelgue.
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const NODE = process.execPath;
const BUILD = path.join(RAIZ, 'tools', 'build-catalogo.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'catalogo-muestra.json');

let dirBuild = null;
let erroresDeRed = null;

function ejecutarBuild(salida, entrada) {
  const res = spawnSync(NODE, [BUILD, '--entrada', entrada, '--salida', salida], {
    encoding: 'utf8',
    timeout: 180000
  });
  assert.strictEqual(res.status, 0, 'el build falló:\n' + res.stdout + res.stderr);
  return res.stdout;
}

// Cuenta los .json y los .js hermanos de una carpeta de catálogo.
function contarFormato(dir) {
  const cuentas = { json: 0, js: 0 };
  const pila = [dir];
  while (pila.length > 0) {
    const actual = pila.pop();
    for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
      const ruta = path.join(actual, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(ruta);
      } else if (entrada.name.endsWith('.json')) {
        cuentas.json++;
        if (fs.existsSync(ruta.replace(/\.json$/, '.js'))) {
          cuentas.js++;
        }
      }
    }
  }
  return cuentas;
}

/*
 * Carga carga.js con un SGC recién hecho y un document mínimo que sabe
 * "ejecutar" un <script>: lee el archivo del disco en la carpeta indicada y lo
 * evalúa, que es exactamente lo que hace Chrome con file://.
 *
 * carga.js se carga con require, como el resto de los módulos en esta suite, y
 * se saca del caché en cada montaje para poder repetirlo con otro protocol.
 * El .js hermano del catálogo se evalúa con vm.runInThisContext: comparte el
 * globalThis, así que ve el mismo SGC que acaba de montar.
 */
function montarCargaJs(opciones) {
  const SGC = {};
  SGC.catalogo = { indice: { montar: () => 0, registrarCodigos: () => undefined } };

  const scriptsInyectados = [];
  const documento = {
    head: {
      appendChild: (etiqueta) => {
        scriptsInyectados.push(etiqueta.src);
        if (opciones.fallarScripts) {
          etiqueta.onerror();
          return etiqueta;
        }
        // Rutas relativas al documento: el fixture del build está en la
        // salida, así que se resuelve quitando el prefijo 'catalogo/'.
        const relativo = etiqueta.src.replace(/^catalogo\//, '');
        const codigo = fs.readFileSync(path.join(opciones.carpeta, relativo), 'utf8');
        vm.runInThisContext(codigo, { filename: etiqueta.src });
        return etiqueta;
      }
    },
    createElement: (tag) => ({ tag: tag, src: '', onerror: null })
  };

  const anterior = {
    SGC: globalThis.SGC,
    document: globalThis.document,
    location: globalThis.location,
    fetch: globalThis.fetch
  };
  globalThis.SGC = SGC;
  globalThis.document = documento;
  globalThis.location = opciones.location;
  delete require.cache[require.resolve(path.join(RAIZ, 'app', 'js', 'catalogo', 'carga.js'))];
  require(path.join(RAIZ, 'app', 'js', 'catalogo', 'carga.js'));

  return {
    SGC: SGC,
    scriptsInyectados: scriptsInyectados,
    restaurar: () => {
      delete require.cache[require.resolve(path.join(RAIZ, 'app', 'js', 'catalogo', 'carga.js'))];
      globalThis.SGC = anterior.SGC;
      globalThis.document = anterior.document;
      globalThis.location = anterior.location;
      globalThis.fetch = anterior.fetch;
    }
  };
}

// fetch de mentira: si el cargador lo usa bajo file:, el test falla.
function fetchQueSeNiega() {
  return function () {
    erroresDeRed.push('fetch');
    return Promise.reject(new Error('el cargador no debe pedir por red bajo file://'));
  };
}

before(() => {
  assert.ok(fs.existsSync(FIXTURE), 'el fixture del catálogo debe existir');
  dirBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-r28-c1-'));
  try {
    ejecutarBuild(dirBuild, FIXTURE);
  } catch (err) {
    fs.rmSync(dirBuild, { recursive: true, force: true });
    dirBuild = null;
    throw err;
  }
});

after(() => {
  if (dirBuild) {
    fs.rmSync(dirBuild, { recursive: true, force: true });
  }
});

beforeEach(() => {
  erroresDeRed = [];
});

test('el build escribe un .js hermano por cada .json, con los mismos datos', () => {
  const cuentas = contarFormato(dirBuild);
  assert.ok(cuentas.json > 0, 'el fixture debe producir fragmentos');
  assert.strictEqual(cuentas.js, cuentas.json,
    'debe haber un .js por cada .json (' + cuentas.js + ' de ' + cuentas.json + ')');

  const manifiestoJson = JSON.parse(fs.readFileSync(path.join(dirBuild, 'manifiesto.json'), 'utf8'));
  const codigoJs = fs.readFileSync(path.join(dirBuild, 'manifiesto.js'), 'utf8');
  assert.match(codigoJs, /^SGC\.catalogo\.recibir\(/,
    'el hermano llama a SGC.catalogo.recibir');
  // Se evalúa el archivo entero con un SGC de mentira, que es lo que hace el
  // navegador: la clave que entrega tiene que ser la ruta lógica .js.
  const recibido = { clave: null, datos: null };
  const sgcAnterior = globalThis.SGC;
  globalThis.SGC = {
    catalogo: { recibir: (clave, datos) => { recibido.clave = clave; recibido.datos = datos; } }
  };
  try {
    vm.runInThisContext(codigoJs, { filename: 'manifiesto.js' });
  } finally {
    globalThis.SGC = sgcAnterior;
  }
  assert.strictEqual(recibido.clave, 'catalogo/manifiesto.js',
    'la clave entregada es la ruta lógica con extensión .js');
  assert.deepStrictEqual(recibido.datos, manifiestoJson,
    'el .js entrega exactamente los datos del .json');
});

test('bajo file: el cargador inyecta <script> con la ruta .js y resuelve con los datos', async () => {
  const montura = montarCargaJs({ carpeta: dirBuild, location: { protocol: 'file:' } });
  globalThis.fetch = fetchQueSeNiega();
  try {
    const estado = await montura.SGC.catalogo.carga.iniciar();

    assert.deepStrictEqual(erroresDeRed, [], 'no debe haber ninguna llamada de red');
    assert.deepStrictEqual(montura.scriptsInyectados.sort(), [
      'catalogo/clases.js',
      'catalogo/manifiesto.js',
      'catalogo/rubros.js'
    ], 'debe inyectar los tres scripts del índice, con extensión .js');

    const manifiestoJson = JSON.parse(fs.readFileSync(path.join(dirBuild, 'manifiesto.json'), 'utf8'));
    assert.deepStrictEqual(estado.manifiesto, manifiestoJson, 'el manifiesto llegó igual');
    assert.ok(estado.clases.length > 0, 'las clases llegaron');
    assert.strictEqual(estado.clasesPorId[estado.clases[0][0]].clase, estado.clases[0][2],
      'el índice de clases quedó armado');
  } finally {
    montura.restaurar();
  }
});

test('bajo file: un fragmento de ítems también se carga por <script>', async () => {
  const montura = montarCargaJs({ carpeta: dirBuild, location: { protocol: 'file:' } });
  globalThis.fetch = fetchQueSeNiega();
  try {
    await montura.SGC.catalogo.carga.iniciar();
    const carga = montura.SGC.catalogo.carga;
    const idClase = carga.obtenerEstado().clases[0][0];
    const partes = carga.obtenerEstado().clasesPorId[idClase].partes;
    const items = await carga.cargarClase(idClase);

    assert.ok(items.length > 0, 'debe traer ítems');
    assert.ok(items.every((i) => typeof i.codigo === 'string' && typeof i.item === 'string'),
      'cada ítem trae codigo e item');
    const inyectados = montura.scriptsInyectados
      .filter((s) => s.indexOf('catalogo/items/') === 0);
    assert.strictEqual(inyectados.length, partes,
      'debe inyectar un script por parte de la clase');
    assert.ok(carga.obtenerEstado().fragmentos[idClase], 'el fragmento quedó cacheado');
  } finally {
    montura.restaurar();
  }
});

test('bajo file: si el .js no está, la promesa se rechaza con un mensaje de castellano', async () => {
  const carpetaVacia = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-r28-c1-vacio-'));
  const montura = montarCargaJs({
    carpeta: carpetaVacia,
    location: { protocol: 'file:' },
    fallarScripts: true
  });
  globalThis.fetch = fetchQueSeNiega();
  try {
    await assert.rejects(
      () => montura.SGC.catalogo.carga.iniciar(),
      (e) => {
        assert.match(e.message, /^No se pudo leer /,
          'el error dice qué no se pudo leer: ' + e.message);
        return true;
      }
    );
  } finally {
    montura.restaurar();
    fs.rmSync(carpetaVacia, { recursive: true, force: true });
  }
});

test('con http: el cargador sigue usando fetch y no inyecta ningún <script>', async () => {
  const peticiones = [];
  const montura = montarCargaJs({ carpeta: dirBuild, location: { protocol: 'http:' } });
  globalThis.fetch = (ruta) => {
    peticiones.push(ruta);
    const texto = fs.readFileSync(path.join(dirBuild, ruta.replace(/^catalogo\//, '')), 'utf8');
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(texto)) });
  };
  try {
    const estado = await montura.SGC.catalogo.carga.iniciar();

    assert.deepStrictEqual(peticiones.sort(), [
      'catalogo/clases.json',
      'catalogo/manifiesto.json',
      'catalogo/rubros.json'
    ], 'con http: pide los .json por fetch, como antes');
    assert.deepStrictEqual(montura.scriptsInyectados, [], 'con http: no se inyecta ningún script');
    assert.ok(estado.clases.length > 0, 'las clases llegaron igual');
  } finally {
    montura.restaurar();
  }
});

test('sin location (Node) el cargador usa fetch, que es el caso de siempre', async () => {
  const peticiones = [];
  const montura = montarCargaJs({ carpeta: dirBuild, location: undefined });
  globalThis.fetch = (ruta) => {
    peticiones.push(ruta);
    const texto = fs.readFileSync(path.join(dirBuild, ruta.replace(/^catalogo\//, '')), 'utf8');
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(texto)) });
  };
  try {
    await montura.SGC.catalogo.carga.iniciar();
    assert.ok(peticiones.length > 0, 'sin location se pide por fetch');
    assert.deepStrictEqual(montura.scriptsInyectados, [], 'sin location no hay scripts');
  } finally {
    montura.restaurar();
  }
});

test('SGC.catalogo.recibir guarda lo que llega antes de que alguien lo pida', async () => {
  const montura = montarCargaJs({ carpeta: dirBuild, location: { protocol: 'file:' } });
  globalThis.fetch = fetchQueSeNiega();
  try {
    montura.SGC.catalogo.recibir('catalogo/rubros.js', [{ idRubro: 1, rubro: 'PRUEBA' }]);
    const estado = await montura.SGC.catalogo.carga.iniciar();
    assert.deepStrictEqual(estado.rubros, [{ idRubro: 1, rubro: 'PRUEBA' }],
      'el rubro entregado antes de tiempo se usa igual');
  } finally {
    montura.restaurar();
  }
});

test('el catálogo real versionado también tiene su .js hermano para cada .json', () => {
  const CAT = path.join(RAIZ, 'app', 'catalogo');
  const cuentas = contarFormato(CAT);
  assert.ok(cuentas.json > 1000, 'el catálogo versionado tiene muchos fragmentos (' + cuentas.json + ')');
  assert.strictEqual(cuentas.js, cuentas.json,
    'faltan .js hermanos: ' + cuentas.js + ' de ' + cuentas.json);
});