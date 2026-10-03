'use strict';

/*
 * ronda-28-c5.test.js
 * ORDEN-RONDA-28 §5: la carpeta que se copia a otra máquina y se abre con doble
 * clic.
 *
 * El paquete NO se construye una vez y se mira: cada test lo arma con la
 * herramienta real, en una carpeta temporal de os.tmpdir(), y mira lo que
 * quedó. Por dos motivos:
 *
 *   - dist/ está en el .gitignore, así que un clon recién hecho (que es donde
 *     corre la auditoría) no lo tiene: un test que mirara dist/ sería rojo sin
 *     motivo.
 *   - un paquete que "ya estaba" no dice nada del paquete que sale hoy. Lo que
 *     importa es lo que arma tools/empaquetar-generador.js ahora.
 *
 * Se arma una sola vez en before() y todas las afirmaciones leen esa carpeta, en
 * vez de copiar 25 MB por cada caso.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const NODE = process.execPath;
const EMPAQUETAR = path.join(RAIZ, 'tools', 'empaquetar-generador.js');
const APP = path.join(RAIZ, 'app');

let dir = null;
let paquete = null;
let informe = null;

function ejecutar(destino, extra) {
  const argumentos = [EMPAQUETAR, '--destino', destino, '--json'].concat(extra || []);
  const res = spawnSync(NODE, argumentos, { encoding: 'utf8', timeout: 180000 });
  assert.strictEqual(res.status, 0, 'empaquetar-generador falló:\n' + res.stdout + res.stderr);
  return JSON.parse(res.stdout.trim().split('\n').pop());
}

function listar(base) {
  const salida = [];
  const recorrer = (dirActual, prefijo) => {
    for (const entrada of fs.readdirSync(dirActual, { withFileTypes: true })) {
      const relativo = prefijo + entrada.name;
      if (entrada.isDirectory()) {
        recorrer(path.join(dirActual, entrada.name), relativo + '/');
      } else {
        salida.push(relativo);
      }
    }
  };
  recorrer(base, '');
  return salida.sort();
}

function declaradosEnElGenerador() {
  const herramienta = require(EMPAQUETAR);
  return herramienta.declaradoEnElGenerador(fs.readFileSync(path.join(APP, 'generador.html'), 'utf8'));
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-paquete-'));
  const destino = path.join(dir, 'SGC-Generador');
  informe = ejecutar(destino);
  paquete = listar(destino);
});

after(() => {
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('el paquete existe y trae generador.html con todo lo que el documento declara', () => {
  const destino = path.join(dir, 'SGC-Generador');
  assert.ok(fs.existsSync(path.join(destino, 'generador.html')), 'falta generador.html');

  // El HTML del paquete es el del repositorio, byte a byte: si el paquete traía
  // una versión editada del punto de entrada, todo lo demás que se afirma acá
  // estaría affirmando sobre otro documento.
  assert.strictEqual(
    fs.readFileSync(path.join(destino, 'generador.html'), 'utf8'),
    fs.readFileSync(path.join(APP, 'generador.html'), 'utf8'),
    'el generador.html del paquete no es el del repositorio'
  );

  const declarados = declaradosEnElGenerador();
  assert.ok(declarados.length > 30, 'generador.html debería declarar más de 30 archivos');
  for (const relativo of declarados) {
    assert.ok(paquete.indexOf(relativo) !== -1, 'el paquete no trae ' + relativo +
      ', que generador.html declara');
    // Y el del paquete es el MISMO archivo, byte a byte: la montura de
    // tests/helpers/generador-montura.js abre el generador.html del repositorio
    // y hace el alta, los valores, la impresión y la exportación contra esos
    // .js. Si el paquete lleva otra versión de alguno, todo lo que esa montura
    // probó deja de ser lo que se está copiando a la otra máquina.
    assert.strictEqual(
      fs.readFileSync(path.join(destino, relativo), 'utf8'),
      fs.readFileSync(path.join(APP, relativo), 'utf8'),
      'el ' + relativo + ' del paquete no es el del repositorio'
    );
  }

  // Lo mínimo que tiene que estar, para que el fallo se vea por su nombre.
  for (const relativo of [
    'css/tokens.css',
    'css/main.css',
    'css/impresion.css',
    'js/core/namespaces.js',
    'js/core/validacion.js',
    'js/catalogo/carga.js',
    'js/views/wizard.js',
    'js/adapters/repo.memoria.js',
    'js/generador/presupuestos.js',
    'js/generador/valores.js',
    'js/generador/documentos.js',
    'js/generador/intercambio.js',
    'js/generador.js',
    'config/aplicacion.js',
    'LEEME.txt'
  ]) {
    assert.ok(paquete.indexOf(relativo) !== -1, 'el paquete no trae ' + relativo);
  }

  const leeme = fs.readFileSync(path.join(destino, 'LEEME.txt'), 'utf8');
  assert.ok(/generador\.html/.test(leeme), 'el LEEME tiene que decir cuál archivo abrir');
  assert.ok(/Chrome/i.test(leeme), 'el LEEME tiene que decir con qué abrirlo');
  assert.ok(/No hace falta instalar nada/i.test(leeme),
    'el LEEME tiene que decir que no hay que instalar nada');
});

test('no contiene server/, tests/, datos/, ni los .json, ni lo que habla con el servidor', () => {
  for (const relativo of paquete) {
    for (const prohibido of ['server/', 'tests/', 'datos/']) {
      assert.ok(relativo.indexOf(prohibido + '') !== 0 && relativo.indexOf('/' + prohibido) === -1,
        'el paquete no puede traer ' + relativo);
    }
    assert.ok(!/\.json$/i.test(relativo), 'el paquete no puede traer ' + relativo +
      ': en file:// no se lee, y su hermano .js ya está');
    assert.ok(!/^js\/(app|sesion-viva)\.js$/.test(relativo),
      'el paquete no puede traer ' + relativo + ': es arranque de la aplicación con servidor');
    assert.ok(!/^js\/adapters\/repo\.(http|sesion)\.js$/.test(relativo),
      'el paquete no puede traer ' + relativo + ': habla por HTTP y acá no hay servidor');
    assert.ok(relativo !== 'index.html', 'el paquete no puede traer index.html: es la otra entrada');
  }

  const carpetas = new Set(paquete.map((r) => r.split('/')[0]));
  assert.deepStrictEqual(Array.from(carpetas).sort(),
    ['LEEME.txt', 'catalogo', 'config', 'css', 'generador.html', 'js'],
    'las carpetas de primer nivel del paquete son las que tiene que tener');
});

test('la herramienta excluye server/, tests/ y datos/, y no por casualidad', () => {
  const herramienta = require(EMPAQUETAR);
  assert.deepStrictEqual(herramienta.EXCLUIDOS.slice().sort(), ['datos', 'server', 'tests']);
  for (const relativo of [
    'server/estados.js',
    'tests/ronda-28-c5.test.js',
    'tests/helpers/dom-stub.js',
    'datos/idx/2026.json',
    'app/server/x.js'
  ]) {
    assert.ok(herramienta.carpetaExcluida(relativo),
      'la herramienta tiene que excluir ' + relativo + ': es lo que la auditoría saca para ver ' +
      'que el filtro está');
    assert.ok(herramienta.motivoExclusion(relativo), 'sin motivo no se puede auditar una exclusión');
  }
  assert.ok(herramienta.extensionExcluida('catalogo/codigos.json'),
    'los .json del catálogo no viajan');
  assert.strictEqual(herramienta.motivoExclusion('js/generador.js'), null,
    'un .js del generador sí viaja');

  // El plan real, sin escribir: nada de lo que se copia cae en una carpeta
  // prohibida, y lo que se deja afuera lo dice por qué.
  const trabajo = herramienta.plan(APP, path.join(dir, 'sin-escribir'));
  const copiados = trabajo.copiar.map((item) => item.relativo);
  for (const relativo of copiados) {
    assert.strictEqual(herramienta.motivoExclusion(relativo), null,
      'el plan Copies ' + relativo + ', que estaba excluido');
  }
  assert.strictEqual(trabajo.fuera.length, 0, 'con el generador.html de hoy no hay que dejar nada afuera');
});

test('el informe dice su tamaño total', () => {
  assert.strictEqual(typeof informe.archivos, 'number');
  assert.ok(informe.archivos > 6900, 'el paquete tiene que traer el catálogo entero');
  assert.strictEqual(informe.archivos, paquete.length,
    'el informe dice ' + informe.archivos + ' archivos y hay ' + paquete.length);

  let bytes = 0;
  for (const relativo of paquete) {
    bytes += fs.statSync(path.join(dir, 'SGC-Generador', relativo)).size;
  }
  assert.strictEqual(informe.bytes, bytes, 'el tamaño informado no es el tamaño de los archivos');
  assert.ok(informe.bytes > 20 * 1024 * 1024, 'el paquete no puede pesar tan poco');
  assert.ok(Math.abs(informe.mb - Math.round((bytes / 1048576) * 100) / 100) < 0.01,
    'el tamaño en MB no cierra con los bytes: ' + informe.mb);
  assert.ok(informe.declarados > 0 && informe.catalogo > 0,
    'el informe tiene que decir cuántos archivos declaró el HTML y cuántos son del catálogo');
});

test('el catálogo del paquete está completo y cada .js es un hermano capaz de entregar sus datos', () => {
  const herramienta = require(EMPAQUETAR);
  const delRepo = herramienta.archivosDelCatalogo(path.join(APP, 'catalogo'));
  const delPaquete = paquete.filter((r) => r.indexOf('catalogo/') === 0);

  assert.strictEqual(delPaquete.length, delRepo.length,
    'el paquete tiene ' + delPaquete.length + ' archivos de catálogo y el repo ' + delRepo.length);
  assert.deepStrictEqual(delPaquete, delRepo, 'no son los mismos archivos de catálogo');
  assert.strictEqual(delPaquete.length,
    listar(path.join(APP, 'catalogo')).filter((r) => /\.json$/i.test(r)).length,
    'tiene que haber tantos .js como .json hay en el catálogo del repo');

  // Cada hermano tiene que llamar a la puerta de entrada del catálogo: es lo
  // que carga.js espera cuando inyecta el <script> sobre file://. Con el
  // ejemplo (manifiesto, que es chico) alcanza: el build los escribe todos con
  // la misma función.
  const manifiesto = fs.readFileSync(path.join(dir, 'SGC-Generador', 'catalogo', 'manifiesto.js'), 'utf8');
  assert.ok(/SGC\.catalogo\.recibir\(/.test(manifiesto),
    'catalogo/manifiesto.js del paquete no llama a SGC.catalogo.recibir');
  const codigos = fs.readFileSync(path.join(dir, 'SGC-Generador', 'catalogo', 'codigos.js'), 'utf8');
  assert.ok(/SGC\.catalogo\.recibir\(/.test(codigos),
    'catalogo/codigos.js del paquete no llama a SGC.catalogo.recibir');
  assert.ok(codigos.length > 1000, 'el índice de códigos llegó vacío');
});

test('dist/ no se versiona', () => {
  const ignorar = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
  assert.ok(/^dist\/$/m.test(ignorar),
    'dist/ tiene que estar en el .gitignore: es una carpeta que se regenera, no fuente');
});

test('la herramienta no borra una carpeta cualquiera: sólo un paquete generado', () => {
  const carpetaIntrusa = path.join(dir, 'carpeta-del-jefe');
  fs.mkdirSync(path.join(carpetaIntrusa, 'trabajo'), { recursive: true });
  fs.writeFileSync(path.join(carpetaIntrusa, 'trabajo', 'requerimiento.json'), '{}');

  const res = spawnSync(NODE, [EMPAQUETAR, '--destino', carpetaIntrusa], { encoding: 'utf8' });
  assert.notStrictEqual(res.status, 0, 'no puede seguir si se llevó una carpeta que no es suya');
  assert.ok(/no parece un paquete/.test(res.stderr), 'tiene que explicar por qué se negó');
  assert.ok(fs.existsSync(path.join(carpetaIntrusa, 'trabajo', 'requerimiento.json')),
    'y no puede haber tocado lo que había adentro');

  // Con --forzar sí la limpia: es una carpeta vacía de trabajo del test.
  const res2 = spawnSync(NODE, [EMPAQUETAR, '--destino', carpetaIntrusa, '--forzar'], {
    encoding: 'utf8',
    timeout: 180000
  });
  assert.strictEqual(res2.status, 0, 'con --forzar tiene que armar el paquete:\n' + res2.stderr);
  assert.ok(fs.existsSync(path.join(carpetaIntrusa, 'generador.html')));
});