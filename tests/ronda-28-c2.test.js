'use strict';

/*
 * ronda-28-c2.test.js
 * RONDA-28 · pieza 2 · "generador.html: rol, nombre y nada de red"
 * (ORDEN-RONDA-28 §2, ADR-044).
 *
 * La montura de helpers/generador-montura.js abre app/generador.html como lo
 * abre el Jefe: con location.protocol = 'file:', sin servidor levantado y con
 * fetch y XMLHttpRequest de espía. Si algo pide por red, el test lo ve.
 *
 * Lo que se comprueba acá:
 *  - el generador arranca sin servidor y NO hace ningún pedido de red;
 *  - elegir Usuario muestra el alta (el asistente de siempre);
 *  - elegir Abastecimiento o Contrataciones dice que llegan en la ronda 29/30;
 *  - la configuración llega como .js, y el .js versionado está al día con el
 *    .json del que se genera;
 *  - el generador carga el mismo núcleo que la aplicación con servidor, y no
 *    carga los adaptadores de red ni el arranque de la aplicación con servidor.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const gm = require('./helpers/generador-montura.js');

const RAIZ = path.join(__dirname, '..');
const APP_DIR = path.join(RAIZ, 'app');
const INDEX_HTML = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
const GENERADOR_JS = fs.readFileSync(path.join(APP_DIR, 'js', 'generador.js'), 'utf8');
const RUTA_CONFIG = 'config/aplicacion.json';

// Una montura por archivo: node --test corre este archivo en su propio proceso,
// pero los módulos se cargan una sola vez (require cachea), así que alcanza con
// reconstruir el DOM y volver a correr el arranque en cada test.
let m = null;

before(async () => {
  m = await gm.arrancar();
});

async function arrancar() {
  await m.correr();
  return m;
}

// El catálogo se carga por <script>, y eso es asíncrono. Se espera a que el
// índice esté montado antes de afirmar nada del estado.
async function esperarCatalogo() {
  await m.esperar(() => {
    const est = globalThis.SGC.catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
}

async function entrarComo(nombre, rol) {
  await arrancar();
  m.setear('sgc-generador-nombre', nombre);
  // ORDEN-RONDA-29 pieza 2: desde la ronda 29 la identidad son cuatro datos.
  m.completarIdentidad();
  m.elegirRol(rol);
  return m;
}

test('la franja dice, a la vista, que no hay servidor', async () => {
  await arrancar();
  const franja = m.franja();
  assert.ok(franja, 'generador.html tiene la franja visible');
  assert.strictEqual(franja.hidden, false, 'la franja no arranca oculta');
  assert.strictEqual(franja.textContent.trim(),
    'Generador de documentos — sin servidor. Lo que hagas queda en el archivo que exportes.',
    'la franja dice lo que tiene que decir');
});

test('el generador arranca sin servidor y no hace ningún pedido de red', async () => {
  await arrancar();
  await m.esperar(() => globalThis.SGC.generador, 20000, 'el generador arrancó');

  assert.deepStrictEqual(m.red.llamadas, [],
    'arrancar no puede pedir nada por red: ' + m.red.llamadas.join(', '));

  // Tampoco al entrar como Usuario: el arranque completo, con el catálogo de
  // ~40 MB entrando por <script>, tiene que dejar la red en cero.
  await entrarComo('Ana Pérez', 'generador');
  await esperarCatalogo();

  assert.deepStrictEqual(m.red.llamadas, [],
    'ni fetch ni XMLHttpRequest en todo el arranque: ' + m.red.llamadas.join(', '));

  const sgc = globalThis.SGC;
  assert.strictEqual(sgc.adapters.repoHttp, undefined,
    'el generador no carga el repositorio por HTTP');
  assert.strictEqual(sgc.adapters.sesion, undefined,
    'el generador no carga el adaptador de sesión');
  assert.ok(sgc.adapters.repoMemoria, 'el repositorio del generador es el de memoria');
  assert.strictEqual(typeof sgc.adapters.repo.crearExpediente, 'function',
    'el repositorio de la sesión es el de memoria, con el mismo contrato');
});

test('el catálogo del generador entra por <script>, desde los .js hermanos reales', async () => {
  await arrancar();
  await esperarCatalogo();

  const delIndice = m.scriptsInyectados.filter((s) => s.indexOf('catalogo/') === 0);
  assert.deepStrictEqual(delIndice.slice().sort(), [
    'catalogo/clases.js',
    'catalogo/manifiesto.js',
    'catalogo/rubros.js'
  ], 'el índice del catálogo se pidió como .js, no como .json');

  const est = globalThis.SGC.catalogo.carga.obtenerEstado();
  const manifiesto = JSON.parse(
    fs.readFileSync(path.join(APP_DIR, 'catalogo', 'manifiesto.json'), 'utf8'));
  assert.deepStrictEqual(est.manifiesto, manifiesto,
    'el manifiesto que llegó por <script> es el del repo');
  assert.ok(est.manifiesto.registros > 1000,
    'es el catálogo real (' + est.manifiesto.registros + ' registros)');
});

test('elegir Usuario muestra el alta, con el nombre del operador a la vista', async () => {
  await entrarComo('Ana Pérez', 'generador');
  const d = m.documento;

  assert.strictEqual(d.getElementById('sgc-seleccion-operador').hidden, true,
    'la pantalla de selección de operador queda atrás');
  assert.strictEqual(d.getElementById('sgc-app').hidden, false,
    'el alta del asistente queda a la vista');

  const operador = globalThis.SGC.generador.operadorActual();
  assert.strictEqual(operador.nombre, 'Ana Pérez');
  assert.strictEqual(operador.rol, 'generador', 'el rol elegido es el del generador');
  assert.ok(operador.roles.indexOf('generador') !== -1,
    'el rol del operador incluye el que ejecuta el primer estado');

  assert.match(d.getElementById('sgc-operador-actual').textContent, /Ana Pérez/,
    'el nombre elegido queda escrito en el asistente');
  assert.strictEqual(d.getElementById('sgc-paso-identificacion').hidden, false,
    'arranca en el paso 1 · Identificación');
  assert.deepStrictEqual(m.red.llamadas, [], 'entrar tampoco hace pedidos por red');
});

test('sin nombre no se entra', async () => {
  await arrancar();
  m.completarIdentidad();
  m.setear('sgc-generador-nombre', '   ');
  m.elegirRol('generador');

  const d = m.documento;
  assert.strictEqual(d.getElementById('sgc-app').hidden, true,
    'sin nombre no se abre el alta');
  const error = d.getElementById('sgc-generador-error');
  assert.strictEqual(error.hidden, false, 'el error se ve');
  assert.match(error.textContent, /nombre/i, 'el error dice qué falta');
});

test('Abastecimiento y Contrataciones dicen que llegan en la próxima versión', async () => {
  const d = m.documento;
  for (const caso of [
    { rol: 'abastecimiento', nombre: 'Abastecimiento' },
    { rol: 'contrataciones', nombre: 'Contrataciones' }
  ]) {
    await arrancar();
    m.setear('sgc-generador-nombre', 'Beto');
    m.completarIdentidad();
    m.elegirRol(caso.rol);

    assert.strictEqual(d.getElementById('sgc-app').hidden, true,
      caso.nombre + ' todavía no tiene vista: el alta no se abre');
    const msj = d.getElementById('sgc-generador-msj');
    assert.strictEqual(msj.hidden, false, caso.nombre + ' ve el aviso');
    assert.match(msj.textContent, /próxima versión/,
      caso.nombre + ': el aviso dice que llega en la próxima versión');
    assert.ok(msj.textContent.indexOf(caso.nombre) === 0,
      'el aviso empieza nombrando el rol: ' + msj.textContent);
  }
});

test('la configuración llega como .js, y el .js versionado está al día', () => {
  const rutaJs = path.join(APP_DIR, 'config', 'aplicacion.js');
  assert.ok(fs.existsSync(rutaJs),
    'app/config/aplicacion.js existe: la configuración no se pide por fetch');

  const codigo = fs.readFileSync(rutaJs, 'utf8');
  assert.match(codigo, /^SGC\.cargaConfig\.recibir\("config\/aplicacion\.json",/,
    'el hermano llama a SGC.cargaConfig.recibir con la ruta lógica');

  const original = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'aplicacion.json'), 'utf8'));
  const entregado = JSON.parse(codigo.slice(codigo.indexOf(',') + 1, codigo.lastIndexOf(')')));
  assert.deepStrictEqual(entregado, original,
    'los datos del .js son los del .json, sin copia a mano');

  // El verificador del build: si alguien edita el .json y no corre el build, el
  // test se da cuenta.
  const res = spawnSync(process.execPath, [path.join(RAIZ, 'tools', 'build-config.js'), '--verificar'], {
    encoding: 'utf8',
    timeout: 60000
  });
  assert.strictEqual(res.status, 0,
    'build-config --verificar tiene que pasar:\n' + res.stdout + res.stderr);
});

test('el generador no dice "config/aplicacion.json" con fetch en ningún lado', () => {
  // El guardia del orden es el arranque, pero un fetch futuro se colaría sin
  // que se note: se chequea el texto de los dos archivos que hacen el arranque.
  for (const [nombre, codigo] of [
    ['app/js/generador.js', GENERADOR_JS],
    ['app/js/generador/config-carga.js',
      fs.readFileSync(path.join(APP_DIR, 'js', 'generador', 'config-carga.js'), 'utf8')]
  ]) {
    const codigoSinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.strictEqual(/\bfetch\s*\(/.test(codigoSinComentarios), false,
      nombre + ' no puede llamar a fetch');
    assert.strictEqual(/XMLHttpRequest/.test(codigoSinComentarios), false,
      nombre + ' no puede usar XMLHttpRequest');
  }
  assert.ok(GENERADOR_JS.indexOf(RUTA_CONFIG) !== -1,
    'el arranque lee la configuración de esa ruta, como .js');
});

test('el generador carga el mismo núcleo que la aplicación con servidor', () => {
  const re = /<script\s+src="([^"]+)"\s*>/g;
  const delIndex = (function () {
    const lista = [];
    let m;
    while ((m = re.exec(INDEX_HTML))) {
      lista.push(m[1]);
    }
    return lista;
  }());

  const delGenerador = m.scripts();

  // Todo lo del núcleo, el catálogo y las vistas que el asistente usa tiene que
  // estar en las dos caras: es lo que hace que un arreglo valga para las dos.
  for (const compartido of ['js/core/namespaces.js', 'js/core/config.js',
    'js/core/validacion.js', 'js/core/requerimiento.js', 'js/core/estados.js',
    'js/renders/documento.js', 'js/renders/requerimiento.js',
    'js/catalogo/carga.js', 'js/catalogo/renglones.js', 'js/catalogo/buscador.js',
    'js/views/pasos.js', 'js/views/borrador.js', 'js/views/fasttrack.js',
    'js/views/wizard.js', 'js/adapters/repo.js']) {
    assert.ok(delIndex.indexOf(compartido) !== -1,
      'la aplicación con servidor carga ' + compartido);
    assert.ok(delGenerador.indexOf(compartido) !== -1,
      'el generador también carga ' + compartido);
  }

  // Y lo de la aplicación con servidor, el generador no lo carga.
  for (const soloDelServidor of ['js/adapters/repo.http.js', 'js/adapters/repo.sesion.js',
    'js/sesion-viva.js', 'js/app.js']) {
    assert.ok(delIndex.indexOf(soloDelServidor) !== -1,
      'la aplicación con servidor carga ' + soloDelServidor);
    assert.strictEqual(delGenerador.indexOf(soloDelServidor), -1,
      'el generador NO carga ' + soloDelServidor);
  }

  // El repositorio del generador es el de memoria, y el arranque es el suyo.
  assert.ok(delGenerador.indexOf('js/adapters/repo.memoria.js') !== -1,
    'el generador carga repo.memoria.js');
  assert.ok(delGenerador.indexOf('js/generador.js') !== -1,
    'el generador arranca con su propio archivo');
  assert.strictEqual(delIndex.indexOf('js/generador.js'), -1,
    'la aplicación con servidor no carga el arranque del generador');
  assert.strictEqual(delGenerador.indexOf('js/generador.js'), delGenerador.length - 1,
    'js/generador.js es el último script: todo lo que usa ya está cargado');
});