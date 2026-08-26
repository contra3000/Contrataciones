'use strict';

/*
 * renders.test.js
 * ORDEN-RONDA-07 §3.5 puntos 7 y 8 y la superficie de inyección del auditor
 * (§3.1):
 *
 *  - El documento compuesto contiene todos los renglones y las aclaraciones
 *    aparecen (probado con uno solo, con veinte y con una aclaración impresa
 *    hasta el límite de 256 caracteres, ORDEN-RONDA-10 §2.1).
 *  - montar() produce la misma información como nodos DOM, sin asignar
 *    innerHTML (la app no inyecta HTML).
 *  - Títulos y aclaraciones con <script>/<img onerror> llegan escapados al
 *    archivo (componer) y como texto puro en la página (montar).
 *  - Expediente sin renglones o sin fundamentación: el documento no rompe.
 *  - El resumen.md contiene la declaración de ADR-016 y las entradas de
 *    auditoría en orden, con quién, cuándo y desde qué equipo.
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
require(path.join(RAIZ, 'app', 'js', 'renders', 'resumen.js'));

const SGC = globalThis.SGC;

const CONTEXTO = {
  timestamp: '2026-08-14T10:00:00.000Z',
  email: 'maria.gonzalez@faa.mil.ar',
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

before(() => {
  globalThis.document = documento;
});

function expedienteConRenglones(cantidad, conAclaracionLarga) {
  const renglones = [];
  for (let i = 1; i <= cantidad; i++) {
    const r = {
      codigo: '2.1.1-439.' + (100 + i),
      cantidad: i,
      unidad: 'UN',
      rubro: '4210'
    };
    if (conAclaracionLarga && i === cantidad) {
      r.aclaracion = 'x'.repeat(256);
    } else if (i % 3 === 0) {
      r.aclaracion = 'Aclaración del renglón ' + i;
    } else {
      r.aclaracion = '';
    }
    renglones.push(r);
  }
  const base = {
    titulo: 'Adquisición de insumos',
    anio: '2026',
    identificacion: {
      numero: '8',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos',
      lugar: 'FAA - Unidad de destino',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14',
    fechaLimite: '2026-09-30',
    prioridad: 'Alta',
    rubro: '4210',
    tipo: 'Bien común',
    renglones
  };
  const exp = SGC.adapters.repo.construirExpediente(base, CONTEXTO, '2026-008');
  exp.auditoria.push(SGC.core.auditoria.crearEntrada(exp.auditoria, {
    timestamp: '2026-08-15T09:00:00.000Z',
    email: 'juan.perez@faa.mil.ar',
    rol: 'abastecimiento',
    equipo: 'PC-ABA-01',
    accion: 'avanzar',
    de: 'ESPECIFICACIONES_TECNICAS',
    a: 'SOLICITUD_CONTRATACION'
  }));
  return exp;
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

test('§3.5.7 documento con veinte renglones: todos aparecen y las aclaraciones se imprimen', () => {
  const expediente = expedienteConRenglones(20, true);
  const html = SGC.renders.especificacionTecnica.componer(expediente);
  for (let i = 1; i <= 20; i++) {
    assert.ok(html.includes('2.1.1-439.' + (100 + i)), 'falta el código del renglón ' + i);
    assert.ok(html.includes('>' + i + '<'), 'falta la cantidad del renglón ' + i);
  }
  assert.ok(html.includes('Aclaración del renglón 3'), 'falta la aclaración del renglón 3');
  assert.ok(html.includes('x'.repeat(256)), 'falta la aclaración impresa hasta el límite (256)');
  assert.ok(html.includes('Aclaración'), 'el encabezado de la columna Aclaración está');
});

test('montar produce la misma información como nodos DOM sin asignar innerHTML', () => {
  const contenedor = nodo('div', 'sgc-documento-contenedor');
  const expediente = expedienteConRenglones(20, true);
  SGC.renders.especificacionTecnica.montar(contenedor, expediente);
  const texto = textoDelContenedor(contenedor);
  for (let i = 1; i <= 20; i++) {
    assert.ok(texto.includes('2.1.1-439.' + (100 + i)), 'falta el código del renglón ' + i);
  }
  assert.ok(texto.includes('Aclaración del renglón 6'), 'falta la aclaración en la página');
  assert.ok(texto.includes('Especificación Técnica'));
  assert.ok(texto.includes('División Usuario'), 'el encabezado lleva la unidad solicitante');
  assert.equal(obtenerConteoInnerHTML(), 0, 'la app no inyecta HTML');
});

test('un renglón solo y un expediente sin renglones: el documento no rompe', () => {
  const uno = expedienteConRenglones(1, false);
  assert.ok(SGC.renders.especificacionTecnica.componer(uno).includes('2.1.1-439.101'));

  const base = {
    titulo: 'Sin renglones',
    anio: '2026',
    identificacion: { numero: '9', anio: '2026', dependenciaSolicitante: 'División Usuario' },
    fechaCreacion: '2026-08-14'
  };
  const vacio = SGC.adapters.repo.construirExpediente(base, CONTEXTO, '2026-009');
  const html = SGC.renders.especificacionTecnica.componer(vacio);
  assert.ok(html.includes('<h2>Renglones</h2>'));
  assert.ok(html.includes('—'), 'la justificación ausente aparece como "—"');
});

test('inyección: título y aclaración con <script> e <img onerror> salen escapados', () => {
  const base = {
    titulo: '<script>alert(1)</script>',
    anio: '2026',
    identificacion: {
      numero: '10',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Prueba de inyección',
      lugar: 'FAA',
      vigencia: '2026-12-31'
    },
    fechaCreacion: '2026-08-14',
    renglones: [
      { codigo: '2.1.1-439.110', cantidad: 1, unidad: 'UN',
        aclaracion: '<img src=x onerror="window.pwned()">' }
    ]
  };
  const expediente = SGC.adapters.repo.construirExpediente(base, CONTEXTO, '2026-010');

  const html = SGC.renders.especificacionTecnica.componer(expediente);
  assert.ok(!html.includes('<script>'), 'el <script> no puede llegar literal al archivo');
  assert.ok(!html.includes('<img'), 'el <img> no puede llegar literal al archivo');
  assert.ok(html.includes('&lt;script&gt;'), 'el título se escapa');
  assert.ok(html.includes('&lt;img src=x onerror=&quot;window.pwned()&quot;&gt;'),
    'la aclaración se escapa con los atributos');

  const contenedor = nodo('div', 'sgc-documento-inyeccion');
  SGC.renders.especificacionTecnica.montar(contenedor, expediente);
  const texto = textoDelContenedor(contenedor);
  assert.ok(texto.includes('<script>alert(1)</script>'), 'en la página es texto puro, no HTML');
  assert.equal(obtenerConteoInnerHTML(), 0);
});

test('§3.5.8 el resumen.md contiene la declaración de ADR-016 y los hitos en orden', () => {
  const expediente = expedienteConRenglones(2, false);
  const resumen = SGC.renders.resumen.componer(expediente);

  assert.ok(resumen.includes('ADR-016'), 'el resumen declara ADR-016');
  assert.ok(resumen.includes('se firman fuera de este sistema'), 'la declaración es explícita');
  assert.ok(resumen.includes('la ausencia de firmas dentro del expediente digital no es una omisión'),
    'un modelo no debe concluir que el expediente está incompleto');

  const creacion = resumen.indexOf('creó el expediente');
  const avance = resumen.indexOf('avanzó el expediente');
  assert.ok(creacion !== -1 && avance !== -1, 'aparecen la creación y el avance');
  assert.ok(creacion < avance, 'las entradas van en orden cronológico');

  assert.ok(resumen.includes('maria.gonzalez@faa.mil.ar'), 'quién');
  assert.ok(resumen.includes('rol generador'), 'con qué rol');
  assert.ok(resumen.includes('PC-PRUEBA-01'), 'desde qué equipo');
  assert.ok(resumen.includes('Especificaciones Técnicas'), 'de qué estado a qué estado');
  assert.ok(resumen.includes('2026-08-15 a las 09:00:00 UTC'), 'cuándo, legible');
});

test('el resumen.md registra las devoluciones con su motivo', () => {
  const expediente = expedienteConRenglones(1, false);
  expediente.auditoria.push(SGC.core.auditoria.crearEntrada(expediente.auditoria, {
    timestamp: '2026-08-16T11:30:00.000Z',
    email: 'juan.perez@faa.mil.ar',
    rol: 'abastecimiento',
    equipo: 'PC-ABA-01',
    accion: 'devolver',
    de: 'SOLICITUD_CONTRATACION',
    a: 'ESPECIFICACIONES_TECNICAS',
    motivo: 'ERRORES_FORMALES',
    observacion: 'Falta foliar la nota.'
  }));
  const resumen = SGC.renders.resumen.componer(expediente);
  assert.ok(resumen.includes('devolvió el expediente por observación'));
  assert.ok(resumen.includes('Motivo: '), 'el motivo del catálogo aparece');
  assert.ok(resumen.includes('Falta foliar la nota.'), 'la observación aparece');
});