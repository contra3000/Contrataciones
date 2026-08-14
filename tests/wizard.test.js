'use strict';

/*
 * wizard.test.js
 * ORDEN-RONDA-05 §3.6. Cubre, contra una montura DOM mínima (helpers/dom-stub.js)
 * y contra el servidor real:
 *
 *  - El punto 1 (tramos de coincidencia sobre el catálogo real) vive en
 *    catalogo.test.js, que valida contra resultado.clase.
 *  - No se avanza de paso con el paso inválido y el motivo queda a la vista.
 *  - El borrador sobrevive a la recarga y no se ofrece a un operador distinto.
 *  - Fast-Track con entrada hostil: código inexistente, aclaración larga y
 *    <script> como dato plano, sin inyección (la app nunca asigna innerHTML).
 *  - Alta completa contra el servidor: datos.json, entrada en idx/, número
 *    único, auditoría con el correo y catalogoVersion registrada.
 *  - Fallo del servidor a mitad de la confirmación: borrador intacto.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { Nodo, documento, registrar, crearStoragePlano, obtenerConteoInnerHTML } =
  require('./helpers/dom-stub.js');
const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor
} = require('./helpers/servidor-util.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'catalogo', 'indice.js'));
require(path.join(RAIZ, 'app', 'js', 'catalogo', 'carga.js'));
require(path.join(RAIZ, 'app', 'js', 'catalogo', 'renglones.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'pasos.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'borrador.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'fasttrack.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'wizard.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const SGC = globalThis.SGC;

const MARIA = {
  nombre: 'María', apellido: 'González',
  email: 'maria.gonzalez@faa.mil.ar',
  roles: ['generador'], sector: 'usuario'
};
const JUAN = {
  nombre: 'Juan', apellido: 'Pérez',
  email: 'juan.perez@faa.mil.ar',
  roles: ['abastecimiento'], sector: 'abastecimiento'
};
const CODIGO_REAL = '2.1.1-439.102';

const repoFalso = {
  crearExpediente: () => Promise.reject(new Error('repositorio de prueba sin servidor'))
};

const nuevaVuelta = () => new Promise((resolver) => setImmediate(resolver));

function esperarCondicion(condicion, etiqueta, timeoutMs) {
  return new Promise((resolver, rechazar) => {
    const inicio = Date.now();
    const temporizador = setInterval(() => {
      if (condicion()) {
        clearInterval(temporizador);
        resolver();
      } else if (Date.now() - inicio > (timeoutMs || 5000)) {
        clearInterval(temporizador);
        rechazar(new Error('el tiempo se agotó esperando: ' + etiqueta));
      }
    }, 20);
  });
}

// ---------------------------------------------------------------------------
// Montura del DOM mínimo
// ---------------------------------------------------------------------------
function nodo(tag, id) {
  return registrar(new Nodo(tag, id));
}

function armarWizard() {
  const app = nodo('main', 'app');

  const seleccion = nodo('section', 'sgc-seleccion-operador');
  seleccion.appendChild(nodo('ul', 'sgc-lista-operadores'));
  app.appendChild(seleccion);

  const wiz = nodo('section', 'sgc-app');
  wiz.appendChild(nodo('span', 'sgc-operador-actual'));

  const aviso = nodo('div', 'sgc-borrador-aviso');
  aviso.hidden = true;
  aviso.appendChild(nodo('p', 'sgc-borrador-info'));
  aviso.appendChild(nodo('button', 'sgc-btn-retomar'));
  aviso.appendChild(nodo('button', 'sgc-btn-descartar'));
  wiz.appendChild(aviso);

  const pasosNav = nodo('ol', 'sgc-pasos');
  for (const idPaso of ['identificacion', 'renglones', 'fundamentacion', 'revision']) {
    const li = nodo('li');
    li.setAttribute('data-paso', idPaso);
    pasosNav.appendChild(li);
  }
  wiz.appendChild(pasosNav);
  wiz.appendChild(nodo('p', 'sgc-paso-msj'));

  const paso1 = nodo('section', 'sgc-paso-identificacion');
  paso1.appendChild(nodo('button', 'sgc-btn-modelo'));
  paso1.appendChild(nodo('input', 'sgc-archivo-modelo'));
  paso1.appendChild(nodo('p', 'sgc-fasttrack-msj'));
  paso1.appendChild(nodo('input', 'sgc-titulo'));
  paso1.appendChild(nodo('p', 'sgc-error-titulo'));
  paso1.appendChild(nodo('input', 'sgc-anio'));
  paso1.appendChild(nodo('p', 'sgc-error-anio'));
  paso1.appendChild(nodo('input', 'sgc-dependencia'));
  paso1.appendChild(nodo('p', 'sgc-error-dependencia'));
  wiz.appendChild(paso1);

  const paso2 = nodo('section', 'sgc-paso-renglones');
  paso2.appendChild(nodo('ul', 'sgc-lista-renglones'));
  paso2.appendChild(nodo('p', 'sgc-resumen'));
  wiz.appendChild(paso2);

  const paso3 = nodo('section', 'sgc-paso-fundamentacion');
  paso3.appendChild(nodo('textarea', 'sgc-justificacion'));
  paso3.appendChild(nodo('p', 'sgc-error-justificacion'));
  paso3.appendChild(nodo('textarea', 'sgc-objetivo'));
  wiz.appendChild(paso3);

  const paso4 = nodo('section', 'sgc-paso-revision');
  paso4.appendChild(nodo('dl', 'sgc-revision-filas'));
  paso4.appendChild(nodo('button', 'sgc-persistir'));
  paso4.appendChild(nodo('p', 'sgc-persistir-msj'));
  const exito = nodo('p', 'sgc-exito');
  exito.appendChild(nodo('strong', 'sgc-exito-id'));
  paso4.appendChild(exito);
  wiz.appendChild(paso4);

  wiz.appendChild(nodo('button', 'sgc-anterior'));
  wiz.appendChild(nodo('button', 'sgc-siguiente'));
  app.appendChild(wiz);

  return { raiz: app, nodos: documento.porId };
}

function completarHastaRevision(w, codigo) {
  w.nodos['sgc-titulo'].value = 'Resmas A4';
  w.nodos['sgc-anio'].value = '2026';
  w.nodos['sgc-dependencia'].value = 'División Usuario';
  w.nodos['sgc-siguiente'].click();
  SGC.catalogo.renglones.cargar([
    { codigo, item: codigo, cantidad: 2, unidad: 'UN', aclaracion: '' }
  ]);
  w.nodos['sgc-siguiente'].click();
  w.nodos['sgc-justificacion'].value = 'Se necesita reponer insumos en uso corriente.';
  w.nodos['sgc-siguiente'].click();
}

// ---------------------------------------------------------------------------
// Infraestructura de prueba en Node (sin navegador)
// ---------------------------------------------------------------------------
before(() => {
  globalThis.document = documento;
  globalThis.sessionStorage = crearStoragePlano();
  globalThis.FileReader = function () {};
  globalThis.FileReader.prototype.readAsText = function (archivo) {
    this.result = archivo.contenido;
    if (typeof this.onload === 'function') {
      this.onload();
    }
  };
  globalThis.Blob = function (partes) {
    this.partes = partes;
  };
  globalThis.URL.createObjectURL = () => 'blob:test';
  globalThis.URL.revokeObjectURL = () => {};
});

// ---------------------------------------------------------------------------
// §3.6.2 — No avanza con el paso inválido
// ---------------------------------------------------------------------------
test('no se puede avanzar de paso con el paso inválido y el motivo queda a la vista', () => {
  const w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.fijarRepo(repoFalso);
  SGC.views.wizard.seleccionarOperador(MARIA, repoFalso);

  w.nodos['sgc-titulo'].value = 'Un título';
  w.nodos['sgc-anio'].value = '20';
  w.nodos['sgc-dependencia'].value = '';
  w.nodos['sgc-siguiente'].click();

  assert.equal(w.nodos['sgc-paso-identificacion'].hidden, false, 'sigue en el paso 1');
  assert.equal(w.nodos['sgc-paso-renglones'].hidden, true, 'no avanza al paso 2');
  assert.equal(w.nodos['sgc-error-anio'].hidden, false, 'el error del año está a la vista');
  assert.match(w.nodos['sgc-error-anio'].textContent, /cuatro dígitos/);
  assert.equal(w.nodos['sgc-error-dependencia'].hidden, false, 'el error de dependencia está a la vista');
  assert.match(w.nodos['sgc-error-dependencia'].textContent, /dependencia solicitante/);
});

// ---------------------------------------------------------------------------
// §3.6.3 — Borrador: recarga y operador distinto
// ---------------------------------------------------------------------------
test('el borrador sobrevive a la recarga y no se ofrece a un operador distinto', () => {
  const storage = crearStoragePlano();
  globalThis.sessionStorage = storage;
  SGC.views.borrador.guardar(storage, {
    identificacion: {
      titulo: 'Resmas A4', anio: '2026',
      dependenciaSolicitante: 'División Usuario', operador: MARIA.email
    },
    renglones: [],
    fundamentacion: { justificacion: 'Se necesita papel', objetivo: '' }
  }, MARIA.email);

  let w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(MARIA, repoFalso);
  assert.equal(w.nodos['sgc-borrador-aviso'].hidden, false, 'se ofrece al dueño');
  assert.match(w.nodos['sgc-borrador-info'].textContent, /maria\.gonzalez@faa\.mil\.ar/);

  w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(JUAN, repoFalso);
  assert.equal(w.nodos['sgc-borrador-aviso'].hidden, true, 'el borrador ajeno no se ofrece');

  w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(MARIA, repoFalso);
  assert.equal(w.nodos['sgc-borrador-aviso'].hidden, false);
  w.nodos['sgc-btn-retomar'].click();
  assert.equal(w.nodos['sgc-borrador-aviso'].hidden, true, 'retomar cierra el aviso');
  assert.equal(w.nodos['sgc-titulo'].value, 'Resmas A4');
  assert.equal(w.nodos['sgc-anio'].value, '2026');
});

// ---------------------------------------------------------------------------
// §3.6.4 — Fast-Track con entrada hostil
// ---------------------------------------------------------------------------
test('Fast-Track rechaza códigos inexistentes y aclaraciones largas; el <script> queda como dato', async () => {
  globalThis.sessionStorage = crearStoragePlano();
  SGC.catalogo.indice.cargarCodigos([CODIGO_REAL]);
  const cargarOriginal = SGC.catalogo.carga.cargarCodigos;
  SGC.catalogo.carga.cargarCodigos = () => Promise.resolve(true);

  try {
    const w = armarWizard();
    SGC.views.wizard.montar(w.raiz);
    SGC.views.wizard.vincularRenglones();
    SGC.views.wizard.seleccionarOperador(MARIA, repoFalso);

    function archivoCon(objeto) {
      w.nodos['sgc-archivo-modelo'].files = [{ contenido: JSON.stringify(objeto) }];
      w.nodos['sgc-archivo-modelo'].emit('change');
    }

    const validoBase = {
      anio: '2026', dependenciaSolicitante: 'D', justificacion: 'J', objetivo: '',
      renglones: [{ codigo: CODIGO_REAL, cantidad: 1, unidad: 'UN', aclaracion: '' }]
    };

    archivoCon(Object.assign({}, validoBase, { titulo: 'T', renglones: [{ codigo: '99.9-9999.9', cantidad: 1, unidad: 'UN', aclaracion: '' }] }));
    await nuevaVuelta();
    assert.equal(w.nodos['sgc-fasttrack-msj'].hidden, false);
    assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /99\.9-9999\.9/);
    assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /no existen en el catálogo/);
    assert.equal(w.nodos['sgc-titulo'].value, '', 'no se toca el formulario');

    archivoCon(Object.assign({}, validoBase, { titulo: 'T', renglones: [{ codigo: CODIGO_REAL, cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(201) }] }));
    await nuevaVuelta();
    assert.equal(w.nodos['sgc-fasttrack-msj'].hidden, false);
    assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /200 caracteres/);

    archivoCon(Object.assign({}, validoBase, { titulo: '<script>alert(1)</script>' }));
    await nuevaVuelta();
    assert.equal(w.nodos['sgc-fasttrack-msj'].hidden, false);
    assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /importado correctamente/);
    assert.equal(w.nodos['sgc-titulo'].value, '<script>alert(1)</script>',
      'el contenido llega como valor de campo, no como HTML');
  } finally {
    SGC.catalogo.carga.cargarCodigos = cargarOriginal;
  }
  assert.equal(obtenerConteoInnerHTML(), 0, 'la app nunca asigna innerHTML');
});

// ---------------------------------------------------------------------------
// §3.6.5 — Alta completa contra el servidor real
// ---------------------------------------------------------------------------
test('alta completa: datos.json, entrada en idx/, número único, auditoría con el correo', { timeout: 60000 }, async () => {
  const datosDir = crearDirDatos('sgc-wizard-');
  const ctx = await arrancarServidor(datosDir);
  const fetchOriginal = globalThis.fetch;
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    globalThis.fetch = (url, opciones) => fetchOriginal(
      url.startsWith('http') ? url : base + '/' + url, opciones);

    await SGC.catalogo.carga.iniciar();
    await SGC.catalogo.carga.cargarCodigos();
    const version = SGC.catalogo.carga.obtenerEstado().manifiesto.catalogoVersion;
    const codigos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'app', 'catalogo', 'codigos.json'), 'utf8'));
    const codigo = codigos[0];
    assert.equal(SGC.catalogo.indice.codigoExiste(codigo), true,
      'el índice de códigos del catálogo real reconoce el código');

    globalThis.sessionStorage = crearStoragePlano();
    const repo = SGC.adapters.repoHttp.crear(base);
    const w = armarWizard();
    SGC.views.wizard.montar(w.raiz);
    SGC.views.wizard.vincularRenglones();
    SGC.views.wizard.seleccionarOperador(MARIA, repo);

    completarHastaRevision(w, codigo);
    assert.equal(w.nodos['sgc-paso-revision'].hidden, false);
    w.nodos['sgc-persistir'].click();
    await esperarCondicion(
      () => !w.nodos['sgc-exito'].hidden || !w.nodos['sgc-persistir-msj'].hidden,
      'la respuesta del alta');

    assert.equal(w.nodos['sgc-exito'].hidden, false,
      'el alta se anuncia como éxito: ' + w.nodos['sgc-persistir-msj'].textContent);
    const id = w.nodos['sgc-exito-id'].textContent.replace('Expediente ', '').trim();
    assert.match(id, /^2026-\d{3}$/);

    const carpeta = path.join(datosDir, '2026', id.split('-')[1] + '_Expediente');
    const doc = JSON.parse(fs.readFileSync(path.join(carpeta, 'datos.json'), 'utf8'));
    assert.equal(doc.titulo, 'Resmas A4');
    assert.equal(doc.catalogoVersion, version, 'la versión del catálogo queda registrada (ADR-014)');
    assert.equal(doc.estado.id, 'ESPECIFICACIONES_TECNICAS');
    assert.equal(doc.schemaVersion, SGC.core.migraciones.VERSION_ACTUAL);
    assert.ok(fs.existsSync(path.join(datosDir, 'idx', id + '.json')), 'existe la entrada en idx/');
    assert.equal(doc.auditoria.length >= 1, true);
    assert.equal(doc.auditoria[0].accion, 'crearExpediente');
    assert.equal(doc.auditoria[0].email, MARIA.email, 'la auditoría registra el correo del operador');
    assert.equal(globalThis.sessionStorage.claves().length, 0, 'el borrador se limpió tras el alta');
  } finally {
    globalThis.fetch = fetchOriginal;
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §3.6.6 — Fallo del servidor a mitad de la confirmación
// ---------------------------------------------------------------------------
test('si el servidor falla al confirmar, el borrador sigue ahí y el mensaje es legible', async () => {
  globalThis.sessionStorage = crearStoragePlano();
  SGC.catalogo.indice.cargarCodigos([CODIGO_REAL]);

  const repoFalla = {
    crearExpediente: () => Promise.reject(new Error('la carpeta de datos no está accesible'))
  };
  const w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(MARIA, repoFalla);

  completarHastaRevision(w, CODIGO_REAL);
  assert.equal(w.nodos['sgc-paso-revision'].hidden, false);
  w.nodos['sgc-persistir'].click();
  await esperarCondicion(
    () => !w.nodos['sgc-exito'].hidden || !w.nodos['sgc-persistir-msj'].hidden,
    'la respuesta del alta');

  assert.equal(w.nodos['sgc-exito'].hidden, true, 'no anuncia éxito');
  assert.equal(w.nodos['sgc-persistir-msj'].hidden, false, 'muestra el error legible');
  assert.match(w.nodos['sgc-persistir-msj'].textContent, /borrador se conservó/);
  assert.notEqual(globalThis.sessionStorage.getItem(SGC.views.borrador.CLAVE), null,
    'el borrador no se pierde');
});
