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
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'autorizacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'documento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'especificacion-tecnica.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'solicitud-contratacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'vista-previa-pliego.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'disposicion-adjudicacion.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'orden-compra.js'));
require(path.join(RAIZ, 'app', 'js', 'renders', 'anexo-1.js'));

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
  'FIRMA_DISPOSICION',
  'GENERACION_ORDEN_COMPRA'
];

// Estados con entregable registrado pero no obligatorio para avanzar
// (ORDEN-RONDA-11 §3.1: ANEXO 1 en ANALISIS_SCo se guarda sin bloquear).
const ESTADOS_CON_ENTREGABLE_OPCIONAL = [
  'ANALISIS_SCo'
];

// Estado con entregable que no es plantilla HTML (ADR-030: el entregable de
// FIRMAS_PLIEGO_DISPOSICION es YAML, no un documento imprimible).
const ESTADOS_CON_ENTREGABLE_NO_HTML = [
  'FIRMAS_PLIEGO_DISPOSICION'
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
    } else if (ESTADOS_CON_ENTREGABLE_OPCIONAL.indexOf(estado.id) !== -1) {
      assert.ok(entregable, 'falta el entregable opcional de ' + estado.id);
      assert.ok(plantilla, 'falta la plantilla del entregable opcional de ' + estado.id);
      assert.equal(typeof plantilla.componer, 'function', 'componer');
      assert.equal(typeof plantilla.montar, 'function', 'montar');
    } else if (ESTADOS_CON_ENTREGABLE_NO_HTML.indexOf(estado.id) !== -1) {
      assert.ok(entregable, 'falta el entregable no-HTML de ' + estado.id);
      assert.equal(plantilla, null, estado.id + ' no tiene plantilla HTML');
    } else {
      assert.equal(entregable, null, estado.id + ' no produce documento');
      assert.equal(plantilla, null, estado.id + ' no tiene plantilla');
    }
  }
});

test('las cuatro plantillas componen con renglones y aclaraciones y montan DOM sin innerHTML', () => {
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

// ORDEN-RONDA-09 §3.5 (ADR-022): la plantilla del requerimiento descompone el
// código en IPP / Clase / Ítem, imprime el total en letras, la planilla de
// máximos con cantidadMinima opcional, la justificación de OCA con su causal y
// el bloque de imputación vacío o completo.
function expedienteConRequerimiento(extra) {
  const exp = expedienteEn('ESPECIFICACIONES_TECNICAS', [
    {
      codigo: '2.5.8-378.186', cantidad: 2, unidad: 'UN', aclaracion: '',
      valoresReferencia: [
        { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
        { presupuestoId: 'presupuesto-2', base: 'total', valor: 300 }
      ],
      cantidadMaxima: 100
    }
  ]);
  exp.requerimiento = Object.assign({}, extra && extra.requerimiento);
  exp.imputacion = (extra && extra.imputacion) || [];
  return exp;
}

test('el requerimiento descompone el código, imprime el preventivo en letras y la OCA', () => {
  const plantilla = documentoRender.paraEstado('ESPECIFICACIONES_TECNICAS');
  const expediente = expedienteConRequerimiento({
    requerimiento: { justificacionOCA: 'No se puede prefijar la cantidad exacta' }
  });

  const html = plantilla.componer(expediente);
  // Código '2.5.8-378.186' descompuesto en tres columnas (ADR-022 §1).
  assert.ok(html.includes('258'), 'imprime el IPP sin puntos');
  assert.ok(html.includes('378'), 'imprime la clase');
  assert.ok(html.includes('186'), 'imprime el ítem');
  assert.ok(html.includes('2.5.8-378.186'), 'conserva el código completo');
  // Preventivo con bases mixtas: 100 unitario y 300/2=150 total -> 125 promedio
  // -> 125 * 2 = 250. Total general en números y en letras.
  assert.ok(html.includes('Total general: $ 250,00'), 'el preventivo en números');
  assert.ok(html.includes('LA SUMA DE: PESOS DOSCIENTOS CINCUENTA CON 00/100.-'),
    'el total en letras');
  // OCA activada por cantidadMaxima: justificación y causal normativa.
  assert.ok(html.includes('No se puede prefijar la cantidad exacta'),
    'la justificación de OCA se imprime');
  assert.ok(html.includes('Art. 25 inc. c) del Decreto 1023/01'), 'la causal como ayuda');
  assert.ok(html.includes('Cantidad máxima (por Solicitud de Provisión)'),
    'la etiqueta del máximo explica su alcance');
  assert.ok(html.includes('Sin imputación'), 'la imputación vacía se anota');

  const contenedor = nodo('div', 'sgc-plantilla-requerimiento');
  plantilla.montar(contenedor, expediente);
  const texto = textoDelContenedor(contenedor);
  assert.ok(texto.includes('258') && texto.includes('378') && texto.includes('186'),
    'monta las tres columnas');
  assert.ok(texto.includes('LA SUMA DE: PESOS DOSCIENTOS CINCUENTA CON 00/100.-'),
    'monta el total en letras');
});

test('la cantidad mínima se imprime sólo si tiene valor y la imputación completa lo hace', () => {
  const plantilla = documentoRender.paraEstado('ESPECIFICACIONES_TECNICAS');

  const sinMinima = plantilla.componer(expedienteConRequerimiento({}));
  assert.ok(!sinMinima.includes('>37<'), 'cantidadMinima vacía no se imprime');

  const conMinima = plantilla.componer(expedienteConRequerimiento({
    requerimiento: { oca: true },
    imputacion: [{
      Ejerc: '2026', R: '1', S: '2', C: '3', Ft: '4', PG: '5', Sp: '6',
      Py: '7', Ac: '8', Ob: '9', UG: '10', I: '11', Pppal: '12',
      Ppcial: '13', Spa: '14', M: '15'
    }]
  }));
  // El renglón de expedienteConRequerimiento no trae cantidadMinima; se fuerza
  // con oca:true (imputación completa + planilla), pero la mínima sigue vacía.
  assert.ok(!conMinima.includes('>37<'), 'sigue sin imprimirse la mínima ausente');

  const expediente = expedienteConRequerimiento({
    requerimiento: { oca: true },
    imputacion: [{
      Ejerc: '2026', R: '1', S: '2', C: '3', Ft: '4', PG: '5', Sp: '6',
      Py: '7', Ac: '8', Ob: '9', UG: '10', I: '11', Pppal: '12',
      Ppcial: '13', Spa: '14', M: '15'
    }]
  });
  expediente.renglones[0].cantidadMinima = 37;
  const conValor = plantilla.componer(expediente);
  assert.ok(conValor.includes('>37<'), 'cantidadMinima con valor sí se imprime');
  assert.ok(conValor.includes('Ejerc'), 'la tabla de imputación imprime sus encabezados');
  assert.ok(conValor.includes('>2026<'), 'la fila de imputación se imprime');
  assert.ok(!conValor.includes('Sin imputación'), 'con imputación no dice que falta');
});

test('vista-previa-pliego: no tiene estado, no lleva firma ni pie de ADR-023, lleva banner', () => {
  const vp = SGC.renders.vistaPreviaPliego;
  assert.ok(vp, 'vista-previa-pliego está registrado');
  assert.equal(vp.estado, undefined, 'no tiene estado asignado (ADR-030)');
  assert.equal(typeof vp.componer, 'function', 'componer existe');
  assert.equal(typeof vp.montar, 'function', 'montar existe');

  const exp = expedienteEn('FIRMAS_PLIEGO_DISPOSICION', dosRenglones());
  const html = vp.componer(exp);
  assert.ok(html.includes('Vista previa'), 'el banner de vista previa está en HTML');
  assert.ok(html.includes('no es el Pliego'), 'el texto del banner es claro');
  assert.ok(!html.includes('doc-pie-leyenda'), 'no lleva leyenda de ADR-023');
  assert.ok(!html.includes('Firma'), 'no lleva pie de firma');

  globalThis.document = documento;
  const contenedor = nodo('div', 'sgc-vp-test');
  vp.montar(contenedor, exp);
  const texto = textoDelContenedor(contenedor);
  assert.ok(texto.includes('Vista previa'), 'banner visible en DOM');
  assert.ok(!texto.includes('Firma'), 'sin firma en DOM');
});

test('FIRMAS_PLIEGO_DISPOSICION: entregable es yaml-pliego y no tiene plantilla HTML', () => {
  const entregable = config.entregableDelEstado('FIRMAS_PLIEGO_DISPOSICION');
  assert.ok(entregable, 'el estado tiene entregable');
  assert.equal(entregable.id, 'yaml-pliego', 'el entregable es yaml-pliego');
  assert.equal(entregable.archivo, 'datos_pliego.yaml', 'es un archivo YAML');
  const plantilla = documentoRender.paraEstado('FIRMAS_PLIEGO_DISPOSICION');
  assert.equal(plantilla, null, 'no hay plantilla HTML para este estado');
});