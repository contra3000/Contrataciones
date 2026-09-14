'use strict';

/*
 * ronda-20-anexo.test.js
 * ORDEN-RONDA-20 §1.3 (H3). El ANEXO 1 exige sus doce nodos por
 * identificador (ADR-029: lo que falta, falla ruidosamente).
 *
 *  - Sin un nodo exigido, `leer()` lanza en el momento, con el identificador
 *    a la vista; no escribe sobre null en silencio.
 *  - Con todos los nodos alineados, `leer()` devuelve el objeto completo con
 *    los valores de la pantalla (los doce identificadores del formulario).
 *
 * Vive aparte del camino (ronda-20.test.js): acá se cubre la unidad aislada,
 * sin servidor ni montura.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

const { documento, Nodo } = require('./helpers/dom-stub.js');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'views', 'anexo-uno.js'));

const SGC = globalThis.SGC;

// Nodos que el ANEXO 1 exige por `requerir` al montar y por `leer`.
const NODOS_EXIGIDOS = [
  'sgc-anexo1-msj',
  'sgc-anexo1-objeto',
  'sgc-anexo1-justificacion',
  'sgc-anexo1-unidad-resp',
  'sgc-anexo1-usuario-gde',
  'sgc-anexo1-unidad-dir',
  'sgc-anexo1-unidad-tel',
  'sgc-anexo1-unidad-correo',
  'sgc-anexo1-lugar-entrega',
  'sgc-anexo1-lugar-fact',
  'sgc-anexo1-requisitos',
  'sgc-anexo1-empresas',
  'sgc-anexo1-precio-ref',
  'sgc-anexo1-moneda-ext',
  'sgc-anexo1-pac-previsto',
  'sgc-anexo1-pac-orden',
  'sgc-anexo1-pac-trimestre',
  'sgc-anexo1-comision',
  'sgc-anexo1-personal',
  'sgc-anexo1-visita',
  'sgc-anexo1-interadmin',
  'sgc-anexo1-bienes-uso',
  'sgc-anexo1-hw-sw',
  'sgc-anexo1-reparaciones',
  'sgc-anexo1-doc-obligatoria',
  'sgc-anexo1-criterio',
  'sgc-anexo1-guardar'
];

// Sección del ANEXO 1 con todos los nodos; `faltante` omite el exigido que
// debe hacer fallar la vista.
function armarAnexo(faltante) {
  const raiz = new Nodo('section', 'sgc-anexo1-seccion');
  const nodos = {};
  for (const id of NODOS_EXIGIDOS) {
    if (id === faltante) {
      continue;
    }
    const tag = id === 'sgc-anexo1-pac-trimestre' ? 'select' : 'input';
    const nodo = new Nodo(tag, id);
    raiz.appendChild(nodo);
    nodos[id] = nodo;
  }
  return { raiz, nodos };
}

function valoresEjemplo() {
  return {
    'sgc-anexo1-objeto': 'Adquisición de insumos y servicios de oficina',
    'sgc-anexo1-justificacion': 'Cobertura de necesidades operativas del área.',
    'sgc-anexo1-unidad-resp': 'División Compras',
    'sgc-anexo1-usuario-gde': 'GDE-2026-001',
    'sgc-anexo1-unidad-dir': 'Av. Costanera 1234',
    'sgc-anexo1-unidad-tel': '011-4567-8900',
    'sgc-anexo1-unidad-correo': 'compras@organismo.gob.ar',
    'sgc-anexo1-lugar-entrega': 'Depósito Central, Galpón 2',
    'sgc-anexo1-lugar-fact': 'Dirección General de Administración',
    'sgc-anexo1-requisitos': 'Los renglones deben entregarse con su certificado de conformidad.',
    'sgc-anexo1-empresas': 'EMPRESA A SA\nEMPRESA B SA',
    'sgc-anexo1-precio-ref': '$ 12.000,50',
    'sgc-anexo1-moneda-ext': 'USD',
    'sgc-anexo1-pac-orden': 'P-2026-0007',
    'sgc-anexo1-pac-trimestre': '2°',
    'sgc-anexo1-comision': 'Comisión evaluadora de tres miembros.',
    'sgc-anexo1-personal': 'Un técnico del área.',
    'sgc-anexo1-visita': 'Se realizará visita a la planta.',
    'sgc-anexo1-interadmin': 'Sí',
    'sgc-anexo1-bienes-uso': 'Los bienes quedan a resguardo del área usuaria.',
    'sgc-anexo1-hw-sw': 'No aplica.',
    'sgc-anexo1-reparaciones': 'No aplica.',
    'sgc-anexo1-doc-obligatoria': 'Factura A, planilla de entrega.',
    'sgc-anexo1-criterio': 'Menor precio con cumplimiento de especificaciones.'
  };
}

before(() => {
  globalThis.document = documento;
});

test('H3: sin un nodo exigido leer() lanza con el identificador a la vista', () => {
  const faltantes = ['sgc-anexo1-objeto', 'sgc-anexo1-precio-ref', 'sgc-anexo1-criterio'];
  for (const faltante of faltantes) {
    const { raiz } = armarAnexo(faltante);
    SGC.views.anexoUno.montar(raiz);
    assert.throws(
      () => SGC.views.anexoUno.leer(),
      new RegExp('no se encuentra el nodo "#' + faltante + '"'),
      'el error nombra el identificador que falta (' + faltante + ')');
  }
});

test('H3: con todos los nodos, leer() devuelve el objeto completo de la pantalla', () => {
  const { raiz, nodos } = armarAnexo();
  const ejemplo = valoresEjemplo();
  for (const id of Object.keys(ejemplo)) {
    nodos[id].value = ejemplo[id];
  }
  nodos['sgc-anexo1-pac-previsto'].checked = true;

  SGC.views.anexoUno.montar(raiz);
  const valores = SGC.views.anexoUno.leer();

  assert.strictEqual(valores.objeto, ejemplo['sgc-anexo1-objeto']);
  assert.strictEqual(valores.justificacion, ejemplo['sgc-anexo1-justificacion']);
  assert.deepStrictEqual(valores.empresasConsultadas, ['EMPRESA A SA', 'EMPRESA B SA'],
    'las empresas se leen línea por línea (que es como vuelve el render)');
  assert.strictEqual(valores.precioReferencia, ejemplo['sgc-anexo1-precio-ref']);
  assert.strictEqual(valores.monedaExtranjera, ejemplo['sgc-anexo1-moneda-ext']);
  assert.strictEqual(valores.pacPrevisto, true);
  assert.strictEqual(valores.pacNumeroOrden, ejemplo['sgc-anexo1-pac-orden']);
  assert.strictEqual(valores.pacTrimestre, ejemplo['sgc-anexo1-pac-trimestre']);
  assert.strictEqual(valores.unidadResponsable, ejemplo['sgc-anexo1-unidad-resp']);
  assert.strictEqual(valores.usuarioGde, ejemplo['sgc-anexo1-usuario-gde']);
  assert.strictEqual(valores.unidadDireccion, ejemplo['sgc-anexo1-unidad-dir']);
  assert.strictEqual(valores.unidadTelefono, ejemplo['sgc-anexo1-unidad-tel']);
  assert.strictEqual(valores.unidadCorreo, ejemplo['sgc-anexo1-unidad-correo']);
  assert.strictEqual(valores.lugarEntrega, ejemplo['sgc-anexo1-lugar-entrega']);
  assert.strictEqual(valores.lugarFacturacion, ejemplo['sgc-anexo1-lugar-fact']);
  assert.strictEqual(valores.comisionRecepcion, ejemplo['sgc-anexo1-comision']);
  assert.strictEqual(valores.personalTecnico, ejemplo['sgc-anexo1-personal']);
  assert.strictEqual(valores.requisitosMinimos, ejemplo['sgc-anexo1-requisitos']);
  assert.strictEqual(valores.visitaMuestra, ejemplo['sgc-anexo1-visita']);
  assert.strictEqual(valores.interadministrativa, ejemplo['sgc-anexo1-interadmin']);
  assert.strictEqual(valores.bienesUso, ejemplo['sgc-anexo1-bienes-uso']);
  assert.strictEqual(valores.hardwareSoftware, ejemplo['sgc-anexo1-hw-sw']);
  assert.strictEqual(valores.reparacionesInfra, ejemplo['sgc-anexo1-reparaciones']);
  assert.strictEqual(valores.documentacionObligatoria, ejemplo['sgc-anexo1-doc-obligatoria']);
  assert.strictEqual(valores.criterioEvaluacion, ejemplo['sgc-anexo1-criterio']);
});