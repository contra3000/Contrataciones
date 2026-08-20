'use strict';

/*
 * plantillas.test.js
 * ORDEN-RONDA-08 §2.1: los cinco estados que producen documento tienen su
 * entregable registrado en config (id estable) y su plantilla en
 * renders/documento.js; cada plantilla compone su documento con renglones y
 * aclaraciones y lo monta como nodos DOM sin innerHTML (ADR-011); la
 * superficie de inyección queda escapada en el archivo y como texto en la
 * página; fijarTituloImpresion no rompe sin document.head.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, obtenerConteoInnerHTML } = require('./helpers/dom-stub.js');
const { nodo } = require('./helpers/wizard-montura.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'solicitud-contratacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'pliego-bases-condiciones.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'disposicion-adjudicacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'orden-compra.js'));

const SGC = globalThis.SGC;
const config = SGC.core.config;
const documentoRender = SGC.renders.documento;

const CONTEXTO = {
  timestamp: '2026-08-19T10:00:00.000Z',
  email: 'maria.gonzalez@faa.mil.ar',
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

before(() => {
  globalThis.document = documento;
});

function expedienteEn(estadoId, renglones, titulo) {
  const base = {
    titulo: titulo || 'Adquisición de insumos',
    anio: '2026',
    identificacion: {
      numero: '8',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-19',
    renglones: renglones || []
  };
  const exp = SGC.adapters.repo.construirExpediente(base, CONTEXTO, '2026-008');
  exp.estado = { id: estadoId, fase: 1, desde: CONTEXTO.timestamp };
  return exp;
}

function dosRenglones() {
  return [
    { codigo: '2.1.1-439.101', cantidad: 2, unidad: 'UN', aclaracion: 'Aclaración del renglón 1' },
    { codigo: '2.1.1-439.102', cantidad: 1, unidad: 'UN', aclaracion: '' }
  ];
}

function textoDelContenedor(contenedor) {
  const nodos = [];
  const recorrer = (n) => {
    if (n.textContent) {
      nodos.push(n.textContent);
    }
    for (const hijo of n.children) {
      recorrer(hijo);
    }
  };
  recorrer(contenedor);
  return nodos.join(' ');
}

const ESTADOS_CON_DOCUMENTO = [
  'ESPECIFICACIONES_TECNICAS',
  'SOLICITUD_CONTRATACION',
  'FIRMAS_PLIEGO_DISPOSICION',
  'FIRMA_DISPOSICION',
  'GENERACION_ORDEN_COMPRA'
];

test('cada estado que produce documento tiene entregable registrado y plantilla; el resto no', () => {
  for (const estado of config.ESTADOS) {
    const entregable = config.entregableDelEstado(estado.id);
    const plantilla = documentoRender.paraEstado(estado.id);
    if (ESTADOS_CON_DOCUMENTO.indexOf(estado.id) !== -1) {
      assert.ok(entregable, 'falta el entregable de ' + estado.id);
      assert.equal(entregable.id, estado.entregablesObligatorios[0],
        'el entregable de ' + estado.id + ' es el obligatorio del estado');
      assert.ok(plantilla, 'falta la plantilla de ' + estado.id);
      assert.equal(plantilla.id, entregable.id,
        'el id de la plantilla coincide con el del entregable');
      assert.equal(typeof plantilla.componer, 'function', 'componer');
      assert.equal(typeof plantilla.montar, 'function', 'montar');
    } else {
      assert.equal(entregable, null, estado.id + ' no produce documento');
      assert.equal(plantilla, null, estado.id + ' no tiene plantilla');
    }
  }
});

test('las cinco plantillas componen con renglones y aclaraciones y montan DOM sin innerHTML', () => {
  for (const estadoId of ESTADOS_CON_DOCUMENTO) {
    const plantilla = documentoRender.paraEstado(estadoId);
    const expediente = expedienteEn(estadoId, dosRenglones());

    const html = plantilla.componer(expediente);
    assert.ok(html.includes('<h1>' + plantilla.titulo + '</h1>'), 'el título de ' + estadoId);
    assert.ok(html.includes('2.1.1-439.101'), 'el código del renglón en ' + estadoId);
    assert.ok(html.includes('Aclaración del renglón 1'), 'la aclaración en ' + estadoId);
    assert.ok(html.includes('Aclaración'), 'el encabezado de la columna en ' + estadoId);

    const contenedor = nodo('div', 'sgc-plantilla-' + plantilla.id);
    plantilla.montar(contenedor, expediente);
    const texto = textoDelContenedor(contenedor);
    assert.ok(texto.includes(plantilla.titulo), 'monta el título de ' + estadoId);
    assert.ok(texto.includes('2.1.1-439.101'), 'monta el renglón de ' + estadoId);
    assert.ok(texto.includes('Aclaración del renglón 1'), 'monta la aclaración de ' + estadoId);
  }
  assert.equal(obtenerConteoInnerHTML(), 0, 'la app no inyecta HTML');
});

test('la superficie de inyección queda escapada en las cuatro plantillas nuevas', () => {
  const renglones = [
    { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN',
      aclaracion: '<img src=x onerror="window.pwned()">' }
  ];
  const nuevas = [
    'SOLICITUD_CONTRATACION',
    'FIRMAS_PLIEGO_DISPOSICION',
    'FIRMA_DISPOSICION',
    'GENERACION_ORDEN_COMPRA'
  ];
  for (const estadoId of nuevas) {
    const plantilla = documentoRender.paraEstado(estadoId);
    const expediente = expedienteEn(estadoId, renglones,
      '<script>alert(1)</script>');

    const html = plantilla.componer(expediente);
    assert.ok(!html.includes('<script>'), estadoId + ': el <script> no llega literal al archivo');
    assert.ok(!html.includes('<img'), estadoId + ': el <img> no llega literal al archivo');
    assert.ok(html.includes('&lt;script&gt;'), estadoId + ': el título se escapa');
    assert.ok(html.includes('&lt;img src=x onerror=&quot;window.pwned()&quot;&gt;'),
      estadoId + ': la aclaración se escapa con los atributos');

    const contenedor = nodo('div', 'sgc-plantilla-inyeccion-' + plantilla.id);
    plantilla.montar(contenedor, expediente);
    const texto = textoDelContenedor(contenedor);
    assert.ok(texto.includes('<script>alert(1)</script>'),
      estadoId + ': en la página es texto puro, no HTML');
  }
  assert.equal(obtenerConteoInnerHTML(), 0);
});

test('fijarTituloImpresion no rompe cuando el DOM no expone document.head', () => {
  assert.doesNotThrow(() => documentoRender.fijarTituloImpresion('Orden de Compra'));
});

test('un expediente sin renglones no rompe ninguna plantilla', () => {
  for (const estadoId of ESTADOS_CON_DOCUMENTO) {
    const plantilla = documentoRender.paraEstado(estadoId);
    const html = plantilla.componer(expedienteEn(estadoId, []));
    assert.ok(html.includes('</html>'), estadoId + ' compone completo');
  }
});