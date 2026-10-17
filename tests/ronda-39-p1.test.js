'use strict';

/*
 * ronda-39-p1.test.js
 * RONDA-39 · pieza 1 · "Las cantidades de la OCA y la cita del Decreto"
 * (ORDEN-RONDA-39 pieza 1).
 *
 * Con la modalidad "Orden de compra abierta", la cantidad del renglón es el
 * máximo del contrato (Decreto 1030/2016, art. 112): la cantidad máxima por
 * Solicitud de Provisión no puede superarla, y la mínima no puede superar la
 * máxima. La cita de la causal pasa a "Decreto 1030/2016, arts. 25 inc. c) y
 * 111", en el requerimiento y en la guía de Fundamentación.
 *
 * Por la pantalla del generador (ADR-044):
 *
 *  1. OCA con cantidad 10 y máxima 12: no imprime ni exporta, el motivo nombra
 *     el renglón y los dos números, y "2 · Renglones" dice "falta".
 *  2. Máxima 10: exporta.
 *  3. Máxima 5 y mínima 8: no exporta y el motivo habla de la mínima.
 *  4. El requerimiento con OCA cita "Decreto 1030/2016, arts. 25 inc. c) y 111",
 *     y la guía de Fundamentación también.
 *
 * La aplicación con servidor no se toca (ADR-044): sólo cambia la línea de la
 * causal de la OCA, que prueba tests/plantillas.test.js.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const CODIGO_PAPELERIA = '2.3.1-6563.129';
const ITEM_PAPELERIA = 'Resma papel A4';
const justificacion = 'Se necesita reponer insumos de papelería.';
const JUSTIFICACION_OCA =
  'No se puede prefijar la cantidad: se descuenta contra un remito por partida.';
const LUGAR = 'Depósito de Intendencia, VII Brigada Aérea';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

function pasoVisible() {
  const d = m.documento;
  return ['identificacion', 'renglones', 'fundamentacion', 'revision']
    .find((p) => !d.getElementById('sgc-paso-' + p).hidden);
}

async function entrarComoUsuario() {
  await m.correr();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
  m.limpiarDescargas();
}

// El requerimiento con cantidad 10 y sus dos valores de referencia. 10 × $ 100
// = $ 1.000, dentro del monto del proceso 1 ($ 63.617.500). Llega con
// modalidad "comun"; la OCA se elige en la pantalla.
function archivo() {
  const expediente = {
    titulo: 'Resmas A4',
    anio: '2026',
    trimestre: '1',
    lugarEntrega: LUGAR,
    pac: { numero: '1', justificacion: '' },
    modalidad: 'comun',
    campos: {
      operador: 'ana.perez@faa.mil.ar',
      dependenciaSolicitante: 'División Usuario',
      justificacion: justificacion,
      objetivo: ''
    },
    renglones: [
      {
        codigo: CODIGO_PAPELERIA,
        item: ITEM_PAPELERIA,
        cantidad: 10,
        unidad: 'UN',
        aclaracion: '',
        valoresReferencia: [
          { presupuestoId: 'p1', base: 'unitario', valor: 100 },
          { presupuestoId: 'p2', base: 'unitario', valor: 100 }
        ]
      }
    ],
    presupuestos: [
      { id: 'p1', nombreOriginal: 'presupuesto-resma-2026.pdf', proveedor: 'Librería Sur',
        fecha: '12/02/2026', tipo: 'presupuesto' },
      { id: 'p2', nombreOriginal: 'presupuesto-resma-2026.pdf', proveedor: 'Papelería Norte',
        fecha: '12/02/2026', tipo: 'presupuesto' }
    ]
  };
  return JSON.stringify({
    sello: { formato: 'sgc-requerimiento/1', estado: 'para-abastecimiento' },
    expediente: expediente
  });
}

async function importar() {
  m.elegirArchivo(archivo(), 'requerimiento.json');
  await m.esperar(() => m.msjArchivo().hidden === false, 20000,
    'el generador no contestó al archivo');
  const texto = m.msjArchivo().textContent;
  assert.match(texto, /Requerimiento importado/, 'el archivo entra: ' + texto);
  return texto;
}

async function ir(id) {
  const d = m.documento;
  const orden = ['identificacion', 'renglones', 'fundamentacion', 'revision'];
  for (let k = 0; k < 8; k++) {
    const actual = pasoVisible();
    if (actual === id) {
      return;
    }
    const destino = orden.indexOf(id) > orden.indexOf(actual) ? 'sgc-siguiente' : 'sgc-anterior';
    const esperado = destino === 'sgc-siguiente'
      ? orden[orden.indexOf(actual) + 1]
      : orden[orden.indexOf(actual) - 1];
    d.getElementById(destino).click();
    await m.esperar(() => pasoVisible() === esperado || pasoVisible() === id, 10000,
      'el paso no se movió desde ' + actual);
  }
  throw new Error('no se llegó al paso ' + id);
}

// El requerimiento con OCA cargado hasta Revisión, con la justificación
// escrita y la cantidad máxima y mínima dadas por la pantalla.
async function conOca(maxima, minima) {
  await entrarComoUsuario();
  await importar();
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('renglones');
  m.cargarOca([{ maxima: maxima, minima: minima }]);
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  await ir('revision');
}

function vista() {
  const d = m.documento;
  return {
    boton: d.getElementById('sgc-btn-exportar'),
    msj: d.getElementById('sgc-exportar-msj'),
    impreso: d.getElementById('sgc-impreso'),
    renglonesPaso: d.getElementById('sgc-pasos').querySelector('[data-paso="renglones"]'),
    guia: d.getElementById('sgc-oca-justificacion-guia')
  };
}

test('RONDA-39 pieza 1a-1 · con OCA, cantidad 10 y máxima 12: no imprime ni exporta, el motivo los nombra y "2 · Renglones" dice falta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importar();
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('renglones');
  m.cargarOca([{ maxima: 12 }]);
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  await ir('revision');

  const boton = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(boton.disabled, true,
    'con la máxima mayor que la cantidad del renglón no exporta');
  assert.match(msj.textContent,
    /Renglón 1: la cantidad máxima por Solicitud de Provisión \(12\) no puede superar la cantidad del renglón \(10\)/,
    'y el motivo nombra el renglón y los dos números: ' + msj.textContent);

  const marcado = d.getElementById('sgc-pasos')
    .querySelector('[data-paso="renglones"]');
  assert.match(marcado.textContent, /falta/,
    '"2 · Renglones" queda con "· falta": ' + marcado.textContent);

  const antesComp = SGC().generadorDocumentos.expedienteLocal().entregables.length;
  d.getElementById('sgc-btn-imprimir').click();
  assert.strictEqual(SGC().generadorDocumentos.expedienteLocal().entregables.length,
    antesComp, 'Imprimir no compone ningún documento');
  assert.strictEqual(SGC().generadorDocumentos.seccion().textContent.trim(), '',
    'y la sección de impresión queda vacía');
});

test('RONDA-39 pieza 1a-2 · con OCA y máxima 10 (igual a la cantidad del renglón): exporta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importar();
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('renglones');
  m.cargarOca([{ maxima: 10 }]);
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  await ir('revision');

  const boton = d.getElementById('sgc-btn-exportar');
  const marcado = d.getElementById('sgc-pasos')
    .querySelector('[data-paso="renglones"]');
  assert.ok(!/falta/.test(marcado.textContent),
    '"2 · Renglones" no queda en falta: ' + marcado.textContent);
  assert.strictEqual(boton.disabled, false,
    'con la máxima igual al tope del renglón, exporta');

  const antes = m.descargas.length;
  boton.click();
  await m.esperar(() => m.descargas.length > antes, 20000, 'el JSON no se descargó');
  const salida = JSON.parse(await m.descargas[m.descargas.length - 1].texto());
  assert.strictEqual(salida.expediente.renglones[0].cantidadMaxima, 10,
    'y el JSON lleva la máxima cargada');
});

test('RONDA-39 pieza 1a-3 · con OCA, máxima 5 y mínima 8: no exporta y el motivo habla de la mínima', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importar();
  await ir('identificacion');
  m.elegirModalidad('oca');
  await ir('renglones');
  m.cargarOca([{ maxima: 5, minima: 8 }]);
  await ir('fundamentacion');
  m.escribir('sgc-oca-justificacion', JUSTIFICACION_OCA);
  await ir('revision');

  const boton = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(boton.disabled, true,
    'con la mínima mayor que la máxima no exporta');
  assert.match(msj.textContent, /Renglón 1: La cantidad mínima no puede superar la cantidad máxima/,
    'y el motivo habla de la mínima, con el texto del núcleo: ' + msj.textContent);
});

test('RONDA-39 pieza 1b · el requerimiento con OCA y la guía de Fundamentación citan "Decreto 1030/2016, arts. 25 inc. c) y 111"', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  await importar();
  await ir('identificacion');
  m.elegirModalidad('oca');

  const guia = d.getElementById('sgc-oca-justificacion-guia').textContent
    .replace(/\s+/g, ' ');
  assert.match(guia, /Decreto 1030\/2016, arts\. 25 inc\. c\) y 111/,
    'la guía de Fundamentación cita el decreto y los dos artículos: ' + guia);

  await ir('renglones');
  m.cargarOca([{ maxima: 5, minima: 2 }]);
  await ir('fundamentacion');
  await ir('revision');

  const antes = SGC().generadorDocumentos.expedienteLocal().entregables.length;
    20000, 'los documentos se compusieron');

  const impreso = SGC().generadorDocumentos.seccion().textContent.replace(/\s+/g, ' ');
  assert.match(impreso, /Decreto 1030\/2016, arts\. 25 inc\. c\) y 111/,
    'el requerimiento cita el decreto y los dos artículos: ' + impreso.slice(0, 300));
});
