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
 *  - Un borrador corrupto o de una versión vieja (renglones ausente, null o de
 *    tipo equivocado) no se aplica, da un mensaje legible y sigue ofrecido
 *    (ORDEN-RONDA-06 §2.1).
 *  - Fast-Track con entrada hostil: código inexistente (validado contra el
 *    servidor, ORDEN-RONDA-06 §2.2), aclaración larga y <script> como dato
 *    plano, sin inyección (la app nunca asigna innerHTML).
 *  - Alta completa contra el servidor: datos.json, entrada en idx/, número
 *    único, auditoría con el correo y catalogoVersion registrada.
 *  - Fallo del servidor a mitad de la confirmación: borrador intacto.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, crearStoragePlano, obtenerConteoInnerHTML } = require('./helpers/dom-stub.js');
const {
  armarWizard,
  completarHastaRevision,
  nuevaVuelta,
  esperarCondicion
} = require('./helpers/wizard-montura.js');
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
// §3.5.1 / ORDEN-RONDA-06 §2.1 — Borrador corrupto o de una versión vieja
// ---------------------------------------------------------------------------
test('un borrador con renglones ausente, null o de tipo equivocado no se aplica, da mensaje y sigue ofrecido', () => {
  const formasInvalidas = {
    'sin la clave renglones': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      fundamentacion: { justificacion: 'J', objetivo: '' }
    },
    'renglones nulos': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      renglones: null,
      fundamentacion: { justificacion: 'J', objetivo: '' }
    },
    'renglones cadena': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      renglones: '2.1.1-439.102',
      fundamentacion: { justificacion: 'J', objetivo: '' }
    },
    'renglones número': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      renglones: 3,
      fundamentacion: { justificacion: 'J', objetivo: '' }
    },
    'renglones objeto': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      renglones: { codigo: '2.1.1-439.102' },
      fundamentacion: { justificacion: 'J', objetivo: '' }
    },
    'un elemento que no es objeto': {
      identificacion: { titulo: 'A', anio: '2026', dependenciaSolicitante: 'D', operador: MARIA.email },
      renglones: ['2.1.1-439.102'],
      fundamentacion: { justificacion: 'J', objetivo: '' }
    }
  };

  for (const nombre of Object.keys(formasInvalidas)) {
    const storage = crearStoragePlano();
    globalThis.sessionStorage = storage;
    SGC.views.borrador.guardar(storage, formasInvalidas[nombre], MARIA.email);

    const w = armarWizard();
    SGC.views.wizard.montar(w.raiz);
    SGC.views.wizard.vincularRenglones();
    SGC.views.wizard.seleccionarOperador(MARIA, repoFalso);
    assert.equal(w.nodos['sgc-borrador-aviso'].hidden, false, nombre + ': se ofrece el borrador');

    w.nodos['sgc-btn-retomar'].click();
    assert.equal(w.nodos['sgc-borrador-aviso'].hidden, false,
      nombre + ': el borrador sigue ofrecido, no desaparece');
    assert.match(w.nodos['sgc-borrador-info'].textContent, /no se puede aplicar/,
      nombre + ': el mensaje es legible');
    assert.equal(w.nodos['sgc-titulo'].value, '', nombre + ': no se aplica nada al formulario');
  }
});

// ---------------------------------------------------------------------------
// §3.6.4 — Fast-Track con entrada hostil
// ---------------------------------------------------------------------------
test('Fast-Track rechaza códigos inexistentes y aclaraciones largas; el <script> queda como dato', async () => {
  globalThis.sessionStorage = crearStoragePlano();

  // El Fast-Track valida la existencia de los códigos contra el servidor
  // (ORDEN-RONDA-06 §2.2): el stub de repo responde el veredicto del servidor.
  const repoConServidor = {
    validarCodigos: (codigos) => Promise.resolve({
      invalidos: codigos.filter((c) => c === '99.9-9999.9'),
      catalogoVersion: 'abcdef12'
    })
  };
  const w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(MARIA, repoConServidor);

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
  assert.equal(obtenerConteoInnerHTML(), 0, 'la app nunca asigna innerHTML');
});

test('Fast-Track con el servidor de catálogo caído: no acepta el archivo y lo avisa (ORDEN-RONDA-06 §2.2)', async () => {
  globalThis.sessionStorage = crearStoragePlano();

  const repoSinServidor = {
    validarCodigos: () => Promise.reject(new Error('RED'))
  };
  const w = armarWizard();
  SGC.views.wizard.montar(w.raiz);
  SGC.views.wizard.vincularRenglones();
  SGC.views.wizard.seleccionarOperador(MARIA, repoSinServidor);

  w.nodos['sgc-archivo-modelo'].files = [{
    contenido: JSON.stringify({
      titulo: 'T', anio: '2026', dependenciaSolicitante: 'D', justificacion: 'J', objetivo: '',
      renglones: [{ codigo: CODIGO_REAL, cantidad: 1, unidad: 'UN', aclaracion: '' }]
    })
  }];
  w.nodos['sgc-archivo-modelo'].emit('change');
  await nuevaVuelta();

  assert.equal(w.nodos['sgc-fasttrack-msj'].hidden, false);
  assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /no se importa/,
    'el aviso dice que el archivo no se importa');
  assert.match(w.nodos['sgc-fasttrack-msj'].textContent, /servidor/,
    'el aviso señala al servidor de catálogo');
  assert.equal(w.nodos['sgc-titulo'].value, '', 'no se toca el formulario');
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
    const estadoCat = SGC.catalogo.carga.obtenerEstado();
    const version = estadoCat.manifiesto.catalogoVersion;
    const items = await SGC.catalogo.carga.cargarClase(estadoCat.clases[0][0]);
    const codigo = items[0].codigo;
    assert.equal(SGC.catalogo.indice.codigoExiste(codigo), true,
      'el catálogo real reconoce el código de la clase cargada');

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
  SGC.catalogo.indice.registrarCodigos([{ codigo: CODIGO_REAL }]);

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
